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


@dataclass(slots=True)
class ActiveSubagent:
    thread_id: str
    status: str = ""
    name: str = ""
    role: str = ""
    source_kind: str = ""
    parent_thread_id: str = ""
    turn_id: str = ""
    item_id: str = ""
    updated_at: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        result = {
            "thread_id": self.thread_id,
            "status": self.status,
        }
        if self.name:
            result["name"] = self.name
        if self.role:
            result["role"] = self.role
        if self.source_kind:
            result["source_kind"] = self.source_kind
        if self.parent_thread_id:
            result["parent_thread_id"] = self.parent_thread_id
        if self.turn_id:
            result["turn_id"] = self.turn_id
        if self.item_id:
            result["item_id"] = self.item_id
        return result


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
        self._active_subagents: dict[int, dict[str, ActiveSubagent]] = {}
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

    async def upsert_active_subagent(self, user_id: int, subagent: dict[str, Any]) -> bool:
        thread_id = str(subagent.get("thread_id") or "").strip()
        if not thread_id:
            return False
        status = str(subagent.get("status") or "").strip()
        active = bool(subagent.get("active", True))
        async with self._lock:
            bucket = self._active_subagents.setdefault(user_id, {})
            changed = False
            if not active:
                changed = thread_id in bucket
                bucket.pop(thread_id, None)
            else:
                previous = bucket.get(thread_id)
                updated = ActiveSubagent(
                    thread_id=thread_id,
                    status=status or (previous.status if previous else "active"),
                    name=str(subagent.get("name") or (previous.name if previous else "")).strip(),
                    role=str(subagent.get("role") or (previous.role if previous else "")).strip(),
                    source_kind=str(subagent.get("source_kind") or (previous.source_kind if previous else "")).strip(),
                    parent_thread_id=str(subagent.get("parent_thread_id") or (previous.parent_thread_id if previous else "")).strip(),
                    turn_id=str(subagent.get("turn_id") or (previous.turn_id if previous else "")).strip(),
                    item_id=str(subagent.get("item_id") or (previous.item_id if previous else "")).strip(),
                    updated_at=time.time(),
                )
                changed = previous != updated
                bucket[thread_id] = updated
            if not bucket:
                self._active_subagents.pop(user_id, None)
            return changed

    async def remove_active_subagent(self, user_id: int, thread_id: str | None) -> bool:
        normalized_thread_id = str(thread_id or "").strip()
        if not normalized_thread_id:
            return False
        async with self._lock:
            bucket = self._active_subagents.get(user_id)
            if not bucket:
                return False
            removed = bucket.pop(normalized_thread_id, None) is not None
            if not bucket:
                self._active_subagents.pop(user_id, None)
            return removed

    async def clear_active_subagents_by_turn(self, user_id: int, turn_id: str | None) -> bool:
        normalized_turn_id = str(turn_id or "").strip()
        if not normalized_turn_id:
            return False
        async with self._lock:
            bucket = self._active_subagents.get(user_id)
            if not bucket:
                return False
            before = len(bucket)
            bucket = {
                thread_id: subagent
                for thread_id, subagent in bucket.items()
                if subagent.turn_id != normalized_turn_id
            }
            changed = len(bucket) != before
            if bucket:
                self._active_subagents[user_id] = bucket
            else:
                self._active_subagents.pop(user_id, None)
            return changed

    async def list_active_subagents(self, user_id: int) -> list[dict[str, Any]]:
        async with self._lock:
            bucket = self._active_subagents.get(user_id, {})
            items = [subagent.to_dict() for subagent in bucket.values()]
        items.sort(key=lambda item: (item.get("name") or item.get("thread_id") or "", item.get("thread_id") or ""))
        return items

    async def replace_approval(self, user_id: int, request_id: int, payload: dict[str, Any]) -> list[dict[str, Any]]:
        async with self._lock:
            previous = [dict(value) for value in self._pending_approvals.get(user_id, {}).values()]
            self._pending_approvals[user_id] = {request_id: payload}
            return previous

    async def add_approval(self, user_id: int, request_id: int, payload: dict[str, Any]) -> None:
        await self.replace_approval(user_id, request_id, payload)

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
