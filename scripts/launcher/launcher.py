#!/usr/bin/env python3
from __future__ import annotations
import argparse, contextlib, json, logging, logging.handlers, os, subprocess, sys, tempfile, time, webbrowser
from datetime import datetime, timezone
from pathlib import Path

HERE=Path(__file__).resolve().parent; ROOT=HERE.parent.parent
sys.path.insert(0,str(HERE))
from auto_offer_launcher.build import build_current, build_fingerprint, dependencies_current, publish_build, run_activity
from auto_offer_launcher.config import ConfigError, atomic_json, load_manifest, load_state, sha256_file
from auto_offer_launcher.download import download, extract_atomic
from auto_offer_launcher.environment import validate_windows
from auto_offer_launcher.progress import Reporter
from auto_offer_launcher.server import is_ours, probe, serve, stop

class LaunchFailure(RuntimeError):
    def __init__(self,message,stage="launcher",code=1): super().__init__(message); self.stage=stage; self.code=code
def logger_for(path):
    path.parent.mkdir(parents=True,exist_ok=True); logger=logging.getLogger("launcher"); logger.setLevel(logging.INFO)
    if not logger.handlers:
        handler=logging.handlers.RotatingFileHandler(path,maxBytes=2*1024*1024,backupCount=4,encoding="utf-8"); handler.setFormatter(logging.Formatter("%(asctime)s [%(stage)s] %(message)s")); logger.addHandler(handler)
    return logger
@contextlib.contextmanager
def launch_lock(path):
    path.parent.mkdir(parents=True,exist_ok=True); deadline=time.monotonic()+60; handle=path.open("a+b"); announced=0
    while True:
        try:
            if os.name=="nt":
                import msvcrt
                handle.seek(0); handle.write(b"\0"); handle.flush(); handle.seek(0); msvcrt.locking(handle.fileno(),msvcrt.LK_NBLCK,1)
            else:
                import fcntl
                fcntl.flock(handle.fileno(),fcntl.LOCK_EX|fcntl.LOCK_NB)
            break
        except OSError:
            elapsed=int(60-(deadline-time.monotonic()))
            if elapsed>=announced: print(f"[lock] Another launcher is preparing Auto Offer; waiting ({elapsed}s)...",flush=True); announced=elapsed+5
            if time.monotonic()>deadline: handle.close(); raise LaunchFailure("another launcher is still preparing Auto Offer","lock")
            time.sleep(.2)
    handle.seek(0); handle.truncate(); handle.write(json.dumps({"pid":os.getpid(),"acquired":datetime.now(timezone.utc).isoformat()}).encode()); handle.flush()
    try: yield
    finally:
        try:
            handle.seek(0)
            if os.name=="nt": msvcrt.locking(handle.fileno(),msvcrt.LK_UNLCK,1)
            else: fcntl.flock(handle.fileno(),fcntl.LOCK_UN)
        finally: handle.close()
def paths(manifest): return {k:ROOT/v for k,v in manifest["paths"].items()}
def ensure_node(manifest,p,state,report):
    item=manifest["node"]; exe=p["node"]/item["executable"]
    if exe.is_file() and state.get("node",{}).get("sha256")==item["sha256"]: report.stage(2,"Portable Node.js"); return
    archive=p["downloads"]/"node.zip"; download(item["url"],archive,item["sha256"],2,allowed_hosts=manifest["download_hosts"])
    extract_atomic(archive,p["node"],lambda d:(d/item["executable"]).is_file() and (d/"npm.cmd").is_file(),flatten=True)
    state["node"]={"version":item["version"],"sha256":item["sha256"]}; atomic_json(p["state"],state); report.stage(2,"Portable Node.js")
def error_text(exc,log):
    stage=getattr(exc,"stage","launcher")
    return f"\nЧто произошло: {exc}\nНа каком этапе: {stage}\nЧто уже сохранено: только подтверждённые runtime/dependencies/build\nЧто будет повторено при следующем start.bat: незавершённый этап\nЧто сделать пользователю: проверьте сеть, свободное место и повторите start.bat\nГде находится launcher.log: {log}"
