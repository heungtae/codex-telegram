from typing import Any


def normalize_local_mode(raw_mode: str | None) -> str:
    return "plan" if (raw_mode or "").strip().lower() == "plan" else "build"


def codex_mode_name(local_mode: str | None) -> str:
    return "plan" if normalize_local_mode(local_mode) == "plan" else "default"


def _pick_string(value: Any) -> str | None:
    if isinstance(value, str):
        normalized = value.strip()
        if normalized:
            return normalized
    return None


def _get_nested_mapping(raw: Any, *keys: str) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    for key in keys:
        value = raw.get(key)
        if isinstance(value, dict):
            return value
    return None


def list_collaboration_modes(raw: Any) -> list[dict[str, Any]]:
    if isinstance(raw, list):
        return [item for item in raw if isinstance(item, dict)]
    if not isinstance(raw, dict):
        return []
    for key in ("data", "items", "modes", "collaborationModes"):
        value = raw.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
        if isinstance(value, dict):
            nested = list_collaboration_modes(value)
            if nested:
                return nested
    return []


def sanitize_collaboration_mode_mask(raw: Any) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    settings = _get_nested_mapping(raw, "settings", "config", "configuration", "mask")
    name = _pick_string(raw.get("name")) or _pick_string(raw.get("id")) or _pick_string(raw.get("key"))
    mode = _pick_string(raw.get("mode")) or _pick_string((settings or {}).get("mode"))
    model = _pick_string(raw.get("model")) or _pick_string((settings or {}).get("model"))
    reasoning_effort = (
        _pick_string(raw.get("reasoning_effort"))
        or _pick_string(raw.get("reasoningEffort"))
        or _pick_string((settings or {}).get("reasoning_effort"))
        or _pick_string((settings or {}).get("reasoningEffort"))
    )
    if name is None and mode is not None:
        name = mode
    if name is None:
        return None
    return {
        "name": name,
        "mode": mode,
        "model": model,
        "reasoning_effort": reasoning_effort,
    }


def with_collaboration_mode_model(mask: Any, model: str | None) -> dict[str, Any] | None:
    sanitized = sanitize_collaboration_mode_mask(mask)
    fallback_model = _pick_string(model)
    if sanitized is None:
        return None
    if sanitized.get("model") or fallback_model is None:
        return sanitized
    updated = dict(sanitized)
    updated["model"] = fallback_model
    return updated


def find_collaboration_mode_mask(items: Any, target_name: str) -> dict[str, Any] | None:
    normalized_target = target_name.strip().lower()
    sanitized_items: list[dict[str, Any]] = []
    for item in list_collaboration_modes(items):
        sanitized = sanitize_collaboration_mode_mask(item)
        if sanitized is None:
            continue
        sanitized_items.append(sanitized)
        if sanitized["name"].lower() == normalized_target:
            return sanitized
    for sanitized in sanitized_items:
        mode = sanitized.get("mode")
        if isinstance(mode, str) and mode.lower() == normalized_target:
            return sanitized
    return None


def find_collaboration_mode_mask_by_aliases(items: Any, aliases: list[str]) -> dict[str, Any] | None:
    normalized_aliases = [alias.strip().lower() for alias in aliases if isinstance(alias, str) and alias.strip()]
    if not normalized_aliases:
        return None
    sanitized_items: list[dict[str, Any]] = []
    for item in list_collaboration_modes(items):
        sanitized = sanitize_collaboration_mode_mask(item)
        if sanitized is None:
            continue
        sanitized_items.append(sanitized)
        if sanitized["name"].lower() in normalized_aliases:
            return sanitized
    for sanitized in sanitized_items:
        mode = sanitized.get("mode")
        if isinstance(mode, str) and mode.lower() in normalized_aliases:
            return sanitized
    return None


def build_turn_collaboration_mode(mask: Any, fallback_mode: str) -> dict[str, Any] | None:
    sanitized = sanitize_collaboration_mode_mask(mask)
    if sanitized is None:
        return None
    mode = sanitized.get("mode") or fallback_mode
    model = sanitized.get("model")
    if mode not in {"plan", "default"} or not isinstance(model, str) or not model:
        return None
    return {
        "mode": mode,
        "settings": {
            "model": model,
            "reasoning_effort": sanitized.get("reasoning_effort"),
            "developer_instructions": None,
        },
    }
