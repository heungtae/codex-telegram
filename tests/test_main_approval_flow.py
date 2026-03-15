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
             patch("main.get", side_effect=lambda key, default=None: default), \
             patch("main.get_guardian_settings", return_value=guardian_settings), \
             patch("main.build_approval_policy_context", return_value={"reason": "git commit", "question": ""}), \
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


if __name__ == "__main__":
    unittest.main()
