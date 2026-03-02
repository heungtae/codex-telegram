import os
import re
import tomllib
from pathlib import Path
from typing import Any

_config: dict[str, Any] | None = None

DEFAULT_CONFIG = """project = "default"

[projects.default]
name = "codex-telegram"
path = "/path/to/your/project"

[bot]
token = "TELEGRAM_BOT_TOKEN"
drop_pending_updates = true
conflict_action = "prompt"

[codex]
command = "codex"
args = ["app-server"]

[users]
allowed_ids = []

[approval]
mode = "interactive"
auto_response = "approve"

[logging]
level = "INFO"

[forwarding]
app_server_event_level = "INFO"
app_server_event_allowlist = []
app_server_event_denylist = []

[display]
max_message_length = 4000
send_progress = true
"""

def _get_config_path() -> Path:
    config_dir = Path.home() / ".config" / "codex-telegram"
    return config_dir / "conf.toml"


def get_config_path() -> Path:
    return _get_config_path()


def _ensure_config_exists():
    config_path = _get_config_path()
    if not config_path.exists():
        config_path.parent.mkdir(parents=True, exist_ok=True)
        config_path.write_text(DEFAULT_CONFIG)


def _resolve_env_vars(value: Any) -> Any:
    if isinstance(value, str):
        env_key = value.strip()
        if env_key in os.environ:
            return os.environ[env_key]
        return value
    elif isinstance(value, list):
        return [_resolve_env_vars(item) for item in value]
    elif isinstance(value, dict):
        return {k: _resolve_env_vars(v) for k, v in value.items()}
    return value


def load(path: str = None) -> dict[str, Any]:
    global _config
    if _config is not None:
        return _config

    _ensure_config_exists()
    config_path = _get_config_path()
    
    with open(config_path, "rb") as f:
        raw_config = tomllib.load(f)
    
    _config = _resolve_env_vars(raw_config)
    return _config


def reload() -> dict[str, Any]:
    global _config
    _config = None
    return load()


def get(key: str, default: Any = None) -> Any:
    config = load()
    keys = key.split(".")
    value = config
    for k in keys:
        if isinstance(value, dict):
            value = value.get(k)
        else:
            return default
        if value is None:
            return default
    return value


def _escape_toml_string(value: str) -> str:
    return value.replace("\\", "\\\\").replace("\"", "\\\"")


def save_project_profile(key: str, name: str, path: str) -> None:
    if not re.fullmatch(r"[A-Za-z0-9_-]+", key):
        raise ValueError("Invalid project key. Use letters, numbers, '_' or '-'.")
    if not name.strip():
        raise ValueError("Project name must not be empty.")
    if not path.strip():
        raise ValueError("Project path must not be empty.")

    _ensure_config_exists()
    config_path = _get_config_path()
    raw = config_path.read_text(encoding="utf-8")
    parsed = tomllib.loads(raw) if raw.strip() else {}

    projects = parsed.get("projects")
    if isinstance(projects, dict) and key in projects:
        raise ValueError(f"Project key '{key}' already exists.")

    updated = raw
    if "project" not in parsed:
        updated = f'project = "{_escape_toml_string(key)}"\n\n' + updated.lstrip()

    if updated and not updated.endswith("\n"):
        updated += "\n"
    updated += (
        f"\n[projects.{key}]\n"
        f'name = "{_escape_toml_string(name)}"\n'
        f'path = "{_escape_toml_string(path)}"\n'
    )

    config_path.write_text(updated, encoding="utf-8")
