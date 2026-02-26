import logging
from telegram import Update
from telegram.ext import ContextTypes

from codex import CodexClient, CommandRouter
from codex.events import create_event_handler
from models.user import user_manager
from utils.config import get
from bot.keyboard import main_menu_keyboard

logger = logging.getLogger("codex-telegram.bot")


codex_client: CodexClient | None = None
command_router: CommandRouter | None = None


async def start_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    allowed = get("users.allowed_ids", [])
    
    if allowed and user_id not in allowed:
        await update.message.reply_text("❌ You are not authorized to use this bot.")
        return
    
    keyboard = main_menu_keyboard()
    await update.message.reply_text(
        "Welcome to Codex Telegram Bot!\n\n"
        "Available commands:\n"
        "• /start - Start a new thread\n"
        "• /resume <id> - Resume a thread\n"
        "• /threads - List your threads\n"
        "• /models - List available models\n"
        "• /skills - List skills\n"
        "• /apps - List apps\n"
        "• /mcp - MCP server status\n\n"
        "Or just send a message to start a turn!",
        reply_markup=keyboard,
    )


async def message_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    allowed = get("users.allowed_ids", [])
    
    if allowed and user_id not in allowed:
        return
    
    if not codex_client or not command_router:
        await update.message.reply_text("Bot is not ready. Please try again later.")
        return
    
    state = user_manager.get(user_id)
    if not state.active_thread_id:
        await update.message.reply_text(
            "No active thread. Use /start to create one first."
        )
        return
    
    text = update.message.text
    if not text:
        return
    
    await update.message.reply_text("⏳ Processing...")
    
    try:
        result = await codex_client.call("turn/start", {
            "threadId": state.active_thread_id,
            "input": [{"type": "text", "text": text}],
        })
        
        turn = result.get("turn", {})
        turn_id = turn.get("id", "unknown")
        
        await update.message.reply_text(f"Turn started: {turn_id}")
        
    except Exception as e:
        logger.exception("Error processing message")
        await update.message.reply_text(f"Error: {str(e)}")


async def command_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    allowed = get("users.allowed_ids", [])
    
    if allowed and user_id not in allowed:
        await update.message.reply_text("❌ You are not authorized to use this bot.")
        return
    
    if not codex_client or not command_router:
        await update.message.reply_text("Bot is not ready. Please try again later.")
        return
    
    command = update.message.text.split()[0]
    args = update.message.text.split()[1:]
    
    result = await command_router.route(command, args, user_id)
    
    await update.message.reply_text(result)


async def error_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    logger.error(f"Update {update} caused error {context.error}")
