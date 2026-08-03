import sys, tempfile, unittest
from pathlib import Path
HERE=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(HERE))
from auto_offer_launcher.logging_utils import logger_for
class LoggingTests(unittest.TestCase):
    def test_sensitive_messages_are_redacted(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/"log"; log=logger_for(p,"redaction-test"); log.error("shutdown_token secret")
            self.assertNotIn("secret",p.read_text())
