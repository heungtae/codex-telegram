import tomllib
from pathlib import Path
from typing import Any

_config: dict[str, Any] | None = None


def load(path: str = "conf.toml") -> dict[str, Any]:
    global _config
    if _config is not None:
        return _config

    config_path = Path(__file__).parent.parent / path
    with open(config_path, "rb") as f:
        _config = tomllib.load(f)
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
