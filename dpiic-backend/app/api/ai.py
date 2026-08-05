"""AI/ML model dashboard + Mineral Prospectivity Analysis (MPA) catalog."""
from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import MpaModel, ModelExecution, ModelOutput
from ..schemas import (
    AiSummary,
    ExecutionOut,
    ModelRunRequest,
    ModelRunResponse,
    MpaModelOut,
    OutputOut,
)
from ..security import CurrentUser, require_roles

router = APIRouter(tags=["ai"])

Db = Annotated[Session, Depends(get_db)]


# ---------- model executions ----------
@router.get("/ai/executions", response_model=list[ExecutionOut])
def executions(db: Db, user: CurrentUser) -> list[ModelExecution]:
    return db.query(ModelExecution).order_by(ModelExecution.id.desc()).all()


@router.get("/ai/summary", response_model=AiSummary)
def ai_summary(db: Db, user: CurrentUser) -> AiSummary:
    rows = db.query(ModelExecution.status, ModelExecution.id).all()
    counts = {"running": 0, "queued": 0, "completed": 0, "failed": 0}
    for status, _ in rows:
        counts[status] = counts.get(status, 0) + 1
    return AiSummary(**counts)


@router.get("/ai/outputs", response_model=list[OutputOut])
def outputs(
    db: Db,
    user: CurrentUser,
    execution_id: int | None = Query(default=None),
) -> list[ModelOutput]:
    query = db.query(ModelOutput)
    if execution_id is not None:
        query = query.filter(ModelOutput.execution_id == execution_id)
    return query.order_by(ModelOutput.id.desc()).all()


# ---------- MPA catalog ----------
@router.get("/mpa/models", response_model=list[MpaModelOut])
def list_mpa_models(
    db: Db,
    user: CurrentUser,
    mineral: str = "",
    algorithm: str = "",
    q: str = "",
) -> list[MpaModel]:
    query = db.query(MpaModel)
    if mineral:
        minerals = [m.strip() for m in mineral.split(",") if m.strip()]
        if minerals:
            query = query.filter(MpaModel.mineral_system.in_(minerals))
    if algorithm:
        algos = [a.strip() for a in algorithm.split(",") if a.strip()]
        if algos:
            query = query.filter(MpaModel.algorithm.in_(algos))
    if q:
        like = f"%{q.lower()}%"
        query = query.filter(
            or_(MpaModel.name.ilike(like), MpaModel.aoi.ilike(like))
        )
    return query.order_by(MpaModel.auc.desc()).all()


@router.get("/mpa/models/{model_id}", response_model=MpaModelOut)
def mpa_model_detail(model_id: int, db: Db, user: CurrentUser) -> MpaModel:
    model = db.get(MpaModel, model_id)
    if model is None:
        raise HTTPException(status_code=404, detail="MPA model not found")
    return model


@router.post(
    "/mpa/models/{model_id}/run",
    response_model=ModelRunResponse,
    dependencies=[Depends(require_roles("Administrator", "GSI Scientist"))],
)
def run_mpa_model(
    model_id: int,
    body: ModelRunRequest,
    db: Db,
) -> ModelRunResponse:
    model = db.get(MpaModel, model_id)
    if model is None:
        raise HTTPException(status_code=404, detail="MPA model not found")

    execution = ModelExecution(
        name=f"MPA-{model_id:02d}",
        model_ref=f"mpa-{model_id:02d}",
        target=body.target or model.aoi,
        status="queued",
        progress=0.0,
        started_at=None,
    )
    db.add(execution)
    db.commit()
    db.refresh(execution)
    return ModelRunResponse(execution=ExecutionOut.model_validate(execution))
