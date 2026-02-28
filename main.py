import asyncio
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
from codex import CodexClient, CommandRouter, create_event_handler
from bot import (
    start_handler,
    message_handler,
    command_handler,
    error_handler,
    callback_handler,
)
from models import state


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
    
    event_handler = create_event_handler()
    
    def on_thread_status_changed(params: dict):
        status = params.get("status", {})
        if "waitingOnApproval" in status.get("activeFlags", []):
            thread_id = params.get("threadId")
            logger.info(f"Approval needed for thread: {thread_id}")
    
    event_handler.on("thread/status/changed", on_thread_status_changed)
    
    for method, handler in [
        ("turn/completed", lambda p: logger.debug(f"Turn completed: {p}")),
        ("item/completed", lambda p: logger.debug(f"Item completed: {p}")),
    ]:
        event_handler.on(method, handler)
    
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
