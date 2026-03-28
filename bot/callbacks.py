import logging
import asyncio
from asyncio.subprocess import PIPE
from telegram import Update
from telegram.error import BadRequest
from telegram.ext import ContextTypes

from bot.keyboard import main_menu_keyboard, settings_keyboard
from bot.thread_ui import threads_keyboard
from bot.skills_ui import skills_keyboard
from bot.projects_ui import projects_keyboard
from bot.features_ui import features_keyboard, features_panel_text
from models import state
from models.user import user_manager
from codex.commands import CommandResult
from web.runtime import event_hub

logger = logging.getLogger("codex-telegram.bot")
GUARDIAN_WEB_ONLY_TEXT = "Guardian settings and rules can be edited in Web UI only."


def _mode_label(user_id: int) -> str:
    return "PLAN" if user_manager.get(user_id).collaboration_mode == "plan" else "BUILD"


async def _wait_for_codex():
    while not state.codex_ready.is_set():
        await asyncio.sleep(0.1)
    for _ in range(50):
        if state.command_router is not None:
            return
        await asyncio.sleep(0.1)


def _settings_markup(user_id: int):
    return settings_keyboard()


def _main_menu_markup(user_id: int):
    mode = user_manager.get(user_id).collaboration_mode
    return main_menu_keyboard(mode)


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


async def run_callback_command(command: str, user_id: int) -> CommandResult:
    await _wait_for_codex()
    if state.command_router is None:
        return CommandResult(kind="error", text="Codex is still initializing. Please try again in a moment.")
    return await state.command_router.route(command, [], user_id)


async def _run_local_feature_toggle(feature_key: str, enabled: bool) -> tuple[bool, str]:
    action = "enable" if enabled else "disable"
    try:
        proc = await asyncio.create_subprocess_exec(
            "codex",
            "features",
            action,
            feature_key,
            stdout=PIPE,
            stderr=PIPE,
        )
        stdout, stderr = await proc.communicate()
    except Exception as exc:
        return False, str(exc)

    if proc.returncode == 0:
        return True, ""

    err_text = (stderr or stdout).decode(errors="replace").strip()
    if not err_text:
        err_text = f"exit code {proc.returncode}"
    return False, err_text


async def send_threads_page(
    context: ContextTypes.DEFAULT_TYPE,
    user_id: int,
    chat_id: int,
    offset: int,
    limit: int,
    archived: bool = False,
    query=None,
):
    thread_args = ["--limit", str(limit), "--offset", str(offset), "--current-profile"]
    if archived:
        thread_args.append("--archived")
    result = await state.command_router.route("/threads", thread_args, user_id)
    listed = result.meta.get("thread_ids", [])
    if result.kind != "threads" or not listed:
        if query is None:
            await context.bot.send_message(chat_id=chat_id, text=result.text, reply_markup=_main_menu_markup(user_id))
            return
        await edit_with_log(query, context, result.text, user_id, reply_markup=_main_menu_markup(user_id))
        return
    keyboard = threads_keyboard(listed, offset, limit, archived=archived)
    if query is None:
        await context.bot.send_message(chat_id=chat_id, text=result.text, reply_markup=keyboard)
        return
    await edit_with_log(query, context, result.text, user_id, reply_markup=keyboard)


async def send_skills_picker(
    context: ContextTypes.DEFAULT_TYPE,
    user_id: int,
    chat_id: int,
    query=None,
):
    result = await state.command_router.route("/skills", [], user_id)
    skill_names = result.meta.get("skill_names", [])
    if result.kind != "skills" or not skill_names:
        if query is None:
            await context.bot.send_message(chat_id=chat_id, text=result.text, reply_markup=_main_menu_markup(user_id))
            return
        await edit_with_log(query, context, result.text, user_id, reply_markup=_main_menu_markup(user_id))
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
    listed = result.meta.get("project_keys", [])
    if result.kind != "projects" or not listed:
        if query is None:
            await context.bot.send_message(chat_id=chat_id, text=result.text, reply_markup=_main_menu_markup(user_id))
            return
        await edit_with_log(query, context, result.text, user_id, reply_markup=_main_menu_markup(user_id))
        return

    keyboard = projects_keyboard(listed)
    if query is None:
        await context.bot.send_message(chat_id=chat_id, text=result.text, reply_markup=keyboard)
        return
    await edit_with_log(query, context, result.text, user_id, reply_markup=keyboard)


