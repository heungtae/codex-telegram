import asyncio
import json
import logging
import shlex
from importlib import import_module
from typing import Any

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse

from codex import CodexError
from codex.collaboration_mode import codex_mode_name
from models import state
from models.user import user_manager
from utils.config import get, get_web_password, reload, save_project_profile
from utils.local_command import resolve_command_cwd
from utils.normalize import clamp_int, parse_bool
from web.dependencies import (
    COOKIE_NAME,
    mode_label,
    require_turn_collaboration_mode,
    resolved_index_html_path,
    route_command,
    session_from_request,
    wait_for_codex,
)
from web.runtime import event_hub, session_manager
from web.thread_history import (
    clip_thread_label,
    thread_profile_key,
    thread_title,
    thread_turn_messages,
    thread_turns,
    thread_user_request_excerpt,
)
from web.workspace import (
    git_is_repo,
    read_text_file,
    resolve_workspace_for_context,
    resolve_workspace_path,
    workspace_file_diff,
    workspace_git_status,
    workspace_suggestions,
    workspace_tree_items,
)

logger = logging.getLogger("codex-telegram.web")


def _server_binding(name: str):
    server_module = import_module("web.server")
    return getattr(server_module, name)


def _resolved_logging_level() -> str:
    raw = get("logging.level", None)
    if not isinstance(raw, str) or not raw.strip():
        fallback = get("logging", "INFO")
        raw = fallback if isinstance(fallback, str) else "INFO"
    return str(raw).strip().upper() or "INFO"


def _resolved_threads_list_limit() -> int:
    raw = get("display.threads_list_limit", 20)
    try:
        return max(1, min(100, int(raw)))
    except (TypeError, ValueError):
        return 20


def _project_items_for_user(user_id: int) -> list[dict[str, Any]]:
    if state.command_router is None or not hasattr(state.command_router, "projects"):
        return []
    loader = getattr(state.command_router.projects, "load_project_profiles", None)
    if not callable(loader):
        return []
    profiles, default_key = loader()
    state_user = user_manager.get(user_id)
    items: list[dict[str, Any]] = []
    for profile in profiles:
        key = profile.get("key")
        name = profile.get("name")
        path = profile.get("path")
        if not isinstance(key, str) or not isinstance(name, str) or not isinstance(path, str):
            continue
        items.append(
            {
                "key": key,
                "name": name,
                "path": path,
                "selected": state_user.selected_project_key == key,
                "default": default_key == key,
            }
        )
    return items


def _project_profile_by_key(project_key: str) -> dict[str, str] | None:
    if state.command_router is None or not hasattr(state.command_router, "projects"):
        return None
    loader = getattr(state.command_router.projects, "load_project_profiles", None)
    if not callable(loader):
        return None
    profiles, _default_key = loader()
    for profile in profiles:
        if not isinstance(profile, dict):
            continue
        key = profile.get("key")
        name = profile.get("name")
        path = profile.get("path")
        if (
            key == project_key
            and isinstance(name, str)
            and name
            and isinstance(path, str)
            and path
        ):
            return {"key": key, "name": name, "path": path}
    return None


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


def register_web_routes(app: FastAPI) -> None:
    register_auth_routes(app)
    register_event_routes(app)
    register_approval_routes(app)
    register_thread_routes(app)
    register_project_routes(app)
    register_system_routes(app)
    register_workspace_routes(app)
    register_command_routes(app)
    register_error_handlers(app)


