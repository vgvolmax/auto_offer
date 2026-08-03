import hmac, json, mimetypes, os, re, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

FINGERPRINTED = re.compile(r"[.-][0-9a-fA-F]{8,}[.-]")

def atomic_json(path, value):
    path = Path(path); tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, path)

def remove_owned_state(path, instance_id):
    path = Path(path)
    for attempt in range(5):
        try:
            if path.exists() and json.loads(path.read_text(encoding="utf-8")).get("instance_id") == instance_id: path.unlink()
            return
        except (PermissionError, OSError):
            if attempt == 4: return
            time.sleep(.1 * (attempt + 1))

def handler_factory(app_dir, health, token, state_path):
    app_dir = Path(app_dir).resolve()
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt, *args): self.server.log.info("request %s", fmt % args)
        def _json(self, status, data):
            body=json.dumps(data).encode(); self.send_response(status); self.send_header("Content-Type","application/json"); self.send_header("Content-Length",str(len(body))); self.end_headers(); self.wfile.write(body)
        def do_GET(self):
            path=urlsplit(self.path).path
            if path == "/__auto_offer_health": return self._json(200, health)
            if path == "/": rel="index.html"
            else: rel=unquote(path).lstrip("/")
            target=(app_dir / rel).resolve()
            try: target.relative_to(app_dir)
            except ValueError: return self.send_error(404)
            if not target.is_file(): return self.send_error(404)
            body=target.read_bytes(); self.send_response(200)
            self.send_header("Content-Type", mimetypes.guess_type(target.name)[0] or "application/octet-stream")
            self.send_header("Cache-Control", "public, max-age=31536000, immutable" if FINGERPRINTED.search(target.name) else "no-store")
            self.send_header("Content-Length",str(len(body))); self.end_headers(); self.wfile.write(body)
        def do_POST(self):
            if urlsplit(self.path).path != "/__auto_offer_shutdown" or self.client_address[0] not in ("127.0.0.1", "::1"): return self.send_error(404)
            supplied=self.headers.get("X-Auto-Offer-Shutdown", "")
            if not hmac.compare_digest(supplied, token): return self.send_error(403)
            self._json(200,{"status":"stopping"}); threading.Thread(target=self.server.shutdown,daemon=True).start()
    return Handler

def serve(app_dir, health, token, state_path, log):
    server=ThreadingHTTPServer((health["host"],health["port"]),handler_factory(app_dir,health,token,state_path)); server.log=log
    try: server.serve_forever()
    finally: server.server_close(); remove_owned_state(state_path,health["instance_id"])
