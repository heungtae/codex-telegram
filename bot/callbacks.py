import logging
import asyncio
from telegram import Update
from telegram.error import BadRequest
from telegram.ext import ContextTypes

from bot.keyboard import main_menu_keyboard
from models.user import user_manager
from models import state

logger = logging.getLogger("codex-telegram.bot")


async def _wait_for_codex():
    while not state.codex_ready.is_set():
        await asyncio.sleep(0.1)
    for _ in range(50):
        if state.command_router is not None:
            return
        await asyncio.sleep(0.1)


async def edit_with_log(query, context: ContextTypes.DEFAULT_TYPE, text: str, user_id: int, **kwargs):
    logger.info("Sending Telegram callback message to user_id=%s: %s", user_id, text)
    try:
        await query.edit_message_text(text, **kwargs)
    except BadRequest as e:
        msg = str(e).lower()
        if "message is not modified" in msg:
            return
        if "can't be edited" in msg or "message to edit not found" in msg:
            await context.bot.send_message(chat_id=user_id, text=text, **kwargs)
            return
        raise


async def run_callback_command(command: str, user_id: int) -> str:
    await _wait_for_codex()
    if state.command_router is None:
        return "Codex is still initializing. Please try again in a moment."
    return await state.command_router.route(command, [], user_id)


async def callback_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if query is None:
        return
    user_id = update.effective_user.id
    chat_id = update.effective_chat.id if update.effective_chat else user_id
    data = query.data or ""
    logger.info("Received callback click user_id=%s chat_id=%s data=%s", user_id, chat_id, data)

    try:
        try:
            await query.answer()
        except Exception:
            logger.exception("Failed to answer callback query data=%s user_id=%s", data, user_id)

        if data.startswith("cmd:"):
            command = data[4:]
            if command == "start":
                logger.info("Executing callback action user_id=%s data=%s", user_id, data)
                result = await run_callback_command("/start", user_id)
                await context.bot.send_message(chat_id=chat_id, text=result, reply_markup=main_menu_keyboard())
            elif command == "threads":
                logger.info("Executing callback action user_id=%s data=%s", user_id, data)
                result = await run_callback_command("/threads", user_id)
                await context.bot.send_message(chat_id=chat_id, text=result, reply_markup=main_menu_keyboard())
            elif command == "skills":
                logger.info("Executing callback action user_id=%s data=%s", user_id, data)
                result = await run_callback_command("/skills", user_id)
                await context.bot.send_message(chat_id=chat_id, text=result, reply_markup=main_menu_keyboard())
            elif command == "apps":
                logger.info("Executing callback action user_id=%s data=%s", user_id, data)
                result = await run_callback_command("/apps", user_id)
                await context.bot.send_message(chat_id=chat_id, text=result, reply_markup=main_menu_keyboard())
            elif command == "config":
                logger.info("Executing callback action user_id=%s data=%s", user_id, data)
                result = await run_callback_command("/config", user_id)
                await context.bot.send_message(chat_id=chat_id, text=result, reply_markup=main_menu_keyboard())
        
        elif data.startswith("approve:"):
            action_id = data[8:]
            logger.info("Executing callback action user_id=%s data=%s", user_id, data)
            await edit_with_log(query, context, f"✅ Approved: {action_id}", user_id)
        
        elif data.startswith("deny:"):
            action_id = data[5:]
            logger.info("Executing callback action user_id=%s data=%s", user_id, data)
            await edit_with_log(query, context, f"❌ Denied: {action_id}", user_id)
        
        elif data.startswith("view:"):
            action_id = data[5:]
            logger.info("Executing callback action user_id=%s data=%s", user_id, data)
            await edit_with_log(query, context, f"Details for: {action_id}", user_id)
        
        elif data.startswith("resume:"):
            thread_id = data[7:]
            logger.info("Executing callback action user_id=%s data=%s", user_id, data)
            user_manager.get(user_id).set_thread(thread_id)
            await edit_with_log(query, context, f"Thread {thread_id} set as active.", user_id)
        
        elif data.startswith("fork:"):
            thread_id = data[5:]
            logger.info("Executing callback action user_id=%s data=%s", user_id, data)
            await edit_with_log(query, context, f"Fork thread: {thread_id}", user_id)
        
        elif data.startswith("read:"):
            thread_id = data[5:]
            logger.info("Executing callback action user_id=%s data=%s", user_id, data)
            await edit_with_log(query, context, f"Read thread: {thread_id}", user_id)
        
        elif data.startswith("archive:"):
            thread_id = data[8:]
            logger.info("Executing callback action user_id=%s data=%s", user_id, data)
            await edit_with_log(query, context, f"Archive thread: {thread_id}", user_id)
        else:
            logger.info("Executing callback action user_id=%s data=%s (unsupported)", user_id, data)
            await edit_with_log(query, context, "Unsupported button action.", user_id, reply_markup=main_menu_keyboard())
    except Exception:
        logger.exception("Error handling callback data=%s user_id=%s", data, user_id)
        try:
            await query.answer("Button processing failed", show_alert=True)
        except Exception:
            pass
        await context.bot.send_message(chat_id=user_id, text=f"Button error: {data}")
