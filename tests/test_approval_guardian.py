import unittest

from codex.approval_guardian import ApprovalGuardianService


class ApprovalGuardianServiceTests(unittest.TestCase):
    def setUp(self):
        self.guardian = ApprovalGuardianService()

    def test_parse_decision_accepts_valid_json(self):
        decision = self.guardian._parse_decision(
            '{"decision":"approve","risk_level":"low","confidence":0.93,"summary":"safe","chain":"read-only"}'
        )
        self.assertEqual("approve", decision.choice)
        self.assertEqual("low", decision.risk_level)
        self.assertEqual("0.93", decision.confidence)
        self.assertEqual("safe", decision.summary)

    def test_parse_decision_rejects_invalid_choice(self):
        with self.assertRaises(ValueError):
            self.guardian._parse_decision('{"decision":"maybe","risk_level":"unknown"}')

    def test_extract_json_candidate_uses_last_object(self):
        text = 'debug {"decision":"deny","risk_level":"high"} tail {"decision":"approve","risk_level":"low"}'
        candidate = self.guardian._extract_json_candidate(text)
        self.assertIsNotNone(candidate)
        self.assertIn('"decision":"approve"', candidate)


if __name__ == "__main__":
    unittest.main()
