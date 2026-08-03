import argparse, json, shutil, sys, tempfile, unittest
from pathlib import Path

HERE=Path(__file__).resolve().parents[1]
ROOT=HERE.parents[1]
sys.path.insert(0,str(HERE)); sys.path.insert(0,str(ROOT/"scripts/launcher"))
from build_windows_release import audit, build
from auto_offer_launcher.config import ManifestError, load_release


class ReleaseContractTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.base=Path(self.tmp.name)
        self.app=self.base/"app"; self.app.mkdir()
        (self.app/"index.html").write_text('<script src="/asset.12345678.js"></script>',encoding="utf-8")
        (self.app/"asset.12345678.js").write_text("ok",encoding="utf-8")
        self.stage=self.base/"Тест Auto Offer"/"release"
        build(argparse.Namespace(app=self.app,output=self.stage,source_commit="a"*40,build_timestamp="2026-08-03T00:00:00Z"))

    def tearDown(self): self.tmp.cleanup()
    def verify(self): return load_release(self.stage/"release-manifest.json",self.stage)

    def test_bootstrap_has_utf8_bom_for_windows_powershell(self):
        bootstrap = self.stage/"scripts/launcher/bootstrap.ps1"
        self.assertTrue(bootstrap.read_bytes().startswith(b"\xef\xbb\xbf"))

    def test_manifest_exact_hashes_and_unicode_path(self): self.verify(); audit(self.stage)
    def test_changed_file_is_rejected(self):
        (self.stage/"dist/app/index.html").write_text("changed")
        self.assertRaises(ManifestError,self.verify)
    def test_extra_file_is_rejected(self):
        (self.stage/"extra.txt").write_text("x")
        self.assertRaises(ManifestError,self.verify)
    def test_missing_referenced_asset_is_rejected(self):
        (self.stage/"dist/app/asset.12345678.js").unlink()
        self.assertRaises(ManifestError,self.verify)
    def test_forbidden_content_is_rejected(self):
        (self.stage/"node_modules").mkdir(); (self.stage/"node_modules/x").write_text("x")
        self.assertRaises(ValueError,audit,self.stage)


if __name__ == "__main__": unittest.main()
