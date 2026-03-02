from dataclasses import dataclass, field
from typing import Any

@dataclass
class UserState:
    user_id: int
    active_thread_id: str | None = None
    active_turn_id: str | None = None
    selected_project_key: str | None = None
    selected_project_name: str | None = None
    selected_project_path: str | None = None
    pending_project_add_key: str | None = None
    pending_project_add_name: str | None = None
    awaiting_project_add_name: bool = False
    awaiting_project_add_path: bool = False
    waiting_for_approval: dict[str, Any] = field(default_factory=dict)
    last_message_id: int | None = None
    last_listed_thread_ids: list[str] = field(default_factory=list)
    last_listed_project_keys: list[str] = field(default_factory=list)
    feature_panel_keys: list[str] = field(default_factory=list)
    feature_panel_names: dict[str, str] = field(default_factory=dict)
    feature_panel_current: dict[str, bool] = field(default_factory=dict)
    feature_panel_draft: dict[str, bool] = field(default_factory=dict)
    guardian_panel_current: dict[str, Any] = field(default_factory=dict)
    guardian_panel_draft: dict[str, Any] = field(default_factory=dict)
    
    def set_thread(self, thread_id: str | None):
        self.active_thread_id = thread_id
    
    def clear_thread(self):
        self.active_thread_id = None
        self.active_turn_id = None

    def set_turn(self, turn_id: str | None):
        self.active_turn_id = turn_id

    def clear_turn(self):
        self.active_turn_id = None

    def set_last_listed_threads(self, thread_ids: list[str]):
        self.last_listed_thread_ids = thread_ids

    def set_last_listed_projects(self, project_keys: list[str]):
        self.last_listed_project_keys = project_keys

    def set_feature_panel(self, keys: list[str], names: dict[str, str], current: dict[str, bool]):
        self.feature_panel_keys = [k for k in keys if isinstance(k, str) and k]
        self.feature_panel_names = {
            k: v for k, v in names.items() if isinstance(k, str) and k and isinstance(v, str) and v
        }
        self.feature_panel_current = {k: bool(current.get(k, False)) for k in self.feature_panel_keys}
        self.feature_panel_draft = dict(self.feature_panel_current)

    def set_guardian_panel(self, current: dict[str, Any]):
        enabled_raw = current.get("enabled", False)
        if isinstance(enabled_raw, bool):
            enabled = enabled_raw
        else:
            enabled = str(enabled_raw).strip().lower() in {"1", "true", "yes", "on"}
        timeout_raw = current.get("timeout_seconds", 8)
        timeout = timeout_raw if isinstance(timeout_raw, int) and timeout_raw > 0 else 8
        normalized = {
            "enabled": enabled,
            "timeout_seconds": timeout,
            "failure_policy": str(current.get("failure_policy", "manual_fallback")),
            "explainability": str(current.get("explainability", "full_chain")),
        }
        self.guardian_panel_current = normalized
        self.guardian_panel_draft = dict(normalized)

    def set_project(self, key: str, name: str, path: str):
        self.selected_project_key = key
        self.selected_project_name = name
        self.selected_project_path = path

    def clear_project(self):
        self.selected_project_key = None
        self.selected_project_name = None
        self.selected_project_path = None

    def start_project_add_flow(self, key: str):
        self.pending_project_add_key = key
        self.pending_project_add_name = None
        self.awaiting_project_add_name = True
        self.awaiting_project_add_path = False

    def set_project_add_name(self, name: str):
        self.pending_project_add_name = name
        self.awaiting_project_add_name = False
        self.awaiting_project_add_path = True

    def clear_project_add_flow(self):
        self.pending_project_add_key = None
        self.pending_project_add_name = None
        self.awaiting_project_add_name = False
        self.awaiting_project_add_path = False


class UserManager:
    def __init__(self):
        self._users: dict[int, UserState] = {}
        self._thread_owners: dict[str, int] = {}
        self._thread_projects: dict[str, str] = {}
    
    def get(self, user_id: int) -> UserState:
        if user_id not in self._users:
            self._users[user_id] = UserState(user_id=user_id)
        return self._users[user_id]
    
    def has_active_thread(self, user_id: int) -> bool:
        return self.get(user_id).active_thread_id is not None

    def set_active_thread(self, user_id: int, thread_id: str | None, project_key: str | None = None):
        user = self.get(user_id)
        user.set_thread(thread_id)
        if isinstance(thread_id, str) and thread_id:
            self._thread_owners[thread_id] = user_id
            if isinstance(project_key, str) and project_key:
                self._thread_projects[thread_id] = project_key

    def clear_active_thread(self, user_id: int):
        user = self.get(user_id)
        user.clear_thread()

    def bind_thread_owner(self, user_id: int, thread_id: str | None):
        if isinstance(thread_id, str) and thread_id:
            self._thread_owners[thread_id] = user_id

    def bind_thread_project(self, thread_id: str | None, project_key: str | None):
        if isinstance(thread_id, str) and thread_id and isinstance(project_key, str) and project_key:
            self._thread_projects[thread_id] = project_key

    def get_thread_project(self, thread_id: str | None) -> str | None:
        if not thread_id:
            return None
        return self._thread_projects.get(thread_id)

    def find_user_id_by_thread(self, thread_id: str | None) -> int | None:
        if not thread_id:
            return None
        owner = self._thread_owners.get(thread_id)
        if owner is not None:
            return owner
        for uid, user in self._users.items():
            if user.active_thread_id == thread_id:
                return uid
        return None

    def find_user_id_by_turn(self, turn_id: str | None) -> int | None:
        if not turn_id:
            return None
        for uid, user in self._users.items():
            if user.active_turn_id == turn_id:
                return uid
        return None


user_manager = UserManager()
