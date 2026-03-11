import unittest
import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from models import state
from models.user import user_manager
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

    def test_reviewer_settings_api_round_trip(self):
        app = create_web_app()
        get_endpoint = next(
            route.endpoint
            for route in app.routes
            if getattr(route, "path", None) == "/api/reviewer" and "GET" in getattr(route, "methods", set())
        )
        post_endpoint = next(
            route.endpoint
            for route in app.routes
            if getattr(route, "path", None) == "/api/reviewer" and "POST" in getattr(route, "methods", set())
        )
        request = SimpleNamespace(cookies={COOKIE_NAME: self.session.token})

        with patch("web.server.get_reviewer_settings", return_value={"enabled": False, "max_attempts": 3, "timeout_seconds": 8, "recent_turn_pairs": 3}):
            body = asyncio.run(get_endpoint(request))

        self.assertFalse(body["enabled"])
        self.assertEqual(3, body["max_attempts"])

        with patch("web.server.save_reviewer_settings", return_value={"enabled": True, "max_attempts": 5, "timeout_seconds": 20, "recent_turn_pairs": 2}) as mock_save:
            saved = asyncio.run(
                post_endpoint(
                    {"enabled": True, "max_attempts": 5, "timeout_seconds": 20, "recent_turn_pairs": 2},
                    request,
                )
            )

        self.assertTrue(saved["enabled"])
        self.assertEqual(5, saved["max_attempts"])
        mock_save.assert_called_once_with(
            enabled=True,
            max_attempts=5,
            timeout_seconds=20,
            recent_turn_pairs=2,
        )

    def test_chat_messages_rejects_when_reviewer_is_still_processing(self):
        app = create_web_app()
        endpoint = next(
            route.endpoint
            for route in app.routes
            if getattr(route, "path", None) == "/api/chat/messages"
        )
        request = SimpleNamespace(cookies={COOKIE_NAME: self.session.token})
        state_user = user_manager.get(self.session.user_id)
        state_user.active_thread_id = "thread-1"
        state_user.set_validation_session("thread-1", "first", 1, 3)

        with self.assertRaises(Exception) as ctx:
            asyncio.run(endpoint({"text": "second"}, request))

        self.assertEqual(409, getattr(ctx.exception, "status_code", None))
        self.assertEqual(
            "reviewer is still processing the previous result",
            getattr(ctx.exception, "detail", None),
        )

    def test_session_summary_exposes_agent_capabilities(self):
        app = create_web_app()
        endpoint = next(
            route.endpoint
            for route in app.routes
            if getattr(route, "path", None) == "/api/session/summary"
        )
        request = SimpleNamespace(cookies={COOKIE_NAME: self.session.token})
        state_user = user_manager.get(self.session.user_id)
        state_user.selected_project_path = "/tmp/web-workspace"
        state_user.selected_project_key = "default"

        with patch("web.server.get_guardian_settings", return_value={"enabled": True}), patch(
            "web.server.get_reviewer_settings", return_value={"enabled": False}
        ):
            body = asyncio.run(endpoint(request))

        self.assertEqual("/tmp/web-workspace", body["workspace"])
        self.assertEqual(
            [
                {"name": "default", "enabled": True, "toggleable": False, "configurable": False},
                {"name": "guardian", "enabled": True, "toggleable": True, "configurable": True},
                {"name": "reviewer", "enabled": False, "toggleable": True, "configurable": True},
            ],
            body["agents"],
        )

    def test_thread_read_returns_chat_messages(self):
        app = create_web_app()
        endpoint = next(
            route.endpoint
            for route in app.routes
            if getattr(route, "path", None) == "/api/threads/read"
        )
        request = SimpleNamespace(cookies={COOKIE_NAME: self.session.token})
        state.codex_client.call = AsyncMock(
            return_value={
                "thread": {"id": "thread-1"},
                "turns": [
                    {
                        "input": [{"type": "text", "text": "hello"}],
                        "output": [{"type": "message", "text": "world"}],
                    }
                ],
            }
        )

        body = asyncio.run(endpoint(request, "thread-1"))

        self.assertTrue(body["ok"])
        self.assertEqual(
            [
                {"role": "user", "text": "hello"},
                {"role": "assistant", "text": "world"},
            ],
            body["messages"],
        )

    def test_thread_read_returns_all_visible_messages_from_nested_items(self):
        app = create_web_app()
        endpoint = next(
            route.endpoint
            for route in app.routes
            if getattr(route, "path", None) == "/api/threads/read"
        )
        request = SimpleNamespace(cookies={COOKIE_NAME: self.session.token})
        state.codex_client.call = AsyncMock(
            return_value={
                "thread": {"id": "thread-2"},
                "turns": [
                    {
                        "input": [{"type": "text", "text": "first question"}],
                        "items": [
                            {"type": "message", "role": "assistant", "content": [{"type": "output_text", "text": "first answer"}]},
                            {"type": "message", "role": "assistant", "content": [{"type": "output_text", "text": "more detail"}]},
                        ],
                    },
                    {
                        "input": [{"type": "text", "text": "second question"}],
                        "output": [{"type": "message", "content": [{"type": "output_text", "text": "second answer"}]}],
                    },
                ],
            }
        )

        body = asyncio.run(endpoint(request, "thread-2"))

        self.assertEqual(
            [
                {"role": "user", "text": "first question"},
                {"role": "assistant", "text": "first answer"},
                {"role": "assistant", "text": "more detail"},
                {"role": "user", "text": "second question"},
                {"role": "assistant", "text": "second answer"},
            ],
            body["messages"],
        )

    def test_thread_read_preserves_nested_message_roles(self):
        app = create_web_app()
        endpoint = next(
            route.endpoint
            for route in app.routes
            if getattr(route, "path", None) == "/api/threads/read"
        )
        request = SimpleNamespace(cookies={COOKIE_NAME: self.session.token})
        state.codex_client.call = AsyncMock(
            return_value={
                "thread": {"id": "thread-3"},
                "turns": [
                    {
                        "input": {
                            "messages": [
                                {"type": "message", "role": "user", "text": "question"},
                                {"type": "message", "role": "assistant", "text": "answer"},
                            ]
                        }
                    }
                ],
            }
        )

        body = asyncio.run(endpoint(request, "thread-3"))

        self.assertEqual(
            [
                {"role": "user", "text": "question"},
                {"role": "assistant", "text": "answer"},
            ],
            body["messages"],
        )

    def test_thread_read_maps_codex_item_types_to_chat_roles(self):
        app = create_web_app()
        endpoint = next(
            route.endpoint
            for route in app.routes
            if getattr(route, "path", None) == "/api/threads/read"
        )
        request = SimpleNamespace(cookies={COOKIE_NAME: self.session.token})
        state.codex_client.call = AsyncMock(
            return_value={
                "thread": {"id": "thread-4"},
                "turns": [
                    {
                        "items": [
                            {"type": "userMessage", "content": [{"type": "text", "text": "question"}]},
                            {"type": "agentMessage", "text": "answer"},
                        ]
                    }
                ],
            }
        )

        body = asyncio.run(endpoint(request, "thread-4"))

        self.assertEqual(
            [
                {"role": "user", "text": "question"},
                {"role": "assistant", "text": "answer"},
            ],
            body["messages"],
        )

    def test_thread_read_marks_non_default_assistant_messages_as_subagent(self):
        app = create_web_app()
        endpoint = next(
            route.endpoint
            for route in app.routes
            if getattr(route, "path", None) == "/api/threads/read"
        )
        request = SimpleNamespace(cookies={COOKIE_NAME: self.session.token})
        state.codex_client.call = AsyncMock(
            return_value={
                "thread": {"id": "thread-subagent"},
                "turns": [
                    {
                        "items": [
                            {"type": "userMessage", "content": [{"type": "text", "text": "question"}]},
                            {"type": "agentMessage", "author": "worker", "text": "subagent answer"},
                        ]
                    }
                ],
            }
        )

        body = asyncio.run(endpoint(request, "thread-subagent"))

        self.assertEqual(
            [
                {"role": "user", "text": "question"},
                {"role": "assistant", "text": "subagent answer", "variant": "subagent"},
            ],
            body["messages"],
        )

    def test_thread_summaries_filters_to_current_project(self):
        app = create_web_app()
        endpoint = next(
            route.endpoint
            for route in app.routes
            if getattr(route, "path", None) == "/api/threads/summaries"
        )
        request = SimpleNamespace(cookies={COOKIE_NAME: self.session.token})
        state_user = user_manager.get(self.session.user_id)
        state_user.selected_project_key = "default"
        user_manager.bind_thread_project("t-1", "default")
        user_manager.bind_thread_project("t-2", "other")
        state.codex_client.call = AsyncMock(
            side_effect=[
                {
                    "data": [
                        {"id": "t-1", "title": "first", "createdAt": "2026-03-02T00:00:00Z"},
                        {"id": "t-2", "title": "second", "createdAt": "2026-03-02T00:00:01Z"},
                    ]
                },
                {
                    "thread": {"id": "t-1"},
                    "turns": [
                        {"input": [{"type": "text", "text": "first user request"}]},
                    ],
                },
            ]
        )

        body = asyncio.run(endpoint(request, archived=False, offset=0, limit=30))

        self.assertEqual(
            [
                {
                    "id": "t-1",
                    "title": "first user request",
                    "created_at": "2026-03-02T00:00:00Z",
                    "active": False,
                }
            ],
            body["items"],
        )

    def test_thread_summaries_use_user_request_excerpt_as_title(self):
        app = create_web_app()
        endpoint = next(
            route.endpoint
            for route in app.routes
            if getattr(route, "path", None) == "/api/threads/summaries"
        )
        request = SimpleNamespace(cookies={COOKIE_NAME: self.session.token})
        state.codex_client.call = AsyncMock(
            side_effect=[
                {
                    "data": [
                        {"id": "t-1", "title": "assistant summary", "createdAt": "2026-03-02T00:00:00Z"},
                    ]
                },
                {
                    "thread": {"id": "t-1"},
                    "turns": [
                        {"input": [{"type": "text", "text": "Please show only the user request in the thread list"}]},
                    ],
                },
            ]
        )

        body = asyncio.run(endpoint(request, archived=False, offset=0, limit=30))

        self.assertEqual(
            [
                {
                    "id": "t-1",
                    "title": "Please show only the user request in the thread list",
                    "created_at": "2026-03-02T00:00:00Z",
                    "active": False,
                }
            ],
            body["items"],
        )

    def test_start_thread_returns_router_meta(self):
        app = create_web_app()
        endpoint = next(
            route.endpoint
            for route in app.routes
            if getattr(route, "path", None) == "/api/threads/start"
        )
        request = SimpleNamespace(cookies={COOKIE_NAME: self.session.token})
        state.command_router.route = AsyncMock(
            return_value=SimpleNamespace(
                kind="text",
                text="Thread started: thread-new",
                meta={"thread_id": "thread-new"},
            )
        )

        body = asyncio.run(endpoint(request))

        self.assertEqual("text", body["kind"])
        self.assertEqual("Thread started: thread-new", body["text"])
        self.assertEqual({"thread_id": "thread-new"}, body["meta"])
        state.command_router.route.assert_awaited_once_with("/start", [], self.session.user_id)


if __name__ == "__main__":
    unittest.main()
