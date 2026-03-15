import fnmatch
import os
import re
import subprocess
from dataclasses import dataclass
from typing import Any


APPROVAL_POLICY_ACTIONS = {"approve", "session", "deny", "manual_fallback"}
APPROVAL_POLICY_TEXT_MATCHER_KEYS = (
    "match_method",
    "match_question_any",
    "match_reason_any",
    "match_option_any",
)
APPROVAL_POLICY_LIST_MATCHER_KEYS = (
    "command_any",
    "command_regex",
    "path_any",
    "path_prefix_any",
    "path_glob_any",
    "secret_path_any",
    "secret_path_glob_any",
)
APPROVAL_POLICY_BOOL_MATCHER_KEYS = (
    "require_public_api_change",
    "require_db_schema_change",
    "require_auth_security_change",
    "require_lint_failed",
    "require_unit_test_failed",
)
APPROVAL_POLICY_INT_MATCHER_KEYS = ("max_changed_files",)
APPROVAL_POLICY_FLOAT_MATCHER_KEYS = ("coverage_drop_gt",)
APPROVAL_POLICY_ALL_MATCHER_KEYS = (
    *APPROVAL_POLICY_TEXT_MATCHER_KEYS,
    *APPROVAL_POLICY_LIST_MATCHER_KEYS,
    *APPROVAL_POLICY_BOOL_MATCHER_KEYS,
    *APPROVAL_POLICY_INT_MATCHER_KEYS,
    *APPROVAL_POLICY_FLOAT_MATCHER_KEYS,
)

_FILE_TOKEN_RE = re.compile(
    r"\b(?:pom\.xml|Dockerfile|id_rsa|id_dsa|known_hosts|schema\.sql|"
    r"[A-Za-z0-9_.-]+\.(?:xml|sql|ya?ml|json|properties|conf|ini|env|pem|key|crt|p12|jks|java|kt|py|js|ts))\b"
)
_PATH_TOKEN_RE = re.compile(r"\b(?:[A-Za-z0-9_.-]+/)+[A-Za-z0-9_.-]+\b")
_DIR_TOKEN_RE = re.compile(r"\b(?:helm|db/migration|db/migrations|migrations|secrets?)(?:/[A-Za-z0-9_.-]+)+\b")
_COVERAGE_DROP_RE = re.compile(
    r"coverage[^0-9\-+]{0,40}(?:drop|decrease|down|reduced)[^0-9\-+]{0,20}(-?\d+(?:\.\d+)?)%?",
    re.IGNORECASE,
)
_PUBLIC_API_MARKERS = (
    "/api/",
    "/apis/",
    "/controller/",
    "/controllers/",
    "/public/",
    "openapi",
    "swagger",
    "/dto/public/",
)
_DB_SCHEMA_MARKERS = (
    "db/migration/",
    "db/migrations/",
    "migrations/",
    "liquibase",
    "flyway",
    "schema.sql",
)
_AUTH_SECURITY_MARKERS = (
    "/auth/",
    "/security/",
    "oauth",
    "jwt",
    "rbac",
    "acl",
    "permission",
    "secret",
)
_SECRET_PATH_GLOBS = (
    ".env",
    ".env.*",
    "*.pem",
    "*.key",
    "*.crt",
    "*.p12",
    "*.jks",
    "id_rsa",
    "id_dsa",
    "secrets/*",
    "secret/*",
    "credentials/*",
)
_LINT_FAILURE_TERMS = (
    "lint failed",
    "lint error",
    "eslint failed",
    "flake8 failed",
    "ruff failed",
    "pylint failed",
    "checkstyle failed",
    "spotbugs failed",
    "pmd failed",
)
_UNIT_TEST_FAILURE_TERMS = (
    "test failed",
    "tests failed",
    "unit test failed",
    "unit tests failed",
    "failing tests",
    "test failures",
)
_COMMAND_METADATA_KEYS = ("commandText", "command", "shellCommand", "cmd", "argv")
_PATH_METADATA_KEYS = ("paths", "touchedPaths", "touched_paths", "files", "filePaths", "file_paths")
_COUNT_METADATA_KEYS = ("changedFileCount", "changedFiles", "changed_file_count")
_COVERAGE_METADATA_KEYS = ("coverageDrop", "coverage_drop")


