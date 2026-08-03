import sys


def console_text(value, *, file=None):
    """Write text without failing on a legacy Windows console encoding."""
    stream = file or sys.stdout
    encoding = getattr(stream, "encoding", None) or "utf-8"
    safe = str(value).encode(encoding, errors="backslashreplace").decode(encoding)
    print(safe, file=stream)
