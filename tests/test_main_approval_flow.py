import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import main as app_main
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
        user_manager._thread_projects.clear()
        event_hub._pending_approvals.clear()
        event_hub._subscribers.clear()

    async def asyncTearDown(self):
        state.codex_client = self.original_codex_client
        state.command_router = self.original_command_router
        state.approval_guardian = self.original_approval_guardian
        state.codex_ready.clear()
        user_manager._users.clear()
        user_manager._thread_owners.clear()
        user_manager._thread_projects.clear()
        event_hub._pending_approvals.clear()
        event_hub._subscribers.clear()

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
                user_manager._thread_projects.clear()

                client, approvals = await self._dispatch_policy_request(action=action, submit_result=False)

                self.assertEqual([], approvals)
                client.submit_approval_decision.assert_called_once_with(7, action)

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
        client.submit_approval_decision.assert_any_call(6, "deny")

    async def test_turn_diff_updated_is_forwarded_to_web_and_telegram(self):
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
                    "turn/diff/updated",
                    {
                        "threadId": "thread-1",
                        "turnId": "turn-1",
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
        self.assertIn("Applied patch changes", event["summary"])
        bot.send_message.assert_awaited_once()
        kwargs = bot.send_message.await_args.kwargs
        self.assertEqual(1, kwargs["chat_id"])
        self.assertIn("src/main.py (+12 -3)", kwargs["text"])
        self.assertIn("threadId: thread-1", kwargs["text"])

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
        self.assertEqual("Turn completed. Mode: PLAN.", second["text"])
        bot.send_message.assert_awaited()
        kwargs = bot.send_message.await_args.kwargs
        self.assertEqual(1, kwargs["chat_id"])
        self.assertIn("Turn completed", kwargs["text"])
        self.assertIn("reply_markup", kwargs)

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
        self.assertIn("threadId: thread-1", kwargs["text"])

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


if __name__ == "__main__":
    unittest.main()
