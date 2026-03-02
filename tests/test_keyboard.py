import unittest

from bot.keyboard import main_menu_keyboard, settings_keyboard


class KeyboardTests(unittest.TestCase):
    def test_main_menu_keeps_settings_only_for_config_area(self):
        markup = main_menu_keyboard()
        callbacks = [
            button.callback_data
            for row in markup.inline_keyboard
            for button in row
            if button.callback_data
        ]
        self.assertIn("cmd:config", callbacks)
        self.assertNotIn("cmd:features", callbacks)
        self.assertNotIn("cmd:apps", callbacks)

    def test_settings_menu_exposes_all_settings_commands(self):
        markup = settings_keyboard()
        callbacks = [
            button.callback_data
            for row in markup.inline_keyboard
            for button in row
            if button.callback_data
        ]
        for expected in (
            "cmd:features",
            "cmd:apps",
            "cmd:projects",
            "cmd:guardian_settings",
            "cmd:models",
            "cmd:modes",
            "cmd:mcp",
            "cmd:config_view",
            "cmd:menu",
        ):
            self.assertIn(expected, callbacks)


if __name__ == "__main__":
    unittest.main()
