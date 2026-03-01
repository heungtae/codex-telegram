import logging
import asyncio
from telegram import Update
from telegram.error import BadRequest
from telegram.ext import ContextTypes

from bot.keyboard import main_menu_keyboard
from bot.thread_ui import threads_keyboard
from bot.skills_ui import extract_skill_names, skills_keyboard
from bot.projects_ui import projects_keyboard
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


async def send_threads_page(
    context: ContextTypes.DEFAULT_TYPE,
    user_id: int,
    chat_id: int,
    offset: int,
    limit: int,
    archived: bool = False,
    query=None,
):
    thread_args = ["--limit", str(limit), "--offset", str(offset)]
    if archived:
        thread_args.append("--archived")
    result = await state.command_router.route("/threads", thread_args, user_id)
    if result.startswith("Usage:") or result == "No threads found.":
        if query is None:
            await context.bot.send_message(chat_id=chat_id, text=result, reply_markup=main_menu_keyboard())
            return
        await edit_with_log(query, context, result, user_id, reply_markup=main_menu_keyboard())
        return
    listed = user_manager.get(user_id).last_listed_thread_ids
    keyboard = threads_keyboard(listed, offset, limit, archived=archived)
    if query is None:
        await context.bot.send_message(chat_id=chat_id, text=result, reply_markup=keyboard)
        return
    await edit_with_log(query, context, result, user_id, reply_markup=keyboard)


async def send_skills_picker(
    context: ContextTypes.DEFAULT_TYPE,
    user_id: int,
    chat_id: int,
    query=None,
):
    result = await state.command_router.route("/skills", [], user_id)
    skill_names = extract_skill_names(result)
    if not skill_names or result.startswith("Usage:") or result.startswith("No skills found"):
        if query is None:
            await context.bot.send_message(chat_id=chat_id, text=result, reply_markup=main_menu_keyboard())
            return
        await edit_with_log(query, context, result, user_id, reply_markup=main_menu_keyboard())
        return

    picker_text = "Skills: choose one to insert template into chat."
    keyboard = skills_keyboard(skill_names)
    if query is None:
        await context.bot.send_message(chat_id=chat_id, text=picker_text, reply_markup=keyboard)
        return
    await edit_with_log(query, context, picker_text, user_id, reply_markup=keyboard)


async def send_projects_picker(
    context: ContextTypes.DEFAULT_TYPE,
    user_id: int,
    chat_id: int,
    query=None,
):
    result = await state.command_router.route("/projects", ["--list"], user_id)
    listed = user_manager.get(user_id).last_listed_project_keys
    if not listed or result.startswith("Usage:") or result == "No projects configured.":
        if query is None:
            await context.bot.send_message(chat_id=chat_id, text=result, reply_markup=main_menu_keyboard())
            return
        await edit_with_log(query, context, result, user_id, reply_markup=main_menu_keyboard())
        return

    keyboard = projects_keyboard(listed)
    if query is None:
        await context.bot.send_message(chat_id=chat_id, text=result, reply_markup=keyboard)
        return
    await edit_with_log(query, context, result, user_id, reply_markup=keyboard)


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
                await send_threads_page(context, user_id, chat_id, offset=0, limit=5, archived=False)
            elif command == "skills":
                logger.info("Executing callback action user_id=%s data=%s", user_id, data)
                await send_skills_picker(context, user_id, chat_id)
            elif command == "projects":
                logger.info("Executing callback action user_id=%s data=%s", user_id, data)
                await send_projects_picker(context, user_id, chat_id)
            elif command == "apps":
                logger.info("Executing callback action user_id=%s data=%s", user_id, data)
                result = await run_callback_command("/apps", user_id)
                await context.bot.send_message(chat_id=chat_id, text=result, reply_markup=main_menu_keyboard())
            elif command == "config":
                logger.info("Executing callback action user_id=%s data=%s", user_id, data)
                result = await run_callback_command("/config", user_id)
                await context.bot.send_message(chat_id=chat_id, text=result, reply_markup=main_menu_keyboard())
            elif command == "interrupt":
                logger.info("Executing callback action user_id=%s data=%s", user_id, data)
                result = await run_callback_command("/interrupt", user_id)
                await context.bot.send_message(chat_id=chat_id, text=result, reply_markup=main_menu_keyboard())
        
        elif data.startswith("threads_page:"):
            payload = data[len("threads_page:"):]
            parts = payload.split(":")
            if len(parts) == 2:
                mode = "active"
                offset_raw, limit_raw = parts[0], parts[1]
            elif len(parts) == 3:
                mode, offset_raw, limit_raw = parts[0], parts[1], parts[2]
            else:
                mode, offset_raw, limit_raw = "", "", ""

            if not offset_raw.isdigit() or not limit_raw.isdigit() or mode not in ("active", "arch"):
                await edit_with_log(query, context, "Invalid page action.", user_id, reply_markup=main_menu_keyboard())
            else:
                offset = max(0, int(offset_raw))
                limit = max(1, min(100, int(limit_raw)))
                archived_mode = mode == "arch"
                logger.info(
                    "Executing callback action user_id=%s data=%s offset=%s limit=%s archived=%s",
                    user_id,
                    data,
                    offset,
                    limit,
                    archived_mode,
                )
                await send_threads_page(
                    context,
                    user_id,
                    chat_id,
                    offset=offset,
                    limit=limit,
                    archived=archived_mode,
                    query=query,
                )

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
            result = await state.command_router.route("/resume", [thread_id], user_id)
            await edit_with_log(query, context, result, user_id, reply_markup=main_menu_keyboard())
        
        elif data.startswith("fork:"):
            thread_id = data[5:]
            logger.info("Executing callback action user_id=%s data=%s", user_id, data)
            result = await state.command_router.route("/fork", [thread_id], user_id)
            await edit_with_log(query, context, result, user_id, reply_markup=main_menu_keyboard())
        
        elif data.startswith("read:"):
            thread_id = data[5:]
            logger.info("Executing callback action user_id=%s data=%s", user_id, data)
            result = await state.command_router.route("/read", [thread_id], user_id)
            await edit_with_log(query, context, result, user_id, reply_markup=main_menu_keyboard())
        
        elif data.startswith("archive:"):
            thread_id = data[8:]
            logger.info("Executing callback action user_id=%s data=%s", user_id, data)
            result = await state.command_router.route("/archive", [thread_id], user_id)
            await edit_with_log(query, context, result, user_id, reply_markup=main_menu_keyboard())

        elif data.startswith("unarchive:"):
            thread_id = data[10:]
            logger.info("Executing callback action user_id=%s data=%s", user_id, data)
            result = await state.command_router.route("/unarchive", [thread_id], user_id)
            await edit_with_log(query, context, result, user_id, reply_markup=main_menu_keyboard())

        elif data.startswith("skillpick:"):
            skill_name = data[len("skillpick:"):].strip()
            logger.info("Executing callback action user_id=%s data=%s", user_id, data)
            template = f"${skill_name}"
            await context.bot.send_message(chat_id=chat_id, text=template)
            await edit_with_log(
                query,
                context,
                f"Inserted template: {template}",
                user_id,
                reply_markup=main_menu_keyboard(),
            )

        elif data.startswith("projectsel:"):
            key = data[len("projectsel:"):].strip()
            logger.info("Executing callback action user_id=%s data=%s", user_id, data)
            result = await state.command_router.route("/project", [key], user_id)
            await edit_with_log(query, context, result, user_id, reply_markup=main_menu_keyboard())
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
