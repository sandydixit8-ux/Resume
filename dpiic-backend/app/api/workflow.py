"""Data Management Workflow: stages, subtasks, alerts and pipeline simulation."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, WorkflowAlert, WorkflowStage, WorkflowSubtask
from ..schemas import AlertOut, SubtaskUpdate, WorkflowStageOut
from ..security import CurrentUser, require_roles

router = APIRouter(prefix="/workflow", tags=["workflow"])
Db = Annotated[Session, Depends(get_db)]


def _stage_out(stage: WorkflowStage) -> WorkflowStageOut:
    return WorkflowStageOut(
        id=stage.id,
        num=stage.num,
        key=stage.key,
        name=stage.name,
        description=stage.description,
        color=stage.color,
        icon=stage.icon,
        count=stage.count,
        status=stage.status,
        status_color=stage.status_color,
        progress=stage.progress,
        prog_color=stage.prog_color,
        last_label=stage.last_label,
        last_val=stage.last_val,
        subtasks=stage.subtasks,
    )


@router.get("/stages", response_model=list[WorkflowStageOut])
def stages(db: Db, user: CurrentUser) -> list[WorkflowStageOut]:
    rows = db.query(WorkflowStage).order_by(WorkflowStage.order_index).all()
    return [_stage_out(s) for s in rows]


@router.get("/stages/{stage_id}", response_model=WorkflowStageOut)
def stage_detail(stage_id: int, db: Db, user: CurrentUser) -> WorkflowStageOut:
    stage = db.get(WorkflowStage, stage_id)
    if stage is None:
        raise HTTPException(status_code=404, detail="Stage not found")
    return _stage_out(stage)


@router.patch("/stages/{stage_id}/subtasks/{subtask_id}", response_model=WorkflowStageOut)
def update_subtask(
    stage_id: int,
    subtask_id: int,
    body: SubtaskUpdate,
    db: Db,
    user: CurrentUser,
) -> WorkflowStageOut:
    subtask = db.get(WorkflowSubtask, subtask_id)
    if subtask is None or subtask.stage_id != stage_id:
        raise HTTPException(status_code=404, detail="Subtask not found")
    subtask.done = body.done
    db.commit()
    return _stage_out(db.get(WorkflowStage, stage_id))


@router.get("/alerts", response_model=list[AlertOut])
def alerts(db: Db, user: CurrentUser) -> list[WorkflowAlert]:
    return db.query(WorkflowAlert).order_by(WorkflowAlert.order_index).all()


@router.post("/simulate", response_model=dict)
def simulate_run(
    db: Db,
    user: Annotated[User, Depends(require_roles("Administrator", "GSI Scientist"))],
) -> dict:
    """Advance in-progress stages toward completion (prototype pipeline run)."""
    targets = (
        db.query(WorkflowStage)
        .filter(WorkflowStage.status == "In Progress")
        .all()
    )
    for stage in targets:
        if stage.progress is not None and stage.progress < 100:
            stage.progress = round(stage.progress + (100 - stage.progress) * 0.4)
        if stage.progress is not None and stage.progress >= 100:
            stage.progress = 100.0
            stage.status = "Completed"
            stage.status_color = "#5f9e79"
            stage.prog_color = "#5f9e79"
            stage.last_val = "Just now"
        for sub in stage.subtasks:
            sub.done = True

    db.commit()
    return {
        "message": f"Simulation advanced {len(targets)} in-progress stage(s).",
        "stages": [_stage_out(s) for s in db.query(WorkflowStage).order_by(WorkflowStage.order_index).all()],
    }
