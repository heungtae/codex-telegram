import unittest
from unittest.mock import patch

from codex.command_router.core import CommandRouter
from models.user import user_manager


class FakeCodex:
    def __init__(self):
        self.calls: list[tuple[str, dict | None]] = []
        self.thread_list_data: list[dict] = []
        self.thread_read_by_id: dict[str, dict] = {}
        self.feature_list_data: list[dict] = []
        self.mcp_server_status_data: list[dict] = []
        self.config_data: dict = {}

    async def call(self, method: str, params: dict | None = None):
        self.calls.append((method, params))
        if method == "skills/list":
            return {
                "data": [
                    {
                        "skills": [
                            {"name": "clean-code", "enabled": True},
                            {"name": "java-testing", "enabled": False},
                        ]
                    }
                ]
            }
        if method == "thread/list":
            return {"data": self.thread_list_data}
        if method == "thread/read":
            thread_id = (params or {}).get("threadId")
            if isinstance(thread_id, str):
                return self.thread_read_by_id.get(thread_id, {})
            return {}
        if method == "experimentalFeature/list":
            return {"data": self.feature_list_data}
        if method == "mcpServerStatus/list":
            return {"data": self.mcp_server_status_data}
        if method == "config/read":
            return {"config": self.config_data}
        return {}


class CommandRouterTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        user_manager._users.clear()
        user_manager._thread_owners.clear()
        user_manager._thread_projects.clear()
        self.codex = FakeCodex()
        self.router = CommandRouter(self.codex)

    async def test_unknown_command_returns_text_result(self):
        result = await self.router.route("/not-found", [], 1)
        self.assertEqual("text", result.kind)
        self.assertIn("Unknown command", result.text)

    async def test_help_argument_returns_usage_result(self):
        result = await self.router.route("/models", ["--help"], 1)
        self.assertEqual("usage", result.kind)
        self.assertIn("Usage: /models", result.text)

    async def test_skills_returns_kind_and_names_meta(self):
        result = await self.router.route("/skills", [], 1)
        self.assertEqual("skills", result.kind)
        self.assertEqual(["clean-code", "java-testing"], result.meta.get("skill_names"))

    async def test_threads_empty_returns_threads_kind_with_empty_meta(self):
        result = await self.router.route("/threads", [], 1)
        self.assertEqual("threads", result.kind)
        self.assertEqual([], result.meta.get("thread_ids"))
        self.assertEqual("No threads found.", result.text)

    async def test_threads_by_profile_groups_rows_using_known_mapping(self):
        self.codex.thread_list_data = [
            {"id": "t-1", "createdAt": "2026-03-02T00:00:00Z", "title": "first"},
            {"id": "t-2", "createdAt": "2026-03-02T00:00:01Z", "title": "second"},
        ]
        self.codex.thread_read_by_id = {
            "t-1": {"thread": {"id": "t-1"}, "turns": [{"input": [{"type": "text", "text": "first request"}]}]},
            "t-2": {"thread": {"id": "t-2"}, "turns": [{"input": [{"type": "text", "text": "second request"}]}]},
        }
        user_manager.bind_thread_project("t-1", "default")
        result = await self.router.route("/threads", ["--by-profile"], 1)
        self.assertEqual("threads", result.kind)
        self.assertIn("Threads by profile:", result.text)
        self.assertIn("[profile: default", result.text)
        self.assertIn("[profile: unmapped]", result.text)
        self.assertIn("first request", result.text)
        self.assertIn("second request", result.text)

    async def test_threads_current_profile_filters_only_selected_profile_threads(self):
        self.codex.thread_list_data = [
            {"id": "t-1", "createdAt": "2026-03-02T00:00:00Z", "title": "first"},
            {"id": "t-2", "createdAt": "2026-03-02T00:00:01Z", "title": "second"},
        ]
        user = user_manager.get(1)
        user.selected_project_key = "default"
        user_manager.bind_thread_project("t-1", "default")
        user_manager.bind_thread_project("t-2", "other")

        result = await self.router.route("/threads", ["--current-profile"], 1)

        self.assertEqual("threads", result.kind)
        self.assertIn("Threads (current profile: default", result.text)
        self.assertEqual(["t-1"], result.meta.get("thread_ids"))

    async def test_threads_current_profile_returns_empty_when_no_mapping(self):
        self.codex.thread_list_data = [
            {"id": "t-1", "createdAt": "2026-03-02T00:00:00Z", "title": "first"},
            {"id": "t-2", "createdAt": "2026-03-02T00:00:01Z", "title": "second"},
        ]
        user = user_manager.get(1)
        user.selected_project_key = "default"
        user_manager.bind_thread_project("t-2", "other")

        result = await self.router.route("/threads", ["--current-profile"], 1)

        self.assertEqual("threads", result.kind)
        self.assertEqual([], result.meta.get("thread_ids"))
        self.assertEqual("No threads found.", result.text)

    async def test_features_returns_beta_only_with_feature_meta(self):
        self.codex.feature_list_data = [
            {"displayName": None, "name": None, "id": "undo", "stage": "underDevelopment", "enabled": True},
            {"displayName": "Bubblewrap sandbox", "id": "use_linux_sandbox_bwrap", "stage": "beta", "enabled": False},
            {"displayName": "JS REPL", "id": "js_repl", "stage": "beta", "enabled": True},
        ]

        result = await self.router.route("/features", [], 1)

        self.assertEqual("features", result.kind)
        self.assertIn("Beta features:", result.text)
        self.assertNotIn("undo", result.text)
        self.assertIn("Bubblewrap sandbox", result.text)
        self.assertEqual(["use_linux_sandbox_bwrap", "js_repl"], result.meta.get("feature_keys"))
        self.assertEqual({"use_linux_sandbox_bwrap": False, "js_repl": True}, result.meta.get("feature_enabled"))
        self.assertIn(("experimentalFeature/list", {"limit": 200}), self.codex.calls)

    async def test_gurdian_returns_guardian_settings_kind(self):
        with patch(
            "codex.command_router.system.get_guardian_settings",
            return_value={
                "enabled": False,
                "timeout_seconds": 8,
                "failure_policy": "manual_fallback",
                "explainability": "full_chain",
                "apply_to_methods": ["*"],
            },
        ):
            result = await self.router.route("/gurdian", [], 1)

        self.assertEqual("guardian_settings", result.kind)
        self.assertIn("Guardian settings:", result.text)
        self.assertFalse(self.codex.calls)

    async def test_mcp_uses_alternate_status_fields(self):
        self.codex.mcp_server_status_data = [
            {
                "name": "fxframework",
                "authStatus": "bearerToken",
                "tools": {"addClusterNode": {}, "describeTopology": {}},
                "resources": [],
                "resourceTemplates": [],
            },
        ]
        self.codex.config_data = {
            "mcp_servers": {
                "fxframework": {
                    "url": "http://127.0.0.1:9001/mcp",
                    "bearer_token_env_var": "FX_AUTH_TOKEN",
                }
            }
        }

        result = await self.router.route("/mcp", [], 1)

        self.assertEqual("text", result.kind)
        self.assertIn("🔌  MCP Tools", result.text)
        self.assertIn("  • fxframework", result.text)
        self.assertIn("    • Status: enabled", result.text)
        self.assertIn("    • Auth: Bearer token", result.text)
        self.assertIn("    • URL: http://127.0.0.1:9001/mcp", result.text)
        self.assertIn("    • Tools: addClusterNode, describeTopology", result.text)
        self.assertIn("    • Resources: (none)", result.text)
        self.assertIn("    • Resource templates: (none)", result.text)
        self.assertIn(("mcpServerStatus/list", {"limit": 20}), self.codex.calls)
        self.assertIn(("config/read", None), self.codex.calls)

    async def test_mcp_falls_back_to_auth_status_when_status_missing(self):
        self.codex.mcp_server_status_data = [
            {"name": "fxframework", "authStatus": "bearerToken", "tools": {}, "resources": [], "resourceTemplates": []},
        ]
        self.codex.config_data = {"mcp_servers": {"fxframework": {"url": "http://127.0.0.1:9001/mcp"}}}

        result = await self.router.route("/mcp", [], 1)

        self.assertEqual("text", result.kind)
        self.assertIn("    • Auth: Bearer token", result.text)


if __name__ == "__main__":
    unittest.main()
