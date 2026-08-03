import hashlib, io, tempfile, unittest, urllib.error, zipfile
from pathlib import Path
from scripts.launcher.auto_offer_launcher.download import DownloadError, download, extract_atomic, open_allowed, validate_download_url
class Response(io.BytesIO):
 def __init__(self,data,length=True,url='https://x'): super().__init__(data); self.headers={'Content-Length':str(len(data))} if length else {}; self.url=url
 def geturl(self): return self.url
 def __enter__(self): return self
 def __exit__(self,*a): pass
class DownloadTests(unittest.TestCase):
 def test_known_unknown(self):
  for length in (True,False):
   with tempfile.TemporaryDirectory() as d:
    data=b'abc'; p=Path(d)/'x'; download('https://x',p,hashlib.sha256(data).hexdigest(),opener=lambda *a,**k:Response(data,length)); self.assertEqual(p.read_bytes(),data)
 def test_checksum(self):
  with tempfile.TemporaryDirectory() as d:
   with self.assertRaisesRegex(DownloadError,r'expected 0{64}, actual 2d711642'):
    download('https://x',Path(d)/'x','0'*64,opener=lambda *a,**k:Response(b'x'))
   self.assertFalse((Path(d)/'x').exists())
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
 def test_url_policy(self):
  validate_download_url('https://downloads.example.test/a',['downloads.example.test'])
  for url in ('http://downloads.example.test/a','https://evil.example/a'):
   with self.assertRaises(DownloadError): validate_download_url(url,['downloads.example.test'])
 def test_final_url_is_validated(self):
  with self.assertRaises(DownloadError): open_allowed('https://good.test/a',['good.test'],opener=lambda *a,**k:Response(b'x',url='https://evil.test/a'))
 def test_allowed_redirect_and_forbidden_chains(self):
  def redirect(url,location):
   raise urllib.error.HTTPError(url,302,'redirect',{'Location':location},None)
  calls=[]
  def allowed(url,**kwargs):
   calls.append(url)
   if len(calls)==1: return redirect(url,'https://cdn.test/file')
   return Response(b'ok',url=url)
  self.assertEqual(open_allowed('https://origin.test/file',['origin.test','cdn.test'],opener=allowed).read(),b'ok')
  for destination in ('https://evil.test/file','http://origin.test/file'):
   with self.assertRaises(DownloadError): open_allowed('https://origin.test/file',['origin.test'],opener=lambda url,**k:redirect(url,destination))
  calls.clear()
  def intermediate(url,**kwargs):
   return redirect(url,'https://evil.test/step')
  with self.assertRaises(DownloadError): open_allowed('https://origin.test/file',['origin.test','final.test'],opener=intermediate)
