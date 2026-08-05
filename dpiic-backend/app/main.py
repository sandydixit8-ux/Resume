"""DPIIC Mineral Intelligence Platform — FastAPI application."""
from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from .config import settings
from .database import SessionLocal, init_db
from .seed import seed

from .api import (
    admin,
    ai,
    auth,
    boreholes,
    catalogue,
    dashboard,
    gis,
    work,
    workflow,
)

PREFIX = settings.api_prefix


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    db: Session = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description=(
        "REST API for the DPIIC mineral intelligence platform: RBAC auth, "
        "dataset catalogue & access requests, data-management workflow, AI/ML "
        "and MPA model catalog, workspace, knowledge hub, reports, GIS layers "
        "and borehole data."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=PREFIX)
app.include_router(dashboard.router, prefix=PREFIX)
app.include_router(catalogue.router, prefix=PREFIX)
app.include_router(catalogue.programmes_router, prefix=PREFIX)
app.include_router(workflow.router, prefix=PREFIX)
app.include_router(ai.router, prefix=PREFIX)
app.include_router(work.router, prefix=PREFIX)
app.include_router(admin.router, prefix=PREFIX)
app.include_router(gis.router, prefix=PREFIX)
app.include_router(boreholes.router, prefix=PREFIX)

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
if STATIC_DIR.is_dir():
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

    @app.get("/", include_in_schema=False)
    def index() -> FileResponse:
        demo = STATIC_DIR / "index.html"
        if demo.is_file():
            return FileResponse(demo)
        return FileResponse(STATIC_DIR / "dpiic-integration.js")


@app.get("/health", tags=["system"])
def health() -> dict:
    return {"status": "ok", "app": settings.app_name, "version": settings.version}


@app.get(PREFIX + "/meta", tags=["system"])
def meta() -> dict:
    return {"name": settings.app_name, "version": settings.version}
