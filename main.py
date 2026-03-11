import asyncio
import json
import logging
import os
import sys
import threading
from typing import Any

from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    TypeHandler,
    filters,
)

from utils.config import get, get_config_path, get_guardian_settings, get_reviewer_settings, get_telegram_bot
from utils.logger import setup
from utils.single_instance import (
    SingleInstanceLock,
    find_local_conflict_candidates,
    terminate_pid,
    token_lock_key,
)
from utils.workspace_review import capture_git_status_snapshot, collect_workspace_change_review
from codex import CodexClient, CommandRouter
from codex.approval_guardian import ApprovalGuardianService, GuardianDecision
from codex.result_verifier import ResultVerifierService, VerifierDecision
from bot import (
    start_handler,
    message_handler,
    command_handler,
    error_handler,
    callback_handler,
)
from bot.keyboard import approval_keyboard
from models import state
from models.user import user_manager
from web import create_web_app
from web.runtime import event_hub
logger = setup("codex-telegram")
_web_server = None
_web_server_thread = None
_validation_tasks: set[asyncio.Task[Any]] = set()


def _track_validation_task(task: asyncio.Task[Any], description: str) -> asyncio.Task[Any]:
    _validation_tasks.add(task)

    def _on_done(done_task: asyncio.Task[Any]) -> None:
        _validation_tasks.discard(done_task)
        try:
            done_task.result()
        except asyncio.CancelledError:
            logger.debug("Cancelled background task description=%s", description)
        except Exception:
            logger.exception("Background task failed description=%s", description)

    task.add_done_callback(_on_done)
    return task


async def _cancel_validation_tasks() -> None:
    tasks = list(_validation_tasks)
    if not tasks:
        return
    for task in tasks:
        task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)


class WebServerThread:
    def __init__(self, host: str, port: int):
        self.host = host
        self.port = port
        self.server = None

    def run(self):
        try:
            import uvicorn

            app = create_web_app()
            config = uvicorn.Config(app, host=self.host, port=self.port, log_level="info", access_log=False)
            self.server = uvicorn.Server(config)
            self.server.run()
        except Exception:
            logger.exception("Failed to start Web UI server")

    def stop(self):
        if self.server is not None:
            self.server.should_exit = True


async def setup_codex() -> CodexClient:
    client = CodexClient()
    await client.start()
    await client.initialize({
        "name": "codex-telegram",
        "title": "Codex Telegram Bot",
        "version": "0.2.0",
    })
    return client


