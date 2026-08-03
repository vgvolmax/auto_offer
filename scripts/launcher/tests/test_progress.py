import io,sys,unittest
from unittest.mock import patch
from scripts.launcher.auto_offer_launcher.progress import Reporter,download_line,redact,unicode_supported
class ProgressTests(unittest.TestCase):
 def test_determinate(self): self.assertIn('50%',download_line(1,'x',5,10,1))
 def test_indeterminate(self): self.assertIn('5 bytes',download_line(1,'x',5,0,1))
 def test_ascii(self): self.assertIn('##',download_line(1,'x',5,10,1,False))
 def test_redaction(self): self.assertNotIn('secret',redact('shutdown_token=secret cookie: secret'))
 def test_stage_falls_back_when_console_cannot_encode_unicode(self):
  raw=io.BytesIO(); stream=io.TextIOWrapper(raw,encoding='cp1252',errors='strict')
  with patch.object(sys,'stdout',stream): Reporter().stage(2,'Portable Node.js','готово')
  stream.flush(); rendered=raw.getvalue().decode('cp1252')
  self.assertIn('[2/7] Portable Node.js',rendered)
  self.assertTrue(rendered.isascii())
