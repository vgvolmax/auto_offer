import json,tempfile,threading,time,unittest,urllib.request
from pathlib import Path
from scripts.launcher.auto_offer_launcher import APP_IDENTITY
from scripts.launcher.auto_offer_launcher.server import is_ours,probe,remove_owned_state,serve
class ServerTests(unittest.TestCase):
 def identity(self): return {'app_identity':APP_IDENTITY,'launcher_version':'1','project_root_id':'root-a','build_fingerprint':'build-a'}
 def test_identity_includes_checkout_and_build(self):
  expected=self.identity()
  self.assertTrue(is_ours(dict(expected),expected))
  for key in ('app_identity','launcher_version','project_root_id','build_fingerprint'):
   changed=dict(expected); changed[key]='different'
   self.assertFalse(is_ours(changed,expected))
 def test_state_cleanup_is_owned_by_instance(self):
  with tempfile.TemporaryDirectory() as d:
   path=Path(d)/'server.json'; path.write_text(json.dumps({'instance_id':'new'}))
   self.assertFalse(remove_owned_state(path,'old')); self.assertTrue(path.exists())
   self.assertTrue(remove_owned_state(path,'new')); self.assertFalse(path.exists())
 def test_health_root_shutdown(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d)/'web'; root.mkdir(); (root/'index.html').write_text('hello'); state=Path(d)/'server.json'; port=58765; ready=[]
   t=threading.Thread(target=serve,args=(root,state,'127.0.0.1',port,self.identity(),ready.append)); t.start()
   for _ in range(50):
    if ready and probe('127.0.0.1',port): break
    time.sleep(.02)
   health=probe('127.0.0.1',port); self.assertTrue(is_ours(health,self.identity())); self.assertNotIn('shutdown_token',health)
   self.assertEqual(urllib.request.urlopen(f'http://127.0.0.1:{port}/').read(),b'hello')
   ready[0].shutdown(); t.join(2); self.assertFalse(t.is_alive()); self.assertFalse(state.exists())
