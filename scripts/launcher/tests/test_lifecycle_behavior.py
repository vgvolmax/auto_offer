import importlib.util
import json
import logging
import multiprocessing
import os
import socket
import sys
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
from auto_offer_launcher.server import serve


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def run_server(app, state, port):
    identity = {"app_identity": "auto-offer", "app_version": "test",
                "release_fingerprint": "fixture", "launcher_version": "1.0.0",
                "host": "127.0.0.1", "port": port}
    serve(app, identity, state, logging.getLogger("fixture"))


class SilentListener(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(503)
        self.end_headers()

    def log_message(self, *_args):
        pass


class LifecycleBehaviorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.app = self.root / "app"
        self.app.mkdir()
        (self.app / "index.html").write_text("ok", encoding="utf-8")
        self.state = self.root / "server.json"
        self.processes = []

    def tearDown(self):
        for process in self.processes:
            if process.is_alive():
                process.terminate()
            process.join(5)
        self.temp.cleanup()

    def start_server(self):
        port = free_port()
        process = multiprocessing.Process(target=run_server, args=(self.app, self.state, port))
        process.start()
        self.processes.append(process)
        for _ in range(100):
            if self.state.exists():
                return process, port, json.loads(self.state.read_text(encoding="utf-8"))
            if not process.is_alive():
                self.fail("fixture server exited before publishing state")
            time.sleep(.02)
        self.fail("fixture server did not publish state")

    def test_state_is_published_after_bind_and_health_has_process_identity(self):
        port = free_port()
        identity = {"app_identity": "auto-offer", "app_version": "test",
                    "release_fingerprint": "fixture", "launcher_version": "1.0.0",
                    "host": "127.0.0.1", "port": port}

        class BindFailure:
            def __init__(self, *_args, **_kwargs):
                raise OSError("fixture bind failed")

        with self.assertRaisesRegex(OSError, "fixture bind failed"):
            serve(self.app, identity, self.state, logging.getLogger("bind-failure"),
                  server_class=BindFailure)
        self.assertFalse(self.state.exists())

        process, port, saved = self.start_server()
        health = json.load(urlopen(f"http://127.0.0.1:{port}/__auto_offer_health"))
        self.assertGreater(health["pid"], 0)
        self.assertEqual(health["pid"], process.pid)
        self.assertEqual((health["pid"], health["instance_id"]),
                         (saved["pid"], saved["instance_id"]))

    def test_authenticated_shutdown_and_owned_state_cleanup(self):
        process, port, saved = self.start_server()
        endpoint = f"http://127.0.0.1:{port}/__auto_offer_shutdown"
        with self.assertRaises(HTTPError) as rejected:
            urlopen(Request(endpoint, method="POST", headers={"X-Auto-Offer-Shutdown": "wrong"}))
        self.assertEqual(rejected.exception.code, 403)
        self.assertTrue(process.is_alive())
        urlopen(Request(endpoint, method="POST", headers={"X-Auto-Offer-Shutdown": saved["shutdown_token"]})).read()
        process.join(5)
        self.assertFalse(process.is_alive())
        self.assertFalse(self.state.exists())

    def test_old_process_never_removes_replacement_state(self):
        process, port, saved = self.start_server()
        replacement = {"instance_id": "replacement", "pid": os.getpid()}
        self.state.write_text(json.dumps(replacement), encoding="utf-8")
        urlopen(Request(f"http://127.0.0.1:{port}/__auto_offer_shutdown", method="POST",
                        headers={"X-Auto-Offer-Shutdown": saved["shutdown_token"]})).read()
        process.join(5)
        self.assertEqual(json.loads(self.state.read_text(encoding="utf-8")), replacement)

    def test_shutdown_token_is_absent_from_process_arguments_and_logs(self):
        process, port, saved = self.start_server()
        if Path(f"/proc/{process.pid}/cmdline").exists():
            argv = Path(f"/proc/{process.pid}/cmdline").read_bytes()
            self.assertNotIn(saved["shutdown_token"].encode(), argv)
        self.assertNotIn(saved["shutdown_token"], "fixture server startup")
        urlopen(Request(f"http://127.0.0.1:{port}/__auto_offer_shutdown", method="POST",
                        headers={"X-Auto-Offer-Shutdown": saved["shutdown_token"]})).read()


class ListenerBehaviorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location("launcher_under_test", HERE / "launcher.py")
        cls.launcher = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.launcher)

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.original_port = self.launcher.PORT
        self.original_state = self.launcher.STATE_PATH
        self.launcher.PORT = free_port()
        self.launcher.STATE_PATH = Path(self.temp.name) / "server.json"

    def tearDown(self):
        self.launcher.PORT = self.original_port
        self.launcher.STATE_PATH = self.original_state
        self.temp.cleanup()

    def test_closed_port_clears_stale_state_and_stop_is_idempotent(self):
        self.launcher.STATE_PATH.write_text(json.dumps({"instance_id": "stale"}), encoding="utf-8")
        self.assertEqual(self.launcher.inspect_listener()[0], "closed")
        self.assertFalse(self.launcher.STATE_PATH.exists())
        self.assertTrue(self.launcher.owned_stop())
        self.assertTrue(self.launcher.owned_stop())

    def test_open_unhealthy_foreign_listener_is_not_stopped_or_state_removed(self):
        server = ThreadingHTTPServer(("127.0.0.1", self.launcher.PORT), SilentListener)
        thread = threading.Thread(target=server.serve_forever); thread.start()
        marker = {"instance_id": "do-not-touch"}
        self.launcher.STATE_PATH.write_text(json.dumps(marker), encoding="utf-8")
        try:
            self.assertEqual(self.launcher.inspect_listener()[0], "unresponsive")
            self.assertFalse(self.launcher.owned_stop())
            self.assertEqual(json.loads(self.launcher.STATE_PATH.read_text()), marker)
            self.assertTrue(thread.is_alive())
        finally:
            server.shutdown(); server.server_close(); thread.join()


if __name__ == "__main__":
    unittest.main()
