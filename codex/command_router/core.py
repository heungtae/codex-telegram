from collections.abc import Awaitable, Callable
from typing import Any
import logging

from .common import command_help, is_help_requested
from .context import RouterContext
from .contracts import CommandResult, error_result, text_result
from .projects import ProjectCommands
from .review import ReviewCommands
from .system import SystemCommands
from .threads import ThreadCommands

logger = logging.getLogger("codex-telegram.codex")


class CommandRouter:
    def __init__(self, codex_client):
        self.ctx = RouterContext(codex=codex_client, logger=logger)
        self.projects = ProjectCommands(self.ctx)
        self.threads = ThreadCommands(self.ctx)
        self.system = SystemCommands(self.ctx)
        self.review = ReviewCommands(self.ctx)

        self._registry: dict[str, Callable[[list[str], int], Awaitable[CommandResult]]] = {
            "/commands": self._dispatch_commands,
            "/start": self._dispatch_start,
            "/resume": self._dispatch_resume,
            "/fork": self._dispatch_fork,
            "/threads": self._dispatch_threads,
            "/read": self._dispatch_read,
            "/archive": self._dispatch_archive,
            "/unarchive": self._dispatch_unarchive,
            "/compact": self._dispatch_compact,
            "/rollback": self._dispatch_rollback,
            "/interrupt": self._dispatch_interrupt,
            "/review": self._dispatch_review,
            "/exec": self._dispatch_exec,
            "/models": self._dispatch_models,
            "/features": self._dispatch_features,
            "/modes": self._dispatch_modes,
            "/skills": self._dispatch_skills,
            "/apps": self._dispatch_apps,
            "/mcp": self._dispatch_mcp,
            "/config": self._dispatch_config,
            "/projects": self._dispatch_projects,
            "/project": self._dispatch_project,
        }

    async def route(self, command: str, args: list[str], user_id: int) -> CommandResult:
        try:
            if is_help_requested(args):
                return CommandResult(kind="usage", text=command_help(command))
            handler = self._registry.get(command)
            if handler is None:
                return text_result(f"Unknown command: {command}")
            return await handler(args, user_id)
        except Exception as exc:
            self.ctx.logger.exception("Error handling command %s", command)
            return error_result(f"Error: {exc}")

    async def handle_project_add_input(self, user_id: int, text: str) -> CommandResult:
        return await self.projects.handle_project_add_input(user_id, text)

    async def _dispatch_commands(self, _args: list[str], _user_id: int) -> CommandResult:
        return await self.system.commands()

    async def _dispatch_start(self, args: list[str], user_id: int) -> CommandResult:
        project = self.projects.resolve_effective_project(user_id)
        return await self.threads.start(args, user_id, project)

    async def _dispatch_resume(self, args: list[str], user_id: int) -> CommandResult:
        return await self.threads.resume(args, user_id)

    async def _dispatch_fork(self, args: list[str], user_id: int) -> CommandResult:
        return await self.threads.fork(args, user_id)

    async def _dispatch_threads(self, args: list[str], user_id: int) -> CommandResult:
        return await self.threads.list_threads(args, user_id)

    async def _dispatch_read(self, args: list[str], user_id: int) -> CommandResult:
        return await self.threads.read(args, user_id)

    async def _dispatch_archive(self, args: list[str], user_id: int) -> CommandResult:
        return await self.threads.archive(args, user_id)

    async def _dispatch_unarchive(self, args: list[str], _user_id: int) -> CommandResult:
        return await self.threads.unarchive(args)

    async def _dispatch_compact(self, args: list[str], _user_id: int) -> CommandResult:
        return await self.threads.compact(args)

    async def _dispatch_rollback(self, args: list[str], _user_id: int) -> CommandResult:
        return await self.threads.rollback(args)

    async def _dispatch_interrupt(self, _args: list[str], user_id: int) -> CommandResult:
        return await self.threads.interrupt(user_id)

    async def _dispatch_review(self, args: list[str], user_id: int) -> CommandResult:
        return await self.review.review_start(args, user_id)

    async def _dispatch_exec(self, args: list[str], _user_id: int) -> CommandResult:
        return await self.system.command_exec(args)

    async def _dispatch_models(self, _args: list[str], _user_id: int) -> CommandResult:
        return await self.system.model_list()

    async def _dispatch_features(self, _args: list[str], _user_id: int) -> CommandResult:
        return await self.system.experimental_feature_list()

    async def _dispatch_modes(self, _args: list[str], _user_id: int) -> CommandResult:
        return await self.system.collaboration_mode_list()

    async def _dispatch_skills(self, args: list[str], _user_id: int) -> CommandResult:
        return await self.system.skills_list(args)

    async def _dispatch_apps(self, _args: list[str], _user_id: int) -> CommandResult:
        return await self.system.app_list()

    async def _dispatch_mcp(self, _args: list[str], _user_id: int) -> CommandResult:
        return await self.system.mcp_server_status()

    async def _dispatch_config(self, _args: list[str], _user_id: int) -> CommandResult:
        return await self.system.config_read()

    async def _dispatch_projects(self, args: list[str], user_id: int) -> CommandResult:
        return await self.projects.projects_command(args, user_id)

    async def _dispatch_project(self, args: list[str], user_id: int) -> CommandResult:
        return await self.projects.project_select(args, user_id)
