import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

class RedactingFormatter(logging.Formatter):
    def format(self, record):
        text = super().format(record)
        for marker in ("shutdown_token", "Cookie", "Authorization"):
            if marker.lower() in text.lower(): return "[redacted sensitive launcher message]"
        return text

def logger_for(path, name="launcher"):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    log = logging.getLogger(name); log.setLevel(logging.INFO); log.handlers.clear()
    handler = RotatingFileHandler(path, maxBytes=1_000_000, backupCount=4, encoding="utf-8")
    handler.setFormatter(RedactingFormatter("%(asctime)s [%(name)s] %(levelname)s %(message)s"))
    log.addHandler(handler)
    return log
