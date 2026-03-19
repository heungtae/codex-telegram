import asyncio
import json
import logging
import os
import re
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

from utils.approval_policy import build_approval_policy_context, match_approval_policy
from utils.config import get, get_config_path, get_guardian_settings, get_telegram_bot
from utils.logger import setup
from utils.single_instance import (
    SingleInstanceLock,
    find_local_conflict_candidates,
    terminate_pid,
    token_lock_key,
)
from codex import CodexClient, CommandRouter
from codex.approval_guardian import ApprovalGuardianService, GuardianDecision
from bot import (
    start_handler,
    message_handler,
    command_handler,
    error_handler,
    callback_handler,
)
from bot.keyboard import approval_keyboard, main_menu_keyboard
from codex_telegram import __version__
from models import state
from models.user import user_manager
from web import create_web_app
from web.runtime import event_hub
logger = setup("codex-telegram")
_web_server = None
_web_server_thread = None
FILE_CHANGE_LINE_DELAY_SECONDS = 0.35


def _normalize_mode_kind(raw: object) -> str | None:
    if not isinstance(raw, str):
        return None
    normalized = raw.strip().lower()
    if normalized == "plan":
        return "plan"
    if normalized == "default":
        return "build"
    return None


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
        "version": __version__,
    })
    return client


