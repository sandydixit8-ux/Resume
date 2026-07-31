import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.resume import Resume
from app.models.analysis import CoverLetter
from app.services.cover_letter import CoverLetterService

router = APIRouter(tags=["Cover Letter"])


@router.post("")
def generate_cover_letter(request: dict, db: Session = Depends(get_db)):
    resume_id = request.get("resume_id")
    jd_text = request.get("jd_text", "")
    jd_title = request.get("jd_title", "")
    company_name = request.get("company_name", "")
    tone = request.get("tone", "formal")
    length = request.get("length", "medium")
    if not resume_id:
        raise HTTPException(status_code=400, detail="resume_id is required")
    if not jd_text.strip():
        raise HTTPException(status_code=400, detail="jd_text is required")
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    parsed_json = json.loads(resume.parsed_json) if resume.parsed_json else {}
    content = CoverLetterService.generate(
        resume_parsed=parsed_json, jd_text=jd_text, tone=tone,
        length=length, company_name=company_name or None, role_name=jd_title or None
    )
    db_cl = CoverLetter(resume_id=resume_id, content=content, tone=tone, length=length,
                        company_name=company_name or None, role_name=jd_title or None)
    db.add(db_cl)
    db.commit()
    db.refresh(db_cl)
    return {
        "id": db_cl.id, "resume_id": db_cl.resume_id, "content": db_cl.content,
        "tone": db_cl.tone, "length": db_cl.length, "company_name": db_cl.company_name,
        "role_name": db_cl.role_name, "created_at": db_cl.created_at.isoformat() if db_cl.created_at else None,
    }


@router.get("/{cover_letter_id}")
def get_cover_letter(cover_letter_id: int, db: Session = Depends(get_db)):
    cl = db.query(CoverLetter).filter(CoverLetter.id == cover_letter_id).first()
    if not cl:
        raise HTTPException(status_code=404, detail="Cover letter not found")
    return {
        "id": cl.id, "resume_id": cl.resume_id, "content": cl.content,
        "tone": cl.tone, "length": cl.length, "company_name": cl.company_name,
        "role_name": cl.role_name, "created_at": cl.created_at.isoformat() if cl.created_at else None,
    }


@router.get("/by-resume/{resume_id}")
def list_cover_letters(resume_id: int, db: Session = Depends(get_db)):
    letters = db.query(CoverLetter).filter(CoverLetter.resume_id == resume_id).order_by(CoverLetter.created_at.desc()).all()
    return [{"id": l.id, "resume_id": l.resume_id, "tone": l.tone, "length": l.length, "company_name": l.company_name, "role_name": l.role_name, "created_at": l.created_at.isoformat() if l.created_at else None} for l in letters]
