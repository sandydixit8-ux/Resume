"""Dashboard summary, programme coverage and activity feed."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    AccessRequest,
    ActivityItem,
    ModelExecution,
    Programme,
    Project,
    User,
)
from ..schemas import ActivityOut, DashboardSummary, ProgrammeOut
from ..security import CurrentUser

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

Db = Annotated[Session, Depends(get_db)]


@router.get("/summary", response_model=DashboardSummary)
def summary(db: Db, user: CurrentUser) -> DashboardSummary:
    datasets_indexed = db.query(func.coalesce(func.sum(Programme.record_count), 0)).scalar()

    active_projects = (
        db.query(Project)
        .filter(Project.status.notin_(["Completed", "closed"]))
        .count()
    )
    ml_running = db.query(ModelExecution).filter(ModelExecution.status == "running").count()
    ml_queued = db.query(ModelExecution).filter(ModelExecution.status == "queued").count()
    pending = db.query(AccessRequest).filter(AccessRequest.status == "pending").count()

    return DashboardSummary(
        datasets_indexed=datasets_indexed or 0,
        datasets_weekly_delta=312,
        active_projects=active_projects,
        projects_new=4,
        ml_running=ml_running,
        ml_queued=ml_queued,
        pending_requests=pending,
        requests_awaiting=5,
    )


@router.get("/coverage", response_model=list[ProgrammeOut])
def coverage(db: Db, user: CurrentUser) -> list[ProgrammeOut]:
    return db.query(Programme).order_by(Programme.record_count.desc()).all()


@router.get("/activity", response_model=list[ActivityOut])
def activity(
    db: Db,
    user: CurrentUser,
    limit: int = Query(default=8, ge=1, le=50),
) -> list[ActivityOut]:
    return (
        db.query(ActivityItem)
        .order_by(ActivityItem.id.desc())
        .limit(limit)
        .all()
    )
