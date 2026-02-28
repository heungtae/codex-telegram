import os
import tomllib
from pathlib import Path
from typing import Any

_config: dict[str, Any] | None = None

DEFAULT_CONFIG = """[bot]
token = "TELEGRAM_BOT_TOKEN"

[codex]
command = "codex"
args = ["app-server"]

[users]
allowed_ids = []

[approval]
require_for = ["file_write", "command_exec", "tool_use"]
auto_approve_trusted = false

[logging]
level = "INFO"

[display]
max_message_length = 4000
send_progress = true
"""

def _get_config_path() -> Path:
    config_dir = Path.home() / ".config" / "codex-telegram"
    return config_dir / "conf.toml"


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
