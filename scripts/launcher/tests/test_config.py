import json, tempfile, unittest
from pathlib import Path
from scripts.launcher.auto_offer_launcher.config import ConfigError, atomic_json, load_manifest, load_state
MANIFEST=Path('scripts/launcher/runtime-manifest.json')
class ConfigTests(unittest.TestCase):
 def test_manifest(self): self.assertEqual(load_manifest(MANIFEST)['port'],8765)
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
