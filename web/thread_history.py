import os
from typing import Any

from codex.command_router.common import first_text
from models.user import user_manager
from utils.config import get


def thread_title(thread: dict[str, Any]) -> str:
    for key in ("title", "name", "preview", "conversation", "summary"):
        value = thread.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return "Untitled"


def clip_thread_label(text: str, limit: int = 72) -> str:
    normalized = " ".join(str(text or "").split())
    if not normalized:
        return ""
    if len(normalized) <= limit:
        return normalized
    return normalized[: limit - 3].rstrip() + "..."


def thread_turns(result: dict[str, Any], thread: dict[str, Any]) -> list[dict[str, Any]]:
    def to_turn_list(value: Any) -> list[dict[str, Any]]:
        if isinstance(value, list):
            return [v for v in value if isinstance(v, dict)]
        if isinstance(value, dict):
            data = value.get("data")
            if isinstance(data, list):
                return [v for v in data if isinstance(v, dict)]
        return []

    turns = to_turn_list(result.get("turns"))
    if turns:
        return turns
    return to_turn_list(thread.get("turns"))


def thread_turn_messages(turns: list[dict[str, Any]], default_thread_id: str | None = None) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = []
    seen: set[tuple[str, str, str, str, str, str]] = set()

    def add_message(
        role: str,
        text: str,
        variant: str | None = None,
        kind: str | None = None,
        thread_id: str | None = None,
        turn_id: str | None = None,
    ) -> None:
        cleaned = str(text or "").strip()
        if not cleaned:
            return
        normalized_variant = variant if isinstance(variant, str) and variant else ""
        normalized_kind = kind if isinstance(kind, str) and kind else ""
        normalized_thread_id = thread_id if isinstance(thread_id, str) and thread_id else ""
        normalized_turn_id = turn_id if isinstance(turn_id, str) and turn_id else ""
        key = (role, normalized_variant, normalized_kind, normalized_thread_id, normalized_turn_id, cleaned)
        if key in seen:
            return
        seen.add(key)
        message = {"role": role, "text": cleaned}
        if normalized_variant:
            message["variant"] = normalized_variant
        if normalized_kind:
            message["kind"] = normalized_kind
        if normalized_thread_id:
            message["thread_id"] = normalized_thread_id
        if normalized_turn_id:
            message["turn_id"] = normalized_turn_id
        messages.append(message)

    def infer_role(value: dict[str, Any], default_role: str) -> str:
        for key in ("role", "author", "speaker", "source"):
            raw = str(value.get(key) or "").strip().lower()
            if raw in {"user", "assistant", "system"}:
                return raw
        item_type = str(value.get("type") or "").strip().lower()
        normalized_item_type = item_type.replace("_", "").replace("-", "")
        if normalized_item_type in {"usermessage", "user"}:
            return "user"
        if normalized_item_type in {"assistantmessage", "agentmessage", "assistant", "message"}:
            return default_role
        return default_role

    def infer_variant(value: dict[str, Any], role: str, default_variant: str | None) -> str | None:
        if role != "assistant":
            return None
        for key in ("role", "author", "speaker", "source", "name", "agentName", "agent"):
            raw = value.get(key)
            if not isinstance(raw, str):
                continue
            normalized = raw.strip().lower().replace("_", "").replace("-", "").replace(" ", "")
            if not normalized:
                continue
            if normalized in {"assistant", "agent", "message", "agentmessage", "assistantmessage", "model", "default"}:
                continue
            return "subagent"
        return default_variant

    def walk(
        value: Any,
        default_role: str,
        default_variant: str | None = None,
        thread_id: str | None = None,
        turn_id: str | None = None,
    ) -> None:
        if isinstance(value, str):
            add_message(default_role, value, default_variant, None, thread_id, turn_id)
            return
        if isinstance(value, list):
            for item in value:
                walk(item, default_role, default_variant, thread_id, turn_id)
            return
        if not isinstance(value, dict):
            return

        role = infer_role(value, default_role)
        variant = infer_variant(value, role, default_variant)
        item_type = str(value.get("type") or "").strip().lower()
        kind = "plan" if item_type == "plan" and role == "assistant" else None
        direct = value.get("text")
        if isinstance(direct, str) and direct.strip():
            add_message(role, direct, variant, kind, thread_id, turn_id)

        content = value.get("content")
        if isinstance(content, str) and content.strip():
            add_message(role, content, variant, kind, thread_id, turn_id)
        elif isinstance(content, list):
            for item in content:
                if isinstance(item, dict):
                    text = item.get("text")
                    if isinstance(text, str) and text.strip():
                        add_message(role, text, variant, kind, thread_id, turn_id)
                    else:
                        walk(item, role, variant, thread_id, turn_id)
                else:
                    walk(item, role, variant, thread_id, turn_id)

        for key in ("input", "userInput", "prompt", "output", "items", "messages"):
            nested = value.get(key)
            if nested is None:
                continue
            next_role = "user" if key in {"input", "userInput", "prompt"} else role
            if key in {"output", "items", "messages"} and role == "user":
                next_role = "assistant"
            next_variant = variant if next_role == "assistant" else None
            walk(nested, next_role, next_variant, thread_id, turn_id)

    for turn in turns:
        turn_thread_id = default_thread_id
        turn_turn_id = ""
        if isinstance(turn.get("threadId"), str) and turn.get("threadId"):
            turn_thread_id = turn.get("threadId")
        elif isinstance(turn.get("thread_id"), str) and turn.get("thread_id"):
            turn_thread_id = turn.get("thread_id")
        if isinstance(turn.get("turnId"), str) and turn.get("turnId"):
            turn_turn_id = turn.get("turnId")
        elif isinstance(turn.get("turn_id"), str) and turn.get("turn_id"):
            turn_turn_id = turn.get("turn_id")
        before_count = len(messages)
        walk(turn.get("input"), "user", None, turn_thread_id, turn_turn_id)
        walk(turn.get("userInput"), "user", None, turn_thread_id, turn_turn_id)
        walk(turn.get("prompt"), "user", None, turn_thread_id, turn_turn_id)
        walk(turn.get("output"), "assistant", None, turn_thread_id, turn_turn_id)
        walk(turn.get("items"), "assistant", None, turn_thread_id, turn_turn_id)
        walk(turn.get("messages"), "assistant", None, turn_thread_id, turn_turn_id)

        if len(messages) == before_count:
            user_text = first_text(turn.get("input")) or first_text(turn.get("userInput")) or first_text(turn.get("prompt"))
            assistant_text = (
                first_text(turn.get("output"))
                or first_text(turn.get("items"))
                or first_text(turn.get("text"))
                or first_text(turn.get("summary"))
                or first_text(turn.get("preview"))
            )
            if user_text:
                add_message("user", user_text, None, None, turn_thread_id, turn_turn_id)
            if assistant_text:
                add_message("assistant", assistant_text, None, None, turn_thread_id, turn_turn_id)
    return messages


