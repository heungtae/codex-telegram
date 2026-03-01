import asyncio
import logging
from telegram import Update
from telegram.ext import ContextTypes

from codex import CodexClient, CommandRouter
from codex.events import create_event_handler
from models.user import user_manager
from utils.config import get
from bot.keyboard import main_menu_keyboard, interrupt_keyboard
from bot.thread_ui import parse_threads_options, threads_keyboard
from bot.skills_ui import extract_skill_names, skills_keyboard
from bot.projects_ui import projects_keyboard
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
    message = update.effective_message
    if message is not None:
        await message.reply_text(text, **kwargs)
        return
    chat = update.effective_chat
    if chat is not None:
        await update.get_bot().send_message(chat_id=chat.id, text=text, **kwargs)


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
        "/commands - List all commands\n"
        "/start - Start a new thread\n"
        "/projects - Manage projects\n"
        "/project - Select project\n"
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
    if state_user.awaiting_project_add_name or state_user.awaiting_project_add_path:
        result = await state.command_router.handle_project_add_input(user_id, text)
        await send_reply(update, result, user_id)
        return

    if not state_user.active_thread_id:
        await send_reply(
            update,
            "No active thread. Use /start to create one first.",
            user_id,
        )
        return

    if state_user.active_turn_id:
        await send_reply(
            update,
            (
                "A turn is already running.\n"
                f"threadId: {state_user.active_thread_id}\n"
                f"turnId: {state_user.active_turn_id}\n"
                "Use /interrupt (or the Interrupt button) to stop it first."
            ),
            user_id,
            reply_markup=interrupt_keyboard(),
        )
        return
    
    if not text:
        return
    
    await send_reply(update, "Processing...", user_id, reply_markup=interrupt_keyboard())
    
    try:
        result = await state.codex_client.call("turn/start", {
            "threadId": state_user.active_thread_id,
            "input": [{"type": "text", "text": text}],
        })
        
        turn = result.get("turn", {})
        turn_id = turn.get("id", "unknown")
        if isinstance(turn_id, str) and turn_id and turn_id != "unknown":
            state_user.set_turn(turn_id)

        if state_user.selected_project_path:
            await send_reply(update, f"Turn started: {turn_id}\nWorkspace: {state_user.selected_project_path}", user_id)
        else:
            await send_reply(update, f"Turn started: {turn_id}", user_id)
        
    except Exception as e:
        logger.exception("Error processing message")
        await send_reply(update, f"Error: {str(e)}", user_id)


async def command_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    message = update.effective_message
    text = message.text if message else ""
    logger.info("Received Telegram command from user_id=%s: %s", user_id, text)
    allowed = get("users.allowed_ids", [])
    
    if allowed and user_id not in allowed:
        await send_reply(update, "You are not authorized to use this bot.", user_id)
        return
    
    await wait_for_codex()
    
    parts = text.split()
    if not parts:
        return
    command = parts[0]
    args = parts[1:]
    state_user = user_manager.get(user_id)
    if state_user.awaiting_project_add_name or state_user.awaiting_project_add_path:
        state_user.clear_project_add_flow()
    
    result = await state.command_router.route(command, args, user_id)
    if command == "/threads":
        if result.startswith("Usage:") or result == "No threads found.":
            await send_reply(update, result, user_id)
            return
        offset, limit, archived = parse_threads_options(args)
        listed = user_manager.get(user_id).last_listed_thread_ids
        await send_reply(
            update,
            result,
            user_id,
            reply_markup=threads_keyboard(listed, offset, limit, archived=archived),
        )
        return
    if command == "/skills":
        skill_names = extract_skill_names(result)
        if not skill_names or result.startswith("Usage:") or result.startswith("No skills found"):
            await send_reply(update, result, user_id)
            return
        await send_reply(
            update,
            "Skills: choose one to insert template into chat.",
            user_id,
            reply_markup=skills_keyboard(skill_names),
        )
        return
    if command == "/projects":
        if result.startswith("Usage:") or result == "No projects configured.":
            await send_reply(update, result, user_id)
            return
        if result.startswith("Projects:"):
            listed = user_manager.get(user_id).last_listed_project_keys
            await send_reply(
                update,
                result,
                user_id,
                reply_markup=projects_keyboard(listed),
            )
            return
        await send_reply(update, result, user_id)
        return

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
