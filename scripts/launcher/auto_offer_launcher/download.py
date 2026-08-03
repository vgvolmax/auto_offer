from __future__ import annotations
import hashlib, os, shutil, tempfile, time, urllib.error, urllib.request, zipfile
from pathlib import Path, PurePosixPath, PureWindowsPath
from .progress import download_line, unicode_supported

class DownloadError(RuntimeError): pass
def download(url: str, destination: Path, checksum: str, stage=2, attempts=3, opener=urllib.request.urlopen) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True); part=destination.with_suffix(destination.suffix+".part")
    for attempt in range(1, attempts+1):
        try:
            h=hashlib.sha256(); received=0; started=time.monotonic()
            with opener(url, timeout=30) as response, part.open("wb") as out:
                total=int(response.headers.get("Content-Length", 0) or 0)
                while True:
                    block=response.read(1024*256)
                    if not block: break
                    out.write(block); h.update(block); received += len(block)
                    print("\r"+download_line(stage,"Portable runtime",received,total,time.monotonic()-started,unicode_supported()),end="",flush=True)
            print()
            if total and received != total: raise urllib.error.ContentTooShortError("interrupted download", None)
            if h.hexdigest() != checksum: raise DownloadError("SHA-256 checksum mismatch; archive was not installed")
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
