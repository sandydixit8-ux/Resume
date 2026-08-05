"""Administration: RBAC access-request review."""
from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AccessRequest, User
from ..schemas import AccessRequestOut
from ..security import CurrentUser, require_roles

router = APIRouter(prefix="/admin", tags=["admin"])

Db = Annotated[Session, Depends(get_db)]


class DecisionRequest(BaseModel):
    decision: str  # approve | deny


@router.get("/access-requests", response_model=list[AccessRequestOut])
def pending_requests(
    db: Db,
    user: Annotated[User, Depends(require_roles("Administrator"))],
    include_resolved: bool = False,
) -> list[AccessRequestOut]:
    query = db.query(AccessRequest)
    if not include_resolved:
        query = query.filter(AccessRequest.status == "pending")
    rows = query.order_by(AccessRequest.requested_at.desc()).all()
    return [AccessRequestOut.from_request(r) for r in rows]


@router.post("/access-requests/{request_id}/decision", response_model=AccessRequestOut)
def decide_request(
    request_id: int,
    body: DecisionRequest,
    db: Db,
    user: Annotated[User, Depends(require_roles("Administrator"))],
) -> AccessRequestOut:
    request = db.get(AccessRequest, request_id)
    if request is None:
        raise HTTPException(status_code=404, detail="Access request not found")

    if body.decision not in ("approve", "deny"):
        raise HTTPException(status_code=422, detail="decision must be 'approve' or 'deny'")

    request.status = "approved" if body.decision == "approve" else "denied"
    request.decided_at = datetime.utcnow()
    request.decided_by = user.full_name
    db.commit()
    db.refresh(request)
    return AccessRequestOut.from_request(request)