@dataclass(slots=True)
class ApprovalPolicyMatch:
    rule_name: str
    action: str
    priority: int
    matched_fields: list[str]


def method_matches(method: str, patterns: list[str]) -> bool:
    for pattern in patterns:
        if not isinstance(pattern, str):
            continue
        if pattern.endswith("*"):
            if method.startswith(pattern[:-1]):
                return True
        elif method == pattern:
            return True
    return False


def build_approval_policy_context(
    payload: dict[str, Any],
    workspace_path: str | None = None,
) -> dict[str, Any]:
    method = str(payload.get("method") or "").strip()
    params = payload.get("params")
    params_dict = params if isinstance(params, dict) else {}

    reason = ""
    question_texts: list[str] = []
    option_texts: list[str] = []

    raw_reason = params_dict.get("reason")
    if isinstance(raw_reason, str) and raw_reason.strip():
        reason = raw_reason.strip()

    questions = params_dict.get("questions")
    if isinstance(questions, list):
        for q in questions:
            if not isinstance(q, dict):
                continue
            for key in ("question", "prompt", "title"):
                raw_question = q.get(key)
                if isinstance(raw_question, str) and raw_question.strip():
                    question_texts.append(raw_question.strip())
                    break

            raw_options = q.get("options")
            if not isinstance(raw_options, list):
                raw_options = q.get("choices")
            if not isinstance(raw_options, list):
                continue

            for option in raw_options:
                if isinstance(option, str):
                    if option.strip():
                        option_texts.append(option.strip())
                    continue
                if not isinstance(option, dict):
                    continue
                for key in ("label", "title", "text", "value", "description"):
                    raw_option = option.get(key)
                    if isinstance(raw_option, str) and raw_option.strip():
                        option_texts.append(raw_option.strip())

    all_texts = [method, reason, *question_texts, *option_texts]
    command_text = _extract_command_text(params_dict, all_texts)
    metadata_paths = _extract_paths_from_metadata(params_dict)
    text_paths = _extract_paths_from_text(all_texts)
    workspace_paths = _read_git_changed_paths(workspace_path)
    touched_paths = _unique_strings([*metadata_paths, *text_paths, *workspace_paths], normalize=_normalize_path)

    changed_file_count = _extract_int_metadata(params_dict, _COUNT_METADATA_KEYS)
    if changed_file_count is None and workspace_paths:
        changed_file_count = len(workspace_paths)
    if changed_file_count is None and touched_paths:
        changed_file_count = len(touched_paths)

    public_api_changed = _extract_bool_metadata(params_dict, ("publicApiChanged", "public_api_changed"))
    if public_api_changed is None:
        public_api_changed = _detect_public_api_changed(touched_paths)

    db_schema_changed = _extract_bool_metadata(params_dict, ("dbSchemaChanged", "db_schema_changed"))
    if db_schema_changed is None:
        db_schema_changed = _detect_db_schema_changed(touched_paths)

    auth_security_changed = _extract_bool_metadata(params_dict, ("authSecurityChanged", "auth_security_changed"))
    if auth_security_changed is None:
        auth_security_changed = _detect_auth_security_changed(touched_paths)

    lint_failed = _extract_bool_metadata(params_dict, ("lintFailed", "lint_failed"))
    if lint_failed is None:
        lint_failed = _contains_any(all_texts, list(_LINT_FAILURE_TERMS))

    unit_test_failed = _extract_bool_metadata(params_dict, ("unitTestFailed", "unit_test_failed"))
    if unit_test_failed is None:
        unit_test_failed = _contains_any(all_texts, list(_UNIT_TEST_FAILURE_TERMS))

    coverage_drop = _extract_float_metadata(params_dict, _COVERAGE_METADATA_KEYS)
    if coverage_drop is None:
        coverage_drop = _extract_coverage_drop(all_texts)

    return {
        "method": method,
        "reason": reason,
        "questions": question_texts,
        "options": option_texts,
        "question": question_texts[0] if question_texts else "",
        "command_text": command_text,
        "touched_paths": touched_paths,
        "changed_file_count": changed_file_count,
        "public_api_changed": public_api_changed,
        "db_schema_changed": db_schema_changed,
        "auth_security_changed": auth_security_changed,
        "lint_failed": lint_failed,
        "unit_test_failed": unit_test_failed,
        "coverage_drop": coverage_drop,
    }


