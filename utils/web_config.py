import os
import re
import tomllib
from pathlib import Path
from typing import Any, Callable


def resolve_web_password(
    config_path: Path,
    get_value: Callable[[str, Any], Any],
    getenv: Callable[[str, str], str] = os.getenv,
) -> str:
    password_env = str(get_value("web.password_env", "") or "").strip()
    if password_env:
        from_env = getenv(password_env, "")
        if from_env.strip():
            return from_env

    try:
        raw = config_path.read_text(encoding="utf-8")
        parsed = tomllib.loads(raw) if raw.strip() else {}
    except (OSError, tomllib.TOMLDecodeError):
        parsed = {}

    web_section = parsed.get("web") if isinstance(parsed, dict) else {}
    raw_password_env = web_section.get("password_env", "") if isinstance(web_section, dict) else ""
    raw_password_env = str(raw_password_env or "").strip()
    if raw_password_env:
        from_env = getenv(raw_password_env, "")
        if from_env.strip():
            return from_env

    if password_env and not re.fullmatch(r"[A-Z_][A-Z0-9_]*", password_env):
        return password_env

    configured = str(get_value("web.password", "") or "").strip()
    if configured.startswith("env:"):
        env_key = configured[4:].strip()
        if env_key:
            return str(getenv(env_key, "") or "").strip()
        return ""
    return configured
