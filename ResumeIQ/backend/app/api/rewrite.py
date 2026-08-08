import json
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.resume import Resume
from app.services.rewrite import RewriteService
from app.api.deps import SESSION_TOKEN_HEADER, require_owner

router = APIRouter(tags=["Rewrite"])


@router.post("/{resume_id}")
def get_rewrite_suggestions(
    resume_id: int,
    request: dict = {},
    x_session_token: str | None = Header(default=None, alias=SESSION_TOKEN_HEADER),
    db: Session = Depends(get_db),
):
    resume = require_owner(db, resume_id, x_session_token)
    parsed_json = json.loads(resume.parsed_json) if resume.parsed_json else {}
    jd_text = request.get("jd_text", None)
    suggestions = RewriteService.generate_suggestions(parsed_json, resume.raw_text, jd_text)
    return {"resume_id": resume_id, "suggestions": suggestions}
