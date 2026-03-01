import asyncio
import json
import logging
from typing import Any

from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    TypeHandler,
    filters,
)

from utils.config import get
from utils.logger import setup
from codex import CodexClient, CommandRouter
from bot import (
    start_handler,
    message_handler,
    command_handler,
    error_handler,
    callback_handler,
)
from models import state
from models.user import user_manager


logger = setup("codex-telegram")


async def setup_codex() -> CodexClient:
    client = CodexClient()
    await client.start()
    await client.initialize({
        "name": "codex-telegram",
        "title": "Codex Telegram Bot",
        "version": "0.1.0",
    })
    return client


async def post_init(app: Application):
    state.codex_client = await setup_codex()
    state.command_router = CommandRouter(state.codex_client)
    configured_level = str(get("forwarding.app_server_event_level", "INFO")).upper()
    configured_allowlist = get("forwarding.app_server_event_allowlist", [])
    configured_denylist = get("forwarding.app_server_event_denylist", [])
    configured_rules = get("forwarding.rules", [])
    level_map = {
        "DEBUG": 10,
        "INFO": 20,
        "WARNING": 30,
        "ERROR": 40,
        "OFF": 100,
    }
    forward_threshold = level_map.get(configured_level, 20)
    allowlist = configured_allowlist if isinstance(configured_allowlist, list) else []
    denylist = configured_denylist if isinstance(configured_denylist, list) else []
    rules = configured_rules if isinstance(configured_rules, list) else []

    def _method_matches(method: str, patterns: list[str]) -> bool:
        for pattern in patterns:
            if not isinstance(pattern, str):
                continue
            if pattern.endswith("*"):
                if method.startswith(pattern[:-1]):
                    return True
            elif method == pattern:
                return True
        return False

    def _extract_thread_id(method: str, params: dict | None) -> str | None:
        p = params or {}
        if isinstance(p.get("threadId"), str):
            return p["threadId"]
        if isinstance(p.get("conversationId"), str):
            return p["conversationId"]
        thread = p.get("thread")
        if isinstance(thread, dict) and isinstance(thread.get("id"), str):
            return thread["id"]
        if method.startswith("codex/event/"):
            cid = p.get("conversationId")
            if isinstance(cid, str):
                return cid
        return None

    def _extract_text(params: dict | None) -> str | None:
        p = params or {}
        for key in ("delta", "text", "message"):
            value = p.get(key)
            if isinstance(value, str) and value.strip():
                return value
        msg = p.get("msg")
        if isinstance(msg, dict):
            for key in ("message", "text"):
                value = msg.get(key)
                if isinstance(value, str) and value.strip():
                    return value
        return None

    def _get_path_value(payload: dict[str, Any], path: str) -> Any:
        current: Any = payload
        for part in path.split("."):
            if not isinstance(current, dict):
                return None
            current = current.get(part)
            if current is None:
                return None
        return current

    def _normalize_text_paths(value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        return [v for v in value if isinstance(v, str) and v.strip()]

    def _extract_text_by_paths(payload: dict[str, Any], paths: list[str]) -> str | None:
        for path in paths:
            value = _get_path_value(payload, path)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return None

    def _rule_matches(method: str, rule: Any) -> bool:
        if not isinstance(rule, dict):
            return False
        if rule.get("enabled", True) is False:
            return False
        pattern = rule.get("method")
        if not isinstance(pattern, str):
            return False
        return _method_matches(method, [pattern])

    def _has_rule_for_method(method: str) -> bool:
        for rule in rules:
            if not isinstance(rule, dict):
                continue
            if rule.get("enabled", True) is False:
                continue
            pattern = rule.get("method")
            if isinstance(pattern, str) and _method_matches(method, [pattern]):
                return True
        return False

    def _apply_rule(method: str, params: dict | None) -> str | None:
        p = params or {}
        for rule in rules:
            if not _rule_matches(method, rule):
                continue
            require_path = rule.get("require_path")
            if isinstance(require_path, str):
                required = rule.get("require_equals")
                actual = _get_path_value(p, require_path)
                if actual != required:
                    continue
            paths = _normalize_text_paths(rule.get("text_paths"))
            if not paths:
                paths = ["text", "message", "delta", "item.text", "msg.message", "msg.text"]
            text = _extract_text_by_paths(p, paths)
            if text:
                return text
            fallback_mode = str(rule.get("fallback", "drop")).lower()
            if fallback_mode == "json":
                return f"[app-server] {method}: {json.dumps(p, ensure_ascii=False)}"
            continue
        return None

    def _format_event(method: str, params: dict | None) -> str | None:
        p = params or {}
        ruled = _apply_rule(method, p)
        if _has_rule_for_method(method):
            return ruled
        if ruled is not None:
            return ruled
        text = _extract_text(p)
        if method == "item/agentMessage/delta" and text:
            return text
        if method == "turn/started":
            turn_id = (p.get("turn") or {}).get("id") if isinstance(p.get("turn"), dict) else p.get("turnId")
            return f"[app-server] Turn started: {turn_id or 'unknown'}"
        if method == "turn/completed":
            turn_id = (p.get("turn") or {}).get("id") if isinstance(p.get("turn"), dict) else p.get("turnId")
            return f"[app-server] Turn completed: {turn_id or 'unknown'}"
        if method.startswith("codex/event/"):
            if text:
                return f"[app-server] {text}"
            msg = p.get("msg")
            return f"[app-server] {method}: {json.dumps(msg if msg is not None else p, ensure_ascii=False)}"
        if text:
            return f"[app-server] {text}"
        return f"[app-server] {method}: {json.dumps(p, ensure_ascii=False)}"

    def _event_level(method: str, params: dict | None) -> int:
        p = params or {}
        if method == "item/agentMessage/delta":
            return 10
        if method == "item/completed":
            return 20
        if method in ("turn/started", "turn/completed", "thread/status/changed"):
            return 20
        if method.startswith("codex/event/"):
            msg = p.get("msg")
            msg_type = msg.get("type") if isinstance(msg, dict) else None
            if msg_type in ("warning",):
                return 30
            if msg_type in ("error", "fatal"):
                return 40
            return 20
        return 10

    async def forward_event(method: str, params: dict | None):
        if _method_matches(method, denylist):
            return
        if allowlist and not _method_matches(method, allowlist):
            return
        if _event_level(method, params) < forward_threshold:
            return
        thread_id = _extract_thread_id(method, params)
        user_id = user_manager.find_user_id_by_thread(thread_id)
        if user_id is None:
            return

        msg = _format_event(method, params)
        if msg is None:
            return
        if not msg.strip():
            return
        footer = f"\n\nthreadId: {thread_id or 'unknown'}"
        max_body_len = 3900 - len(footer)
        if max_body_len < 1:
            max_body_len = 1
        if len(msg) > max_body_len:
            trunc_suffix = "\n...(truncated)"
            head_len = max_body_len - len(trunc_suffix)
            if head_len < 1:
                head_len = 1
                trunc_suffix = ""
            msg = msg[:head_len] + trunc_suffix
        msg = msg + footer

        logger.info("Forwarding app-server event to Telegram user_id=%s method=%s", user_id, method)
        try:
            await app.bot.send_message(chat_id=user_id, text=msg)
        except Exception:
            logger.exception("Failed to forward app-server event to Telegram")

    state.codex_client.on_any(forward_event)
    
    state.codex_ready.set()
    logger.info("Codex initialized")


async def post_shutdown(app: Application):
    if state.codex_client:
        await state.codex_client.stop()


async def debug_update_handler(update: object, context: Any):
    if not isinstance(update, Update):
        return
    logger.debug(
        "Telegram update received update_id=%s has_message=%s has_callback_query=%s",
        update.update_id,
        update.message is not None,
        update.callback_query is not None,
    )


def main():
    logger.info("Starting Codex Telegram Bot...")
    
    bot_token = get("bot.token")
    drop_pending_raw = get("bot.drop_pending_updates", True)
    if isinstance(drop_pending_raw, bool):
        drop_pending_updates = drop_pending_raw
    elif isinstance(drop_pending_raw, str):
        drop_pending_updates = drop_pending_raw.strip().lower() in ("1", "true", "yes", "on")
    else:
        drop_pending_updates = True
    if not bot_token or bot_token == "YOUR_TELEGRAM_BOT_TOKEN":
        logger.error("Please set bot.token in conf.toml")
        return
    
    app = (
        Application.builder()
        .token(bot_token)
        .post_init(post_init)
        .post_shutdown(post_shutdown)
        .concurrent_updates(True)
        .build()
    )

    app.add_handler(TypeHandler(Update, debug_update_handler), group=-1)
    app.add_handler(CommandHandler("start", start_handler))
    app.add_handler(CommandHandler("help", start_handler))
    app.add_handler(CommandHandler(["commands", "start", "resume", "threads", "read", "archive", "unarchive", "compact", "rollback", "interrupt", "review", "exec", "models", "features", "modes", "skills", "apps", "mcp", "config"], command_handler))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, message_handler))
    app.add_handler(CallbackQueryHandler(callback_handler))
    app.add_error_handler(error_handler)
    
    app.run_polling(
        stop_signals=None,
        allowed_updates=Update.ALL_TYPES,
        drop_pending_updates=drop_pending_updates,
    )


if __name__ == "__main__":
    main()
