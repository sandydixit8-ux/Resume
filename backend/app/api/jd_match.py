import json
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.resume import Resume
from app.models.analysis import JDAnalysis
from app.services.jd_matcher import JDMatcherService
from app.api.deps import SESSION_TOKEN_HEADER, require_owner

router = APIRouter(tags=["JD Match"])


@router.post("/{resume_id}")
def match_resume_to_jd(
    resume_id: int,
    request: dict,
    x_session_token: str | None = Header(default=None, alias=SESSION_TOKEN_HEADER),
    db: Session = Depends(get_db),
):
    resume = require_owner(db, resume_id, x_session_token)
    jd_text = request.get("jd_text", "")
    jd_title = request.get("jd_title", "")
    jd_company = request.get("jd_company", "")
    if not jd_text.strip():
        raise HTTPException(status_code=400, detail="Job description text is required")
    parsed_json = json.loads(resume.parsed_json) if resume.parsed_json else {}
    jd_extracted = JDMatcherService.extract_keywords(jd_text)
    match_result = JDMatcherService.compute_match(parsed_json, jd_extracted, resume.raw_text, jd_text)
    db_jd = JDAnalysis(
        resume_id=resume_id,
        jd_text=jd_text,
        jd_title=jd_title or None,
        jd_company=jd_company or None,
        match_score=match_result["match_score"],
        matched_keywords=json.dumps(match_result["matched_keywords"]),
        missing_keywords=json.dumps(match_result["missing_keywords"]),
        hard_requirements=json.dumps(match_result["hard_requirements"]),
        nice_to_have=json.dumps(match_result["nice_to_have"]),
        semantic_gaps=json.dumps(match_result["semantic_gaps"]),
        over_indexed=json.dumps(match_result["over_indexed"]),
        raw_extracted=json.dumps(match_result["raw_extracted"]),
    )
    db.add(db_jd)
    db.commit()
    db.refresh(db_jd)
    return {
        "id": db_jd.id,
        "resume_id": db_jd.resume_id,
        "jd_text": db_jd.jd_text,
        "jd_title": db_jd.jd_title,
        "jd_company": db_jd.jd_company,
        "match_score": db_jd.match_score,
        "matched_keywords": json.loads(db_jd.matched_keywords) if db_jd.matched_keywords else [],
        "missing_keywords": json.loads(db_jd.missing_keywords) if db_jd.missing_keywords else [],
        "hard_requirements": json.loads(db_jd.hard_requirements) if db_jd.hard_requirements else [],
        "nice_to_have": json.loads(db_jd.nice_to_have) if db_jd.nice_to_have else [],
        "semantic_gaps": json.loads(db_jd.semantic_gaps) if db_jd.semantic_gaps else [],
        "over_indexed": json.loads(db_jd.over_indexed) if db_jd.over_indexed else [],
        "created_at": db_jd.created_at.isoformat() if db_jd.created_at else None,
    }


@router.get("/{resume_id}")
def list_jd_matches(
    resume_id: int,
    x_session_token: str | None = Header(default=None, alias=SESSION_TOKEN_HEADER),
    db: Session = Depends(get_db),
):
    require_owner(db, resume_id, x_session_token)
    matches = db.query(JDAnalysis).filter(JDAnalysis.resume_id == resume_id).order_by(JDAnalysis.created_at.desc()).all()
    return [{"id": m.id, "resume_id": m.resume_id, "jd_title": m.jd_title, "jd_company": m.jd_company, "match_score": m.match_score, "created_at": m.created_at.isoformat() if m.created_at else None} for m in matches]


@router.get("/detail/{jd_id}")
def get_jd_match_detail(
    jd_id: int,
    x_session_token: str | None = Header(default=None, alias=SESSION_TOKEN_HEADER),
    db: Session = Depends(get_db),
):
    match = db.query(JDAnalysis).filter(JDAnalysis.id == jd_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="JD match not found")
    require_owner(db, match.resume_id, x_session_token)
    return {
        "id": match.id,
        "resume_id": match.resume_id,
        "jd_text": match.jd_text,
        "jd_title": match.jd_title,
        "jd_company": match.jd_company,
        "match_score": match.match_score,
        "matched_keywords": json.loads(match.matched_keywords) if match.matched_keywords else [],
        "missing_keywords": json.loads(match.missing_keywords) if match.missing_keywords else [],
        "hard_requirements": json.loads(match.hard_requirements) if match.hard_requirements else [],
        "nice_to_have": json.loads(match.nice_to_have) if match.nice_to_have else [],
        "semantic_gaps": json.loads(match.semantic_gaps) if match.semantic_gaps else [],
        "over_indexed": json.loads(match.over_indexed) if match.over_indexed else [],
        "created_at": match.created_at.isoformat() if match.created_at else None,
    }
