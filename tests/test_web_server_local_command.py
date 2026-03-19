import unittest
import asyncio
import os
import subprocess
import tempfile
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

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

        self.assertIn('const storageKey = "codex-web-theme";', body)
        self.assertIn("window.localStorage.getItem(storageKey)", body)
        self.assertIn('document.documentElement.dataset.theme = theme;', body)
        self.assertRegex(body, r'/assets/styles\.css\?v=\d+')
        self.assertRegex(body, r'/assets/app\.jsx\?v=\d+')

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

        with patch("web.server.get_guardian_settings", return_value={"enabled": True}):
            body = asyncio.run(endpoint(request))

        self.assertEqual("/tmp/web-workspace", body["workspace"])
        self.assertEqual("build", body["collaboration_mode"])
        self.assertEqual(
            [
                {"name": "default", "enabled": True, "toggleable": False, "configurable": False},
                {"name": "guardian", "enabled": True, "toggleable": True, "configurable": True},
            ],
            body["agents"],
        )

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
                {"role": "user", "text": "Plan this", "thread_id": "thread-1"},
                {
                    "role": "assistant",
                    "text": "# Final plan\n- first\n- second",
                    "kind": "plan",
                    "thread_id": "thread-1",
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
