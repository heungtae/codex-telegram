import types
import unittest
from unittest.mock import AsyncMock, patch

from app_runtime import bootstrap
from utils.pypi_check import VersionInfo


class BootstrapUpdateCheckTests(unittest.IsolatedAsyncioTestCase):
    @patch("app_runtime.bootstrap.check_latest_version", new_callable=AsyncMock)
    async def test_check_update_logs_warning_when_outdated(self, mock_check_latest_version):
        mock_check_latest_version.return_value = VersionInfo(
            current="0.4.9",
            latest="0.4.10",
            is_outdated=True,
            release_url="https://pypi.org/project/codex-telegram/0.4.10/",
        )

        with self.assertLogs("codex-telegram", level="WARNING") as logs:
            await bootstrap._check_update(verify_ssl=True)

        self.assertTrue(any("A newer version of codex-telegram is available" in entry for entry in logs.output))

    @patch("app_runtime.bootstrap.check_latest_version", new_callable=AsyncMock)
    async def test_check_update_logs_info_when_up_to_date(self, mock_check_latest_version):
        mock_check_latest_version.return_value = VersionInfo(
            current="0.4.10",
            latest="0.4.10",
            is_outdated=False,
            release_url="https://pypi.org/project/codex-telegram/0.4.10/",
        )

        with self.assertLogs("codex-telegram", level="INFO") as logs:
            await bootstrap._check_update(verify_ssl=True)

        self.assertTrue(any("codex-telegram is up to date at version 0.4.10." in entry for entry in logs.output))

    async def test_post_shutdown_resets_update_notified(self):
        state_module = types.SimpleNamespace(
            codex_client=None,
            approval_guardian=None,
            command_router=object(),
            codex_ready=types.SimpleNamespace(clear=lambda: None),
            update_notified=True,
        )

        await bootstrap.post_shutdown(None, state_module=state_module)

        self.assertFalse(state_module.update_notified)


if __name__ == "__main__":
    unittest.main()
