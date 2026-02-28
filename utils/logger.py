import logging
import sys

from utils.config import get


def _parse_level(value: str | int | None) -> int:
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        level = getattr(logging, value.upper(), None)
        if isinstance(level, int):
            return level
    return logging.INFO


def setup(name: str = "codex-telegram") -> logging.Logger:
    logger = logging.getLogger(name)
    level = _parse_level(get("logging.level", "INFO"))

    if logger.handlers:
        logger.setLevel(level)
        for handler in logger.handlers:
            handler.setLevel(level)
        return logger
    
    logger.setLevel(level)
    
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level)
    
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    handler.setFormatter(formatter)
    
    logger.addHandler(handler)
    return logger
