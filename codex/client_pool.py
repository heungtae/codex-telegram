import asyncio
import logging
import threading
from dataclasses import dataclass, field
from inspect import isawaitable
from typing import Any, Callable

from .client import CodexClient


logger = logging.getLogger("codex-telegram.codex")


@dataclass(slots=True)
class _ManagedClient:
    client: CodexClient
    thread_ids: set[str] = field(default_factory=set)
    kind: str = "thread"


class CodexClientManager:
    def __init__(self):
        self._client_info: dict[str, Any] | None = None
        self._control: _ManagedClient | None = None
        self._thread_clients: dict[str, _ManagedClient] = {}
        self._approval_request_clients: dict[int, _ManagedClient] = {}
        self._any_event_handlers: list[Callable] = []
        self._event_handlers: dict[str, list[Callable]] = {}
        self._approval_handlers: list[Callable] = []
        self._lock = threading.RLock()

    async def start(self):
        if self._control is not None:
            return
        self._control = await self._create_started_client(kind="control")
        logger.info("Codex control client started")

    async def initialize(self, client_info: dict[str, Any]):
        self._client_info = dict(client_info)
        if self._control is None:
            await self.start()
        if self._control is None:
            raise RuntimeError("Codex control client failed to start")
        await self._control.client.initialize(client_info)
        logger.info("Initialized Codex control client")

    async def stop(self):
        with self._lock:
            thread_clients = list(self._thread_clients.items())
            control = self._control
            self._thread_clients.clear()
            self._approval_request_clients.clear()
            self._control = None

        for thread_id, handle in thread_clients:
            try:
                await handle.client.stop()
            except Exception:
                logger.exception("Failed to stop Codex thread client thread_id=%s", thread_id)

        if control is not None:
            try:
                await control.client.stop()
            except Exception:
                logger.exception("Failed to stop Codex control client")

    def on(self, method: str, handler: Callable):
        with self._lock:
            self._event_handlers.setdefault(method, []).append(handler)
            for handle in self._thread_clients.values():
                handle.client.on(method, handler)
            if self._control is not None:
                self._control.client.on(method, handler)

    def on_any(self, handler: Callable):
        with self._lock:
            self._any_event_handlers.append(handler)

    def on_approval_request(self, handler: Callable):
        with self._lock:
            self._approval_handlers.append(handler)

    def submit_approval_decision(self, request_id: int, decision: str, thread_id: str | None = None) -> bool:
        handle = self._resolve_approval_handle(request_id, thread_id)
        if handle is None:
            return False
        return handle.client.submit_approval_decision(request_id, decision, thread_id=thread_id)

    async def call(self, method: str, params: dict[str, Any] | None = None) -> Any:
        normalized_params = {} if params is None else params
        thread_id = self._extract_thread_id(normalized_params)
        if method == "thread/start":
            handle = await self._create_managed_client(kind="thread")
            try:
                result = await handle.client.call(method, normalized_params)
                started_thread_id = self._extract_thread_id_from_result(result)
                if not started_thread_id:
                    raise RuntimeError("Codex thread/start did not return a thread id")
                self._bind_thread_handle(started_thread_id, handle)
                return result
            except Exception:
                await handle.client.stop()
                raise
        if thread_id is not None:
            handle, is_new = await self._resolve_thread_handle(thread_id)
            try:
                result = await handle.client.call(method, normalized_params)
                self._bind_thread_handle(thread_id, handle)
                return result
            except Exception:
                if is_new:
                    self._unbind_thread_handle(thread_id, handle)
                    await handle.client.stop()
                raise
        control = await self._ensure_control_client()
        return await control.client.call(method, normalized_params)

    async def _ensure_control_client(self) -> _ManagedClient:
        if self._control is not None:
            return self._control
        await self.start()
        if self._control is None:
            raise RuntimeError("Codex control client is unavailable")
        return self._control

    async def _resolve_thread_handle(self, thread_id: str) -> tuple[_ManagedClient, bool]:
        with self._lock:
            handle = self._thread_clients.get(thread_id)
        if handle is not None:
            return handle, False
        handle = await self._create_managed_client(kind="thread")
        self._bind_thread_handle(thread_id, handle)
        return handle, True

    def _bind_thread_handle(self, thread_id: str, handle: _ManagedClient) -> None:
        with self._lock:
            self._thread_clients[thread_id] = handle
            handle.thread_ids.add(thread_id)

    def _unbind_thread_handle(self, thread_id: str, handle: _ManagedClient) -> None:
        with self._lock:
            current = self._thread_clients.get(thread_id)
            if current is handle:
                self._thread_clients.pop(thread_id, None)
            handle.thread_ids.discard(thread_id)

    def _resolve_approval_handle(self, request_id: int, thread_id: str | None = None) -> _ManagedClient | None:
        with self._lock:
            if isinstance(thread_id, str) and thread_id:
                handle = self._thread_clients.get(thread_id)
                if handle is not None:
                    return handle
            return self._approval_request_clients.get(request_id)

    def _extract_thread_id(self, params: dict[str, Any]) -> str | None:
        for key in ("threadId", "conversationId"):
            value = params.get(key)
            if isinstance(value, str) and value:
                return value
        return None

    def _extract_thread_id_from_result(self, result: Any) -> str | None:
        if not isinstance(result, dict):
            return None
        thread = result.get("thread")
        if isinstance(thread, dict):
            thread_id = thread.get("id")
            if isinstance(thread_id, str) and thread_id:
                return thread_id
        thread_id = result.get("threadId")
        if isinstance(thread_id, str) and thread_id:
            return thread_id
        return None

    async def _create_started_client(self, *, kind: str) -> _ManagedClient:
        client = CodexClient()
        handle = _ManagedClient(client=client, kind=kind)
        self._attach_handlers(handle)
        await client.start()
        return handle

    async def _create_managed_client(self, *, kind: str) -> _ManagedClient:
        handle = await self._create_started_client(kind=kind)
        if self._client_info is None:
            raise RuntimeError("Codex client manager has not been initialized")
        await handle.client.initialize(self._client_info)
        return handle

    def _attach_handlers(self, handle: _ManagedClient) -> None:
        handle.client.on_any(lambda method, params, _handle=handle: self._dispatch_any(_handle, method, params))
        handle.client.on_approval_request(
            lambda payload, _handle=handle: self._dispatch_approval(_handle, payload)
        )
        for method, handlers in self._event_handlers.items():
            for handler in handlers:
                handle.client.on(method, handler)

    async def _dispatch_any(self, handle: _ManagedClient, method: str, params: dict[str, Any] | None) -> None:
        for handler in list(self._any_event_handlers):
            await self._run_handler(handler, method, params, wildcard=True)
        for handler in list(self._event_handlers.get(method, [])):
            await self._run_handler(handler, method, params, wildcard=False)

    async def _dispatch_approval(self, handle: _ManagedClient, payload: dict[str, Any]) -> None:
        request_id = payload.get("id")
        if isinstance(request_id, int):
            with self._lock:
                self._approval_request_clients[request_id] = handle
        for handler in list(self._approval_handlers):
            try:
                result = handler(payload)
                if isawaitable(result):
                    await result
            except Exception:
                logger.exception("Error in approval request handler request_id=%s", request_id)

    async def _run_handler(self, handler: Callable, method: str, params: dict[str, Any] | None, *, wildcard: bool):
        try:
            result = handler(method, params) if wildcard else handler(params)
            if isawaitable(result):
                await result
        except Exception as exc:
            label = "wildcard event handler" if wildcard else "event handler"
            logger.error("Error in %s for %s: %s", label, method, exc)
