from __future__ import annotations
import hashlib, os, shutil, tempfile, time, urllib.error, urllib.parse, urllib.request, zipfile
from pathlib import Path, PurePosixPath, PureWindowsPath
from .progress import download_line, unicode_supported

class DownloadError(RuntimeError): pass
def validate_download_url(url: str, allowed_hosts) -> None:
    parsed=urllib.parse.urlparse(url)
    if parsed.scheme.lower() != "https": raise DownloadError("download was blocked: HTTPS is required")
    if not parsed.hostname or parsed.hostname.lower() not in {h.lower() for h in allowed_hosts}:
        raise DownloadError("download was blocked: host is not in the launcher allowlist")

class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl): return None

def open_allowed(url: str, allowed_hosts, timeout=30, max_redirects=10, opener=None):
    """Open a URL while validating every redirect, including the final URL."""
    current=url; client=opener or urllib.request.build_opener(_NoRedirect()).open
    for _ in range(max_redirects+1):
        validate_download_url(current,allowed_hosts)
        try: response=client(current,timeout=timeout)
        except urllib.error.HTTPError as exc:
            if exc.code not in (301,302,303,307,308): raise
            location=exc.headers.get("Location")
            if not location: raise DownloadError("download redirect did not provide a destination") from exc
            current=urllib.parse.urljoin(current,location); continue
        final=getattr(response,"geturl",lambda:current)()
        try: validate_download_url(final,allowed_hosts)
        except Exception: response.close(); raise
        return response
    raise DownloadError("download was blocked: too many redirects")

def download(url: str, destination: Path, checksum: str, stage=2, attempts=3, opener=None, allowed_hosts=None) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True); part=destination.with_suffix(destination.suffix+".part")
    for attempt in range(1, attempts+1):
        try:
            h=hashlib.sha256(); received=0; started=time.monotonic()
            hosts=allowed_hosts or [urllib.parse.urlparse(url).hostname]
            response=open_allowed(url,hosts,opener=opener)
            with response, part.open("wb") as out:
                total=int(response.headers.get("Content-Length", 0) or 0)
                while True:
                    block=response.read(1024*256)
                    if not block: break
                    out.write(block); h.update(block); received += len(block)
                    print("\r"+download_line(stage,"Portable runtime",received,total,time.monotonic()-started,unicode_supported()),end="",flush=True)
            print()
            if total and received != total: raise urllib.error.ContentTooShortError("interrupted download", None)
            actual=h.hexdigest()
            if actual != checksum: raise DownloadError(f"SHA-256 checksum mismatch; expected {checksum}, actual {actual}; archive was not installed")
            os.replace(part,destination); return destination
        except DownloadError: part.unlink(missing_ok=True); raise
        except (OSError, urllib.error.URLError, TimeoutError) as exc:
            part.unlink(missing_ok=True)
            if attempt == attempts: raise DownloadError(f"download failed after {attempts} attempts: {exc}") from exc
            time.sleep(min(attempt,2))
    raise AssertionError
def _safe(member: str) -> bool:
    win=PureWindowsPath(member); posix=PurePosixPath(member.replace("\\","/"))
    return bool(member) and not win.is_absolute() and not posix.is_absolute() and not win.drive and ".." not in posix.parts and ".." not in win.parts
def extract_atomic(archive: Path, destination: Path, validator=lambda p: True, flatten=False) -> None:
    parent=destination.parent; parent.mkdir(parents=True,exist_ok=True); temp=Path(tempfile.mkdtemp(prefix=destination.name+".new-",dir=parent))
    try:
        with zipfile.ZipFile(archive) as bundle:
            for item in bundle.infolist():
                if not _safe(item.filename) or (item.external_attr >> 16) & 0o170000 == 0o120000: raise DownloadError(f"unsafe ZIP entry: {item.filename}")
            bundle.extractall(temp)
        source=temp
        if flatten:
            children=list(temp.iterdir())
            if len(children)==1 and children[0].is_dir(): source=children[0]
        if not validator(source): raise DownloadError("runtime archive has an invalid structure or version")
        old=destination.with_name(destination.name+".old"); shutil.rmtree(old,ignore_errors=True)
        if destination.exists(): os.replace(destination,old)
        os.replace(source,destination); shutil.rmtree(old,ignore_errors=True)
    finally: shutil.rmtree(temp,ignore_errors=True)
