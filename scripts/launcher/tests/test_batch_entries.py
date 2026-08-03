import unittest
from pathlib import Path


class BatchEntryTests(unittest.TestCase):
    def test_start_resolves_from_its_own_directory_and_forwards_arguments(self):
        text=Path("start.bat").read_text(encoding="utf-8").lower()
        self.assertIn('cd /d "%~dp0"',text)
        self.assertIn('-file "%~dp0scripts\\launcher\\bootstrap.ps1" %*',text)

    def test_server_has_a_visible_window_and_no_stop_entrypoint(self):
        self.assertFalse(Path("stop.bat").exists())
        text=Path("scripts/launcher/server-window.cmd").read_text(encoding="utf-8").lower()
        self.assertIn("title auto offer server",text)
        self.assertIn("close this window",text)
        self.assertIn('.runtime\\python\\python.exe',text)

    def test_python_download_has_bounded_retry_timeout_and_real_progress(self):
        text=Path("scripts/launcher/bootstrap.ps1").read_text(encoding="utf-8")
        self.assertIn("for ($attempt=1; $attempt -le 3; $attempt++)",text)
        self.assertIn("CancellationTokenSource",text)
        self.assertIn("Portable Python [{0}]",text)

    def test_npm_lifecycle_commands_receive_portable_node_path(self):
        text=Path("scripts/launcher/launcher.py").read_text(encoding="utf-8")
        self.assertIn("node_env=portable_node_environment(node)",text)
        self.assertEqual(text.count("env=node_env"),3)

    def test_windows_e2e_removes_system_node_from_path(self):
        text=Path(".github/workflows/windows-launcher.yml").read_text(encoding="utf-8")
        self.assertIn("Join-Path $entry 'node.exe'",text)
        self.assertIn("Get-Command node -ErrorAction SilentlyContinue",text)
