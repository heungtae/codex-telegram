import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock

from codex.commands import CommandResult
from bot import callbacks
from models import state


class CallbackResultTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.original_router = state.command_router
        self.mock_router = SimpleNamespace(route=AsyncMock())
        state.command_router = self.mock_router
        self.context = SimpleNamespace(bot=SimpleNamespace(send_message=AsyncMock()))

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


if __name__ == "__main__":
    unittest.main()
