from dataclasses import dataclass
from typing import Any
import logging


@dataclass(slots=True)
class RouterContext:
    codex: Any
    logger: logging.Logger
