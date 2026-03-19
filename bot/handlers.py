import asyncio
import logging
import time
from telegram import Update
from telegram.error import Conflict
from telegram.ext import ContextTypes

from models.user import user_manager
from codex.collaboration_mode import (
    build_turn_collaboration_mode,
    codex_mode_name,
    find_collaboration_mode_mask,
    with_collaboration_mode_model,
)
from utils.config import get
from bot.keyboard import main_menu_keyboard, interrupt_keyboard
from bot.thread_ui import threads_keyboard
from bot.skills_ui import skills_keyboard
from bot.projects_ui import projects_keyboard
from bot.features_ui import features_keyboard, features_panel_text
from models import state
from utils.single_instance import find_local_conflict_candidates
from utils.local_command import run_bang_command

logger = logging.getLogger("codex-telegram.bot")
_last_conflict_log_at = 0.0


def _mode_label(local_mode: str | None) -> str:
    return "PLAN" if (local_mode or "").strip().lower() == "plan" else "BUILD"


async def _resolve_turn_collaboration_mode(state_user) -> dict | None:
    target_mode = codex_mode_name(state_user.collaboration_mode)
    payload = build_turn_collaboration_mode(state_user.collaboration_mode_mask, target_mode)
    if payload is not None:
        return payload
    if state.codex_client is None:
        return None
    result = await state.codex_client.call("collaborationMode/list")
    mask = find_collaboration_mode_mask(result, target_mode)
    if mask is not None and not mask.get("model"):
        fallback_model = await _resolve_default_model()
        mask = with_collaboration_mode_model(mask, fallback_model)
    state_user.set_collaboration_mode_mask(mask)
    return build_turn_collaboration_mode(mask, target_mode)


async def _resolve_default_model() -> str | None:
    if state.codex_client is None:
        return None
    try:
        config_result = await state.codex_client.call("config/read")
    except Exception:
        config_result = {}
    config = config_result.get("config", {}) if isinstance(config_result, dict) else {}
    if isinstance(config, dict):
        for key in ("model", "model_id", "modelId", "default_model", "defaultModel"):
            value = config.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    try:
        model_result = await state.codex_client.call("model/list", {"limit": 20})
    except Exception:
        return None
    models = model_result.get("data", []) if isinstance(model_result, dict) else []
    if not isinstance(models, list):
        return None
    for model in models:
        if not isinstance(model, dict) or not model.get("isDefault"):
            continue
        for key in ("id", "name", "displayName"):
            value = model.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    if models:
        first = models[0]
        if isinstance(first, dict):
            for key in ("id", "name", "displayName"):
                value = first.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip()
    return None


async def _require_turn_collaboration_mode(state_user) -> dict:
    payload = await _resolve_turn_collaboration_mode(state_user)
    if payload is None:
        raise RuntimeError(
            f"Failed to resolve collaboration mode payload for {_mode_label(state_user.collaboration_mode)}. Turn was not started."
        )
    return payload


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
    
    keyboard = main_menu_keyboard(user_manager.get(user_id).collaboration_mode)
    await send_reply(
        update,
        "Welcome to Codex Telegram Bot!\n\n"
        f"Current mode: {_mode_label(user_manager.get(user_id).collaboration_mode)}\n\n"
        "Available commands:\n"
        "/commands - List all commands\n"
        "/start - Start a new thread\n"
        "/projects - Manage projects\n"
        "/project - Select project\n"
        "/resume <id> - Resume a thread\n"
        "/threads - List your threads\n"
        "/models - List available models\n"
        "/collab - List collaboration modes\n"
        "/mode - Show/toggle collaboration mode\n"
        "/plan - Switch collaboration mode to plan\n"
        "/build - Switch collaboration mode to build(default)\n"
        "/features - Manage beta features\n"
        "/guardian - Show guardian summary (edit in Web UI)\n"
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
        params = {
            "threadId": state_user.active_thread_id,
            "input": [{"type": "text", "text": text}],
        }
        collaboration_mode = await _require_turn_collaboration_mode(state_user)
        params["collaborationMode"] = collaboration_mode
        logger.info(
            "Starting Telegram turn user_id=%s thread_id=%s local_mode=%s target_codex_mode=%s collaboration_payload=%s",
            user_id,
            state_user.active_thread_id,
            state_user.collaboration_mode,
            codex_mode_name(state_user.collaboration_mode),
            collaboration_mode,
        )
        result = await state.codex_client.call("turn/start", params)
        
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
        await send_reply(
            update,
            f"{result.text}\n\nGuardian settings and rules can be edited in Web UI only.",
            user_id,
        )
        return

    if bool(result.meta.get("workspace_changed")):
        mode_label = _mode_label(state_user.collaboration_mode)
        await send_reply(
            update,
            f"{result.text}\nMode: {mode_label}",
            user_id,
            reply_markup=main_menu_keyboard(state_user.collaboration_mode),
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
