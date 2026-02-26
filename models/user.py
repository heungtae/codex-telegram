from dataclasses import dataclass, field
from typing import Any

@dataclass
class UserState:
    user_id: int
    active_thread_id: str | None = None
    waiting_for_approval: dict[str, Any] = field(default_factory=dict)
    last_message_id: int | None = None
    
    def set_thread(self, thread_id: str | None):
        self.active_thread_id = thread_id
    
    def clear_thread(self):
        self.active_thread_id = None


class UserManager:
    def __init__(self):
        self._users: dict[int, UserState] = {}
    
    def get(self, user_id: int) -> UserState:
        if user_id not in self._users:
            self._users[user_id] = UserState(user_id=user_id)
        return self._users[user_id]
    
    def has_active_thread(self, user_id: int) -> bool:
        return self.get(user_id).active_thread_id is not None


user_manager = UserManager()
