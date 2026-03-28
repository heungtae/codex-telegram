import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import main as app_main
from codex import event_forwarding
from models import state
from models.user import user_manager
from web.runtime import event_hub


class _DummyCodexClient:
    def __init__(self, submit_result: bool):
        self.submit_approval_decision = Mock(return_value=submit_result)
        self.stop = AsyncMock()
        self._approval_handler = None

    def on_any(self, handler):
        self._any_handler = handler

    def on_approval_request(self, handler):
        self._approval_handler = handler


class MainApprovalFlowTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.original_codex_client = state.codex_client
        self.original_command_router = state.command_router
        self.original_approval_guardian = state.approval_guardian
        state.codex_client = None
        state.command_router = None
        state.approval_guardian = None
        state.codex_ready.clear()
        user_manager._users.clear()
        user_manager._thread_owners.clear()
        user_manager._thread_subscribers.clear()
        user_manager._thread_projects.clear()
        user_manager._turn_owners.clear()
        user_manager._turn_subscribers.clear()
        user_manager._turn_threads.clear()
        event_forwarding._turn_token_usage_by_turn_id.clear()
        event_hub._pending_approvals.clear()
        event_hub._subscribers.clear()

    async def asyncTearDown(self):
        state.codex_client = self.original_codex_client
        state.command_router = self.original_command_router
        state.approval_guardian = self.original_approval_guardian
        state.codex_ready.clear()
        user_manager._users.clear()
        user_manager._thread_owners.clear()
        user_manager._thread_subscribers.clear()
        user_manager._thread_projects.clear()
        user_manager._turn_owners.clear()
        user_manager._turn_subscribers.clear()
        user_manager._turn_threads.clear()
        event_forwarding._turn_token_usage_by_turn_id.clear()
        event_hub._pending_approvals.clear()
        event_hub._subscribers.clear()

    @staticmethod
    def _config_getter(overrides: dict[str, object] | None = None):
        values = {
            "telegram.forwarding.app_server_event_level": "DEBUG",
            "telegram.forwarding.app_server_event_allowlist": [
                "item/completed",
                "turn/completed",
                "turn/failed",
                "turn/cancelled",
            ],
            "telegram.forwarding.app_server_event_denylist": ["item/agentMessage/delta"],
            "telegram.forwarding.rules": [],
        }
        if overrides:
            values.update(overrides)
        return lambda key, default=None: values.get(key, default)

    def test_token_usage_format_uses_k_suffix_for_large_values(self):
        text = event_forwarding.format_token_usage(
            {
                "input_tokens": 120010,
                "output_tokens": 1744,
                "cached_input_tokens": 55936,
                "reasoning_tokens": 551,
                "total_tokens": 2_500_000_000,
            }
        )

        self.assertEqual(
            "Token usage: input: 120K, output: 1K, cached input: 55K, reasoning: 551, total: 2.5B",
            text,
        )

    def test_token_usage_format_uses_m_suffix_for_millions(self):
        text = event_forwarding.format_token_usage(
            {
                "input_tokens": 1_250_000,
                "output_tokens": 2_500_000,
                "total_tokens": 3_000_000,
            }
        )

        self.assertEqual(
            "Token usage: input: 1.2M, output: 2.5M, total: 3M",
            text,
        )

    async def _dispatch_policy_request(self, action: str, submit_result: bool):
        client = _DummyCodexClient(submit_result=submit_result)
        router = SimpleNamespace(projects=SimpleNamespace(resolve_effective_project=Mock(return_value=None)))
        guardian = SimpleNamespace(stop=AsyncMock())
        guardian_settings = {
            "enabled": True,
            "apply_to_methods": ["*"],
            "failure_policy": "manual_fallback",
            "explainability": "decision_only",
            "timeout_seconds": 5,
            "rules": [{"name": "test rule", "action": action}],
        }
        policy_match = SimpleNamespace(
            rule_name="test rule",
            action=action,
            matched_fields=["reason"],
        )

        with patch("main.setup_codex", new=AsyncMock(return_value=client)), \
             patch("main.CommandRouter", return_value=router), \
             patch("main.ApprovalGuardianService", return_value=guardian), \
             patch("main.asyncio.to_thread", new=AsyncMock(return_value={"reason": "git commit", "question": ""})), \
             patch("main.get", side_effect=lambda key, default=None: default), \
             patch("main.get_guardian_settings", return_value=guardian_settings), \
             patch("main.match_approval_policy", return_value=policy_match):
            await app_main.post_init(None)
            user_manager.bind_thread_owner(1, "thread-1")
            await client._approval_handler(
                {
                    "id": 7,
                    "method": "item/commandExecution/requestApproval",
                    "threadId": "thread-1",
                }
            )

        approvals = await event_hub.list_approvals(1)
        return client, approvals

    async def test_policy_direct_actions_do_not_fall_back_to_manual_approval(self):
        for action in ("approve", "session", "deny"):
            with self.subTest(action=action):
                state.codex_client = None
                state.command_router = None
                state.approval_guardian = None
                state.codex_ready.clear()
                event_hub._pending_approvals.clear()
                user_manager._users.clear()
                user_manager._thread_owners.clear()
                user_manager._thread_subscribers.clear()
                user_manager._thread_projects.clear()
                user_manager._turn_owners.clear()
                user_manager._turn_subscribers.clear()
                user_manager._turn_threads.clear()

                client, approvals = await self._dispatch_policy_request(action=action, submit_result=False)

                self.assertEqual([], approvals)
                client.submit_approval_decision.assert_called_once_with(7, action, "thread-1")

    async def test_manual_fallback_rule_still_queues_user_approval(self):
        client, approvals = await self._dispatch_policy_request(action="manual_fallback", submit_result=False)

        self.assertEqual(1, len(approvals))
        self.assertEqual(7, approvals[0]["id"])
        self.assertEqual("item/commandExecution/requestApproval", approvals[0]["method"])
        client.submit_approval_decision.assert_not_called()

    async def test_new_manual_approval_supersedes_previous_pending_request(self):
        client = _DummyCodexClient(submit_result=True)
        router = SimpleNamespace(projects=SimpleNamespace(resolve_effective_project=Mock(return_value=None)))
        guardian = SimpleNamespace(stop=AsyncMock())
        guardian_settings = {
            "enabled": False,
            "apply_to_methods": ["*"],
            "failure_policy": "manual_fallback",
            "explainability": "decision_only",
            "timeout_seconds": 5,
            "rules": [],
        }

        with patch("main.setup_codex", new=AsyncMock(return_value=client)), \
             patch("main.CommandRouter", return_value=router), \
             patch("main.ApprovalGuardianService", return_value=guardian), \
             patch("main.asyncio.to_thread", new=AsyncMock(return_value={"reason": "git commit", "question": ""})), \
             patch("main.get", side_effect=lambda key, default=None: default), \
             patch("main.get_guardian_settings", return_value=guardian_settings):
            await app_main.post_init(None)
            user_manager.bind_thread_owner(1, "thread-1")
            await event_hub.add_approval(
                1,
                6,
                {
                    "id": 6,
                    "type": "approval_required",
                    "method": "item/commandExecution/requestApproval",
                },
            )
            await client._approval_handler(
                {
                    "id": 7,
                    "method": "item/commandExecution/requestApproval",
                    "threadId": "thread-1",
                }
            )

        approvals = await event_hub.list_approvals(1)

        self.assertEqual([7], [item["id"] for item in approvals])
        client.submit_approval_decision.assert_any_call(6, "deny", None)

    async def test_turn_diff_updated_is_forwarded_to_web_only_for_apply_patch(self):
        client = _DummyCodexClient(submit_result=True)
        router = SimpleNamespace(projects=SimpleNamespace(resolve_effective_project=Mock(return_value=None)))
        guardian = SimpleNamespace(stop=AsyncMock())
        bot = SimpleNamespace(send_message=AsyncMock())
        telegram_app = SimpleNamespace(bot=bot)
        guardian_settings = {
            "enabled": False,
            "apply_to_methods": ["*"],
            "failure_policy": "manual_fallback",
            "explainability": "decision_only",
            "timeout_seconds": 5,
            "rules": [],
        }

        with patch("main.setup_codex", new=AsyncMock(return_value=client)), \
             patch("main.CommandRouter", return_value=router), \
             patch("main.ApprovalGuardianService", return_value=guardian), \
             patch("main.get", side_effect=lambda key, default=None: default), \
             patch("main.get_guardian_settings", return_value=guardian_settings), \
             patch("main.asyncio.sleep", new=AsyncMock()) as sleep_mock:
            await app_main.post_init(telegram_app)
            user_manager.bind_thread_owner(1, "thread-1")
            queue = await event_hub.subscribe(1)
            try:
                await client._any_handler(
                    "turn/diff/updated",
                    {
                        "threadId": "thread-1",
                        "turnId": "turn-1",
                        "diff": "--- a/src/main.py\n+++ b/src/main.py\n@@ -1 +1 @@\n-old\n+new\n",
                        "files": [
                            {
                                "path": "src/main.py",
                                "change_type": "M",
                                "additions": 12,
                                "deletions": 3,
                            }
                        ],
                    },
                )
                event = await queue.get()
            finally:
                await event_hub.unsubscribe(1, queue)

        self.assertEqual("file_change", event["type"])
        self.assertEqual("thread-1", event["thread_id"])
        self.assertEqual("turn-1", event["turn_id"])
        self.assertEqual("apply_patch", event["source"])
        self.assertEqual("src/main.py", event["files"][0]["path"])
        self.assertIn("+new", event["diff"])
        self.assertIn("Applied patch changes", event["summary"])
        bot.send_message.assert_not_awaited()
        sleep_mock.assert_not_awaited()

    async def test_turn_completed_publishes_system_message_to_web(self):
        client = _DummyCodexClient(submit_result=True)
        router = SimpleNamespace(projects=SimpleNamespace(resolve_effective_project=Mock(return_value=None)))
        guardian = SimpleNamespace(stop=AsyncMock())
        bot = SimpleNamespace(send_message=AsyncMock())
        telegram_app = SimpleNamespace(bot=bot)
        guardian_settings = {
            "enabled": False,
            "apply_to_methods": ["*"],
            "failure_policy": "manual_fallback",
            "explainability": "decision_only",
            "timeout_seconds": 5,
            "rules": [],
        }

        with patch("main.setup_codex", new=AsyncMock(return_value=client)), \
             patch("main.CommandRouter", return_value=router), \
             patch("main.ApprovalGuardianService", return_value=guardian), \
             patch("main.get", side_effect=lambda key, default=None: default), \
             patch("main.get_guardian_settings", return_value=guardian_settings):
            await app_main.post_init(telegram_app)
            user_manager.bind_thread_owner(1, "thread-1")
            queue = await event_hub.subscribe(1)
            try:
                await client._any_handler(
                    "thread/tokenUsage/updated",
                    {
                        "threadId": "thread-1",
                        "turnId": "turn-1",
                        "tokenUsage": {
                            "total": {
                                "totalTokens": 46,
                                "inputTokens": 12,
                                "outputTokens": 34,
                                "reasoningOutputTokens": 5,
                            },
                            "last": {
                                "totalTokens": 10,
                                "inputTokens": 3,
                                "outputTokens": 7,
                            },
                            "modelContextWindow": 258400,
                        },
                    },
                )
                await client._any_handler(
                    "turn/completed",
                    {
                        "threadId": "thread-1",
                        "turnId": "turn-1",
                        "collaboration_mode_kind": "plan",
                    },
                )
                first = await queue.get()
                second = await queue.get()
            finally:
                await event_hub.unsubscribe(1, queue)

        self.assertEqual("turn_completed", first["type"])
        self.assertEqual("system_message", second["type"])
        self.assertEqual(
            "Turn completed. Mode: PLAN.\nToken usage: input: 12, output: 34, reasoning: 5, total: 46",
            second["text"],
        )
        bot.send_message.assert_awaited()
        kwargs = bot.send_message.await_args.kwargs
        self.assertEqual(1, kwargs["chat_id"])
        self.assertIn("Turn completed", kwargs["text"])
        self.assertIn("Token usage: input: 12, output: 34, reasoning: 5, total: 46", kwargs["text"])
        self.assertIn("reply_markup", kwargs)

    async def test_turn_completed_is_forwarded_to_telegram_with_default_forwarding_config(self):
        client = _DummyCodexClient(submit_result=True)
        router = SimpleNamespace(projects=SimpleNamespace(resolve_effective_project=Mock(return_value=None)))
        guardian = SimpleNamespace(stop=AsyncMock())
        bot = SimpleNamespace(send_message=AsyncMock())
        telegram_app = SimpleNamespace(bot=bot)
        guardian_settings = {
            "enabled": False,
            "apply_to_methods": ["*"],
            "failure_policy": "manual_fallback",
            "explainability": "decision_only",
            "timeout_seconds": 5,
            "rules": [],
        }

        with patch("main.setup_codex", new=AsyncMock(return_value=client)), \
             patch("main.CommandRouter", return_value=router), \
             patch("main.ApprovalGuardianService", return_value=guardian), \
             patch("main.get", side_effect=self._config_getter()), \
             patch("main.get_guardian_settings", return_value=guardian_settings):
            await app_main.post_init(telegram_app)
            user_manager.bind_thread_owner(1, "thread-1")
            await client._any_handler(
                "thread/tokenUsage/updated",
                {
                    "threadId": "thread-1",
                    "turnId": "turn-1",
                    "tokenUsage": {
                        "total": {
                            "totalTokens": 46,
                            "inputTokens": 12,
                            "outputTokens": 34,
                            "reasoningOutputTokens": 5,
                        },
                        "modelContextWindow": 258400,
                    },
                },
            )
            await client._any_handler(
                "turn/completed",
                {
                    "threadId": "thread-1",
                    "turnId": "turn-1",
                    "collaboration_mode_kind": "default",
                },
            )

        bot.send_message.assert_awaited_once()
        kwargs = bot.send_message.await_args.kwargs
        self.assertEqual(1, kwargs["chat_id"])
        self.assertIn("[app-server] Turn completed: turn-1 (mode: BUILD)", kwargs["text"])
        self.assertIn("Token usage: input: 12, output: 34, reasoning: 5, total: 46", kwargs["text"])
        self.assertIn("turnId: turn-1", kwargs["text"])
        self.assertIn("reply_markup", kwargs)

    async def test_turn_completed_is_not_forwarded_to_telegram_when_allowlist_excludes_it(self):
        client = _DummyCodexClient(submit_result=True)
        router = SimpleNamespace(projects=SimpleNamespace(resolve_effective_project=Mock(return_value=None)))
        guardian = SimpleNamespace(stop=AsyncMock())
        bot = SimpleNamespace(send_message=AsyncMock())
        telegram_app = SimpleNamespace(bot=bot)
        guardian_settings = {
            "enabled": False,
            "apply_to_methods": ["*"],
            "failure_policy": "manual_fallback",
            "explainability": "decision_only",
            "timeout_seconds": 5,
            "rules": [],
        }

        with patch("main.setup_codex", new=AsyncMock(return_value=client)), \
             patch("main.CommandRouter", return_value=router), \
             patch("main.ApprovalGuardianService", return_value=guardian), \
             patch(
                 "main.get",
                 side_effect=self._config_getter(
                     {"telegram.forwarding.app_server_event_allowlist": ["item/completed"]}
                 ),
             ), \
             patch("main.get_guardian_settings", return_value=guardian_settings):
            await app_main.post_init(telegram_app)
            user_manager.bind_thread_owner(1, "thread-1")
            queue = await event_hub.subscribe(1)
            try:
                await client._any_handler(
                    "turn/completed",
                    {
                        "threadId": "thread-1",
                        "turnId": "turn-1",
                        "collaboration_mode_kind": "plan",
                    },
                )
                first = await queue.get()
                second = await queue.get()
            finally:
                await event_hub.unsubscribe(1, queue)

        self.assertEqual("turn_completed", first["type"])
        self.assertEqual("system_message", second["type"])
        bot.send_message.assert_not_awaited()

    async def test_error_notification_is_forwarded_to_web_and_telegram(self):
        client = _DummyCodexClient(submit_result=True)
        router = SimpleNamespace(projects=SimpleNamespace(resolve_effective_project=Mock(return_value=None)))
        guardian = SimpleNamespace(stop=AsyncMock())
        bot = SimpleNamespace(send_message=AsyncMock())
        telegram_app = SimpleNamespace(bot=bot)
        guardian_settings = {
            "enabled": False,
            "apply_to_methods": ["*"],
            "failure_policy": "manual_fallback",
            "explainability": "decision_only",
            "timeout_seconds": 5,
            "rules": [],
        }

        with patch("main.setup_codex", new=AsyncMock(return_value=client)), \
             patch("main.CommandRouter", return_value=router), \
             patch("main.ApprovalGuardianService", return_value=guardian), \
             patch("main.get", side_effect=self._config_getter()), \
             patch("main.get_guardian_settings", return_value=guardian_settings):
            await app_main.post_init(telegram_app)
            user_manager.bind_thread_owner(1, "thread-1")
            queue = await event_hub.subscribe(1)
            try:
                await client._any_handler(
                    "error",
                    {
                        "threadId": "thread-1",
                        "message": "app-server failed to parse response",
                    },
                )
                first = await queue.get()
            finally:
                await event_hub.unsubscribe(1, queue)

        self.assertEqual("system_message", first["type"])
        self.assertEqual("thread-1", first["thread_id"])
        self.assertIn("app-server failed to parse response", first["text"])
        bot.send_message.assert_awaited_once()
        kwargs = bot.send_message.await_args.kwargs
        self.assertEqual(1, kwargs["chat_id"])
        self.assertIn("app-server failed to parse response", kwargs["text"])

    async def test_turn_completed_without_thread_id_uses_turn_owner_for_telegram(self):
        client = _DummyCodexClient(submit_result=True)
        router = SimpleNamespace(projects=SimpleNamespace(resolve_effective_project=Mock(return_value=None)))
        guardian = SimpleNamespace(stop=AsyncMock())
        bot = SimpleNamespace(send_message=AsyncMock())
        telegram_app = SimpleNamespace(bot=bot)
        guardian_settings = {
            "enabled": False,
            "apply_to_methods": ["*"],
            "failure_policy": "manual_fallback",
            "explainability": "decision_only",
            "timeout_seconds": 5,
            "rules": [],
        }

        with patch("main.setup_codex", new=AsyncMock(return_value=client)), \
             patch("main.CommandRouter", return_value=router), \
             patch("main.ApprovalGuardianService", return_value=guardian), \
             patch("main.get", side_effect=lambda key, default=None: default), \
             patch("main.get_guardian_settings", return_value=guardian_settings):
            await app_main.post_init(telegram_app)
            user_manager.get(1).set_turn("turn-1")
            queue = await event_hub.subscribe(1)
            try:
                await client._any_handler(
                    "turn/completed",
                    {
                        "turnId": "turn-1",
                        "collaboration_mode_kind": "plan",
                    },
                )
                first = await queue.get()
                second = await queue.get()
            finally:
                await event_hub.unsubscribe(1, queue)

        self.assertEqual("turn_completed", first["type"])
        self.assertEqual("system_message", second["type"])
        self.assertEqual("Turn completed. Mode: PLAN.", second["text"])
        bot.send_message.assert_awaited()
        kwargs = bot.send_message.await_args.kwargs
        self.assertEqual(1, kwargs["chat_id"])
        self.assertIn("Turn completed", kwargs["text"])
        self.assertIn("reply_markup", kwargs)

    async def test_turn_completed_without_ids_uses_single_active_turn_owner_for_telegram(self):
        client = _DummyCodexClient(submit_result=True)
        router = SimpleNamespace(projects=SimpleNamespace(resolve_effective_project=Mock(return_value=None)))
        guardian = SimpleNamespace(stop=AsyncMock())
        bot = SimpleNamespace(send_message=AsyncMock())
        telegram_app = SimpleNamespace(bot=bot)
        guardian_settings = {
            "enabled": False,
            "apply_to_methods": ["*"],
            "failure_policy": "manual_fallback",
            "explainability": "decision_only",
            "timeout_seconds": 5,
            "rules": [],
        }

        with patch("main.setup_codex", new=AsyncMock(return_value=client)), \
             patch("main.CommandRouter", return_value=router), \
             patch("main.ApprovalGuardianService", return_value=guardian), \
             patch("main.get", side_effect=lambda key, default=None: default), \
             patch("main.get_guardian_settings", return_value=guardian_settings):
            await app_main.post_init(telegram_app)
            user_manager.get(1).set_turn("turn-1")
            queue = await event_hub.subscribe(1)
            try:
                await client._any_handler(
                    "turn/completed",
                    {
                        "collaboration_mode_kind": "plan",
                    },
                )
                first = await queue.get()
                second = await queue.get()
            finally:
                await event_hub.unsubscribe(1, queue)

        self.assertEqual("turn_completed", first["type"])
        self.assertEqual("system_message", second["type"])
        self.assertEqual("Turn completed. Mode: PLAN.", second["text"])
        bot.send_message.assert_awaited()
        kwargs = bot.send_message.await_args.kwargs
        self.assertEqual(1, kwargs["chat_id"])
        self.assertIn("Turn completed", kwargs["text"])
        self.assertIn("reply_markup", kwargs)

    async def test_turn_cancelled_publishes_turn_cancelled_event_to_web(self):
        client = _DummyCodexClient(submit_result=True)
        router = SimpleNamespace(projects=SimpleNamespace(resolve_effective_project=Mock(return_value=None)))
        guardian = SimpleNamespace(stop=AsyncMock())
        bot = SimpleNamespace(send_message=AsyncMock())
        telegram_app = SimpleNamespace(bot=bot)
        guardian_settings = {
            "enabled": False,
            "apply_to_methods": ["*"],
            "failure_policy": "manual_fallback",
            "explainability": "decision_only",
            "timeout_seconds": 5,
            "rules": [],
        }

        with patch("main.setup_codex", new=AsyncMock(return_value=client)), \
             patch("main.CommandRouter", return_value=router), \
             patch("main.ApprovalGuardianService", return_value=guardian), \
             patch("main.get", side_effect=lambda key, default=None: default), \
             patch("main.get_guardian_settings", return_value=guardian_settings):
            await app_main.post_init(telegram_app)
            user_manager.bind_thread_owner(1, "thread-1")
            queue = await event_hub.subscribe(1)
            try:
                await client._any_handler(
                    "turn/cancelled",
                    {
                        "threadId": "thread-1",
                        "turnId": "turn-1",
                    },
                )
                first = await queue.get()
            finally:
                await event_hub.unsubscribe(1, queue)

        self.assertEqual("turn_cancelled", first["type"])
        self.assertEqual("thread-1", first["thread_id"])
        self.assertEqual("turn-1", first["turn_id"])

    async def test_turn_events_are_fanned_out_to_web_and_telegram_subscribers(self):
        client = _DummyCodexClient(submit_result=True)
        router = SimpleNamespace(projects=SimpleNamespace(resolve_effective_project=Mock(return_value=None)))
        guardian = SimpleNamespace(stop=AsyncMock())
        bot = SimpleNamespace(send_message=AsyncMock())
        telegram_app = SimpleNamespace(bot=bot)
        guardian_settings = {
            "enabled": False,
            "apply_to_methods": ["*"],
            "failure_policy": "manual_fallback",
            "explainability": "decision_only",
            "timeout_seconds": 5,
            "rules": [],
        }

        with patch("main.setup_codex", new=AsyncMock(return_value=client)), \
             patch("main.CommandRouter", return_value=router), \
             patch("main.ApprovalGuardianService", return_value=guardian), \
             patch("main.get", side_effect=lambda key, default=None: default), \
             patch("main.get_guardian_settings", return_value=guardian_settings):
            await app_main.post_init(telegram_app)
            user_manager.bind_thread_owner(1, "thread-1")
            user_manager.bind_thread_subscriber(-100, "thread-1")
            web_queue = await event_hub.subscribe(-100)
            tg_queue = await event_hub.subscribe(1)
            try:
                await client._any_handler(
                    "turn/started",
                    {
                        "threadId": "thread-1",
                        "turnId": "turn-1",
                    },
                )
                web_started = await web_queue.get()
                tg_started = await tg_queue.get()
                await client._any_handler(
                    "item/agentMessage/delta",
                    {
                        "turnId": "turn-1",
                        "delta": "hello",
                    },
                )
                web_delta = await web_queue.get()
                tg_delta = await tg_queue.get()
            finally:
                await event_hub.unsubscribe(-100, web_queue)
                await event_hub.unsubscribe(1, tg_queue)

        self.assertEqual("turn_started", web_started["type"])
        self.assertEqual("turn_started", tg_started["type"])
        self.assertEqual("turn_delta", web_delta["type"])
        self.assertEqual("turn_delta", tg_delta["type"])
        self.assertEqual("hello", web_delta["text"])
        self.assertEqual("hello", tg_delta["text"])
        self.assertIn(-100, user_manager.find_user_ids_by_turn("turn-1"))
        self.assertIn(1, user_manager.find_user_ids_by_turn("turn-1"))

    async def test_plan_delta_is_forwarded_to_web_only(self):
        client = _DummyCodexClient(submit_result=True)
        router = SimpleNamespace(projects=SimpleNamespace(resolve_effective_project=Mock(return_value=None)))
        guardian = SimpleNamespace(stop=AsyncMock())
        bot = SimpleNamespace(send_message=AsyncMock())
        telegram_app = SimpleNamespace(bot=bot)
        guardian_settings = {
            "enabled": False,
            "apply_to_methods": ["*"],
            "failure_policy": "manual_fallback",
            "explainability": "decision_only",
            "timeout_seconds": 5,
            "rules": [],
        }

        with patch("main.setup_codex", new=AsyncMock(return_value=client)), \
             patch("main.CommandRouter", return_value=router), \
             patch("main.ApprovalGuardianService", return_value=guardian), \
             patch("main.get", side_effect=lambda key, default=None: default), \
             patch("main.get_guardian_settings", return_value=guardian_settings):
            await app_main.post_init(telegram_app)
            user_manager.bind_thread_owner(1, "thread-1")
            queue = await event_hub.subscribe(1)
            try:
                await client._any_handler(
                    "item/plan/delta",
                    {
                        "threadId": "thread-1",
                        "turnId": "turn-1",
                        "itemId": "turn-1-plan",
                        "delta": "# Plan\n",
                    },
                )
                event = await queue.get()
            finally:
                await event_hub.unsubscribe(1, queue)

        self.assertEqual("plan_delta", event["type"])
        self.assertEqual("turn-1-plan", event["item_id"])
        self.assertEqual("# Plan\n", event["text"])
        bot.send_message.assert_not_awaited()

    async def test_item_completed_agent_message_is_forwarded_as_turn_delta(self):
        client = _DummyCodexClient(submit_result=True)
        router = SimpleNamespace(projects=SimpleNamespace(resolve_effective_project=Mock(return_value=None)))
        guardian = SimpleNamespace(stop=AsyncMock())
        bot = SimpleNamespace(send_message=AsyncMock())
        telegram_app = SimpleNamespace(bot=bot)
        guardian_settings = {
            "enabled": False,
            "apply_to_methods": ["*"],
            "failure_policy": "manual_fallback",
            "explainability": "decision_only",
            "timeout_seconds": 5,
            "rules": [],
        }

        with patch("main.setup_codex", new=AsyncMock(return_value=client)), \
             patch("main.CommandRouter", return_value=router), \
             patch("main.ApprovalGuardianService", return_value=guardian), \
             patch("main.get", side_effect=lambda key, default=None: default), \
             patch("main.get_guardian_settings", return_value=guardian_settings):
            await app_main.post_init(telegram_app)
            user_manager.bind_thread_owner(1, "thread-1")
            queue = await event_hub.subscribe(1)
            try:
                await client._any_handler(
                    "item/completed",
                    {
                        "threadId": "thread-1",
                        "turnId": "turn-1",
                        "item": {
                            "type": "agentMessage",
                            "id": "item-2",
                            "text": "final assistant message",
                        },
                    },
                )
                event = await queue.get()
            finally:
                await event_hub.unsubscribe(1, queue)

        self.assertEqual("turn_delta", event["type"])
        self.assertEqual("final assistant message", event["text"])

    async def test_plan_completed_is_forwarded_to_web_and_telegram(self):
        client = _DummyCodexClient(submit_result=True)
        router = SimpleNamespace(projects=SimpleNamespace(resolve_effective_project=Mock(return_value=None)))
        guardian = SimpleNamespace(stop=AsyncMock())
        bot = SimpleNamespace(send_message=AsyncMock())
        telegram_app = SimpleNamespace(bot=bot)
        guardian_settings = {
            "enabled": False,
            "apply_to_methods": ["*"],
            "failure_policy": "manual_fallback",
            "explainability": "decision_only",
            "timeout_seconds": 5,
            "rules": [],
        }

        with patch("main.setup_codex", new=AsyncMock(return_value=client)), \
             patch("main.CommandRouter", return_value=router), \
             patch("main.ApprovalGuardianService", return_value=guardian), \
             patch("main.get", side_effect=lambda key, default=None: default), \
             patch("main.get_guardian_settings", return_value=guardian_settings):
            await app_main.post_init(telegram_app)
            user_manager.bind_thread_owner(1, "thread-1")
            queue = await event_hub.subscribe(1)
            try:
                await client._any_handler(
                    "item/completed",
                    {
                        "threadId": "thread-1",
                        "turnId": "turn-1",
                        "item": {
                            "type": "plan",
                            "id": "turn-1-plan",
                            "text": "# Final plan\n- first\n",
                        },
                    },
                )
                event = await queue.get()
            finally:
                await event_hub.unsubscribe(1, queue)

        self.assertEqual("plan_completed", event["type"])
        self.assertEqual("turn-1-plan", event["item_id"])
        self.assertEqual("# Final plan\n- first\n", event["text"])
        bot.send_message.assert_awaited_once()
        kwargs = bot.send_message.await_args.kwargs
        self.assertIn("Plan proposal", kwargs["text"])
        self.assertIn("# Final plan", kwargs["text"])
        self.assertIn("turnId: turn-1", kwargs["text"])

    async def test_plan_checklist_is_forwarded_to_web_only(self):
        client = _DummyCodexClient(submit_result=True)
        router = SimpleNamespace(projects=SimpleNamespace(resolve_effective_project=Mock(return_value=None)))
        guardian = SimpleNamespace(stop=AsyncMock())
        bot = SimpleNamespace(send_message=AsyncMock())
        telegram_app = SimpleNamespace(bot=bot)
        guardian_settings = {
            "enabled": False,
            "apply_to_methods": ["*"],
            "failure_policy": "manual_fallback",
            "explainability": "decision_only",
            "timeout_seconds": 5,
            "rules": [],
        }

        with patch("main.setup_codex", new=AsyncMock(return_value=client)), \
             patch("main.CommandRouter", return_value=router), \
             patch("main.ApprovalGuardianService", return_value=guardian), \
             patch("main.get", side_effect=lambda key, default=None: default), \
             patch("main.get_guardian_settings", return_value=guardian_settings):
            await app_main.post_init(telegram_app)
            user_manager.bind_thread_owner(1, "thread-1")
            queue = await event_hub.subscribe(1)
            try:
                await client._any_handler(
                    "turn/plan/updated",
                    {
                        "threadId": "thread-1",
                        "turnId": "turn-1",
                        "explanation": "Working plan",
                        "plan": [
                            {"step": "Inspect protocol", "status": "completed"},
                            {"step": "Render UI", "status": "inProgress"},
                        ],
                    },
                )
                event = await queue.get()
            finally:
                await event_hub.unsubscribe(1, queue)

        self.assertEqual("plan_checklist", event["type"])
        self.assertEqual("Working plan", event["explanation"])
        self.assertEqual(
            [
                {"step": "Inspect protocol", "status": "completed"},
                {"step": "Render UI", "status": "inProgress"},
            ],
            event["plan"],
        )
        bot.send_message.assert_not_awaited()

    async def test_reasoning_events_are_forwarded_to_web_only(self):
        client = _DummyCodexClient(submit_result=True)
        router = SimpleNamespace(projects=SimpleNamespace(resolve_effective_project=Mock(return_value=None)))
        guardian = SimpleNamespace(stop=AsyncMock())
        bot = SimpleNamespace(send_message=AsyncMock())
        telegram_app = SimpleNamespace(bot=bot)
        guardian_settings = {
            "enabled": False,
            "apply_to_methods": ["*"],
            "failure_policy": "manual_fallback",
            "explainability": "decision_only",
            "timeout_seconds": 5,
            "rules": [],
        }

        with patch("main.setup_codex", new=AsyncMock(return_value=client)), \
             patch("main.CommandRouter", return_value=router), \
             patch("main.ApprovalGuardianService", return_value=guardian), \
             patch("main.get", side_effect=lambda key, default=None: default), \
             patch("main.get_guardian_settings", return_value=guardian_settings):
            await app_main.post_init(telegram_app)
            user_manager.bind_thread_owner(1, "thread-1")
            queue = await event_hub.subscribe(1)
            try:
                await client._any_handler(
                    "item/reasoning/summaryTextDelta",
                    {
                        "threadId": "thread-1",
                        "turnId": "turn-1",
                        "itemId": "reason-1",
                        "delta": "**Inspecting** ",
                        "summaryIndex": 0,
                    },
                )
                first = await queue.get()
                await client._any_handler(
                    "item/completed",
                    {
                        "threadId": "thread-1",
                        "turnId": "turn-1",
                        "item": {
                            "type": "reasoning",
                            "id": "reason-1",
                            "summary_text": ["Inspecting files", "Preparing answer"],
                            "raw_content": ["private notes"],
                        },
                    },
                )
                second = await queue.get()
            finally:
                await event_hub.unsubscribe(1, queue)

        self.assertEqual("reasoning_status", first["type"])
        self.assertEqual("reason-1", first["item_id"])
        self.assertEqual("**Inspecting** ", first["delta"])
        self.assertEqual("reasoning_completed", second["type"])
        self.assertEqual(["Inspecting files", "Preparing answer"], second["summary_text"])
        self.assertEqual(["private notes"], second["raw_content"])
        bot.send_message.assert_not_awaited()

    async def test_web_search_completed_is_forwarded_to_web_only(self):
        client = _DummyCodexClient(submit_result=True)
        router = SimpleNamespace(projects=SimpleNamespace(resolve_effective_project=Mock(return_value=None)))
        guardian = SimpleNamespace(stop=AsyncMock())
        bot = SimpleNamespace(send_message=AsyncMock())
        telegram_app = SimpleNamespace(bot=bot)
        guardian_settings = {
            "enabled": False,
            "apply_to_methods": ["*"],
            "failure_policy": "manual_fallback",
            "explainability": "decision_only",
            "timeout_seconds": 5,
            "rules": [],
        }

        with patch("main.setup_codex", new=AsyncMock(return_value=client)), \
             patch("main.CommandRouter", return_value=router), \
             patch("main.ApprovalGuardianService", return_value=guardian), \
             patch("main.get", side_effect=lambda key, default=None: default), \
             patch("main.get_guardian_settings", return_value=guardian_settings):
            await app_main.post_init(telegram_app)
            user_manager.bind_thread_owner(1, "thread-1")
            queue = await event_hub.subscribe(1)
            try:
                await client._any_handler(
                    "item/completed",
                    {
                        "threadId": "thread-1",
                        "turnId": "turn-1",
                        "item": {
                            "type": "web_search",
                            "id": "search-1",
                            "query": "find docs",
                            "action": {"search": {"query": "find docs"}},
                        },
                    },
                )
                event = await queue.get()
            finally:
                await event_hub.unsubscribe(1, queue)

        self.assertEqual("web_search_item", event["type"])
        self.assertEqual("search-1", event["item_id"])
        self.assertEqual("find docs", event["query"])
        self.assertEqual({"search": {"query": "find docs"}}, event["action"])
        bot.send_message.assert_not_awaited()

    async def test_image_generation_completed_is_forwarded_to_web_only(self):
        client = _DummyCodexClient(submit_result=True)
        router = SimpleNamespace(projects=SimpleNamespace(resolve_effective_project=Mock(return_value=None)))
        guardian = SimpleNamespace(stop=AsyncMock())
        bot = SimpleNamespace(send_message=AsyncMock())
        telegram_app = SimpleNamespace(bot=bot)
        guardian_settings = {
            "enabled": False,
            "apply_to_methods": ["*"],
            "failure_policy": "manual_fallback",
            "explainability": "decision_only",
            "timeout_seconds": 5,
            "rules": [],
        }

        with patch("main.setup_codex", new=AsyncMock(return_value=client)), \
             patch("main.CommandRouter", return_value=router), \
             patch("main.ApprovalGuardianService", return_value=guardian), \
             patch("main.get", side_effect=lambda key, default=None: default), \
             patch("main.get_guardian_settings", return_value=guardian_settings):
            await app_main.post_init(telegram_app)
            user_manager.bind_thread_owner(1, "thread-1")
            queue = await event_hub.subscribe(1)
            try:
                await client._any_handler(
                    "item/completed",
                    {
                        "threadId": "thread-1",
                        "turnId": "turn-1",
                        "item": {
                            "type": "image_generation",
                            "id": "ig-1",
                            "status": "completed",
                            "revised_prompt": "A tiny blue square",
                            "result": "Zm9v",
                            "saved_path": "/tmp/ig-1.png",
                        },
                    },
                )
                event = await queue.get()
            finally:
                await event_hub.unsubscribe(1, queue)

        self.assertEqual("image_generation_item", event["type"])
        self.assertEqual("ig-1", event["item_id"])
        self.assertEqual("completed", event["status"])
        self.assertEqual("A tiny blue square", event["revised_prompt"])
        self.assertEqual("/tmp/ig-1.png", event["saved_path"])
        bot.send_message.assert_not_awaited()

    async def test_context_compacted_is_forwarded_to_web_only(self):
        client = _DummyCodexClient(submit_result=True)
        router = SimpleNamespace(projects=SimpleNamespace(resolve_effective_project=Mock(return_value=None)))
        guardian = SimpleNamespace(stop=AsyncMock())
        bot = SimpleNamespace(send_message=AsyncMock())
        telegram_app = SimpleNamespace(bot=bot)
        guardian_settings = {
            "enabled": False,
            "apply_to_methods": ["*"],
            "failure_policy": "manual_fallback",
            "explainability": "decision_only",
            "timeout_seconds": 5,
            "rules": [],
        }

        with patch("main.setup_codex", new=AsyncMock(return_value=client)), \
             patch("main.CommandRouter", return_value=router), \
             patch("main.ApprovalGuardianService", return_value=guardian), \
             patch("main.get", side_effect=lambda key, default=None: default), \
             patch("main.get_guardian_settings", return_value=guardian_settings):
            await app_main.post_init(telegram_app)
            user_manager.bind_thread_owner(1, "thread-1")
            queue = await event_hub.subscribe(1)
            try:
                await client._any_handler(
                    "thread/compacted",
                    {
                        "threadId": "thread-1",
                        "turnId": "turn-1",
                    },
                )
                event = await queue.get()
            finally:
                await event_hub.unsubscribe(1, queue)

        self.assertEqual("context_compacted_item", event["type"])
        self.assertEqual("Context compacted", event["text"])
        bot.send_message.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
