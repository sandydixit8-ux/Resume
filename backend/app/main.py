from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.database import init_db
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

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
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
