from typing import Any
import json

from .common import commands_overview
from .context import RouterContext
from .contracts import CommandResult, text_result, usage_result


class SystemCommands:
    def __init__(self, ctx: RouterContext):
        self.ctx = ctx

    async def commands(self) -> CommandResult:
        return text_result(commands_overview())

    async def command_exec(self, args: list[str]) -> CommandResult:
        if not args:
            return usage_result("Usage: /exec <command>")

        cmd = " ".join(args)
        result = await self.ctx.codex.call("command/exec", {"command": cmd.split()})

        exit_code = result.get("exitCode", -1)
        stdout = result.get("stdout", "")
        stderr = result.get("stderr", "")

        output = f"Exit code: {exit_code}\n\n"
        if stdout:
            output += f"stdout:\n{stdout[:2000]}"
        if stderr:
            output += f"\nstderr:\n{stderr[:2000]}"

        return text_result(output)

    async def model_list(self) -> CommandResult:
        result = await self.ctx.codex.call("model/list", {"limit": 20})

        models = result.get("data", [])
        if not models:
            return text_result("No models available.")

        lines = ["Available models:"]
        model_names: list[str] = []
        for m in models:
            name = m.get("displayName", m.get("id", "unknown"))
            is_default = " (default)" if m.get("isDefault") else ""
            model_names.append(str(name))
            lines.append(f"• {name}{is_default}")

        return text_result("\n".join(lines), model_names=model_names)

    async def experimental_feature_list(self) -> CommandResult:
        result = await self.ctx.codex.call("experimentalFeature/list", {"limit": 20})

        features = result.get("data", [])
        if not features:
            return text_result("No experimental features.")

        lines = ["Experimental features:"]
        for f in features:
            name = f.get("displayName", f.get("name", "unknown"))
            stage = f.get("stage", "unknown")
            enabled = "enabled" if f.get("enabled") else "disabled"
            lines.append(f"• {name} [{stage}] ({enabled})")

        return text_result("\n".join(lines))

    async def collaboration_mode_list(self) -> CommandResult:
        result = await self.ctx.codex.call("collaborationMode/list")

        modes = result.get("data", [])
        if not modes:
            return text_result("No collaboration modes.")

        lines = ["Collaboration modes:"]
        for m in modes:
            name = m.get("name", "unknown")
            lines.append(f"• {name}")

        return text_result("\n".join(lines))

    async def skills_list(self, args: list[str]) -> CommandResult:
        params: dict[str, Any] = {}
        if args:
            params["cwd"] = args[0]

        result = await self.ctx.codex.call("skills/list", params)

        groups = result.get("data", [])
        if not groups:
            return CommandResult(kind="skills", text="No skills found.", meta={"skill_names": []})

        skills: list[dict[str, Any]] = []
        for g in groups:
            if isinstance(g, dict):
                group_skills = g.get("skills", [])
                if isinstance(group_skills, list):
                    skills.extend(group_skills)

        if not skills:
            return CommandResult(kind="skills", text="No skills found.", meta={"skill_names": []})

        lines = ["Skills:"]
        skill_names: list[str] = []
        for s in skills:
            name = (
                s.get("displayName")
                or s.get("name")
                or s.get("id")
                or s.get("slug")
                or "unknown"
            )
            skill_names.append(str(name))
            enabled_value = s.get("enabled")
            if isinstance(enabled_value, bool):
                prefix = "✓" if enabled_value else "✗"
            else:
                prefix = "•"
            lines.append(f"• {prefix} {name}")

        return CommandResult(kind="skills", text="\n".join(lines), meta={"skill_names": skill_names})

    async def app_list(self) -> CommandResult:
        result = await self.ctx.codex.call("app/list", {"limit": 20})

        apps = result.get("data", [])
        if not apps:
            return text_result("No apps available.")

        lines = ["Apps:"]
        for a in apps:
            name = a.get("displayName", a.get("name", a.get("id", "unknown")))
            enabled_value = a.get("enabled")
            if isinstance(enabled_value, bool):
                prefix = "✓" if enabled_value else "✗"
            else:
                prefix = "•"
            lines.append(f"• {prefix} {name}")

        return text_result("\n".join(lines))

    async def mcp_server_status(self) -> CommandResult:
        result = await self.ctx.codex.call("mcpServerStatus/list", {"limit": 20})

        servers = result.get("data", [])
        if not servers:
            return text_result("No MCP servers configured.")

        lines = ["MCP Servers:"]
        for s in servers:
            name = s.get("name", "unknown")
            status = s.get("status", "unknown")
            lines.append(f"• {name} [{status}]")

        return text_result("\n".join(lines))

    async def config_read(self) -> CommandResult:
        result = await self.ctx.codex.call("config/read")

        config = result.get("config", {})
        if not config:
            return text_result("No configuration found.")

        return text_result("```json\n" + json.dumps(config, indent=2) + "\n```")
