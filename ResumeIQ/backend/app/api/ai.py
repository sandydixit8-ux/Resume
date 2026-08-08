import json
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.resume import Resume
from app.services.ai_client import ai_available, ai_provider
from app.services import ai_rewriter
from app.api.deps import SESSION_TOKEN_HEADER, require_owner

router = APIRouter(tags=["AI"])


def _load_parsed(resume_id: int, db: Session, token: str | None) -> tuple[Resume, dict]:
    resume = require_owner(db, resume_id, token)
    parsed = json.loads(resume.parsed_json) if resume.parsed_json else {}
    return resume, parsed


@router.get("/ai/status")
def ai_status():
    return {"ai_configured": ai_available(), "provider": ai_provider()}


@router.post("/ai/achievements/{resume_id}")
def ai_achievements(
    resume_id: int,
    request: dict = {},
    x_session_token: str | None = Header(default=None, alias=SESSION_TOKEN_HEADER),
    db: Session = Depends(get_db),
):
    _, parsed = _load_parsed(resume_id, db, x_session_token)
    result = ai_rewriter.generate_achievements(parsed, request.get("jd_text"))
    return {"resume_id": resume_id, "ai_configured": ai_available(), **result}


@router.post("/ai/summary/{resume_id}")
def ai_summary(
    resume_id: int,
    request: dict = {},
    x_session_token: str | None = Header(default=None, alias=SESSION_TOKEN_HEADER),
    db: Session = Depends(get_db),
):
    _, parsed = _load_parsed(resume_id, db, x_session_token)
    result = ai_rewriter.generate_summary(parsed, request.get("jd_text"))
    return {"resume_id": resume_id, "ai_configured": ai_available(), **result}


@router.post("/ai/skills/{resume_id}")
def ai_skills(
    resume_id: int,
    request: dict = {},
    x_session_token: str | None = Header(default=None, alias=SESSION_TOKEN_HEADER),
    db: Session = Depends(get_db),
):
    _, parsed = _load_parsed(resume_id, db, x_session_token)
    result = ai_rewriter.generate_skills(parsed, request.get("jd_text"))
    return {"resume_id": resume_id, "ai_configured": ai_available(), **result}


@router.post("/ai/improve/{resume_id}")
def ai_improve(
    resume_id: int,
    request: dict = {},
    x_session_token: str | None = Header(default=None, alias=SESSION_TOKEN_HEADER),
    db: Session = Depends(get_db),
):
    _, parsed = _load_parsed(resume_id, db, x_session_token)
    result = ai_rewriter.improve_experience(parsed, request.get("jd_text"))
    return {"resume_id": resume_id, "ai_configured": ai_available(), **result}


@router.post("/ai/linkedin/{resume_id}")
def ai_linkedin(
    resume_id: int,
    request: dict = {},
    x_session_token: str | None = Header(default=None, alias=SESSION_TOKEN_HEADER),
    db: Session = Depends(get_db),
):
    _, parsed = _load_parsed(resume_id, db, x_session_token)
    result = ai_rewriter.linkedin_profile(parsed, request.get("jd_text"))
    return {"resume_id": resume_id, "ai_configured": ai_available(), **result}
