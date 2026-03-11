import asyncio
import json
import logging
import os
import shlex
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from codex.command_router.common import first_text
from models import state
from models.user import user_manager
from utils.config import (
    get,
    get_guardian_settings,
    get_reviewer_settings,
    get_web_password,
    reload,
    save_guardian_settings,
    save_reviewer_settings,
    save_project_profile,
)
from utils.local_command import resolve_command_cwd, run_bang_command
from web.runtime import event_hub, session_manager

logger = logging.getLogger("codex-telegram.web")

STATIC_DIR = Path(__file__).resolve().parent / "static"
COOKIE_NAME = "codex_web_session"
INDEX_HTML_PATH = STATIC_DIR / "index.html"


def _normalize_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        raw = value.strip().lower()
        if raw in {"1", "true", "yes", "on"}:
            return True
        if raw in {"0", "false", "no", "off"}:
            return False
    return default


def _asset_url(filename: str) -> str:
    asset_path = STATIC_DIR / filename
    try:
        version = int(asset_path.stat().st_mtime)
    except OSError:
        version = 0
    return f"/assets/{filename}?v={version}"


async def _wait_for_codex() -> None:
    while not state.codex_ready.is_set():
        await asyncio.sleep(0.05)
    if state.codex_client is None or state.command_router is None:
        raise HTTPException(status_code=503, detail="Codex runtime is not ready.")


async def _session_from_request(request: Request):
    token = request.cookies.get(COOKIE_NAME)
    session = await session_manager.get(token)
    if session is None:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return session


async def _route(command: str, args: list[str], user_id: int) -> dict[str, Any]:
    await _wait_for_codex()
    result = await state.command_router.route(command, args, user_id)
    return {
        "kind": result.kind,
        "text": result.text,
        "meta": result.meta,
    }


def _thread_title(thread: dict[str, Any]) -> str:
    for key in ("title", "name", "preview", "conversation", "summary"):
        value = thread.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return "Untitled"


def _clip_thread_label(text: str, limit: int = 72) -> str:
    normalized = " ".join(str(text or "").split())
    if not normalized:
        return ""
    if len(normalized) <= limit:
        return normalized
    return normalized[: limit - 3].rstrip() + "..."


def _thread_turns(result: dict[str, Any], thread: dict[str, Any]) -> list[dict[str, Any]]:
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


def _thread_turn_messages(turns: list[dict[str, Any]]) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = []
    seen: set[tuple[str, str, str]] = set()

    def add_message(role: str, text: str, variant: str | None = None) -> None:
        cleaned = str(text or "").strip()
        if not cleaned:
            return
        normalized_variant = variant if isinstance(variant, str) and variant else ""
        key = (role, normalized_variant, cleaned)
        if key in seen:
            return
        seen.add(key)
        message = {"role": role, "text": cleaned}
        if normalized_variant:
            message["variant"] = normalized_variant
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

    def walk(value: Any, default_role: str, default_variant: str | None = None) -> None:
        if isinstance(value, str):
            add_message(default_role, value, default_variant)
            return
        if isinstance(value, list):
            for item in value:
                walk(item, default_role, default_variant)
            return
        if not isinstance(value, dict):
            return

        role = infer_role(value, default_role)
        variant = infer_variant(value, role, default_variant)
        direct = value.get("text")
        if isinstance(direct, str) and direct.strip():
            add_message(role, direct, variant)

        content = value.get("content")
        if isinstance(content, str) and content.strip():
            add_message(role, content, variant)
        elif isinstance(content, list):
            for item in content:
                if isinstance(item, dict):
                    text = item.get("text")
                    if isinstance(text, str) and text.strip():
                        add_message(role, text, variant)
                    else:
                        walk(item, role, variant)
                else:
                    walk(item, role, variant)

        for key in ("input", "userInput", "prompt", "output", "items", "messages"):
            nested = value.get(key)
            if nested is None:
                continue
            next_role = "user" if key in {"input", "userInput", "prompt"} else role
            if key in {"output", "items", "messages"} and role == "user":
                next_role = "assistant"
            next_variant = variant if next_role == "assistant" else None
            walk(nested, next_role, next_variant)

    for turn in turns:
        before_count = len(messages)
        walk(turn.get("input"), "user")
        walk(turn.get("userInput"), "user")
        walk(turn.get("prompt"), "user")
        walk(turn.get("output"), "assistant")
        walk(turn.get("items"), "assistant")
        walk(turn.get("messages"), "assistant")

        # Fallback when turns only expose a single text-like field.
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
                add_message("user", user_text)
            if assistant_text:
                add_message("assistant", assistant_text)
    return messages


