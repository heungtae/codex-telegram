from typing import Any
import logging

logger = logging.getLogger("codex-telegram.codex")


class CommandRouter:
    def __init__(self, codex_client):
        self.codex = codex_client
    
    async def route(self, command: str, args: list[str], user_id: int) -> str:
        try:
            if command == "/start":
                return await self._thread_start(args, user_id)
            elif command == "/resume":
                return await self._thread_resume(args, user_id)
            elif command == "/fork":
                return await self._thread_fork(args)
            elif command == "/threads":
                return await self._thread_list(args)
            elif command == "/read":
                return await self._thread_read(args)
            elif command == "/archive":
                return await self._thread_archive(args)
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
    
    async def _thread_resume(self, args: list[str], user_id: int) -> str:
        from models.user import user_manager
        
        if not args:
            return "Usage: /resume <thread_id>"
        
        thread_id = args[0]
        result = await self.codex.call("thread/resume", {"threadId": thread_id})
        
        user_manager.get(user_id).set_thread(thread_id)
        
        return f"Thread resumed: {thread_id}"
    
    async def _thread_fork(self, args: list[str]) -> str:
        if not args:
            return "Usage: /fork <thread_id>"
        
        thread_id = args[0]
        result = await self.codex.call("thread/fork", {"threadId": thread_id})
        
        new_thread_id = result.get("thread", {}).get("id")
        return f"Thread forked: {new_thread_id}"
    
    async def _thread_list(self, args: list[str]) -> str:
        params: dict[str, Any] = {"limit": 20}
        
        if args and args[0] == "--archived":
            params["archived"] = True
        
        result = await self.codex.call("thread/list", params)
        
        threads = result.get("data", [])
        if not threads:
            return "No threads found."
        
        lines = ["Threads:"]
        for t in threads:
            name = t.get("name", "Untitled")
            tid = t.get("id", "")
            lines.append(f"• {tid[:12]}... - {name}")
        
        return "\n".join(lines)
    
    async def _thread_read(self, args: list[str]) -> str:
        if not args:
            return "Usage: /read <thread_id>"
        
        thread_id = args[0]
        result = await self.codex.call("thread/read", {"threadId": thread_id, "includeTurns": True})
        
        thread = result.get("thread", {})
        name = thread.get("name", "Untitled")
        status = thread.get("status", {}).get("type", "unknown")
        
        return f"Thread: {name}\nStatus: {status}\nID: {thread_id}"
    
    async def _thread_archive(self, args: list[str]) -> str:
        if not args:
            return "Usage: /archive <thread_id>"
        
        thread_id = args[0]
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
        
        await self.codex.call("turn/interrupt", {"threadId": state.active_thread_id})
        
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
        
        skills = result.get("data", [])
        if not skills:
            return "No skills found."
        
        lines = ["Skills:"]
        for s in skills:
            name = s.get("name", "unknown")
            enabled = "✓" if s.get("enabled") else "✗"
            lines.append(f"• {enabled} {name}")
        
        return "\n".join(lines)
    
    async def _app_list(self) -> str:
        result = await self.codex.call("app/list", {"limit": 20})
        
        apps = result.get("data", [])
        if not apps:
            return "No apps available."
        
        lines = ["Apps:"]
        for a in apps:
            name = a.get("name", "unknown")
            enabled = "✓" if a.get("enabled") else "✗"
            lines.append(f"• {enabled} {name}")
        
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
