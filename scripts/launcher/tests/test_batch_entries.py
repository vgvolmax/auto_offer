import unittest
from pathlib import Path


class BatchEntryTests(unittest.TestCase):
    def test_start_resolves_from_its_own_directory_and_forwards_arguments(self):
        text=Path("start.bat").read_text(encoding="utf-8").lower()
        self.assertIn('cd /d "%~dp0"',text)
        self.assertIn('-file "%~dp0scripts\\launcher\\bootstrap.ps1" %*',text)

    def test_stop_uses_only_project_local_python(self):
        text=Path("stop.bat").read_text(encoding="utf-8").lower()
        self.assertIn('set "python=%~dp0.runtime\\python\\python.exe"',text)
        self.assertNotIn("where python",text)
