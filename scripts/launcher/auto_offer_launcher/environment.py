from __future__ import annotations
import os, platform, shutil
from pathlib import Path

def validate_windows(root: Path):
    if os.name != "nt": raise RuntimeError("supported platform is Windows 10/11 x64")
    if platform.machine().lower() not in ("amd64","x86_64"): raise RuntimeError("supported architecture is Windows x64")
    root.mkdir(parents=True,exist_ok=True)
    probe=root/".write-test"
    try: probe.write_bytes(b"ok"); probe.unlink()
    except OSError as exc: raise RuntimeError(f"repository folder is not writable: {exc}") from exc
    if shutil.disk_usage(root).free < 750*1024*1024: raise RuntimeError("less than 750 MB free disk space")
