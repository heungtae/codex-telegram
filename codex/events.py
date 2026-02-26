import logging
from typing import Any, Callable

logger = logging.getLogger("codex-telegram.codex")


class EventHandler:
    def __init__(self):
        self._handlers: dict[str, list[Callable]] = {}
    
    def on(self, method: str, handler: Callable):
        if method not in self._handlers:
            self._handlers[method] = []
        self._handlers[method].append(handler)
    
    def handle(self, method: str, params: dict[str, Any] | None):
        handlers = self._handlers.get(method, [])
        for handler in handlers:
            try:
                handler(params or {})
            except Exception as e:
                logger.error(f"Error in event handler for {method}: {e}")


def create_event_handler() -> EventHandler:
    handler = EventHandler()
    
    handler.on("thread/started", lambda p: logger.debug(f"Thread started: {p}"))
    handler.on("thread/archived", lambda p: logger.debug(f"Thread archived: {p}"))
    handler.on("thread/unarchived", lambda p: logger.debug(f"Thread unarchived: {p}"))
    handler.on("thread/status/changed", lambda p: logger.debug(f"Thread status changed: {p}"))
    
    handler.on("turn/started", lambda p: logger.debug(f"Turn started: {p}"))
    handler.on("turn/completed", lambda p: logger.debug(f"Turn completed: {p}"))
    handler.on("turn/diff/updated", lambda p: logger.debug(f"Turn diff updated: {p}"))
    handler.on("turn/plan/updated", lambda p: logger.debug(f"Turn plan updated: {p}"))
    
    handler.on("item/started", lambda p: logger.debug(f"Item started: {p}"))
    handler.on("item/completed", lambda p: logger.debug(f"Item completed: {p}"))
    handler.on("item/agentMessage/delta", lambda p: logger.debug(f"Agent message delta: {p}"))
    
    return handler
