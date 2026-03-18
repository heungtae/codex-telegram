from typing import Any
import asyncio
import os

from utils.config import get, reload, save_project_profile

from .common import normalize_cli_token
from .context import RouterContext
from .contracts import CommandResult, text_result, usage_result


class ProjectCommands:
    def __init__(self, ctx: RouterContext):
        self.ctx = ctx

    def load_project_profiles(self) -> tuple[list[dict[str, str]], str | None]:
        projects_raw = get("projects", {})
        default_key = get("project")
        profiles: list[dict[str, str]] = []
        if isinstance(projects_raw, dict):
            for key, value in projects_raw.items():
                if not isinstance(key, str) or not isinstance(value, dict):
                    continue
                name = value.get("name")
                path = value.get("path")
                if not isinstance(name, str) or not name.strip():
                    continue
                if not isinstance(path, str) or not path.strip():
                    continue
                profiles.append({"key": key, "name": name.strip(), "path": path.strip()})
        return profiles, default_key if isinstance(default_key, str) else None

    def resolve_effective_project(self, user_id: int) -> dict[str, str] | None:
        from models.user import user_manager

        state = user_manager.get(user_id)
        if (
            isinstance(state.selected_project_key, str)
            and isinstance(state.selected_project_name, str)
            and isinstance(state.selected_project_path, str)
            and state.selected_project_key
            and state.selected_project_name
            and state.selected_project_path
        ):
            return {
                "key": state.selected_project_key,
                "name": state.selected_project_name,
                "path": state.selected_project_path,
            }

        profiles, default_key = self.load_project_profiles()
        if not profiles:
            cwd = os.getcwd()
            return {"key": "current", "name": "current workspace", "path": cwd}
        if default_key:
            for p in profiles:
                if p["key"] == default_key:
                    return p
        cwd = os.getcwd()
        return {"key": "current", "name": "current workspace", "path": cwd}

    async def projects_command(self, args: list[str], user_id: int) -> CommandResult:
        def _flag_word(token: str) -> str:
            value = normalize_cli_token(token).strip().lower()
            return value.lstrip("-—–−﹣－")

        if not args:
            return await self.projects_list(user_id)
        normalized = [normalize_cli_token(a).lower() for a in args]
        normalized_words = [_flag_word(a) for a in args]
        if any(a in ("--list", "-l", "list") for a in normalized) or any(w == "list" for w in normalized_words):
            return await self.projects_list(user_id)

        first = _flag_word(args[0])
        if len(args) >= 2 and first == "add":
            key = args[1].strip()
            if not key:
                return usage_result("Usage: /projects --add <key>")
            return await self.projects_add_start(user_id, key)

        return usage_result("Usage: /projects --list | /projects --add <key>")

    async def projects_list(self, user_id: int) -> CommandResult:
        from models.user import user_manager

        profiles, default_key = self.load_project_profiles()
        state = user_manager.get(user_id)
        if not profiles:
            state.set_last_listed_projects([])
            return CommandResult(kind="projects", text="No projects configured.", meta={"project_keys": []})

        lines = ["Projects:", ""]
        lines.append(f"{'no':>3}  {'key':<16}  {'name':<28}  {'path':<52}  status")
        lines.append(f"{'-' * 3}  {'-' * 16}  {'-' * 28}  {'-' * 52}  {'-' * 14}")
        listed_keys: list[str] = []
        for idx, p in enumerate(profiles, 1):
            listed_keys.append(p["key"])
            statuses: list[str] = []
            if default_key and p["key"] == default_key:
                statuses.append("default")
            if state.selected_project_key and p["key"] == state.selected_project_key:
                statuses.append("selected")
            status_text = f"[{', '.join(statuses)}]" if statuses else ""
            lines.append(
                f"{idx:>3}  {p['key'][:16]:<16}  {p['name'][:28]:<28}  {p['path'][:52]:<52}  {status_text}"
            )
        state.set_last_listed_projects(listed_keys)
        lines.append("")
        lines.append("Tip: /project <key|number|name>")
        return CommandResult(kind="projects", text="\n".join(lines), meta={"project_keys": listed_keys})

    async def projects_add_start(self, user_id: int, key: str) -> CommandResult:
        from models.user import user_manager

        cleaned_key = key.strip()
        if not cleaned_key:
            return usage_result("Usage: /projects --add <key>")
        if not all(ch.isalnum() or ch in ("_", "-") for ch in cleaned_key):
            return text_result("Invalid project key. Use letters, numbers, '_' or '-'.")
        profiles, _ = self.load_project_profiles()
        for p in profiles:
            if p["key"].lower() == cleaned_key.lower():
                return text_result(f"Project key '{cleaned_key}' already exists.")

        state = user_manager.get(user_id)
        state.start_project_add_flow(cleaned_key)
        return text_result(f"Enter project name for key '{cleaned_key}':")

    async def handle_project_add_input(self, user_id: int, text: str) -> CommandResult:
        from models.user import user_manager

        state = user_manager.get(user_id)
        message = (text or "").strip()
        if state.awaiting_project_add_name:
            if not message:
                return text_result("Project name must not be empty. Enter project name:")
            state.set_project_add_name(message)
            return text_result("Enter project path:")

        if state.awaiting_project_add_path:
            if not message:
                return text_result("Project path must not be empty. Enter project path:")
            key = state.pending_project_add_key
            name = state.pending_project_add_name
            if not key or not name:
                state.clear_project_add_flow()
                return text_result("Project add flow reset. Use /projects --add <key> again.")
            try:
                save_project_profile(key, name, message)
                reload()
            except ValueError as exc:
                state.clear_project_add_flow()
                return text_result(f"Failed to add project: {exc}")
            state.clear_project_add_flow()
            return text_result(
                f"Project added: {key} - {name}\n"
                f"Path: {message}\n"
                f"Use /project {key} to select it."
            )
        return text_result("No pending project add flow. Use /projects --add <key>.")

    async def project_select(self, args: list[str], user_id: int) -> CommandResult:
        from models.user import user_manager

        if not args:
            return usage_result("Usage: /project <key|number|name>")

        profiles, _ = self.load_project_profiles()
        if not profiles:
            return CommandResult(kind="projects", text="No projects configured.", meta={"project_keys": []})

        target = " ".join(args).strip()
        selected: dict[str, str] | None = None
        if target.isdigit():
            idx = int(target)
            if idx < 1 or idx > len(profiles):
                return text_result("Project not found. Run /projects --list.")
            selected = profiles[idx - 1]
        else:
            for p in profiles:
                if p["key"] == target:
                    selected = p
                    break
            if selected is None:
                matched = [p for p in profiles if p["name"].lower() == target.lower()]
                if len(matched) > 1:
                    return text_result("Ambiguous project name. Use key or number.")
                if len(matched) == 1:
                    selected = matched[0]

        if selected is None:
            return text_result("Project not found. Run /projects --list.")

        state = user_manager.get(user_id)
        state.set_project(selected["key"], selected["name"], selected["path"])
        state.set_collaboration_mode("build")
        state.set_collaboration_mode_mask(None)

        interrupt_message = ""
        if state.active_thread_id and state.active_turn_id:
            try:
                await asyncio.wait_for(
                    self.ctx.codex.call(
                        "turn/interrupt",
                        {"threadId": state.active_thread_id, "turnId": state.active_turn_id},
                    ),
                    timeout=5.0,
                )
                interrupt_message = "\nInterrupted running turn."
            except asyncio.TimeoutError:
                self.ctx.logger.warning(
                    "Timeout interrupting running turn before project switch user_id=%s thread_id=%s turn_id=%s",
                    user_id,
                    state.active_thread_id,
                    state.active_turn_id,
                )
                interrupt_message = "\nInterrupt timed out; proceeding with project switch."
            except Exception:
                self.ctx.logger.exception(
                    "Failed to interrupt running turn before project switch user_id=%s thread_id=%s turn_id=%s",
                    user_id,
                    state.active_thread_id,
                    state.active_turn_id,
                )
                interrupt_message = "\nFailed to interrupt previous running turn."
            finally:
                state.clear_turn()

        new_thread_id: str | None = None
        thread_start_note = ""
        try:
            start_result = await asyncio.wait_for(
                self.ctx.codex.call("thread/start", {"cwd": selected["path"]}),
                timeout=8.0,
            )
            new_thread_id = (start_result.get("thread") or {}).get("id")
            if isinstance(new_thread_id, str) and new_thread_id:
                user_manager.set_active_thread(user_id, new_thread_id, project_key=selected["key"])
                state.clear_turn()
            else:
                user_manager.clear_active_thread(user_id)
                thread_start_note = "\nProject switched, but failed to create a new thread. Run /start."
        except asyncio.TimeoutError:
            user_manager.clear_active_thread(user_id)
            thread_start_note = "\nProject switched, but creating a new thread timed out. Run /start."
        except Exception:
            self.ctx.logger.exception(
                "Failed to start new thread after project switch user_id=%s project_key=%s",
                user_id,
                selected["key"],
            )
            user_manager.clear_active_thread(user_id)
            thread_start_note = "\nProject switched, but failed to create a new thread. Run /start."

        return text_result(
            f"Project selected: {selected['key']} - {selected['name']}\n"
            f"Workspace: {selected['path']}\n"
            f"Thread started: {new_thread_id or 'unknown'}{interrupt_message}{thread_start_note}",
            project_key=selected["key"],
            workspace_changed=True,
            collaboration_mode="build",
        )
