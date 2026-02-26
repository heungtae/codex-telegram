import logging
from telegram import Update
from telegram.ext import ContextTypes

from bot.keyboard import main_menu_keyboard
from models.user import user_manager

logger = logging.getLogger("codex-telegram.bot")


async def callback_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    data = query.data
    
    if data.startswith("cmd:"):
        command = data[4:]
        if command == "start":
            await query.edit_message_text("Use /start command to create a new thread.")
        elif command == "threads":
            await query.edit_message_text("Use /threads command to list threads.")
        elif command == "skills":
            await query.edit_message_text("Use /skills command to list skills.")
        elif command == "apps":
            await query.edit_message_text("Use /apps command to list apps.")
        elif command == "config":
            await query.edit_message_text("Use /config command to view configuration.")
    
    elif data.startswith("approve:"):
        action_id = data[8:]
        await query.edit_message_text(f"✅ Approved: {action_id}")
    
    elif data.startswith("deny:"):
        action_id = data[5:]
        await query.edit_message_text(f"❌ Denied: {action_id}")
    
    elif data.startswith("view:"):
        action_id = data[5:]
        await query.edit_message_text(f"Details for: {action_id}")
    
    elif data.startswith("resume:"):
        thread_id = data[7:]
        user_id = update.effective_user.id
        user_manager.get(user_id).set_thread(thread_id)
        await query.edit_message_text(f"Thread {thread_id} set as active.")
    
    elif data.startswith("fork:"):
        thread_id = data[5:]
        await query.edit_message_text(f"Fork thread: {thread_id}")
    
    elif data.startswith("read:"):
        thread_id = data[5:]
        await query.edit_message_text(f"Read thread: {thread_id}")
    
    elif data.startswith("archive:"):
        thread_id = data[8:]
        await query.edit_message_text(f"Archive thread: {thread_id}")
