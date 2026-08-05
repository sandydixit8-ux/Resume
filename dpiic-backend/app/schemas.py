"""Pydantic response/request schemas."""
from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


# ---------- auth ----------
class LoginRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: str
    full_name: str
    role: str
    department: str
    tier: int
    mfa_enabled: bool


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- dashboard ----------
class ProgrammeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: str
    name: str
    record_count: int
    color: str


class DashboardSummary(BaseModel):
    datasets_indexed: int
    datasets_weekly_delta: int
    active_projects: int
    projects_new: int
    ml_running: int
    ml_queued: int
    pending_requests: int
    requests_awaiting: int


class ActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    time: str
    actor: str
    text: str
    kind: str


# ---------- catalogue ----------
class DatasetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    programme: str
    data_type: str
    format: str
    crs: str
    coverage: str
    description: str
    access_level: str
    status: str
    scale: str
    size_bytes: int
    updated_at: date


class DatasetListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[DatasetOut]


class AccessRequestCreate(BaseModel):
    purpose: str = ""


class AccessRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    dataset_id: int
    dataset_name: str
    requester_id: int
    requester_name: str
    requester_role: str
    status: str
    purpose: str
    requested_at: datetime
    decided_at: datetime | None
    decided_by: str

    @classmethod
    def from_request(cls, req) -> "AccessRequestOut":
        return cls(
            id=req.id,
            dataset_id=req.dataset_id,
            dataset_name=req.dataset.name if req.dataset else "",
            requester_id=req.requester_id,
            requester_name=req.requester.full_name if req.requester else "",
            requester_role=req.requester.role if req.requester else "",
            status=req.status,
            purpose=req.purpose,
            requested_at=req.requested_at,
            decided_at=req.decided_at,
            decided_by=req.decided_by,
        )


# ---------- workflow ----------
class SubtaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    done: bool


class WorkflowStageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    num: int
    key: str
    name: str
    description: str
    color: str
    icon: str
    count: int
    status: str
    status_color: str
    progress: float | None
    prog_color: str | None
    last_label: str
    last_val: str
    subtasks: list[SubtaskOut]


class SubtaskUpdate(BaseModel):
    done: bool


class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    color: str
    icon: str
    text: str
    time: str


# ---------- AI / MPA ----------
class ExecutionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    model_ref: str
    target: str
    status: str
    progress: float
    started_at: datetime | None
    finished_at: datetime | None


class OutputOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    execution_id: int
    title: str
    meta: str
    kind: str
    created_at: datetime


class AiSummary(BaseModel):
    running: int
    queued: int
    completed: int
    failed: int


class MpaModelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    mineral_system: str
    algorithm: str
    algorithm_display: str
    auc: float
    aoi: str
    updated_at: date
    source: str
    thumb_idx: int
    featured: bool


class ModelRunRequest(BaseModel):
    target: str = ""


class ModelRunResponse(BaseModel):
    execution: ExecutionOut
    message: str = "Model queued for execution."


# ---------- workspace ----------
class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    lead: str
    status: str
    stage: str
    dataset_count: int
    updated_at: datetime


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    lead: str = Field(default="", max_length=120)
    stage: str = Field(default="Intake", max_length=120)


# ---------- knowledge ----------
class KnowledgeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    item_type: str
    title: str
    summary: str
    source: str
    url: str
    created_at: datetime


class KnowledgeCreate(BaseModel):
    item_type: str
    title: str = Field(min_length=1, max_length=200)
    summary: str = ""
    source: str = ""
    url: str = ""


# ---------- reports ----------
class ReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    source: str
    format: str
    url: str
    generated_at: date


class ReportCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    source: str = ""
    format: str = "PDF"


# ---------- boreholes ----------
class BoreholeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    x: float
    z: float
    azimuth: int
    dip: int
    depth_m: float
    year: int
    ore: str
    recovery: float
    lithology: list
    assays: list
