import hmac
import json
import mimetypes
import os
import re
import secrets
import threading
import time
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

FINGERPRINTED = re.compile(r"[.-][0-9a-fA-F]{8,}[.-]")


def atomic_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + "." + uuid.uuid4().hex + ".tmp")
    try:
        tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp, path)
    finally:
        if tmp.exists():
            tmp.unlink()


def remove_owned_state(path, instance_id, log=None):
    """Remove state only while it still names this server; never hide WinError 32."""
    path = Path(path)
    for attempt in range(5):
        try:
            if not path.exists():
                return True
            saved = json.loads(path.read_text(encoding="utf-8"))
            if saved.get("instance_id") != instance_id:
                return False
            path.unlink()
            return True
        except (OSError, ValueError) as exc:
            if attempt == 4:
                if log:
                    log.error("could not remove owned server state after retries: %s", type(exc).__name__)
                raise
            time.sleep(.1 * (attempt + 1))


def handler_factory(app_dir, health, token):
    app_dir = Path(app_dir).resolve()

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt, *args):
            self.server.log.info("request %s", fmt % args)

        def _json(self, status, data):
            body = json.dumps(data).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            path = urlsplit(self.path).path
            if path == "/__auto_offer_health":
                return self._json(200, health)
            rel = "index.html" if path == "/" else unquote(path).lstrip("/")
            target = (app_dir / rel).resolve()
            try:
                target.relative_to(app_dir)
            except ValueError:
                return self.send_error(404)
            if not target.is_file():
                return self.send_error(404)
            body = target.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", mimetypes.guess_type(target.name)[0] or "application/octet-stream")
            self.send_header("Cache-Control", "public, max-age=31536000, immutable" if FINGERPRINTED.search(target.name) else "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_POST(self):
            if urlsplit(self.path).path != "/__auto_offer_shutdown" or self.client_address[0] not in ("127.0.0.1", "::1"):
                return self.send_error(404)
            if not hmac.compare_digest(self.headers.get("X-Auto-Offer-Shutdown", ""), token):
                return self.send_error(403)
            self._json(200, {"status": "stopping"})
            threading.Thread(target=self.server.shutdown, daemon=True).start()

    return Handler


def serve(app_dir, identity, state_path, log, server_class=ThreadingHTTPServer):
    """Bind first, then create all secret/state data in the owning process."""
    instance_id = str(uuid.uuid4())
    token = secrets.token_urlsafe(32)
    health = {
        **identity,
        "pid": os.getpid(),
        "instance_id": instance_id,
        "start_time": datetime.now(timezone.utc).isoformat(),
    }
    server = server_class((identity["host"], identity["port"]), handler_factory(app_dir, health, token))
    server.log = log
    state = {**health, "shutdown_token": token}
    try:
        atomic_json(state_path, state)
        server.serve_forever()
    finally:
        server.server_close()
        remove_owned_state(state_path, instance_id, log)
