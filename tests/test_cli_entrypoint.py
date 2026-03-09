import unittest
from pathlib import Path
from unittest.mock import patch

from codex_telegram import cli


class CliEntrypointTests(unittest.TestCase):
    def test_load_root_main_module_uses_repo_main_file(self):
        captured: list[Path] = []
        original = cli.spec_from_file_location

        def recording_spec(name: str, location, *args, **kwargs):
            captured.append(Path(location))
            return original(name, location, *args, **kwargs)

        with patch("codex_telegram.cli.spec_from_file_location", side_effect=recording_spec):
            module = cli._load_root_main_module()

        self.assertTrue(callable(getattr(module, "main", None)))
        self.assertEqual(Path(__file__).resolve().parent.parent / "main.py", captured[0].resolve())


if __name__ == "__main__":
    unittest.main()
