import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.resume import Resume
from app.services.interview import InterviewPrepService
from app.services.resume_parser import ResumeParserService

router = APIRouter(tags=["Interview"])

@router.post("/questions")
def get_interview_questions_from_text(request: dict = {}):
    resume_text = request.get("resume_text", "")
    jd_text = request.get("jd_text", None)
    if not resume_text.strip():
        raise HTTPException(status_code=400, detail="Resume text required")
    parsed = ResumeParserService.parse_text(resume_text)
    questions = InterviewPrepService.generate_questions(parsed["parsed_json"], resume_text, jd_text)
    return {"resume_id": None, "questions": questions, "total": len(questions)}

@router.post("/questions/{resume_id}")
def get_interview_questions(resume_id: int, request: dict = {}, db: Session = Depends(get_db)):
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    parsed_json = json.loads(resume.parsed_json) if resume.parsed_json else {}
    jd_text = request.get("jd_text", None)
    questions = InterviewPrepService.generate_questions(parsed_json, resume.raw_text, jd_text)
    return {"resume_id": resume_id, "questions": questions, "total": len(questions)}