def command_start(manifest,args):
    p=paths(manifest); log=logger_for(p["log"]); report=Reporter()
    validate_windows(p["runtime"])
    # bootstrap.ps1 holds this same lock across Python installation and this
    # entire command. Direct launcher invocations still acquire it themselves.
    lock_context=contextlib.nullcontext() if os.environ.get("AUTO_OFFER_BOOTSTRAP_LOCK_HELD")=="1" else launch_lock(p["runtime"]/"launcher.lock")
    with lock_context:
        current=probe(manifest["host"],manifest["port"])
        if current:
            if not is_ours(current,manifest["launcher_version"]): raise LaunchFailure("port 8765 is occupied by another application; no alternate port will be used","server")
            report.stage(2,"Portable Node.js","уже запущено"); report.stage(3,"npm-зависимости","пропущено"); report.stage(4,"TypeScript","пропущено"); report.stage(5,"Сборка","пропущено"); report.stage(6,"Сервер","переиспользован")
        else:
            state=load_state(p["state"])
            expected_python={"version":manifest["python"]["version"],"sha256":manifest["python"]["sha256"]}
            if state.get("python") != expected_python:
                state["schema_version"]=1; state["launcher_version"]=manifest["launcher_version"]; state["python"]=expected_python; atomic_json(p["state"],state)
            ensure_node(manifest,p,state,report); state=load_state(p["state"])
            npm=p["node"]/"npm.cmd"
            with p["log"].open("a",encoding="utf-8") as output:
                if not dependencies_current(ROOT,state,manifest["node"]["version"]):
                    run_activity([npm,"ci","--no-audit","--no-fund"],ROOT,output,3,"npm-зависимости")
                    state["package_lock_sha256"]=sha256_file(ROOT/"package-lock.json"); atomic_json(p["state"],state)
                else: report.stage(3,"npm-зависимости","без изменений")
                fingerprint=build_fingerprint(ROOT,manifest["build_settings"])
                if not build_current(ROOT,state,fingerprint):
                    run_activity([npm,"run","typecheck:app"],ROOT,output,4,"TypeScript")
                    temp=Path(tempfile.mkdtemp(prefix="app.new-",dir=p["build"].parent));
                    try:
                        run_activity([npm,"run","app:build","--","--outDir",str(temp)],ROOT,output,5,"Сборка"); publish_build(temp,p["build"])
                    finally:
                        import shutil; shutil.rmtree(temp,ignore_errors=True)
                    state.update({"schema_version":1,"launcher_version":manifest["launcher_version"],"python":{"version":manifest["python"]["version"],"sha256":manifest["python"]["sha256"]},"build_input_fingerprint":fingerprint,"build_timestamp":datetime.now(timezone.utc).isoformat(),"active_build_path":"dist/app"}); atomic_json(p["state"],state)
                else: report.stage(4,"TypeScript","пропущено"); report.stage(5,"Сборка","без изменений")
            cmd=[sys.executable,str(HERE/"launcher.py"),"serve","--state-file",str(p["server_state"])]
            if args.foreground: return serve(p["build"],p["server_state"],manifest["host"],manifest["port"],manifest["launcher_version"])
            subprocess.Popen(cmd,cwd=str(ROOT),stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=getattr(subprocess,"CREATE_NO_WINDOW",0)|getattr(subprocess,"DETACHED_PROCESS",0),close_fds=True)
            for _ in range(100):
                current=probe(manifest["host"],manifest["port"])
                if is_ours(current,manifest["launcher_version"]): break
                time.sleep(.1)
            else: raise LaunchFailure("server health check timed out","server")
            report.stage(6,"Сервер")
        url="http://127.0.0.1:8765/#/"
        if args.no_browser: report.stage(7,"Браузер",f"не открыт; URL {url}")
        elif not webbrowser.open(url): raise LaunchFailure(f"browser did not open; server remains available at {url}","browser")
        else: report.stage(7,"Браузер")
    return 0
def parser():
    p=argparse.ArgumentParser(); sub=p.add_subparsers(dest="command",required=True)
    start=sub.add_parser("start"); start.add_argument("--no-browser",action="store_true"); start.add_argument("--foreground",action="store_true")
    serve_p=sub.add_parser("serve"); serve_p.add_argument("--state-file",type=Path,required=True)
    sub.add_parser("stop"); sub.add_parser("doctor"); return p
def main(argv=None):
    try:
        args=parser().parse_args(argv); manifest=load_manifest(HERE/"runtime-manifest.json"); p=paths(manifest)
        if args.command=="start": return command_start(manifest,args)
        if args.command=="serve":
            if not args.state_file.is_absolute(): raise ConfigError("--state-file must be absolute")
            return serve(p["build"],args.state_file,manifest["host"],manifest["port"],manifest["launcher_version"])
        if args.command=="stop":
            ok=stop(p["server_state"],manifest["host"],manifest["port"],manifest["launcher_version"]); print("Auto Offer stopped." if ok else "Refusing to stop: listener identity/state could not be authenticated."); return 0 if ok else 1
        print(f"Manifest: OK\nPortable Python: {(p['python']/manifest['python']['executable']).is_file()}\nPortable Node: {(p['node']/manifest['node']['executable']).is_file()}\nBuild: {(p['build']/ 'index.html').is_file()}\nOrigin: http://127.0.0.1:8765"); return 0
    except ConfigError as exc: print(error_text(exc,ROOT/".runtime/logs/launcher.log"),file=sys.stderr); return 2
    except (LaunchFailure,RuntimeError,OSError) as exc: print(error_text(exc,ROOT/".runtime/logs/launcher.log"),file=sys.stderr); return getattr(exc,"code",1)
if __name__=="__main__": raise SystemExit(main())
