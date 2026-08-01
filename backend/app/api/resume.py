import os
import json
import uuid
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.resume import Resume
from app.models.analysis import Analysis, JDAnalysis, CoverLetter
from app.services.resume_parser import ResumeParserService
from app.config import get_settings

router = APIRouter(tags=["Resume"])

ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt"]


@router.post("/upload")
async def upload_resume(file: UploadFile = File(...), db: Session = Depends(get_db)):
    ext = os.path.splitext(file.filename or "resume.txt")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}. Accepted: PDF, DOCX, TXT")
    max_bytes = get_settings().max_upload_mb * 1024 * 1024
    if file.size and file.size > max_bytes:
        raise HTTPException(status_code=413, detail=f"File too large. Maximum size is {get_settings().max_upload_mb} MB")
    contents = await file.read(max_bytes + 1)
    if len(contents) > max_bytes:
        raise HTTPException(status_code=413, detail=f"File too large. Maximum size is {get_settings().max_upload_mb} MB")
    unique_name = f"{uuid.uuid4()}{ext}"
    file_path = ResumeParserService.save_upload(contents, unique_name)
    try:
        parsed = ResumeParserService.parse_file(file_path)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse resume: {str(e)}")
    db_resume = Resume(
        filename=unique_name,
        original_filename=file.filename,
        file_path=file_path,
        raw_text=parsed.get("raw_text", ""),
        ats_view_text=parsed.get("ats_view_text", ""),
        parsed_json=json.dumps(parsed.get("parsed_json", {})),
        has_parsing_issues=parsed.get("has_parsing_issues", False),
        parsing_issues=parsed.get("parsing_issues", "[]"),
        file_type=ext,
        file_size_bytes=len(contents),
    )
    db.add(db_resume)
    db.commit()
    db.refresh(db_resume)
    return {
        "id": db_resume.id,
        "filename": db_resume.filename,
        "original_filename": db_resume.original_filename,
        "raw_text": db_resume.raw_text,
        "ats_view_text": db_resume.ats_view_text,
        "parsed_json": json.loads(db_resume.parsed_json) if db_resume.parsed_json else {},
        "has_parsing_issues": db_resume.has_parsing_issues,
        "parsing_issues": json.loads(db_resume.parsing_issues) if db_resume.parsing_issues else [],
        "file_type": db_resume.file_type,
        "file_size_bytes": db_resume.file_size_bytes,
        "created_at": db_resume.created_at.isoformat() if db_resume.created_at else None,
    }


@router.post("/paste")
async def paste_resume(text: str = Form(...), filename: str = Form("pasted_resume.txt"), db: Session = Depends(get_db)):
    if not text.strip():
        raise HTTPException(status_code=400, detail="Resume text cannot be empty")
    parsed = ResumeParserService.parse_text(text)
    db_resume = Resume(
        filename=filename,
        original_filename=filename,
        file_path=None,
        raw_text=parsed.get("raw_text", ""),
        ats_view_text=parsed.get("ats_view_text", ""),
        parsed_json=json.dumps(parsed.get("parsed_json", {})),
        has_parsing_issues=parsed.get("has_parsing_issues", False),
        parsing_issues=parsed.get("parsing_issues", "[]"),
        file_type=".txt",
        file_size_bytes=len(text.encode("utf-8")),
    )
    db.add(db_resume)
    db.commit()
    db.refresh(db_resume)
    return {
        "id": db_resume.id,
        "filename": db_resume.filename,
        "original_filename": db_resume.original_filename,
        "raw_text": db_resume.raw_text,
        "ats_view_text": db_resume.ats_view_text,
        "parsed_json": json.loads(db_resume.parsed_json) if db_resume.parsed_json else {},
        "has_parsing_issues": db_resume.has_parsing_issues,
        "parsing_issues": json.loads(db_resume.parsing_issues) if db_resume.parsing_issues else [],
        "file_type": db_resume.file_type,
        "file_size_bytes": db_resume.file_size_bytes,
        "created_at": db_resume.created_at.isoformat() if db_resume.created_at else None,
    }


@router.get("/{resume_id}")
def get_resume(resume_id: int, db: Session = Depends(get_db)):
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    return {
        "id": resume.id,
        "filename": resume.filename,
        "original_filename": resume.original_filename,
        "raw_text": resume.raw_text,
        "ats_view_text": resume.ats_view_text,
        "parsed_json": json.loads(resume.parsed_json) if resume.parsed_json else {},
        "has_parsing_issues": resume.has_parsing_issues,
        "parsing_issues": json.loads(resume.parsing_issues) if resume.parsing_issues else [],
        "file_type": resume.file_type,
        "file_size_bytes": resume.file_size_bytes,
        "created_at": resume.created_at.isoformat() if resume.created_at else None,
    }


@router.get("")
def list_resumes(db: Session = Depends(get_db)):
    resumes = db.query(Resume).order_by(Resume.created_at.desc()).limit(50).all()
    return [{"id": r.id, "original_filename": r.original_filename, "file_type": r.file_type, "has_parsing_issues": r.has_parsing_issues, "created_at": r.created_at.isoformat() if r.created_at else None} for r in resumes]


@router.delete("/{resume_id}")
def delete_resume(resume_id: int, db: Session = Depends(get_db)):
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    db.query(Analysis).filter(Analysis.resume_id == resume_id).delete()
    jd_ids = [j.id for j in db.query(JDAnalysis.id).filter(JDAnalysis.resume_id == resume_id).all()]
    if jd_ids:
        db.query(CoverLetter).filter(CoverLetter.jd_analysis_id.in_(jd_ids)).delete()
    db.query(JDAnalysis).filter(JDAnalysis.resume_id == resume_id).delete()
    db.query(CoverLetter).filter(CoverLetter.resume_id == resume_id).delete()
    if resume.file_path and os.path.exists(resume.file_path):
        os.remove(resume.file_path)
    db.delete(resume)
    db.commit()
    return {"detail": "Resume deleted"}
