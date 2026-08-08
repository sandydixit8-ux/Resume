import smtplib
import random
import string
import hmac
from email.mime.text import MIMEText
from datetime import datetime, timezone, timedelta
from app.config import get_settings

_reset_codes: dict[str, dict] = {}

RESET_CODE_TTL_MINUTES = 15
RESET_MAX_ATTEMPTS = 5

def send_reset_email(to_email: str) -> str | None:
    settings = get_settings()
    if not settings.smtp_username or not settings.smtp_password:
        return None

    code = "".join(random.choices(string.digits, k=6))
    msg = MIMEText(
        f"Your ResumeIQ admin password reset code is: {code}\n\n"
        f"This code expires in {RESET_CODE_TTL_MINUTES} minutes.\n\n"
        f"If you didn't request this, ignore this email."
    )
    msg["Subject"] = "ResumeIQ Admin - Password Reset Code"
    msg["From"] = settings.smtp_username
    msg["To"] = to_email

    try:
        with smtplib.SMTP(settings.smtp_server, settings.smtp_port) as server:
            server.starttls()
            server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(msg)
    except:
        return None

    _reset_codes[to_email] = {
        "code": code,
        "expires": datetime.now(timezone.utc) + timedelta(minutes=RESET_CODE_TTL_MINUTES),
        "attempts": 0,
    }
    return code

def verify_reset_code(email: str, code: str) -> bool:
    entry = _reset_codes.get(email)
    if not entry:
        return False
    if datetime.now(timezone.utc) > entry["expires"]:
        _reset_codes.pop(email, None)
        return False
    if entry.get("attempts", 0) >= RESET_MAX_ATTEMPTS:
        _reset_codes.pop(email, None)
        return False
    match = hmac.compare_digest(entry["code"], code)
    if not match:
        entry["attempts"] = entry.get("attempts", 0) + 1
        if entry["attempts"] >= RESET_MAX_ATTEMPTS:
            _reset_codes.pop(email, None)
        return False
    return True

def clear_reset_code(email: str):
    _reset_codes.pop(email, None)
