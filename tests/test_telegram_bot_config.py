import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import utils.config as config


class TelegramBotConfigTests(unittest.TestCase):
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

    def test_get_telegram_bot_prefers_telegram_bot_section(self):
        self.config_path.write_text(
            (
                "[telegram.bot]\n"
                "token = \"new-token\"\n"
                "\n"
                "[bot]\n"
                "token = \"old-token\"\n"
            ),
            encoding="utf-8",
        )
        config.reload()
        self.assertEqual("new-token", config.get_telegram_bot("token"))

    def test_get_telegram_bot_falls_back_to_legacy_bot_section(self):
        self.config_path.write_text(
            "[bot]\n"
            "token = \"legacy-token\"\n",
            encoding="utf-8",
        )
        config.reload()
        self.assertEqual("legacy-token", config.get_telegram_bot("token"))


if __name__ == "__main__":
    unittest.main()
