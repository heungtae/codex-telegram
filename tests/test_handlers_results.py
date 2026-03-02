import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

from telegram.error import Conflict

from codex.commands import CommandResult
from bot import handlers
from models import state
from models.user import user_manager


class HandlerResultTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.original_router = state.command_router
        self.mock_router = SimpleNamespace(route=AsyncMock())
        state.command_router = self.mock_router
        self.original_conflict_log_at = handlers._last_conflict_log_at
        handlers._last_conflict_log_at = 0.0
        user_manager._users.clear()
        user_manager._thread_owners.clear()

    def tearDown(self):
        state.command_router = self.original_router
        handlers._last_conflict_log_at = self.original_conflict_log_at

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

    async def test_command_handler_threads_without_args_defaults_to_current_profile(self):
        self.mock_router.route.return_value = CommandResult(
            kind="threads",
            text="Threads by profile:\n...",
            meta={"thread_ids": [], "offset": 0, "limit": 5, "archived": False},
        )
        update = SimpleNamespace(
            effective_user=SimpleNamespace(id=1),
            effective_message=SimpleNamespace(text="/threads"),
        )

        with patch("bot.handlers.wait_for_codex", new=AsyncMock()), \
             patch("bot.handlers.send_reply", new=AsyncMock()), \
             patch("bot.handlers.get", side_effect=lambda key, default=None: default):
            await handlers.command_handler(update, context=SimpleNamespace())

        self.mock_router.route.assert_awaited_once_with("/threads", ["--current-profile"], 1)

    async def test_command_handler_features_kind_uses_feature_keyboard(self):
        self.mock_router.route.return_value = CommandResult(
            kind="features",
            text="Beta features:",
            meta={
                "feature_keys": ["js_repl"],
                "feature_names": {"js_repl": "JavaScript REPL"},
                "feature_enabled": {"js_repl": False},
            },
        )
        update = SimpleNamespace(
            effective_user=SimpleNamespace(id=1),
            effective_message=SimpleNamespace(text="/features"),
        )

        with patch("bot.handlers.wait_for_codex", new=AsyncMock()), \
             patch("bot.handlers.send_reply", new=AsyncMock()) as mock_send_reply, \
             patch("bot.handlers.get", side_effect=lambda key, default=None: default):
            await handlers.command_handler(update, context=SimpleNamespace())

        kwargs = mock_send_reply.await_args.kwargs
        self.assertIn("reply_markup", kwargs)

    async def test_error_handler_conflict_does_not_stop_app(self):
        app = SimpleNamespace(stop_running=Mock())
        context = SimpleNamespace(
            error=Conflict("terminated by other getUpdates request"),
            application=app,
        )
        await handlers.error_handler(update=None, context=context)
        await handlers.error_handler(update=None, context=context)
        app.stop_running.assert_not_called()


if __name__ == "__main__":
    unittest.main()