async def send_features_picker(
    context: ContextTypes.DEFAULT_TYPE,
    user_id: int,
    chat_id: int,
    query=None,
):
    from models.user import user_manager

    result = await state.command_router.route("/features", [], user_id)
    keys = result.meta.get("feature_keys", [])
    names = result.meta.get("feature_names", {})
    enabled = result.meta.get("feature_enabled", {})
    if result.kind != "features" or not isinstance(keys, list) or not keys:
        if query is None:
            await context.bot.send_message(chat_id=chat_id, text=result.text, reply_markup=_main_menu_markup(user_id))
            return
        await edit_with_log(query, context, result.text, user_id, reply_markup=_main_menu_markup(user_id))
        return

    state_user = user_manager.get(user_id)
    state_user.set_feature_panel(
        [k for k in keys if isinstance(k, str)],
        names if isinstance(names, dict) else {},
        enabled if isinstance(enabled, dict) else {},
    )
    text = features_panel_text(state_user.feature_panel_keys, state_user.feature_panel_names, state_user.feature_panel_draft)
    keyboard = features_keyboard(
        state_user.feature_panel_keys,
        state_user.feature_panel_names,
        state_user.feature_panel_draft,
    )
    if query is None:
        await context.bot.send_message(chat_id=chat_id, text=text, reply_markup=keyboard)
        return
    await edit_with_log(query, context, text, user_id, reply_markup=keyboard)


