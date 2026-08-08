import json
import logging
import sys
import time
from typing import Optional


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        for key in ("event", "method", "path", "status", "duration_ms", "ip", "email", "resume_id"):
            value = getattr(record, key, None)
            if value is not None:
                payload[key] = value
        return json.dumps(payload, default=str)


def setup_logging(level: int = logging.INFO) -> None:
    root = logging.getLogger()
    if any(isinstance(h, logging.StreamHandler) for h in root.handlers):
        return
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root.addHandler(handler)
    root.setLevel(level)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


def request_logger(record: logging.LogRecord, *, event: str, method: str, path: str,
                   status: Optional[int] = None, duration_ms: Optional[float] = None,
                   ip: Optional[str] = None, **extra) -> None:
    record.event = event
    record.method = method
    record.path = path
    if status is not None:
        record.status = status
    if duration_ms is not None:
        record.duration_ms = round(duration_ms, 2)
    if ip is not None:
        record.ip = ip
    for k, v in extra.items():
        setattr(record, k, v)
    record.msg = f"{event}: {method} {path}"
