from dataclasses import dataclass, field
from typing import Any

@dataclass
class UserState:
    user_id: int
    active_thread_id: str | None = None
    waiting_for_approval: dict[str, Any] = field(default_factory=dict)
    last_message_id: int | None = None
    last_listed_thread_ids: list[str] = field(default_factory=list)
    
    def set_thread(self, thread_id: str | None):
        self.active_thread_id = thread_id
    
    def clear_thread(self):
        self.active_thread_id = None

    def set_last_listed_threads(self, thread_ids: list[str]):
        self.last_listed_thread_ids = thread_ids


class UserManager:
    def __init__(self):
        self._users: dict[int, UserState] = {}
    
    def get(self, user_id: int) -> UserState:
        if user_id not in self._users:
            self._users[user_id] = UserState(user_id=user_id)
        return self._users[user_id]
    
    def has_active_thread(self, user_id: int) -> bool:
        return self.get(user_id).active_thread_id is not None

    def find_user_id_by_thread(self, thread_id: str | None) -> int | None:
        if not thread_id:
            return None
        for uid, user in self._users.items():
            if user.active_thread_id == thread_id:
                return uid
        return None


user_manager = UserManager()
