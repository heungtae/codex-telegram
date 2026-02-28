import asyncio
import json
import logging

from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
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

    def _format_event(method: str, params: dict | None) -> str:
        p = params or {}
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
        if not msg.strip():
            return
        if len(msg) > 3900:
            msg = msg[:3900] + "\n...(truncated)"

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


def main():
    logger.info("Starting Codex Telegram Bot...")
    
    bot_token = get("bot.token")
    if not bot_token or bot_token == "YOUR_TELEGRAM_BOT_TOKEN":
        logger.error("Please set bot.token in conf.toml")
        return
    
    app = Application.builder().token(bot_token).post_init(post_init).post_shutdown(post_shutdown).build()
    
    app.add_handler(CommandHandler("start", start_handler))
    app.add_handler(CommandHandler("help", start_handler))
    app.add_handler(CommandHandler(["start", "resume", "threads", "read", "archive", "unarchive", "compact", "rollback", "interrupt", "review", "exec", "models", "features", "modes", "skills", "apps", "mcp", "config"], command_handler))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, message_handler))
    app.add_handler(CallbackQueryHandler(callback_handler))
    app.add_error_handler(error_handler)
    
    app.run_polling(stop_signals=None)


if __name__ == "__main__":
    main()
