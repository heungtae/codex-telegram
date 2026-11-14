import os
import unittest
from unittest import mock

from utils import single_instance
from utils.single_instance import SingleInstanceLock, find_local_conflict_candidates


@unittest.skipUnless(single_instance.fcntl is not None, "requires fcntl (Unix)")
class SingleInstanceLockTests(unittest.TestCase):
    def test_same_lock_name_allows_only_one_holder(self):
        lock1 = SingleInstanceLock("codex-telegram-test-lock")
        lock2 = SingleInstanceLock("codex-telegram-test-lock")
        self.assertTrue(lock1.acquire())
        self.assertFalse(lock2.acquire())
        lock1.release()
        self.assertTrue(lock2.acquire())
        lock2.release()


class NoFcntlPlatformTests(unittest.TestCase):
    """Regression tests for platforms without fcntl (e.g. Windows)."""

    def test_lock_acquires_without_fcntl(self):
        with mock.patch.object(single_instance, "fcntl", None):
            lock = SingleInstanceLock("codex-telegram-test-lock-no-fcntl")
            self.assertTrue(lock.acquire())
            self.assertEqual(lock.read_owner_pid(), os.getpid())
            lock.release()

    def test_conflict_scan_returns_empty_without_fcntl(self):
        with mock.patch.object(single_instance, "fcntl", None):
            self.assertEqual(find_local_conflict_candidates("some-token"), [])


if __name__ == "__main__":
    unittest.main()
