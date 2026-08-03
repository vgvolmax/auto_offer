import hashlib
import json
import re
from datetime import datetime, timedelta
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from urllib.parse import urlsplit

from . import APP_IDENTITY, LAUNCHER_VERSION

HOST, PORT = "127.0.0.1", 8765
START_URL = "http://127.0.0.1:8765/#/"
HEALTH_PATH = "/__auto_offer_health"
SHUTDOWN_PATH = "/__auto_offer_shutdown"
SHA = re.compile(r"^[0-9a-f]{64}$")
COMMIT = re.compile(r"^[0-9a-f]{40}$")
RUNTIME_KEYS = {
    "schema_version",
    "launcher_version",
    "app_identity",
    "python",
    "download_hosts",
    "host",
    "port",
    "health_path",
    "shutdown_path",
    "start_url",
    "runtime_paths",
}
PYTHON_KEYS = {"version", "url", "sha256", "executable"}
RUNTIME_PATH_KEYS = {"root", "python", "logs", "server_state"}
RUNTIME_PATHS = {
    "root": ".runtime",
    "python": ".runtime/python",
    "logs": ".runtime/logs",
    "server_state": ".runtime/server.json",
}
RELEASE_KEYS = {
    "schema_version",
    "app_identity",
    "app_version",
    "launcher_version",
    "source_commit",
    "build_timestamp",
    "host",
    "port",
    "start_url",
    "files",
}
FILE_KEYS = {"path", "size", "sha256"}


class ManifestError(ValueError):
    pass


def _exact(obj, keys, label):
    if type(obj) is not dict:
        raise ManifestError(f"{label} must be an object")
    actual = set(obj)
    if actual != keys:
        raise ManifestError(
            f"{label} fields differ: missing={keys - actual}, unknown={actual - keys}"
        )


def _string(value, label):
    if type(value) is not str or not value.strip():
        raise ManifestError(f"{label} must be a non-empty string")
    return value


def _integer(value, label):
    if type(value) is not int:
        raise ManifestError(f"{label} must be an integer")
    return value


def _list(value, label):
    if type(value) is not list:
        raise ManifestError(f"{label} must be a list")
    return value


def _read_json(path, label):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ManifestError(f"{label} cannot be read") from exc


def _utc_timestamp(value, label):
    value = _string(value, label)
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError as exc:
        raise ManifestError(f"{label} must be an ISO-8601 timestamp") from exc
    if parsed.tzinfo is None or parsed.utcoffset() != timedelta(0):
        raise ManifestError(f"{label} must use UTC")
    return value


def load_runtime(path):
    data = _read_json(path, "runtime manifest")
    _exact(data, RUNTIME_KEYS, "runtime manifest")
    _exact(data["python"], PYTHON_KEYS, "python")
    _exact(data["runtime_paths"], RUNTIME_PATH_KEYS, "runtime_paths")

    if _integer(data["schema_version"], "schema_version") != 1:
        raise ManifestError("incompatible runtime manifest")
    if _string(data["launcher_version"], "launcher_version") != LAUNCHER_VERSION:
        raise ManifestError("incompatible runtime manifest")
    if _string(data["app_identity"], "app_identity") != APP_IDENTITY:
        raise ManifestError("incompatible runtime manifest")

    host = _string(data["host"], "host")
    port = _integer(data["port"], "port")
    start_url = _string(data["start_url"], "start_url")
    if (host, port, start_url) != (HOST, PORT, START_URL):
        raise ManifestError("fixed origin changed")
    if _string(data["health_path"], "health_path") != HEALTH_PATH:
        raise ManifestError("invalid health path")
    if _string(data["shutdown_path"], "shutdown_path") != SHUTDOWN_PATH:
        raise ManifestError("invalid shutdown path")

    paths = data["runtime_paths"]
    for key, expected in RUNTIME_PATHS.items():
        if _string(paths[key], f"runtime_paths.{key}") != expected:
            raise ManifestError(f"invalid runtime path: {key}")

    hosts = _list(data["download_hosts"], "download_hosts")
    if not hosts:
        raise ManifestError("download_hosts must not be empty")
    for host_name in hosts:
        host_name = _string(host_name, "download host")
        if host_name != host_name.lower() or any(c.isspace() for c in host_name):
            raise ManifestError("invalid download host")
    if len(set(hosts)) != len(hosts):
        raise ManifestError("duplicate download host")

    python = data["python"]
    _string(python["version"], "python.version")
    url = _string(python["url"], "python.url")
    parsed = urlsplit(url)
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or parsed.hostname not in hosts
        or parsed.username is not None
        or parsed.password is not None
    ):
        raise ManifestError("Python URL is not allowed")
    python_sha = _string(python["sha256"], "python.sha256")
    if not SHA.fullmatch(python_sha):
        raise ManifestError("invalid Python SHA-256")
    if _string(python["executable"], "python.executable") != "python.exe":
        raise ManifestError("invalid Python executable")
    return data


