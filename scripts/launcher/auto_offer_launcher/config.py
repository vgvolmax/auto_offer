import hashlib
import json
import re
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from urllib.parse import urlsplit

from . import APP_IDENTITY, LAUNCHER_VERSION

HOST, PORT = "127.0.0.1", 8765
START_URL = "http://127.0.0.1:8765/#/"
SHA = re.compile(r"^[0-9a-f]{64}$")
RUNTIME_KEYS = {"schema_version", "launcher_version", "app_identity", "python", "download_hosts", "host", "port", "health_path", "shutdown_path", "start_url", "runtime_paths"}
PYTHON_KEYS = {"version", "url", "sha256", "executable"}
RELEASE_KEYS = {"schema_version", "app_identity", "app_version", "launcher_version", "source_commit", "build_timestamp", "host", "port", "start_url", "files"}
FILE_KEYS = {"path", "size", "sha256"}

class ManifestError(ValueError): pass

def _exact(obj, keys, label):
    if not isinstance(obj, dict) or set(obj) != keys:
        raise ManifestError(f"{label} fields differ: missing={keys-set(obj) if isinstance(obj, dict) else keys}, unknown={set(obj)-keys if isinstance(obj, dict) else set()}")

def load_runtime(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    _exact(data, RUNTIME_KEYS, "runtime manifest")
    _exact(data["python"], PYTHON_KEYS, "python")
    if data["schema_version"] != 1 or data["launcher_version"] != LAUNCHER_VERSION or data["app_identity"] != APP_IDENTITY: raise ManifestError("incompatible runtime manifest")
    if (data["host"], data["port"], data["start_url"]) != (HOST, PORT, START_URL): raise ManifestError("fixed origin changed")
    hosts = data["download_hosts"]
    parsed = urlsplit(data["python"]["url"])
    if parsed.scheme != "https" or not parsed.hostname or parsed.hostname not in hosts: raise ManifestError("Python URL is not allowed")
    if not isinstance(hosts, list) or not hosts or any(not isinstance(x, str) for x in hosts): raise ManifestError("invalid download_hosts")
    if not SHA.fullmatch(data["python"]["sha256"]): raise ManifestError("invalid Python SHA-256")
    if data["python"]["executable"] != "python.exe": raise ManifestError("invalid Python executable")
    return data

def safe_path(value):
    if not isinstance(value, str) or not value or "\\" in value: raise ManifestError("path must use /")
    p = PurePosixPath(value)
    if p.is_absolute() or ".." in p.parts or p.parts[0].endswith(":"): raise ManifestError("unsafe release path")
    return p

def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""): h.update(chunk)
    return h.hexdigest()

def load_release(path, root, verify=True):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    _exact(data, RELEASE_KEYS, "release manifest")
    if data["schema_version"] != 1 or data["app_identity"] != APP_IDENTITY or data["launcher_version"] != LAUNCHER_VERSION: raise ManifestError("incompatible release")
    if (data["host"], data["port"], data["start_url"]) != (HOST, PORT, START_URL): raise ManifestError("invalid release origin")
    seen = set()
    for item in data["files"]:
        _exact(item, FILE_KEYS, "file")
        rel = safe_path(item["path"])
        if str(rel) in seen: raise ManifestError("duplicate release path")
        seen.add(str(rel))
        if not isinstance(item["size"], int) or item["size"] < 0 or not SHA.fullmatch(item["sha256"]): raise ManifestError("invalid file metadata")
        target = Path(root).joinpath(*rel.parts)
        if verify and (not target.is_file() or target.stat().st_size != item["size"] or sha256(target) != item["sha256"]): raise ManifestError(f"release file damaged: {rel}")
    index = Path(root, "dist", "app", "index.html")
    if verify and (not index.is_file() or not index.stat().st_size): raise ManifestError("dist/app/index.html is missing")
    if verify:
        actual = {p.relative_to(root).as_posix() for p in Path(root).rglob("*") if p.is_file() and p.name != "release-manifest.json" and ".runtime" not in p.relative_to(root).parts}
        if actual != seen: raise ManifestError(f"unexpected or unlisted release content: {sorted(actual ^ seen)}")
        class Refs(HTMLParser):
            def __init__(self): super().__init__(); self.refs=[]
            def handle_starttag(self, tag, attrs):
                for key, value in attrs:
                    if key in ("src", "href") and value: self.refs.append(value)
        refs=Refs(); refs.feed(index.read_text(encoding="utf-8"))
        for value in refs.refs:
            parsed=urlsplit(value)
            if parsed.scheme or parsed.netloc or value.startswith(("#", "data:")): continue
            rel=parsed.path.lstrip("/")
            if rel and not Path(root, "dist", "app", rel).is_file(): raise ManifestError(f"index.html references missing asset: {rel}")
    return data

def fingerprint(manifest):
    payload = json.dumps(manifest, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(payload).hexdigest()
