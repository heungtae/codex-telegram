import unittest
import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from models import state
from web.runtime import session_manager
from web.server import COOKIE_NAME, create_web_app


class WebServerLocalCommandTests(unittest.TestCase):
    def setUp(self):
        self.original_codex_client = state.codex_client
        self.original_command_router = state.command_router
        state.codex_ready.set()
        state.codex_client = SimpleNamespace(call=AsyncMock())
        state.command_router = SimpleNamespace(
            route=AsyncMock(),
            projects=SimpleNamespace(resolve_effective_project=lambda user_id: {"path": "/tmp/web-workspace", "key": "default"}),
        )
        self.session = asyncio.run(session_manager.create("admin", ttl_seconds=120))

    def tearDown(self):
        asyncio.run(session_manager.delete(self.session.token))
        state.codex_client = self.original_codex_client
        state.command_router = self.original_command_router

    def test_chat_messages_bang_command_bypasses_turn_start(self):
        app = create_web_app()
        endpoint = next(
            route.endpoint
            for route in app.routes
            if getattr(route, "path", None) == "/api/chat/messages"
        )
        request = SimpleNamespace(cookies={COOKIE_NAME: self.session.token})
        with patch("web.server.run_bang_command", new=AsyncMock(return_value="$ ls\ncwd: /tmp/web-workspace\nexit code: 0")) as mock_run:
            body = asyncio.run(endpoint({"text": "!ls"}, request))

        self.assertTrue(body["ok"])
        self.assertTrue(body["local_command"])
        self.assertEqual("$ ls\ncwd: /tmp/web-workspace\nexit code: 0", body["output"])
        mock_run.assert_awaited_once_with("!ls", "/tmp/web-workspace")
        state.codex_client.call.assert_not_called()


if __name__ == "__main__":
    unittest.main()
