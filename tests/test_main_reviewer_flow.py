import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import main
from models import state
from models.user import user_manager
from codex.result_verifier import VerifierDecision
from utils.workspace_review import WorkspaceChangeReview


class _FakeCodexClient:
    def __init__(self):
        self._on_any = None
        self._on_approval_request = None
        self.stop = AsyncMock()
        self.call = AsyncMock(side_effect=self._call)
        self._thread_read_started = asyncio.Event()
        self._block_thread_read = asyncio.Event()
        self.turn_start_calls = 0

    def on_any(self, handler):
        self._on_any = handler

    def on_approval_request(self, handler):
        self._on_approval_request = handler

    async def _call(self, method, params=None):
        if method == "turn/start":
            self.turn_start_calls += 1
            return {"turn": {"id": f"retry-turn-{self.turn_start_calls}"}}
        if method == "thread/read":
            self._thread_read_started.set()
            await self._block_thread_read.wait()
            return {"thread": {"id": params.get("threadId") if isinstance(params, dict) else ""}, "turns": []}
        return {}


class ReviewerFlowTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.original_codex_client = state.codex_client
        self.original_command_router = state.command_router
        self.original_approval_guardian = state.approval_guardian
        self.original_result_verifier = state.result_verifier
        self.original_codex_ready = state.codex_ready.is_set()
        user_manager._users.clear()
        user_manager._thread_owners.clear()
        user_manager._thread_projects.clear()
        main._validation_tasks.clear()

    async def asyncTearDown(self):
        await main.post_shutdown(None)
        user_manager._users.clear()
        user_manager._thread_owners.clear()
        user_manager._thread_projects.clear()
        state.codex_client = self.original_codex_client
        state.command_router = self.original_command_router
        state.approval_guardian = self.original_approval_guardian
        state.result_verifier = self.original_result_verifier
        if self.original_codex_ready:
            state.codex_ready.set()
        else:
            state.codex_ready.clear()

    async def test_turn_completed_schedules_reviewer_validation_without_blocking_event_reader(self):
        fake_client = _FakeCodexClient()
        fake_guardian = SimpleNamespace(stop=AsyncMock())
        fake_verifier = SimpleNamespace(stop=AsyncMock())
        release_task = asyncio.Event()
        original_create_task = asyncio.create_task

        async def scheduled_validation_placeholder():
            await release_task.wait()

        def create_task_spy(coro, *, name=None):
            coro.close()
            return original_create_task(scheduled_validation_placeholder(), name=name)

        with patch("main.setup_codex", new=AsyncMock(return_value=fake_client)), \
             patch("main.CommandRouter", return_value=SimpleNamespace()), \
             patch("main.ApprovalGuardianService", return_value=fake_guardian), \
             patch("main.ResultVerifierService", return_value=fake_verifier), \
             patch("main.asyncio.create_task", side_effect=create_task_spy) as mock_create_task, \
             patch("main.event_hub.publish_event", new=AsyncMock()), \
             patch("main.get", side_effect=lambda key, default=None: default):
            await main.post_init(None)
            self.assertIsNotNone(fake_client._on_any)

            user_id = -1
            thread_id = "thread-1"
            turn_id = "turn-1"
            user_manager.bind_thread_owner(user_id, thread_id)
            state_user = user_manager.get(user_id)
            state_user.set_thread(thread_id)
            state_user.set_turn(turn_id)
            state_user.set_validation_session(thread_id, "hello", 1, 3, workspace_path="/tmp/workspace")
            state_user.validation_session.set_turn(turn_id)

            await asyncio.wait_for(
                fake_client._on_any(
                    "turn/completed",
                    {
                        "threadId": thread_id,
                        "turn": {"id": turn_id, "status": "completed", "items": [], "error": None},
                    },
                ),
                timeout=0.1,
            )

            for _ in range(10):
                if main._validation_tasks:
                    break
                await asyncio.sleep(0.01)
            self.assertTrue(main._validation_tasks)
            self.assertGreaterEqual(mock_create_task.call_count, 1)
            release_task.set()
            await asyncio.wait_for(asyncio.gather(*list(main._validation_tasks)), timeout=0.2)

    async def test_reviewer_retry_starts_new_turn_from_code_change_feedback(self):
        fake_client = _FakeCodexClient()
        fake_guardian = SimpleNamespace(stop=AsyncMock())
        fake_verifier = SimpleNamespace(
            stop=AsyncMock(),
            verify=AsyncMock(
                return_value=VerifierDecision(
                    decision="fail",
                    summary="needs retry",
                    feedback="fix it",
                    missing_requirements=[],
                    raw_text='{"decision":"fail"}',
                )
            ),
        )

        with patch("main.setup_codex", new=AsyncMock(return_value=fake_client)), \
            patch("main.CommandRouter", return_value=SimpleNamespace()), \
            patch("main.ApprovalGuardianService", return_value=fake_guardian), \
            patch("main.ResultVerifierService", return_value=fake_verifier), \
            patch("main.event_hub.publish_event", new=AsyncMock()), \
            patch(
                "main.collect_workspace_change_review",
                new=AsyncMock(
                    return_value=WorkspaceChangeReview(
                        workspace_path="/tmp/workspace",
                        changed_files=["main.py"],
                        git_status=" M main.py",
                        diff_stat="1 file changed",
                        diff_excerpt="@@ -1 +1 @@",
                    )
                ),
            ), \
            patch("main.get", side_effect=lambda key, default=None: default):
            await main.post_init(None)

            user_id = -1
            thread_id = "thread-1"
            turn_id = "turn-1"
            user_manager.bind_thread_owner(user_id, thread_id)
            state_user = user_manager.get(user_id)
            state_user.set_thread(thread_id)
            state_user.set_turn(turn_id)
            state_user.set_validation_session(
                thread_id,
                "hello",
                2,
                3,
                workspace_path="/tmp/workspace",
                workspace_status_before="snapshot-initial",
            )
            state_user.validation_session.set_turn(turn_id)

            await asyncio.wait_for(
                fake_client._on_any(
                    "turn/completed",
                    {
                        "threadId": thread_id,
                        "turn": {"id": turn_id, "status": "completed", "items": [], "error": None},
                    },
                ),
                timeout=0.1,
            )

            await asyncio.wait_for(asyncio.gather(*list(main._validation_tasks)), timeout=0.2)

        self.assertEqual("retry-turn-1", state_user.validation_session.current_turn_id)


if __name__ == "__main__":
    unittest.main()
