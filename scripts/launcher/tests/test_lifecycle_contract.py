import sys, unittest
from pathlib import Path

HERE=Path(__file__).resolve().parents[1]


class LifecycleContractTests(unittest.TestCase):
    def test_shutdown_secret_is_not_a_server_argument(self):
        source=(HERE/"launcher.py").read_text(encoding="utf-8")
        self.assertNotIn('"--token"', source)
        self.assertNotIn("serve --token", source)

    def test_bootstrap_holds_mutex_while_launcher_runs(self):
        source=(HERE/"bootstrap.ps1").read_text(encoding="utf-8")
        launch=source.index("& $pythonExe @args")
        release=source.index("$mutex.ReleaseMutex()")
        self.assertLess(launch, release)

    def test_bounded_download_attempts(self):
        source=(HERE/"bootstrap.ps1").read_text(encoding="utf-8")
        self.assertIn("$attempt -le 3", source)

    def test_start_bat_maps_public_no_browser_option(self):
        source=(HERE.parents[1]/"start.bat").read_text(encoding="utf-8")
        self.assertIn('if /I "%~1"=="--no-browser"', source)
        self.assertIn("-NoBrowser", source)

    def test_bootstrap_hashes_without_optional_powershell_cmdlets(self):
        source=(HERE/"bootstrap.ps1").read_text(encoding="utf-8")
        self.assertNotIn("Get-FileHash", source)
        self.assertIn("[Security.Cryptography.SHA256]::Create()", source)

    def test_python_version_probe_avoids_embedded_native_quotes(self):
        source=(HERE/"bootstrap.ps1").read_text(encoding="utf-8")
        self.assertNotIn('print(".".join', source)
        self.assertEqual(source.count("print(sys.version.split()[0])"), 2)

    def test_launcher_disables_bytecode_before_local_imports(self):
        source=(HERE/"launcher.py").read_text(encoding="utf-8")
        disabled=source.index("sys.dont_write_bytecode = True")
        local_import=source.index("from auto_offer_launcher")
        self.assertLess(disabled, local_import)


if __name__ == "__main__": unittest.main()
