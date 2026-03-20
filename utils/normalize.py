from typing import Any


TRUE_VALUES = {"1", "true", "yes", "on"}
FALSE_VALUES = {"0", "false", "no", "off"}


def parse_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value != 0
    if isinstance(value, str):
        raw = value.strip().lower()
        if raw in TRUE_VALUES:
            return True
        if raw in FALSE_VALUES:
            return False
    return default


def parse_optional_bool(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        raw = value.strip().lower()
        if raw in TRUE_VALUES:
            return True
        if raw in FALSE_VALUES:
            return False
    return None


def parse_positive_int(value: Any, default: int) -> int:
    if isinstance(value, bool):
        return default
    if isinstance(value, int):
        return value if value > 0 else default
    if isinstance(value, str) and value.strip().isdigit():
        parsed = int(value.strip())
        return parsed if parsed > 0 else default
    return default


def clamp_int(value: Any, default: int, *, minimum: int, maximum: int) -> int:
    parsed = parse_positive_int(value, default)
    return max(minimum, min(maximum, parsed))