async def send_guardian_web_only_notice(
    context: ContextTypes.DEFAULT_TYPE,
    user_id: int,
    chat_id: int,
    query=None,
):
    if query is None:
        await context.bot.send_message(chat_id=chat_id, text=GUARDIAN_WEB_ONLY_TEXT, reply_markup=_settings_markup(user_id))
        return
    await edit_with_log(query, context, GUARDIAN_WEB_ONLY_TEXT, user_id, reply_markup=_settings_markup(user_id))


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
                await context.bot.send_message(chat_id=chat_id, text=result.text, reply_markup=_main_menu_markup(user_id))
            elif command == "menu":
                logger.info("Executing callback action user_id=%s data=%s", user_id, data)
                await context.bot.send_message(
                    chat_id=chat_id,
                    text=f"Main menu\nCurrent mode: {_mode_label(user_id)}",
                    reply_markup=_main_menu_markup(user_id),
                )
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
                await context.bot.send_message(chat_id=chat_id, text=result.text, reply_markup=_settings_markup(user_id))
            elif command == "features":
                logger.info("Executing callback action user_id=%s data=%s", user_id, data)
                await send_features_picker(context, user_id, chat_id)
            elif command == "models":
                logger.info("Executing callback action user_id=%s data=%s", user_id, data)
                result = await run_callback_command("/models", user_id)
                await context.bot.send_message(chat_id=chat_id, text=result.text, reply_markup=_settings_markup(user_id))
            elif command == "mode_current":
                logger.info("Executing callback action user_id=%s data=%s", user_id, data)
                await context.bot.send_message(
                    chat_id=chat_id,
                    text=f"Current mode: {_mode_label(user_id)}",
                    reply_markup=_main_menu_markup(user_id),
                )
            elif command == "mode_quick_toggle":
                logger.info("Executing callback action user_id=%s data=%s", user_id, data)
                next_command = "/build" if user_manager.get(user_id).collaboration_mode == "plan" else "/plan"
                result = await state.command_router.route(next_command, [], user_id)
                await context.bot.send_message(chat_id=chat_id, text=result.text, reply_markup=_main_menu_markup(user_id))
            elif command == "mcp":
                logger.info("Executing callback action user_id=%s data=%s", user_id, data)
                result = await run_callback_command("/mcp", user_id)
                await context.bot.send_message(chat_id=chat_id, text=result.text, reply_markup=_settings_markup(user_id))
            elif command == "config":
                logger.info("Executing callback action user_id=%s data=%s", user_id, data)
                await context.bot.send_message(
                    chat_id=chat_id,
                    text=f"Settings menu\nCurrent mode: {_mode_label(user_id)}",
                    reply_markup=_settings_markup(user_id),
                )
            elif command == "config_view":
                logger.info("Executing callback action user_id=%s data=%s", user_id, data)
                result = await run_callback_command("/config", user_id)
                await context.bot.send_message(chat_id=chat_id, text=result.text, reply_markup=_settings_markup(user_id))
            elif command == "guardian_settings":
                logger.info("Executing callback action user_id=%s data=%s", user_id, data)
                await send_guardian_web_only_notice(context, user_id, chat_id, query=query)
            elif command == "interrupt":
                logger.info("Executing callback action user_id=%s data=%s", user_id, data)
                result = await run_callback_command("/interrupt", user_id)
                await context.bot.send_message(chat_id=chat_id, text=result.text)
        
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
                await edit_with_log(query, context, "Invalid page action.", user_id, reply_markup=_main_menu_markup(user_id))
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

        elif data.startswith("approval:"):
            payload = data[len("approval:"):]
            parts = payload.split(":")
            if len(parts) != 2 or not parts[0].isdigit():
                await edit_with_log(
                    query,
                    context,
                    "Invalid approval action.",
                    user_id,
                )
            else:
                request_id = int(parts[0])
                choice = parts[1].strip().lower()
                if choice not in ("approve", "session", "deny"):
                    await edit_with_log(
                        query,
                        context,
                        "Invalid approval decision.",
                        user_id,
                    )
                elif state.codex_client is None:
                    await edit_with_log(
                        query,
                        context,
                        "Codex client is not ready.",
                        user_id,
                    )
                else:
                    pending = await event_hub.list_approvals(user_id)
                    thread_id = None
                    for item in pending:
                        if isinstance(item, dict) and item.get("id") == request_id:
                            thread = item.get("thread_id")
                            if isinstance(thread, str) and thread:
                                thread_id = thread
                            break
                    accepted = state.codex_client.submit_approval_decision(
                        request_id,
                        choice,
                        thread_id=thread_id,
                    )
                    if not accepted:
                        await edit_with_log(
                            query,
                            context,
                            f"Approval request expired or already handled: {request_id}",
                            user_id,
                        )
                    else:
                        await edit_with_log(
                            query,
                            context,
                            f"Approval sent: request={request_id}, decision={choice}",
                            user_id,
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
            await edit_with_log(query, context, result.text, user_id, reply_markup=_main_menu_markup(user_id))
        
        elif data.startswith("fork:"):
            thread_id = data[5:]
            logger.info("Executing callback action user_id=%s data=%s", user_id, data)
            result = await state.command_router.route("/fork", [thread_id], user_id)
            await edit_with_log(query, context, result.text, user_id, reply_markup=_main_menu_markup(user_id))
        
        elif data.startswith("read:"):
            thread_id = data[5:]
            logger.info("Executing callback action user_id=%s data=%s", user_id, data)
            result = await state.command_router.route("/read", [thread_id], user_id)
            await edit_with_log(query, context, result.text, user_id, reply_markup=_main_menu_markup(user_id))
        
        elif data.startswith("archive:"):
            thread_id = data[8:]
            logger.info("Executing callback action user_id=%s data=%s", user_id, data)
            result = await state.command_router.route("/archive", [thread_id], user_id)
            await edit_with_log(query, context, result.text, user_id, reply_markup=_main_menu_markup(user_id))

        elif data.startswith("unarchive:"):
            thread_id = data[10:]
            logger.info("Executing callback action user_id=%s data=%s", user_id, data)
            result = await state.command_router.route("/unarchive", [thread_id], user_id)
            await edit_with_log(query, context, result.text, user_id, reply_markup=_main_menu_markup(user_id))

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
                reply_markup=_main_menu_markup(user_id),
            )

        elif data.startswith("projectsel:"):
            key = data[len("projectsel:"):].strip()
            logger.info("Executing callback action user_id=%s data=%s", user_id, data)
            try:
                result = await asyncio.wait_for(
                    state.command_router.route("/project", [key], user_id),
                    timeout=12.0,
                )
            except asyncio.TimeoutError:
                result = CommandResult(
                    kind="error",
                    text="Project switch timed out. Please try again or run /start.",
                )
            await edit_with_log(query, context, result.text, user_id, reply_markup=_main_menu_markup(user_id))
        elif data.startswith("feature_toggle:"):
            idx_raw = data[len("feature_toggle:"):].strip()
            if not idx_raw.isdigit():
                await edit_with_log(query, context, "Invalid feature toggle.", user_id, reply_markup=_main_menu_markup(user_id))
            else:
                idx = int(idx_raw)
                state_user = user_manager.get(user_id)
                if idx < 0 or idx >= len(state_user.feature_panel_keys):
                    await edit_with_log(query, context, "Feature index out of range.", user_id, reply_markup=_main_menu_markup(user_id))
                else:
                    key = state_user.feature_panel_keys[idx]
                    current_value = state_user.feature_panel_draft.get(
                        key,
                        state_user.feature_panel_current.get(key, False),
                    )
                    state_user.feature_panel_draft[key] = not current_value
                    text = features_panel_text(
                        state_user.feature_panel_keys,
                        state_user.feature_panel_names,
                        state_user.feature_panel_draft,
                    )
                    keyboard = features_keyboard(
                        state_user.feature_panel_keys,
                        state_user.feature_panel_names,
                        state_user.feature_panel_draft,
                    )
                    await edit_with_log(query, context, text, user_id, reply_markup=keyboard)
        elif data == "feature_refresh":
            await send_features_picker(context, user_id, chat_id, query=query)
        elif data == "feature_apply":
            state_user = user_manager.get(user_id)
            changes: list[tuple[str, bool]] = []
            for key in state_user.feature_panel_keys:
                before = state_user.feature_panel_current.get(key, False)
                after = state_user.feature_panel_draft.get(key, before)
                if before != after:
                    changes.append((key, after))
            if not changes:
                await edit_with_log(
                    query,
                    context,
                    "No changes to apply.",
                    user_id,
                    reply_markup=features_keyboard(
                        state_user.feature_panel_keys,
                        state_user.feature_panel_names,
                        state_user.feature_panel_draft,
                    ),
                )
            else:
                failed: list[str] = []
                applied: list[str] = []
                for key, enabled in changes:
                    ok, detail = await _run_local_feature_toggle(key, enabled)
                    if ok:
                        state_user.feature_panel_current[key] = enabled
                        state_user.feature_panel_draft[key] = enabled
                        action = "enabled" if enabled else "disabled"
                        applied.append(f"{key} ({action})")
                    else:
                        failed.append(f"{key}: {detail}")
                await send_features_picker(context, user_id, chat_id, query=query)
                if applied:
                    await context.bot.send_message(
                        chat_id=chat_id,
                        text=(
                            "Applied to local Codex config:\n- "
                            + "\n- ".join(applied)
                            + "\n\nIf runtime state does not change immediately, restart the bot/app-server."
                        ),
                    )
                if failed:
                    await context.bot.send_message(
                        chat_id=chat_id,
                        text="Failed to apply:\n- " + "\n- ".join(failed),
                    )
        elif data.startswith("guardian_toggle:") or data.startswith("guardian_cycle:") or data in {"guardian_refresh", "guardian_apply"}:
            await send_guardian_web_only_notice(context, user_id, chat_id, query=query)
        else:
            logger.info("Executing callback action user_id=%s data=%s (unsupported)", user_id, data)
            await edit_with_log(query, context, "Unsupported button action.", user_id, reply_markup=_main_menu_markup(user_id))
    except Exception:
        logger.exception("Error handling callback data=%s user_id=%s", data, user_id)
        try:
            await query.answer("Button processing failed", show_alert=True)
        except Exception:
            pass
        await context.bot.send_message(chat_id=user_id, text=f"Button error: {data}")
