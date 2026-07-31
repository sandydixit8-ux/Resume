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

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="AI-powered resume analysis, ATS compatibility scoring, JD matching, and cover letter generation.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(",") if settings.cors_origins != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()


app.include_router(resume_router, prefix="/api/v1/resume")
app.include_router(analyze_router, prefix="/api/v1/analyze")
app.include_router(jd_match_router, prefix="/api/v1/jd-match")
app.include_router(rewrite_router, prefix="/api/v1/rewrite")
app.include_router(cover_letter_router, prefix="/api/v1/cover-letter")
app.include_router(interview_router, prefix="/api/v1/interview")
app.include_router(admin_router)
app.include_router(payment_router)


@app.get("/api/v1/health")
def health_check():
    return {"status": "ok", "version": settings.app_version}
