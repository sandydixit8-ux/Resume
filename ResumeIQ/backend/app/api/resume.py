import os
import json
import uuid
import logging
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.resume import Resume
from app.models.analysis import Analysis, JDAnalysis, CoverLetter
from app.services.resume_parser import ResumeParserService
from app.config import get_settings
from app.api.deps import (
    SESSION_TOKEN_HEADER,
    hash_session_token,
    issue_session_token,
    require_owner,
)

logger = logging.getLogger("app.resume")

router = APIRouter(tags=["Resume"])

ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt"]


def _session_owner(x_session_token: str | None) -> tuple[str, str | None]:
    """Return (token_hash, newly_issued_raw_token_if_created)."""
    if x_session_token and x_session_token.strip():
        return hash_session_token(x_session_token.strip()), None
    new_token = issue_session_token()
    return hash_session_token(new_token), new_token


def _serialize(db_resume: Resume, session_token: str | None = None):
    payload = {
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
    if session_token is not None:
        payload["session_token"] = session_token
    return payload


@router.post("/upload")
async def upload_resume(
    file: UploadFile = File(...),
    x_session_token: str | None = Header(default=None, alias=SESSION_TOKEN_HEADER),
    db: Session = Depends(get_db),
):
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
    owner_hash, new_token = _session_owner(x_session_token)
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
        owner_token_hash=owner_hash,
    )
    db.add(db_resume)
    db.commit()
    db.refresh(db_resume)
    logger.info("resume uploaded", extra={"event": "resume_upload", "resume_id": db_resume.id, "file_type": ext, "size_bytes": len(contents)})
    return _serialize(db_resume, new_token)


@router.post("/paste")
async def paste_resume(
    text: str = Form(...),
    filename: str = Form("pasted_resume.txt"),
    x_session_token: str | None = Header(default=None, alias=SESSION_TOKEN_HEADER),
    db: Session = Depends(get_db),
):
    if not text.strip():
        raise HTTPException(status_code=400, detail="Resume text cannot be empty")
    max_paste_chars = get_settings().max_paste_chars
    if len(text) > max_paste_chars:
        raise HTTPException(status_code=413, detail=f"Pasted text too long. Maximum is {max_paste_chars} characters")
    parsed = ResumeParserService.parse_text(text)
    owner_hash, new_token = _session_owner(x_session_token)
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
        owner_token_hash=owner_hash,
    )
    db.add(db_resume)
    db.commit()
    db.refresh(db_resume)
    logger.info("resume pasted", extra={"event": "resume_paste", "resume_id": db_resume.id, "size_bytes": len(text.encode("utf-8"))})
    return _serialize(db_resume, new_token)


@router.get("/{resume_id}")
def get_resume(
    resume_id: int,
    x_session_token: str | None = Header(default=None, alias=SESSION_TOKEN_HEADER),
    db: Session = Depends(get_db),
):
    resume = require_owner(db, resume_id, x_session_token)
    return _serialize(resume)


@router.get("")
def list_resumes(
    x_session_token: str | None = Header(default=None, alias=SESSION_TOKEN_HEADER),
    db: Session = Depends(get_db),
):
    if not x_session_token or not x_session_token.strip():
        raise HTTPException(status_code=401, detail=f"A session token ({SESSION_TOKEN_HEADER} header) is required")
    token_hash = hash_session_token(x_session_token.strip())
    resumes = (
        db.query(Resume)
        .filter(Resume.owner_token_hash == token_hash)
        .order_by(Resume.created_at.desc())
        .limit(50)
        .all()
    )
    return [{"id": r.id, "original_filename": r.original_filename, "file_type": r.file_type, "has_parsing_issues": r.has_parsing_issues, "created_at": r.created_at.isoformat() if r.created_at else None} for r in resumes]


@router.delete("/{resume_id}")
def delete_resume(
    resume_id: int,
    x_session_token: str | None = Header(default=None, alias=SESSION_TOKEN_HEADER),
    db: Session = Depends(get_db),
):
    resume = require_owner(db, resume_id, x_session_token)
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
    logger.info("resume deleted", extra={"event": "resume_delete", "resume_id": resume_id})
    return {"detail": "Resume deleted"}