async def post_init(app: Application | None):
    state.codex_client = await setup_codex()
    state.command_router = CommandRouter(state.codex_client)
    state.approval_guardian = ApprovalGuardianService()
    state.result_verifier = ResultVerifierService()
    configured_level = str(get("forwarding.app_server_event_level", "INFO")).upper()
    configured_allowlist = get("forwarding.app_server_event_allowlist", [])
    configured_denylist = get("forwarding.app_server_event_denylist", [])
    configured_rules = get("forwarding.rules", [])
    level_map = {
        "DEBUG": 10,
        "INFO": 20,
        "WARNING": 30,
        "ERROR": 40,
        "OFF": 100,
    }
    forward_threshold = level_map.get(configured_level, 20)
    allowlist = configured_allowlist if isinstance(configured_allowlist, list) else []
    denylist = configured_denylist if isinstance(configured_denylist, list) else []
    rules = configured_rules if isinstance(configured_rules, list) else []

    def _method_matches(method: str, patterns: list[str]) -> bool:
        for pattern in patterns:
            if not isinstance(pattern, str):
                continue
            if pattern.endswith("*"):
                if method.startswith(pattern[:-1]):
                    return True
            elif method == pattern:
                return True
        return False

    def _extract_thread_id(method: str, params: dict | None) -> str | None:
        p = params or {}
        if isinstance(p.get("threadId"), str):
            return p["threadId"]
        if isinstance(p.get("conversationId"), str):
            return p["conversationId"]
        thread = p.get("thread")
        if isinstance(thread, dict) and isinstance(thread.get("id"), str):
            return thread["id"]
        if method.startswith("codex/event/"):
            cid = p.get("conversationId")
            if isinstance(cid, str):
                return cid
        return None

    def _extract_turn_id(method: str, params: dict | None) -> str | None:
        p = params or {}
        turn = p.get("turn")
        if isinstance(turn, dict) and isinstance(turn.get("id"), str):
            return turn.get("id")
        if isinstance(p.get("turnId"), str):
            return p.get("turnId")
        if method.startswith("turn/"):
            if isinstance(p.get("id"), str):
                return p.get("id")
        return None

    def _extract_text(params: dict | None) -> str | None:
        p = params or {}
        for key in ("delta", "text", "message"):
            value = p.get(key)
            if isinstance(value, str) and value.strip():
                return value
        msg = p.get("msg")
        if isinstance(msg, dict):
            for key in ("message", "text"):
                value = msg.get(key)
                if isinstance(value, str) and value.strip():
                    return value
        return None

    def _extract_message_variant(params: dict | None) -> str | None:
        p = params or {}
        candidates: list[str] = []
        for key in ("role", "author", "speaker", "source", "name", "agentName", "agent"):
            value = p.get(key)
            if isinstance(value, str):
                candidates.append(value)
        item = p.get("item")
        if isinstance(item, dict):
            for key in ("role", "author", "speaker", "source", "name", "agentName", "agent", "type"):
                value = item.get(key)
                if isinstance(value, str):
                    candidates.append(value)
        for raw in candidates:
            normalized = raw.strip().lower().replace("_", "").replace("-", "").replace(" ", "")
            if not normalized:
                continue
            if normalized in {"assistant", "agent", "message", "agentmessage", "assistantmessage", "model", "default"}:
                continue
            return "subagent"
        return None

    def _get_path_value(payload: dict[str, Any], path: str) -> Any:
        current: Any = payload
        for part in path.split("."):
            if not isinstance(current, dict):
                return None
            current = current.get(part)
            if current is None:
                return None
        return current

    def _normalize_text_paths(value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        return [v for v in value if isinstance(v, str) and v.strip()]

    def _extract_text_by_paths(payload: dict[str, Any], paths: list[str]) -> str | None:
        for path in paths:
            value = _get_path_value(payload, path)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return None

    def _rule_matches(method: str, rule: Any) -> bool:
        if not isinstance(rule, dict):
            return False
        if rule.get("enabled", True) is False:
            return False
        pattern = rule.get("method")
        if not isinstance(pattern, str):
            return False
        return _method_matches(method, [pattern])

    def _has_rule_for_method(method: str) -> bool:
        for rule in rules:
            if not isinstance(rule, dict):
                continue
            if rule.get("enabled", True) is False:
                continue
            pattern = rule.get("method")
            if isinstance(pattern, str) and _method_matches(method, [pattern]):
                return True
        return False

    def _apply_rule(method: str, params: dict | None) -> str | None:
        p = params or {}
        for rule in rules:
            if not _rule_matches(method, rule):
                continue
            require_path = rule.get("require_path")
            if isinstance(require_path, str):
                required = rule.get("require_equals")
                actual = _get_path_value(p, require_path)
                if actual != required:
                    continue
            paths = _normalize_text_paths(rule.get("text_paths"))
            if not paths:
                paths = ["text", "message", "delta", "item.text", "msg.message", "msg.text"]
            text = _extract_text_by_paths(p, paths)
            if text:
                return text
            fallback_mode = str(rule.get("fallback", "drop")).lower()
            if fallback_mode == "json":
                return f"[app-server] {method}: {json.dumps(p, ensure_ascii=False)}"
            continue
        return None

    def _format_event(method: str, params: dict | None) -> str | None:
        p = params or {}
        ruled = _apply_rule(method, p)
        if _has_rule_for_method(method):
            return ruled
        if ruled is not None:
            return ruled
        text = _extract_text(p)
        if method == "thread/status/changed":
            waiting = p.get("waitingOnApproval")
            status = p.get("status")
            if waiting is True:
                return "[app-server] Waiting for approval."
            if isinstance(status, str) and status.strip():
                return f"[app-server] Thread status changed: {status}"
        if method == "item/agentMessage/delta" and text:
            return text
        if method == "turn/started":
            turn_id = (p.get("turn") or {}).get("id") if isinstance(p.get("turn"), dict) else p.get("turnId")
            return f"[app-server] Turn started: {turn_id or 'unknown'}"
        if method == "turn/completed":
            turn_id = (p.get("turn") or {}).get("id") if isinstance(p.get("turn"), dict) else p.get("turnId")
            return f"[app-server] Turn completed: {turn_id or 'unknown'}"
        if method.startswith("codex/event/"):
            if text:
                return f"[app-server] {text}"
            msg = p.get("msg")
            return f"[app-server] {method}: {json.dumps(msg if msg is not None else p, ensure_ascii=False)}"
        if text:
            return f"[app-server] {text}"
        return f"[app-server] {method}: {json.dumps(p, ensure_ascii=False)}"

    def _event_level(method: str, params: dict | None) -> int:
        p = params or {}
        if "approval" in method.lower() or p.get("waitingOnApproval") is True:
            return 20
        if method == "item/agentMessage/delta":
            return 10
        if method == "item/completed":
            return 20
        if method in ("turn/started", "turn/completed", "thread/status/changed"):
            return 20
        if method.startswith("codex/event/"):
            msg = p.get("msg")
            msg_type = msg.get("type") if isinstance(msg, dict) else None
            if msg_type in ("warning",):
                return 30
            if msg_type in ("error", "fatal"):
                return 40
            return 20
        return 10

    async def _send_telegram_message(user_id: int, text: str, thread_id: str | None):
        if user_id <= 0 or app is None or not text.strip():
            return
        footer = f"\n\nthreadId: {thread_id or 'unknown'}"
        max_body_len = 3900 - len(footer)
        body = text
        if len(body) > max_body_len:
            body = body[: max(1, max_body_len - len("\n...(truncated)"))] + "\n...(truncated)"
        try:
            await app.bot.send_message(chat_id=user_id, text=body + footer)
        except Exception:
            logger.exception("Failed to send validation result to Telegram user_id=%s", user_id)

    async def _publish_turn_event(
        user_id: int,
        event_type: str,
        thread_id: str | None,
        turn_id: str | None,
        text: str = "",
        params: dict[str, Any] | None = None,
    ):
        await event_hub.publish_event(
            user_id,
            {
                "type": event_type,
                "thread_id": thread_id,
                "turn_id": turn_id,
                "text": text,
                "params": params or {},
            },
        )

    async def _publish_validation_note(
        user_id: int,
        thread_id: str | None,
        turn_id: str | None,
        note: str,
    ):
        message = note.strip()
        if not message:
            return
        await _publish_system_message(user_id, thread_id, turn_id, message)
        await _send_telegram_message(user_id, message, thread_id)

    async def _publish_validation_failure(
        user_id: int,
        thread_id: str | None,
        turn_id: str | None,
        message: str,
    ):
        await event_hub.publish_event(
            user_id,
            {
                "type": "turn_failed",
                "thread_id": thread_id,
                "turn_id": turn_id,
                "text": message,
                "params": {},
            },
        )
        await _send_telegram_message(user_id, message, thread_id)

    def _clip_text(value: str, limit: int = 800) -> str:
        text = str(value or "").strip()
        if len(text) <= limit:
            return text
        return text[: max(1, limit - len("\n...(truncated)"))] + "\n...(truncated)"

    async def _publish_system_message(
        user_id: int | None,
        thread_id: str | None,
        turn_id: str | None,
        text: str,
    ):
        if user_id is None:
            return
        message = text.strip()
        if not message:
            return
        await event_hub.publish_event(
            user_id,
            {
                "type": "system_message",
                "thread_id": thread_id,
                "turn_id": turn_id,
                "text": message,
            },
        )

    async def _publish_reviewer_state(
        user_id: int | None,
        thread_id: str | None,
        turn_id: str | None,
        active: bool,
    ):
        if user_id is None:
            return
        await event_hub.publish_event(
            user_id,
            {
                "type": "reviewer_state",
                "thread_id": thread_id,
                "turn_id": turn_id,
                "active": active,
            },
        )

    async def _refresh_validation_workspace_snapshot(session) -> None:
        if session is None:
            return
        session.update_workspace_status_before(
            await capture_git_status_snapshot(session.workspace_path)
        )

    def _build_retry_prompt(
        original_input: str,
        decision: VerifierDecision,
        attempt_number: int,
        max_attempts: int,
    ) -> str:
        missing = ""
        if decision.missing_requirements:
            missing = "\n".join(f"- {item}" for item in decision.missing_requirements)
        return (
            "Revise your implementation to satisfy the user's request.\n"
            "Focus on the actual workspace changes.\n"
            "Do not mention the reviewer, validation, or internal retry process.\n"
            f"Attempt: {attempt_number}/{max_attempts}\n\n"
            f"Original user request:\n{original_input}\n\n"
            f"Code review summary:\n{decision.summary or '(none)'}\n\n"
            f"Required code changes:\n{decision.feedback or '(none)'}\n\n"
            f"Missing requirements:\n{missing or '(none)'}\n"
        )

    async def _request_reviewer_retry(
        user_id: int,
        thread_id: str,
        turn_id: str | None,
        state_user,
        session,
        decision: VerifierDecision,
    ) -> bool:
        if session.attempt_count >= session.max_attempts:
            await _publish_reviewer_state(user_id, thread_id, turn_id, False)
            state_user.clear_validation_session()
            await _publish_validation_note(
                user_id,
                thread_id,
                turn_id,
                "Reviewer reached max attempts.\nKeeping the latest generated result.",
            )
            return False

        session.attempt_count += 1
        session.last_feedback = decision.feedback or decision.summary
        session.reset_buffer()
        await _publish_system_message(
            user_id,
            thread_id,
            turn_id,
            (
                "Reviewer requested retry.\n"
                f"Next attempt: {session.attempt_count}/{session.max_attempts}\n"
                f"Reason: {_clip_text(decision.summary or decision.feedback or '(none)', 500)}"
            ),
        )
        retry_prompt = _build_retry_prompt(
            session.original_input,
            decision,
            session.attempt_count,
            session.max_attempts,
        )
        try:
            await _refresh_validation_workspace_snapshot(session)
            retry_result = await state.codex_client.call(
                "turn/start",
                {
                    "threadId": thread_id,
                    "input": [{"type": "text", "text": retry_prompt}],
                },
            )
        except Exception as exc:
            await _publish_reviewer_state(user_id, thread_id, turn_id, False)
            state_user.clear_validation_session()
            await _publish_validation_note(
                user_id,
                thread_id,
                turn_id,
                f"Reviewer requested a retry but restart failed.\nReason: {exc}",
            )
            return False

        new_turn = retry_result.get("turn", {}) if isinstance(retry_result, dict) else {}
        new_turn_id = new_turn.get("id") if isinstance(new_turn, dict) else None
        if isinstance(new_turn_id, str) and new_turn_id:
            session.set_turn(new_turn_id)
            state_user.set_turn(new_turn_id)
            return True
        session.set_turn(None)
        return True

    async def _handle_validation_completion(user_id: int, thread_id: str, turn_id: str | None):
        state_user = user_manager.get(user_id)
        session = state_user.validation_session
        if session is None or session.thread_id != thread_id:
            state_user.clear_turn()
            return
        await _publish_reviewer_state(user_id, thread_id, turn_id, True)
        state_user.set_turn(None)
        session.set_turn(None)
        reviewer_settings = get_reviewer_settings()
        timeout_seconds = int(reviewer_settings.get("timeout_seconds", 8))
        if state.result_verifier is None:
            state.result_verifier = ResultVerifierService()

        code_change_review = await collect_workspace_change_review(
            session.workspace_path,
            session.workspace_status_before,
        )
        if code_change_review is None:
            await _publish_reviewer_state(user_id, thread_id, turn_id, False)
            state_user.clear_validation_session()
            return

        code_reviewer_request_message = (
            "Reviewer code-change request\n"
            f"Attempt: {session.attempt_count}/{session.max_attempts}\n"
            f"Changed files:\n{_clip_text(chr(10).join(code_change_review.changed_files) or '(none)', 800)}\n\n"
            f"Git status delta:\n{_clip_text(code_change_review.git_status or '(none)', 900)}\n\n"
            f"Diff stat:\n{_clip_text(code_change_review.diff_stat or '(none)', 900)}"
        )
        logger.info(
            "Reviewer code-change request thread_id=%s turn_id=%s files=%s",
            thread_id,
            turn_id,
            code_change_review.changed_files,
        )
        await _publish_system_message(user_id, thread_id, turn_id, code_reviewer_request_message)
        await _publish_system_message(
            user_id,
            thread_id,
            turn_id,
            "Reviewer is checking workspace code changes.",
        )

        try:
            code_decision = await state.result_verifier.verify(
                {
                    "review_mode": "code_changes",
                    "user_request": session.original_input,
                    "changed_files": code_change_review.changed_files,
                    "git_status": code_change_review.git_status,
                    "diff_stat": code_change_review.diff_stat,
                    "diff_excerpt": code_change_review.diff_excerpt,
                },
                timeout_seconds=max(1, timeout_seconds),
            )
        except asyncio.TimeoutError:
            code_decision = None
            code_verifier_error = f"Reviewer code-change timeout after {timeout_seconds}s"
        except Exception as exc:
            code_decision = None
            code_verifier_error = f"Reviewer code-change check failed: {exc}"
        else:
            code_verifier_error = ""

        if code_decision is None:
            logger.info(
                "Reviewer code-change unavailable thread_id=%s turn_id=%s reason=%s",
                thread_id,
                turn_id,
                code_verifier_error,
            )
            await _publish_system_message(
                user_id,
                thread_id,
                turn_id,
                f"Reviewer code-change check unavailable.\nReason: {code_verifier_error}",
            )
            await _publish_reviewer_state(user_id, thread_id, turn_id, False)
            state_user.clear_validation_session()
            await _publish_validation_note(
                user_id,
                thread_id,
                turn_id,
                f"Keeping the current generated result.\nReason: {code_verifier_error}",
            )
            return

        code_reviewer_result_message = (
            "Reviewer code-change result\n"
            f"Decision: {code_decision.decision}\n"
            f"Summary: {code_decision.summary or '(none)'}\n"
            f"Feedback: {_clip_text(code_decision.feedback or '(none)', 900)}"
        )
        logger.info(
            "Reviewer code-change result thread_id=%s turn_id=%s decision=%s summary=%s",
            thread_id,
            turn_id,
            code_decision.decision,
            code_decision.summary,
        )
        await _publish_system_message(user_id, thread_id, turn_id, code_reviewer_result_message)
        if code_decision.decision != "pass":
            await _request_reviewer_retry(
                user_id,
                thread_id,
                turn_id,
                state_user,
                session,
                code_decision,
            )
            return

        await _publish_reviewer_state(user_id, thread_id, turn_id, False)
        state_user.clear_validation_session()

    async def forward_event(method: str, params: dict | None):
        thread_id = _extract_thread_id(method, params)
        turn_id = _extract_turn_id(method, params)
        user_id_by_thread = user_manager.find_user_id_by_thread(thread_id)
        owner_id = user_manager.find_user_id_by_turn(turn_id)
        if owner_id is None:
            owner_id = user_id_by_thread
        state_user = user_manager.get(owner_id) if owner_id is not None else None
        validation_session = (
            state_user.validation_session
            if state_user is not None
            and state_user.validation_session is not None
            and state_user.validation_session.thread_id == thread_id
            else None
        )

        # Keep runtime turn state in sync even when event forwarding is filtered out.
        if method == "turn/started" and turn_id and owner_id is not None:
            user_manager.get(owner_id).set_turn(turn_id)
            if validation_session is not None:
                validation_session.set_turn(turn_id)
        elif method in ("turn/completed", "turn/failed", "turn/cancelled"):
            if owner_id is not None and validation_session is None:
                user_manager.get(owner_id).clear_turn()

        if validation_session is not None and owner_id is not None:
            if method == "item/agentMessage/delta":
                text = _extract_text(params)
                if text:
                    validation_session.append_text(text)
            if method == "turn/started":
                pass
            if method == "turn/completed":
                await _publish_turn_event(
                    owner_id,
                    "turn_completed",
                    thread_id or validation_session.thread_id,
                    turn_id,
                    "",
                    params or {},
                )
                if validation_session.current_turn_id and turn_id and validation_session.current_turn_id != turn_id:
                    return
                validation_thread_id = thread_id or validation_session.thread_id
                validation_turn_id = turn_id
                logger.info(
                    "Scheduling reviewer validation thread_id=%s turn_id=%s attempt=%s/%s",
                    validation_thread_id,
                    validation_turn_id,
                    validation_session.attempt_count,
                    validation_session.max_attempts,
                )
                _track_validation_task(
                    asyncio.create_task(
                        _handle_validation_completion(owner_id, validation_thread_id, validation_turn_id),
                        name=f"reviewer-validation:{validation_thread_id}:{validation_turn_id or 'unknown'}",
                    ),
                    f"reviewer-validation:{validation_thread_id}:{validation_turn_id or 'unknown'}",
                )
                return
            if method in ("turn/failed", "turn/cancelled"):
                await _publish_turn_event(
                    owner_id,
                    "turn_failed",
                    thread_id or validation_session.thread_id,
                    turn_id,
                    f"Turn {method.split('/')[-1]}.",
                    params or {},
                )
                state_user.clear_turn()
                state_user.clear_validation_session()
                await _send_telegram_message(
                    owner_id,
                    f"Turn {method.split('/')[-1]}.",
                    thread_id or validation_session.thread_id,
                )
                return

        if user_id_by_thread is not None:
            event_type = "app_event"
            if method == "item/agentMessage/delta":
                event_type = "turn_delta"
            elif method == "turn/started":
                event_type = "turn_started"
            elif method == "turn/completed":
                event_type = "turn_completed"
            elif method == "turn/failed":
                event_type = "turn_failed"
            await event_hub.publish_event(
                user_id_by_thread,
                {
                    "type": event_type,
                    "method": method,
                    "thread_id": thread_id,
                    "turn_id": turn_id,
                    "text": _extract_text(params) or "",
                    "variant": _extract_message_variant(params),
                    "params": params or {},
                },
            )

        if _method_matches(method, denylist):
            return
        if allowlist and not _method_matches(method, allowlist):
            return
        if _event_level(method, params) < forward_threshold:
            return
        user_id = user_id_by_thread
        if user_id is None:
            return
        if user_id <= 0 or app is None:
            return

        msg = _format_event(method, params)
        if msg is None:
            return
        if not msg.strip():
            return
        footer = f"\n\nthreadId: {thread_id or 'unknown'}"
        max_body_len = 3900 - len(footer)
        if max_body_len < 1:
            max_body_len = 1
        if len(msg) > max_body_len:
            trunc_suffix = "\n...(truncated)"
            head_len = max_body_len - len(trunc_suffix)
            if head_len < 1:
                head_len = 1
                trunc_suffix = ""
            msg = msg[:head_len] + trunc_suffix
        msg = msg + footer

        logger.info(
            "Forwarding app-server event to Telegram user_id=%s method=%s message=%s",
            user_id,
            method,
            msg,
        )
        if user_id > 0 and app is not None:
            try:
                await app.bot.send_message(chat_id=user_id, text=msg)
            except Exception:
                logger.exception("Failed to forward app-server event to Telegram")

    async def forward_approval_request(payload: dict[str, Any]):
        if state.codex_client is None:
            return
        req_id = payload.get("id")
        if not isinstance(req_id, int):
            return
        method = str(payload.get("method") or "")
        thread_id = payload.get("threadId")
        user_id = user_manager.find_user_id_by_thread(thread_id if isinstance(thread_id, str) else None)
        if user_id is None:
            logger.warning(
                "Approval request without user mapping method=%s id=%s threadId=%s",
                method,
                req_id,
                thread_id,
            )
            return

        params = payload.get("params")
        reason = ""
        question_text = ""
        if isinstance(params, dict):
            raw_reason = params.get("reason")
            if isinstance(raw_reason, str) and raw_reason.strip():
                reason = raw_reason.strip()
            questions = params.get("questions")
            if isinstance(questions, list) and questions:
                first = questions[0]
                if isinstance(first, dict):
                    raw_question = first.get("question")
                    if isinstance(raw_question, str) and raw_question.strip():
                        question_text = raw_question.strip()

        guardian_settings = get_guardian_settings()
        guardian_enabled = bool(guardian_settings.get("enabled", False))
        guardian_methods = guardian_settings.get("apply_to_methods", ["*"])
        guardian_patterns = guardian_methods if isinstance(guardian_methods, list) else ["*"]
        guardian_failure_policy = str(guardian_settings.get("failure_policy", "manual_fallback")).strip().lower()
        guardian_explainability = str(guardian_settings.get("explainability", "full_chain")).strip().lower()
        guardian_timeout_seconds = int(guardian_settings.get("timeout_seconds", 20))

        def _guardian_message(decision: GuardianDecision) -> str:
            lines = [
                "Guardian auto decision sent.",
                f"Method: {method}",
                f"Request ID: {req_id}",
                f"Decision: {decision.choice}",
            ]
            if guardian_explainability in ("summary", "full_chain"):
                lines.append(f"Risk: {decision.risk_level}")
                lines.append(f"Confidence: {decision.confidence}")
                if decision.summary:
                    lines.append(f"Summary: {decision.summary}")
            return "\n".join(lines)

        guardian_request_message = (
            "Guardian request\n"
            f"Method: {method}\n"
            f"Request ID: {req_id}\n"
            f"Reason: {reason or '(none)'}\n"
            f"Question: {question_text or '(none)'}"
        )

        if guardian_enabled and _method_matches(method, [p for p in guardian_patterns if isinstance(p, str)]):
            if state.approval_guardian is None:
                state.approval_guardian = ApprovalGuardianService()
            guardian_decision: GuardianDecision | None = None
            guardian_error = ""
            logger.debug(
                "Guardian request thread_id=%s request_id=%s method=%s details=%s",
                thread_id,
                req_id,
                method,
                guardian_request_message,
            )
            await _publish_system_message(user_id, thread_id if isinstance(thread_id, str) else None, None, guardian_request_message)
            try:
                guardian_decision = await state.approval_guardian.review(
                    payload,
                    timeout_seconds=max(1, guardian_timeout_seconds),
                )
            except asyncio.TimeoutError:
                guardian_error = f"Guardian timeout after {guardian_timeout_seconds}s"
            except Exception as exc:
                guardian_error = f"Guardian failed: {exc}"

            if guardian_decision is not None:
                logger.debug(
                    "Guardian result thread_id=%s request_id=%s method=%s decision=%s risk=%s confidence=%s summary=%s",
                    thread_id,
                    req_id,
                    method,
                    guardian_decision.choice,
                    guardian_decision.risk_level,
                    guardian_decision.confidence,
                    guardian_decision.summary,
                )
                await _publish_system_message(
                    user_id,
                    thread_id if isinstance(thread_id, str) else None,
                    None,
                    _guardian_message(guardian_decision),
                )
                if guardian_decision.choice in ("approve", "session"):
                    accepted = state.codex_client.submit_approval_decision(req_id, guardian_decision.choice)
                    if accepted:
                        if user_id > 0 and app is not None:
                            await app.bot.send_message(chat_id=user_id, text=_guardian_message(guardian_decision))
                        return
                    logger.warning(
                        "Guardian produced decision but request already expired method=%s id=%s",
                        method,
                        req_id,
                    )
                else:
                    logger.debug(
                        "Guardian returned deny; falling back to manual approval method=%s id=%s",
                        method,
                        req_id,
                    )
                    if user_id > 0 and app is not None:
                        await app.bot.send_message(
                            chat_id=user_id,
                            text=(
                                "Guardian recommended deny.\n"
                                f"Method: {method}\n"
                                f"Request ID: {req_id}\n"
                                "Manual approval is required."
                            ),
                        )
            else:
                logger.warning("Guardian could not decide method=%s id=%s error=%s", method, req_id, guardian_error)
                await _publish_system_message(
                    user_id,
                    thread_id if isinstance(thread_id, str) else None,
                    None,
                    "Guardian unavailable.\n"
                    f"Method: {method}\n"
                    f"Request ID: {req_id}\n"
                    f"Reason: {guardian_error or 'unknown'}",
                )
                if guardian_failure_policy in ("approve", "session", "deny"):
                    accepted = state.codex_client.submit_approval_decision(req_id, guardian_failure_policy)
                    if accepted:
                        if user_id > 0 and app is not None:
                            await app.bot.send_message(
                                chat_id=user_id,
                                text=(
                                    "Guardian fallback decision sent.\n"
                                    f"Method: {method}\n"
                                    f"Request ID: {req_id}\n"
                                    f"Decision: {guardian_failure_policy}\n"
                                    f"Reason: {guardian_error or 'fallback policy'}"
                                ),
                            )
                        return

                if user_id > 0 and app is not None:
                    await app.bot.send_message(
                        chat_id=user_id,
                        text=(
                            "Guardian review did not complete.\n"
                            f"Method: {method}\n"
                            f"Request ID: {req_id}\n"
                            f"Reason: {guardian_error or 'unknown'}\n"
                            "Falling back to manual approval."
                        ),
                    )

        reason_line = f"\nReason: {reason}" if reason else ""
        question_line = f"\nQuestion: {question_text}" if question_text else ""
        message = (
            "Approval required.\n"
            f"Method: {method}\n"
            f"Request ID: {req_id}{reason_line}{question_line}\n"
            "Choose: Approve / Session / Deny"
        )
        channel = "telegram" if user_id > 0 else "web"
        logger.info(
            "Dispatching approval request channel=%s user_id=%s method=%s request_id=%s",
            channel,
            user_id,
            method,
            req_id,
        )
        approval_payload = {
            "id": req_id,
            "type": "approval_required",
            "method": method,
            "thread_id": thread_id if isinstance(thread_id, str) else None,
            "reason": reason,
            "question": question_text,
        }
        await event_hub.add_approval(user_id, req_id, approval_payload)
        await event_hub.publish_event(user_id, approval_payload)
        if user_id > 0 and app is not None:
            await app.bot.send_message(
                chat_id=user_id,
                text=message,
                reply_markup=approval_keyboard(req_id),
            )

    state.codex_client.on_any(forward_event)
    state.codex_client.on_approval_request(forward_approval_request)
    
    state.codex_ready.set()
    logger.info("Codex initialized")


async def post_shutdown(app: Application | None):
    await _cancel_validation_tasks()
    if state.codex_client:
        await state.codex_client.stop()
        state.codex_client = None
    if state.approval_guardian:
        await state.approval_guardian.stop()
        state.approval_guardian = None
    if state.result_verifier:
        await state.result_verifier.stop()
        state.result_verifier = None
    state.command_router = None
    state.codex_ready.clear()


async def debug_update_handler(update: object, context: Any):
    if not isinstance(update, Update):
        return
    logger.debug(
        "Telegram update received update_id=%s has_message=%s has_callback_query=%s",
        update.update_id,
        update.message is not None,
        update.callback_query is not None,
    )


def _parse_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        raw = value.strip().lower()
        if raw in ("1", "true", "yes", "on"):
            return True
        if raw in ("0", "false", "no", "off"):
            return False
    return default


async def _run_without_telegram() -> None:
    await post_init(None)
    logger.info("Telegram channel disabled. Running codex runtime for Web only.")
    try:
        while True:
            await asyncio.sleep(3600)
    finally:
        await post_shutdown(None)


def main():
    global _web_server
    global _web_server_thread
    logger.info("Starting Codex Telegram Bot...")
    logger.info("Using config file %s", get_config_path())

    web_enabled = _parse_bool(get("web.enabled", False), default=False)
    telegram_enabled = _parse_bool(get("telegram.enabled", True), default=True)
    web_host = str(get("web.host", "127.0.0.1")).strip() or "127.0.0.1"
    web_port_raw = get("web.port", 8080)
    try:
        web_port = int(web_port_raw)
    except Exception:
        web_port = 8080
    web_endpoint = f"http://{web_host}:{web_port}"
    logger.info("Web endpoint configured: %s (enabled=%s)", web_endpoint, web_enabled)
    logger.info("Telegram channel enabled=%s", telegram_enabled)
    if web_enabled:
        _web_server = WebServerThread(web_host, web_port)
        _web_server_thread = threading.Thread(target=_web_server.run, daemon=True, name="codex-web-server")
        _web_server_thread.start()
        logger.info("Web UI started at %s", web_endpoint)

    if not telegram_enabled:
        try:
            asyncio.run(_run_without_telegram())
        finally:
            if _web_server is not None:
                _web_server.stop()
            if _web_server_thread is not None:
                _web_server_thread.join(timeout=3)
        return

    bot_token = get_telegram_bot("token")
    drop_pending_raw = get_telegram_bot("drop_pending_updates", True)
    if isinstance(drop_pending_raw, bool):
        drop_pending_updates = drop_pending_raw
    elif isinstance(drop_pending_raw, str):
        drop_pending_updates = drop_pending_raw.strip().lower() in ("1", "true", "yes", "on")
    else:
        drop_pending_updates = True

    if not bot_token or bot_token == "YOUR_TELEGRAM_BOT_TOKEN":
        logger.error("Please set telegram.bot.token in conf.toml")
        return

    lock = SingleInstanceLock(f"codex-telegram-{token_lock_key(bot_token)}")
    if not lock.acquire():
        owner_pid = lock.read_owner_pid()
        candidates = find_local_conflict_candidates(bot_token, exclude_pid=os.getpid())
        action_raw = str(get_telegram_bot("conflict_action", "prompt")).strip().lower()
        logger.error(
            "Another bot instance may be running for the same token (pid=%s).",
            owner_pid if owner_pid is not None else "unknown",
        )
        if candidates:
            logger.error("Local conflict candidates: %s", ", ".join(str(pid) for pid, _ in candidates))
        action = action_raw
        if action == "prompt":
            if sys.stdin.isatty():
                choice = input(
                    "Conflict detected. Choose action: [k]ill existing process and continue / [e]xit: "
                ).strip().lower()
                action = "kill" if choice.startswith("k") else "exit"
            else:
                action = "exit"
                logger.error("Conflict action is prompt, but no TTY is attached. Falling back to exit.")
        if action == "kill":
            terminated_any = False
            if owner_pid is not None and lock.terminate_owner():
                terminated_any = True
            target_pids = [pid for pid, _ in candidates if pid != owner_pid and pid != os.getpid()]
            for pid in target_pids:
                if terminate_pid(pid):
                    terminated_any = True
                    logger.info("Terminated local conflict candidate pid=%s.", pid)
            if not terminated_any:
                logger.error("No local process could be terminated for conflict resolution.")
                return
            if not lock.acquire():
                logger.error("Existing process was terminated but lock is still unavailable.")
                return
            logger.info("Conflict resolved and lock acquired.")
        else:
            logger.info("Exiting due to polling conflict.")
            return
    
    app = (
        Application.builder()
        .token(bot_token)
        .post_init(post_init)
        .post_shutdown(post_shutdown)
        .concurrent_updates(True)
        .build()
    )

    app.add_handler(TypeHandler(Update, debug_update_handler), group=-1)
    app.add_handler(CommandHandler("start", start_handler))
    app.add_handler(CommandHandler("help", start_handler))
    app.add_handler(CommandHandler(["commands", "start", "projects", "project", "resume", "threads", "read", "archive", "unarchive", "compact", "rollback", "interrupt", "review", "exec", "models", "features", "gurdian", "guardian", "reviewer", "verifier", "modes", "skills", "apps", "mcp", "config"], command_handler))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, message_handler))
    app.add_handler(CallbackQueryHandler(callback_handler))
    app.add_error_handler(error_handler)
    
    try:
        app.run_polling(
            stop_signals=None,
            allowed_updates=Update.ALL_TYPES,
            drop_pending_updates=drop_pending_updates,
        )
    finally:
        if _web_server is not None:
            _web_server.stop()
        if _web_server_thread is not None:
            _web_server_thread.join(timeout=3)
        lock.release()


if __name__ == "__main__":
    main()
