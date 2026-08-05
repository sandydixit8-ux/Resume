"""Dataset catalogue: search/filter, detail and access requests."""
from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AccessRequest, Dataset, Programme, User
from ..schemas import (
    AccessRequestCreate,
    AccessRequestOut,
    DatasetListResponse,
    DatasetOut,
    ProgrammeOut,
)
from ..security import CurrentUser, require_roles

router = APIRouter(prefix="/datasets", tags=["catalogue"])

programmes_router = APIRouter(prefix="/programmes", tags=["catalogue"])

Db = Annotated[Session, Depends(get_db)]


@programmes_router.get("", response_model=list[ProgrammeOut])
def list_programmes(db: Db, user: CurrentUser) -> list[Programme]:
    return db.query(Programme).order_by(Programme.record_count.desc()).all()


@router.get("", response_model=DatasetListResponse)
def list_datasets(
    db: Db,
    user: CurrentUser,
    q: str = "",
    programme: str = "",
    data_type: str = "",
    access_level: str = "",
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> DatasetListResponse:
    query = db.query(Dataset)
    if q:
        like = f"%{q.lower()}%"
        query = query.filter(
            or_(
                Dataset.name.ilike(like),
                Dataset.coverage.ilike(like),
                Dataset.description.ilike(like),
            )
        )
    if programme:
        programmes = [p.strip() for p in programme.split(",") if p.strip()]
        if programmes:
            query = query.filter(Dataset.programme.in_(programmes))
    if data_type:
        query = query.filter(Dataset.data_type == data_type)
    if access_level:
        query = query.filter(Dataset.access_level.ilike(f"%{access_level}%"))

    total = query.count()
    items = query.order_by(Dataset.updated_at.desc()).offset(offset).limit(limit).all()
    return DatasetListResponse(total=total, limit=limit, offset=offset, items=items)


@router.get("/{dataset_id}", response_model=DatasetOut)
def get_dataset(dataset_id: int, db: Db, user: CurrentUser) -> Dataset:
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset


@router.post("/{dataset_id}/request-access", response_model=AccessRequestOut)
def request_access(
    dataset_id: int,
    body: AccessRequestCreate,
    db: Db,
    user: CurrentUser,
) -> AccessRequest:
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    existing = (
        db.query(AccessRequest)
        .filter(
            AccessRequest.dataset_id == dataset_id,
            AccessRequest.requester_id == user.id,
            AccessRequest.status == "pending",
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A pending access request already exists for this dataset",
        )

    request = AccessRequest(
        dataset_id=dataset_id,
        requester_id=user.id,
        purpose=body.purpose,
        status="pending",
        requested_at=datetime.utcnow(),
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return AccessRequestOut.from_request(request)


@router.get("/{dataset_id}/access-requests", response_model=list[AccessRequestOut])
def dataset_access_requests(
    dataset_id: int,
    db: Db,
    user: Annotated[User, Depends(require_roles("Administrator"))],
) -> list[AccessRequestOut]:
    rows = (
        db.query(AccessRequest)
        .filter(AccessRequest.dataset_id == dataset_id)
        .order_by(AccessRequest.requested_at.desc())
        .all()
    )
    return [AccessRequestOut.from_request(r) for r in rows]