def register_auth_routes(app: FastAPI) -> None:
    @app.get("/")
    async def index() -> HTMLResponse:
        html = resolved_index_html_path().read_text(encoding="utf-8")
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

        ttl = clamp_int(get("web.session_ttl_seconds", 43200), 43200, minimum=60, maximum=604800)
        session = await session_manager.create(username, ttl)
        logging_level = _resolved_logging_level()
        threads_list_limit = _resolved_threads_list_limit()
        response.set_cookie(
            key=COOKIE_NAME,
            value=session.token,
            max_age=ttl,
            httponly=True,
            secure=parse_bool(get("web.cookie_secure", False), False),
            samesite="lax",
        )
        return {
            "username": session.username,
            "user_id": session.user_id,
            "logging_level": logging_level,
            "debug_logging": logging_level == "DEBUG",
            "threads_list_limit": threads_list_limit,
        }

    @app.post("/api/auth/logout")
    async def logout(request: Request, response: Response) -> dict[str, bool]:
        token = request.cookies.get(COOKIE_NAME)
        await session_manager.delete(token)
        response.delete_cookie(COOKIE_NAME)
        return {"ok": True}

    @app.get("/api/auth/me")
    async def me(request: Request) -> dict[str, Any]:
        session = await session_from_request(request)
        logging_level = _resolved_logging_level()
        threads_list_limit = _resolved_threads_list_limit()
        return {
            "username": session.username,
            "user_id": session.user_id,
            "logging_level": logging_level,
            "debug_logging": logging_level == "DEBUG",
            "threads_list_limit": threads_list_limit,
        }


def register_event_routes(app: FastAPI) -> None:
    @app.get("/api/events/stream")
    async def stream(request: Request):
        session = await session_from_request(request)
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


def register_approval_routes(app: FastAPI) -> None:
    @app.get("/api/approvals")
    async def approvals(request: Request) -> dict[str, Any]:
        session = await session_from_request(request)
        pending = await event_hub.list_approvals(session.user_id)
        return {"items": pending}

    @app.post("/api/approvals/{request_id}")
    async def submit_approval(request_id: int, payload: dict[str, Any], request: Request) -> dict[str, Any]:
        session = await session_from_request(request)
        decision = str(payload.get("decision", "")).strip().lower()
        if decision not in {"approve", "session", "deny"}:
            raise HTTPException(status_code=400, detail="decision must be approve|session|deny")

        await wait_for_codex()
        pending = await event_hub.list_approvals(session.user_id)
        thread_id = None
        for item in pending:
            if isinstance(item, dict) and item.get("id") == request_id:
                thread = item.get("thread_id")
                if isinstance(thread, str) and thread:
                    thread_id = thread
                break
        accepted = state.codex_client.submit_approval_decision(request_id, decision, thread_id=thread_id)
        if not accepted:
            raise HTTPException(status_code=404, detail="approval request not found or already handled")

        await event_hub.pop_approval(session.user_id, request_id)
        return {"ok": True, "request_id": request_id, "decision": decision}