def thread_user_request_excerpt(result: dict[str, Any], thread: dict[str, Any]) -> str:
    turns = thread_turns(result, thread)
    messages = thread_turn_messages(turns)
    for message in messages:
        if message.get("role") == "user":
            text = message.get("text")
            if isinstance(text, str) and text.strip():
                return clip_thread_label(text.strip())
    for key in ("input", "userInput", "prompt"):
        text = first_text(thread.get(key))
        if text:
            return clip_thread_label(text)
    return ""


def thread_profile_key(thread: dict[str, Any], current_profile_key: str) -> str | None:
    tid = thread.get("id")
    if isinstance(tid, str):
        mapped = user_manager.get_thread_project(tid)
        if mapped:
            return mapped

    project_path_by_key: dict[str, str] = {}
    projects_raw = get("projects", {})
    if isinstance(projects_raw, dict):
        for key, value in projects_raw.items():
            if not isinstance(key, str) or not isinstance(value, dict):
                continue
            path = value.get("path")
            if isinstance(path, str) and path.strip():
                project_path_by_key[key] = os.path.realpath(path.strip())

    candidates: list[str] = []
    for key in ("cwd", "path", "workspace", "workspacePath", "projectPath"):
        value = thread.get(key)
        if isinstance(value, str) and value.strip():
            candidates.append(value.strip())
    context_value = thread.get("context")
    if isinstance(context_value, dict):
        for key in ("cwd", "path", "workspace", "workspacePath", "projectPath"):
            value = context_value.get(key)
            if isinstance(value, str) and value.strip():
                candidates.append(value.strip())

    for candidate in candidates:
        real_candidate = os.path.realpath(candidate)
        for key, real_path in project_path_by_key.items():
            if real_candidate == real_path:
                if isinstance(tid, str) and tid:
                    user_manager.bind_thread_project(tid, key)
                return key
    return current_profile_key if isinstance(tid, str) and user_manager.get_thread_project(tid) == current_profile_key else None
