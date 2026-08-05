"""Static GIS layer catalogue and overlay geometries for the map viewer.

The geometries mirror the placeholder overlays rendered by the frontend
prototype (lithology boundaries, faults, magnetic anomalies, prospectivity
zones and sample points) over the Chhattisgarh–Odisha belt.
"""
from __future__ import annotations

from typing import Any

BASEMAPS = {
    "streets": {
        "tiles": [
            "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
            "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
            "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
        ],
        "attribution": "© OpenStreetMap contributors © CARTO",
        "tile_size": 256,
        "maxzoom": 20,
    },
    "osm": {
        "tiles": [
            "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
            "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
            "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
        ],
        "attribution": "© OpenStreetMap contributors",
        "tile_size": 256,
        "maxzoom": 19,
    },
    "satellite": {
        "tiles": [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        ],
        "attribution": "Imagery © Esri, Maxar, Earthstar Geographics",
        "tile_size": 256,
        "maxzoom": 19,
    },
    "terrain": {
        "tiles": [
            "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
            "https://b.tile.opentopomap.org/{z}/{x}/{y}.png",
            "https://c.tile.opentopomap.org/{z}/{x}/{y}.png",
        ],
        "attribution": "© OpenStreetMap contributors, SRTM · © OpenTopoMap (CC-BY-SA)",
        "tile_size": 256,
        "maxzoom": 17,
    },
}

GEO_LITHO_LINES = [
    [[80.3, 22.33], [80.95, 22.61], [81.45, 21.9], [82.2, 22.26], [83.45, 22.47], [84.1, 22.04]],
    [[80.3, 21.61], [81.1, 21.9], [81.7, 21.33], [82.5, 21.61], [83.6, 21.76], [84.1, 21.33]],
    [[80.3, 20.9], [81.0, 21.19], [81.8, 20.61], [82.6, 20.97], [83.7, 21.04], [84.1, 20.61]],
    [[80.3, 20.19], [81.1, 20.47], [81.8, 19.9], [82.7, 20.26], [83.7, 20.33], [84.1, 19.9]],
    [[80.3, 19.54], [81.2, 19.76], [81.9, 19.33], [82.8, 19.61], [83.7, 19.69], [84.1, 19.33]],
]

FAULT_LINES = [
    [[80.8, 22.76], [82.6, 19.04]],
    [[83.2, 22.76], [81.5, 19.04]],
]

MAG_ANOMALIES = [
    {"center": [81.5, 21.33], "radius": 60, "color": "#c1793f"},
    {"center": [82.8, 20.47], "radius": 75, "color": "#4fa8a3"},
]

PROSPECT_ZONES = [
    {"center": [81.7, 21.47], "radius": 32, "color": "#c1793f"},
    {"center": [82.9, 20.33], "radius": 42, "color": "#e0a458"},
    {"center": [81.1, 20.04], "radius": 24, "color": "#5f9e79"},
]

SAMPLE_POINTS = [
    [81.4, 21.76], [81.75, 21.26], [82.25, 21.9],
    [82.7, 20.76], [83.2, 20.19], [81.1, 20.19],
]


def _line(coords: list[list[float]]) -> dict[str, Any]:
    return {"type": "Feature", "geometry": {"type": "LineString", "coordinates": coords}}


def _point(coords: list[float], color: str) -> dict[str, Any]:
    return {
        "type": "Feature",
        "properties": {"color": color},
        "geometry": {"type": "Point", "coordinates": coords},
    }


def _fc(features: list[dict[str, Any]]) -> dict[str, Any]:
    return {"type": "FeatureCollection", "features": features}


def layer_geojson(layer_id: str) -> dict[str, Any] | None:
    if layer_id == "layer-geo":
        return _fc([_line(c) for c in GEO_LITHO_LINES])
    if layer_id == "layer-fault":
        return _fc([_line(c) for c in FAULT_LINES])
    if layer_id == "layer-mag":
        return _fc([_point(m["center"], m["color"]) for m in MAG_ANOMALIES])
    if layer_id == "layer-prospect":
        return _fc([_point(p["center"], p["color"]) for p in PROSPECT_ZONES])
    if layer_id == "layer-points":
        return _fc([_point(c, "#eceee8") for c in SAMPLE_POINTS])
    return None


LAYERS = [
    {"id": "layer-geo", "group": "Geological", "name": "Lithology boundaries", "type": "line", "color": "#4fa8a3", "visible_default": True, "opacity_default": 55},
    {"id": "layer-fault", "group": "Geological", "name": "Fault lines", "type": "line", "color": "#e0a458", "visible_default": True, "opacity_default": 80},
    {"id": "layer-mag", "group": "Geophysical", "name": "Magnetic anomaly grid", "type": "circle", "color": "#c1793f", "visible_default": False, "opacity_default": 70},
    {"id": "layer-prospect", "group": "AI Layers", "name": "Prospectivity heat zones", "type": "circle", "color": "#c1793f", "visible_default": True, "opacity_default": 45},
    {"id": "layer-points", "group": "AI Layers", "name": "Sample points", "type": "circle", "color": "#eceee8", "visible_default": False, "opacity_default": 100},
]
