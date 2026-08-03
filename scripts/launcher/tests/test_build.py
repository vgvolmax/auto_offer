import tempfile,time,unittest
from pathlib import Path
from unittest.mock import patch
from scripts.launcher.auto_offer_launcher.build import build_fingerprint,dependencies_current,publish_build
class BuildTests(unittest.TestCase):
 def root(self,d):
  r=Path(d); (r/'app').mkdir(); (r/'app/x').write_text('x'); (r/'package.json').write_text('{}'); (r/'package-lock.json').write_text('{}'); return r
 def test_fingerprint_ignores_mtime_and_docs(self):
  with tempfile.TemporaryDirectory() as d:
   r=self.root(d); a=build_fingerprint(r,{'x':'y'}); time.sleep(.01); (r/'app/x').touch(); (r/'README').write_text('doc'); self.assertEqual(a,build_fingerprint(r,{'x':'y'}))
 def test_dependency_fingerprint_and_reuse(self):
  with tempfile.TemporaryDirectory() as d:
   r=self.root(d); (r/'node_modules').mkdir(); import hashlib
   lock=hashlib.sha256(b'{}').hexdigest(); self.assertTrue(dependencies_current(r,{'package_lock_sha256':lock,'node':{'version':'1'}},'1'))
 def test_failed_build_preserves_artifact(self):
  with tempfile.TemporaryDirectory() as d:
   r=Path(d); final=r/'app'; final.mkdir(); (final/'index.html').write_text('old'); temp=r/'new'; temp.mkdir(); (temp/'index.html').write_text('<script src="/missing.js"></script>')
   with self.assertRaises(RuntimeError): publish_build(temp,final)
   self.assertEqual((final/'index.html').read_text(),'old')
