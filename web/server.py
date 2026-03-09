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

from models import state
from models.user import user_manager
from utils.config import (
    get,
    get_guardian_settings,
    get_web_password,
    reload,
    save_guardian_settings,
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
        if safe_offset:
            rows = rows[safe_offset:]
        rows = rows[:safe_limit]
        state_user = user_manager.get(session.user_id)
        items: list[dict[str, Any]] = []
        for thread in rows:
            if not isinstance(thread, dict):
                continue
            tid = thread.get("id")
            if not isinstance(tid, str) or not tid:
                continue
            items.append(
                {
                    "id": tid,
                    "title": _thread_title(thread),
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
        return await _route("/read", [thread_id.strip()], session.user_id)

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
            timeout_seconds=int(payload.get("timeout_seconds", 8)),
            failure_policy=str(payload.get("failure_policy", "manual_fallback")),
            explainability=str(payload.get("explainability", "full_chain")),
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
        agents = [
            {"name": "default", "enabled": True},
            {"name": "guardian", "enabled": bool(guardian.get("enabled", False))},
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
