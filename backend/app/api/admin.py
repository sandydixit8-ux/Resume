import base64
import hashlib
import hmac
import json
import os
import time
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Header, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.admin import VisitorLog, AdminSetting
from app.models.payment import Subscription
from app.api.payment import PLANS
from app.config import get_settings
from app.services.email_service import send_reset_email, verify_reset_code, clear_reset_code

router = APIRouter(tags=["Admin"])

LOGIN_MAX_ATTEMPTS = 5
LOGIN_WINDOW_SECONDS = 900
_login_attempts: dict[str, list[float]] = defaultdict(list)


def _hash_password(password: str) -> str:
    salt = os.urandom(16)
    iterations = 120000
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
    return f"pbkdf2${iterations}${base64.b64encode(salt).decode()}${base64.b64encode(dk).decode()}"


def _verify_password(password: str, stored: str) -> bool:
    try:
        _, iter_s, salt_b64, hash_b64 = stored.split("$")
        iterations = int(iter_s)
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(hash_b64)
    except Exception:
        return False
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
    return hmac.compare_digest(dk, expected)


def _sign_token(username: str, secret: str, ttl_seconds: int) -> str:
    expires = int(time.time()) + ttl_seconds
    payload = f"{username}:{expires}"
    sig = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(f"{payload}:{sig}".encode()).decode()


def _verify_token(token: str, secret: str, expected_username: str) -> bool:
    try:
        raw = base64.urlsafe_b64decode(token.encode()).decode()
        token_user, expires_s, sig = raw.rsplit(":", 2)
        expires = int(expires_s)
    except Exception:
        return False
    if token_user != expected_username:
        return False
    if int(time.time()) > expires:
        return False
    expected = hmac.new(secret.encode(), f"{token_user}:{expires}".encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(sig, expected)


def _get_admin_password(db: Session) -> str:
    settings = get_settings()
    row = db.query(AdminSetting).filter(AdminSetting.key == "admin_password").first()
    if row:
        return row.value
    return settings.admin_password


def verify_admin(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    settings = get_settings()
    token = authorization[7:]
    if not _verify_token(token, settings.secret_key, settings.admin_username):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return True


@router.post("/api/v1/admin/login")
def admin_login(request: Request, body: dict, db: Session = Depends(get_db)):
    settings = get_settings()
    username = body.get("username", "")
    password = body.get("password", "")
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    attempts = [t for t in _login_attempts[ip] if now - t < LOGIN_WINDOW_SECONDS]
    attempts.append(now)
    _login_attempts[ip] = attempts
    if len(attempts) > LOGIN_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many login attempts. Please wait 15 minutes.")
    pwd = _get_admin_password(db)
    valid = False
    if username == settings.admin_username:
        if pwd.startswith("pbkdf2$"):
            valid = _verify_password(password, pwd)
        else:
            valid = password == pwd  # legacy plaintext value (config default / pre-migration DB row)
    if not valid:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    _login_attempts[ip] = []
    ttl = settings.access_token_expire_minutes * 60
    return {
        "token": _sign_token(username, settings.secret_key, ttl),
        "username": username,
        "expires_in": ttl,
    }

@router.post("/api/v1/visitor/track")
def track_visitor(request: dict, db: Session = Depends(get_db)):
    log = VisitorLog(
        path=request.get("path", "/"),
        ip_address=request.get("ip", ""),
        user_agent=request.get("user_agent", ""),
        referer=request.get("referer", ""),
        timestamp=datetime.now(timezone.utc),
    )
    db.add(log)
    db.commit()
    return {"status": "ok"}

@router.get("/api/v1/admin/email-status")
def admin_email_status():
    settings = get_settings()
    has_email = bool(settings.admin_email)
    has_smtp = bool(settings.smtp_username and settings.smtp_password)
    return {"configured": has_email and has_smtp, "email": settings.admin_email if has_email else ""}

@router.post("/api/v1/admin/forgot-password")
def admin_forgot_password(request: dict):
    settings = get_settings()
    email = request.get("email", "")
    if not email or email != settings.admin_email:
        raise HTTPException(status_code=404, detail="Email not found")
    code = send_reset_email(email)
    if not code:
        raise HTTPException(status_code=500, detail="Failed to send email. Check SMTP settings.")
    return {"message": "Reset code sent to your email"}

@router.post("/api/v1/admin/reset-password")
def admin_reset_password(request: dict, db: Session = Depends(get_db)):
    settings = get_settings()
    email = request.get("email", "")
    code = request.get("code", "")
    new_password = request.get("new_password", "")
    if not email or not code or not new_password:
        raise HTTPException(status_code=400, detail="Missing fields")
    if email != settings.admin_email:
        raise HTTPException(status_code=404, detail="Email not found")
    if not verify_reset_code(email, code):
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    clear_reset_code(email)
    row = db.query(AdminSetting).filter(AdminSetting.key == "admin_password").first()
    if row:
        row.value = _hash_password(new_password)
    else:
        db.add(AdminSetting(key="admin_password", value=_hash_password(new_password)))
    db.commit()
    return {"message": "Password reset successfully"}

def _as_utc(dt):
    if dt is None:
        return datetime.min
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt

@router.get("/api/v1/admin/financials")
def admin_financials(db: Session = Depends(get_db), _=Depends(verify_admin)):
    subs = db.query(Subscription).all()
    active = [s for s in subs if s.status == "active"]

    plan_counts = {p: 0 for p in PLANS}
    for s in active:
        if s.plan in plan_counts:
            plan_counts[s.plan] += 1

    mrr = sum(PLANS[s.plan]["price"] for s in active if s.plan in PLANS)

    trend = []
    for i in range(6, -1, -1):
        day = (datetime.now(timezone.utc) - timedelta(days=i)).date()
        count = sum(1 for s in subs if s.created_at and s.created_at.date() == day)
        trend.append({"date": day.isoformat(), "signups": count})

    recent = sorted(subs, key=lambda s: _as_utc(s.created_at), reverse=True)[:20]

    return {
        "total_subscribers": len(subs),
        "active_subscribers": len(active),
        "mrr": mrr,
        "plan_breakdown": {
            p: {
                "count": plan_counts.get(p, 0),
                "price": PLANS[p]["price"],
                "revenue": plan_counts.get(p, 0) * PLANS[p]["price"],
            }
            for p in PLANS
        },
        "signup_trend": trend,
        "recent_subscriptions": [
            {
                "email": s.email,
                "plan": s.plan,
                "status": s.status,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in recent
        ],
    }

@router.get("/api/v1/admin/stats")
def admin_stats(db: Session = Depends(get_db), _=Depends(verify_admin)):
    total = db.query(func.count(VisitorLog.id)).scalar()
    today = db.query(func.count(VisitorLog.id)).filter(
        func.date(VisitorLog.timestamp) == func.date("now")
    ).scalar()
    unique_ips = db.query(func.count(func.distinct(VisitorLog.ip_address))).scalar()
    paths = db.query(VisitorLog.path, func.count(VisitorLog.id).label("count")).group_by(VisitorLog.path).order_by(func.count(VisitorLog.id).desc()).limit(10).all()
    recent = db.query(VisitorLog).order_by(VisitorLog.timestamp.desc()).limit(20).all()
    return {
        "total_visits": total or 0,
        "today_visits": today or 0,
        "unique_visitors": unique_ips or 0,
        "top_pages": [{"path": p[0], "count": p[1]} for p in paths],
        "recent_visits": [
            {"path": v.path, "ip": v.ip_address, "timestamp": v.timestamp.isoformat() if v.timestamp else None}
            for v in recent
        ],
    }
