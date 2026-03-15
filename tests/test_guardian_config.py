import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path

import utils.config as config


class GuardianConfigTests(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.config_path = Path(self.tmpdir.name) / "conf.toml"
        self.path_patcher = patch("utils.config._get_config_path", return_value=self.config_path)
        self.path_patcher.start()
        config._config = None

    def tearDown(self):
        config._config = None
        self.path_patcher.stop()
        self.tmpdir.cleanup()

    def test_guardian_defaults_to_disabled(self):
        settings = config.get_guardian_settings()
        self.assertFalse(settings["enabled"])
        self.assertEqual(8, settings["timeout_seconds"])
        self.assertEqual("manual_fallback", settings["failure_policy"])
        self.assertEqual("decision_only", settings["explainability"])
        self.assertEqual([], settings["rules"])
        self.assertEqual(0, settings["rule_summary"]["total"])
        self.assertEqual(0, settings["rule_summary"]["enabled"])
        self.assertIn("# [[approval.guardian.rules]]", settings["rules_toml"])
        self.assertIn("conf.toml.example", settings["rules_toml"])

    def test_save_guardian_settings_updates_values_and_keeps_llm_section(self):
        self.config_path.write_text(
            """
[approval]
mode = "interactive"
auto_response = "approve"

[approval.guardian]
enabled = false
timeout_seconds = 8
failure_policy = "manual_fallback"
explainability = "decision_only"
apply_to_methods = ["*"]

[[approval.guardian.rules]]
name = "protected files"
enabled = true
action = "manual_fallback"
priority = 110
path_any = ["pom.xml"]
path_glob_any = ["helm/**"]
require_db_schema_change = true

[approval.guardian.llm]
model = "gpt-4.1-mini"
max_tokens = 700
""".strip()
            + "\n",
            encoding="utf-8",
        )
        config.reload()

        saved = config.save_guardian_settings(
            enabled=True,
            timeout_seconds=20,
            failure_policy="deny",
            explainability="summary",
        )

        self.assertTrue(saved["enabled"])
        self.assertEqual(20, saved["timeout_seconds"])
        self.assertEqual("deny", saved["failure_policy"])
        self.assertEqual("summary", saved["explainability"])
        self.assertEqual(1, len(saved["rules"]))
        protected = saved["rules"][0]
        self.assertEqual("manual_fallback", protected["action"])
        self.assertEqual(["pom.xml"], protected["path_any"])
        self.assertTrue(protected["require_db_schema_change"])
        self.assertEqual(1, saved["rule_summary"]["enabled"])
        self.assertEqual(1, saved["rule_summary"]["action_counts"]["manual_fallback"])

        raw = self.config_path.read_text(encoding="utf-8")
        self.assertIn("[approval.guardian]", raw)
        self.assertIn("enabled = true", raw)
        self.assertIn("timeout_seconds = 20", raw)
        self.assertIn('failure_policy = "deny"', raw)
        self.assertIn('explainability = "summary"', raw)
        self.assertIn("[[approval.guardian.rules]]", raw)
        self.assertIn('name = "protected files"', raw)
        self.assertIn('action = "manual_fallback"', raw)
        self.assertIn('path_any = ["pom.xml"]', raw)
        self.assertIn('path_glob_any = ["helm/**"]', raw)
        self.assertIn("require_db_schema_change = true", raw)
        self.assertIn("[approval.guardian.llm]", raw)
        self.assertIn('model = "gpt-4.1-mini"', raw)

    def test_invalid_guardian_rules_are_filtered(self):
        self.config_path.write_text(
            """
[approval.guardian]
enabled = true

[[approval.guardian.rules]]
name = "broken"
action = "maybe"
match_question_any = ["git"]

[[approval.guardian.rules]]
name = "valid"
action = "approve"
match_question_any = ["git"]
""".strip()
            + "\n",
            encoding="utf-8",
        )
        config.reload()

        settings = config.get_guardian_settings()

        self.assertEqual(1, len(settings["rules"]))
        self.assertEqual("valid", settings["rules"][0]["name"])

    def test_save_guardian_settings_accepts_explicit_rules(self):
        self.config_path.write_text(
            """
[approval.guardian]
enabled = false
timeout_seconds = 8
failure_policy = "manual_fallback"
explainability = "decision_only"
apply_to_methods = ["*"]
""".strip()
            + "\n",
            encoding="utf-8",
        )
        config.reload()

        saved = config.save_guardian_settings(
            enabled=True,
            timeout_seconds=8,
            failure_policy="manual_fallback",
            explainability="decision_only",
            rules=[
                {
                    "name": "web raw rules",
                    "enabled": True,
                    "action": "manual_fallback",
                    "priority": 80,
                    "path_glob_any": ["helm/**"],
                }
            ],
        )

        self.assertEqual(1, len(saved["rules"]))
        web_rule = saved["rules"][0]
        self.assertEqual(["helm/**"], web_rule["path_glob_any"])

    def test_save_guardian_settings_accepts_toml_rules(self):
        saved = config.save_guardian_settings(
            enabled=True,
            timeout_seconds=8,
            failure_policy="manual_fallback",
            explainability="decision_only",
            rules_toml="""
[[approval.guardian.rules]]
name = "web toml rule"
enabled = true
action = "manual_fallback"
priority = 90
path_glob_any = ["helm/**"]
""".strip(),
        )

        self.assertEqual(1, len(saved["rules"]))
        toml_rule = saved["rules"][0]
        self.assertEqual(["helm/**"], toml_rule["path_glob_any"])

    def test_save_guardian_settings_accepts_comment_only_example_toml(self):
        saved = config.save_guardian_settings(
            enabled=True,
            timeout_seconds=8,
            failure_policy="manual_fallback",
            explainability="decision_only",
            rules_toml="""
# No Guardian rules are configured in conf.toml.
# Uncomment and edit the example rules below.
#
# [[approval.guardian.rules]]
# name = "secret files"
""".strip(),
        )

        self.assertEqual([], saved["rules"])

    def test_save_guardian_settings_rejects_invalid_explicit_rules(self):
        with self.assertRaisesRegex(ValueError, "Guardian rule #1 has invalid action"):
            config.save_guardian_settings(
                enabled=True,
                timeout_seconds=8,
                failure_policy="manual_fallback",
                explainability="decision_only",
                rules=[{"name": "broken", "action": "maybe"}],
            )

    def test_removed_default_rule_is_filtered_from_existing_config(self):
        self.config_path.write_text(
            """
[approval.guardian]
enabled = true

[[approval.guardian.rules]]
name = "block reviewer handoff after unit test failure"
enabled = true
action = "deny"
priority = 195
command_any = ["reviewer handoff", "handoff", "review"]
require_unit_test_failed = true
""".strip()
            + "\n",
            encoding="utf-8",
        )
        config.reload()

        settings = config.get_guardian_settings()

        self.assertNotIn(
            "block reviewer handoff after unit test failure",
            {rule["name"] for rule in settings["rules"]},
        )
        self.assertEqual([], settings["rules"])

    def test_get_web_password_from_password_env(self):
        self.config_path.write_text(
            """
[web]
password = "CHANGE_ME"
password_env = "CODEX_WEB_PASSWORD"
""".strip()
            + "\n",
            encoding="utf-8",
        )
        config.reload()
        with patch.dict("os.environ", {"CODEX_WEB_PASSWORD": "from-env"}, clear=False):
            self.assertEqual("from-env", config.get_web_password())

    def test_get_web_password_from_env_prefix(self):
        self.config_path.write_text(
            """
[web]
password = "env:CODEX_WEB_PASSWORD"
password_env = ""
""".strip()
            + "\n",
            encoding="utf-8",
        )
        config.reload()
        with patch.dict("os.environ", {"CODEX_WEB_PASSWORD": "from-prefix"}, clear=False):
            self.assertEqual("from-prefix", config.get_web_password())


if __name__ == "__main__":
    unittest.main()
