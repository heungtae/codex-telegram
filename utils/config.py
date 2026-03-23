import os
import re
import tomllib
import logging
from functools import lru_cache
from pathlib import Path
from typing import Any

from utils.approval_policy import (
    APPROVAL_POLICY_ACTIONS,
    APPROVAL_POLICY_ALL_MATCHER_KEYS,
    APPROVAL_POLICY_BOOL_MATCHER_KEYS,
    APPROVAL_POLICY_FLOAT_MATCHER_KEYS,
    APPROVAL_POLICY_INT_MATCHER_KEYS,
    APPROVAL_POLICY_LIST_MATCHER_KEYS,
    APPROVAL_POLICY_TEXT_MATCHER_KEYS,
)
from utils.normalize import parse_bool, parse_optional_bool, parse_positive_int
from utils.web_config import resolve_web_password

_config: dict[str, Any] | None = None
logger = logging.getLogger("codex-telegram.config")

DEFAULT_CONFIG = """project = "default"

[projects.default]
name = "codex-telegram"
path = "/path/to/your/project"

[telegram]
enabled = true

[telegram.bot]
token = "TELEGRAM_BOT_TOKEN"
drop_pending_updates = true
conflict_action = "prompt"

[web]
enabled = false
host = "127.0.0.1"
port = 8080
ssl_enabled = false
ssl_certfile = ""
ssl_keyfile = ""
password = "CHANGE_ME"
password_env = ""
allowed_users = []
session_ttl_seconds = 43200
cookie_secure = false

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
explainability = "decision_only"
apply_to_methods = ["*"]

[logging]
level = "INFO"

[updates]
pypi_check = true
pypi_check_verify_ssl = true

[telegram.forwarding]
app_server_event_level = "INFO"
app_server_event_allowlist = []
app_server_event_denylist = []

[display]
max_message_length = 4000
send_progress = true
threads_list_limit = 20
"""

def _get_config_path() -> Path:
    env_config_path = os.environ.get("CODEX_CONFIG_PATH")
    if env_config_path:
        return Path(env_config_path)
    config_dir = Path.home() / ".config" / "codex-telegram"
    return config_dir / "conf.toml"


def get_config_path() -> Path:
    return _get_config_path()


def _ensure_config_exists():
    config_path = _get_config_path()
    if not config_path.exists():
        config_path.parent.mkdir(parents=True, exist_ok=True)
        config_path.write_text(DEFAULT_CONFIG, encoding="utf-8")


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
    logger.info("Loading config from %s", config_path)
    
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


def get_telegram_bot(key: str, default: Any = None) -> Any:
    modern = get(f"telegram.bot.{key}", None)
    if modern is not None:
        return modern
    return get(f"bot.{key}", default)


def get_web_password() -> str:
    return resolve_web_password(_get_config_path(), get)


def _escape_toml_string(value: str) -> str:
    return value.replace("\\", "\\\\").replace("\"", "\\\"")


GUARDIAN_TIMEOUT_CHOICES = [3, 8, 20, 60]
GUARDIAN_FAILURE_POLICIES = {"manual_fallback", "deny", "approve", "session"}
GUARDIAN_EXPLAINABILITY_LEVELS = {"decision_only", "summary"}
REMOVED_GUARDIAN_RULE_NAMES = {"block reviewer handoff after unit test failure"}


def _normalize_guardian_enabled(value: Any, default: bool = False) -> bool:
    return parse_bool(value, default=default)


def _normalize_guardian_timeout(value: Any, default: int = 20) -> int:
    return parse_positive_int(value, default)


def _normalize_guardian_failure_policy(value: Any, default: str = "manual_fallback") -> str:
    raw = str(value or "").strip().lower()
    if raw in GUARDIAN_FAILURE_POLICIES:
        return raw
    return default


def _normalize_guardian_explainability(value: Any, default: str = "decision_only") -> str:
    raw = str(value or "").strip().lower()
    if raw in GUARDIAN_EXPLAINABILITY_LEVELS:
        return raw
    return default


def _guardian_example_path() -> Path:
    return Path(__file__).resolve().parents[1] / "conf.toml.example"


