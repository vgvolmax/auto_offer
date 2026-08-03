import io
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
from auto_offer_launcher.console import console_text


class EncodedText(io.StringIO):
    def __init__(self, encoding):
        super().__init__()
        self._encoding = encoding

    @property
    def encoding(self):
        return self._encoding


class ConsoleTests(unittest.TestCase):
    def test_preserves_unicode_when_stream_supports_it(self):
        stream = EncodedText("utf-8")
        console_text("Проверка", file=stream)
        self.assertEqual(stream.getvalue(), "Проверка\n")

    def test_uses_ascii_fallback_for_unsupported_characters(self):
        stream = EncodedText("ascii")
        console_text("Проверка", file=stream)
        self.assertIn(r"\u041f", stream.getvalue())
        self.assertTrue(stream.getvalue().endswith("\n"))


if __name__ == "__main__":
    unittest.main()
