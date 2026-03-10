import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import utils.config as config


class ReviewerConfigTests(unittest.TestCase):
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

    def test_reviewer_defaults_to_disabled(self):
        settings = config.get_reviewer_settings()
        self.assertFalse(settings["enabled"])
        self.assertEqual(1, settings["max_attempts"])
        self.assertEqual(8, settings["timeout_seconds"])
        self.assertEqual(3, settings["recent_turn_pairs"])

    def test_save_reviewer_settings_updates_values(self):
        self.config_path.write_text(
            """
[validation.reviewer]
enabled = false
max_attempts = 3
timeout_seconds = 8
recent_turn_pairs = 3
""".strip()
            + "\n",
            encoding="utf-8",
        )
        config.reload()

        saved = config.save_reviewer_settings(
            enabled=True,
            max_attempts=5,
            timeout_seconds=20,
            recent_turn_pairs=2,
        )

        self.assertTrue(saved["enabled"])
        self.assertEqual(5, saved["max_attempts"])
        self.assertEqual(20, saved["timeout_seconds"])
        self.assertEqual(2, saved["recent_turn_pairs"])

        raw = self.config_path.read_text(encoding="utf-8")
        self.assertIn("[validation.reviewer]", raw)
        self.assertIn("enabled = true", raw)
        self.assertIn("max_attempts = 5", raw)
        self.assertIn("timeout_seconds = 20", raw)
        self.assertIn("recent_turn_pairs = 2", raw)


if __name__ == "__main__":
    unittest.main()