def _copy_rule_tables(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    copied: list[dict[str, Any]] = []
    for item in value:
        if isinstance(item, dict):
            copied.append(dict(item))
    return copied


def _drop_removed_guardian_rules(value: Any) -> list[dict[str, Any]]:
    filtered: list[dict[str, Any]] = []
    for rule in _copy_rule_tables(value):
        name = str(rule.get("name") or "").strip().lower()
        if name in REMOVED_GUARDIAN_RULE_NAMES:
            continue
        filtered.append(rule)
    return filtered


@lru_cache(maxsize=1)
def _load_guardian_example_defaults() -> dict[str, Any]:
    fallback = {
        "enabled": False,
        "timeout_seconds": 8,
        "failure_policy": "manual_fallback",
        "explainability": "decision_only",
        "apply_to_methods": ["*"],
        "rules_raw": [],
    }
    try:
        raw = _guardian_example_path().read_text(encoding="utf-8")
        parsed = tomllib.loads(raw) if raw.strip() else {}
    except (OSError, tomllib.TOMLDecodeError):
        return fallback

    approval = parsed.get("approval") if isinstance(parsed, dict) else {}
    guardian_raw = approval.get("guardian") if isinstance(approval, dict) else {}
    guardian = guardian_raw if isinstance(guardian_raw, dict) else {}

    methods_raw = guardian.get("apply_to_methods", fallback["apply_to_methods"])
    apply_to_methods = (
        [m for m in methods_raw if isinstance(m, str) and m.strip()]
        if isinstance(methods_raw, list)
        else list(fallback["apply_to_methods"])
    )
    if not apply_to_methods:
        apply_to_methods = list(fallback["apply_to_methods"])

    return {
        "enabled": _normalize_guardian_enabled(guardian.get("enabled"), default=fallback["enabled"]),
        "timeout_seconds": _normalize_guardian_timeout(
            guardian.get("timeout_seconds"),
            default=fallback["timeout_seconds"],
        ),
        "failure_policy": _normalize_guardian_failure_policy(
            guardian.get("failure_policy"),
            default=fallback["failure_policy"],
        ),
        "explainability": _normalize_guardian_explainability(
            guardian.get("explainability"),
            default=fallback["explainability"],
        ),
        "apply_to_methods": apply_to_methods,
        "rules_raw": _drop_removed_guardian_rules(guardian.get("rules", [])),
    }


def _normalize_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    normalized: list[str] = []
    for item in value:
        if not isinstance(item, str):
            continue
        raw = item.strip()
        if raw:
            normalized.append(raw)
    return normalized


def _normalize_optional_bool(value: Any) -> bool | None:
    return parse_optional_bool(value)


def _normalize_optional_float(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.strip())
        except ValueError:
            return None
    return None


def _normalize_guardian_rule(value: Any, index: int) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None

    action = str(value.get("action") or "").strip().lower()
    if action not in APPROVAL_POLICY_ACTIONS:
        return None

    name = str(value.get("name") or "").strip() or f"rule-{index + 1}"
    enabled = _normalize_guardian_enabled(value.get("enabled"), default=True)

    priority_raw = value.get("priority", 0)
    if isinstance(priority_raw, bool):
        priority = 0
    elif isinstance(priority_raw, int):
        priority = priority_raw
    elif isinstance(priority_raw, str):
        try:
            priority = int(priority_raw.strip())
        except ValueError:
            priority = 0
    else:
        priority = 0

    rule: dict[str, Any] = {
        "name": name,
        "enabled": enabled,
        "action": action,
        "priority": priority,
    }
    for key in (*APPROVAL_POLICY_TEXT_MATCHER_KEYS, *APPROVAL_POLICY_LIST_MATCHER_KEYS):
        rule[key] = _normalize_string_list(value.get(key))
    for key in APPROVAL_POLICY_BOOL_MATCHER_KEYS:
        parsed_bool = _normalize_optional_bool(value.get(key))
        if parsed_bool is not None:
            rule[key] = parsed_bool
    for key in APPROVAL_POLICY_INT_MATCHER_KEYS:
        parsed_int = _normalize_positive_int(value.get(key), default=0)
        if parsed_int > 0:
            rule[key] = parsed_int
    for key in APPROVAL_POLICY_FLOAT_MATCHER_KEYS:
        parsed_float = _normalize_optional_float(value.get(key))
        if parsed_float is not None and parsed_float > 0:
            rule[key] = parsed_float

    if not any(
        bool(rule.get(key))
        for key in APPROVAL_POLICY_ALL_MATCHER_KEYS
    ):
        return None
    return rule


def _validate_guardian_rule_for_save(value: Any, index: int) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"Guardian rule #{index + 1} must be an object.")

    action = str(value.get("action") or "").strip().lower()
    if action not in APPROVAL_POLICY_ACTIONS:
        raise ValueError(
            f"Guardian rule #{index + 1} has invalid action '{value.get('action')}'."
        )

    normalized = _normalize_guardian_rule(value, index)
    if normalized is None:
        raise ValueError(
            f"Guardian rule #{index + 1} must include at least one valid matcher or threshold."
        )
    return normalized


