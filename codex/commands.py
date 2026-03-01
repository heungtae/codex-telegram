from typing import Any
import logging

logger = logging.getLogger("codex-telegram.codex")

COMMAND_HELP: dict[str, str] = {
    "/commands": "List available commands. Usage: /commands",
    "/start": "Create a new thread. Usage: /start [model]",
    "/resume": "Resume a thread. Usage: /resume <thread_id|number>",
    "/fork": "Fork a thread. Usage: /fork <thread_id>",
    "/threads": "List threads. Usage: /threads [--archived|-a] [--full] [--limit N] [--offset N]",
    "/read": "Read thread details. Usage: /read <thread_id|number>",
    "/archive": "Archive a thread. Usage: /archive <thread_id|number>",
    "/unarchive": "Unarchive a thread. Usage: /unarchive <thread_id>",
    "/compact": "Start thread compaction. Usage: /compact <thread_id>",
    "/rollback": "Rollback turns. Usage: /rollback <n_turns>",
    "/interrupt": "Interrupt current turn. Usage: /interrupt",
    "/review": "Start review. Usage: /review [uncommittedChanges|baseBranch|commit|custom]",
    "/exec": "Execute command in Codex app-server. Usage: /exec <command>",
    "/models": "List available models. Usage: /models",
    "/features": "List experimental features. Usage: /features",
    "/modes": "List collaboration modes. Usage: /modes",
    "/skills": "List skills. Usage: /skills [cwd]",
    "/apps": "List apps. Usage: /apps",
    "/mcp": "List MCP server statuses. Usage: /mcp",
    "/config": "Read server configuration. Usage: /config",
}


