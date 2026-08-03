import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))

from auto_offer_launcher.config import ManifestError, load_release, load_runtime


class ManifestTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "dist/app").mkdir(parents=True)
        (self.root / "dist/app/index.html").write_text("ok", encoding="utf-8")
        self.file = {
            "path": "dist/app/index.html",
            "size": 2,
            "sha256": hashlib.sha256(b"ok").hexdigest(),
        }
        self.release = {
            "schema_version": 1,
            "app_identity": "auto-offer",
            "app_version": "1.1.0",
            "launcher_version": "1.0.0",
            "source_commit": "a" * 40,
            "build_timestamp": "2026-08-03T12:00:00+00:00",
            "host": "127.0.0.1",
            "port": 8765,
            "start_url": "http://127.0.0.1:8765/#/",
            "files": [self.file],
        }

    def tearDown(self):
        self.tmp.cleanup()

    def write_release(self):
        path = self.root / "release-manifest.json"
        path.write_text(json.dumps(self.release), encoding="utf-8")
        return path

    def runtime(self):
        return json.loads((HERE / "runtime-manifest.json").read_text(encoding="utf-8"))

    def write_runtime(self, data):
        path = self.root / "runtime-manifest.json"
        path.write_text(json.dumps(data), encoding="utf-8")
        return path

    def assert_invalid_release(self):
        with self.assertRaises(ManifestError):
            load_release(self.write_release(), self.root)

    def assert_invalid_runtime(self, data):
        with self.assertRaises(ManifestError):
            load_runtime(self.write_runtime(data))

    def test_valid_release(self):
        self.assertEqual(
            load_release(self.write_release(), self.root)["app_identity"],
            "auto-offer",
        )

    def test_unknown_field(self):
        self.release["unknown"] = 1
        self.assert_invalid_release()

    def test_malformed_sha(self):
        self.file["sha256"] = "bad"
        self.assert_invalid_release()

    def test_non_string_sha_is_rejected_as_manifest_error(self):
        self.file["sha256"] = True
        self.assert_invalid_release()

    def test_duplicate_path(self):
        self.release["files"].append(dict(self.file))
        self.assert_invalid_release()

    def test_absolute_path(self):
        self.file["path"] = "/x"
        self.assert_invalid_release()

    def test_parent_path(self):
        self.file["path"] = "dist/../x"
        self.assert_invalid_release()

    def test_missing_file(self):
        (self.root / "dist/app/index.html").unlink()
        self.assert_invalid_release()

    def test_size_mismatch(self):
        self.file["size"] = 3
        self.assert_invalid_release()

    def test_boolean_file_size_is_rejected(self):
        self.file["size"] = True
        self.assert_invalid_release()

    def test_checksum_mismatch(self):
        self.file["sha256"] = "0" * 64
        self.assert_invalid_release()

    def test_release_files_must_be_list(self):
        self.release["files"] = "dist/app/index.html"
        self.assert_invalid_release()

    def test_release_source_commit_must_be_full_lowercase_sha(self):
        self.release["source_commit"] = "abc"
        self.assert_invalid_release()

    def test_release_timestamp_must_be_iso_utc(self):
        self.release["build_timestamp"] = "now"
        self.assert_invalid_release()

    def test_release_scalar_strings_must_be_non_empty(self):
        self.release["app_version"] = ""
        self.assert_invalid_release()

    def test_boolean_release_schema_version_is_rejected(self):
        self.release["schema_version"] = True
        self.assert_invalid_release()

    def test_strict_runtime(self):
        self.assertEqual(load_runtime(HERE / "runtime-manifest.json")["port"], 8765)

    def test_runtime_non_https(self):
        data = self.runtime()
        data["python"]["url"] = "http://www.python.org/x"
        self.assert_invalid_runtime(data)

    def test_runtime_unknown_field(self):
        data = self.runtime()
        data["extra"] = 1
        self.assert_invalid_runtime(data)

    def test_boolean_runtime_schema_version_is_rejected(self):
        data = self.runtime()
        data["schema_version"] = True
        self.assert_invalid_runtime(data)

    def test_runtime_hosts_must_be_list(self):
        data = self.runtime()
        data["download_hosts"] = "www.python.org"
        self.assert_invalid_runtime(data)

    def test_runtime_python_must_be_object(self):
        data = self.runtime()
        data["python"] = "python"
        self.assert_invalid_runtime(data)

    def test_runtime_python_sha_must_be_string(self):
        data = self.runtime()
        data["python"]["sha256"] = True
        self.assert_invalid_runtime(data)

    def test_runtime_python_version_must_be_non_empty_string(self):
        data = self.runtime()
        data["python"]["version"] = 313
        self.assert_invalid_runtime(data)

    def test_runtime_health_path_must_be_non_empty_string(self):
        data = self.runtime()
        data["health_path"] = None
        self.assert_invalid_runtime(data)

    def test_runtime_paths_must_be_exact_object(self):
        data = self.runtime()
        data["runtime_paths"] = []
        self.assert_invalid_runtime(data)

    def test_runtime_path_values_must_be_non_empty_strings(self):
        data = self.runtime()
        data["runtime_paths"]["python"] = False
        self.assert_invalid_runtime(data)


if __name__ == "__main__":
    unittest.main()
