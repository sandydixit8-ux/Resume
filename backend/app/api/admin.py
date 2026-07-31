import json
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.admin import VisitorLog, AdminSetting
from app.config import get_settings
from app.services.email_service import send_reset_email, verify_reset_code, clear_reset_code

router = APIRouter(tags=["Admin"])

def _get_admin_password(db: Session) -> str:
    settings = get_settings()
    row = db.query(AdminSetting).filter(AdminSetting.key == "admin_password").first()
    if row:
        return row.value
    return settings.admin_password

def verify_admin(authorization: str = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization[7:]
    settings = get_settings()
    pwd = _get_admin_password(db)
    if token != f"{settings.admin_username}:{pwd}":
        raise HTTPException(status_code=401, detail="Invalid token")
    return True

@router.post("/api/v1/admin/login")
def admin_login(request: dict, db: Session = Depends(get_db)):
    settings = get_settings()
    username = request.get("username", "")
    password = request.get("password", "")
    pwd = _get_admin_password(db)
    if username == settings.admin_username and password == pwd:
        return {"token": f"{username}:{pwd}", "username": username}
    raise HTTPException(status_code=401, detail="Invalid credentials")

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
        row.value = new_password
    else:
        db.add(AdminSetting(key="admin_password", value=new_password))
    db.commit()
    return {"message": "Password reset successfully"}

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
