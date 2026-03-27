import asyncio
import json
import logging
import re
from dataclasses import dataclass
from typing import Any

from bot.keyboard import main_menu_keyboard
from models import state
from models.user import user_manager
from web.runtime import event_hub

logger = logging.getLogger("codex-telegram")

FILE_CHANGE_LINE_DELAY_SECONDS = 0.35
TELEGRAM_MESSAGE_LIMIT = 3900


@dataclass(frozen=True)
class ForwardingConfig:
    threshold: int
    allowlist: list[str]
    denylist: list[str]
    rules: list[dict[str, Any]]


def normalize_mode_kind(raw: object) -> str | None:
    if not isinstance(raw, str):
        return None
    normalized = raw.strip().lower()
    if normalized == "plan":
        return "plan"
    if normalized == "default":
        return "build"
    return None


def build_forwarding_config(get_value) -> ForwardingConfig:
    configured_level = str(
        get_value(
            "telegram.forwarding.app_server_event_level",
            get_value("forwarding.app_server_event_level", "INFO"),
        )
    ).upper()
    configured_allowlist = get_value(
        "telegram.forwarding.app_server_event_allowlist",
        get_value("forwarding.app_server_event_allowlist", []),
    )
    configured_denylist = get_value(
        "telegram.forwarding.app_server_event_denylist",
        get_value("forwarding.app_server_event_denylist", []),
    )
    configured_rules = get_value(
        "telegram.forwarding.rules",
        get_value("forwarding.rules", []),
    )
    level_map = {
        "DEBUG": 10,
        "INFO": 20,
        "WARNING": 30,
        "ERROR": 40,
        "OFF": 100,
    }
    return ForwardingConfig(
        threshold=level_map.get(configured_level, 20),
        allowlist=configured_allowlist if isinstance(configured_allowlist, list) else [],
        denylist=configured_denylist if isinstance(configured_denylist, list) else [],
        rules=[item for item in configured_rules if isinstance(item, dict)] if isinstance(configured_rules, list) else [],
    )


def method_matches(method: str, patterns: list[str]) -> bool:
    for pattern in patterns:
        if not isinstance(pattern, str):
            continue
        if pattern.endswith("*"):
            if method.startswith(pattern[:-1]):
                return True
        elif method == pattern:
            return True
    return False


def extract_thread_id(method: str, params: dict | None) -> str | None:
    payload = params or {}
    if isinstance(payload.get("threadId"), str):
        return payload["threadId"]
    if isinstance(payload.get("conversationId"), str):
        return payload["conversationId"]
    thread = payload.get("thread")
    if isinstance(thread, dict) and isinstance(thread.get("id"), str):
        return thread["id"]
    if method.startswith("codex/event/"):
        conversation_id = payload.get("conversationId")
        if isinstance(conversation_id, str):
            return conversation_id
    return None


def extract_turn_id(method: str, params: dict | None) -> str | None:
    payload = params or {}
    turn = payload.get("turn")
    if isinstance(turn, dict) and isinstance(turn.get("id"), str):
        return turn.get("id")
    if isinstance(payload.get("turnId"), str):
        return payload.get("turnId")
    if method.startswith("turn/") and isinstance(payload.get("id"), str):
        return payload.get("id")
    return None


def extract_item_id(params: dict | None) -> str | None:
    payload = params or {}
    if isinstance(payload.get("itemId"), str) and payload.get("itemId"):
        return payload.get("itemId")
    item = payload.get("item")
    if isinstance(item, dict) and isinstance(item.get("id"), str) and item.get("id"):
        return item.get("id")
    return None


