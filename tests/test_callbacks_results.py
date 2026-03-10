import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock
from unittest.mock import patch

from codex.commands import CommandResult
from bot import callbacks
from models import state
from models.user import user_manager


class CallbackResultTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.original_router = state.command_router
        self.mock_router = SimpleNamespace(route=AsyncMock())
        state.command_router = self.mock_router
        self.context = SimpleNamespace(bot=SimpleNamespace(send_message=AsyncMock()))
        user_manager._users.clear()
        user_manager._thread_owners.clear()
        user_manager._thread_projects.clear()

    def tearDown(self):
        state.command_router = self.original_router

    async def test_send_threads_page_uses_main_menu_when_no_thread_ids(self):
        self.mock_router.route.return_value = CommandResult(
            kind="threads",
            text="No threads found.",
            meta={"thread_ids": []},
        )

        await callbacks.send_threads_page(
            context=self.context,
            user_id=1,
            chat_id=100,
            offset=0,
            limit=5,
            archived=False,
            query=None,
        )

        kwargs = self.context.bot.send_message.await_args.kwargs
        self.assertEqual("No threads found.", kwargs["text"])
        self.assertIn("reply_markup", kwargs)
        self.mock_router.route.assert_awaited_once_with(
            "/threads",
            ["--limit", "5", "--offset", "0", "--current-profile"],
            1,
        )

    async def test_send_skills_picker_uses_picker_message_on_skills_kind(self):
        self.mock_router.route.return_value = CommandResult(
            kind="skills",
            text="Skills:\n• clean-code",
            meta={"skill_names": ["clean-code"]},
        )

        await callbacks.send_skills_picker(
            context=self.context,
            user_id=1,
            chat_id=100,
            query=None,
        )

        kwargs = self.context.bot.send_message.await_args.kwargs
        self.assertEqual("Skills: choose one to insert template into chat.", kwargs["text"])
        self.assertIn("reply_markup", kwargs)

    async def test_send_features_picker_uses_feature_keyboard_on_features_kind(self):
        self.mock_router.route.return_value = CommandResult(
            kind="features",
            text="Beta features:",
            meta={
                "feature_keys": ["js_repl"],
                "feature_names": {"js_repl": "JavaScript REPL"},
                "feature_enabled": {"js_repl": False},
            },
        )

        await callbacks.send_features_picker(
            context=self.context,
            user_id=1,
            chat_id=100,
            query=None,
        )

        kwargs = self.context.bot.send_message.await_args.kwargs
        self.assertIn("Beta features (toggle checkboxes, then Apply):", kwargs["text"])
        self.assertIn("reply_markup", kwargs)

    async def test_send_guardian_settings_panel_uses_guardian_keyboard(self):
        with patch(
            "bot.callbacks.get_guardian_settings",
            return_value={
                "enabled": False,
                "timeout_seconds": 8,
                "failure_policy": "manual_fallback",
                "explainability": "full_chain",
                "apply_to_methods": ["*"],
            },
        ):
            await callbacks.send_guardian_settings_panel(
                context=self.context,
                user_id=1,
                chat_id=100,
                query=None,
            )

        kwargs = self.context.bot.send_message.await_args.kwargs
        self.assertIn("Guardian settings", kwargs["text"])
        self.assertIn("reply_markup", kwargs)

    async def test_send_reviewer_settings_panel_uses_reviewer_keyboard(self):
        with patch(
            "bot.callbacks.get_reviewer_settings",
            return_value={
                "enabled": False,
                "max_attempts": 3,
                "timeout_seconds": 8,
                "recent_turn_pairs": 3,
            },
        ):
            await callbacks.send_reviewer_settings_panel(
                context=self.context,
                user_id=1,
                chat_id=100,
                query=None,
            )

        kwargs = self.context.bot.send_message.await_args.kwargs
        self.assertIn("Reviewer settings", kwargs["text"])
        self.assertIn("reply_markup", kwargs)


if __name__ == "__main__":
    unittest.main()
