import unittest

from codex.result_verifier import ResultVerifierService


class ResultVerifierServiceTests(unittest.TestCase):
    def setUp(self):
        self.verifier = ResultVerifierService()

    def test_parse_decision_accepts_valid_json(self):
        decision = self.verifier._parse_decision(
            '{"decision":"pass","summary":"ok","feedback":"none","missing_requirements":[]}'
        )
        self.assertEqual("pass", decision.decision)
        self.assertEqual("ok", decision.summary)
        self.assertEqual("none", decision.feedback)
        self.assertEqual([], decision.missing_requirements)

    def test_parse_decision_rejects_invalid_choice(self):
        with self.assertRaises(ValueError):
            self.verifier._parse_decision('{"decision":"maybe","summary":"unknown"}')

    def test_extract_json_candidate_uses_last_object(self):
        text = 'debug {"decision":"fail","summary":"x"} tail {"decision":"pass","summary":"ok"}'
        candidate = self.verifier._extract_json_candidate(text)
        self.assertIsNotNone(candidate)
        self.assertIn('"decision":"pass"', candidate)

    def test_build_prompt_for_code_changes_includes_diff_context(self):
        prompt = self.verifier._build_prompt(
            {
                "review_mode": "code_changes",
                "user_request": "Reduce thread list to 10",
                "changed_files": ["web/static/app.jsx", "web/server.py"],
                "git_status": " M web/static/app.jsx\n M web/server.py",
                "diff_stat": "2 files changed, 2 insertions(+), 2 deletions(-)",
                "diff_excerpt": "@@ -1 +1 @@",
            }
        )

        self.assertIn("strict code-change reviewer", prompt)
        self.assertIn("web/static/app.jsx", prompt)
        self.assertIn("diff_excerpt", prompt)
        self.assertNotIn("candidate_output", prompt)
        self.assertNotIn("recent_context", prompt)


if __name__ == "__main__":
    unittest.main()
