import unittest
from contextlib import ExitStack
from unittest.mock import AsyncMock, Mock, patch

from telegram.error import InvalidToken, NetworkError
from telegram.ext import Application

import main


class BootstrapConfigTests(unittest.TestCase):
    def test_retry_count_validation(self):
        for value, expected in [(5, 5), (0, 0), (2, 2), (-1, 5),
                                (True, 5), (None, 5), ("3", 5)]:
            with self.subTest(value=value), \
                    patch.object(main, "get_telegram_bot", return_value=value):
                self.assertEqual(main._resolve_bootstrap_retries(), expected)

    def test_polling_receives_retry_budget_and_always_cleans_up(self):
        for failure in [None, NetworkError("connection failed")]:
            with self.subTest(failure=failure), ExitStack() as stack:
                app = Mock()
                app.run_polling.side_effect = failure
                lock = Mock()
                stack.enter_context(patch.object(main, "_parse_web_endpoint",
                    return_value=(False, "localhost", 9090, "http://localhost:9090", False, "", "")))
                stack.enter_context(patch.object(main, "get", return_value=True))
                stack.enter_context(patch.dict(main.os.environ, {"CODEX_WEB_ONLY": "0"}))
                stack.enter_context(patch.object(main, "get_telegram_bot", return_value="test-token"))
                stack.enter_context(patch.object(main, "_resolve_drop_pending_updates", return_value=True))
                stack.enter_context(patch.object(main, "_resolve_bootstrap_retries", return_value=5))
                stack.enter_context(patch.object(main, "_acquire_single_instance", return_value=lock))
                stack.enter_context(patch.object(main, "_build_telegram_application", return_value=app))
                stop = stack.enter_context(patch.object(main, "stop_web_server"))
                if failure:
                    with self.assertRaises(NetworkError):
                        main.main()
                else:
                    main.main()
                self.assertEqual(app.run_polling.call_args.kwargs["bootstrap_retries"], 5)
                self.assertIsNone(app.run_polling.call_args.kwargs["stop_signals"])
                stop.assert_called_once()
                lock.release.assert_called_once()


class BootstrapRecoveryTests(unittest.IsolatedAsyncioTestCase):
    async def test_transient_connection_failure_recovers(self):
        application = Mock()
        application.initialize = AsyncMock(side_effect=[NetworkError("TLS connect failed"), None])
        with patch("telegram.ext._utils.networkloop.asyncio.sleep", new_callable=AsyncMock):
            await Application._bootstrap_initialize(application, max_retries=5)
        self.assertEqual(application.initialize.await_count, 2)

    async def test_retry_budget_exhaustion(self):
        application = Mock()
        application.initialize = AsyncMock(side_effect=NetworkError("TLS connect failed"))
        with patch("telegram.ext._utils.networkloop.asyncio.sleep", new_callable=AsyncMock):
            with self.assertRaises(NetworkError):
                await Application._bootstrap_initialize(application, max_retries=2)
        self.assertEqual(application.initialize.await_count, 3)

    async def test_invalid_token_is_not_retried(self):
        application = Mock()
        application.initialize = AsyncMock(side_effect=InvalidToken("invalid"))
        with self.assertRaises(InvalidToken):
            await Application._bootstrap_initialize(application, max_retries=5)
        application.initialize.assert_awaited_once()
