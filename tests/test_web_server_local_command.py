import unittest
import asyncio
import os
import subprocess
import tempfile
from types import SimpleNamespace
from unittest.mock import AsyncMock, call, patch

from fastapi import HTTPException

from codex import CodexError
from models import state
from models.user import user_manager
from web.runtime import session_manager
from web.server import COOKIE_NAME, create_web_app


class WebServerLocalCommandTests(unittest.TestCase):
    def setUp(self):
        self.original_codex_client = state.codex_client
        self.original_command_router = state.command_router
        user_manager._users.clear()
        user_manager._thread_owners.clear()
        user_manager._thread_subscribers.clear()
        user_manager._thread_projects.clear()
        user_manager._turn_owners.clear()
        user_manager._turn_subscribers.clear()
        user_manager._turn_threads.clear()
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

    def test_chat_messages_passes_collaboration_mode_to_turn_start(self):
        app = create_web_app()
        endpoint = next(
            route.endpoint
            for route in app.routes
            if getattr(route, "path", None) == "/api/chat/messages"
        )
        request = SimpleNamespace(cookies={COOKIE_NAME: self.session.token})
        state_user = user_manager.get(self.session.user_id)
        state_user.active_thread_id = "thread-1"
        state_user.set_collaboration_mode("plan")
        state_user.set_collaboration_mode_mask(
            {"name": "plan", "mode": "plan", "model": "gpt-5.3-codex", "reasoning_effort": "medium"}
        )
        state.codex_client.call.return_value = {"turn": {"id": "turn-1"}}

        body = asyncio.run(endpoint({"text": "hello"}, request))

        self.assertTrue(body["ok"])
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

    def test_index_includes_theme_bootstrap_and_versioned_assets(self):
        app = create_web_app()
        endpoint = next(
            route.endpoint
            for route in app.routes
            if getattr(route, "path", None) == "/"
        )

        response = asyncio.run(endpoint())
        body = response.body.decode("utf-8")

        self.assertIn("<!doctype html>", body)
        self.assertIn("<title>Codex Web</title>", body)
        self.assertIn("/assets/", body)

    def test_chat_messages_propagates_turn_start_failures(self):
        app = create_web_app()
        endpoint = next(
            route.endpoint
            for route in app.routes
            if getattr(route, "path", None) == "/api/chat/messages"
        )
        request = SimpleNamespace(cookies={COOKIE_NAME: self.session.token})
        state_user = user_manager.get(self.session.user_id)
        state_user.active_thread_id = "thread-1"
        state.codex_client.call = AsyncMock(side_effect=RuntimeError("turn start failed"))

        with self.assertRaises(RuntimeError):
            asyncio.run(endpoint({"text": "second"}, request))

        self.assertEqual("thread-1", state_user.active_thread_id)

    def test_chat_messages_fails_when_collaboration_mode_payload_cannot_be_resolved(self):
        app = create_web_app()
        endpoint = next(
            route.endpoint
            for route in app.routes
            if getattr(route, "path", None) == "/api/chat/messages"
        )
        request = SimpleNamespace(cookies={COOKIE_NAME: self.session.token})
        state_user = user_manager.get(self.session.user_id)
        state_user.active_thread_id = "thread-1"
        state_user.set_collaboration_mode("plan")
        state.codex_client.call.return_value = {"data": []}

        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(endpoint({"text": "second"}, request))

        self.assertEqual(500, ctx.exception.status_code)
        self.assertIn("Failed to resolve collaboration mode payload for plan", ctx.exception.detail)

    def test_chat_messages_resolves_collaboration_mode_from_nested_settings_shape(self):
        app = create_web_app()
        endpoint = next(
            route.endpoint
            for route in app.routes
            if getattr(route, "path", None) == "/api/chat/messages"
        )
        request = SimpleNamespace(cookies={COOKIE_NAME: self.session.token})
        state_user = user_manager.get(self.session.user_id)
        state_user.active_thread_id = "thread-1"
        state_user.set_collaboration_mode("plan")
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

        body = asyncio.run(endpoint({"text": "hello"}, request))

        self.assertTrue(body["ok"])
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

    def test_chat_messages_resolves_collaboration_mode_using_default_model_when_preset_has_no_model(self):
        app = create_web_app()
        endpoint = next(
            route.endpoint
            for route in app.routes
            if getattr(route, "path", None) == "/api/chat/messages"
        )
        request = SimpleNamespace(cookies={COOKIE_NAME: self.session.token})
        state_user = user_manager.get(self.session.user_id)
        state_user.active_thread_id = "thread-1"
        state_user.set_collaboration_mode("plan")
        state.codex_client.call = AsyncMock(
            side_effect=[
                {"data": [{"name": "Plan", "mode": "plan"}]},
                {"config": {"model": "gpt-5.3-codex"}},
                {"turn": {"id": "turn-1"}},
            ]
        )

        body = asyncio.run(endpoint({"text": "hello"}, request))

        self.assertTrue(body["ok"])
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
        state.command_router.projects = SimpleNamespace(
            resolve_effective_project=lambda user_id: {
                "path": "/tmp/web-workspace",
                "key": "default",
                "name": "current workspace",
            }
        )

        with patch("web.server.get_guardian_settings", return_value={"enabled": True}):
            body = asyncio.run(endpoint(request))

        self.assertEqual("/tmp/web-workspace", body["workspace"])
        self.assertEqual("default", body["project_key"])
        self.assertEqual("current workspace", body["project_name"])
        self.assertEqual("build", body["collaboration_mode"])
        self.assertEqual(
            [
                {"name": "default", "enabled": True, "toggleable": False, "configurable": False},
                {"name": "guardian", "enabled": True, "toggleable": True, "configurable": True},
            ],
            body["agents"],
        )

    def test_projects_endpoint_includes_structured_items(self):
        app = create_web_app()
        endpoint = next(
            route.endpoint
            for route in app.routes
            if getattr(route, "path", None) == "/api/projects" and "GET" in getattr(route, "methods", set())
        )
        request = SimpleNamespace(cookies={COOKIE_NAME: self.session.token})
        state_user = user_manager.get(self.session.user_id)
        state_user.selected_project_key = "default"
        state.command_router.route = AsyncMock(
            return_value=SimpleNamespace(kind="projects", text="Projects", meta={"project_keys": ["default"]})
        )
        state.command_router.projects = SimpleNamespace(
            resolve_effective_project=lambda user_id: {"path": "/tmp/web-workspace", "key": "default"},
            load_project_profiles=lambda: ([{"key": "default", "name": "Default", "path": "/tmp/web-workspace"}], "default"),
        )

        body = asyncio.run(endpoint(request))

        self.assertEqual(
            [
                {
                    "key": "default",
                    "name": "Default",
                    "path": "/tmp/web-workspace",
                    "selected": True,
                    "default": True,
                }
            ],
            body["items"],
        )

    def test_project_select_endpoint_rejects_running_turn(self):
        app = create_web_app()
        endpoint = next(
            route.endpoint
            for route in app.routes
            if getattr(route, "path", None) == "/api/projects/select"
        )
        request = SimpleNamespace(cookies={COOKIE_NAME: self.session.token})
        user_manager.get(self.session.user_id).set_turn("turn-1")

        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(endpoint({"target": "default"}, request))

        self.assertEqual(409, ctx.exception.status_code)
        self.assertEqual("Cannot switch project while a turn is running.", ctx.exception.detail)

    def test_projects_open_thread_creates_thread_without_switching_selected_project(self):
        app = create_web_app()
        endpoint = next(
            route.endpoint
            for route in app.routes
            if getattr(route, "path", None) == "/api/projects/open-thread"
        )
        request = SimpleNamespace(cookies={COOKIE_NAME: self.session.token})
        state_user = user_manager.get(self.session.user_id)
        state_user.selected_project_key = "default"
        state_user.selected_project_name = "Default"
        state_user.selected_project_path = "/tmp/default-workspace"
        state.command_router.projects = SimpleNamespace(
            resolve_effective_project=lambda user_id: {"path": "/tmp/default-workspace", "key": "default"},
            load_project_profiles=lambda: (
                [
                    {"key": "default", "name": "Default", "path": "/tmp/default-workspace"},
                    {"key": "other", "name": "Other", "path": "/tmp/other-workspace"},
                ],
                "default",
            ),
        )
        state.codex_client.call = AsyncMock(return_value={"thread": {"id": "thread-other-1"}})

        body = asyncio.run(endpoint({"project_key": "other"}, request))

        self.assertEqual("thread-other-1", body["thread_id"])
        self.assertEqual("other", body["project_key"])
        self.assertEqual("Other", body["project_name"])
        self.assertEqual("/tmp/other-workspace", body["workspace"])
        self.assertEqual("default", state_user.selected_project_key)
        self.assertEqual(self.session.user_id, user_manager.find_user_id_by_thread("thread-other-1"))
        self.assertEqual("other", user_manager.get_thread_project("thread-other-1"))

    def test_read_thread_preserves_plan_items_as_plan_messages(self):
        app = create_web_app()
        endpoint = next(
            route.endpoint
            for route in app.routes
            if getattr(route, "path", None) == "/api/threads/read"
        )
        request = SimpleNamespace(cookies={COOKIE_NAME: self.session.token})
        state.codex_client.call.return_value = {
            "thread": {"id": "thread-1"},
            "turns": [
                {
                    "id": "turn-1",
                    "items": [
                        {
                            "type": "userMessage",
                            "id": "user-1",
                            "content": [{"type": "text", "text": "Plan this"}],
                        },
                        {
                            "type": "plan",
                            "id": "turn-1-plan",
                            "text": "# Final plan\n- first\n- second\n",
                        },
                    ],
                }
            ],
        }

        body = asyncio.run(endpoint(request, "thread-1"))

        self.assertTrue(body["ok"])
        self.assertEqual("thread-1", body["thread_id"])
        self.assertEqual(
            [
                {"role": "user", "text": "Plan this", "thread_id": "thread-1", "turn_id": "turn-1"},
                {
                    "role": "assistant",
                    "text": "# Final plan\n- first\n- second",
                    "kind": "plan",
                    "thread_id": "thread-1",
                    "turn_id": "turn-1",
                },
            ],
            body["messages"],
        )

    def test_guardian_endpoint_accepts_rules_payload(self):
        app = create_web_app()
        endpoint = next(
            route.endpoint
            for route in app.routes
            if getattr(route, "path", None) == "/api/guardian" and "POST" in getattr(route, "methods", set())
        )
        request = SimpleNamespace(cookies={COOKIE_NAME: self.session.token})

        with patch(
            "web.server.save_guardian_settings",
            return_value={"enabled": True, "rules": [{"name": "web rule"}]},
        ) as mock_save:
            body = asyncio.run(
                endpoint(
                    {
                        "enabled": True,
                        "timeout_seconds": 20,
                        "failure_policy": "manual_fallback",
                        "explainability": "decision_only",
                        "rules": [{"name": "web rule", "action": "manual_fallback", "path_glob_any": ["helm/**"]}],
                    },
                    request,
                )
            )

        self.assertTrue(body["enabled"])
        self.assertEqual([{"name": "web rule"}], body["rules"])
        mock_save.assert_called_once_with(
            enabled=True,
            timeout_seconds=20,
            failure_policy="manual_fallback",
            explainability="decision_only",
            rules=[{"name": "web rule", "action": "manual_fallback", "path_glob_any": ["helm/**"]}],
            rules_toml=None,
        )

    def test_guardian_endpoint_accepts_rules_toml_payload(self):
        app = create_web_app()
        endpoint = next(
            route.endpoint
            for route in app.routes
            if getattr(route, "path", None) == "/api/guardian" and "POST" in getattr(route, "methods", set())
        )
        request = SimpleNamespace(cookies={COOKIE_NAME: self.session.token})

        with patch(
            "web.server.save_guardian_settings",
            return_value={"enabled": True, "rules_toml": "[[approval.guardian.rules]]\nname = \"web rule\"\n"},
        ) as mock_save:
            body = asyncio.run(
                endpoint(
                    {
                        "enabled": True,
                        "timeout_seconds": 20,
                        "failure_policy": "manual_fallback",
                        "explainability": "decision_only",
                        "rules_toml": """
[[approval.guardian.rules]]
name = "web rule"
enabled = true
action = "manual_fallback"
priority = 80
path_glob_any = ["helm/**"]
""".strip(),
                    },
                    request,
                )
            )

        self.assertTrue(body["enabled"])
        mock_save.assert_called_once_with(
            enabled=True,
            timeout_seconds=20,
            failure_policy="manual_fallback",
            explainability="decision_only",
            rules=None,
            rules_toml="""
[[approval.guardian.rules]]
name = "web rule"
enabled = true
action = "manual_fallback"
priority = 80
path_glob_any = ["helm/**"]
""".strip(),
        )

    def test_guardian_endpoint_returns_http_400_for_invalid_rules(self):
        app = create_web_app()
        endpoint = next(
            route.endpoint
            for route in app.routes
            if getattr(route, "path", None) == "/api/guardian" and "POST" in getattr(route, "methods", set())
        )
        request = SimpleNamespace(cookies={COOKIE_NAME: self.session.token})

        with patch("web.server.save_guardian_settings", side_effect=ValueError("Guardian rules must be a JSON array.")):
            with self.assertRaises(HTTPException) as ctx:
                asyncio.run(
                    endpoint(
                        {
                            "enabled": True,
                            "timeout_seconds": 20,
                            "failure_policy": "manual_fallback",
                            "explainability": "decision_only",
                            "rules": {"broken": True},
                        },
                        request,
                    )
                )

        self.assertEqual(400, ctx.exception.status_code)
        self.assertEqual("Guardian rules must be a JSON array.", ctx.exception.detail)

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
                {"role": "user", "text": "hello", "thread_id": "thread-1"},
                {"role": "assistant", "text": "world", "thread_id": "thread-1"},
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
                {"role": "user", "text": "first question", "thread_id": "thread-2"},
                {"role": "assistant", "text": "first answer", "thread_id": "thread-2"},
                {"role": "assistant", "text": "more detail", "thread_id": "thread-2"},
                {"role": "user", "text": "second question", "thread_id": "thread-2"},
                {"role": "assistant", "text": "second answer", "thread_id": "thread-2"},
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
                {"role": "user", "text": "question", "thread_id": "thread-3"},
                {"role": "assistant", "text": "answer", "thread_id": "thread-3"},
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
                {"role": "user", "text": "question", "thread_id": "thread-4"},
                {"role": "assistant", "text": "answer", "thread_id": "thread-4"},
            ],
            body["messages"],
        )

    def test_thread_read_registers_web_session_as_thread_subscriber(self):
        app = create_web_app()
        endpoint = next(
            route.endpoint
            for route in app.routes
            if getattr(route, "path", None) == "/api/threads/read"
        )
        request = SimpleNamespace(cookies={COOKIE_NAME: self.session.token})
        state.codex_client.call = AsyncMock(
            return_value={
                "thread": {"id": "thread-sub"},
                "turns": [],
            }
        )
        state.command_router.route = AsyncMock(
            return_value=SimpleNamespace(kind="read", text="No messages yet.", meta={"thread_id": "thread-sub"})
        )

        asyncio.run(endpoint(request, "thread-sub"))

        self.assertIn(self.session.user_id, user_manager.find_user_ids_by_thread("thread-sub"))
        self.assertEqual("thread-sub", user_manager.get(self.session.user_id).active_thread_id)

    def test_chat_messages_uses_active_thread_when_payload_thread_id_is_missing(self):
        app = create_web_app()
        endpoint = next(
            route.endpoint
            for route in app.routes
            if getattr(route, "path", None) == "/api/chat/messages"
        )
        request = SimpleNamespace(cookies={COOKIE_NAME: self.session.token})
        state_user = user_manager.get(self.session.user_id)
        state_user.active_thread_id = "thread-active"
        state_user.set_collaboration_mode_mask(
            {"name": "build", "mode": "default", "model": "gpt-5.3-codex", "reasoning_effort": "medium"}
        )
        state.codex_client.call = AsyncMock(return_value={"turn": {"id": "turn-new"}})

        body = asyncio.run(endpoint({"text": "hello"}, request))

        self.assertTrue(body["ok"])
        self.assertEqual("thread-active", body["thread_id"])
        state.codex_client.call.assert_awaited_once_with(
            "turn/start",
            {
                "threadId": "thread-active",
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
                {"role": "user", "text": "question", "thread_id": "thread-subagent"},
                {
                    "role": "assistant",
                    "text": "subagent answer",
                    "variant": "subagent",
                    "thread_id": "thread-subagent",
                },
            ],
            body["messages"],
        )

    def test_thread_read_handles_unmaterialized_thread_include_turns_error(self):
        app = create_web_app()
        endpoint = next(
            route.endpoint
            for route in app.routes
            if getattr(route, "path", None) == "/api/threads/read"
        )
        request = SimpleNamespace(cookies={COOKIE_NAME: self.session.token})
        state.codex_client.call = AsyncMock(
            side_effect=CodexError(
                -32600,
                "thread thread-raw is not materialized yet; includeTurns is unavailable before first user message",
            )
        )
        state.command_router.route = AsyncMock(
            return_value=SimpleNamespace(kind="read", text="No messages yet.", meta={"thread_id": "thread-raw"})
        )

        body = asyncio.run(endpoint(request, "thread-raw"))

        self.assertEqual("read", body["kind"])
        self.assertEqual(
            [{"role": "assistant", "text": "No messages yet."}],
            body["messages"],
        )
        state.command_router.route.assert_awaited_once_with("/read", ["thread-raw"], self.session.user_id)

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
        user_manager.get(self.session.user_id).selected_project_key = "default"
        user_manager.bind_thread_project("t-1", "default")
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

    def test_thread_summaries_accepts_project_key_query_parameter(self):
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
                    "thread": {"id": "t-2"},
                    "turns": [{"input": [{"type": "text", "text": "second user request"}]}],
                },
            ]
        )

        body = asyncio.run(endpoint(request, archived=False, offset=0, limit=30, project_key="other"))

        self.assertEqual(
            [
                {
                    "id": "t-2",
                    "title": "second user request",
                    "created_at": "2026-03-02T00:00:01Z",
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

    def test_chat_messages_allows_turn_start_even_if_another_turn_is_marked_active(self):
        app = create_web_app()
        endpoint = next(
            route.endpoint
            for route in app.routes
            if getattr(route, "path", None) == "/api/chat/messages"
        )
        request = SimpleNamespace(cookies={COOKIE_NAME: self.session.token})
        state_user = user_manager.get(self.session.user_id)
        state_user.active_turn_id = "turn-running-on-another-tab"
        state_user.set_collaboration_mode_mask(
            {"name": "build", "mode": "default", "model": "gpt-5.3-codex", "reasoning_effort": "medium"}
        )
        state.codex_client.call = AsyncMock(return_value={"turn": {"id": "turn-new"}})

        body = asyncio.run(endpoint({"text": "hello", "thread_id": "thread-tab-2"}, request))

        self.assertTrue(body["ok"])
        state.codex_client.call.assert_awaited_once_with(
            "turn/start",
            {
                "threadId": "thread-tab-2",
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
        self.assertEqual(self.session.user_id, user_manager.find_user_id_by_turn("turn-new"))
        self.assertEqual("thread-tab-2", user_manager.get_turn_thread("turn-new"))

    def test_chat_messages_retries_with_new_thread_when_requested_thread_is_missing(self):
        app = create_web_app()
        endpoint = next(
            route.endpoint
            for route in app.routes
            if getattr(route, "path", None) == "/api/chat/messages"
        )
        request = SimpleNamespace(cookies={COOKIE_NAME: self.session.token})
        state_user = user_manager.get(self.session.user_id)
        state_user.set_collaboration_mode_mask(
            {"name": "build", "mode": "default", "model": "gpt-5.3-codex", "reasoning_effort": "medium"}
        )
        state.codex_client.call = AsyncMock(
            side_effect=[
                CodexError(-32600, "thread not found: stale-thread"),
                CodexError(-32600, "thread not found: stale-thread"),
                {"thread": {"id": "thread-new"}},
                {"turn": {"id": "turn-new"}},
            ]
        )

        body = asyncio.run(endpoint({"text": "hello", "thread_id": "stale-thread"}, request))

        self.assertTrue(body["ok"])
        self.assertEqual("thread-new", body["thread_id"])
        self.assertEqual("turn-new", body["turn_id"])
        self.assertEqual(self.session.user_id, user_manager.find_user_id_by_turn("turn-new"))
        self.assertEqual("thread-new", user_manager.get_turn_thread("turn-new"))

    def test_chat_messages_retries_requested_thread_by_resuming_before_creating_new_thread(self):
        app = create_web_app()
        endpoint = next(
            route.endpoint
            for route in app.routes
            if getattr(route, "path", None) == "/api/chat/messages"
        )
        request = SimpleNamespace(cookies={COOKIE_NAME: self.session.token})
        state_user = user_manager.get(self.session.user_id)
        state_user.set_collaboration_mode_mask(
            {"name": "build", "mode": "default", "model": "gpt-5.3-codex", "reasoning_effort": "medium"}
        )
        state.codex_client.call = AsyncMock(
            side_effect=[
                CodexError(-32600, "thread not found: thread-existing"),
                {},
                {"turn": {"id": "turn-existing"}},
            ]
        )

        body = asyncio.run(endpoint({"text": "hello", "thread_id": "thread-existing"}, request))

        self.assertTrue(body["ok"])
        self.assertEqual("thread-existing", body["thread_id"])
        self.assertEqual("turn-existing", body["turn_id"])
        self.assertEqual(
            [
                call(
                    "turn/start",
                    {
                        "threadId": "thread-existing",
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
                ),
                call("thread/resume", {"threadId": "thread-existing"}),
                call(
                    "turn/start",
                    {
                        "threadId": "thread-existing",
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
                ),
            ],
            state.codex_client.call.await_args_list,
        )

    def test_workspace_tree_status_file_and_diff_endpoints(self):
        with tempfile.TemporaryDirectory(prefix="codex-web-workspace-") as workspace:
            subprocess.run(["git", "init"], cwd=workspace, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            subprocess.run(["git", "config", "user.email", "web@test.local"], cwd=workspace, check=True)
            subprocess.run(["git", "config", "user.name", "Codex Web"], cwd=workspace, check=True)
            os.makedirs(os.path.join(workspace, "src"), exist_ok=True)
            with open(os.path.join(workspace, "src", "tracked.txt"), "w", encoding="utf-8") as handle:
                handle.write("before\n")
            subprocess.run(["git", "add", "."], cwd=workspace, check=True)
            subprocess.run(["git", "commit", "-m", "init"], cwd=workspace, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

            with open(os.path.join(workspace, "src", "tracked.txt"), "w", encoding="utf-8") as handle:
                handle.write("after\n")
            with open(os.path.join(workspace, "src", "new.txt"), "w", encoding="utf-8") as handle:
                handle.write("hello\n")

            state.command_router.projects = SimpleNamespace(
                resolve_effective_project=lambda user_id: {"path": workspace, "key": "default"}
            )
            app = create_web_app()
            request = SimpleNamespace(cookies={COOKIE_NAME: self.session.token})

            tree_endpoint = next(route.endpoint for route in app.routes if getattr(route, "path", None) == "/api/workspace/tree")
            status_endpoint = next(route.endpoint for route in app.routes if getattr(route, "path", None) == "/api/workspace/status")
            file_endpoint = next(route.endpoint for route in app.routes if getattr(route, "path", None) == "/api/workspace/file")
            diff_endpoint = next(route.endpoint for route in app.routes if getattr(route, "path", None) == "/api/workspace/diff")

            tree_body = asyncio.run(tree_endpoint(request, path="src", depth=1))
            status_body = asyncio.run(status_endpoint(request))
            file_body = asyncio.run(file_endpoint(request, path="src/tracked.txt"))
            diff_body = asyncio.run(diff_endpoint(request, path="src/tracked.txt"))

            self.assertEqual("src", tree_body["path"])
            self.assertEqual(["new.txt", "tracked.txt"], [item["name"] for item in tree_body["items"]])
            self.assertTrue(status_body["is_git"])
            self.assertEqual("M", status_body["items"]["src/tracked.txt"]["code"])
            self.assertEqual("??", status_body["items"]["src/new.txt"]["code"])
            self.assertTrue(file_body["preview_available"])
            self.assertEqual("after\n", file_body["content"])
            self.assertTrue(diff_body["has_diff"])
            self.assertEqual("M", diff_body["status"])
            self.assertIn("-before", diff_body["diff"])
            self.assertIn("+after", diff_body["diff"])

    def test_workspace_endpoints_use_project_or_thread_context(self):
        with tempfile.TemporaryDirectory(prefix="codex-web-workspace-default-") as default_workspace, \
             tempfile.TemporaryDirectory(prefix="codex-web-workspace-other-") as other_workspace:
            with open(os.path.join(default_workspace, "default.txt"), "w", encoding="utf-8") as handle:
                handle.write("default\n")
            with open(os.path.join(other_workspace, "other.txt"), "w", encoding="utf-8") as handle:
                handle.write("other\n")

            state_user = user_manager.get(self.session.user_id)
            state_user.selected_project_path = default_workspace
            state_user.selected_project_key = "default"
            state.command_router.projects = SimpleNamespace(
                resolve_effective_project=lambda user_id: {"path": default_workspace, "key": "default"},
                load_project_profiles=lambda: (
                    [
                        {"key": "default", "name": "Default", "path": default_workspace},
                        {"key": "other", "name": "Other", "path": other_workspace},
                    ],
                    "default",
                ),
            )
            user_manager.bind_thread_project("thread-other", "other")

            app = create_web_app()
            request = SimpleNamespace(cookies={COOKIE_NAME: self.session.token})
            tree_endpoint = next(route.endpoint for route in app.routes if getattr(route, "path", None) == "/api/workspace/tree")

            project_scoped = asyncio.run(tree_endpoint(request, path="", depth=1, project_key="other"))
            thread_scoped = asyncio.run(tree_endpoint(request, path="", depth=1, thread_id="thread-other"))

            self.assertEqual(other_workspace, project_scoped["workspace"])
            self.assertEqual(["other.txt"], [item["name"] for item in project_scoped["items"]])
            self.assertEqual(other_workspace, thread_scoped["workspace"])
            self.assertEqual(["other.txt"], [item["name"] for item in thread_scoped["items"]])

    def test_workspace_file_endpoint_rejects_parent_escape(self):
        with tempfile.TemporaryDirectory(prefix="codex-web-workspace-") as workspace:
            state.command_router.projects = SimpleNamespace(
                resolve_effective_project=lambda user_id: {"path": workspace, "key": "default"}
            )
            app = create_web_app()
            endpoint = next(
                route.endpoint
                for route in app.routes
                if getattr(route, "path", None) == "/api/workspace/file"
            )
            request = SimpleNamespace(cookies={COOKIE_NAME: self.session.token})

            with self.assertRaises(HTTPException) as ctx:
                asyncio.run(endpoint(request, path="../secrets.txt"))

            self.assertEqual(400, ctx.exception.status_code)
            self.assertIn("inside the workspace", ctx.exception.detail)


if __name__ == "__main__":
    unittest.main()