def register_thread_routes(app: FastAPI) -> None:
    @app.get("/api/threads")
    async def list_threads(
        request: Request,
        archived: bool = False,
        offset: int = 0,
        limit: int | None = None,
        current_profile: bool = True,
    ) -> dict[str, Any]:
        session = await session_from_request(request)
        resolved_limit = _resolved_threads_list_limit() if limit is None else max(1, min(100, limit))
        args = ["--limit", str(resolved_limit), "--offset", str(max(0, offset))]
        if archived:
            args.append("--archived")
        if current_profile:
            args.append("--current-profile")
        return await route_command("/threads", args, session.user_id)

    @app.get("/api/threads/summaries")
    async def thread_summaries(
        request: Request,
        archived: bool = False,
        offset: int = 0,
        limit: int | None = None,
        project_key: str = "",
    ) -> dict[str, Any]:
        session = await session_from_request(request)
        await wait_for_codex()
        resolved_limit = _resolved_threads_list_limit() if limit is None else limit
        safe_limit = max(1, min(100, resolved_limit))
        safe_offset = max(0, offset)
        params: dict[str, Any] = {"limit": min(100, safe_limit + safe_offset)}
        if archived:
            params["archived"] = True
        result = await state.codex_client.call("thread/list", params)
        rows = result.get("data", [])
        if not isinstance(rows, list):
            rows = []
        state_user = user_manager.get(session.user_id)
        current_profile_key = project_key.strip()
        if not current_profile_key:
            current_profile_key = state_user.selected_project_key or ""
        if not current_profile_key:
            default_key = get("project")
            if isinstance(default_key, str) and default_key.strip():
                current_profile_key = default_key.strip()
        if current_profile_key:
            rows = [
                thread
                for thread in rows
                if isinstance(thread, dict) and thread_profile_key(thread, current_profile_key) == current_profile_key
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
                title = thread_user_request_excerpt(detail, detail_thread if isinstance(detail_thread, dict) else thread)
            if not title:
                title = clip_thread_label(thread_title(thread))
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
        session = await session_from_request(request)
        return await route_command("/start", [], session.user_id)

    @app.post("/api/threads/resume")
    async def resume_thread(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        session = await session_from_request(request)
        thread_id = _required_str(payload, "thread_id")
        return await route_command("/resume", [thread_id], session.user_id)

    @app.post("/api/threads/fork")
    async def fork_thread(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        session = await session_from_request(request)
        thread_id = _required_str(payload, "thread_id")
        return await route_command("/fork", [thread_id], session.user_id)

    @app.post("/api/threads/archive")
    async def archive_thread(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        session = await session_from_request(request)
        thread_id = _required_str(payload, "thread_id")
        return await route_command("/archive", [thread_id], session.user_id)

    @app.post("/api/threads/unarchive")
    async def unarchive_thread(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        session = await session_from_request(request)
        thread_id = _required_str(payload, "thread_id")
        return await route_command("/unarchive", [thread_id], session.user_id)

    @app.post("/api/threads/compact")
    async def compact_thread(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        session = await session_from_request(request)
        thread_id = _required_str(payload, "thread_id")
        return await route_command("/compact", [thread_id], session.user_id)

    @app.post("/api/threads/rollback")
    async def rollback_thread(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        session = await session_from_request(request)
        turns = payload.get("turns")
        if not isinstance(turns, int) or turns <= 0:
            raise HTTPException(status_code=400, detail="turns must be a positive integer")
        return await route_command("/rollback", [str(turns)], session.user_id)

    @app.post("/api/threads/interrupt")
    async def interrupt_thread(request: Request, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        session = await session_from_request(request)
        target_thread_id = str((payload or {}).get("thread_id", "")).strip()
        args = [target_thread_id] if target_thread_id else []
        return await route_command("/interrupt", args, session.user_id)

    @app.post("/api/chat/messages")
    async def send_message(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        session = await session_from_request(request)
        text = _required_str(payload, "text")

        await wait_for_codex()
        state_user = user_manager.get(session.user_id)
        payload_thread_id = str(payload.get("thread_id", "")).strip()
        payload_project_key = str(payload.get("project_key", "")).strip()
        if text.startswith("!"):
            workspace = resolve_workspace_for_context(
                session.user_id,
                thread_id=payload_thread_id or None,
                project_key=payload_project_key or None,
                ensure_exists=False,
            )
            output = await _server_binding("run_bang_command")(text, workspace)
            return {
                "ok": True,
                "local_command": True,
                "thread_id": payload_thread_id or state_user.active_thread_id,
                "workspace": resolve_command_cwd(workspace),
                "output": output,
            }

        thread_id = payload_thread_id or state_user.active_thread_id

        async def start_thread_for_context() -> str:
            start_params: dict[str, Any] = {}
            if payload_project_key:
                project = _project_profile_by_key(payload_project_key)
                if project is None:
                    raise HTTPException(status_code=404, detail="project_key was not found")
                start_params["cwd"] = project["path"]
            start_result = await state.codex_client.call("thread/start", start_params)
            started_thread = (start_result.get("thread") or {}).get("id") if isinstance(start_result, dict) else None
            if isinstance(started_thread, str) and started_thread:
                user_manager.bind_thread_owner(session.user_id, started_thread)
                if payload_project_key:
                    user_manager.bind_thread_project(started_thread, payload_project_key)
                return started_thread
            await state.command_router.route("/start", [], session.user_id)
            refreshed_state_user = user_manager.get(session.user_id)
            fallback_thread_id = refreshed_state_user.active_thread_id
            if not fallback_thread_id:
                raise HTTPException(status_code=500, detail="failed to create or resolve active thread")
            return fallback_thread_id

        if not thread_id:
            thread_id = await start_thread_for_context()
        if not thread_id:
            raise HTTPException(status_code=500, detail="failed to create or resolve active thread")

        if payload_project_key:
            user_manager.bind_thread_project(thread_id, payload_project_key)
        user_manager.bind_thread_owner(session.user_id, thread_id)

        params = {
            "threadId": thread_id,
            "input": [{"type": "text", "text": text}],
        }
        collaboration_mode = await require_turn_collaboration_mode(state_user)
        params["collaborationMode"] = collaboration_mode
        logger.info(
            "Starting Web turn user_id=%s thread_id=%s local_mode=%s target_codex_mode=%s collaboration_payload=%s",
            session.user_id,
            thread_id,
            state_user.collaboration_mode,
            codex_mode_name(state_user.collaboration_mode),
            collaboration_mode,
        )
        try:
            result = await state.codex_client.call("turn/start", params)
        except CodexError as exc:
            if (
                exc.code == -32600
                and "thread not found" in str(exc.message or "").lower()
                and payload_thread_id
            ):
                resumed_existing_thread = False
                try:
                    await state.codex_client.call("thread/resume", {"threadId": payload_thread_id})
                    thread_id = payload_thread_id
                    user_manager.set_active_thread(session.user_id, thread_id, project_key=payload_project_key or None)
                    if payload_project_key:
                        user_manager.bind_thread_project(thread_id, payload_project_key)
                    user_manager.bind_thread_owner(session.user_id, thread_id)
                    params["threadId"] = thread_id
                    result = await state.codex_client.call("turn/start", params)
                    resumed_existing_thread = True
                except CodexError:
                    resumed_existing_thread = False
                if not resumed_existing_thread:
                    thread_id = await start_thread_for_context()
                    if payload_project_key:
                        user_manager.bind_thread_project(thread_id, payload_project_key)
                    user_manager.bind_thread_owner(session.user_id, thread_id)
                    params["threadId"] = thread_id
                    result = await state.codex_client.call("turn/start", params)
            else:
                raise
        turn = result.get("turn", {}) if isinstance(result, dict) else {}
        turn_id = turn.get("id") if isinstance(turn, dict) else None
        if isinstance(turn_id, str) and turn_id:
            state_user.set_turn(turn_id, thread_id)
            user_manager.bind_turn(session.user_id, turn_id, thread_id)

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
        session = await session_from_request(request)
        normalized_thread_id = thread_id.strip()
        if not normalized_thread_id:
            raise HTTPException(status_code=400, detail="thread_id is required")
        user_manager.bind_thread_subscriber(session.user_id, normalized_thread_id)
        user_manager.set_active_thread(
            session.user_id,
            normalized_thread_id,
            project_key=user_manager.get_thread_project(normalized_thread_id),
        )
        await wait_for_codex()
        try:
            result = await state.codex_client.call(
                "thread/read", {"threadId": normalized_thread_id, "includeTurns": True}
            )
        except CodexError as exc:
            # Freshly created threads can reject includeTurns before first user input.
            if exc.code == -32600 and "includeTurns is unavailable before first user message" in exc.message:
                result = {"thread": {"id": normalized_thread_id}, "turns": []}
            else:
                raise
        thread = result.get("thread", {}) if isinstance(result, dict) else {}
        turns = thread_turns(result if isinstance(result, dict) else {}, thread if isinstance(thread, dict) else {})
        messages = thread_turn_messages(turns, normalized_thread_id)
        if not messages:
            summary = await route_command("/read", [normalized_thread_id], session.user_id)
            return {
                **summary,
                "messages": [{"role": "assistant", "text": summary.get("text", "")}],
            }
        return {
            "ok": True,
            "thread_id": normalized_thread_id,
            "messages": messages,
        }


def register_project_routes(app: FastAPI) -> None:
    @app.get("/api/projects")
    async def list_projects(request: Request) -> dict[str, Any]:
        session = await session_from_request(request)
        result = await route_command("/projects", ["--list"], session.user_id)
        result["items"] = _project_items_for_user(session.user_id)
        return result

    @app.post("/api/projects")
    async def add_project(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        session = await session_from_request(request)
        key = _required_str(payload, "key")
        name = _required_str(payload, "name")
        path = _required_str(payload, "path")
        try:
            save_project_profile(key, name, path)
            reload()
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return await route_command("/projects", ["--list"], session.user_id)

    @app.post("/api/projects/select")
    async def select_project(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        session = await session_from_request(request)
        target = _required_str(payload, "target")
        state_user = user_manager.get(session.user_id)
        if state_user.active_turn_id:
            raise HTTPException(status_code=409, detail="Cannot switch project while a turn is running.")
        return await route_command("/project", [target], session.user_id)

    @app.post("/api/projects/open-thread")
    async def open_project_thread(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        session = await session_from_request(request)
        project_key = _required_str(payload, "project_key")
        await wait_for_codex()
        project = _project_profile_by_key(project_key)
        if project is None:
            raise HTTPException(status_code=404, detail="project_key was not found")

        result = await state.codex_client.call("thread/start", {"cwd": project["path"]})
        thread = result.get("thread", {}) if isinstance(result, dict) else {}
        thread_id = thread.get("id") if isinstance(thread, dict) else None
        if not isinstance(thread_id, str) or not thread_id:
            raise HTTPException(status_code=502, detail="failed to open thread for project")

        user_manager.bind_thread_owner(session.user_id, thread_id)
        user_manager.bind_thread_project(thread_id, project["key"])
        return {
            "thread_id": thread_id,
            "project_key": project["key"],
            "project_name": project["name"],
            "workspace": project["path"],
        }


def register_system_routes(app: FastAPI) -> None:
    @app.get("/api/features")
    async def list_features(request: Request) -> dict[str, Any]:
        session = await session_from_request(request)
        return await route_command("/features", [], session.user_id)

    @app.post("/api/features/{feature_key}")
    async def set_feature(feature_key: str, payload: dict[str, Any], request: Request) -> dict[str, Any]:
        session = await session_from_request(request)
        enabled = bool(payload.get("enabled", False))
        ok, error = await _run_local_feature_toggle(feature_key, enabled)
        if not ok:
            raise HTTPException(status_code=500, detail=error)
        return await route_command("/features", [], session.user_id)

    @app.get("/api/guardian")
    async def get_guardian(request: Request) -> dict[str, Any]:
        await session_from_request(request)
        return _server_binding("get_guardian_settings")()

    @app.post("/api/guardian")
    async def set_guardian(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        await session_from_request(request)
        try:
            return _server_binding("save_guardian_settings")(
                enabled=bool(payload.get("enabled", False)),
                timeout_seconds=int(payload.get("timeout_seconds", 20)),
                failure_policy=str(payload.get("failure_policy", "manual_fallback")),
                explainability=str(payload.get("explainability", "decision_only")),
                rules=payload.get("rules"),
                rules_toml=payload.get("rules_toml"),
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    for path, command in (
        ("/api/models", "/models"),
        ("/api/modes", "/collab"),
        ("/api/collab", "/collab"),
        ("/api/skills", "/skills"),
        ("/api/apps", "/apps"),
        ("/api/mcp", "/mcp"),
        ("/api/config", "/config"),
    ):
        _register_command_get(app, path, command)

    @app.get("/api/session/summary")
    async def session_summary(request: Request) -> dict[str, Any]:
        session = await session_from_request(request)
        await wait_for_codex()
        state_user = user_manager.get(session.user_id)
        active_subagents = await event_hub.list_active_subagents(session.user_id)
        workspace = state_user.selected_project_path
        project_key = state_user.selected_project_key
        project_name = state_user.selected_project_name
        if not project_name and state.command_router is not None and project_key:
            for item in _project_items_for_user(session.user_id):
                if item.get("key") == project_key and isinstance(item.get("name"), str):
                    project_name = item["name"]
                    break
        if (not workspace or not project_key or not project_name) and state.command_router is not None:
            effective = state.command_router.projects.resolve_effective_project(session.user_id)
            if isinstance(effective, dict):
                if not workspace and isinstance(effective.get("path"), str):
                    workspace = effective["path"]
                if not project_key and isinstance(effective.get("key"), str):
                    project_key = effective["key"]
                if not project_name and isinstance(effective.get("name"), str):
                    project_name = effective["name"]
        guardian = _server_binding("get_guardian_settings")()
        agents = [
            {"name": "default", "enabled": True, "toggleable": False, "configurable": False},
            {"name": "guardian", "enabled": bool(guardian.get("enabled", False)), "toggleable": True, "configurable": True},
        ]
        return {
            "active_thread_id": state_user.active_thread_id,
            "active_turn_id": state_user.active_turn_id,
            "collaboration_mode": mode_label(state_user.collaboration_mode),
            "workspace": workspace,
            "project_key": project_key,
            "project_name": project_name,
            "agents": agents,
            "active_subagents": active_subagents,
        }


def register_workspace_routes(app: FastAPI) -> None:
    @app.get("/api/workspace/tree")
    async def workspace_tree(
        request: Request,
        path: str = "",
        depth: int = 1,
        thread_id: str = "",
        project_key: str = "",
    ) -> dict[str, Any]:
        session = await session_from_request(request)
        await wait_for_codex()
        workspace = resolve_workspace_for_context(
            session.user_id,
            thread_id=thread_id.strip() or None,
            project_key=project_key.strip() or None,
        )
        rel_path, _target = resolve_workspace_path(workspace, path, expect_dir=True)
        items = workspace_tree_items(workspace, rel_path, depth)
        return {
            "workspace": workspace,
            "path": rel_path,
            "items": items,
        }

    @app.get("/api/workspace/status")
    async def workspace_status(request: Request, thread_id: str = "", project_key: str = "") -> dict[str, Any]:
        session = await session_from_request(request)
        await wait_for_codex()
        workspace = resolve_workspace_for_context(
            session.user_id,
            thread_id=thread_id.strip() or None,
            project_key=project_key.strip() or None,
        )
        is_git = await git_is_repo(workspace)
        items = await workspace_git_status(workspace)
        return {
            "workspace": workspace,
            "is_git": is_git,
            "items": items,
        }

    @app.get("/api/workspace/file")
    async def workspace_file(request: Request, path: str, thread_id: str = "", project_key: str = "") -> dict[str, Any]:
        session = await session_from_request(request)
        await wait_for_codex()
        workspace = resolve_workspace_for_context(
            session.user_id,
            thread_id=thread_id.strip() or None,
            project_key=project_key.strip() or None,
        )
        rel_path, abs_path = resolve_workspace_path(workspace, path, expect_dir=False)
        content, is_binary, truncated = read_text_file(abs_path)
        return {
            "workspace": workspace,
            "path": rel_path,
            "content": content,
            "is_binary": is_binary,
            "truncated": truncated,
            "preview_available": not is_binary,
        }

    @app.get("/api/workspace/diff")
    async def workspace_diff(request: Request, path: str, thread_id: str = "", project_key: str = "") -> dict[str, Any]:
        session = await session_from_request(request)
        await wait_for_codex()
        workspace = resolve_workspace_for_context(
            session.user_id,
            thread_id=thread_id.strip() or None,
            project_key=project_key.strip() or None,
        )
        rel_path, abs_path = resolve_workspace_path(workspace, path, allow_missing=True)
        is_git = await git_is_repo(workspace)
        diff, status = await workspace_file_diff(workspace, rel_path, abs_path)
        return {
            "workspace": workspace,
            "path": rel_path,
            "status": status,
            "diff": diff,
            "has_diff": bool(diff),
            "is_git": is_git,
        }

    @app.get("/api/workspace/suggestions")
    async def workspace_suggestions_route(
        request: Request,
        prefix: str = "",
        limit: int = 200,
        thread_id: str = "",
        project_key: str = "",
    ) -> dict[str, Any]:
        session = await session_from_request(request)
        await wait_for_codex()
        workspace = resolve_workspace_for_context(
            session.user_id,
            thread_id=thread_id.strip() or None,
            project_key=project_key.strip() or None,
        )
        items = workspace_suggestions(workspace, prefix, max(1, min(1000, limit)))
        return {
            "workspace": workspace,
            "items": items,
        }


def register_command_routes(app: FastAPI) -> None:
    @app.post("/api/command")
    async def run_command(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        session = await session_from_request(request)
        command_line = _required_str(payload, "command_line")
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
        return await route_command(command, args, session.user_id)


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(HTTPException)
    async def http_exception_handler(_request: Request, exc: HTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


def _required_str(payload: dict[str, Any], key: str) -> str:
    value = str(payload.get(key, "")).strip()
    if not value:
        raise HTTPException(status_code=400, detail=f"{key} is required")
    return value


def _register_command_get(app: FastAPI, path: str, command: str) -> None:
    @app.get(path)
    async def _command_endpoint(request: Request) -> dict[str, Any]:
        session = await session_from_request(request)
        return await route_command(command, [], session.user_id)
