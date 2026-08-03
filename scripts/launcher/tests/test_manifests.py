import hashlib, json, sys, tempfile, unittest
from pathlib import Path
HERE=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(HERE))
from auto_offer_launcher.config import ManifestError, load_release, load_runtime

class ManifestTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.root=Path(self.tmp.name); (self.root/"dist/app").mkdir(parents=True); (self.root/"dist/app/index.html").write_text("ok")
        p=self.root/"dist/app/index.html"; self.file={"path":"dist/app/index.html","size":2,"sha256":hashlib.sha256(b"ok").hexdigest()}
        self.release={"schema_version":1,"app_identity":"auto-offer","app_version":"1.1.0","launcher_version":"1.0.0","source_commit":"abc","build_timestamp":"now","host":"127.0.0.1","port":8765,"start_url":"http://127.0.0.1:8765/#/","files":[self.file]}
    def tearDown(self): self.tmp.cleanup()
    def write(self):
        p=self.root/"release-manifest.json"; p.write_text(json.dumps(self.release)); return p
    def test_valid_release(self): self.assertEqual(load_release(self.write(),self.root)["app_identity"],"auto-offer")
    def test_unknown_field(self): self.release["unknown"]=1; self.assertRaises(ManifestError,load_release,self.write(),self.root)
    def test_malformed_sha(self): self.file["sha256"]="bad"; self.assertRaises(ManifestError,load_release,self.write(),self.root)
    def test_duplicate_path(self): self.release["files"].append(dict(self.file)); self.assertRaises(ManifestError,load_release,self.write(),self.root)
    def test_absolute_path(self): self.file["path"]="/x"; self.assertRaises(ManifestError,load_release,self.write(),self.root)
    def test_parent_path(self): self.file["path"]="dist/../x"; self.assertRaises(ManifestError,load_release,self.write(),self.root)
    def test_missing_file(self): (self.root/"dist/app/index.html").unlink(); self.assertRaises(ManifestError,load_release,self.write(),self.root)
    def test_size_mismatch(self): self.file["size"]=3; self.assertRaises(ManifestError,load_release,self.write(),self.root)
    def test_checksum_mismatch(self): self.file["sha256"]="0"*64; self.assertRaises(ManifestError,load_release,self.write(),self.root)
    def test_strict_runtime(self): self.assertEqual(load_runtime(HERE/"runtime-manifest.json")["port"],8765)
    def test_runtime_non_https(self):
        d=json.loads((HERE/"runtime-manifest.json").read_text()); d["python"]["url"]="http://www.python.org/x"; p=self.root/"r.json"; p.write_text(json.dumps(d)); self.assertRaises(ManifestError,load_runtime,p)
    def test_runtime_unknown_field(self):
        d=json.loads((HERE/"runtime-manifest.json").read_text()); d["extra"]=1; p=self.root/"r.json"; p.write_text(json.dumps(d)); self.assertRaises(ManifestError,load_runtime,p)
