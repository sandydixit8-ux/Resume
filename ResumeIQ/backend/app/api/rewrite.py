import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.resume import Resume
from app.services.rewrite import RewriteService

router = APIRouter(tags=["Rewrite"])


@router.post("/{resume_id}")
def get_rewrite_suggestions(resume_id: int, request: dict = {}, db: Session = Depends(get_db)):
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    parsed_json = json.loads(resume.parsed_json) if resume.parsed_json else {}
    jd_text = request.get("jd_text", None)
    suggestions = RewriteService.generate_suggestions(parsed_json, resume.raw_text, jd_text)
    return {"resume_id": resume_id, "suggestions": suggestions}
