from __future__ import annotations

import hashlib
import json
import os
import tempfile
from pathlib import Path
from urllib.parse import urlparse

HEX = set("0123456789abcdef")
TOP = {"schema_version", "launcher_version", "python", "node", "host", "port", "paths", "build_inputs", "build_settings"}
RUNTIME = {"version", "url", "sha256", "executable"}
PATHS = {"runtime", "python", "node", "downloads", "state", "server_state", "log", "build"}
SETTINGS = {"script", "typecheck"}

class ConfigError(ValueError): pass

def _exact(value, keys, name):
    if not isinstance(value, dict) or set(value) != keys:
        raise ConfigError(f"{name}: expected fields {sorted(keys)}, got {sorted(value) if isinstance(value, dict) else type(value).__name__}")

def load_manifest(path: Path) -> dict:
    try: data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc: raise ConfigError(f"invalid manifest: {exc}") from exc
    _exact(data, TOP, "manifest")
    if data["schema_version"] != 1 or not isinstance(data["launcher_version"], str): raise ConfigError("unsupported schema/launcher version")
    for key in ("python", "node"):
        item = data[key]; _exact(item, RUNTIME, key)
        if not all(isinstance(item[x], str) and item[x] for x in RUNTIME): raise ConfigError(f"invalid {key} value")
        if urlparse(item["url"]).scheme != "https": raise ConfigError(f"{key} URL must use HTTPS")
        if len(item["sha256"]) != 64 or any(c not in HEX for c in item["sha256"]): raise ConfigError(f"invalid {key} SHA-256")
    if data["host"] != "127.0.0.1" or data["port"] != 8765: raise ConfigError("host/port must be 127.0.0.1:8765")
    _exact(data["paths"], PATHS, "paths"); _exact(data["build_settings"], SETTINGS, "build_settings")
    if data["build_inputs"] != ["app/**", "package.json", "package-lock.json"]: raise ConfigError("invalid build inputs")
    for value in data["paths"].values():
        if not isinstance(value, str) or Path(value).is_absolute() or ".." in Path(value).parts: raise ConfigError("runtime paths must be safe and relative")
    return data

def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""): h.update(chunk)
    return h.hexdigest()

def load_state(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except (OSError, json.JSONDecodeError): return {}

def atomic_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as out:
            json.dump(value, out, ensure_ascii=False, indent=2); out.write("\n"); out.flush(); os.fsync(out.fileno())
        os.replace(name, path)
    finally:
        try: os.unlink(name)
        except FileNotFoundError: pass
