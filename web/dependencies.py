import asyncio
from pathlib import Path
from typing import Any

from fastapi import HTTPException, Request

from codex.collaboration_mode import (
    build_turn_collaboration_mode,
    codex_mode_name,
    find_collaboration_mode_mask,
    with_collaboration_mode_model,
)
from models import state
from web.runtime import session_manager

COOKIE_NAME = "codex_web_session"
STATIC_DIR = Path(__file__).resolve().parent / "static"
FRONTEND_DIST_DIR = STATIC_DIR / "dist"
FRONTEND_INDEX_HTML_PATH = FRONTEND_DIST_DIR / "index.html"


def resolved_assets_dir() -> Path:
    return FRONTEND_DIST_DIR


def resolved_index_html_path() -> Path:
    return FRONTEND_INDEX_HTML_PATH


async def resolve_default_model() -> str | None:
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


async def resolve_turn_collaboration_mode(state_user) -> dict[str, Any] | None:
    target_mode = codex_mode_name(state_user.collaboration_mode)
    payload = build_turn_collaboration_mode(state_user.collaboration_mode_mask, target_mode)
    if payload is not None:
        return payload
    if state.codex_client is None:
        return None
    result = await state.codex_client.call("collaborationMode/list")
    mask = find_collaboration_mode_mask(result, target_mode)
    if mask is not None and not mask.get("model"):
        fallback_model = await resolve_default_model()
        mask = with_collaboration_mode_model(mask, fallback_model)
    state_user.set_collaboration_mode_mask(mask)
    return build_turn_collaboration_mode(mask, target_mode)


def mode_label(local_mode: str | None) -> str:
    return "plan" if (local_mode or "").strip().lower() == "plan" else "build"


async def require_turn_collaboration_mode(state_user) -> dict[str, Any]:
    payload = await resolve_turn_collaboration_mode(state_user)
    if payload is None:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to resolve collaboration mode payload for {mode_label(state_user.collaboration_mode)}. Turn was not started.",
        )
    return payload


async def wait_for_codex() -> None:
    while not state.codex_ready.is_set():
        await asyncio.sleep(0.05)
    if state.codex_client is None or state.command_router is None:
        raise HTTPException(status_code=503, detail="Codex runtime is not ready.")


async def session_from_request(request: Request):
    token = request.cookies.get(COOKIE_NAME)
    session = await session_manager.get(token)
    if session is None:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return session


async def route_command(command: str, args: list[str], user_id: int) -> dict[str, Any]:
    await wait_for_codex()
    result = await state.command_router.route(command, args, user_id)
    return {
        "kind": result.kind,
        "text": result.text,
        "meta": result.meta,
    }
