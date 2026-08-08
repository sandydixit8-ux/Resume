import json
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.resume import Resume
from app.models.analysis import Analysis
from app.services.ats_scorer import ATSScorerService
from app.api.deps import SESSION_TOKEN_HEADER, hash_session_token, require_owner

router = APIRouter(tags=["Analysis"])


@router.post("/{resume_id}")
def analyze_resume(
    resume_id: int,
    x_session_token: str | None = Header(default=None, alias=SESSION_TOKEN_HEADER),
    db: Session = Depends(get_db),
):
    resume = require_owner(db, resume_id, x_session_token)
    parsed_json = json.loads(resume.parsed_json) if resume.parsed_json else {}
    parsing_issues = json.loads(resume.parsing_issues) if resume.parsing_issues else []
    parsed_result = {"raw_text": resume.raw_text, "parsed_json": parsed_json, "parsing_issues": parsing_issues, "file_size": resume.file_size_bytes}
    score_result = ATSScorerService.score(parsed_result)
    db_analysis = Analysis(
        resume_id=resume_id,
        overall_score=score_result["overall_score"],
        category_scores=json.dumps(score_result["category_scores"]),
        category_feedback=json.dumps(score_result["category_feedback"]),
        priority_fixes=json.dumps(score_result["priority_fixes"]),
    )
    db.add(db_analysis)
    db.commit()
    db.refresh(db_analysis)
    return {
        "id": db_analysis.id,
        "resume_id": db_analysis.resume_id,
        "overall_score": db_analysis.overall_score,
        "category_scores": json.loads(db_analysis.category_scores) if db_analysis.category_scores else {},
        "category_feedback": json.loads(db_analysis.category_feedback) if db_analysis.category_feedback else {},
        "priority_fixes": json.loads(db_analysis.priority_fixes) if db_analysis.priority_fixes else [],
        "created_at": db_analysis.created_at.isoformat() if db_analysis.created_at else None,
    }


@router.get("/{resume_id}")
def get_analysis(
    resume_id: int,
    x_session_token: str | None = Header(default=None, alias=SESSION_TOKEN_HEADER),
    db: Session = Depends(get_db),
):
    require_owner(db, resume_id, x_session_token)
    analysis = db.query(Analysis).filter(Analysis.resume_id == resume_id).order_by(Analysis.created_at.desc()).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="No analysis found for this resume")
    return {
        "id": analysis.id,
        "resume_id": analysis.resume_id,
        "overall_score": analysis.overall_score,
        "category_scores": json.loads(analysis.category_scores) if analysis.category_scores else {},
        "category_feedback": json.loads(analysis.category_feedback) if analysis.category_feedback else {},
        "priority_fixes": json.loads(analysis.priority_fixes) if analysis.priority_fixes else [],
        "created_at": analysis.created_at.isoformat() if analysis.created_at else None,
    }


@router.get("")
def list_analyses(
    x_session_token: str | None = Header(default=None, alias=SESSION_TOKEN_HEADER),
    db: Session = Depends(get_db),
):
    if not x_session_token or not x_session_token.strip():
        raise HTTPException(status_code=401, detail=f"A session token ({SESSION_TOKEN_HEADER} header) is required")
    token_hash = hash_session_token(x_session_token.strip())
    analyses = (
        db.query(Analysis)
        .join(Resume, Analysis.resume_id == Resume.id)
        .filter(Resume.owner_token_hash == token_hash)
        .order_by(Analysis.created_at.desc())
        .limit(50)
        .all()
    )
    return [{"id": a.id, "resume_id": a.resume_id, "overall_score": a.overall_score, "created_at": a.created_at.isoformat() if a.created_at else None} for a in analyses]
