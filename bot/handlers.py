import asyncio
import logging
import time
from telegram import Update
from telegram.error import Conflict
from telegram.ext import ContextTypes

from models.user import user_manager
from utils.config import get
from bot.keyboard import main_menu_keyboard, interrupt_keyboard
from bot.thread_ui import threads_keyboard
from bot.skills_ui import skills_keyboard
from bot.projects_ui import projects_keyboard
from bot.features_ui import features_keyboard, features_panel_text
from bot.guardian_ui import guardian_keyboard, guardian_panel_text
from bot.reviewer_ui import reviewer_keyboard, reviewer_panel_text
from models import state
from utils.single_instance import find_local_conflict_candidates
from utils.config import get_reviewer_settings
from utils.local_command import run_bang_command
from utils.workspace_review import capture_git_status_snapshot

logger = logging.getLogger("codex-telegram.bot")
_last_conflict_log_at = 0.0


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
        "/features - Manage beta features\n"
        "/gurdian - Manage guardian approval settings\n"
        "/reviewer - Manage result reviewer settings\n"
        "/skills - List skills\n"
        "/apps - List apps\n"
        "/mcp - MCP server status\n\n"
        f"{start_result.text}\n\n"
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
    
    state_user = user_manager.get(user_id)
    if state_user.awaiting_project_add_name or state_user.awaiting_project_add_path:
        result = await state.command_router.handle_project_add_input(user_id, text)
        await send_reply(update, result.text, user_id)
        return

    if text.startswith("!"):
        result_text = await run_bang_command(text, state_user.selected_project_path)
        await send_reply(update, result_text, user_id)
        return

    await wait_for_codex()

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
    if state_user.validation_session is not None:
        await send_reply(
            update,
            "Reviewer is still processing the previous result. Wait for it to finish before sending a new request.",
            user_id,
        )
        return
    
    if not text:
        return
    
    await send_reply(update, "Processing...", user_id, reply_markup=interrupt_keyboard())
    
    try:
        reviewer_settings = get_reviewer_settings()
        reviewer_enabled = bool(reviewer_settings.get("enabled", False))
        workspace_path = state_user.selected_project_path or ""
        if reviewer_enabled and state_user.active_thread_id:
            workspace_status_before = await capture_git_status_snapshot(workspace_path)
            state_user.set_validation_session(
                state_user.active_thread_id,
                text,
                int(reviewer_settings.get("max_attempts", 1)),
                int(reviewer_settings.get("recent_turn_pairs", 3)),
                workspace_path=workspace_path,
                workspace_status_before=workspace_status_before,
            )
        else:
            state_user.clear_validation_session()
        result = await state.codex_client.call("turn/start", {
            "threadId": state_user.active_thread_id,
            "input": [{"type": "text", "text": text}],
        })
        
        turn = result.get("turn", {})
        turn_id = turn.get("id", "unknown")
        if isinstance(turn_id, str) and turn_id and turn_id != "unknown":
            state_user.set_turn(turn_id)
            if state_user.validation_session is not None:
                state_user.validation_session.set_turn(turn_id)

        if state_user.selected_project_path:
            await send_reply(update, f"Turn started: {turn_id}\nWorkspace: {state_user.selected_project_path}", user_id)
        else:
            await send_reply(update, f"Turn started: {turn_id}", user_id)
        
    except Exception as e:
        state_user.clear_validation_session()
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
    if command == "/threads" and not args:
        args = ["--current-profile"]
    state_user = user_manager.get(user_id)
    if state_user.awaiting_project_add_name or state_user.awaiting_project_add_path:
        state_user.clear_project_add_flow()
    
    result = await state.command_router.route(command, args, user_id)
    if result.kind == "threads":
        listed = result.meta.get("thread_ids", [])
        offset = int(result.meta.get("offset", 0))
        limit = int(result.meta.get("limit", 5))
        archived = bool(result.meta.get("archived", False))
        if not listed:
            await send_reply(update, result.text, user_id)
            return
        await send_reply(
            update,
            result.text,
            user_id,
            reply_markup=threads_keyboard(listed, offset, limit, archived=archived),
        )
        return
    if result.kind == "skills":
        skill_names = result.meta.get("skill_names", [])
        if not skill_names:
            await send_reply(update, result.text, user_id)
            return
        await send_reply(
            update,
            "Skills: choose one to insert template into chat.",
            user_id,
            reply_markup=skills_keyboard(skill_names),
        )
        return
    if result.kind == "projects":
        listed = result.meta.get("project_keys", [])
        if listed:
            await send_reply(
                update,
                result.text,
                user_id,
                reply_markup=projects_keyboard(listed),
            )
            return
        await send_reply(update, result.text, user_id)
        return

    if result.kind == "features":
        keys = result.meta.get("feature_keys", [])
        names = result.meta.get("feature_names", {})
        enabled = result.meta.get("feature_enabled", {})
        if not isinstance(keys, list) or not keys:
            await send_reply(update, result.text, user_id)
            return
        state_user.set_feature_panel(
            [k for k in keys if isinstance(k, str)],
            names if isinstance(names, dict) else {},
            enabled if isinstance(enabled, dict) else {},
        )
        await send_reply(
            update,
            features_panel_text(state_user.feature_panel_keys, state_user.feature_panel_names, state_user.feature_panel_draft),
            user_id,
            reply_markup=features_keyboard(
                state_user.feature_panel_keys,
                state_user.feature_panel_names,
                state_user.feature_panel_draft,
            ),
        )
        return

    if result.kind == "guardian_settings":
        state_user.set_guardian_panel(result.meta if isinstance(result.meta, dict) else {})
        await send_reply(
            update,
            guardian_panel_text(state_user.guardian_panel_current, state_user.guardian_panel_draft),
            user_id,
            reply_markup=guardian_keyboard(state_user.guardian_panel_draft),
        )
        return

    if result.kind == "reviewer_settings":
        state_user.set_reviewer_panel(result.meta if isinstance(result.meta, dict) else {})
        await send_reply(
            update,
            reviewer_panel_text(state_user.reviewer_panel_current, state_user.reviewer_panel_draft),
            user_id,
            reply_markup=reviewer_keyboard(state_user.reviewer_panel_draft),
        )
        return

    await send_reply(update, result.text, user_id)


async def error_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global _last_conflict_log_at
    err = context.error
    if err is None:
        logger.error("Update %s caused unknown error", update)
        return
    if isinstance(err, Conflict):
        now = time.monotonic()
        if now - _last_conflict_log_at >= 30:
            _last_conflict_log_at = now
            token = str(get("bot.token", "")).strip()
            candidates = find_local_conflict_candidates(token)
            logger.error(
                "Telegram polling conflict: another getUpdates consumer is active for this token. "
                "local_candidates=%s",
                ", ".join(str(pid) for pid, _ in candidates) if candidates else "none",
            )
        return
    logger.error(
        "Update %s caused error: %s",
        update,
        err,
        exc_info=(type(err), err, err.__traceback__),
    )
