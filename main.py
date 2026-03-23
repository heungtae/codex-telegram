import asyncio
import os
import sys
import threading
from typing import Any

from telegram import Update
from telegram.ext import Application

from app_runtime.bootstrap import post_init as _post_init
from app_runtime.bootstrap import post_shutdown as _post_shutdown
from app_runtime.bootstrap import run_without_telegram as _run_without_telegram
from app_runtime.bootstrap import setup_codex as _setup_codex
from app_runtime.telegram_app import build_application
from app_runtime.web_server import WebServerThread, stop_web_server
from bot import callback_handler, command_handler, error_handler, message_handler, start_handler
from codex import CodexClient, CommandRouter
from codex.approval_flow import build_approval_request_handler, build_guardian_config
from codex.approval_guardian import ApprovalGuardianService
from codex.event_forwarding import build_event_forwarder, build_forwarding_config
from codex_telegram import __version__
from models import state
from utils.approval_policy import build_approval_policy_context, match_approval_policy
from utils.config import get, get_config_path, get_guardian_settings, get_telegram_bot
from utils.logger import setup
from utils.normalize import parse_bool
from utils.single_instance import (
    SingleInstanceLock,
    find_local_conflict_candidates,
    terminate_pid,
    token_lock_key,
)
from web import create_web_app

logger = setup("codex-telegram")
_web_server = None
_web_server_thread = None


async def setup_codex() -> CodexClient:
    return await _setup_codex(
        codex_client_factory=CodexClient,
        client_info={
            "name": "codex-telegram",
            "title": "Codex Telegram Bot",
            "version": __version__,
        },
    )


async def post_init(app: Application | None):
    await _post_init(
        app,
        setup_codex_fn=setup_codex,
        command_router_factory=CommandRouter,
        approval_guardian_factory=ApprovalGuardianService,
        build_forwarding_config=build_forwarding_config,
        build_guardian_config=build_guardian_config,
        build_event_forwarder=build_event_forwarder,
        build_approval_request_handler=build_approval_request_handler,
        get_config_value=get,
        get_guardian_settings=get_guardian_settings,
        build_approval_policy_context=build_approval_policy_context,
        match_approval_policy=match_approval_policy,
        to_thread=asyncio.to_thread,
    )


async def post_shutdown(app: Application | None):
    await _post_shutdown(app, state_module=state)


async def debug_update_handler(update: object, context: Any):
    if not isinstance(update, Update):
        return
    logger.debug(
        "Telegram update received update_id=%s has_message=%s has_callback_query=%s",
        update.update_id,
        update.message is not None,
        update.callback_query is not None,
    )


async def _run_without_telegram_channel() -> None:
    await _run_without_telegram(
        post_init_fn=post_init,
        post_shutdown_fn=post_shutdown,
    )


def _parse_web_endpoint() -> tuple[bool, str, int, str]:
    web_enabled = parse_bool(get("web.enabled", False), default=False)
    web_host = str(get("web.host", "127.0.0.1")).strip() or "127.0.0.1"
    web_port_raw = get("web.port", 8080)
    try:
        web_port = int(web_port_raw)
    except Exception:
        web_port = 8080
    ssl_enabled = parse_bool(get("web.ssl_enabled", False), default=False)
    ssl_certfile = str(get("web.ssl_certfile", "")).strip()
    ssl_keyfile = str(get("web.ssl_keyfile", "")).strip()
    scheme = "https" if ssl_enabled else "http"
    return web_enabled, web_host, web_port, f"{scheme}://{web_host}:{web_port}", ssl_enabled, ssl_certfile, ssl_keyfile


def _start_web_server(
    web_host: str, web_port: int, ssl_enabled: bool, ssl_certfile: str, ssl_keyfile: str
) -> tuple[WebServerThread, threading.Thread]:
    server = WebServerThread(web_host, web_port, create_web_app, ssl_enabled, ssl_certfile, ssl_keyfile)
    thread = threading.Thread(target=server.run, daemon=True, name="codex-web-server")
    thread.start()
    return server, thread


