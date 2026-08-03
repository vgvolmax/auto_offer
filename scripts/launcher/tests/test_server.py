import json,tempfile,threading,time,unittest,urllib.request
from pathlib import Path
from scripts.launcher.auto_offer_launcher import APP_IDENTITY
from scripts.launcher.auto_offer_launcher.server import is_ours,probe,serve,stop
class ServerTests(unittest.TestCase):
 def test_identity_foreign(self): self.assertTrue(is_ours({'app_identity':APP_IDENTITY,'launcher_version':'1'},'1')); self.assertFalse(is_ours({'app_identity':'foreign'},'1'))
 def test_stale_state(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'s'; p.write_text('{}'); self.assertTrue(stop(p,'127.0.0.1',58764,'1')); self.assertFalse(p.exists())
 def test_health_root_shutdown(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d)/'web'; root.mkdir(); (root/'index.html').write_text('hello'); state=Path(d)/'server.json'; port=58765
   t=threading.Thread(target=serve,args=(root,state,'127.0.0.1',port,'1')); t.start()
   for _ in range(50):
    if probe('127.0.0.1',port): break
    time.sleep(.02)
   self.assertEqual(probe('127.0.0.1',port)['app_identity'],APP_IDENTITY)
   self.assertEqual(urllib.request.urlopen(f'http://127.0.0.1:{port}/').read(),b'hello')
   self.assertTrue(stop(state,'127.0.0.1',port,'1')); t.join(2); self.assertFalse(t.is_alive())
 def test_start_health_shutdown_stress(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d)/'web'; root.mkdir(); (root/'index.html').write_text('ok'); state=Path(d)/'server.json'; port=58766
   for _ in range(20):
    t=threading.Thread(target=serve,args=(root,state,'127.0.0.1',port,'1')); t.start()
    for _ in range(100):
     if probe('127.0.0.1',port): break
     time.sleep(.01)
    self.assertTrue(stop(state,'127.0.0.1',port,'1')); t.join(2)
    self.assertFalse(t.is_alive()); self.assertFalse(state.exists())
 def test_live_foreign_identity_preserves_state(self):
  with tempfile.TemporaryDirectory() as d:
   state=Path(d)/'server.json'; state.write_text('{"sentinel":true}')
   # An unrelated HTTP listener is represented by overriding the probe result.
   from unittest.mock import patch
   with patch('scripts.launcher.auto_offer_launcher.server.probe',return_value={'app_identity':'foreign'}):
    self.assertFalse(stop(state,'127.0.0.1',58767,'1'))
   self.assertTrue(state.exists())
