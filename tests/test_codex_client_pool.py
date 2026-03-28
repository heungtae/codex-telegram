import unittest
from unittest.mock import patch

from codex.client_pool import CodexClientManager


class _DummyClient:
    _seq = 0

    def __init__(self):
        type(self)._seq += 1
        self.client_id = type(self)._seq
        self.started = False
        self.initialized = []
        self.stopped = False
        self.calls = []
        self.method_handlers = {}
        self.any_handlers = []
        self.approval_handler = None
        self.approval_decisions = []

    async def start(self):
        self.started = True

    async def initialize(self, client_info):
        self.initialized.append(dict(client_info))

    async def stop(self):
        self.stopped = True

    async def call(self, method, params=None):
        payload = {} if params is None else dict(params)
        self.calls.append((method, payload))
        if method == "thread/start":
            return {"thread": {"id": f"thread-{self.client_id}"}}
        return {"client_id": self.client_id, "method": method, "params": payload}

    def on(self, method, handler):
        self.method_handlers.setdefault(method, []).append(handler)

    def on_any(self, handler):
        self.any_handlers.append(handler)

    def on_approval_request(self, handler):
        self.approval_handler = handler

    def submit_approval_decision(self, request_id, decision, thread_id=None):
        self.approval_decisions.append((request_id, decision, thread_id))
        return True


class CodexClientManagerTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        _DummyClient._seq = 0

    async def test_thread_calls_use_dedicated_client_and_control_client_stays_separate(self):
        with patch("codex.client_pool.CodexClient", new=_DummyClient):
            manager = CodexClientManager()
            await manager.start()
            await manager.initialize({"name": "codex-telegram", "title": "Codex Telegram Bot", "version": "test"})

            control = manager._control.client  # type: ignore[union-attr]
            config_result = await manager.call("config/read")
            self.assertEqual(1, control.client_id)
            self.assertEqual([("config/read", {})], control.calls)
            self.assertEqual(1, config_result["client_id"])

            start_result = await manager.call("thread/start", {"cwd": "/tmp/project-a"})
            thread_id = start_result["thread"]["id"]
            thread_handle = manager._thread_clients[thread_id]
            thread_client = thread_handle.client
            self.assertEqual(2, thread_client.client_id)
            self.assertEqual([("thread/start", {"cwd": "/tmp/project-a"})], thread_client.calls)

            turn_result = await manager.call(
                "turn/start",
                {"threadId": thread_id, "input": [{"type": "text", "text": "hello"}]},
            )
            self.assertEqual(2, turn_result["client_id"])
            self.assertEqual(
                [
                    ("thread/start", {"cwd": "/tmp/project-a"}),
                    ("turn/start", {"threadId": thread_id, "input": [{"type": "text", "text": "hello"}]}),
                ],
                thread_client.calls,
            )

            self.assertEqual([("config/read", {})], control.calls)

            await manager.stop()
            self.assertTrue(thread_client.stopped)
            self.assertTrue(control.stopped)

    async def test_approval_decision_uses_thread_id_when_available(self):
        with patch("codex.client_pool.CodexClient", new=_DummyClient):
            manager = CodexClientManager()
            await manager.start()
            await manager.initialize({"name": "codex-telegram", "title": "Codex Telegram Bot", "version": "test"})

            start_result = await manager.call("thread/start", {"cwd": "/tmp/project-b"})
            thread_id = start_result["thread"]["id"]
            thread_client = manager._thread_clients[thread_id].client

            self.assertIsNotNone(thread_client.approval_handler)
            await thread_client.approval_handler({"id": 77, "method": "item/commandExecution/requestApproval", "threadId": thread_id})

            accepted = manager.submit_approval_decision(77, "approve", thread_id=thread_id)
            self.assertTrue(accepted)
            self.assertEqual([(77, "approve", thread_id)], thread_client.approval_decisions)

            await manager.stop()
