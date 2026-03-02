import unittest

from codex.command_router.core import CommandRouter
from models.user import user_manager


class FakeCodex:
    def __init__(self):
        self.calls: list[tuple[str, dict | None]] = []
        self.thread_list_data: list[dict] = []

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
        user_manager.bind_thread_project("t-1", "default")
        result = await self.router.route("/threads", ["--by-profile"], 1)
        self.assertEqual("threads", result.kind)
        self.assertIn("Threads by profile:", result.text)
        self.assertIn("[profile: default", result.text)
        self.assertIn("[profile: unmapped]", result.text)

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


if __name__ == "__main__":
    unittest.main()
