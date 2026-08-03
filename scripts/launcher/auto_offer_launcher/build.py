from __future__ import annotations
import hashlib, os, re, shutil, subprocess, tempfile, threading, time
from pathlib import Path
from .config import atomic_json, sha256_file
from .progress import console_print, redact

def build_fingerprint(root: Path, settings: dict) -> str:
    files=[root/"package.json",root/"package-lock.json"]+[p for p in (root/"app").rglob("*") if p.is_file()]
    h=hashlib.sha256()
    for path in sorted(files,key=lambda p:p.relative_to(root).as_posix()):
        relative=path.relative_to(root).as_posix().encode(); h.update(len(relative).to_bytes(4,"big")); h.update(relative); h.update(sha256_file(path).encode())
    h.update(repr(sorted(settings.items())).encode()); return h.hexdigest()
def dependencies_current(root, state, node_version):
    lock=root/"package-lock.json"
    required=("tsc.cmd","vite.cmd","vitest.cmd")
    return (
        (root/"node_modules").is_dir()
        and all((root/"node_modules/.bin"/name).is_file() for name in required)
        and state.get("package_lock_sha256")==sha256_file(lock)
        and state.get("node",{}).get("version")==node_version
    )
def dependencies_usable(root: Path,node: Path) -> bool:
    script=(
        "const p=require('./package.json');"
        "const names=[...Object.keys(p.dependencies||{}),'typescript','vite'];"
        "for(const name of names)require.resolve(name,{paths:[process.cwd()]});"
    )
    try:
        result=subprocess.run(
            [str(node),"-e",script],cwd=str(root),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,
            timeout=20,shell=False,
        )
        return result.returncode==0
    except (OSError,subprocess.SubprocessError):
        return False
def build_current(root,state,fingerprint):
    return state.get("build_input_fingerprint")==fingerprint and validate_artifact(root/"dist/app")
def make_build_staging(final: Path) -> Path:
    final.parent.mkdir(parents=True,exist_ok=True)
    return Path(tempfile.mkdtemp(prefix="app.new-",dir=final.parent))
def run_activity(args, cwd: Path, log, stage: int, name: str) -> None:
    process=subprocess.Popen([str(x) for x in args],cwd=str(cwd),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding="utf-8",errors="replace",shell=False)
    last=[""]; started=time.monotonic()
    def consume():
        assert process.stdout
        for line in process.stdout:
            safe=redact(line.rstrip()); log.write(safe+"\n"); log.flush(); last[0]=safe[-120:]
    thread=threading.Thread(target=consume); thread.start()
    while process.poll() is None:
        console_print(f"\r[{stage}/7] {name} | выполняется {int(time.monotonic()-started):02d}s | {last[0]:120}",end="",flush=True); time.sleep(.2)
    thread.join(); console_print("")
    if process.returncode: raise RuntimeError(f"{name} failed with exit code {process.returncode}")
def validate_artifact(path: Path):
    index=path/"index.html"
    if not index.is_file() or not index.stat().st_size: return False
    text=index.read_text(encoding="utf-8")
    refs=re.findall(r'(?:src|href)=["\']([^"\']+)',text)
    return all(ref.startswith(("http:","https:","data:","#")) or (path/ref.lstrip("/")).is_file() for ref in refs)
def publish_build(temp: Path, final: Path):
    if not validate_artifact(temp): raise RuntimeError("build artifact is incomplete or references missing assets")
    old=final.with_name(final.name+".old"); shutil.rmtree(old,ignore_errors=True)
    if final.exists(): os.replace(final,old)
    try: os.replace(temp,final)
    except Exception:
        if old.exists(): os.replace(old,final)
        raise
    shutil.rmtree(old,ignore_errors=True)