class CommandRouter:
    def __init__(self, codex_client):
        self.codex = codex_client

    def _normalize_cli_token(self, token: str) -> str:
        # Normalize unicode dash variants so inputs like `—help`, `—-help`, `−h` are accepted.
        value = (token or "").strip()
        value = value.translate(
            str.maketrans(
                {
                    "\u2014": "-",  # em dash
                    "\u2013": "-",  # en dash
                    "\u2212": "-",  # minus sign
                    "\ufe63": "-",  # small hyphen-minus
                    "\uff0d": "-",  # fullwidth hyphen-minus
                }
            )
        )
        lowered = value.lower()
        if lowered.lstrip("-") == "help":
            return "--help"
        if lowered.lstrip("-") == "h":
            return "-h"
        return value

    def _is_help_requested(self, args: list[str]) -> bool:
        for arg in args:
            normalized = self._normalize_cli_token(arg).lower()
            if normalized in ("--help", "-h", "help"):
                return True
        return False

    def _command_help(self, command: str) -> str:
        return COMMAND_HELP.get(command, f"No help available for {command}")

    def _commands_overview(self) -> str:
        lines = ["Available commands:"]
        for command in sorted(COMMAND_HELP.keys()):
            lines.append(f"- {command}")
        lines.append("")
        lines.append("Tip: Use <command> --help for details.")
        return "\n".join(lines)
    
    async def route(self, command: str, args: list[str], user_id: int) -> str:
        try:
            if self._is_help_requested(args):
                return self._command_help(command)
            if command == "/commands":
                return self._commands_overview()
            if command == "/start":
                return await self._thread_start(args, user_id)
            elif command == "/resume":
                return await self._thread_resume(args, user_id)
            elif command == "/fork":
                return await self._thread_fork(args)
            elif command == "/threads":
                return await self._thread_list(args, user_id)
            elif command == "/read":
                return await self._thread_read(args, user_id)
            elif command == "/archive":
                return await self._thread_archive(args, user_id)
            elif command == "/unarchive":
                return await self._thread_unarchive(args)
            elif command == "/compact":
                return await self._thread_compact(args)
            elif command == "/rollback":
                return await self._thread_rollback(args)
            elif command == "/interrupt":
                return await self._turn_interrupt(user_id)
            elif command == "/review":
                return await self._review_start(args, user_id)
            elif command == "/exec":
                return await self._command_exec(args)
            elif command == "/models":
                return await self._model_list()
            elif command == "/features":
                return await self._experimental_feature_list()
            elif command == "/modes":
                return await self._collaboration_mode_list()
            elif command == "/skills":
                return await self._skills_list(args)
            elif command == "/apps":
                return await self._app_list()
            elif command == "/mcp":
                return await self._mcp_server_status()
            elif command == "/config":
                return await self._config_read()
            else:
                return f"Unknown command: {command}"
        except Exception as e:
            logger.exception(f"Error handling command {command}")
            return f"Error: {str(e)}"
    
    async def _thread_start(self, args: list[str], user_id: int) -> str:
        from models.user import user_manager
        
        params: dict[str, Any] = {}
        if args:
            params["model"] = args[0]
        
        result = await self.codex.call("thread/start", params)
        thread_id = result.get("thread", {}).get("id")
        
        if thread_id:
            user_manager.get(user_id).set_thread(thread_id)
        
        return f"Thread started: {thread_id}"
    
    def _resolve_thread_arg(self, arg: str, user_id: int) -> tuple[str | None, str | None]:
        from models.user import user_manager

        candidate = (arg or "").strip()
        if not candidate:
            return None, "Missing thread identifier."
        if candidate.isdigit():
            idx = int(candidate)
            listed = user_manager.get(user_id).last_listed_thread_ids
            if idx < 1 or idx > len(listed):
                return None, f"Invalid thread number: {candidate}. Run /threads first."
            return listed[idx - 1], None
        return candidate, None

    def _thread_conversation(self, thread: dict[str, Any] | None) -> str:
        t = thread or {}
        value = (
            t.get("preview")
            or t.get("conversation")
            or t.get("name")
            or t.get("title")
            or t.get("summary")
        )
        if isinstance(value, str) and value.strip():
            return value.strip()
        return "Untitled"

    def _extract_turns(self, result: dict[str, Any], thread: dict[str, Any]) -> list[dict[str, Any]]:
        def to_turn_list(value: Any) -> list[dict[str, Any]]:
            if isinstance(value, list):
                return [v for v in value if isinstance(v, dict)]
            if isinstance(value, dict):
                data = value.get("data")
                if isinstance(data, list):
                    return [v for v in data if isinstance(v, dict)]
            return []

        turns = to_turn_list(result.get("turns"))
        if turns:
            return turns
        return to_turn_list(thread.get("turns"))

    def _first_text(self, value: Any) -> str | None:
        if isinstance(value, str) and value.strip():
            return value.strip()
        if isinstance(value, dict):
            for key in ("text", "message", "delta", "summary", "preview", "content"):
                found = self._first_text(value.get(key))
                if found:
                    return found
            return None
        if isinstance(value, list):
            for item in value:
                found = self._first_text(item)
                if found:
                    return found
            return None
        return None

    def _extract_preview(self, result: dict[str, Any], thread: dict[str, Any], turns: list[dict[str, Any]]) -> str:
        direct = (
            self._first_text(thread.get("preview"))
            or self._first_text(thread.get("summary"))
            or self._first_text(result.get("preview"))
            or self._first_text(result.get("summary"))
        )
        if direct:
            return direct

        for turn in reversed(turns):
            text = (
                self._first_text(turn.get("summary"))
                or self._first_text(turn.get("preview"))
                or self._first_text(turn.get("text"))
                or self._first_text(turn.get("items"))
                or self._first_text(turn.get("output"))
            )
            if text:
                return text
        return "(no preview)"

    async def _thread_resume(self, args: list[str], user_id: int) -> str:
        from models.user import user_manager
        
        if not args:
            return "Usage: /resume <thread_id|number>"
        
        thread_id, err = self._resolve_thread_arg(args[0], user_id)
        if err:
            return err
        await self.codex.call("thread/resume", {"threadId": thread_id})
        
        user_manager.get(user_id).set_thread(thread_id)
        
        return f"Thread resumed: {thread_id}"
    
    async def _thread_fork(self, args: list[str]) -> str:
        if not args:
            return "Usage: /fork <thread_id>"
        
        thread_id = args[0]
        result = await self.codex.call("thread/fork", {"threadId": thread_id})
        
        new_thread_id = result.get("thread", {}).get("id")
        return f"Thread forked: {new_thread_id}"
    
    async def _thread_list(self, args: list[str], user_id: int) -> str:
        from models.user import user_manager

        def _normalize_flag(arg: str) -> str:
            value = (arg or "").strip()
            if value.startswith("\u2014"):  # em dash
                return "--" + value[1:]
            if value.startswith("\u2013"):  # en dash
                return "--" + value[1:]
            return value

        params: dict[str, Any] = {"limit": 5}
        show_full_id = True
        offset: int | None = None
        archived_mode = False
        i = 0
        while i < len(args):
            arg = _normalize_flag(args[i])
            if arg in ("--archived", "-a", "archived"):
                params["archived"] = True
                archived_mode = True
            elif arg in ("--full", "--full-id"):
                show_full_id = True
            elif arg == "--limit":
                if i + 1 >= len(args) or not args[i + 1].isdigit():
                    return "Usage: /threads [--archived] [--full] [--limit N] [--offset N]"
                params["limit"] = max(1, min(100, int(args[i + 1])))
                i += 1
            elif arg == "--offset":
                if i + 1 >= len(args) or not args[i + 1].isdigit():
                    return "Usage: /threads [--archived] [--full] [--limit N] [--offset N]"
                offset = max(0, int(args[i + 1]))
                i += 1
            else:
                return "Usage: /threads [--archived] [--full] [--limit N] [--offset N]"
            i += 1
        
        original_limit = int(params["limit"])
        if offset is not None:
            params["limit"] = min(100, original_limit + offset)

        result = await self.codex.call("thread/list", params)
        
        threads = result.get("data", [])

        def _is_archived_thread(thread: dict[str, Any]) -> bool | None:
            archived_value = thread.get("archived")
            if isinstance(archived_value, bool):
                return archived_value
            status = thread.get("status")
            if isinstance(status, dict):
                status_text = str(status.get("type") or status.get("status") or "").strip().lower()
                if status_text:
                    if "archiv" in status_text:
                        return True
            for key in ("state", "threadState", "lifecycle"):
                value = thread.get(key)
                if isinstance(value, str):
                    text = value.strip().lower()
                    if "archiv" in text:
                        return True
            return None

        recognized = [_is_archived_thread(t) for t in threads if isinstance(t, dict)]
        # Only apply client-side filtering when archived state is explicitly detectable.
        if any(v is True or v is False for v in recognized):
            filtered: list[dict[str, Any]] = []
            for t in threads:
                if not isinstance(t, dict):
                    continue
                archived_state = _is_archived_thread(t)
                if archived_mode:
                    if archived_state is True:
                        filtered.append(t)
                else:
                    if archived_state is not True:
                        filtered.append(t)
            threads = filtered

        if offset is not None:
            threads = threads[offset:]
            if original_limit < len(threads):
                threads = threads[:original_limit]
        if not threads:
            return "No threads found."

        state = user_manager.get(user_id)
        listed_ids: list[str] = []
        
        page_number = (offset // original_limit) + 1 if offset is not None else 1
        row_start = (offset or 0) + 1
        row_end = (offset or 0) + len(threads)
        title = "Archived Threads:" if archived_mode else "Threads:"
        lines = [title, f"Page {page_number} (rows {row_start}-{row_end})", ""]
        lines.append(f"{'no':>3}  {'created at':<20}  {'threadId':<36}  conversation")
        lines.append(f"{'-' * 3}  {'-' * 20}  {'-' * 36}  {'-' * 12}")
        for idx, t in enumerate(threads, 1):
            name = self._thread_conversation(t)
            tid = t.get("id", "")
            created_at = t.get("createdAt") or t.get("created_at") or "-"
            if isinstance(tid, str) and tid:
                listed_ids.append(tid)
            row_no = (offset or 0) + idx
            status = " [active]" if state.active_thread_id and tid == state.active_thread_id else ""
            display_id = tid if show_full_id else (f"{tid[:12]}..." if tid else "unknown")
            created_display = str(created_at).replace("\n", " ")[:20]
            conversation_display = str(name).replace("\n", " ").strip()[:120]
            lines.append(
                f"{row_no:>3}  {created_display:<20}  {display_id:<36}  {conversation_display}{status}"
            )

        state.set_last_listed_threads(listed_ids)
        lines.append("")
        if archived_mode:
            lines.append("Tip: Use the buttons below (Unarchive/Read, Prev/Next).")
        else:
            lines.append("Tip: Use the buttons below (Resume/Read/Archive, Prev/Next).")
        
        return "\n".join(lines)
    
    async def _thread_read(self, args: list[str], user_id: int) -> str:
        if not args:
            return "Usage: /read <thread_id|number>"
        
        thread_id, err = self._resolve_thread_arg(args[0], user_id)
        if err:
            return err
        result = await self.codex.call("thread/read", {"threadId": thread_id, "includeTurns": True})
        
        thread = result.get("thread", {})
        name = self._thread_conversation(thread)
        status = thread.get("status", {}).get("type", "unknown")
        turns = self._extract_turns(result, thread)
        preview = self._extract_preview(result, thread, turns).replace("\n", " ").strip()[:500]

        return (
            f"Thread: {name}\n"
            f"Status: {status}\n"
            f"ID: {thread_id}\n"
            f"Turns: {len(turns)}\n"
            f"Preview: {preview}"
        )
    
    async def _thread_archive(self, args: list[str], user_id: int) -> str:
        if not args:
            return "Usage: /archive <thread_id|number>"
        
        thread_id, err = self._resolve_thread_arg(args[0], user_id)
        if err:
            return err
        await self.codex.call("thread/archive", {"threadId": thread_id})
        
        return f"Thread archived: {thread_id}"
    
    async def _thread_unarchive(self, args: list[str]) -> str:
        if not args:
            return "Usage: /unarchive <thread_id>"
        
        thread_id = args[0]
        result = await self.codex.call("thread/unarchive", {"threadId": thread_id})
        
        return f"Thread unarchived: {thread_id}"
    
    async def _thread_compact(self, args: list[str]) -> str:
        if not args:
            return "Usage: /compact <thread_id>"
        
        thread_id = args[0]
        await self.codex.call("thread/compact/start", {"threadId": thread_id})
        
        return f"Compaction started: {thread_id}"
    
    async def _thread_rollback(self, args: list[str]) -> str:
        if not args:
            return "Usage: /rollback <n_turns>"
        
        n = int(args[0])
        result = await self.codex.call("thread/rollback", {"n": n})
        
        thread = result.get("thread", {})
        return f"Rolled back. Thread: {thread.get('id', 'unknown')}"
    
    async def _turn_interrupt(self, user_id: int) -> str:
        from models.user import user_manager
        
        state = user_manager.get(user_id)
        if not state.active_thread_id:
            return "No active thread."

        if not state.active_turn_id:
            return "No running turn to interrupt."

        await self.codex.call(
            "turn/interrupt",
            {"threadId": state.active_thread_id, "turnId": state.active_turn_id},
        )
        state.clear_turn()

        return "Turn interrupted."
    
    async def _review_start(self, args: list[str], user_id: int) -> str:
        from models.user import user_manager
        
        state = user_manager.get(user_id)
        if not state.active_thread_id:
            return "No active thread. Start or resume a thread first."
        
        params: dict[str, Any] = {"threadId": state.active_thread_id}
        
        if args:
            target_type = args[0]
            if target_type in ["uncommittedChanges", "baseBranch", "commit", "custom"]:
                params["target"] = {"type": target_type}
        
        await self.codex.call("review/start", params)
        
        return "Review started."
    
    async def _command_exec(self, args: list[str]) -> str:
        if not args:
            return "Usage: /exec <command>"
        
        cmd = " ".join(args)
        result = await self.codex.call("command/exec", {"command": cmd.split()})
        
        exit_code = result.get("exitCode", -1)
        stdout = result.get("stdout", "")
        stderr = result.get("stderr", "")
        
        output = f"Exit code: {exit_code}\n\n"
        if stdout:
            output += f"stdout:\n{stdout[:2000]}"
        if stderr:
            output += f"\nstderr:\n{stderr[:2000]}"
        
        return output
    
    async def _model_list(self) -> str:
        result = await self.codex.call("model/list", {"limit": 20})
        
        models = result.get("data", [])
        if not models:
            return "No models available."
        
        lines = ["Available models:"]
        for m in models:
            name = m.get("displayName", m.get("id", "unknown"))
            is_default = " (default)" if m.get("isDefault") else ""
            lines.append(f"• {name}{is_default}")
        
        return "\n".join(lines)
    
    async def _experimental_feature_list(self) -> str:
        result = await self.codex.call("experimentalFeature/list", {"limit": 20})
        
        features = result.get("data", [])
        if not features:
            return "No experimental features."
        
        lines = ["Experimental features:"]
        for f in features:
            name = f.get("displayName", f.get("name", "unknown"))
            stage = f.get("stage", "unknown")
            enabled = "enabled" if f.get("enabled") else "disabled"
            lines.append(f"• {name} [{stage}] ({enabled})")
        
        return "\n".join(lines)
    
    async def _collaboration_mode_list(self) -> str:
        result = await self.codex.call("collaborationMode/list")
        
        modes = result.get("data", [])
        if not modes:
            return "No collaboration modes."
        
        lines = ["Collaboration modes:"]
        for m in modes:
            name = m.get("name", "unknown")
            lines.append(f"• {name}")
        
        return "\n".join(lines)
    
    async def _skills_list(self, args: list[str]) -> str:
        params: dict[str, Any] = {}
        if args:
            params["cwd"] = args[0]
        
        result = await self.codex.call("skills/list", params)
        
        groups = result.get("data", [])
        if not groups:
            return "No skills found."

        skills: list[dict[str, Any]] = []
        for g in groups:
            if isinstance(g, dict):
                group_skills = g.get("skills", [])
                if isinstance(group_skills, list):
                    skills.extend(group_skills)

        if not skills:
            return "No skills found."

        lines = ["Skills:"]
        for s in skills:
            name = (
                s.get("displayName")
                or s.get("name")
                or s.get("id")
                or s.get("slug")
                or "unknown"
            )
            enabled_value = s.get("enabled")
            if isinstance(enabled_value, bool):
                prefix = "✓" if enabled_value else "✗"
            else:
                prefix = "•"
            lines.append(f"• {prefix} {name}")
        
        return "\n".join(lines)
    
    async def _app_list(self) -> str:
        result = await self.codex.call("app/list", {"limit": 20})
        
        apps = result.get("data", [])
        if not apps:
            return "No apps available."
        
        lines = ["Apps:"]
        for a in apps:
            name = a.get("displayName", a.get("name", a.get("id", "unknown")))
            enabled_value = a.get("enabled")
            if isinstance(enabled_value, bool):
                prefix = "✓" if enabled_value else "✗"
            else:
                prefix = "•"
            lines.append(f"• {prefix} {name}")
        
        return "\n".join(lines)
    
    async def _mcp_server_status(self) -> str:
        result = await self.codex.call("mcpServerStatus/list", {"limit": 20})
        
        servers = result.get("data", [])
        if not servers:
            return "No MCP servers configured."
        
        lines = ["MCP Servers:"]
        for s in servers:
            name = s.get("name", "unknown")
            status = s.get("status", "unknown")
            lines.append(f"• {name} [{status}]")
        
        return "\n".join(lines)
    
    async def _config_read(self) -> str:
        result = await self.codex.call("config/read")
        
        config = result.get("config", {})
        if not config:
            return "No configuration found."
        
        import json
        return "```json\n" + json.dumps(config, indent=2) + "\n```"
