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
        self.original_codex_client = state.codex_client
        self.original_router = state.command_router
        self.mock_router = SimpleNamespace(route=AsyncMock())
        state.codex_client = SimpleNamespace(call=AsyncMock())
        state.command_router = self.mock_router
        self.original_conflict_log_at = handlers._last_conflict_log_at
        handlers._last_conflict_log_at = 0.0
        user_manager._users.clear()
        user_manager._thread_owners.clear()
        user_manager._thread_projects.clear()
        user_manager._turn_owners.clear()
        user_manager._turn_threads.clear()

    def tearDown(self):
        state.codex_client = self.original_codex_client
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

    async def test_command_handler_guardian_kind_returns_read_only_notice(self):
        self.mock_router.route.return_value = CommandResult(
            kind="guardian_settings",
            text="Guardian settings:",
            meta={
                "enabled": False,
                "timeout_seconds": 8,
                "failure_policy": "manual_fallback",
                "explainability": "decision_only",
            },
        )
        update = SimpleNamespace(
            effective_user=SimpleNamespace(id=1),
            effective_message=SimpleNamespace(text="/guardian"),
        )

        with patch("bot.handlers.wait_for_codex", new=AsyncMock()), \
             patch("bot.handlers.send_reply", new=AsyncMock()) as mock_send_reply, \
             patch("bot.handlers.get", side_effect=lambda key, default=None: default):
            await handlers.command_handler(update, context=SimpleNamespace())

        args = mock_send_reply.await_args.args
        kwargs = mock_send_reply.await_args.kwargs
        self.assertIn("Guardian settings:", args[1])
        self.assertIn("Web UI only", args[1])
        self.assertNotIn("reply_markup", kwargs)

    async def test_command_handler_workspace_changed_includes_main_menu_keyboard(self):
        self.mock_router.route.return_value = CommandResult(
            kind="text",
            text="Project selected: default",
            meta={"workspace_changed": True, "collaboration_mode": "build"},
        )
        user = user_manager.get(1)
        user.set_collaboration_mode("build")
        update = SimpleNamespace(
            effective_user=SimpleNamespace(id=1),
            effective_message=SimpleNamespace(text="/project default"),
        )

        with patch("bot.handlers.wait_for_codex", new=AsyncMock()), \
             patch("bot.handlers.send_reply", new=AsyncMock()) as mock_send_reply, \
             patch("bot.handlers.get", side_effect=lambda key, default=None: default):
            await handlers.command_handler(update, context=SimpleNamespace())

        args = mock_send_reply.await_args.args
        kwargs = mock_send_reply.await_args.kwargs
        self.assertEqual("Project selected: default\nMode: BUILD", args[1])
        self.assertIn("reply_markup", kwargs)

    async def test_start_handler_includes_current_mode_in_welcome(self):
        self.mock_router.route.return_value = CommandResult(kind="text", text="Thread started: thread-1", meta={})
        user_manager.get(1).set_collaboration_mode("plan")
        update = SimpleNamespace(
            effective_user=SimpleNamespace(id=1),
        )

        with patch("bot.handlers.wait_for_codex", new=AsyncMock()), \
             patch("bot.handlers.send_reply", new=AsyncMock()) as mock_send_reply, \
             patch("bot.handlers.get", side_effect=lambda key, default=None: default):
            await handlers.start_handler(update, context=SimpleNamespace())

        self.assertIn("Current mode: PLAN", mock_send_reply.await_args.args[1])

    async def test_error_handler_conflict_does_not_stop_app(self):
        app = SimpleNamespace(stop_running=Mock())
        context = SimpleNamespace(
            error=Conflict("terminated by other getUpdates request"),
            application=app,
        )
        await handlers.error_handler(update=None, context=context)
        await handlers.error_handler(update=None, context=context)
        app.stop_running.assert_not_called()

    async def test_message_handler_bang_command_runs_locally_without_codex_turn(self):
        user = user_manager.get(1)
        user.active_thread_id = "thread-1"
        user.selected_project_path = "/tmp/demo-project"
        update = SimpleNamespace(
            effective_user=SimpleNamespace(id=1),
            message=SimpleNamespace(text="!git status"),
        )

        with patch("bot.handlers.send_reply", new=AsyncMock()) as mock_send_reply, \
             patch("bot.handlers.get", side_effect=lambda key, default=None: default), \
             patch("bot.handlers.run_bang_command", new=AsyncMock(return_value="$ git status\ncwd: /tmp/demo-project\nexit code: 0\n\nstdout:\nOn branch main")) as mock_run, \
             patch("bot.handlers.wait_for_codex", new=AsyncMock()) as mock_wait:
            await handlers.message_handler(update, context=SimpleNamespace())

        mock_run.assert_awaited_once_with("!git status", "/tmp/demo-project")
        mock_wait.assert_not_awaited()
        self.mock_router.route.assert_not_called()
        self.assertIsNone(user.active_turn_id)
        sent_text = mock_send_reply.await_args.args[1]
        self.assertIn("$ git status", sent_text)
        self.assertIn("exit code: 0", sent_text)
        self.assertIn("On branch main", sent_text)

    async def test_message_handler_bang_command_without_body_returns_usage(self):
        update = SimpleNamespace(
            effective_user=SimpleNamespace(id=1),
            message=SimpleNamespace(text="!   "),
        )

        with patch("bot.handlers.send_reply", new=AsyncMock()) as mock_send_reply, \
             patch("bot.handlers.get", side_effect=lambda key, default=None: default), \
             patch("bot.handlers.wait_for_codex", new=AsyncMock()) as mock_wait:
            await handlers.message_handler(update, context=SimpleNamespace())

        mock_wait.assert_not_awaited()
        self.mock_router.route.assert_not_called()
        self.assertEqual("Usage: !<linux command>", mock_send_reply.await_args.args[1])

    async def test_message_handler_sets_turn_start_collaboration_mode_plan(self):
        user = user_manager.get(1)
        user.active_thread_id = "thread-1"
        user.set_collaboration_mode("plan")
        user.set_collaboration_mode_mask(
            {"name": "plan", "mode": "plan", "model": "gpt-5.3-codex", "reasoning_effort": "medium"}
        )
        state.codex_client.call.return_value = {"turn": {"id": "turn-1"}}
        update = SimpleNamespace(
            effective_user=SimpleNamespace(id=1),
            message=SimpleNamespace(text="hello"),
        )

        with patch("bot.handlers.send_reply", new=AsyncMock()), \
             patch("bot.handlers.get", side_effect=lambda key, default=None: default), \
             patch("bot.handlers.wait_for_codex", new=AsyncMock()):
            await handlers.message_handler(update, context=SimpleNamespace())

        state.codex_client.call.assert_awaited_once_with(
            "turn/start",
            {
                "threadId": "thread-1",
                "collaborationMode": {
                    "mode": "plan",
                    "settings": {
                        "model": "gpt-5.3-codex",
                        "reasoning_effort": "medium",
                        "developer_instructions": None,
                    },
                },
                "input": [{"type": "text", "text": "hello"}],
            },
        )

    async def test_message_handler_sets_turn_start_collaboration_mode_default_for_build(self):
        user = user_manager.get(1)
        user.active_thread_id = "thread-1"
        user.set_collaboration_mode("build")
        user.set_collaboration_mode_mask(
            {"name": "default", "mode": "default", "model": "gpt-5.3-codex", "reasoning_effort": "medium"}
        )
        state.codex_client.call.return_value = {"turn": {"id": "turn-2"}}
        update = SimpleNamespace(
            effective_user=SimpleNamespace(id=1),
            message=SimpleNamespace(text="hello"),
        )

        with patch("bot.handlers.send_reply", new=AsyncMock()), \
             patch("bot.handlers.get", side_effect=lambda key, default=None: default), \
             patch("bot.handlers.wait_for_codex", new=AsyncMock()):
            await handlers.message_handler(update, context=SimpleNamespace())

        state.codex_client.call.assert_awaited_once_with(
            "turn/start",
            {
                "threadId": "thread-1",
                "collaborationMode": {
                    "mode": "default",
                    "settings": {
                        "model": "gpt-5.3-codex",
                        "reasoning_effort": "medium",
                        "developer_instructions": None,
                    },
                },
                "input": [{"type": "text", "text": "hello"}],
            },
        )

    async def test_message_handler_fails_when_collaboration_mode_payload_cannot_be_resolved(self):
        user = user_manager.get(1)
        user.active_thread_id = "thread-1"
        user.set_collaboration_mode("plan")
        state.codex_client.call.return_value = {"data": []}
        update = SimpleNamespace(
            effective_user=SimpleNamespace(id=1),
            message=SimpleNamespace(text="hello"),
        )

        with patch("bot.handlers.send_reply", new=AsyncMock()) as mock_send_reply, \
             patch("bot.handlers.get", side_effect=lambda key, default=None: default), \
             patch("bot.handlers.wait_for_codex", new=AsyncMock()):
            await handlers.message_handler(update, context=SimpleNamespace())

        self.assertEqual(
            "Error: Failed to resolve collaboration mode payload for PLAN. Turn was not started.",
            mock_send_reply.await_args_list[-1].args[1],
        )

    async def test_message_handler_resolves_collaboration_mode_from_nested_settings_shape(self):
        user = user_manager.get(1)
        user.active_thread_id = "thread-1"
        user.set_collaboration_mode("plan")
        state.codex_client.call = AsyncMock(
            side_effect=[
                {
                    "data": {
                        "modes": [
                            {"name": "default", "settings": {"model": "gpt-5.3-codex", "reasoningEffort": "medium"}},
                            {"name": "plan", "mode": "plan", "settings": {"model": "gpt-5.3-codex", "reasoningEffort": "high"}},
                        ]
                    }
                },
                {"turn": {"id": "turn-1"}},
            ]
        )
        update = SimpleNamespace(
            effective_user=SimpleNamespace(id=1),
            message=SimpleNamespace(text="hello"),
        )

        with patch("bot.handlers.send_reply", new=AsyncMock()), \
             patch("bot.handlers.get", side_effect=lambda key, default=None: default), \
             patch("bot.handlers.wait_for_codex", new=AsyncMock()):
            await handlers.message_handler(update, context=SimpleNamespace())

        state.codex_client.call.assert_any_await("collaborationMode/list")
        state.codex_client.call.assert_any_await(
            "turn/start",
            {
                "threadId": "thread-1",
                "collaborationMode": {
                    "mode": "plan",
                    "settings": {
                        "model": "gpt-5.3-codex",
                        "reasoning_effort": "high",
                        "developer_instructions": None,
                    },
                },
                "input": [{"type": "text", "text": "hello"}],
            },
        )

    async def test_message_handler_resolves_collaboration_mode_using_default_model_when_preset_has_no_model(self):
        user = user_manager.get(1)
        user.active_thread_id = "thread-1"
        user.set_collaboration_mode("plan")
        state.codex_client.call = AsyncMock(
            side_effect=[
                {"data": [{"name": "Plan", "mode": "plan"}]},
                {"config": {"model": "gpt-5.3-codex"}},
                {"turn": {"id": "turn-1"}},
            ]
        )
        update = SimpleNamespace(
            effective_user=SimpleNamespace(id=1),
            message=SimpleNamespace(text="hello"),
        )

        with patch("bot.handlers.send_reply", new=AsyncMock()), \
             patch("bot.handlers.get", side_effect=lambda key, default=None: default), \
             patch("bot.handlers.wait_for_codex", new=AsyncMock()):
            await handlers.message_handler(update, context=SimpleNamespace())

        state.codex_client.call.assert_any_await(
            "turn/start",
            {
                "threadId": "thread-1",
                "collaborationMode": {
                    "mode": "plan",
                    "settings": {
                        "model": "gpt-5.3-codex",
                        "reasoning_effort": None,
                        "developer_instructions": None,
                    },
                },
                "input": [{"type": "text", "text": "hello"}],
            },
        )


if __name__ == "__main__":
    unittest.main()