async def post_init(app: Application | None):
    state.codex_client = await setup_codex()
    state.command_router = CommandRouter(state.codex_client)
    state.approval_guardian = ApprovalGuardianService()
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

    def _coerce_int(value: Any) -> int:
        if isinstance(value, bool):
            return 0
        if isinstance(value, int):
            return value
        if isinstance(value, float):
            return int(value)
        if isinstance(value, str):
            raw = value.strip()
            if raw.isdigit():
                return int(raw)
        return 0

    def _clean_file_path(path: Any) -> str:
        if not isinstance(path, str):
            return ""
        normalized = path.strip()
        if normalized.startswith("a/") or normalized.startswith("b/"):
            return normalized[2:]
        if normalized == "/dev/null":
            return ""
        return normalized

    def _extract_preview(value: Any) -> str:
        if not isinstance(value, str):
            return ""
        lines = [line.rstrip() for line in value.splitlines() if line.strip()]
        if not lines:
            return ""
        return "\n".join(lines[:6])[:800]

    def _entry_from_mapping(item: dict[str, Any]) -> dict[str, Any] | None:
        path = ""
        for key in ("path", "file", "filepath", "filePath", "newPath", "oldPath", "target", "source"):
            path = _clean_file_path(item.get(key))
            if path:
                break
        if not path:
            nested = item.get("file")
            if isinstance(nested, dict):
                for key in ("path", "filePath", "newPath", "oldPath"):
                    path = _clean_file_path(nested.get(key))
                    if path:
                        break
        if not path:
            return None
        change_type = str(
            item.get("change_type")
            or item.get("changeType")
            or item.get("status")
            or item.get("type")
            or "M"
        ).strip().upper()[:1] or "M"
        preview = _extract_preview(
            item.get("preview")
            or item.get("patch")
            or item.get("diff")
            or item.get("content")
        )
        return {
            "path": path,
            "change_type": change_type if change_type in {"A", "M", "D", "R"} else "M",
            "additions": _coerce_int(item.get("additions") or item.get("added")),
            "deletions": _coerce_int(item.get("deletions") or item.get("removed")),
            "preview": preview,
        }

    def _parse_unified_diff(diff_text: str) -> list[dict[str, Any]]:
        entries: list[dict[str, Any]] = []
        current: dict[str, Any] | None = None
        for raw_line in diff_text.splitlines():
            line = raw_line.rstrip("\n")
            if line.startswith("diff --git "):
                if current and current.get("path"):
                    entries.append(current)
                match = re.match(r"diff --git a/(.+?) b/(.+)$", line)
                path = ""
                if match:
                    path = _clean_file_path(match.group(2) or match.group(1))
                current = {
                    "path": path,
                    "change_type": "M",
                    "additions": 0,
                    "deletions": 0,
                    "preview": "",
                }
                continue
            if current is None:
                continue
            if line.startswith("new file mode "):
                current["change_type"] = "A"
                continue
            if line.startswith("deleted file mode "):
                current["change_type"] = "D"
                continue
            if line.startswith("rename to "):
                renamed = _clean_file_path(line[len("rename to "):])
                if renamed:
                    current["path"] = renamed
                    current["change_type"] = "R"
                continue
            if line.startswith("+++ "):
                new_path = _clean_file_path(line[4:])
                if new_path:
                    current["path"] = new_path
                continue
            if line.startswith("--- ") or line.startswith("@@"):
                if not current.get("preview") and line.startswith("@@"):
                    current["preview"] = line[:800]
                continue
            if line.startswith("+") and not line.startswith("+++"):
                current["additions"] = int(current.get("additions", 0)) + 1
                continue
            if line.startswith("-") and not line.startswith("---"):
                current["deletions"] = int(current.get("deletions", 0)) + 1
                continue
        if current and current.get("path"):
            entries.append(current)
        return entries

    def _extract_file_change_summary(method: str, params: dict | None) -> dict[str, Any] | None:
        p = params or {}
        if method != "turn/diff/updated":
            return None

        files: list[dict[str, Any]] = []
        for key in ("files", "changes"):
            value = p.get(key)
            if not isinstance(value, list):
                continue
            for item in value:
                if not isinstance(item, dict):
                    continue
                entry = _entry_from_mapping(item)
                if entry is not None:
                    files.append(entry)

        diff_text = ""
        for key in ("diff", "patch"):
            value = p.get(key)
            if isinstance(value, str) and value.strip():
                diff_text = value
                break
        if diff_text:
            existing_paths = {str(item.get("path")) for item in files}
            for entry in _parse_unified_diff(diff_text):
                if entry["path"] in existing_paths:
                    continue
                files.append(entry)

        deduped: list[dict[str, Any]] = []
        seen_paths: set[str] = set()
        for item in files:
            path = str(item.get("path") or "")
            if not path or path in seen_paths:
                continue
            seen_paths.add(path)
            deduped.append(item)

        if not deduped and not diff_text:
            return None

        if deduped:
            lines = ["Applied patch changes"]
            for entry in deduped[:8]:
                lines.append(
                    f"{entry['change_type']} {entry['path']} (+{entry['additions']} -{entry['deletions']})"
                )
            if len(deduped) > 8:
                lines.append(f"... ({len(deduped) - 8} more files)")
            summary = "\n".join(lines)
        else:
            summary = "Applied patch changes"

        return {
            "thread_id": _extract_thread_id(method, p),
            "turn_id": _extract_turn_id(method, p),
            "source": "apply_patch",
            "summary": summary,
            "files": deduped,
            "diff": diff_text,
            "raw_params": p,
        }

    def _extract_plan_item_payload(method: str, params: dict | None) -> dict[str, Any] | None:
        p = params or {}
        if method == "item/plan/delta":
            item_id = p.get("itemId")
            delta = p.get("delta")
            if isinstance(item_id, str) and item_id and isinstance(delta, str) and delta:
                return {
                    "thread_id": _extract_thread_id(method, p),
                    "turn_id": _extract_turn_id(method, p),
                    "item_id": item_id,
                    "text": delta,
                    "is_final": False,
                }
            return None
        if method != "item/completed":
            return None
        item = p.get("item")
        if not isinstance(item, dict):
            return None
        item_type = str(item.get("type") or "").strip().lower()
        if item_type != "plan":
            return None
        item_id = item.get("id")
        text = item.get("text")
        if not isinstance(item_id, str) or not item_id or not isinstance(text, str):
            return None
        return {
            "thread_id": _extract_thread_id(method, p),
            "turn_id": _extract_turn_id(method, p),
            "item_id": item_id,
            "text": text,
            "is_final": True,
        }

    def _extract_plan_checklist_payload(method: str, params: dict | None) -> dict[str, Any] | None:
        p = params or {}
        if method != "turn/plan/updated":
            return None
        raw_plan = p.get("plan")
        steps: list[dict[str, str]] = []
        if isinstance(raw_plan, list):
            for item in raw_plan:
                if not isinstance(item, dict):
                    continue
                step = str(item.get("step") or "").strip()
                status = str(item.get("status") or "").strip()
                if not step or not status:
                    continue
                steps.append({"step": step, "status": status})
        return {
            "thread_id": _extract_thread_id(method, p),
            "turn_id": _extract_turn_id(method, p),
            "explanation": str(p.get("explanation") or "").strip(),
            "plan": steps,
        }

    def _extract_string_list(value: Any) -> list[str]:
        items: list[str] = []
        if not isinstance(value, list):
            return items
        for entry in value:
            if isinstance(entry, str) and entry:
                items.append(entry)
            elif isinstance(entry, dict):
                text = entry.get("text")
                if isinstance(text, str) and text:
                    items.append(text)
        return items

    def _normalize_item_type(value: Any) -> str:
        if not isinstance(value, str):
            return ""
        return value.strip().lower()

    def _extract_reasoning_payload(method: str, params: dict | None) -> dict[str, Any] | None:
        p = params or {}
        if method == "item/reasoning/summaryTextDelta":
            delta = p.get("delta")
            if isinstance(delta, str) and delta:
                return {
                    "type": "reasoning_status",
                    "thread_id": _extract_thread_id(method, p),
                    "turn_id": _extract_turn_id(method, p),
                    "item_id": str(p.get("itemId") or ""),
                    "delta": delta,
                    "summary_index": p.get("summaryIndex", 0),
                }
            return None
        if method == "item/reasoning/summaryPartAdded":
            return {
                "type": "reasoning_status",
                "thread_id": _extract_thread_id(method, p),
                "turn_id": _extract_turn_id(method, p),
                "item_id": str(p.get("itemId") or ""),
                "delta": "",
                "summary_index": p.get("summaryIndex", 0),
                "section_break": True,
            }
        if method == "item/reasoning/textDelta":
            delta = p.get("delta")
            if isinstance(delta, str) and delta:
                return {
                    "type": "reasoning_status",
                    "thread_id": _extract_thread_id(method, p),
                    "turn_id": _extract_turn_id(method, p),
                    "item_id": str(p.get("itemId") or ""),
                    "delta": delta,
                    "content_index": p.get("contentIndex", 0),
                    "raw": True,
                }
            return None
        if method != "item/completed":
            return None
        item = p.get("item")
        if not isinstance(item, dict) or _normalize_item_type(item.get("type")) != "reasoning":
            return None
        return {
            "type": "reasoning_completed",
            "thread_id": _extract_thread_id(method, p),
            "turn_id": _extract_turn_id(method, p),
            "item_id": str(item.get("id") or ""),
            "summary_text": _extract_string_list(item.get("summary_text") or item.get("summaryText")),
            "raw_content": _extract_string_list(item.get("raw_content") or item.get("rawContent")),
        }

    def _extract_web_search_payload(method: str, params: dict | None) -> dict[str, Any] | None:
        if method != "item/completed":
            return None
        p = params or {}
        item = p.get("item")
        if not isinstance(item, dict) or _normalize_item_type(item.get("type")) != "web_search":
            return None
        return {
            "type": "web_search_item",
            "thread_id": _extract_thread_id(method, p),
            "turn_id": _extract_turn_id(method, p),
            "item_id": str(item.get("id") or ""),
            "query": str(item.get("query") or ""),
            "action": item.get("action"),
        }

    def _extract_image_generation_payload(method: str, params: dict | None) -> dict[str, Any] | None:
        if method != "item/completed":
            return None
        p = params or {}
        item = p.get("item")
        if not isinstance(item, dict) or _normalize_item_type(item.get("type")) != "image_generation":
            return None
        return {
            "type": "image_generation_item",
            "thread_id": _extract_thread_id(method, p),
            "turn_id": _extract_turn_id(method, p),
            "item_id": str(item.get("id") or ""),
            "status": str(item.get("status") or ""),
            "result": str(item.get("result") or ""),
            "revised_prompt": str(item.get("revised_prompt") or item.get("revisedPrompt") or ""),
            "saved_path": str(item.get("saved_path") or item.get("savedPath") or ""),
        }

    def _extract_context_compaction_payload(method: str, params: dict | None) -> dict[str, Any] | None:
        p = params or {}
        if method == "thread/compacted":
            return {
                "type": "context_compacted_item",
                "thread_id": _extract_thread_id(method, p),
                "turn_id": _extract_turn_id(method, p),
                "text": "Context compacted",
            }
        if method != "item/completed":
            return None
        item = p.get("item")
        if not isinstance(item, dict) or _normalize_item_type(item.get("type")) != "context_compaction":
            return None
        return {
            "type": "context_compacted_item",
            "thread_id": _extract_thread_id(method, p),
            "turn_id": _extract_turn_id(method, p),
            "text": "Context compacted",
        }

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
        if method == "item/plan/delta":
            return None
        if method == "turn/plan/updated":
            return None
        if method == "item/completed":
            item = p.get("item")
            if isinstance(item, dict) and str(item.get("type") or "").strip().lower() == "plan":
                return None
        if method == "turn/started":
            turn_id = (p.get("turn") or {}).get("id") if isinstance(p.get("turn"), dict) else p.get("turnId")
            actual_mode = _normalize_mode_kind(p.get("collaboration_mode_kind") or p.get("collaborationModeKind"))
            if actual_mode:
                return f"[app-server] Turn started: {turn_id or 'unknown'} (mode: {actual_mode.upper()})"
            return f"[app-server] Turn started: {turn_id or 'unknown'}"
        if method == "turn/completed":
            turn_id = (p.get("turn") or {}).get("id") if isinstance(p.get("turn"), dict) else p.get("turnId")
            actual_mode = _normalize_mode_kind(p.get("collaboration_mode_kind") or p.get("collaborationModeKind"))
            if actual_mode:
                return f"[app-server] Turn completed: {turn_id or 'unknown'} (mode: {actual_mode.upper()})"
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
        if method == "item/plan/delta":
            return 0
        if method == "turn/plan/updated":
            return 0
        if method == "item/completed":
            item = p.get("item")
            if isinstance(item, dict) and str(item.get("type") or "").strip().lower() == "plan":
                return 0
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

    async def _send_telegram_file_change(user_id: int, payload: dict[str, Any]) -> None:
        if user_id <= 0 or app is None:
            return
        thread_id = payload.get("thread_id")
        summary = str(payload.get("summary") or "").strip()
        if not summary:
            return
        lines = [line.strip() for line in summary.splitlines() if line.strip()]
        if not lines:
            return
        try:
            last_index = len(lines) - 1
            for index, line in enumerate(lines):
                footer = f"\n\nthreadId: {thread_id or 'unknown'}" if index == last_index else ""
                max_body_len = 3900 - len(footer)
                body = line
                if len(body) > max_body_len:
                    body = body[: max(1, max_body_len - len("\n...(truncated)"))] + "\n...(truncated)"
                await app.bot.send_message(chat_id=user_id, text=body + footer)
                if index < last_index:
                    await asyncio.sleep(FILE_CHANGE_LINE_DELAY_SECONDS)
        except Exception:
            logger.exception("Failed to forward file change to Telegram user_id=%s", user_id)

    async def _send_telegram_plan(user_id: int, payload: dict[str, Any]) -> None:
        if user_id <= 0 or app is None:
            return
        plan_text = str(payload.get("text") or "").strip()
        if not plan_text:
            return
        summary = f"Plan proposal\n\n{plan_text}"
        await _send_telegram_message(user_id, summary, payload.get("thread_id"))

    async def forward_event(method: str, params: dict | None):
        thread_id = _extract_thread_id(method, params)
        turn_id = _extract_turn_id(method, params)
        user_id_by_thread = user_manager.find_user_id_by_thread(thread_id)
        owner_id = user_manager.find_user_id_by_turn(turn_id)
        target_user_id = owner_id if owner_id is not None else user_id_by_thread
        if owner_id is None:
            owner_id = user_id_by_thread

        # Keep runtime turn state in sync even when event forwarding is filtered out.
        if method == "turn/started" and turn_id and owner_id is not None:
            state_user = user_manager.get(owner_id)
            state_user.set_turn(turn_id)
            actual_mode = _normalize_mode_kind((params or {}).get("collaboration_mode_kind") or (params or {}).get("collaborationModeKind"))
            if actual_mode is not None:
                state_user.set_collaboration_mode(actual_mode)
                logger.info(
                    "Codex turn started user_id=%s thread_id=%s turn_id=%s actual_mode=%s raw_params=%s",
                    owner_id,
                    thread_id,
                    turn_id,
                    actual_mode,
                    params,
                )
        elif method in ("turn/completed", "turn/failed", "turn/cancelled"):
            if owner_id is not None:
                user_manager.get(owner_id).clear_turn()

        file_change = _extract_file_change_summary(method, params)
        if file_change is not None:
            target_user_id = owner_id if owner_id is not None else user_id_by_thread
            if target_user_id is not None:
                await event_hub.publish_event(
                    target_user_id,
                    {
                        "type": "file_change",
                        "thread_id": file_change.get("thread_id"),
                        "turn_id": file_change.get("turn_id"),
                        "source": file_change.get("source"),
                        "summary": file_change.get("summary"),
                        "files": file_change.get("files"),
                        "diff": file_change.get("diff"),
                    },
                )
                if str(file_change.get("source") or "").strip().lower() != "apply_patch":
                    await _send_telegram_file_change(target_user_id, file_change)
            return

        plan_item = _extract_plan_item_payload(method, params)
        if plan_item is not None:
            target_user_id = owner_id if owner_id is not None else user_id_by_thread
            if target_user_id is not None:
                await event_hub.publish_event(
                    target_user_id,
                    {
                        "type": "plan_completed" if plan_item["is_final"] else "plan_delta",
                        "thread_id": plan_item.get("thread_id"),
                        "turn_id": plan_item.get("turn_id"),
                        "item_id": plan_item.get("item_id"),
                        "text": plan_item.get("text") or "",
                    },
                )
                if plan_item["is_final"]:
                    await _send_telegram_plan(target_user_id, plan_item)
            return

        plan_checklist = _extract_plan_checklist_payload(method, params)
        if plan_checklist is not None:
            target_user_id = owner_id if owner_id is not None else user_id_by_thread
            if target_user_id is not None:
                await event_hub.publish_event(
                    target_user_id,
                    {
                        "type": "plan_checklist",
                        "thread_id": plan_checklist.get("thread_id"),
                        "turn_id": plan_checklist.get("turn_id"),
                        "explanation": plan_checklist.get("explanation") or "",
                        "plan": plan_checklist.get("plan") or [],
                    },
                )
            return

        reasoning_payload = _extract_reasoning_payload(method, params)
        if reasoning_payload is not None:
            target_user_id = owner_id if owner_id is not None else user_id_by_thread
            if target_user_id is not None:
                await event_hub.publish_event(target_user_id, reasoning_payload)
            return

        web_search_payload = _extract_web_search_payload(method, params)
        if web_search_payload is not None:
            target_user_id = owner_id if owner_id is not None else user_id_by_thread
            if target_user_id is not None:
                await event_hub.publish_event(target_user_id, web_search_payload)
            return

        image_generation_payload = _extract_image_generation_payload(method, params)
        if image_generation_payload is not None:
            target_user_id = owner_id if owner_id is not None else user_id_by_thread
            if target_user_id is not None:
                await event_hub.publish_event(target_user_id, image_generation_payload)
            return

        context_compaction_payload = _extract_context_compaction_payload(method, params)
        if context_compaction_payload is not None:
            target_user_id = owner_id if owner_id is not None else user_id_by_thread
            if target_user_id is not None:
                await event_hub.publish_event(target_user_id, context_compaction_payload)
            return

        if target_user_id is not None:
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
                target_user_id,
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
            if method == "turn/completed":
                actual_mode = _normalize_mode_kind((params or {}).get("collaboration_mode_kind") or (params or {}).get("collaborationModeKind"))
                mode_suffix = f" Mode: {actual_mode.upper()}." if actual_mode else ""
                await _publish_system_message(
                    target_user_id,
                    thread_id,
                    turn_id,
                    f"Turn completed.{mode_suffix}",
                )

        if _method_matches(method, denylist):
            return
        if allowlist and not _method_matches(method, allowlist):
            return
        if _event_level(method, params) < forward_threshold:
            return
        user_id = target_user_id
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
                kwargs: dict[str, Any] = {}
                if method in ("turn/completed", "turn/failed", "turn/cancelled"):
                    kwargs["reply_markup"] = main_menu_keyboard(user_manager.get(user_id).collaboration_mode)
                await app.bot.send_message(chat_id=user_id, text=msg, **kwargs)
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

        workspace_path: str | None = None
        state_user = user_manager.get(user_id)
        if isinstance(state_user.selected_project_path, str) and state_user.selected_project_path:
            workspace_path = state_user.selected_project_path
        elif state.command_router is not None:
            effective = state.command_router.projects.resolve_effective_project(user_id)
            if isinstance(effective, dict):
                raw_workspace = effective.get("path")
                if isinstance(raw_workspace, str) and raw_workspace:
                    workspace_path = raw_workspace

        policy_context = await asyncio.to_thread(build_approval_policy_context, payload, workspace_path)
        reason = str(policy_context.get("reason") or "")
        question_text = str(policy_context.get("question") or "")

        guardian_settings = get_guardian_settings()
        guardian_enabled = bool(guardian_settings.get("enabled", False))
        guardian_methods = guardian_settings.get("apply_to_methods", ["*"])
        guardian_patterns = guardian_methods if isinstance(guardian_methods, list) else ["*"]
        guardian_failure_policy = str(guardian_settings.get("failure_policy", "manual_fallback")).strip().lower()
        guardian_explainability = str(guardian_settings.get("explainability", "decision_only")).strip().lower()
        guardian_timeout_seconds = int(guardian_settings.get("timeout_seconds", 20))
        guardian_rules = guardian_settings.get("rules", [])

        def _guardian_message(decision: GuardianDecision) -> str:
            lines = [
                "Guardian auto decision sent.",
                f"Method: {method}",
                f"Request ID: {req_id}",
                f"Decision: {decision.choice}",
            ]
            if guardian_explainability == "summary":
                lines.append(f"Risk: {decision.risk_level}")
                lines.append(f"Confidence: {decision.confidence}")
                if decision.summary:
                    lines.append(f"Summary: {decision.summary}")
            return "\n".join(lines)

        def _guardian_policy_message(rule_name: str, action: str) -> str:
            return "\n".join(
                [
                    "Guardian policy decision sent.",
                    f"Method: {method}",
                    f"Request ID: {req_id}",
                    f"Rule: {rule_name}",
                    f"Decision: {action}",
                ]
            )

        guardian_request_message = (
            "Guardian request\n"
            f"Method: {method}\n"
            f"Request ID: {req_id}\n"
            f"Reason: {reason or '(none)'}\n"
            f"Question: {question_text or '(none)'}"
        )

        skip_guardian_review = False
        matched_policy_rule = ""

        if guardian_enabled and _method_matches(method, [p for p in guardian_patterns if isinstance(p, str)]):
            policy_match = match_approval_policy(
                policy_context,
                guardian_rules if isinstance(guardian_rules, list) else [],
            )
            if policy_match is not None:
                matched_policy_rule = policy_match.rule_name
                logger.info(
                    "Guardian policy matched thread_id=%s request_id=%s method=%s rule=%s action=%s matched_fields=%s",
                    thread_id,
                    req_id,
                    method,
                    policy_match.rule_name,
                    policy_match.action,
                    ",".join(policy_match.matched_fields),
                )
                await _publish_system_message(
                    user_id,
                    thread_id if isinstance(thread_id, str) else None,
                    None,
                    _guardian_policy_message(policy_match.rule_name, policy_match.action),
                )
                if policy_match.action == "manual_fallback":
                    skip_guardian_review = True
                    if user_id > 0 and app is not None:
                        await app.bot.send_message(
                            chat_id=user_id,
                            text=(
                                _guardian_policy_message(policy_match.rule_name, policy_match.action)
                                + "\nManual approval is required."
                            ),
                        )
                else:
                    accepted = state.codex_client.submit_approval_decision(req_id, policy_match.action)
                    if accepted:
                        if user_id > 0 and app is not None:
                            await app.bot.send_message(
                                chat_id=user_id,
                                text=_guardian_policy_message(policy_match.rule_name, policy_match.action),
                            )
                        return
                    logger.warning(
                        "Guardian policy matched but request already expired method=%s id=%s rule=%s",
                        method,
                        req_id,
                        policy_match.rule_name,
                    )
                    return

            if not skip_guardian_review and state.approval_guardian is None:
                state.approval_guardian = ApprovalGuardianService()
            guardian_decision: GuardianDecision | None = None
            guardian_error = ""
            if not skip_guardian_review:
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

        policy_line = f"\nPolicy: {matched_policy_rule}" if matched_policy_rule else ""
        reason_line = f"\nReason: {reason}" if reason else ""
        question_line = f"\nQuestion: {question_text}" if question_text else ""
        message = (
            "Approval required.\n"
            f"Method: {method}{policy_line}\n"
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
            "policy_rule": matched_policy_rule or None,
        }
        previous_approvals = await event_hub.replace_approval(user_id, req_id, approval_payload)
        for previous in previous_approvals:
            previous_id = previous.get("id")
            if not isinstance(previous_id, int) or previous_id == req_id:
                continue
            closed = state.codex_client.submit_approval_decision(previous_id, "deny")
            logger.info(
                "Superseding approval request user_id=%s previous_request_id=%s new_request_id=%s closed=%s",
                user_id,
                previous_id,
                req_id,
                closed,
            )
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
    if state.codex_client:
        await state.codex_client.stop()
        state.codex_client = None
    if state.approval_guardian:
        await state.approval_guardian.stop()
        state.approval_guardian = None
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
    app.add_handler(CommandHandler(["commands", "start", "projects", "project", "resume", "threads", "read", "archive", "unarchive", "compact", "rollback", "interrupt", "review", "exec", "models", "features", "guardian", "modes", "collab", "mode", "plan", "build", "skills", "apps", "mcp", "config"], command_handler))
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