def extract_text(params: dict | None) -> str | None:
    payload = params or {}
    for key in ("delta", "text", "message"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value
    item = payload.get("item")
    if isinstance(item, dict):
        for key in ("text", "message"):
            value = item.get(key)
            if isinstance(value, str) and value.strip():
                return value
        content = item.get("content")
        if isinstance(content, list):
            for entry in content:
                if not isinstance(entry, dict):
                    continue
                value = entry.get("text")
                if isinstance(value, str) and value.strip():
                    return value
    msg = payload.get("msg")
    if isinstance(msg, dict):
        for key in ("message", "text"):
            value = msg.get(key)
            if isinstance(value, str) and value.strip():
                return value
    return None


def extract_message_variant(params: dict | None) -> str | None:
    payload = params or {}
    candidates: list[str] = []
    for key in ("role", "author", "speaker", "source", "name", "agentName", "agent"):
        value = payload.get(key)
        if isinstance(value, str):
            candidates.append(value)
    item = payload.get("item")
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


def coerce_int(value: Any) -> int:
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


def clean_file_path(path: Any) -> str:
    if not isinstance(path, str):
        return ""
    normalized = path.strip()
    if normalized.startswith("a/") or normalized.startswith("b/"):
        return normalized[2:]
    if normalized == "/dev/null":
        return ""
    return normalized


def extract_preview(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    lines = [line.rstrip() for line in value.splitlines() if line.strip()]
    if not lines:
        return ""
    return "\n".join(lines[:6])[:800]


def entry_from_mapping(item: dict[str, Any]) -> dict[str, Any] | None:
    path = ""
    for key in ("path", "file", "filepath", "filePath", "newPath", "oldPath", "target", "source"):
        path = clean_file_path(item.get(key))
        if path:
            break
    if not path:
        nested = item.get("file")
        if isinstance(nested, dict):
            for key in ("path", "filePath", "newPath", "oldPath"):
                path = clean_file_path(nested.get(key))
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
    preview = extract_preview(
        item.get("preview")
        or item.get("patch")
        or item.get("diff")
        or item.get("content")
    )
    return {
        "path": path,
        "change_type": change_type if change_type in {"A", "M", "D", "R"} else "M",
        "additions": coerce_int(item.get("additions") or item.get("added")),
        "deletions": coerce_int(item.get("deletions") or item.get("removed")),
        "preview": preview,
    }


def parse_unified_diff(diff_text: str) -> list[dict[str, Any]]:
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
                path = clean_file_path(match.group(2) or match.group(1))
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
            renamed = clean_file_path(line[len("rename to "):])
            if renamed:
                current["path"] = renamed
                current["change_type"] = "R"
            continue
        if line.startswith("+++ "):
            new_path = clean_file_path(line[4:])
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


def extract_file_change_summary(method: str, params: dict | None) -> dict[str, Any] | None:
    payload = params or {}
    if method != "turn/diff/updated":
        return None
    files: list[dict[str, Any]] = []
    for key in ("files", "changes"):
        value = payload.get(key)
        if not isinstance(value, list):
            continue
        for item in value:
            if not isinstance(item, dict):
                continue
            entry = entry_from_mapping(item)
            if entry is not None:
                files.append(entry)
    diff_text = ""
    for key in ("diff", "patch"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            diff_text = value
            break
    if diff_text:
        existing_paths = {str(item.get("path")) for item in files}
        for entry in parse_unified_diff(diff_text):
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
        "thread_id": extract_thread_id(method, payload),
        "turn_id": extract_turn_id(method, payload),
        "source": "apply_patch",
        "summary": summary,
        "files": deduped,
        "diff": diff_text,
    }


def extract_plan_item_payload(method: str, params: dict | None) -> dict[str, Any] | None:
    payload = params or {}
    if method == "item/plan/delta":
        item_id = payload.get("itemId")
        delta = payload.get("delta")
        if isinstance(item_id, str) and item_id and isinstance(delta, str) and delta:
            return {
                "thread_id": extract_thread_id(method, payload),
                "turn_id": extract_turn_id(method, payload),
                "item_id": item_id,
                "text": delta,
                "is_final": False,
            }
        return None
    if method != "item/completed":
        return None
    item = payload.get("item")
    if not isinstance(item, dict) or str(item.get("type") or "").strip().lower() != "plan":
        return None
    item_id = item.get("id")
    text = item.get("text")
    if not isinstance(item_id, str) or not item_id or not isinstance(text, str):
        return None
    return {
        "thread_id": extract_thread_id(method, payload),
        "turn_id": extract_turn_id(method, payload),
        "item_id": item_id,
        "text": text,
        "is_final": True,
    }


def extract_plan_checklist_payload(method: str, params: dict | None) -> dict[str, Any] | None:
    payload = params or {}
    if method != "turn/plan/updated":
        return None
    raw_plan = payload.get("plan")
    steps: list[dict[str, str]] = []
    if isinstance(raw_plan, list):
        for item in raw_plan:
            if not isinstance(item, dict):
                continue
            step = str(item.get("step") or "").strip()
            status = str(item.get("status") or "").strip()
            if step and status:
                steps.append({"step": step, "status": status})
    return {
        "thread_id": extract_thread_id(method, payload),
        "turn_id": extract_turn_id(method, payload),
        "explanation": str(payload.get("explanation") or "").strip(),
        "plan": steps,
    }


def extract_string_list(value: Any) -> list[str]:
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


def normalize_item_type(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    return value.strip().lower()


def extract_reasoning_payload(method: str, params: dict | None) -> dict[str, Any] | None:
    payload = params or {}
    if method == "item/reasoning/summaryTextDelta":
        delta = payload.get("delta")
        if isinstance(delta, str) and delta:
            return {
                "type": "reasoning_status",
                "thread_id": extract_thread_id(method, payload),
                "turn_id": extract_turn_id(method, payload),
                "item_id": str(payload.get("itemId") or ""),
                "delta": delta,
                "summary_index": payload.get("summaryIndex", 0),
            }
        return None
    if method == "item/reasoning/summaryPartAdded":
        return {
            "type": "reasoning_status",
            "thread_id": extract_thread_id(method, payload),
            "turn_id": extract_turn_id(method, payload),
            "item_id": str(payload.get("itemId") or ""),
            "delta": "",
            "summary_index": payload.get("summaryIndex", 0),
            "section_break": True,
        }
    if method == "item/reasoning/textDelta":
        delta = payload.get("delta")
        if isinstance(delta, str) and delta:
            return {
                "type": "reasoning_status",
                "thread_id": extract_thread_id(method, payload),
                "turn_id": extract_turn_id(method, payload),
                "item_id": str(payload.get("itemId") or ""),
                "delta": delta,
                "content_index": payload.get("contentIndex", 0),
                "raw": True,
            }
        return None
    if method != "item/completed":
        return None
    item = payload.get("item")
    if not isinstance(item, dict) or normalize_item_type(item.get("type")) != "reasoning":
        return None
    return {
        "type": "reasoning_completed",
        "thread_id": extract_thread_id(method, payload),
        "turn_id": extract_turn_id(method, payload),
        "item_id": str(item.get("id") or ""),
        "summary_text": extract_string_list(item.get("summary_text") or item.get("summaryText")),
        "raw_content": extract_string_list(item.get("raw_content") or item.get("rawContent")),
    }


def extract_web_search_payload(method: str, params: dict | None) -> dict[str, Any] | None:
    if method != "item/completed":
        return None
    payload = params or {}
    item = payload.get("item")
    if not isinstance(item, dict) or normalize_item_type(item.get("type")) != "web_search":
        return None
    return {
        "type": "web_search_item",
        "thread_id": extract_thread_id(method, payload),
        "turn_id": extract_turn_id(method, payload),
        "item_id": str(item.get("id") or ""),
        "query": str(item.get("query") or ""),
        "action": item.get("action"),
    }


def extract_image_generation_payload(method: str, params: dict | None) -> dict[str, Any] | None:
    if method != "item/completed":
        return None
    payload = params or {}
    item = payload.get("item")
    if not isinstance(item, dict) or normalize_item_type(item.get("type")) != "image_generation":
        return None
    return {
        "type": "image_generation_item",
        "thread_id": extract_thread_id(method, payload),
        "turn_id": extract_turn_id(method, payload),
        "item_id": str(item.get("id") or ""),
        "status": str(item.get("status") or ""),
        "result": str(item.get("result") or ""),
        "revised_prompt": str(item.get("revised_prompt") or item.get("revisedPrompt") or ""),
        "saved_path": str(item.get("saved_path") or item.get("savedPath") or ""),
    }


def extract_context_compaction_payload(method: str, params: dict | None) -> dict[str, Any] | None:
    payload = params or {}
    if method == "thread/compacted":
        return {
            "type": "context_compacted_item",
            "thread_id": extract_thread_id(method, payload),
            "turn_id": extract_turn_id(method, payload),
            "text": "Context compacted",
        }
    if method != "item/completed":
        return None
    item = payload.get("item")
    if not isinstance(item, dict) or normalize_item_type(item.get("type")) != "context_compaction":
        return None
    return {
        "type": "context_compacted_item",
        "thread_id": extract_thread_id(method, payload),
        "turn_id": extract_turn_id(method, payload),
        "text": "Context compacted",
    }


def get_path_value(payload: dict[str, Any], path: str) -> Any:
    current: Any = payload
    for part in path.split("."):
        if not isinstance(current, dict):
            return None
        current = current.get(part)
        if current is None:
            return None
    return current


def normalize_text_paths(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str) and item.strip()]


def extract_text_by_paths(payload: dict[str, Any], paths: list[str]) -> str | None:
    for path in paths:
        value = get_path_value(payload, path)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def rule_matches(method: str, rule: Any) -> bool:
    if not isinstance(rule, dict) or rule.get("enabled", True) is False:
        return False
    pattern = rule.get("method")
    return isinstance(pattern, str) and method_matches(method, [pattern])


def has_rule_for_method(method: str, rules: list[dict[str, Any]]) -> bool:
    return any(rule_matches(method, rule) for rule in rules)


def apply_rule(method: str, params: dict | None, rules: list[dict[str, Any]]) -> str | None:
    payload = params or {}
    for rule in rules:
        if not rule_matches(method, rule):
            continue
        require_path = rule.get("require_path")
        if isinstance(require_path, str):
            required = rule.get("require_equals")
            actual = get_path_value(payload, require_path)
            if actual != required:
                continue
        paths = normalize_text_paths(rule.get("text_paths"))
        if not paths:
            paths = ["text", "message", "delta", "item.text", "msg.message", "msg.text"]
        text = extract_text_by_paths(payload, paths)
        if text:
            return text
        if str(rule.get("fallback", "drop")).lower() == "json":
            return f"[app-server] {method}: {json.dumps(payload, ensure_ascii=False)}"
    return None


def format_event(method: str, params: dict | None, rules: list[dict[str, Any]]) -> str | None:
    payload = params or {}
    ruled = apply_rule(method, payload, rules)
    if has_rule_for_method(method, rules):
        return ruled
    if ruled is not None:
        return ruled
    text = extract_text(payload)
    if method == "thread/status/changed":
        waiting = payload.get("waitingOnApproval")
        status = payload.get("status")
        if waiting is True:
            return "[app-server] Waiting for approval."
        if isinstance(status, str) and status.strip():
            return f"[app-server] Thread status changed: {status}"
    if method == "item/agentMessage/delta" and text:
        return text
    if method in {"item/plan/delta", "turn/plan/updated"}:
        return None
    if method == "item/completed":
        item = payload.get("item")
        if isinstance(item, dict) and str(item.get("type") or "").strip().lower() == "plan":
            return None
    if method == "turn/started":
        turn_id = (payload.get("turn") or {}).get("id") if isinstance(payload.get("turn"), dict) else payload.get("turnId")
        actual_mode = normalize_mode_kind(payload.get("collaboration_mode_kind") or payload.get("collaborationModeKind"))
        if actual_mode:
            return f"[app-server] Turn started: {turn_id or 'unknown'} (mode: {actual_mode.upper()})"
        return f"[app-server] Turn started: {turn_id or 'unknown'}"
    if method == "turn/completed":
        turn_id = (payload.get("turn") or {}).get("id") if isinstance(payload.get("turn"), dict) else payload.get("turnId")
        actual_mode = normalize_mode_kind(payload.get("collaboration_mode_kind") or payload.get("collaborationModeKind"))
        if actual_mode:
            return f"[app-server] Turn completed: {turn_id or 'unknown'} (mode: {actual_mode.upper()})"
        return f"[app-server] Turn completed: {turn_id or 'unknown'}"
    if method.startswith("codex/event/"):
        if text:
            return f"[app-server] {text}"
        msg = payload.get("msg")
        return f"[app-server] {method}: {json.dumps(msg if msg is not None else payload, ensure_ascii=False)}"
    if text:
        return f"[app-server] {text}"
    return f"[app-server] {method}: {json.dumps(payload, ensure_ascii=False)}"


def event_level(method: str, params: dict | None) -> int:
    payload = params or {}
    if "approval" in method.lower() or payload.get("waitingOnApproval") is True:
        return 20
    if method == "item/agentMessage/delta":
        return 10
    if method in {"item/plan/delta", "turn/plan/updated"}:
        return 0
    if method == "item/completed":
        item = payload.get("item")
        if isinstance(item, dict) and str(item.get("type") or "").strip().lower() == "plan":
            return 0
        return 20
    if method in {"turn/started", "turn/completed", "thread/status/changed"}:
        return 20
    if method.startswith("codex/event/"):
        msg = payload.get("msg")
        msg_type = msg.get("type") if isinstance(msg, dict) else None
        if msg_type == "warning":
            return 30
        if msg_type in {"error", "fatal"}:
            return 40
        return 20
    return 10


def truncate_telegram_text(text: str, footer: str) -> str:
    max_body_len = TELEGRAM_MESSAGE_LIMIT - len(footer)
    if max_body_len < 1:
        max_body_len = 1
    if len(text) <= max_body_len:
        return text + footer
    suffix = "\n...(truncated)"
    head_len = max_body_len - len(suffix)
    if head_len < 1:
        head_len = 1
        suffix = ""
    return text[:head_len] + suffix + footer


async def send_telegram_message(app, user_id: int, text: str, turn_id: str | None) -> None:
    if user_id <= 0 or app is None or not text.strip():
        return
    footer = f"\n\nturnId: {turn_id or 'unknown'}"
    try:
        await app.bot.send_message(
            chat_id=user_id,
            text=truncate_telegram_text(text, footer),
        )
    except Exception:
        logger.exception("Failed to send validation result to Telegram user_id=%s", user_id)


async def publish_system_message(user_id: int | None, thread_id: str | None, turn_id: str | None, text: str) -> None:
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


async def send_telegram_file_change(app, user_id: int, payload: dict[str, Any]) -> None:
    if user_id <= 0 or app is None:
        return
    summary = str(payload.get("summary") or "").strip()
    if not summary:
        return
    lines = [line.strip() for line in summary.splitlines() if line.strip()]
    if not lines:
        return
    turn_id = payload.get("turn_id")
    try:
        last_index = len(lines) - 1
        for index, line in enumerate(lines):
            footer = f"\n\nturnId: {turn_id or 'unknown'}" if index == last_index else ""
            await app.bot.send_message(chat_id=user_id, text=truncate_telegram_text(line, footer))
            if index < last_index:
                await asyncio.sleep(FILE_CHANGE_LINE_DELAY_SECONDS)
    except Exception:
        logger.exception("Failed to forward file change to Telegram user_id=%s", user_id)


async def send_telegram_plan(app, user_id: int, payload: dict[str, Any]) -> None:
    plan_text = str(payload.get("text") or "").strip()
    if plan_text:
        await send_telegram_message(app, user_id, f"Plan proposal\n\n{plan_text}", payload.get("turn_id"))


def build_event_forwarder(app, config: ForwardingConfig):
    async def forward_event(method: str, params: dict | None):
        thread_id = extract_thread_id(method, params)
        turn_id = extract_turn_id(method, params)
        if thread_id is None and turn_id:
            thread_id = user_manager.get_turn_thread(turn_id)
        target_user_ids = set()
        if turn_id:
            target_user_ids.update(user_manager.find_user_ids_by_turn(turn_id))
        if thread_id:
            target_user_ids.update(user_manager.find_user_ids_by_thread(thread_id))

        if not target_user_ids and method in {"turn/completed", "turn/failed", "turn/cancelled"}:
            fallback_owner = user_manager.find_single_active_turn_owner()
            if fallback_owner is not None:
                target_user_ids.add(fallback_owner)

        if method == "turn/started" and turn_id and target_user_ids:
            actual_mode = normalize_mode_kind((params or {}).get("collaboration_mode_kind") or (params or {}).get("collaborationModeKind"))
            for uid in target_user_ids:
                state_user = user_manager.get(uid)
                user_manager.bind_turn(uid, turn_id, thread_id)
                state_user.set_turn(turn_id, thread_id)
                if actual_mode is not None:
                    state_user.set_collaboration_mode(actual_mode)
                logger.info(
                    "Codex turn started user_id=%s thread_id=%s turn_id=%s actual_mode=%s raw_params=%s",
                    uid,
                    thread_id,
                    turn_id,
                    actual_mode,
                    params,
                )
        if method == "error" and target_user_ids:
            message = format_event(method, params, config.rules)
            if message and message.strip():
                for uid in target_user_ids:
                    await publish_system_message(uid, thread_id, turn_id, message)
                    if uid > 0 and app is not None:
                        try:
                            await app.bot.send_message(
                                chat_id=uid,
                                text=truncate_telegram_text(message, f"\n\nturnId: {turn_id or 'unknown'}"),
                            )
                        except Exception:
                            logger.exception("Failed to forward app-server error to Telegram")
            return
        if method in {"turn/completed", "turn/failed", "turn/cancelled"} and target_user_ids:
            for uid in target_user_ids:
                state_user = user_manager.get(uid)
                if turn_id:
                    state_user.clear_turn(turn_id=turn_id, thread_id=thread_id)
                elif state_user.active_turn_id:
                    state_user.clear_turn()
            if turn_id:
                user_manager.clear_turn_bindings(turn_id)

        file_change = extract_file_change_summary(method, params)
        if file_change is not None:
            for uid in target_user_ids:
                await event_hub.publish_event(
                    uid,
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
                if uid > 0 and str(file_change.get("source") or "").strip().lower() != "apply_patch":
                    await send_telegram_file_change(app, uid, file_change)
            return

        plan_item = extract_plan_item_payload(method, params)
        if plan_item is not None:
            for uid in target_user_ids:
                await event_hub.publish_event(
                    uid,
                    {
                        "type": "plan_completed" if plan_item["is_final"] else "plan_delta",
                        "thread_id": plan_item.get("thread_id"),
                        "turn_id": plan_item.get("turn_id"),
                        "item_id": plan_item.get("item_id"),
                        "text": plan_item.get("text") or "",
                    },
                )
                if uid > 0 and plan_item["is_final"]:
                    await send_telegram_plan(app, uid, plan_item)
            return

        plan_checklist = extract_plan_checklist_payload(method, params)
        if plan_checklist is not None:
            for uid in target_user_ids:
                await event_hub.publish_event(
                    uid,
                    {
                        "type": "plan_checklist",
                        "thread_id": plan_checklist.get("thread_id"),
                        "turn_id": plan_checklist.get("turn_id"),
                        "explanation": plan_checklist.get("explanation") or "",
                        "plan": plan_checklist.get("plan") or [],
                    },
                )
            return

        for specialized_payload in (
            extract_reasoning_payload(method, params),
            extract_web_search_payload(method, params),
            extract_image_generation_payload(method, params),
            extract_context_compaction_payload(method, params),
        ):
            if specialized_payload is not None:
                for uid in target_user_ids:
                    await event_hub.publish_event(uid, specialized_payload)
                return

        if target_user_ids:
            event_type = "app_event"
            if method == "item/agentMessage/delta":
                event_type = "turn_delta"
            elif method == "item/completed":
                item = (params or {}).get("item")
                if isinstance(item, dict):
                    item_type = normalize_item_type(item.get("type"))
                    completed_text = extract_text(params)
                    if item_type in {"agentmessage", "assistantmessage", "message"} and completed_text:
                        event_type = "turn_delta"
            elif method == "turn/started":
                event_type = "turn_started"
            elif method == "turn/completed":
                event_type = "turn_completed"
            elif method == "turn/failed":
                event_type = "turn_failed"
            elif method == "turn/cancelled":
                event_type = "turn_cancelled"
            for uid in target_user_ids:
                await event_hub.publish_event(
                    uid,
                    {
                        "type": event_type,
                        "method": method,
                        "thread_id": thread_id,
                        "turn_id": turn_id,
                        "item_id": extract_item_id(params),
                        "text": extract_text(params) or "",
                        "variant": extract_message_variant(params),
                        "params": params or {},
                    },
                )
                if method == "turn/completed":
                    actual_mode = normalize_mode_kind((params or {}).get("collaboration_mode_kind") or (params or {}).get("collaborationModeKind"))
                    mode_suffix = f" Mode: {actual_mode.upper()}." if actual_mode else ""
                    await publish_system_message(
                        uid,
                        thread_id,
                        turn_id,
                        f"Turn completed.{mode_suffix}",
                    )

        if method_matches(method, config.denylist):
            return
        if config.allowlist and not method_matches(method, config.allowlist):
            return
        if event_level(method, params) < config.threshold:
            return
        telegram_user_ids = [uid for uid in target_user_ids if uid > 0]
        if not telegram_user_ids or app is None:
            return
        message = format_event(method, params, config.rules)
        if message is None or not message.strip():
            return
        footer = f"\n\nturnId: {turn_id or 'unknown'}"
        for user_id in telegram_user_ids:
            logger.info(
                "Forwarding app-server event to Telegram user_id=%s method=%s message=%s",
                user_id,
                method,
                truncate_telegram_text(message, footer),
            )
            try:
                kwargs: dict[str, Any] = {}
                if method in {"turn/completed", "turn/failed", "turn/cancelled"}:
                    kwargs["reply_markup"] = main_menu_keyboard(user_manager.get(user_id).collaboration_mode)
                await app.bot.send_message(
                    chat_id=user_id,
                    text=truncate_telegram_text(message, footer),
                    **kwargs,
                )
            except Exception:
                logger.exception("Failed to forward app-server event to Telegram")

    return forward_event
