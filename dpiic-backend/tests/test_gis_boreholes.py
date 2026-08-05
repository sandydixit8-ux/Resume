from .conftest import auth


def test_gis_basemaps(client, scientist_token):
    resp = client.get("/api/gis/basemaps", headers=auth(scientist_token))
    assert resp.status_code == 200
    assert set(resp.json()["basemaps"].keys()) >= {"streets", "osm", "satellite", "terrain"}


def test_gis_layers(client, scientist_token):
    resp = client.get("/api/gis/layers", headers=auth(scientist_token))
    layers = resp.json()["layers"]
    assert len(layers) == 5
    ids = [l["id"] for l in layers]
    assert "layer-geo" in ids and "layer-prospect" in ids


def test_gis_geojson(client, scientist_token):
    for layer_id in ("layer-geo", "layer-fault", "layer-mag", "layer-prospect", "layer-points"):
        resp = client.get(f"/api/gis/layer/{layer_id}/geojson", headers=auth(scientist_token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["type"] == "FeatureCollection"
        assert len(data["features"]) > 0


def test_gis_unknown_layer(client, scientist_token):
    resp = client.get("/api/gis/layer/nope/geojson", headers=auth(scientist_token))
    assert resp.status_code == 404


def test_boreholes(client, scientist_token):
    resp = client.get("/api/boreholes", headers=auth(scientist_token))
    assert resp.status_code == 200
    holes = resp.json()
    assert len(holes) == 6
    assert holes[0]["lithology"]
    assert holes[0]["depth_m"] > 0


def test_boreholes_year_filter(client, scientist_token):
    resp = client.get("/api/boreholes?year=2022", headers=auth(scientist_token))
    holes = resp.json()
    assert all(h["year"] <= 2022 for h in holes)
    assert len(holes) == 3
