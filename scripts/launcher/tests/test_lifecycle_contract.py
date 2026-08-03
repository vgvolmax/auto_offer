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


if __name__ == "__main__": unittest.main()
