from __future__ import annotations
import re, sys, time

SECRET = re.compile(r"(?i)(shutdown[_ -]?token|authorization|cookie)(\s*[:=]\s*)(\S+)")
def redact(text: str) -> str: return SECRET.sub(r"\1\2[REDACTED]", text)
def unicode_supported(stream=None) -> bool:
    encoding = getattr(stream or sys.stdout, "encoding", "") or ""
    try: "█░".encode(encoding); return True
    except (UnicodeEncodeError, LookupError): return False
def console_print(text: str, *, end="\n", flush=True) -> None:
    try: print(text,end=end,flush=flush)
    except UnicodeEncodeError:
        fallback=text.encode("ascii",errors="backslashreplace").decode("ascii")
        print(fallback,end=end,flush=flush)
def download_line(stage, name, downloaded, total, elapsed, unicode=True):
    speed = downloaded / max(elapsed, .001) / 1048576
    if total:
        ratio=min(downloaded/total,1); done=int(ratio*20); bar=("█"*done+"░"*(20-done)) if unicode else ("#"*done+"-"*(20-done))
        return f"[{stage}/7] {name} [{bar}] {ratio:.0%} {downloaded/1048576:.1f}/{total/1048576:.1f} MB {speed:.1f} MB/s"
    spin="|/-\\"[int(elapsed*4)%4]
    return f"[{stage}/7] {name} {spin} {downloaded} bytes {elapsed:.1f}s"
class Reporter:
    def __init__(self): self.unicode=unicode_supported(); self.started=time.monotonic()
    def stage(self, number, name, detail="готово"): console_print(f"[{number}/7] {name}: {detail}")
