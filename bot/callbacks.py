import logging
from telegram import Update
from telegram.ext import ContextTypes

from bot.keyboard import main_menu_keyboard
from models.user import user_manager

logger = logging.getLogger("codex-telegram.bot")


async def edit_with_log(query, text: str, user_id: int):
    logger.info("Sending Telegram callback message to user_id=%s: %s", user_id, text)
    await query.edit_message_text(text)


async def callback_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    user_id = update.effective_user.id
    await query.answer()
    
    data = query.data
    
    if data.startswith("cmd:"):
        command = data[4:]
        if command == "start":
            await edit_with_log(query, "Use /start command to create a new thread.", user_id)
        elif command == "threads":
            await edit_with_log(query, "Use /threads command to list threads.", user_id)
        elif command == "skills":
            await edit_with_log(query, "Use /skills command to list skills.", user_id)
        elif command == "apps":
            await edit_with_log(query, "Use /apps command to list apps.", user_id)
        elif command == "config":
            await edit_with_log(query, "Use /config command to view configuration.", user_id)
    
    elif data.startswith("approve:"):
        action_id = data[8:]
        await edit_with_log(query, f"✅ Approved: {action_id}", user_id)
    
    elif data.startswith("deny:"):
        action_id = data[5:]
        await edit_with_log(query, f"❌ Denied: {action_id}", user_id)
    
    elif data.startswith("view:"):
        action_id = data[5:]
        await edit_with_log(query, f"Details for: {action_id}", user_id)
    
    elif data.startswith("resume:"):
        thread_id = data[7:]
        user_manager.get(user_id).set_thread(thread_id)
        await edit_with_log(query, f"Thread {thread_id} set as active.", user_id)
    
    elif data.startswith("fork:"):
        thread_id = data[5:]
        await edit_with_log(query, f"Fork thread: {thread_id}", user_id)
    
    elif data.startswith("read:"):
        thread_id = data[5:]
        await edit_with_log(query, f"Read thread: {thread_id}", user_id)
    
    elif data.startswith("archive:"):
        thread_id = data[8:]
        await edit_with_log(query, f"Archive thread: {thread_id}", user_id)