def _thread_user_request_excerpt(result: dict[str, Any], thread: dict[str, Any]) -> str:
    turns = _thread_turns(result, thread)
    messages = _thread_turn_messages(turns)
    for message in messages:
        if message.get("role") == "user":
            text = message.get("text")
            if isinstance(text, str) and text.strip():
                return _clip_thread_label(text.strip())
    for key in ("input", "userInput", "prompt"):
        text = first_text(thread.get(key))
        if text:
            return _clip_thread_label(text)
    return ""


def _thread_profile_key(thread: dict[str, Any], current_profile_key: str) -> str | None:
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


def _workspace_suggestions(workspace: str, prefix: str, limit: int) -> list[str]:
    def _normalize_for_match(value: str) -> str:
        return "".join(ch for ch in value.lower() if ch.isalnum())

    def _is_subsequence(query: str, target: str) -> bool:
        if not query:
            return True
        it = iter(target)
        return all(ch in it for ch in query)

    def _fuzzy_score(name: str, query: str) -> int:
        if not query:
            return 1
        n = name.lower()
        q = query.lower()
        if n.startswith(q):
            return 500 - min(len(n), 200)
        idx = n.find(q)
        if idx >= 0:
            return 420 - min(idx, 200)

        n_norm = _normalize_for_match(n)
        q_norm = _normalize_for_match(q)
        if not q_norm:
            return 1

        idx_norm = n_norm.find(q_norm)
        if idx_norm >= 0:
            return 340 - min(idx_norm, 200)
        if _is_subsequence(q_norm, n_norm):
            return 260 - min(len(n_norm), 200)
        return 0

    normalized_prefix = prefix.replace("\\", "/").lstrip("/")
    parts = [p for p in normalized_prefix.split("/") if p and p != "."]
    if any(p == ".." for p in parts):
        return []

    base_rel = ""
    partial = normalized_prefix
    if "/" in normalized_prefix:
        if normalized_prefix.endswith("/"):
            base_rel = normalized_prefix.rstrip("/")
            partial = ""
        else:
            base_rel, partial = normalized_prefix.rsplit("/", 1)
    scan_dir = os.path.join(workspace, base_rel) if base_rel else workspace
    if not os.path.isdir(scan_dir):
        return []

    scored: list[tuple[int, str, str]] = []
    partial_lower = partial.lower()
    recursive_mode = not base_rel and "/" not in normalized_prefix and bool(partial_lower)

    if recursive_mode:
        max_scan = 4000
        scanned = 0
        try:
            for root, dirnames, filenames in os.walk(workspace):
                dirnames[:] = [d for d in dirnames if not d.startswith(".")]
                rel_root = os.path.relpath(root, workspace)
                if rel_root == ".":
                    rel_root = ""
                names = [(d, True) for d in dirnames] + [(f, False) for f in filenames if not f.startswith(".")]
                for name, is_dir in names:
                    scanned += 1
                    if scanned > max_scan:
                        break
                    rel = f"{rel_root}/{name}" if rel_root else name
                    if is_dir:
                        rel += "/"
                    score_name = _fuzzy_score(name, partial_lower)
                    score_rel = _fuzzy_score(rel, partial_lower)
                    score = max(score_name, score_rel)
                    if score <= 0:
                        continue
                    scored.append((score, rel.lower(), rel))
                if scanned > max_scan:
                    break
        except OSError:
            return []
        scored.sort(key=lambda row: (-row[0], row[1]))
        return [row[2] for row in scored[:limit]]

    try:
        with os.scandir(scan_dir) as entries:
            rows = sorted(entries, key=lambda e: e.name.lower())
            for entry in rows:
                name = entry.name
                if name.startswith("."):
                    continue
                score = _fuzzy_score(name, partial_lower)
                if partial and score <= 0:
                    continue
                rel = f"{base_rel}/{name}" if base_rel else name
                if entry.is_dir():
                    rel += "/"
                scored.append((score, name.lower(), rel))
    except OSError:
        return []
    scored.sort(key=lambda row: (-row[0], row[1]))
    return [row[2] for row in scored[:limit]]