def _build_telegram_application(bot_token: str) -> Application:
    return build_application(
        bot_token=bot_token,
        post_init=post_init,
        post_shutdown=post_shutdown,
        debug_update_handler=debug_update_handler,
        start_handler=start_handler,
        command_handler=command_handler,
        message_handler=message_handler,
        callback_handler=callback_handler,
        error_handler=error_handler,
    )


def _resolve_drop_pending_updates() -> bool:
    drop_pending_raw = get_telegram_bot("drop_pending_updates", True)
    return parse_bool(drop_pending_raw, default=True)


def _resolve_conflict_action() -> str:
    action = str(get_telegram_bot("conflict_action", "prompt")).strip().lower()
    if action != "prompt":
        return action
    if sys.stdin.isatty():
        choice = input("Conflict detected. Choose action: [k]ill existing process and continue / [e]xit: ").strip().lower()
        return "kill" if choice.startswith("k") else "exit"
    logger.error("Conflict action is prompt, but no TTY is attached. Falling back to exit.")
    return "exit"


def _acquire_single_instance(bot_token: str) -> SingleInstanceLock | None:
    lock = SingleInstanceLock(f"codex-telegram-{token_lock_key(bot_token)}")
    if lock.acquire():
        return lock

    owner_pid = lock.read_owner_pid()
    candidates = find_local_conflict_candidates(bot_token, exclude_pid=os.getpid())
    logger.error(
        "Another bot instance may be running for the same token (pid=%s).",
        owner_pid if owner_pid is not None else "unknown",
    )
    if candidates:
        logger.error("Local conflict candidates: %s", ", ".join(str(pid) for pid, _ in candidates))

    action = _resolve_conflict_action()
    if action != "kill":
        logger.info("Exiting due to polling conflict.")
        return None

    terminated_any = False
    if owner_pid is not None and lock.terminate_owner():
        terminated_any = True
    for pid, _ in candidates:
        if pid != owner_pid and pid != os.getpid() and terminate_pid(pid):
            terminated_any = True
            logger.info("Terminated local conflict candidate pid=%s.", pid)
    if not terminated_any:
        logger.error("No local process could be terminated for conflict resolution.")
        return None
    if not lock.acquire():
        logger.error("Existing process was terminated but lock is still unavailable.")
        return None
    logger.info("Conflict resolved and lock acquired.")
    return lock


def main():
    global _web_server
    global _web_server_thread

    logger.info("Starting Codex Telegram Bot...")
    logger.info("Using config file %s", get_config_path())

    web_enabled, web_host, web_port, web_endpoint, ssl_enabled, ssl_certfile, ssl_keyfile = _parse_web_endpoint()
    telegram_enabled_env = os.environ.get("CODEX_WEB_ONLY", "").lower()
    if telegram_enabled_env == "1":
        telegram_enabled = False
        if not web_enabled:
            web_enabled = True
    else:
        telegram_enabled = parse_bool(get("telegram.enabled", True), default=True)
    logger.info("Web endpoint configured: %s (enabled=%s)", web_endpoint, web_enabled)
    logger.info("Telegram channel enabled=%s", telegram_enabled)

    if web_enabled:
        _web_server, _web_server_thread = _start_web_server(web_host, web_port, ssl_enabled, ssl_certfile, ssl_keyfile)
        logger.info("Web UI started at %s", web_endpoint)

    if not telegram_enabled:
        try:
            asyncio.run(_run_without_telegram_channel())
        finally:
            stop_web_server(_web_server, _web_server_thread)
        return

    bot_token = get_telegram_bot("token")
    drop_pending_updates = _resolve_drop_pending_updates()

    if not bot_token or bot_token == "YOUR_TELEGRAM_BOT_TOKEN":
        logger.error("Please set telegram.bot.token in conf.toml")
        return

    lock = _acquire_single_instance(bot_token)
    if lock is None:
        stop_web_server(_web_server, _web_server_thread)
        return

    app = _build_telegram_application(bot_token)

    try:
        app.run_polling(
            stop_signals=None,
            allowed_updates=Update.ALL_TYPES,
            drop_pending_updates=drop_pending_updates,
        )
    finally:
        stop_web_server(_web_server, _web_server_thread)
        lock.release()


if __name__ == "__main__":
    main()
