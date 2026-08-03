#!/usr/bin/env python3
"""Build and validate the deterministic Auto Offer Windows staging directory."""
import argparse, hashlib, json, os, re, shutil, sys
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from urllib.parse import urlsplit

ROOT=Path(__file__).resolve().parents[2]
LAUNCHER_VERSION="1.0.0"
FORBIDDEN_PARTS={".git",".runtime","node_modules","__pycache__","logs"}
FORBIDDEN_SUFFIXES={".ts",".tsx",".xls",".xlsx",".zip",".pyc",".exe"}

class Refs(HTMLParser):
    def __init__(self): super().__init__(); self.values=[]
    def handle_starttag(self, tag, attrs):
        values=dict(attrs)
        for key in ("src","href"):
            value=values.get(key)
            if value: self.values.append(value)

def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()

def console_text(value):
    """Write diagnostics even when the Windows console cannot encode the path."""
    text=str(value)
    encoding=getattr(sys.stdout,"encoding",None) or "utf-8"
    print(text.encode(encoding,errors="backslashreplace").decode(encoding))

def validate_app(app):
    index=app/"index.html"
    if not index.is_file() or not index.stat().st_size: raise ValueError("dist/app/index.html is missing or empty")
    parser=Refs(); parser.feed(index.read_text(encoding="utf-8"))
    for value in parser.values:
        parsed=urlsplit(value)
        if parsed.scheme or parsed.netloc or value.startswith(("#","data:")): continue
        rel=parsed.path.lstrip("/")
        if rel and not (app/rel).is_file(): raise ValueError(f"index.html references missing asset: {rel}")

def package_files(stage):
    return sorted((p for p in stage.rglob("*") if p.is_file() and p.name!="release-manifest.json"),key=lambda p:p.relative_to(stage).as_posix())

def audit(stage):
    for p in stage.rglob("*"):
        rel=p.relative_to(stage); low={x.lower() for x in rel.parts}
        if low & FORBIDDEN_PARTS or tuple(x.lower() for x in rel.parts[:2]) == ("app","src") or (p.is_file() and p.suffix.lower() in FORBIDDEN_SUFFIXES): raise ValueError(f"forbidden package content: {rel}")
    allowed={p.relative_to(stage).as_posix() for p in package_files(stage)}|{"release-manifest.json"}
    manifest=json.loads((stage/"release-manifest.json").read_text(encoding="utf-8"))
    listed={x["path"] for x in manifest["files"]}|{"release-manifest.json"}
    if allowed != listed: raise ValueError(f"manifest/package mismatch: {allowed ^ listed}")

def build(args):
    app=Path(args.app).resolve(); stage=Path(args.output).resolve(); validate_app(app)
    if stage.exists(): shutil.rmtree(stage)
    (stage/"dist").mkdir(parents=True); shutil.copytree(app,stage/"dist/app")
    shutil.copy2(ROOT/"start.bat",stage); shutil.copy2(ROOT/"stop.bat",stage)
    target=stage/"scripts/launcher"; target.mkdir(parents=True)
    for name in ("bootstrap.ps1","launcher.py","runtime-manifest.json"): shutil.copy2(ROOT/"scripts/launcher"/name,target)
    shutil.copytree(ROOT/"scripts/launcher/auto_offer_launcher",target/"auto_offer_launcher",ignore=shutil.ignore_patterns("__pycache__","*.pyc"))
    version=json.loads((ROOT/"package.json").read_text())["version"]
    files=[{"path":p.relative_to(stage).as_posix(),"size":p.stat().st_size,"sha256":digest(p)} for p in package_files(stage)]
    manifest={"schema_version":1,"app_identity":"auto-offer","app_version":version,"launcher_version":LAUNCHER_VERSION,"source_commit":args.source_commit,"build_timestamp":args.build_timestamp,"host":"127.0.0.1","port":8765,"start_url":"http://127.0.0.1:8765/#/","files":files}
    (stage/"release-manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,sort_keys=True,indent=2)+"\n",encoding="utf-8",newline="\n")
    audit(stage); console_text(stage)

def main():
    p=argparse.ArgumentParser(); p.add_argument("--app",default=ROOT/"dist/app"); p.add_argument("--output",required=True); p.add_argument("--source-commit",required=True); p.add_argument("--build-timestamp",default=datetime.now(timezone.utc).isoformat())
    args=p.parse_args(); build(args)
if __name__=="__main__": main()
