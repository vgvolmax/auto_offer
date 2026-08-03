#!/usr/bin/env python3
import argparse, json, socket, subprocess, sys, time, webbrowser
from pathlib import Path
from urllib.request import Request, urlopen

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
from auto_offer_launcher import APP_IDENTITY, LAUNCHER_VERSION
from auto_offer_launcher.config import HOST, PORT, START_URL, fingerprint, load_release, load_runtime
from auto_offer_launcher.logging_utils import logger_for
from auto_offer_launcher.server import remove_owned_state, serve

STATE_PATH = ROOT / ".runtime/server.json"


def request(path, method="GET", token=None, timeout=2):
    headers = {"X-Auto-Offer-Shutdown": token} if token else {}
    with urlopen(Request(f"http://{HOST}:{PORT}{path}", method=method, headers=headers), timeout=timeout) as response:
        return json.loads(response.read())


def health(attempts=1):
    for attempt in range(attempts):
        try:
            return request("/__auto_offer_health", timeout=.75)
        except Exception:
            if attempt + 1 < attempts:
                time.sleep(.2)
    return None


def port_open():
    with socket.socket() as sock:
        sock.settimeout(.4)
        return sock.connect_ex((HOST, PORT)) == 0


def state():
    try:
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def identity_matches(current, expected_fingerprint=None):
    return bool(current and current.get("app_identity") == APP_IDENTITY
                and current.get("launcher_version") == LAUNCHER_VERSION
                and current.get("host") == HOST and current.get("port") == PORT
                and isinstance(current.get("instance_id"), str) and current["instance_id"]
                and isinstance(current.get("pid"), int) and current["pid"] > 0
                and (expected_fingerprint is None or current.get("release_fingerprint") == expected_fingerprint))


def state_matches_health(saved, current):
    keys = ("app_identity", "instance_id", "release_fingerprint", "launcher_version", "pid", "host", "port")
    return bool(saved and identity_matches(current) and all(saved.get(k) == current.get(k) for k in keys))


def clear_stale_state():
    saved = state()
    if saved:
        remove_owned_state(STATE_PATH, saved.get("instance_id"), logger_for(ROOT / ".runtime/logs/launcher.log"))


def inspect_listener(expected_fingerprint=None):
    current = health(attempts=4)
    if current:
        saved = state()
        if identity_matches(current) and state_matches_health(saved, current):
            return ("owned" if identity_matches(current, expected_fingerprint) else "owned_other"), current
        return "foreign", current
    if port_open():
        return "unresponsive", None
    clear_stale_state()
    return "closed", None


def owned_stop(expected_fingerprint=None):
    kind, current = inspect_listener(expected_fingerprint)
    if kind == "closed":
        return True
    if kind not in ("owned", "owned_other"):
        return False
    saved = state()
    if not state_matches_health(saved, current):
        return False
    try:
        request("/__auto_offer_shutdown", "POST", saved["shutdown_token"])
    except Exception:
        return False
    for _ in range(100):
        if not port_open() and not STATE_PATH.exists():
            return True
        time.sleep(.1)
    return False


def start(no_browser=False):
    load_runtime(HERE / "runtime-manifest.json")
    print("[2/4] Проверка приложения")
    release = load_release(ROOT / "release-manifest.json", ROOT)
    fp = fingerprint(release)
    kind, _ = inspect_listener(fp)
    if kind == "owned":
        pass
    else:
        if kind == "owned_other":
            if not owned_stop():
                raise RuntimeError("Could not stop the confirmed older Auto Offer server")
            kind = "closed"
        if kind in ("foreign", "unresponsive"):
            raise RuntimeError("Port 8765 is occupied by a foreign or unresponsive listener")
        print("[3/4] Сервер")
        runtime_root = ROOT / ".runtime"
        (runtime_root / "logs").mkdir(parents=True, exist_ok=True)
        cmd = [sys.executable, str(Path(__file__).resolve()), "serve",
               "--app-version", release["app_version"], "--fingerprint", fp]
        log = open(runtime_root / "logs/server.log", "ab", buffering=0)
        proc = subprocess.Popen(cmd, stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT,
                                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        for _ in range(100):
            current = health()
            saved = state()
            if identity_matches(current, fp) and state_matches_health(saved, current):
                break
            if proc.poll() is not None:
                raise RuntimeError("local server exited during startup")
            time.sleep(.1)
        else:
            raise RuntimeError("server health timeout")
    print("[4/4] Браузер")
    if not no_browser and not webbrowser.open(START_URL):
        raise RuntimeError(f"Browser could not be opened; server remains running. Open {START_URL}")
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command")
    p = sub.add_parser("start"); p.add_argument("--no-browser", action="store_true")
    sub.add_parser("stop")
    s = sub.add_parser("serve"); s.add_argument("--app-version", required=True); s.add_argument("--fingerprint", required=True)
    args = parser.parse_args(argv)
    command = args.command or "start"
    if command == "stop":
        return 0 if owned_stop() else 4
    if command == "serve":
        identity = {"app_identity": APP_IDENTITY, "app_version": args.app_version,
                    "release_fingerprint": args.fingerprint, "launcher_version": LAUNCHER_VERSION,
                    "host": HOST, "port": PORT}
        serve(ROOT / "dist/app", identity, STATE_PATH, logger_for(ROOT / ".runtime/logs/server.log", "server"))
        return 0
    return start(args.no_browser)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        logger_for(ROOT / ".runtime/logs/launcher.log").exception("launcher failed")
        print(f"Что произошло: {exc}\nЭтап: запуск Auto Offer\nЧто сохранено: portable Python и данные браузера\n"
              f"Следующий запуск повторит незавершённый этап\nЧто сделать: полностью распакуйте свежий release ZIP и повторите start.bat\n"
              f"Лог: {ROOT/'.runtime/logs/launcher.log'}", file=sys.stderr)
        raise SystemExit(2)
