from __future__ import annotations
import json, os, secrets, threading, time, urllib.error, urllib.parse, urllib.request
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from . import APP_IDENTITY
from .config import atomic_json, load_state

HEALTH="/__auto_offer_health"; SHUTDOWN="/__auto_offer_shutdown"
def health_url(host,port): return f"http://{host}:{port}{HEALTH}"
def probe(host,port,timeout=.7):
    try:
        with urllib.request.urlopen(health_url(host,port),timeout=timeout) as response: return json.load(response)
    except (OSError,ValueError,urllib.error.URLError): return None
def is_ours(value,version): return isinstance(value,dict) and value.get("app_identity")==APP_IDENTITY and value.get("launcher_version")==version
def _remove_state(path,attempts=20,delay=.05):
    for attempt in range(attempts):
        try: path.unlink(missing_ok=True); return True
        except PermissionError as exc:
            if getattr(exc,"winerror",None) != 32 or attempt+1 == attempts: raise
            time.sleep(delay)
    return False
def make_handler(root: Path, version: str, started: str, token: str, server_ref):
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(root),**kwargs)
        def log_message(self,fmt,*args): pass
        def end_headers(self):
            if self.path.split("?",1)[0] in ("/","/index.html"): self.send_header("Cache-Control","no-store")
            else: self.send_header("Cache-Control","public, max-age=3600")
            super().end_headers()
        def do_GET(self):
            if self.path.split("?",1)[0]==HEALTH:
                body=json.dumps({"app_identity":APP_IDENTITY,"launcher_version":version,"pid":os.getpid(),"start_time":started}).encode()
                self.send_response(200); self.send_header("Content-Type","application/json"); self.send_header("Content-Length",str(len(body))); self.end_headers(); self.wfile.write(body); return
            super().do_GET()
        def do_POST(self):
            if self.client_address[0] != "127.0.0.1" or self.path != SHUTDOWN or self.headers.get("Authorization") != "Bearer "+token:
                self.send_error(403); return
            self.send_response(204); self.end_headers(); threading.Thread(target=server_ref[0].shutdown,daemon=True).start()
    return Handler
def serve(root,state_file,host,port,version):
    started=datetime.now(timezone.utc).isoformat(); token=secrets.token_urlsafe(32); ref=[None]
    server=ThreadingHTTPServer((host,port),make_handler(root,version,started,token,ref)); ref[0]=server
    atomic_json(state_file,{"app_identity":APP_IDENTITY,"pid":os.getpid(),"start_time":started,"launcher_version":version,"host":host,"port":port,"shutdown_token":token})
    try: server.serve_forever()
    finally:
        server.server_close()
        current=load_state(state_file)
        if current.get("app_identity")==APP_IDENTITY and current.get("pid")==os.getpid(): _remove_state(state_file)
def stop(state_file,host,port,version):
    state=load_state(state_file); current=probe(host,port)
    if not current:
        # No listener exists, so this is stale state rather than a live identity.
        _remove_state(state_file); return True
    if not is_ours(current,version): return False
    if not is_ours(state,version) or state.get("pid") != current.get("pid") or not state.get("shutdown_token"): return False
    request=urllib.request.Request(f"http://{host}:{port}{SHUTDOWN}",method="POST",headers={"Authorization":"Bearer "+state["shutdown_token"]})
    try:
        with urllib.request.urlopen(request,timeout=2): pass
    except urllib.error.URLError: return False
    for _ in range(50):
        if not probe(host,port,.1):
            # serve() exclusively owns normal state removal.  Wait for its finally block.
            for _ in range(50):
                if not state_file.exists(): return True
                time.sleep(.05)
            return False
        time.sleep(.1)
    return False
