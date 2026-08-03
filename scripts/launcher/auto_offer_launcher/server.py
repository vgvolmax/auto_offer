from __future__ import annotations

import json
import os
import socket
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from .config import atomic_json, load_state
from .progress import console_print

HEALTH = "/__auto_offer_health"
IDENTITY_FIELDS = ("app_identity", "launcher_version", "project_root_id", "build_fingerprint")


def health_url(host, port):
    return f"http://{host}:{port}{HEALTH}"


def probe(host, port, timeout=.7):
    try:
        with urllib.request.urlopen(health_url(host, port), timeout=timeout) as response:
            return json.load(response)
    except (OSError, ValueError, urllib.error.URLError):
        return None


def listener_present(host, port, timeout=.3):
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def is_ours(value, expected):
    return (
        isinstance(value, dict)
        and isinstance(expected, dict)
        and all(value.get(field) == expected.get(field) for field in IDENTITY_FIELDS)
    )


def _unlink_with_retry(path, attempts=20, delay=.05):
    for attempt in range(attempts):
        try:
            path.unlink(missing_ok=True)
            return True
        except PermissionError as exc:
            if getattr(exc, "winerror", None) != 32 or attempt + 1 == attempts:
                raise
            time.sleep(delay)
    return False


def remove_owned_state(path, instance_id):
    current = load_state(path)
    if current.get("instance_id") != instance_id:
        return False
    return _unlink_with_retry(path)


def make_handler(root: Path, health: dict):
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(root), **kwargs)

        def log_message(self, fmt, *args):
            pass

        def end_headers(self):
            if self.path.split("?", 1)[0] in ("/", "/index.html"):
                self.send_header("Cache-Control", "no-store")
            else:
                self.send_header("Cache-Control", "public, max-age=3600")
            super().end_headers()

        def do_GET(self):
            if self.path.split("?", 1)[0] == HEALTH:
                body = json.dumps(health).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            super().do_GET()

    return Handler


def serve(root, state_file, host, port, identity, on_ready=None):
    started = datetime.now(timezone.utc).isoformat()
    instance_id = str(uuid.uuid4())
    health = {
        **identity,
        "pid": os.getpid(),
        "start_time": started,
        "instance_id": instance_id,
    }
    server = ThreadingHTTPServer((host, port), make_handler(root, health))
    atomic_json(state_file, health)
    if on_ready:
        on_ready(server)
    if os.name == "nt":
        try:
            import ctypes
            ctypes.windll.kernel32.SetConsoleTitleW("Auto Offer Server — close this window to stop")
        except (AttributeError, OSError):
            pass
    console_print("Auto Offer работает: http://127.0.0.1:8765/#/")
    console_print("Чтобы остановить приложение, закройте это окно.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        remove_owned_state(state_file, instance_id)
