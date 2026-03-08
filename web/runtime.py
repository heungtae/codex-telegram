import asyncio
import secrets
import time
from dataclasses import dataclass
from typing import Any


WEB_USER_ID_BASE = -10_000_000_000


@dataclass(slots=True)
class WebSession:
    token: str
    username: str
    user_id: int
    expires_at: float


class WebSessionManager:
    def __init__(self):
        self._sessions: dict[str, WebSession] = {}
        self._user_seq = 0
        self._username_to_user_id: dict[str, int] = {}
        self._lock = asyncio.Lock()

    async def create(self, username: str, ttl_seconds: int) -> WebSession:
        now = time.time()
        token = secrets.token_urlsafe(32)
        async with self._lock:
            user_id = self._username_to_user_id.get(username)
            if user_id is None:
                self._user_seq += 1
                user_id = WEB_USER_ID_BASE - self._user_seq
                self._username_to_user_id[username] = user_id
            session = WebSession(
                token=token,
                username=username,
                user_id=user_id,
                expires_at=now + max(60, ttl_seconds),
            )
            self._sessions[token] = session
            return session

    async def get(self, token: str | None) -> WebSession | None:
        if not token:
            return None
        async with self._lock:
            session = self._sessions.get(token)
            if session is None:
                return None
            if session.expires_at <= time.time():
                self._sessions.pop(token, None)
                return None
            return session

    async def delete(self, token: str | None) -> None:
        if not token:
            return
        async with self._lock:
            self._sessions.pop(token, None)


class WebEventHub:
    def __init__(self):
        self._subscribers: dict[int, set[asyncio.Queue[dict[str, Any]]]] = {}
        self._pending_approvals: dict[int, dict[int, dict[str, Any]]] = {}
        self._lock = asyncio.Lock()

    async def subscribe(self, user_id: int) -> asyncio.Queue[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=256)
        async with self._lock:
            self._subscribers.setdefault(user_id, set()).add(queue)
        return queue

    async def unsubscribe(self, user_id: int, queue: asyncio.Queue[dict[str, Any]]) -> None:
        async with self._lock:
            subscribers = self._subscribers.get(user_id)
            if not subscribers:
                return
            subscribers.discard(queue)
            if not subscribers:
                self._subscribers.pop(user_id, None)

    async def publish_event(self, user_id: int, event: dict[str, Any]) -> None:
        async with self._lock:
            targets = list(self._subscribers.get(user_id, set()))
        for queue in targets:
            if queue.full():
                try:
                    queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                continue

    async def add_approval(self, user_id: int, request_id: int, payload: dict[str, Any]) -> None:
        async with self._lock:
            self._pending_approvals.setdefault(user_id, {})[request_id] = payload

    async def pop_approval(self, user_id: int, request_id: int) -> dict[str, Any] | None:
        async with self._lock:
            pending = self._pending_approvals.get(user_id)
            if not pending:
                return None
            value = pending.pop(request_id, None)
            if not pending:
                self._pending_approvals.pop(user_id, None)
            return value

    async def list_approvals(self, user_id: int) -> list[dict[str, Any]]:
        async with self._lock:
            pending = self._pending_approvals.get(user_id, {})
            return [dict(value) for _, value in sorted(pending.items())]


session_manager = WebSessionManager()
event_hub = WebEventHub()
