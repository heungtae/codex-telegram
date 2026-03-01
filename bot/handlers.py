import asyncio
import logging
from telegram import Update
from telegram.ext import ContextTypes

from codex import CodexClient, CommandRouter
from codex.events import create_event_handler
from models.user import user_manager
from utils.config import get
from bot.keyboard import main_menu_keyboard
from models import state

logger = logging.getLogger("codex-telegram.bot")


async def wait_for_codex():
    while not state.codex_ready.is_set():
        await asyncio.sleep(0.1)
    for _ in range(50):
        if state.command_router is not None:
            return
        await asyncio.sleep(0.1)


async def send_reply(update: Update, text: str, user_id: int, **kwargs):
    logger.info("Sending Telegram message to user_id=%s: %s", user_id, text)
    await update.message.reply_text(text, **kwargs)


async def start_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    allowed = get("users.allowed_ids", [])
    
    if allowed and user_id not in allowed:
        await send_reply(update, "You are not authorized to use this bot.", user_id)
        return

    await wait_for_codex()
    start_result = await state.command_router.route("/start", [], user_id)
    
    keyboard = main_menu_keyboard()
    await send_reply(
        update,
        "Welcome to Codex Telegram Bot!\n\n"
        "Available commands:\n"
        "/start - Start a new thread\n"
        "/resume <id> - Resume a thread\n"
        "/threads - List your threads\n"
        "/models - List available models\n"
        "/skills - List skills\n"
        "/apps - List apps\n"
        "/mcp - MCP server status\n\n"
        f"{start_result}\n\n"
        "Or just send a message to start a turn!",
        user_id,
        reply_markup=keyboard,
    )


async def message_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    text = update.message.text if update.message else ""
    logger.info("Received Telegram message from user_id=%s: %s", user_id, text)
    allowed = get("users.allowed_ids", [])
    
    if allowed and user_id not in allowed:
        return
    
    await wait_for_codex()
    
    state_user = user_manager.get(user_id)
    if not state_user.active_thread_id:
        await send_reply(
            update,
            "No active thread. Use /start to create one first.",
            user_id,
        )
        return
    
    if not text:
        return
    
    await send_reply(update, "Processing...", user_id)
    
    try:
        result = await state.codex_client.call("turn/start", {
            "threadId": state_user.active_thread_id,
            "input": [{"type": "text", "text": text}],
        })
        
        turn = result.get("turn", {})
        turn_id = turn.get("id", "unknown")
        
        await send_reply(update, f"Turn started: {turn_id}", user_id)
        
    except Exception as e:
        logger.exception("Error processing message")
        await send_reply(update, f"Error: {str(e)}", user_id)


async def command_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    text = update.message.text if update.message else ""
    logger.info("Received Telegram command from user_id=%s: %s", user_id, text)
    allowed = get("users.allowed_ids", [])
    
    if allowed and user_id not in allowed:
        await send_reply(update, "You are not authorized to use this bot.", user_id)
        return
    
    await wait_for_codex()
    
    command = text.split()[0]
    args = text.split()[1:]
    
    result = await state.command_router.route(command, args, user_id)
    
    await send_reply(update, result, user_id)


async def error_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    err = context.error
    if err is None:
        logger.error("Update %s caused unknown error", update)
        return
    logger.error(
        "Update %s caused error: %s",
        update,
        err,
        exc_info=(type(err), err, err.__traceback__),
    )
