"""GIS layer catalogue, basemaps and overlay geometry endpoints."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from .. import gis_data
from ..security import CurrentUser

router = APIRouter(prefix="/gis", tags=["gis"])


@router.get("/basemaps")
def basemaps(user: CurrentUser) -> dict:
    return {"basemaps": gis_data.BASEMAPS}


@router.get("/layers")
def layers(user: CurrentUser) -> dict:
    return {"layers": gis_data.LAYERS}


@router.get("/layer/{layer_id}/geojson")
def layer_geojson(layer_id: str, user: CurrentUser) -> dict:
    geojson = gis_data.layer_geojson(layer_id)
    if geojson is None:
        raise HTTPException(status_code=404, detail=f"Unknown layer: {layer_id}")
    return geojson