def _validate_guardian_rules_for_save(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        raise ValueError("Guardian rules must be a JSON array.")
    return [_validate_guardian_rule_for_save(item, index) for index, item in enumerate(value)]


def _normalize_guardian_rules(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    normalized: list[dict[str, Any]] = []
    for index, item in enumerate(value):
        rule = _normalize_guardian_rule(item, index)
        if rule is not None:
            normalized.append(rule)
    return normalized


def _build_guardian_rule_summary(rules: list[dict[str, Any]]) -> dict[str, Any]:
    enabled_rules = [rule for rule in rules if bool(rule.get("enabled", False))]
    action_counts: dict[str, int] = {action: 0 for action in sorted(APPROVAL_POLICY_ACTIONS)}
    for rule in enabled_rules:
        action = str(rule.get("action") or "").strip().lower()
        if action in action_counts:
            action_counts[action] += 1
    ordered = sorted(
        enabled_rules,
        key=lambda rule: (-int(rule.get("priority", 0)), str(rule.get("name") or "").lower()),
    )
    top = [
        {
            "name": str(rule.get("name") or "unnamed-rule"),
            "action": str(rule.get("action") or "deny"),
            "priority": int(rule.get("priority", 0)),
        }
        for rule in ordered[:5]
    ]
    return {
        "total": len(rules),
        "enabled": len(enabled_rules),
        "action_counts": action_counts,
        "top": top,
    }


def _render_guardian_rule_block(rule: dict[str, Any]) -> str:
    block = "\n[[approval.guardian.rules]]\n"
    block += f"name = {_toml_value(str(rule.get('name') or 'unnamed-rule'))}\n"
    block += f"enabled = {_toml_value(bool(rule.get('enabled', True)))}\n"
    block += f"action = {_toml_value(str(rule.get('action') or 'manual_fallback'))}\n"
    block += f"priority = {_toml_value(int(rule.get('priority', 0)))}\n"
    for key in (*APPROVAL_POLICY_TEXT_MATCHER_KEYS, *APPROVAL_POLICY_LIST_MATCHER_KEYS):
        values = _normalize_string_list(rule.get(key))
        if values:
            block += f"{key} = {_toml_value(values)}\n"
    for key in APPROVAL_POLICY_BOOL_MATCHER_KEYS:
        if isinstance(rule.get(key), bool):
            block += f"{key} = {_toml_value(bool(rule.get(key)))}\n"
    for key in APPROVAL_POLICY_INT_MATCHER_KEYS:
        parsed_int = _normalize_positive_int(rule.get(key), default=0)
        if parsed_int > 0:
            block += f"{key} = {_toml_value(parsed_int)}\n"
    for key in APPROVAL_POLICY_FLOAT_MATCHER_KEYS:
        parsed_float = _normalize_optional_float(rule.get(key))
        if parsed_float is not None and parsed_float > 0:
            block += f"{key} = {_toml_value(parsed_float)}\n"
    return block


def _comment_toml_text(value: str) -> str:
    lines: list[str] = []
    for line in value.splitlines():
        if line.strip():
            lines.append(f"# {line}")
        else:
            lines.append("#")
    return "\n".join(lines) + ("\n" if lines else "")


def render_guardian_rules_toml(rules: list[dict[str, Any]]) -> str:
    normalized_rules = _normalize_guardian_rules(rules)
    rendered = "".join(_render_guardian_rule_block(rule) for rule in normalized_rules).lstrip("\n")
    return rendered.rstrip() + ("\n" if rendered else "")


def render_guardian_rules_example_toml() -> str:
    example_defaults = _load_guardian_example_defaults()
    example_rules = _normalize_guardian_rules(example_defaults.get("rules_raw", []))
    if not example_rules:
        return (
            "# No Guardian rules are configured in conf.toml.\n"
            "# Add [[approval.guardian.rules]] blocks here.\n"
        )
    example_blocks = render_guardian_rules_toml(example_rules).rstrip()
    return (
        "# No Guardian rules are configured in conf.toml.\n"
        "# Uncomment and edit the example rules below from conf.toml.example.\n"
        "#\n"
        + _comment_toml_text(example_blocks)
    )


def parse_guardian_rules_toml(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, str):
        raise ValueError("Guardian rules TOML must be a string.")

    raw = value.strip()
    if not raw:
        return []

    try:
        parsed = tomllib.loads(raw)
    except tomllib.TOMLDecodeError as exc:
        raise ValueError(f"Guardian rules TOML is invalid: {exc}") from exc

    if not parsed:
        return []
    approval = parsed.get("approval") if isinstance(parsed, dict) else {}
    guardian = approval.get("guardian") if isinstance(approval, dict) else {}
    if guardian is None:
        raise ValueError("Guardian rules TOML must use [[approval.guardian.rules]] blocks or comments only.")
    if not isinstance(guardian, dict):
        raise ValueError("Guardian rules TOML must define approval.guardian rules.")
    return _drop_removed_guardian_rules(guardian.get("rules", []))


def get_guardian_settings() -> dict[str, Any]:
    example_defaults = _load_guardian_example_defaults()
    guardian_raw = get("approval.guardian", {})
    guardian = guardian_raw if isinstance(guardian_raw, dict) else {}
    enabled = _normalize_guardian_enabled(guardian.get("enabled"), default=bool(example_defaults["enabled"]))
    timeout_seconds = _normalize_guardian_timeout(
        guardian.get("timeout_seconds"),
        default=int(example_defaults["timeout_seconds"]),
    )
    failure_policy = _normalize_guardian_failure_policy(
        guardian.get("failure_policy"),
        default=str(example_defaults["failure_policy"]),
    )
    explainability = _normalize_guardian_explainability(
        guardian.get("explainability"),
        default=str(example_defaults["explainability"]),
    )

    methods_raw = guardian.get("apply_to_methods", example_defaults["apply_to_methods"])
    apply_to_methods = methods_raw if isinstance(methods_raw, list) else list(example_defaults["apply_to_methods"])
    method_filters = [m for m in apply_to_methods if isinstance(m, str) and m.strip()]
    if not method_filters:
        method_filters = list(example_defaults["apply_to_methods"])
    rules = _normalize_guardian_rules(_drop_removed_guardian_rules(guardian.get("rules", [])))
    rules_toml = render_guardian_rules_toml(rules) if rules else render_guardian_rules_example_toml()

    return {
        "enabled": enabled,
        "timeout_seconds": timeout_seconds,
        "failure_policy": failure_policy,
        "explainability": explainability,
        "apply_to_methods": method_filters,
        "rules": rules,
        "rules_toml": rules_toml,
        "rule_summary": _build_guardian_rule_summary(rules),
    }


def _normalize_positive_int(value: Any, default: int) -> int:
    return parse_positive_int(value, default)


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


def _section_name(stripped: str) -> str | None:
    if stripped.startswith("[[") and stripped.endswith("]]"):
        return stripped[2:-2].strip()
    if stripped.startswith("[") and stripped.endswith("]"):
        return stripped[1:-1].strip()
    return None


def _strip_section_blocks(raw: str, sections: set[str]) -> str:
    lines = raw.splitlines(keepends=True)
    result: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        section_name = _section_name(stripped)
        if section_name is not None:
            if section_name in sections:
                i += 1
                while i < len(lines):
                    next_line = lines[i]
                    next_stripped = next_line.strip()
                    if _section_name(next_stripped) is not None:
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
    rules: list[dict[str, Any]] | None = None,
    rules_toml: str | None = None,
) -> dict[str, Any]:
    example_defaults = _load_guardian_example_defaults()
    normalized_timeout = _normalize_guardian_timeout(
        timeout_seconds,
        default=int(example_defaults["timeout_seconds"]),
    )
    normalized_failure = _normalize_guardian_failure_policy(
        failure_policy,
        default=str(example_defaults["failure_policy"]),
    )
    normalized_explainability = _normalize_guardian_explainability(
        explainability,
        default=str(example_defaults["explainability"]),
    )

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
    apply_to_methods_raw = guardian.get("apply_to_methods", example_defaults["apply_to_methods"])
    apply_to_methods = (
        [m for m in apply_to_methods_raw if isinstance(m, str) and m.strip()]
        if isinstance(apply_to_methods_raw, list)
        else list(example_defaults["apply_to_methods"])
    )
    if not apply_to_methods:
        apply_to_methods = list(example_defaults["apply_to_methods"])

    if rules_toml is not None:
        raw_rules = parse_guardian_rules_toml(rules_toml)
    elif rules is not None:
        if not isinstance(rules, list):
            raise ValueError("Guardian rules must be a JSON array.")
        raw_rules = rules
    else:
        raw_rules = guardian.get("rules", [])

    normalized_rules = _validate_guardian_rules_for_save(_drop_removed_guardian_rules(raw_rules))

    llm_cfg = guardian.get("llm", {})
    llm_cfg = llm_cfg if isinstance(llm_cfg, dict) else {}

    updated = _strip_section_blocks(raw, {"approval.guardian", "approval.guardian.rules", "approval.guardian.llm"})
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

    if normalized_rules:
        for rule in normalized_rules:
            updated += _render_guardian_rule_block(rule)

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
