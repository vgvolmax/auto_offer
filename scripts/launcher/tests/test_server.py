import json, logging, os, sys, tempfile, threading, unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen
HERE=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(HERE))
from auto_offer_launcher.server import ThreadingHTTPServer, handler_factory, remove_owned_state

class ServerTests(unittest.TestCase):
    def setUp(self):
        self.t=tempfile.TemporaryDirectory(); root=Path(self.t.name); (root/"index.html").write_text("home"); (root/"asset.12345678.js").write_text("js")
        self.info={"app_identity":"auto-offer","app_version":"1","release_fingerprint":"f","launcher_version":"1.0.0","pid":1,"instance_id":"i","start_time":"x","host":"127.0.0.1","port":0}
        self.server=ThreadingHTTPServer(("127.0.0.1",0),handler_factory(root,self.info,"secret")); self.server.log=logging.getLogger("test"); self.info["port"]=self.server.server_port
        self.thread=threading.Thread(target=self.server.serve_forever); self.thread.start(); self.url=f"http://127.0.0.1:{self.server.server_port}"
    def tearDown(self): self.server.shutdown(); self.server.server_close(); self.thread.join(); self.t.cleanup()
    def test_health_identity(self): self.assertEqual(json.load(urlopen(self.url+"/__auto_offer_health"))["app_identity"],"auto-offer")
    def test_root_no_store(self):
        r=urlopen(self.url+"/"); self.assertEqual(r.read(),b"home"); self.assertEqual(r.headers["Cache-Control"],"no-store")
    def test_fingerprinted_cache(self): self.assertIn("immutable",urlopen(self.url+"/asset.12345678.js").headers["Cache-Control"])
    def test_traversal(self): self.assertRaises(HTTPError,urlopen,self.url+"/%2e%2e/secret")
    def test_wrong_token(self): self.assertRaises(HTTPError,urlopen,Request(self.url+"/__auto_offer_shutdown",method="POST",headers={"X-Auto-Offer-Shutdown":"bad"}))

    def test_health_pid_is_real_and_nonzero(self):
        self.info["pid"] = os.getpid()
        self.assertEqual(json.load(urlopen(self.url+"/__auto_offer_health"))["pid"], os.getpid())

    def test_old_instance_does_not_remove_new_state(self):
        path=Path(self.t.name)/"server.json"
        path.write_text(json.dumps({"instance_id":"new"}))
        self.assertFalse(remove_owned_state(path,"old"))
        self.assertTrue(path.exists())
