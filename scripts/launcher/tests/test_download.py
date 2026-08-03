import hashlib, io, tempfile, unittest, urllib.error, zipfile
from pathlib import Path
from scripts.launcher.auto_offer_launcher.download import DownloadError, download, extract_atomic
class Response(io.BytesIO):
 def __init__(self,data,length=True): super().__init__(data); self.headers={'Content-Length':str(len(data))} if length else {}
 def __enter__(self): return self
 def __exit__(self,*a): pass
class DownloadTests(unittest.TestCase):
 def test_known_unknown(self):
  for length in (True,False):
   with tempfile.TemporaryDirectory() as d:
    data=b'abc'; p=Path(d)/'x'; download('https://x',p,hashlib.sha256(data).hexdigest(),opener=lambda *a,**k:Response(data,length)); self.assertEqual(p.read_bytes(),data)
 def test_checksum(self):
  with tempfile.TemporaryDirectory() as d:
   with self.assertRaises(DownloadError): download('https://x',Path(d)/'x','0'*64,opener=lambda *a,**k:Response(b'x'))
 def test_bounded_retry_and_interruption(self):
  calls=[]
  def fail(*a,**k): calls.append(1); raise urllib.error.URLError('offline')
  with tempfile.TemporaryDirectory() as d:
   with self.assertRaises(DownloadError): download('https://x',Path(d)/'x','0'*64,attempts=3,opener=fail)
  self.assertEqual(len(calls),3)
 def zip(self,path,name='python.exe'):
  with zipfile.ZipFile(path,'w') as z:z.writestr(name,b'x')
 def test_zip_slip(self):
  with tempfile.TemporaryDirectory() as d:
   a=Path(d)/'a.zip'; self.zip(a,'../evil')
   with self.assertRaises(DownloadError): extract_atomic(a,Path(d)/'out')
 def test_atomic_publication(self):
  with tempfile.TemporaryDirectory() as d:
   a=Path(d)/'a.zip'; self.zip(a); out=Path(d)/'out'; extract_atomic(a,out,lambda p:(p/'python.exe').exists()); self.assertTrue((out/'python.exe').exists())
