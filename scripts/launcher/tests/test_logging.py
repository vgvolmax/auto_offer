import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
from auto_offer_launcher.logging_utils import logger_for


def close_logger(log):
    for handler in list(log.handlers):
        log.removeHandler(handler)
        handler.close()


class LoggingTests(unittest.TestCase):
    def test_sensitive_messages_are_redacted(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "log"
            log = logger_for(path, "redaction-test")
            try:
                log.error("shutdown_token secret")
                self.assertNotIn("secret", path.read_text(encoding="utf-8"))
            finally:
                close_logger(log)

    def test_reconfiguration_closes_replaced_file_handler(self):
        with tempfile.TemporaryDirectory() as directory:
            first = logger_for(Path(directory) / "first.log", "reconfigure-test")
            replaced_handler = first.handlers[0]
            second = logger_for(Path(directory) / "second.log", "reconfigure-test")
            try:
                self.assertIsNone(replaced_handler.stream)
            finally:
                close_logger(second)


if __name__ == "__main__":
    unittest.main()
