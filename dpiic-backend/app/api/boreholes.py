"""Borehole data for the 3D subsurface viewer."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Borehole
from ..schemas import BoreholeOut
from ..security import CurrentUser

router = APIRouter(prefix="/boreholes", tags=["boreholes"])

Db = Annotated[Session, Depends(get_db)]


@router.get("", response_model=list[BoreholeOut])
def list_boreholes(
    db: Db,
    user: CurrentUser,
    code: str = "",
    year: int | None = Query(default=None),
) -> list[Borehole]:
    query = db.query(Borehole)
    if code:
        query = query.filter(Borehole.code.ilike(f"%{code}%"))
    if year is not None:
        query = query.filter(Borehole.year <= year)
    return query.order_by(Borehole.code).all()
