"""ORM models for the DPIIC platform.

Covers: users & RBAC, dataset catalogue, access requests, data-management
workflow, MPA model catalogue, AI model executions/outputs, projects,
knowledge items, reports, activity feed, boreholes and programme coverage.
"""
from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.utcnow()


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(160))
    role: Mapped[str] = mapped_column(String(60), index=True)
    department: Mapped[str] = mapped_column(String(160), default="")
    password_hash: Mapped[str] = mapped_column(String(255))
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    tier: Mapped[int] = mapped_column(Integer, default=2)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    access_requests: Mapped[list[AccessRequest]] = relationship(
        back_populates="requester", cascade="all, delete-orphan"
    )


class Programme(Base):
    __tablename__ = "programmes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True)
    name: Mapped[str] = mapped_column(String(160))
    record_count: Mapped[int] = mapped_column(Integer, default=0)
    color: Mapped[str] = mapped_column(String(16), default="#c1793f")


class Dataset(Base):
    __tablename__ = "datasets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    programme: Mapped[str] = mapped_column(String(60), index=True)
    data_type: Mapped[str] = mapped_column(String(40))  # Vector / Raster / Point
    format: Mapped[str] = mapped_column(String(60))
    crs: Mapped[str] = mapped_column(String(60))
    coverage: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text, default="")
    access_level: Mapped[str] = mapped_column(String(60), default="Tier 2 — Approval required")
    status: Mapped[str] = mapped_column(String(30), default="published")
    scale: Mapped[str] = mapped_column(String(30), default="")
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[date] = mapped_column(Date, default=date.today)

    access_requests: Mapped[list[AccessRequest]] = relationship(
        back_populates="dataset", cascade="all, delete-orphan"
    )


class AccessRequest(Base):
    __tablename__ = "access_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    dataset_id: Mapped[int] = mapped_column(ForeignKey("datasets.id"))
    requester_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)  # pending/approved/denied
    purpose: Mapped[str] = mapped_column(Text, default="")
    requested_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    decided_by: Mapped[str] = mapped_column(String(120), default="")

    dataset: Mapped[Dataset] = relationship(back_populates="access_requests")
    requester: Mapped[User] = relationship(back_populates="access_requests")


class WorkflowStage(Base):
    __tablename__ = "workflow_stages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    num: Mapped[int] = mapped_column(Integer)
    key: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    color: Mapped[str] = mapped_column(String(16))
    icon: Mapped[str] = mapped_column(String(8), default="⬆")
    count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(30), default="New", index=True)
    status_color: Mapped[str] = mapped_column(String(16))
    progress: Mapped[float | None] = mapped_column(Float, nullable=True)
    prog_color: Mapped[str | None] = mapped_column(String(16), nullable=True)
    last_label: Mapped[str] = mapped_column(String(60), default="Last Run")
    last_val: Mapped[str] = mapped_column(String(80), default="—")
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    subtasks: Mapped[list[WorkflowSubtask]] = relationship(
        back_populates="stage",
        cascade="all, delete-orphan",
        order_by="WorkflowSubtask.order_index",
    )


class WorkflowSubtask(Base):
    __tablename__ = "workflow_subtasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    stage_id: Mapped[int] = mapped_column(ForeignKey("workflow_stages.id"))
    title: Mapped[str] = mapped_column(String(200))
    done: Mapped[bool] = mapped_column(Boolean, default=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    stage: Mapped[WorkflowStage] = relationship(back_populates="subtasks")


class WorkflowAlert(Base):
    __tablename__ = "workflow_alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    color: Mapped[str] = mapped_column(String(16))
    icon: Mapped[str] = mapped_column(String(8), default="!")
    text: Mapped[str] = mapped_column(String(240))
    time: Mapped[str] = mapped_column(String(60))
    order_index: Mapped[int] = mapped_column(Integer, default=0)


class MpaModel(Base):
    __tablename__ = "mpa_models"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    mineral_system: Mapped[str] = mapped_column(String(60), index=True)
    algorithm: Mapped[str] = mapped_column(String(60), index=True)
    algorithm_display: Mapped[str] = mapped_column(String(80))
    auc: Mapped[float] = mapped_column(Float)
    aoi: Mapped[str] = mapped_column(String(120))
    updated_at: Mapped[date] = mapped_column(Date, default=date.today)
    source: Mapped[str] = mapped_column(Text, default="")
    thumb_idx: Mapped[int] = mapped_column(Integer, default=0)
    featured: Mapped[bool] = mapped_column(Boolean, default=True)


class ModelExecution(Base):
    __tablename__ = "model_executions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    model_ref: Mapped[str] = mapped_column(String(80))
    target: Mapped[str] = mapped_column(String(160))
    status: Mapped[str] = mapped_column(String(20), default="queued", index=True)  # running/queued/completed/failed
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    outputs: Mapped[list[ModelOutput]] = relationship(
        back_populates="execution", cascade="all, delete-orphan"
    )


class ModelOutput(Base):
    __tablename__ = "model_outputs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    execution_id: Mapped[int] = mapped_column(ForeignKey("model_executions.id"))
    title: Mapped[str] = mapped_column(String(200))
    meta: Mapped[str] = mapped_column(String(200), default="")
    kind: Mapped[str] = mapped_column(String(30), default="map")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    execution: Mapped[ModelExecution] = relationship(back_populates="outputs")


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    lead: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(40), default="In progress")
    stage: Mapped[str] = mapped_column(String(120), default="")
    dataset_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class KnowledgeItem(Base):
    __tablename__ = "knowledge_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    item_type: Mapped[str] = mapped_column(String(40), index=True)  # SOP / Research paper / Training video / Technical report
    title: Mapped[str] = mapped_column(String(200))
    summary: Mapped[str] = mapped_column(Text, default="")
    source: Mapped[str] = mapped_column(String(120), default="")
    url: Mapped[str] = mapped_column(String(300), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    source: Mapped[str] = mapped_column(String(200), default="")
    format: Mapped[str] = mapped_column(String(20), default="PDF")
    url: Mapped[str] = mapped_column(String(300), default="")
    generated_at: Mapped[date] = mapped_column(Date, default=date.today)


class ActivityItem(Base):
    __tablename__ = "activity_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    time: Mapped[str] = mapped_column(String(40))
    actor: Mapped[str] = mapped_column(String(160), default="")
    text: Mapped[str] = mapped_column(String(300))
    kind: Mapped[str] = mapped_column(String(30), default="general")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Borehole(Base):
    __tablename__ = "boreholes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True)
    x: Mapped[float] = mapped_column(Float)
    z: Mapped[float] = mapped_column(Float)
    azimuth: Mapped[int] = mapped_column(Integer, default=0)
    dip: Mapped[int] = mapped_column(Integer, default=90)
    depth_m: Mapped[float] = mapped_column(Float)
    year: Mapped[int] = mapped_column(Integer)
    ore: Mapped[str] = mapped_column(String(120), default="")
    recovery: Mapped[float] = mapped_column(Float, default=90.0)
    lithology: Mapped[list] = mapped_column(JSON, default=list)
    assays: Mapped[list] = mapped_column(JSON, default=list)