def match_approval_policy(
    context: dict[str, Any],
    rules: list[dict[str, Any]],
) -> ApprovalPolicyMatch | None:
    method = str(context.get("method") or "")
    reason = str(context.get("reason") or "")
    questions = [str(v) for v in context.get("questions", []) if isinstance(v, str)]
    options = [str(v) for v in context.get("options", []) if isinstance(v, str)]
    command_text = str(context.get("command_text") or "")
    touched_paths = [str(v) for v in context.get("touched_paths", []) if isinstance(v, str)]
    changed_file_count = context.get("changed_file_count")
    public_api_changed = bool(context.get("public_api_changed", False))
    db_schema_changed = bool(context.get("db_schema_changed", False))
    auth_security_changed = bool(context.get("auth_security_changed", False))
    lint_failed = bool(context.get("lint_failed", False))
    unit_test_failed = bool(context.get("unit_test_failed", False))
    coverage_drop = context.get("coverage_drop")

    ordered_rules = sorted(
        enumerate(rules),
        key=lambda item: (-int(item[1].get("priority", 0)), item[0]),
    )
    for _index, rule in ordered_rules:
        if not bool(rule.get("enabled", False)):
            continue

        matched_fields: list[str] = []
        method_patterns = _normalize_string_list(rule.get("match_method"))
        if method_patterns:
            if not method_matches(method, method_patterns):
                continue
            matched_fields.append("method")

        question_terms = _normalize_string_list(rule.get("match_question_any"))
        if question_terms:
            if not _contains_any(questions, question_terms):
                continue
            matched_fields.append("question")

        reason_terms = _normalize_string_list(rule.get("match_reason_any"))
        if reason_terms:
            if not _contains_any([reason], reason_terms):
                continue
            matched_fields.append("reason")

        option_terms = _normalize_string_list(rule.get("match_option_any"))
        if option_terms:
            if not _contains_any(options, option_terms):
                continue
            matched_fields.append("option")

        command_terms = _normalize_string_list(rule.get("command_any"))
        if command_terms:
            if not _contains_any([command_text], command_terms):
                continue
            matched_fields.append("command")

        command_patterns = _normalize_string_list(rule.get("command_regex"))
        if command_patterns:
            if not _regex_matches_any(command_text, command_patterns):
                continue
            matched_fields.append("command_regex")

        path_any = _normalize_string_list(rule.get("path_any"))
        if path_any:
            if not _match_paths_any(touched_paths, path_any):
                continue
            matched_fields.append("path")

        path_prefix_any = _normalize_string_list(rule.get("path_prefix_any"))
        if path_prefix_any:
            if not _match_paths_prefix(touched_paths, path_prefix_any):
                continue
            matched_fields.append("path_prefix")

        path_glob_any = _normalize_string_list(rule.get("path_glob_any"))
        if path_glob_any:
            if not _match_paths_glob(touched_paths, path_glob_any):
                continue
            matched_fields.append("path_glob")

        secret_path_any = _normalize_string_list(rule.get("secret_path_any"))
        if secret_path_any:
            if not _match_paths_any(touched_paths, secret_path_any):
                continue
            matched_fields.append("secret_path")

        secret_path_glob_any = _normalize_string_list(rule.get("secret_path_glob_any"))
        if secret_path_glob_any:
            if not _match_paths_glob(touched_paths, secret_path_glob_any):
                continue
            matched_fields.append("secret_path_glob")

        max_changed_files = _extract_int(rule.get("max_changed_files"))
        if max_changed_files is not None:
            if not isinstance(changed_file_count, int) or changed_file_count <= max_changed_files:
                continue
            matched_fields.append("changed_files")

        if bool(rule.get("require_public_api_change", False)):
            if not public_api_changed:
                continue
            matched_fields.append("public_api")

        if bool(rule.get("require_db_schema_change", False)):
            if not db_schema_changed:
                continue
            matched_fields.append("db_schema")

        if bool(rule.get("require_auth_security_change", False)):
            if not auth_security_changed:
                continue
            matched_fields.append("auth_security")

        if bool(rule.get("require_lint_failed", False)):
            if not lint_failed:
                continue
            matched_fields.append("lint_failed")

        if bool(rule.get("require_unit_test_failed", False)):
            if not unit_test_failed:
                continue
            matched_fields.append("unit_test_failed")

        coverage_drop_gt = _extract_float(rule.get("coverage_drop_gt"))
        if coverage_drop_gt is not None:
            if not isinstance(coverage_drop, (int, float)) or float(coverage_drop) <= coverage_drop_gt:
                continue
            matched_fields.append("coverage_drop")

        if not matched_fields:
            continue

        action = str(rule.get("action") or "").strip().lower()
        if action not in APPROVAL_POLICY_ACTIONS:
            continue

        return ApprovalPolicyMatch(
            rule_name=str(rule.get("name") or "unnamed-rule"),
            action=action,
            priority=int(rule.get("priority", 0)),
            matched_fields=matched_fields,
        )

    return None


