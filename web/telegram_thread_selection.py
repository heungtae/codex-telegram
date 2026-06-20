import logging
from typing import Any

from codex import CodexError
from models import state
from web.thread_history import (
    clip_thread_label,
    thread_title,
    thread_turn_messages,
    thread_turns,
    thread_user_request_excerpt,
)

logger = logging.getLogger("codex-telegram.web.telegram_thread_selection")


def _clip_line(text: str, limit: int = 180) -> str:
    normalized = " ".join(str(text or "").split())
    if len(normalized) <= limit:
        return normalized
    return normalized[: limit - 3].rstrip() + "..."


def _role_label(role: str) -> str:
    return "You" if role == "user" else "Codex" if role == "assistant" else "System"


async def load_thread_context_preview(thread_id: str) -> dict[str, Any]:
    result: dict[str, Any] = {}
    read_status = "ok"
    read_error = ""
    try:
        result = await state.codex_client.call("thread/read", {"threadId": thread_id, "includeTurns": True})
    except CodexError as exc:
        if exc.code == -32600 and "includeTurns is unavailable before first user message" in exc.message:
            read_status = "empty"
            result = {"thread": {"id": thread_id}, "turns": []}
        else:
            read_status = "failed"
            read_error = str(exc)
            result = {"thread": {"id": thread_id}, "turns": []}
    except Exception as exc:
        read_status = "failed"
        read_error = str(exc)
        result = {"thread": {"id": thread_id}, "turns": []}

    thread = result.get("thread", {}) if isinstance(result, dict) else {}
    if not isinstance(thread, dict):
        thread = {"id": thread_id}
    turns = thread_turns(result, thread)
    messages = thread_turn_messages(turns, thread_id)
    title = clip_thread_label(thread_title(thread)) or thread_user_request_excerpt(result, thread) or "Untitled"
    recent_messages = messages[-6:]
    preview_lines = [
        f"{_role_label(str(item.get('role') or 'system'))}: {_clip_line(str(item.get('text') or ''))}"
        for item in recent_messages
        if str(item.get("text") or "").strip()
    ]
    if not preview_lines:
        preview_lines = ["(no messages yet)"]

    logger.info(
        "Telegram active thread preview loaded thread_id=%s read_status=%s title=%s turns=%s messages=%s error=%s",
        thread_id,
        read_status,
        title,
        len(turns),
        len(messages),
        read_error,
    )
    return {
        "thread_id": thread_id,
        "title": title,
        "turn_count": len(turns),
        "message_count": len(messages),
        "preview_lines": preview_lines,
        "read_status": read_status,
        "read_error": read_error,
    }


def format_telegram_active_thread_changed_message(
    preview: dict[str, Any],
    *,
    project_key: str | None = None,
    resume_status: str | None = None,
) -> str:
    lines = [
        "Telegram active thread changed",
        f"Title: {preview.get('title') or 'Untitled'}",
        f"Thread: {preview.get('thread_id') or ''}",
    ]
    if project_key:
        lines.append(f"Project: {project_key}")
    if resume_status:
        lines.append(f"Resume: {resume_status}")
    lines.extend(
        [
            f"Turns: {preview.get('turn_count', 0)}",
            "",
            "Recent conversation:",
        ]
    )
    lines.extend(str(line) for line in preview.get("preview_lines") or ["(no messages yet)"])
    return "\n".join(lines).strip()


def preview_from_read_text(thread_id: str, text: str) -> dict[str, Any]:
    title = "Untitled"
    turn_count = 0
    preview = "(no messages yet)"
    for raw_line in str(text or "").splitlines():
        line = raw_line.strip()
        if line.startswith("Thread:"):
            title = line[len("Thread:"):].strip() or title
        elif line.startswith("Turns:"):
            raw_turns = line[len("Turns:"):].strip()
            if raw_turns.isdigit():
                turn_count = int(raw_turns)
        elif line.startswith("Preview:"):
            preview = line[len("Preview:"):].strip() or preview
    return {
        "thread_id": thread_id,
        "title": title,
        "turn_count": turn_count,
        "message_count": 0 if preview == "(no messages yet)" else 1,
        "preview_lines": [preview],
        "read_status": "ok",
        "read_error": "",
    }


async def build_telegram_active_thread_changed_message(
    thread_id: str,
    *,
    project_key: str | None = None,
    resume_status: str | None = None,
) -> tuple[str, dict[str, Any]]:
    preview = await load_thread_context_preview(thread_id)
    return format_telegram_active_thread_changed_message(
        preview,
        project_key=project_key,
        resume_status=resume_status,
    ), preview


async def notify_telegram_active_thread_changed(
    telegram_app: Any,
    telegram_user_id: int,
    thread_id: str,
    *,
    project_key: str | None = None,
    resume_status: str | None = None,
) -> dict[str, Any]:
    if telegram_app is None or getattr(telegram_app, "bot", None) is None:
        logger.info(
            "Telegram active thread notification skipped: no app user_id=%s thread_id=%s",
            telegram_user_id,
            thread_id,
        )
        return {"status": "skipped"}
    message, preview = await build_telegram_active_thread_changed_message(
        thread_id,
        project_key=project_key,
        resume_status=resume_status,
    )
    try:
        await telegram_app.bot.send_message(chat_id=telegram_user_id, text=message)
        logger.info(
            "Telegram active thread notification sent user_id=%s thread_id=%s project_key=%s",
            telegram_user_id,
            thread_id,
            project_key or "",
        )
        return {"status": "ok", "message": message, "preview": preview}
    except Exception as exc:
        logger.exception(
            "Telegram active thread notification failed user_id=%s thread_id=%s",
            telegram_user_id,
            thread_id,
        )
        return {"status": "failed", "error": str(exc), "message": message, "preview": preview}
