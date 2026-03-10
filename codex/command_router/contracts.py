from dataclasses import dataclass, field
from typing import Any, Literal


CommandKind = Literal["text", "usage", "error", "threads", "skills", "projects", "features", "guardian_settings", "reviewer_settings"]


@dataclass(slots=True)
class CommandResult:
    kind: CommandKind
    text: str
    meta: dict[str, Any] = field(default_factory=dict)


def text_result(text: str, **meta: Any) -> CommandResult:
    return CommandResult(kind="text", text=text, meta=meta)


def usage_result(text: str, **meta: Any) -> CommandResult:
    return CommandResult(kind="usage", text=text, meta=meta)


def error_result(text: str, **meta: Any) -> CommandResult:
    return CommandResult(kind="error", text=text, meta=meta)
