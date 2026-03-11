import unittest

from utils.workspace_review import changed_entries_since, parse_git_status_entries


class WorkspaceReviewTests(unittest.TestCase):
    def test_parse_git_status_entries_reads_code_and_path(self):
        entries = parse_git_status_entries(" M web/server.py\n?? tests/test_workspace_review.py\n")

        self.assertEqual(
            [(" M", "web/server.py"), ("??", "tests/test_workspace_review.py")],
            [(entry.code, entry.path) for entry in entries],
        )

    def test_changed_entries_since_returns_only_new_delta_entries(self):
        before = " M web/server.py"
        after = " M web/server.py\n M web/static/app.jsx\n?? tests/test_workspace_review.py"

        entries = changed_entries_since(before, after)

        self.assertEqual(
            [(" M", "web/static/app.jsx"), ("??", "tests/test_workspace_review.py")],
            [(entry.code, entry.path) for entry in entries],
        )


if __name__ == "__main__":
    unittest.main()
