#!/usr/bin/env python3
import argparse, json, os, secrets, subprocess, sys, time, uuid, webbrowser
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import URLError, HTTPError
from urllib.request import Request, urlopen

HERE=Path(__file__).resolve().parent; ROOT=HERE.parent.parent
sys.path.insert(0,str(HERE))
from auto_offer_launcher import APP_IDENTITY, LAUNCHER_VERSION
from auto_offer_launcher.config import HOST, PORT, START_URL, fingerprint, load_release, load_runtime
from auto_offer_launcher.logging_utils import logger_for
from auto_offer_launcher.server import atomic_json, serve

def request(path, method="GET", token=None, timeout=2):
    headers={"X-Auto-Offer-Shutdown":token} if token else {}
    with urlopen(Request(f"http://{HOST}:{PORT}{path}",method=method,headers=headers),timeout=timeout) as r: return json.loads(r.read())

def health():
    try: return request("/__auto_offer_health")
    except Exception: return None

def state():
    p=ROOT/".runtime/server.json"
    try: return json.loads(p.read_text(encoding="utf-8"))
    except (OSError,ValueError): return None

def owned_stop(expected_fingerprint=None):
    current=health(); saved=state()
    if not current:
        if saved:
            try: (ROOT/".runtime/server.json").unlink()
            except OSError: pass
        return True
    keys=("app_identity","instance_id","release_fingerprint","host","port")
    if not saved or any(saved.get(k)!=current.get(k) for k in keys) or current.get("app_identity")!=APP_IDENTITY: return False
    try: request("/__auto_offer_shutdown", "POST", saved["shutdown_token"])
    except Exception: return False
    for _ in range(100):
        if not health() and not (ROOT/".runtime/server.json").exists(): return True
        time.sleep(.1)
    return False

def start(no_browser=False):
    runtime=load_runtime(HERE/"runtime-manifest.json")
    print("[2/4] Проверка приложения")
    release=load_release(ROOT/"release-manifest.json",ROOT); fp=fingerprint(release)
    current=health()
    if current and current.get("app_identity")==APP_IDENTITY and current.get("release_fingerprint")==fp and current.get("launcher_version")==LAUNCHER_VERSION: pass
    else:
        if current and not owned_stop(fp): raise RuntimeError("Port 8765 is occupied by an unowned or foreign listener; stop the other copy")
        print("[3/4] Сервер")
        runtime_root=ROOT/".runtime"; runtime_root.mkdir(exist_ok=True); (runtime_root/"logs").mkdir(exist_ok=True)
        instance=str(uuid.uuid4()); now=datetime.now(timezone.utc).isoformat(); token=secrets.token_urlsafe(32)
        info={"app_identity":APP_IDENTITY,"app_version":release["app_version"],"release_fingerprint":fp,"launcher_version":LAUNCHER_VERSION,"pid":0,"instance_id":instance,"start_time":now,"host":HOST,"port":PORT}
        state_info={**info,"shutdown_token":token}
        cmd=[sys.executable,str(Path(__file__).resolve()),"serve","--health",json.dumps(info),"--token",token]
        log=open(runtime_root/"logs/server.log","ab",buffering=0); proc=subprocess.Popen(cmd,stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,creationflags=getattr(subprocess,"CREATE_NO_WINDOW",0))
        info["pid"]=proc.pid; state_info["pid"]=proc.pid; atomic_json(runtime_root/"server.json",state_info)
        # Child reads state to use the final PID.
        for _ in range(100):
            current=health()
            if current and current.get("instance_id")==instance: break
            if proc.poll() is not None: raise RuntimeError("local server exited during startup")
            time.sleep(.1)
        else: raise RuntimeError("server health timeout")
    print("[4/4] Браузер")
    if not no_browser and not webbrowser.open(START_URL): raise RuntimeError(f"Browser could not be opened; server remains running. Open {START_URL}")
    return 0

def main(argv=None):
    parser=argparse.ArgumentParser(); sub=parser.add_subparsers(dest="command")
    p=sub.add_parser("start"); p.add_argument("--no-browser",action="store_true"); sub.add_parser("stop")
    s=sub.add_parser("serve"); s.add_argument("--health",required=True); s.add_argument("--token",required=True)
    args=parser.parse_args(argv); command=args.command or "start"
    if command=="stop": return 0 if owned_stop() else 4
    if command=="serve":
        saved=state(); info=json.loads(args.health)
        if saved and saved.get("instance_id")==info["instance_id"]: info["pid"]=saved["pid"]
        serve(ROOT/"dist/app",info,args.token,ROOT/".runtime/server.json",logger_for(ROOT/".runtime/logs/server.log","server")); return 0
    return start(args.no_browser)

if __name__=="__main__":
    try: raise SystemExit(main())
    except Exception as exc:
        log=logger_for(ROOT/".runtime/logs/launcher.log"); log.exception("launcher failed")
        print(f"Что произошло: {exc}\nЭтап: запуск Auto Offer\nЧто сохранено: portable Python и данные браузера\nСледующий запуск повторит незавершённый этап\nЧто сделать: полностью распакуйте свежий release ZIP и повторите start.bat\nЛог: {ROOT/'.runtime/logs/launcher.log'}",file=sys.stderr); raise SystemExit(2)