def _extract_command_text(params: dict[str, Any], texts: list[str]) -> str:
    for key in _COMMAND_METADATA_KEYS:
        value = params.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
        if isinstance(value, list):
            parts = [str(item).strip() for item in value if str(item).strip()]
            if parts:
                return " ".join(parts)
    return "\n".join(text for text in texts if isinstance(text, str) and text.strip())


def _extract_paths_from_metadata(params: dict[str, Any]) -> list[str]:
    paths: list[str] = []
    for key in _PATH_METADATA_KEYS:
        value = params.get(key)
        if isinstance(value, str) and value.strip():
            paths.append(value.strip())
            continue
        if isinstance(value, list):
            for item in value:
                if isinstance(item, str) and item.strip():
                    paths.append(item.strip())
                elif isinstance(item, dict):
                    for field in ("path", "file", "name"):
                        raw = item.get(field)
                        if isinstance(raw, str) and raw.strip():
                            paths.append(raw.strip())
                            break
    return _unique_strings(paths, normalize=_normalize_path)


def _extract_paths_from_text(texts: list[str]) -> list[str]:
    paths: list[str] = []
    for text in texts:
        if not isinstance(text, str) or not text.strip():
            continue
        paths.extend(_FILE_TOKEN_RE.findall(text))
        paths.extend(_DIR_TOKEN_RE.findall(text))
        paths.extend(_PATH_TOKEN_RE.findall(text))
    return _unique_strings(paths, normalize=_normalize_path)


def _read_git_changed_paths(workspace_path: str | None) -> list[str]:
    if not workspace_path or not isinstance(workspace_path, str) or not os.path.isdir(workspace_path):
        return []
    try:
        result = subprocess.run(
            ["git", "-C", workspace_path, "status", "--short"],
            check=False,
            capture_output=True,
            text=True,
            timeout=3,
        )
    except (OSError, subprocess.SubprocessError):
        return []
    if result.returncode != 0:
        return []

    paths: list[str] = []
    for line in result.stdout.splitlines():
        raw = line[3:].strip() if len(line) >= 4 else ""
        if not raw:
            continue
        if " -> " in raw:
            before, after = raw.split(" -> ", 1)
            candidates = [before, after]
        else:
            candidates = [raw]
        for candidate in candidates:
            normalized = _normalize_path(candidate)
            if normalized:
                paths.append(normalized)
    return _unique_strings(paths, normalize=_normalize_path)


def _detect_public_api_changed(paths: list[str]) -> bool:
    return _contains_path_markers(paths, _PUBLIC_API_MARKERS)


def _detect_db_schema_changed(paths: list[str]) -> bool:
    return _contains_path_markers(paths, _DB_SCHEMA_MARKERS)


def _detect_auth_security_changed(paths: list[str]) -> bool:
    return _contains_path_markers(paths, _AUTH_SECURITY_MARKERS)


