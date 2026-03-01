import unittest

from codex.command_router.core import CommandRouter
from models.user import user_manager


class FakeCodex:
    def __init__(self):
        self.calls: list[tuple[str, dict | None]] = []

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
            return {"data": []}
        return {}


class CommandRouterTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        user_manager._users.clear()
        user_manager._thread_owners.clear()
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


if __name__ == "__main__":
    unittest.main()
