import unittest

from utils.single_instance import SingleInstanceLock


class SingleInstanceLockTests(unittest.TestCase):
    def test_same_lock_name_allows_only_one_holder(self):
        lock1 = SingleInstanceLock("codex-telegram-test-lock")
        lock2 = SingleInstanceLock("codex-telegram-test-lock")
        self.assertTrue(lock1.acquire())
        self.assertFalse(lock2.acquire())
        lock1.release()
        self.assertTrue(lock2.acquire())
        lock2.release()


if __name__ == "__main__":
    unittest.main()