def _contains_path_markers(paths: list[str], markers: tuple[str, ...]) -> bool:
    for path in paths:
        raw = _normalize_path(path)
        if not raw:
            continue
        if any(marker in raw for marker in markers):
            return True
    return False


def _extract_bool_metadata(params: dict[str, Any], keys: str | tuple[str, ...]) -> bool | None:
    key_list = (keys,) if isinstance(keys, str) else keys
    for key in key_list:
        value = params.get(key)
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            raw = value.strip().lower()
            if raw in {"1", "true", "yes", "on"}:
                return True
            if raw in {"0", "false", "no", "off"}:
                return False
    return None


def _extract_int_metadata(params: dict[str, Any], keys: tuple[str, ...]) -> int | None:
    for key in keys:
        value = params.get(key)
        parsed = _extract_int(value)
        if parsed is not None:
            return parsed
    return None


def _extract_float_metadata(params: dict[str, Any], keys: tuple[str, ...]) -> float | None:
    for key in keys:
        value = params.get(key)
        parsed = _extract_float(value)
        if parsed is not None:
            return parsed
    return None


def _extract_coverage_drop(texts: list[str]) -> float | None:
    for text in texts:
        if not isinstance(text, str) or not text.strip():
            continue
        match = _COVERAGE_DROP_RE.search(text)
        if match:
            parsed = _extract_float(match.group(1))
            if parsed is not None:
                return abs(parsed)
    return None


def _normalize_path(value: str) -> str:
    raw = (value or "").strip().strip("\"'`")
    raw = raw.replace("\\", "/")
    raw = raw.rstrip(".,:;")
    while raw.startswith("./"):
        raw = raw[2:]
    return raw


def _unique_strings(values: list[str], normalize=None) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if not isinstance(value, str):
            continue
        raw = normalize(value) if normalize is not None else value.strip()
        if not raw or raw in seen:
            continue
        seen.add(raw)
        result.append(raw)
    return result


def _normalize_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if isinstance(item, str) and item.strip()]


def _contains_any(haystacks: list[str], needles: list[str]) -> bool:
    normalized_haystacks = [h.lower() for h in haystacks if isinstance(h, str) and h.strip()]
    if not normalized_haystacks:
        return False
    for needle in needles:
        raw = needle.strip().lower()
        if raw and any(raw in haystack for haystack in normalized_haystacks):
            return True
    return False


def _regex_matches_any(text: str, patterns: list[str]) -> bool:
    for pattern in patterns:
        raw = pattern.strip()
        if not raw:
            continue
        try:
            if re.search(raw, text, re.IGNORECASE):
                return True
        except re.error:
            continue
    return False


def _match_paths_any(paths: list[str], expected: list[str]) -> bool:
    normalized_expected = {_normalize_path(value) for value in expected if _normalize_path(value)}
    if not normalized_expected:
        return False
    for path in paths:
        normalized_path = _normalize_path(path)
        basename = normalized_path.rsplit("/", 1)[-1]
        if normalized_path in normalized_expected or basename in normalized_expected:
            return True
    return False


def _match_paths_prefix(paths: list[str], prefixes: list[str]) -> bool:
    normalized_prefixes = [_normalize_path(value).rstrip("/") for value in prefixes if _normalize_path(value)]
    if not normalized_prefixes:
        return False
    for path in paths:
        normalized_path = _normalize_path(path)
        if any(
            normalized_path == prefix or normalized_path.startswith(prefix + "/")
            for prefix in normalized_prefixes
        ):
            return True
    return False


def _match_paths_glob(paths: list[str], globs: list[str]) -> bool:
    normalized_globs = [_normalize_path(value) for value in globs if _normalize_path(value)]
    if not normalized_globs:
        return False
    for path in paths:
        normalized_path = _normalize_path(path)
        basename = normalized_path.rsplit("/", 1)[-1]
        if any(fnmatch.fnmatch(normalized_path, pattern) or fnmatch.fnmatch(basename, pattern) for pattern in normalized_globs):
            return True
    return False


def _extract_int(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        try:
            return int(value.strip())
        except ValueError:
            return None
    return None


def _extract_float(value: Any) -> float | None:
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
