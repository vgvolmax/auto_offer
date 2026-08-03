#!/usr/bin/env python3
import argparse, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]; sys.path.insert(0,str(ROOT/"scripts/launcher"))
from auto_offer_launcher.config import load_release
from build_windows_release import audit, console_text, validate_app
p=argparse.ArgumentParser(); p.add_argument("package"); a=p.parse_args(); root=Path(a.package).resolve()
load_release(root/"release-manifest.json",root); validate_app(root/"dist/app"); audit(root); console_text(f"Verified {root}")