def safe_path(value):
    if type(value) is not str or not value or "\\" in value:
        raise ManifestError("path must use /")
    path = PurePosixPath(value)
    if path.is_absolute() or ".." in path.parts or path.parts[0].endswith(":"):
        raise ManifestError("unsafe release path")
    return path


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_release(path, root, verify=True):
    data = _read_json(path, "release manifest")
    _exact(data, RELEASE_KEYS, "release manifest")

    if _integer(data["schema_version"], "schema_version") != 1:
        raise ManifestError("incompatible release")
    if _string(data["app_identity"], "app_identity") != APP_IDENTITY:
        raise ManifestError("incompatible release")
    if _string(data["launcher_version"], "launcher_version") != LAUNCHER_VERSION:
        raise ManifestError("incompatible release")
    _string(data["app_version"], "app_version")

    source_commit = _string(data["source_commit"], "source_commit")
    if not COMMIT.fullmatch(source_commit):
        raise ManifestError("source_commit must be a full lowercase commit SHA")
    _utc_timestamp(data["build_timestamp"], "build_timestamp")

    host = _string(data["host"], "host")
    port = _integer(data["port"], "port")
    start_url = _string(data["start_url"], "start_url")
    if (host, port, start_url) != (HOST, PORT, START_URL):
        raise ManifestError("invalid release origin")

    files = _list(data["files"], "files")
    if not files:
        raise ManifestError("files must not be empty")
    seen = set()
    for item in files:
        _exact(item, FILE_KEYS, "file")
        rel = safe_path(item["path"])
        rel_text = str(rel)
        if rel_text in seen:
            raise ManifestError("duplicate release path")
        seen.add(rel_text)

        size = _integer(item["size"], "file.size")
        file_sha = _string(item["sha256"], "file.sha256")
        if size < 0 or not SHA.fullmatch(file_sha):
            raise ManifestError("invalid file metadata")

        target = Path(root).joinpath(*rel.parts)
        if verify and (
            not target.is_file()
            or target.stat().st_size != size
            or sha256(target) != file_sha
        ):
            raise ManifestError(f"release file damaged: {rel}")

    index = Path(root, "dist", "app", "index.html")
    if verify and (not index.is_file() or not index.stat().st_size):
        raise ManifestError("dist/app/index.html is missing")

    if verify:
        actual = {
            item.relative_to(root).as_posix()
            for item in Path(root).rglob("*")
            if item.is_file()
            and item.name != "release-manifest.json"
            and ".runtime" not in item.relative_to(root).parts
        }
        if actual != seen:
            raise ManifestError(
                f"unexpected or unlisted release content: {sorted(actual ^ seen)}"
            )

        class Refs(HTMLParser):
            def __init__(self):
                super().__init__()
                self.refs = []

            def handle_starttag(self, tag, attrs):
                for key, value in attrs:
                    if key in ("src", "href") and value:
                        self.refs.append(value)

        refs = Refs()
        refs.feed(index.read_text(encoding="utf-8"))
        for value in refs.refs:
            parsed = urlsplit(value)
            if parsed.scheme or parsed.netloc or value.startswith(("#", "data:")):
                continue
            rel = parsed.path.lstrip("/")
            if rel and not Path(root, "dist", "app", rel).is_file():
                raise ManifestError(f"index.html references missing asset: {rel}")
    return data


def fingerprint(manifest):
    payload = json.dumps(
        manifest, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode()
    return hashlib.sha256(payload).hexdigest()
