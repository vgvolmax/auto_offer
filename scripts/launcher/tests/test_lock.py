import multiprocessing, tempfile, time, unittest
from pathlib import Path
from scripts.launcher.launcher import launch_lock

def hold(path,ready,delay):
 with launch_lock(Path(path)):
  ready.set(); time.sleep(delay)

class LockTests(unittest.TestCase):
 def test_two_launchers_are_serialized_and_file_is_only_metadata(self):
  with tempfile.TemporaryDirectory(prefix='Тест Auto Offer ') as d:
   path=Path(d)/'launcher.lock'; path.write_text('stale metadata',encoding='utf-8')
   ready=multiprocessing.Event(); first=multiprocessing.Process(target=hold,args=(str(path),ready,.5)); first.start(); self.assertTrue(ready.wait(2))
   started=time.monotonic(); second=multiprocessing.Process(target=hold,args=(str(path),multiprocessing.Event(),0)); second.start(); second.join(3); first.join(3)
   self.assertEqual(first.exitcode,0); self.assertEqual(second.exitcode,0); self.assertGreater(time.monotonic()-started,.35)
   # The persistent file does not prevent the next OS lock acquisition.
   with launch_lock(path): pass
 def test_os_releases_lock_after_crash(self):
  with tempfile.TemporaryDirectory() as d:
   path=Path(d)/'launcher.lock'; ready=multiprocessing.Event(); process=multiprocessing.Process(target=hold,args=(str(path),ready,30)); process.start(); self.assertTrue(ready.wait(2)); process.terminate(); process.join(2)
   with launch_lock(path): pass
