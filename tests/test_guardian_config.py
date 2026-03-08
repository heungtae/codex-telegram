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
        self.assertEqual("full_chain", settings["explainability"])

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
explainability = "full_chain"
apply_to_methods = ["*"]

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

        raw = self.config_path.read_text(encoding="utf-8")
        self.assertIn("[approval.guardian]", raw)
        self.assertIn("enabled = true", raw)
        self.assertIn("timeout_seconds = 20", raw)
        self.assertIn('failure_policy = "deny"', raw)
        self.assertIn('explainability = "summary"', raw)
        self.assertIn("[approval.guardian.llm]", raw)
        self.assertIn('model = "gpt-4.1-mini"', raw)

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
