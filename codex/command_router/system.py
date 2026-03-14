from typing import Any
import json

from .common import commands_overview
from .context import RouterContext
from .contracts import CommandResult, text_result, usage_result
from utils.config import get_guardian_settings


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
        result = await self.ctx.codex.call("experimentalFeature/list", {"limit": 200})

        features = result.get("data", [])
        if not isinstance(features, list) or not features:
            return CommandResult(kind="features", text="No beta features found.", meta={"feature_keys": []})

        def _normalize_stage(value: Any) -> str:
            if not isinstance(value, str) or not value.strip():
                return "unknown"
            raw = value.strip()
            converted = []
            for i, ch in enumerate(raw):
                if i > 0 and ch.isupper() and raw[i - 1].islower():
                    converted.append(" ")
                converted.append(ch)
            return "".join(converted).lower()

        feature_keys: list[str] = []
        feature_names: dict[str, str] = {}
        feature_enabled: dict[str, bool] = {}
        for f in features:
            stage = _normalize_stage(f.get("stage"))
            if stage != "beta":
                continue
            key = f.get("id") or f.get("name") or f.get("key")
            if not isinstance(key, str) or not key.strip():
                continue
            key = key.strip()
            name = (
                f.get("displayName")
                or f.get("name")
                or f.get("id")
                or f.get("key")
                or "unknown"
            )
            if key in feature_names:
                continue
            feature_keys.append(key)
            feature_names[key] = str(name)
            feature_enabled[key] = bool(f.get("enabled"))

        if not feature_keys:
            return CommandResult(kind="features", text="No beta features found.", meta={"feature_keys": []})

        lines = ["Beta features:"]
        for key in feature_keys:
            name = feature_names.get(key, key)
            enabled = "enabled" if feature_enabled.get(key, False) else "disabled"
            lines.append(f"• {name} ({key}) [{enabled}]")
        lines.append("")
        lines.append("Use checkboxes below, then press Apply.")
        return CommandResult(
            kind="features",
            text="\n".join(lines),
            meta={
                "feature_keys": feature_keys,
                "feature_names": feature_names,
                "feature_enabled": feature_enabled,
            },
        )

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

    async def guardian_settings(self) -> CommandResult:
        settings = get_guardian_settings()
        lines = [
            "Guardian settings:",
            f"- enabled: {bool(settings.get('enabled', False))}",
            f"- timeout_seconds: {int(settings.get('timeout_seconds', 8))}",
            f"- failure_policy: {settings.get('failure_policy', 'manual_fallback')}",
            f"- explainability: {settings.get('explainability', 'full_chain')}",
            "",
            "Use checkboxes below, then press Apply.",
        ]
        return CommandResult(kind="guardian_settings", text="\n".join(lines), meta=settings)

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
        config_result: dict[str, Any] = {}
        try:
            config_result = await self.ctx.codex.call("config/read")
        except Exception:
            config_result = {}

        servers = result.get("data", [])
        if not servers:
            return text_result("No MCP servers configured.")

        config = config_result.get("config", {})
        if not isinstance(config, dict):
            config = {}
        configured_servers = config.get("mcp_servers", {})
        if not isinstance(configured_servers, dict):
            configured_servers = {}

        def _server_name(server: dict[str, Any]) -> str:
            return str(
                server.get("displayName")
                or server.get("name")
                or server.get("id")
                or "unknown"
            )

        def _status(name: str, server: dict[str, Any]) -> str:
            enabled = server.get("enabled")
            if isinstance(enabled, bool):
                return "enabled" if enabled else "disabled"
            cfg = configured_servers.get(name)
            if isinstance(cfg, dict):
                cfg_enabled = cfg.get("enabled")
                if isinstance(cfg_enabled, bool):
                    return "enabled" if cfg_enabled else "disabled"
                return "enabled"
            return "unknown"

        def _auth_label(server: dict[str, Any], cfg: dict[str, Any] | None) -> str:
            auth_status = server.get("authStatus")
            if isinstance(auth_status, str) and auth_status.strip():
                auth = auth_status.strip()
            elif isinstance(cfg, dict) and isinstance(cfg.get("bearer_token_env_var"), str):
                auth = "bearer_token"
            else:
                return "unknown"

            normalized = []
            for i, ch in enumerate(auth):
                if i > 0 and ch.isupper() and auth[i - 1].islower():
                    normalized.append(" ")
                normalized.append(ch)
            text = "".join(normalized).replace("_", " ").strip().lower()
            if text == "bearer token":
                return "Bearer token"
            if text == "oauth":
                return "OAuth"
            return " ".join(part.capitalize() for part in text.split())

        def _tools(server: dict[str, Any]) -> list[str]:
            value = server.get("tools")
            if isinstance(value, dict):
                return sorted([str(k) for k in value.keys()])
            if isinstance(value, list):
                names: list[str] = []
                for item in value:
                    if isinstance(item, str):
                        names.append(item)
                    elif isinstance(item, dict):
                        name = item.get("name") or item.get("id")
                        if isinstance(name, str) and name:
                            names.append(name)
                return names
            return []

        def _names_from_entries(entries: Any) -> list[str]:
            if not isinstance(entries, list):
                return []
            result_names: list[str] = []
            for entry in entries:
                if isinstance(entry, str):
                    result_names.append(entry)
                    continue
                if not isinstance(entry, dict):
                    continue
                name = (
                    entry.get("displayName")
                    or entry.get("name")
                    or entry.get("id")
                    or entry.get("uri")
                    or entry.get("template")
                )
                if isinstance(name, str) and name:
                    result_names.append(name)
            return result_names

        lines = ["🔌  MCP Tools"]
        for s in servers:
            name = _server_name(s)
            cfg = configured_servers.get(name)
            cfg_dict = cfg if isinstance(cfg, dict) else None
            url = (cfg_dict or {}).get("url")
            url_text = str(url) if isinstance(url, str) and url else "unknown"
            tool_names = _tools(s)
            resource_names = _names_from_entries(s.get("resources"))
            template_names = _names_from_entries(s.get("resourceTemplates"))

            lines.append(f"  • {name}")
            lines.append(f"    • Status: {_status(name, s)}")
            lines.append(f"    • Auth: {_auth_label(s, cfg_dict)}")
            lines.append(f"    • URL: {url_text}")
            lines.append(
                "    • Tools: " + (", ".join(tool_names) if tool_names else "(none)")
            )
            lines.append(
                "    • Resources: " + (", ".join(resource_names) if resource_names else "(none)")
            )
            lines.append(
                "    • Resource templates: "
                + (", ".join(template_names) if template_names else "(none)")
            )

        return text_result("\n".join(lines))

    async def config_read(self) -> CommandResult:
        result = await self.ctx.codex.call("config/read")

        config = result.get("config", {})
        if not config:
            return text_result("No configuration found.")

        return text_result("```json\n" + json.dumps(config, indent=2) + "\n```")
