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


if __name__ == "__main__":
    unittest.main()
