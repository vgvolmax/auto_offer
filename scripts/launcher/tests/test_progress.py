import unittest
from scripts.launcher.auto_offer_launcher.progress import download_line,redact,unicode_supported
class ProgressTests(unittest.TestCase):
 def test_determinate(self): self.assertIn('50%',download_line(1,'x',5,10,1))
 def test_indeterminate(self): self.assertIn('5 bytes',download_line(1,'x',5,0,1))
 def test_ascii(self): self.assertIn('##',download_line(1,'x',5,10,1,False))
 def test_redaction(self): self.assertNotIn('secret',redact('shutdown_token=secret cookie: secret'))
