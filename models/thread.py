from dataclasses import dataclass, field
from typing import Any


@dataclass
class ThreadInfo:
    id: str
    name: str | None = None
    preview: str | None = None
    status: dict[str, Any] = field(default_factory=dict)
    model_provider: str | None = None
    created_at: int | None = None
    updated_at: int | None = None


@dataclass
class TurnInfo:
    id: str
    status: str = "inProgress"
    items: list[Any] = field(default_factory=list)
    error: dict[str, Any] | None = None