async def _run_local_feature_toggle(feature_key: str, enabled: bool) -> tuple[bool, str]:
    action = "enable" if enabled else "disable"
    try:
        proc = await asyncio.create_subprocess_exec(
            "codex",
            "features",
            action,
            feature_key,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
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


def create_web_app() -> FastAPI:
    app = FastAPI(title="Codex Web", version="0.1.0")
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR)), name="assets")

    @app.get("/")
    async def index() -> HTMLResponse:
        html = INDEX_HTML_PATH.read_text(encoding="utf-8")
        html = html.replace("/assets/styles.css", _asset_url("styles.css"))
        html = html.replace("/assets/app.jsx", _asset_url("app.jsx"))
        return HTMLResponse(html, headers={"Cache-Control": "no-store"})

    @app.post("/api/auth/login")
    async def login(payload: dict[str, Any], response: Response) -> dict[str, Any]:
        username = str(payload.get("username", "")).strip()
        password = str(payload.get("password", ""))
        if not username or not password:
            raise HTTPException(status_code=400, detail="username and password are required")

        allowed_users = get("web.allowed_users", [])
        if isinstance(allowed_users, list) and allowed_users:
            normalized_allowed = {str(v).strip() for v in allowed_users if str(v).strip()}
            if username not in normalized_allowed:
                raise HTTPException(status_code=403, detail="User is not allowed")

        configured_password = get_web_password()
        if not configured_password:
            raise HTTPException(status_code=500, detail="web.password or web.password_env is not configured")
        if password != configured_password:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        ttl = int(get("web.session_ttl_seconds", 43200))
        session = await session_manager.create(username, ttl)
        response.set_cookie(
            key=COOKIE_NAME,
            value=session.token,
            max_age=ttl,
            httponly=True,
            secure=_normalize_bool(get("web.cookie_secure", False), False),
            samesite="lax",
        )
        return {
            "username": session.username,
            "user_id": session.user_id,
        }

    @app.post("/api/auth/logout")
    async def logout(request: Request, response: Response) -> dict[str, bool]:
        token = request.cookies.get(COOKIE_NAME)
        await session_manager.delete(token)
        response.delete_cookie(COOKIE_NAME)
        return {"ok": True}

    @app.get("/api/auth/me")
    async def me(request: Request) -> dict[str, Any]:
        session = await _session_from_request(request)
        return {
            "username": session.username,
            "user_id": session.user_id,
        }

    @app.get("/api/events/stream")
    async def stream(request: Request):
        session = await _session_from_request(request)
        queue = await event_hub.subscribe(session.user_id)

        async def event_generator():
            heartbeat = 20.0
            try:
                while True:
                    if await request.is_disconnected():
                        break
                    try:
                        event = await asyncio.wait_for(queue.get(), timeout=heartbeat)
                        yield f"event: {event.get('type', 'message')}\ndata: {json.dumps(event, ensure_ascii=False)}\n\n"
                    except asyncio.TimeoutError:
                        yield "event: ping\ndata: {}\n\n"
            finally:
                await event_hub.unsubscribe(session.user_id, queue)

        return StreamingResponse(event_generator(), media_type="text/event-stream")

    @app.get("/api/approvals")
    async def approvals(request: Request) -> dict[str, Any]:
        session = await _session_from_request(request)
        pending = await event_hub.list_approvals(session.user_id)
        return {"items": pending}

    @app.post("/api/approvals/{request_id}")
    async def submit_approval(request_id: int, payload: dict[str, Any], request: Request) -> dict[str, Any]:
        session = await _session_from_request(request)
        decision = str(payload.get("decision", "")).strip().lower()
        if decision not in {"approve", "session", "deny"}:
            raise HTTPException(status_code=400, detail="decision must be approve|session|deny")

        await _wait_for_codex()
        accepted = state.codex_client.submit_approval_decision(request_id, decision)
        if not accepted:
            raise HTTPException(status_code=404, detail="approval request not found or already handled")

        await event_hub.pop_approval(session.user_id, request_id)
        return {"ok": True, "request_id": request_id, "decision": decision}

    @app.get("/api/threads")
    async def list_threads(
        request: Request,
        archived: bool = False,
        offset: int = 0,
        limit: int = 10,
        current_profile: bool = True,
    ) -> dict[str, Any]:
        session = await _session_from_request(request)
        args = ["--limit", str(max(1, min(100, limit))), "--offset", str(max(0, offset))]
        if archived:
            args.append("--archived")
        if current_profile:
            args.append("--current-profile")
        result = await _route("/threads", args, session.user_id)
        return result

    @app.get("/api/threads/summaries")
    async def thread_summaries(
        request: Request,
        archived: bool = False,
        offset: int = 0,
        limit: int = 30,
    ) -> dict[str, Any]:
        session = await _session_from_request(request)
        await _wait_for_codex()
        safe_limit = max(1, min(100, limit))
        safe_offset = max(0, offset)
        params: dict[str, Any] = {"limit": min(100, safe_limit + safe_offset)}
        if archived:
            params["archived"] = True
        result = await state.codex_client.call("thread/list", params)
        rows = result.get("data", [])
        if not isinstance(rows, list):
            rows = []
        state_user = user_manager.get(session.user_id)
        current_profile_key = state_user.selected_project_key
        if not current_profile_key:
            default_key = get("project")
            if isinstance(default_key, str) and default_key.strip():
                current_profile_key = default_key.strip()
        if current_profile_key:
            rows = [
                thread
                for thread in rows
                if isinstance(thread, dict) and _thread_profile_key(thread, current_profile_key) == current_profile_key
            ]
        if safe_offset:
            rows = rows[safe_offset:]
        rows = rows[:safe_limit]
        items: list[dict[str, Any]] = []
        for thread in rows:
            if not isinstance(thread, dict):
                continue
            tid = thread.get("id")
            if not isinstance(tid, str) or not tid:
                continue
            title = ""
            try:
                detail = await state.codex_client.call("thread/read", {"threadId": tid, "includeTurns": True})
            except Exception:
                detail = {}
            if isinstance(detail, dict):
                detail_thread = detail.get("thread")
                title = _thread_user_request_excerpt(detail, detail_thread if isinstance(detail_thread, dict) else thread)
            if not title:
                title = _clip_thread_label(_thread_title(thread))
            items.append(
                {
                    "id": tid,
                    "title": title,
                    "created_at": thread.get("createdAt") or thread.get("created_at") or "",
                    "active": tid == state_user.active_thread_id,
                }
            )
        return {"items": items}

    @app.post("/api/threads/start")
    async def start_thread(request: Request) -> dict[str, Any]:
        session = await _session_from_request(request)
        return await _route("/start", [], session.user_id)

    @app.post("/api/threads/resume")
    async def resume_thread(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        session = await _session_from_request(request)
        thread_id = str(payload.get("thread_id", "")).strip()
        if not thread_id:
            raise HTTPException(status_code=400, detail="thread_id is required")
        return await _route("/resume", [thread_id], session.user_id)

    @app.post("/api/threads/fork")
    async def fork_thread(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        session = await _session_from_request(request)
        thread_id = str(payload.get("thread_id", "")).strip()
        if not thread_id:
            raise HTTPException(status_code=400, detail="thread_id is required")
        return await _route("/fork", [thread_id], session.user_id)

    @app.post("/api/threads/archive")
    async def archive_thread(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        session = await _session_from_request(request)
        thread_id = str(payload.get("thread_id", "")).strip()
        if not thread_id:
            raise HTTPException(status_code=400, detail="thread_id is required")
        return await _route("/archive", [thread_id], session.user_id)

    @app.post("/api/threads/unarchive")
    async def unarchive_thread(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        session = await _session_from_request(request)
        thread_id = str(payload.get("thread_id", "")).strip()
        if not thread_id:
            raise HTTPException(status_code=400, detail="thread_id is required")
        return await _route("/unarchive", [thread_id], session.user_id)

    @app.post("/api/threads/compact")
    async def compact_thread(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        session = await _session_from_request(request)
        thread_id = str(payload.get("thread_id", "")).strip()
        if not thread_id:
            raise HTTPException(status_code=400, detail="thread_id is required")
        return await _route("/compact", [thread_id], session.user_id)

    @app.post("/api/threads/rollback")
    async def rollback_thread(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        session = await _session_from_request(request)
        turns = payload.get("turns")
        if not isinstance(turns, int) or turns <= 0:
            raise HTTPException(status_code=400, detail="turns must be a positive integer")
        return await _route("/rollback", [str(turns)], session.user_id)

    @app.post("/api/threads/interrupt")
    async def interrupt_thread(request: Request) -> dict[str, Any]:
        session = await _session_from_request(request)
        return await _route("/interrupt", [], session.user_id)

    @app.post("/api/chat/messages")
    async def send_message(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        session = await _session_from_request(request)
        text = str(payload.get("text", "")).strip()
        if not text:
            raise HTTPException(status_code=400, detail="text is required")

        await _wait_for_codex()
        state_user = user_manager.get(session.user_id)
        if text.startswith("!"):
            workspace = state_user.selected_project_path
            if not workspace and state.command_router is not None:
                effective = state.command_router.projects.resolve_effective_project(session.user_id)
                if isinstance(effective, dict) and isinstance(effective.get("path"), str):
                    workspace = effective["path"]
            output = await run_bang_command(text, workspace)
            return {
                "ok": True,
                "local_command": True,
                "thread_id": state_user.active_thread_id,
                "workspace": resolve_command_cwd(workspace),
                "output": output,
            }

        thread_id = str(payload.get("thread_id", "")).strip() or state_user.active_thread_id

        if not thread_id:
            await state.command_router.route("/start", [], session.user_id)
            state_user = user_manager.get(session.user_id)
            thread_id = state_user.active_thread_id

        if not thread_id:
            raise HTTPException(status_code=500, detail="failed to create or resolve active thread")

        if state_user.active_thread_id != thread_id:
            await state.command_router.route("/resume", [thread_id], session.user_id)
            state_user = user_manager.get(session.user_id)

        if state_user.active_turn_id:
            raise HTTPException(status_code=409, detail="a turn is already running")

        reviewer_settings = get_reviewer_settings()
        reviewer_enabled = bool(reviewer_settings.get("enabled", False))
        if reviewer_enabled:
            state_user.set_validation_session(
                thread_id,
                text,
                int(reviewer_settings.get("max_attempts", 1)),
                int(reviewer_settings.get("recent_turn_pairs", 3)),
            )
        else:
            state_user.clear_validation_session()

        result = await state.codex_client.call(
            "turn/start",
            {
                "threadId": thread_id,
                "input": [{"type": "text", "text": text}],
            },
        )
        turn = result.get("turn", {}) if isinstance(result, dict) else {}
        turn_id = turn.get("id") if isinstance(turn, dict) else None
        if isinstance(turn_id, str) and turn_id:
            state_user.set_turn(turn_id)
            if state_user.validation_session is not None:
                state_user.validation_session.set_turn(turn_id)

        await event_hub.publish_event(
            session.user_id,
            {
                "type": "user_message",
                "thread_id": thread_id,
                "text": text,
            },
        )
        return {
            "ok": True,
            "thread_id": thread_id,
            "turn_id": turn_id,
        }

    @app.get("/api/threads/read")
    async def read_thread(request: Request, thread_id: str) -> dict[str, Any]:
        session = await _session_from_request(request)
        if not thread_id.strip():
            raise HTTPException(status_code=400, detail="thread_id is required")
        await _wait_for_codex()
        result = await state.codex_client.call("thread/read", {"threadId": thread_id.strip(), "includeTurns": True})
        thread = result.get("thread", {}) if isinstance(result, dict) else {}
        turns = _thread_turns(result if isinstance(result, dict) else {}, thread if isinstance(thread, dict) else {})
        messages = _thread_turn_messages(turns)
        if not messages:
            summary = await _route("/read", [thread_id.strip()], session.user_id)
            return {
                **summary,
                "messages": [{"role": "assistant", "text": summary.get("text", "")}],
            }
        return {
            "ok": True,
            "thread_id": thread_id.strip(),
            "messages": messages,
        }

    @app.get("/api/projects")
    async def list_projects(request: Request) -> dict[str, Any]:
        session = await _session_from_request(request)
        return await _route("/projects", ["--list"], session.user_id)

    @app.post("/api/projects")
    async def add_project(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        session = await _session_from_request(request)
        key = str(payload.get("key", "")).strip()
        name = str(payload.get("name", "")).strip()
        path = str(payload.get("path", "")).strip()
        if not key or not name or not path:
            raise HTTPException(status_code=400, detail="key, name, path are required")
        try:
            save_project_profile(key, name, path)
            reload()
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return await _route("/projects", ["--list"], session.user_id)

    @app.post("/api/projects/select")
    async def select_project(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        session = await _session_from_request(request)
        target = str(payload.get("target", "")).strip()
        if not target:
            raise HTTPException(status_code=400, detail="target is required")
        return await _route("/project", [target], session.user_id)

    @app.get("/api/features")
    async def list_features(request: Request) -> dict[str, Any]:
        session = await _session_from_request(request)
        return await _route("/features", [], session.user_id)

    @app.post("/api/features/{feature_key}")
    async def set_feature(feature_key: str, payload: dict[str, Any], request: Request) -> dict[str, Any]:
        session = await _session_from_request(request)
        enabled = bool(payload.get("enabled", False))
        ok, error = await _run_local_feature_toggle(feature_key, enabled)
        if not ok:
            raise HTTPException(status_code=500, detail=error)
        return await _route("/features", [], session.user_id)

    @app.get("/api/guardian")
    async def get_guardian(request: Request) -> dict[str, Any]:
        await _session_from_request(request)
        return get_guardian_settings()

    @app.post("/api/guardian")
    async def set_guardian(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        await _session_from_request(request)
        return save_guardian_settings(
            enabled=bool(payload.get("enabled", False)),
            timeout_seconds=int(payload.get("timeout_seconds", 20)),
            failure_policy=str(payload.get("failure_policy", "manual_fallback")),
            explainability=str(payload.get("explainability", "full_chain")),
        )

    @app.get("/api/reviewer")
    async def get_reviewer(request: Request) -> dict[str, Any]:
        await _session_from_request(request)
        return get_reviewer_settings()

    @app.post("/api/reviewer")
    async def set_reviewer(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        await _session_from_request(request)
        return save_reviewer_settings(
            enabled=bool(payload.get("enabled", False)),
            max_attempts=int(payload.get("max_attempts", 1)),
            timeout_seconds=int(payload.get("timeout_seconds", 8)),
            recent_turn_pairs=int(payload.get("recent_turn_pairs", 3)),
        )

    @app.get("/api/models")
    async def models(request: Request) -> dict[str, Any]:
        session = await _session_from_request(request)
        return await _route("/models", [], session.user_id)

    @app.get("/api/modes")
    async def modes(request: Request) -> dict[str, Any]:
        session = await _session_from_request(request)
        return await _route("/modes", [], session.user_id)

    @app.get("/api/skills")
    async def skills(request: Request) -> dict[str, Any]:
        session = await _session_from_request(request)
        return await _route("/skills", [], session.user_id)

    @app.get("/api/apps")
    async def apps(request: Request) -> dict[str, Any]:
        session = await _session_from_request(request)
        return await _route("/apps", [], session.user_id)

    @app.get("/api/mcp")
    async def mcp(request: Request) -> dict[str, Any]:
        session = await _session_from_request(request)
        return await _route("/mcp", [], session.user_id)

    @app.get("/api/config")
    async def config_read(request: Request) -> dict[str, Any]:
        session = await _session_from_request(request)
        return await _route("/config", [], session.user_id)

    @app.get("/api/session/summary")
    async def session_summary(request: Request) -> dict[str, Any]:
        session = await _session_from_request(request)
        await _wait_for_codex()
        state_user = user_manager.get(session.user_id)
        workspace = state_user.selected_project_path
        project_key = state_user.selected_project_key
        if (not workspace or not project_key) and state.command_router is not None:
            effective = state.command_router.projects.resolve_effective_project(session.user_id)
            if isinstance(effective, dict):
                if not workspace and isinstance(effective.get("path"), str):
                    workspace = effective["path"]
                if not project_key and isinstance(effective.get("key"), str):
                    project_key = effective["key"]
        guardian = get_guardian_settings()
        reviewer = get_reviewer_settings()
        agents = [
            {"name": "default", "enabled": True, "toggleable": False, "configurable": False},
            {"name": "guardian", "enabled": bool(guardian.get("enabled", False)), "toggleable": True, "configurable": True},
            {"name": "reviewer", "enabled": bool(reviewer.get("enabled", False)), "toggleable": True, "configurable": True},
        ]
        return {
            "active_thread_id": state_user.active_thread_id,
            "active_turn_id": state_user.active_turn_id,
            "workspace": workspace,
            "project_key": project_key,
            "agents": agents,
        }

    @app.get("/api/workspace/suggestions")
    async def workspace_suggestions(
        request: Request,
        prefix: str = "",
        limit: int = 200,
    ) -> dict[str, Any]:
        session = await _session_from_request(request)
        await _wait_for_codex()
        state_user = user_manager.get(session.user_id)

        workspace = state_user.selected_project_path
        if not workspace and state.command_router is not None:
            effective = state.command_router.projects.resolve_effective_project(session.user_id)
            if effective and isinstance(effective.get("path"), str):
                workspace = effective["path"]
        if not workspace:
            raise HTTPException(status_code=400, detail="No active workspace is selected")
        if not os.path.isdir(workspace):
            raise HTTPException(status_code=400, detail="Workspace path does not exist")

        safe_limit = max(1, min(1000, limit))
        items = _workspace_suggestions(workspace, prefix, safe_limit)
        return {
            "workspace": workspace,
            "items": items,
        }

    @app.post("/api/command")
    async def run_command(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        session = await _session_from_request(request)
        command_line = str(payload.get("command_line", "")).strip()
        if not command_line:
            raise HTTPException(status_code=400, detail="command_line is required")
        try:
            parts = shlex.split(command_line)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=f"invalid command_line: {exc}") from exc
        if not parts:
            raise HTTPException(status_code=400, detail="command_line is empty")
        command = parts[0]
        args = parts[1:]
        if not command.startswith("/"):
            raise HTTPException(status_code=400, detail="command must start with '/'")
        return await _route(command, args, session.user_id)

    @app.exception_handler(HTTPException)
    async def http_exception_handler(_request: Request, exc: HTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    return app
