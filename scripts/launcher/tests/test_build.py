import tempfile,time,unittest
from pathlib import Path
from unittest.mock import patch
from scripts.launcher.auto_offer_launcher.build import build_current,build_fingerprint,dependencies_current,make_build_staging,publish_build
class BuildTests(unittest.TestCase):
 def root(self,d):
  r=Path(d); (r/'app').mkdir(); (r/'app/x').write_text('x'); (r/'package.json').write_text('{}'); (r/'package-lock.json').write_text('{}'); return r
 def test_fingerprint_ignores_mtime_and_docs(self):
  with tempfile.TemporaryDirectory() as d:
   r=self.root(d); a=build_fingerprint(r,{'x':'y'}); time.sleep(.01); (r/'app/x').touch(); (r/'README').write_text('doc'); self.assertEqual(a,build_fingerprint(r,{'x':'y'}))
 def test_dependency_fingerprint_and_reuse(self):
  with tempfile.TemporaryDirectory() as d:
   r=self.root(d); (r/'node_modules/.bin').mkdir(parents=True); import hashlib
   lock=hashlib.sha256(b'{}').hexdigest(); state={'package_lock_sha256':lock,'node':{'version':'1'}}
   self.assertFalse(dependencies_current(r,state,'1'))
   for name in ('tsc.cmd','vite.cmd','vitest.cmd'): (r/'node_modules/.bin'/name).write_text('')
   self.assertTrue(dependencies_current(r,state,'1'))
   (r/'node_modules/.bin/vite.cmd').unlink()
   self.assertFalse(dependencies_current(r,state,'1'))
 def test_current_build_revalidates_referenced_assets(self):
  with tempfile.TemporaryDirectory() as d:
   r=self.root(d); app=r/'dist/app'; app.mkdir(parents=True)
   (app/'index.html').write_text('<script src="/assets/app.js"></script>')
   state={'build_input_fingerprint':'same'}
   self.assertFalse(build_current(r,state,'same'))
   (app/'assets').mkdir(); (app/'assets/app.js').write_text('ok')
   self.assertTrue(build_current(r,state,'same'))
 def test_failed_build_preserves_artifact(self):
  with tempfile.TemporaryDirectory() as d:
   r=Path(d); final=r/'app'; final.mkdir(); (final/'index.html').write_text('old'); temp=r/'new'; temp.mkdir(); (temp/'index.html').write_text('<script src="/missing.js"></script>')
   with self.assertRaises(RuntimeError): publish_build(temp,final)
   self.assertEqual((final/'index.html').read_text(),'old')
 def test_staging_directory_is_created_when_dist_does_not_exist(self):
  with tempfile.TemporaryDirectory() as d:
   final=Path(d)/'dist/app'
   staging=make_build_staging(final)
   try:
    self.assertEqual(staging.parent,final.parent)
    self.assertTrue(staging.is_dir())
   finally:
    staging.rmdir()
