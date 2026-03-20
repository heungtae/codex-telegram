import unittest

from utils.normalize import clamp_int, parse_bool, parse_optional_bool, parse_positive_int


class NormalizeTests(unittest.TestCase):
    def test_parse_bool_supports_common_string_forms(self):
        self.assertTrue(parse_bool("yes"))
        self.assertFalse(parse_bool("off", default=True))
        self.assertTrue(parse_bool(1))

    def test_parse_optional_bool_returns_none_for_invalid_input(self):
        self.assertIsNone(parse_optional_bool("maybe"))

    def test_parse_positive_int_uses_default_for_invalid_values(self):
        self.assertEqual(7, parse_positive_int("0", 7))
        self.assertEqual(7, parse_positive_int(False, 7))
        self.assertEqual(9, parse_positive_int("9", 7))

    def test_clamp_int_applies_bounds(self):
        self.assertEqual(10, clamp_int("50", 20, minimum=10, maximum=10))
        self.assertEqual(60, clamp_int("30", 60, minimum=60, maximum=120))


if __name__ == "__main__":
    unittest.main()
