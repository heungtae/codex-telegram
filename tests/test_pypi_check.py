import unittest
from unittest.mock import AsyncMock, patch, MagicMock

from utils.pypi_check import _compare_versions, check_latest_version, format_update_message, VersionInfo


class VersionCompareTests(unittest.TestCase):
    def test_compare_versions_current_lower(self):
        self.assertEqual(_compare_versions("0.3.0", "0.4.0"), -1)
        self.assertEqual(_compare_versions("0.4.0", "0.5.0"), -1)
        self.assertEqual(_compare_versions("1.0.0", "2.0.0"), -1)

    def test_compare_versions_current_higher(self):
        self.assertEqual(_compare_versions("0.5.0", "0.4.0"), 1)
        self.assertEqual(_compare_versions("1.0.0", "0.9.0"), 1)

    def test_compare_versions_equal(self):
        self.assertEqual(_compare_versions("0.4.0", "0.4.0"), 0)
        self.assertEqual(_compare_versions("1.0.0", "1.0.0"), 0)


class FormatUpdateMessageTests(unittest.TestCase):
    def test_format_update_message(self):
        info = VersionInfo(
            current="0.3.0",
            latest="0.4.0",
            is_outdated=True,
            release_url="https://pypi.org/project/codex-telegram/0.4.1/",
        )
        message = format_update_message(info)
        self.assertIn("0.3.0", message)
        self.assertIn("0.4.0", message)
        self.assertIn("pip install --upgrade", message)
        self.assertIn("Update Available", message)


class CheckLatestVersionTests(unittest.TestCase):
    @patch("utils.pypi_check.httpx.AsyncClient")
    def test_check_latest_version_outdated(self, mock_client_class):
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "info": {"version": "0.5.0"},
            "releases": {
                "0.5.0": [{"url": "https://example.com/package.tar.gz"}]
            },
        }

        async def mock_get(*args, **kwargs):
            response = MagicMock()
            response.json.return_value = mock_response.json()
            response.raise_for_status = MagicMock()
            return response

        mock_client = MagicMock()
        mock_client.get = mock_get
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock()
        mock_client_class.return_value = mock_client

        import asyncio
        result = asyncio.run(check_latest_version())

        self.assertIsNotNone(result)
        self.assertEqual(result.current, "0.4.1")
        self.assertEqual(result.latest, "0.5.0")
        self.assertTrue(result.is_outdated)

    @patch("utils.pypi_check.httpx.AsyncClient")
    def test_check_latest_version_up_to_date(self, mock_client_class):
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "info": {"version": "0.4.1"},
            "releases": {
                "0.4.1": [{"url": "https://example.com/package.tar.gz"}]
            },
        }

        async def mock_get(*args, **kwargs):
            response = MagicMock()
            response.json.return_value = mock_response.json()
            response.raise_for_status = MagicMock()
            return response

        mock_client = MagicMock()
        mock_client.get = mock_get
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock()
        mock_client_class.return_value = mock_client

        import asyncio
        result = asyncio.run(check_latest_version())

        self.assertIsNotNone(result)
        self.assertEqual(result.current, "0.4.1")
        self.assertEqual(result.latest, "0.4.1")
        self.assertFalse(result.is_outdated)

    @patch("utils.pypi_check.httpx.AsyncClient")
    def test_check_latest_version_network_error(self, mock_client_class):
        import httpx

        async def mock_get(*args, **kwargs):
            raise httpx.HTTPError("Network error")

        mock_client = MagicMock()
        mock_client.get = mock_get
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock()
        mock_client_class.return_value = mock_client

        import asyncio
        result = asyncio.run(check_latest_version())

        self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()
