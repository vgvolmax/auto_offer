import json, tempfile, unittest
from pathlib import Path
from scripts.launcher.auto_offer_launcher.config import ConfigError, atomic_json, load_manifest, load_state
MANIFEST=Path('scripts/launcher/runtime-manifest.json')
class ConfigTests(unittest.TestCase):
 def test_manifest(self): self.assertEqual(load_manifest(MANIFEST)['port'],8765)
 def test_pinned_runtime_archives_are_consistent(self):
  manifest=load_manifest(MANIFEST)
  expected={
   'python':('3.13.7','python-3.13.7-embed-amd64.zip','https://www.python.org/ftp/python/3.13.7/python-3.13.7-embed-amd64.zip','f6cca216a359be84797cabb54149ce5e062afb16cc7567eb7fc51cacb2d86b65'),
   'node':('22.19.0','node-v22.19.0-win-x64.zip','https://nodejs.org/dist/v22.19.0/node-v22.19.0-win-x64.zip','ea3fad0e67a991d8477d8c01344b56e69c676ccb733f065b22436994b1253f86')}
  for name,(version,filename,url,checksum) in expected.items():
   with self.subTest(runtime=name):
    item=manifest[name]; self.assertEqual((item['version'],item['url'].rsplit('/',1)[-1],item['url'],item['sha256']),(version,filename,url,checksum))
 def mutate(self,fn):
  value=json.loads(MANIFEST.read_text()); fn(value)
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'m.json'; p.write_text(json.dumps(value));
   with self.assertRaises(ConfigError): load_manifest(p)
 def test_unknown(self): self.mutate(lambda x:x.update(extra=True))
 def test_sha(self): self.mutate(lambda x:x['node'].update(sha256='xyz'))
 def test_https(self): self.mutate(lambda x:x['python'].update(url='http://example.test/x'))
 def test_origin(self): self.mutate(lambda x:x.update(host='localhost'))
 def test_port(self): self.mutate(lambda x:x.update(port=9999))
 def test_atomic_and_corrupt_state(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'state.json'; atomic_json(p,{'ok':True}); self.assertEqual(load_state(p),{'ok':True}); p.write_text('{'); self.assertEqual(load_state(p),{})
