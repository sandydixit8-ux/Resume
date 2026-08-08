import logging
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from app.config import get_settings
from app.database import init_db
from app.database import SessionLocal
from app.models.admin import AdminSetting
from app.api.admin import _hash_password
from app.api.resume import router as resume_router
from app.api.analyze import router as analyze_router
from app.api.jd_match import router as jd_match_router
from app.api.rewrite import router as rewrite_router
from app.api.cover_letter import router as cover_letter_router
from app.api.interview import router as interview_router
from app.api.admin import router as admin_router
from app.api.payment import router as payment_router
from app.api.contact import router as contact_router
from app.api.ai import router as ai_router
from app.api.countries import router as countries_router
from app.api.export import router as export_router
from app.logging_config import setup_logging, request_logger

settings = get_settings()
logger = logging.getLogger("app.main")


class AccessLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000
        rec = logging.LogRecord("app.access", logging.INFO, __file__, 44, "", (), None)
        request_logger(
            rec,
            event="request",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=duration_ms,
        )
        logger.handle(rec)
        return response


def _migrate_plaintext_admin_password() -> None:
    """Upgrade any legacy plaintext admin_password row to a PBKDF2 hash."""
    db = SessionLocal()
    try:
        row = db.query(AdminSetting).filter(AdminSetting.key == "admin_password").first()
        if row and row.value and not row.value.startswith("pbkdf2$"):
            row.value = _hash_password(row.value)
            db.commit()
            logger.info("admin_password row migrated from plaintext to PBKDF2")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    setup_logging()
    settings.validate_production()
    init_db()
    _migrate_plaintext_admin_password()
    logger.info("ResumeIQ backend started", extra={"event": "startup", "environment": settings.environment})
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="AI-powered resume analysis, ATS compatibility scoring, JD matching, and cover letter generation.",
    lifespan=lifespan,
)


def _cors_origins():
    if settings.cors_origins == "*":
        return ["*"]
    return [o.strip() for o in settings.cors_origins.split(",") if o.strip()]


# Allow credentials only when origins are explicitly restricted.
# Wildcard "*" with credentials is invalid per the fetch spec and was a security finding.
allow_credentials = settings.cors_origins != "*"

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(AccessLogMiddleware)


app.include_router(resume_router, prefix="/api/v1/resume")
app.include_router(analyze_router, prefix="/api/v1/analyze")
app.include_router(jd_match_router, prefix="/api/v1/jd-match")
app.include_router(rewrite_router, prefix="/api/v1/rewrite")
app.include_router(cover_letter_router, prefix="/api/v1/cover-letter")
app.include_router(interview_router, prefix="/api/v1/interview")
app.include_router(admin_router)
app.include_router(payment_router)
app.include_router(contact_router)
app.include_router(ai_router, prefix="/api/v1")
app.include_router(countries_router, prefix="/api/v1")
app.include_router(export_router, prefix="/api/v1")


@app.get("/api/v1/health")
def health_check():
    return {"status": "ok", "version": settings.app_version}
