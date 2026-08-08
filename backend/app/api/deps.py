import hashlib
import hmac
import secrets

from fastapi import Header, HTTPException
from sqlalchemy.orm import Session

from app.models.resume import Resume

SESSION_TOKEN_HEADER = "X-Session-Token"


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def issue_session_token() -> str:
    return secrets.token_urlsafe(32)


def require_owner(db: Session, resume_id: int, token: str | None) -> Resume:
    """Load a resume only if the caller holds its session token.

    Closes the IDOR holes: resumes (and everything keyed off them) are only
    readable/actionable by the session that created them.
    """
    if not token or not token.strip():
        raise HTTPException(status_code=401, detail=f"A session token ({SESSION_TOKEN_HEADER} header) is required")
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    if not resume.owner_token_hash or not hmac.compare_digest(
        resume.owner_token_hash, hash_session_token(token.strip())
    ):
        raise HTTPException(status_code=403, detail="You do not have access to this resume")
    return resume
