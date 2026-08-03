import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from scripts.launcher.launcher import node_runtime_current, server_identity


class LauncherRuntimeTests(unittest.TestCase):
    def manifest(self):
        return {
            'launcher_version':'1',
            'node':{'version':'22.19.0','sha256':'abc','executable':'node.exe'},
        }

    def test_node_runtime_must_be_complete_and_report_pinned_version(self):
        with tempfile.TemporaryDirectory() as d:
            node=Path(d); (node/'node.exe').write_text(''); (node/'npm.cmd').write_text('')
            state={'node':{'version':'22.19.0','sha256':'abc'}}
            with patch('scripts.launcher.launcher.subprocess.run',return_value=Mock(returncode=0,stdout='v22.19.0\n')):
                self.assertTrue(node_runtime_current(self.manifest(),node,state))
            (node/'npm.cmd').unlink()
            self.assertFalse(node_runtime_current(self.manifest(),node,state))
            (node/'npm.cmd').write_text('')
            with patch('scripts.launcher.launcher.subprocess.run',return_value=Mock(returncode=0,stdout='v21.0.0\n')):
                self.assertFalse(node_runtime_current(self.manifest(),node,state))

    def test_server_identity_changes_with_root_or_build(self):
        first=server_identity(self.manifest(),Path('A'), 'build-a')
        self.assertNotEqual(first,server_identity(self.manifest(),Path('B'),'build-a'))
        self.assertNotEqual(first,server_identity(self.manifest(),Path('A'),'build-b'))
