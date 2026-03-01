import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from codex.commands import CommandResult
from bot import handlers
from models import state
from models.user import user_manager


class HandlerResultTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.original_router = state.command_router
        self.mock_router = SimpleNamespace(route=AsyncMock())
        state.command_router = self.mock_router
        user_manager._users.clear()
        user_manager._thread_owners.clear()

    def tearDown(self):
        state.command_router = self.original_router

    async def test_command_handler_projects_kind_uses_projects_keyboard(self):
        self.mock_router.route.return_value = CommandResult(
            kind="projects",
            text="Projects:\n...",
            meta={"project_keys": ["default"]},
        )
        update = SimpleNamespace(
            effective_user=SimpleNamespace(id=1),
            effective_message=SimpleNamespace(text="/projects --list"),
        )

        with patch("bot.handlers.wait_for_codex", new=AsyncMock()), \
             patch("bot.handlers.send_reply", new=AsyncMock()) as mock_send_reply, \
             patch("bot.handlers.get", side_effect=lambda key, default=None: default):
            await handlers.command_handler(update, context=SimpleNamespace())

        args = mock_send_reply.await_args.args
        kwargs = mock_send_reply.await_args.kwargs
        self.assertEqual("Projects:\n...", args[1])
        self.assertIn("reply_markup", kwargs)


if __name__ == "__main__":
    unittest.main()
