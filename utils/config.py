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

[approval.guardian]
enabled = false
timeout_seconds = 8
failure_policy = "manual_fallback"
explainability = "full_chain"
apply_to_methods = ["*"]

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


GUARDIAN_TIMEOUT_CHOICES = [3, 8, 20]
GUARDIAN_FAILURE_POLICIES = {"manual_fallback", "deny", "approve", "session"}
GUARDIAN_EXPLAINABILITY_LEVELS = {"decision_only", "summary", "full_chain"}


def _normalize_guardian_enabled(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value != 0
    if isinstance(value, str):
        raw = value.strip().lower()
        if raw in {"1", "true", "yes", "on"}:
            return True
        if raw in {"0", "false", "no", "off"}:
            return False
    return default


def _normalize_guardian_timeout(value: Any, default: int = 8) -> int:
    if isinstance(value, bool):
        return default
    if isinstance(value, int):
        return value if value > 0 else default
    if isinstance(value, str) and value.strip().isdigit():
        parsed = int(value.strip())
        return parsed if parsed > 0 else default
    return default


def _normalize_guardian_failure_policy(value: Any, default: str = "manual_fallback") -> str:
    raw = str(value or "").strip().lower()
    if raw in GUARDIAN_FAILURE_POLICIES:
        return raw
    return default


def _normalize_guardian_explainability(value: Any, default: str = "full_chain") -> str:
    raw = str(value or "").strip().lower()
    if raw in GUARDIAN_EXPLAINABILITY_LEVELS:
        return raw
    return default


def get_guardian_settings() -> dict[str, Any]:
    guardian_raw = get("approval.guardian", {})
    guardian = guardian_raw if isinstance(guardian_raw, dict) else {}
    enabled = _normalize_guardian_enabled(guardian.get("enabled"), default=False)
    timeout_seconds = _normalize_guardian_timeout(guardian.get("timeout_seconds"), default=8)
    failure_policy = _normalize_guardian_failure_policy(guardian.get("failure_policy"), default="manual_fallback")
    explainability = _normalize_guardian_explainability(guardian.get("explainability"), default="full_chain")

    methods_raw = guardian.get("apply_to_methods", ["*"])
    apply_to_methods = methods_raw if isinstance(methods_raw, list) else ["*"]
    method_filters = [m for m in apply_to_methods if isinstance(m, str) and m.strip()]
    if not method_filters:
        method_filters = ["*"]

    return {
        "enabled": enabled,
        "timeout_seconds": timeout_seconds,
        "failure_policy": failure_policy,
        "explainability": explainability,
        "apply_to_methods": method_filters,
    }


def _toml_value(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        return str(value)
    if isinstance(value, str):
        return f"\"{_escape_toml_string(value)}\""
    if isinstance(value, list):
        rendered = ", ".join(_toml_value(v) for v in value)
        return f"[{rendered}]"
    raise ValueError(f"Unsupported TOML value type: {type(value).__name__}")


def _strip_section_blocks(raw: str, sections: set[str]) -> str:
    lines = raw.splitlines(keepends=True)
    result: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        if stripped.startswith("[") and stripped.endswith("]"):
            section_name = stripped[1:-1].strip()
            if section_name in sections:
                i += 1
                while i < len(lines):
                    next_line = lines[i]
                    next_stripped = next_line.strip()
                    if next_stripped.startswith("[") and next_stripped.endswith("]"):
                        break
                    i += 1
                continue
        result.append(line)
        i += 1
    return "".join(result).rstrip() + "\n"


def save_guardian_settings(
    *,
    enabled: bool,
    timeout_seconds: int,
    failure_policy: str,
    explainability: str,
) -> dict[str, Any]:
    normalized_timeout = _normalize_guardian_timeout(timeout_seconds, default=8)
    normalized_failure = _normalize_guardian_failure_policy(failure_policy, default="manual_fallback")
    normalized_explainability = _normalize_guardian_explainability(explainability, default="full_chain")

    _ensure_config_exists()
    config_path = _get_config_path()
    raw = config_path.read_text(encoding="utf-8")
    parsed = tomllib.loads(raw) if raw.strip() else {}

    guardian = (
        parsed.get("approval", {}).get("guardian", {})
        if isinstance(parsed.get("approval"), dict)
        else {}
    )
    guardian = guardian if isinstance(guardian, dict) else {}
    apply_to_methods_raw = guardian.get("apply_to_methods", ["*"])
    apply_to_methods = (
        [m for m in apply_to_methods_raw if isinstance(m, str) and m.strip()]
        if isinstance(apply_to_methods_raw, list)
        else ["*"]
    )
    if not apply_to_methods:
        apply_to_methods = ["*"]

    llm_cfg = guardian.get("llm", {})
    llm_cfg = llm_cfg if isinstance(llm_cfg, dict) else {}

    updated = _strip_section_blocks(raw, {"approval.guardian", "approval.guardian.llm"})
    if updated and not updated.endswith("\n"):
        updated += "\n"
    updated += (
        "\n[approval.guardian]\n"
        f"enabled = {_toml_value(bool(enabled))}\n"
        f"timeout_seconds = {_toml_value(normalized_timeout)}\n"
        f"failure_policy = {_toml_value(normalized_failure)}\n"
        f"explainability = {_toml_value(normalized_explainability)}\n"
        f"apply_to_methods = {_toml_value(apply_to_methods)}\n"
    )

    if llm_cfg:
        ordered_keys = (
            "provider",
            "base_url",
            "model",
            "api_key_env",
            "temperature",
            "max_tokens",
        )
        lines = []
        for key in ordered_keys:
            if key in llm_cfg:
                lines.append(f"{key} = {_toml_value(llm_cfg[key])}")
        for key, value in llm_cfg.items():
            if key in ordered_keys:
                continue
            try:
                lines.append(f"{key} = {_toml_value(value)}")
            except ValueError:
                continue
        if lines:
            updated += "\n[approval.guardian.llm]\n" + "\n".join(lines) + "\n"

    config_path.write_text(updated, encoding="utf-8")
    reload()
    return get_guardian_settings()


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
