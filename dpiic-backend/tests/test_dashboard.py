from .conftest import auth


def test_summary_requires_auth(client):
    assert client.get("/api/dashboard/summary").status_code == 401


def test_summary_matches_seed(client, scientist_token):
    resp = client.get("/api/dashboard/summary", headers=auth(scientist_token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["datasets_indexed"] == 48210
    assert data["active_projects"] == 3
    assert data["ml_running"] == 2
    assert data["ml_queued"] >= 2
    assert data["pending_requests"] >= 1


def test_coverage_programmes(client, scientist_token):
    resp = client.get("/api/dashboard/coverage", headers=auth(scientist_token))
    data = resp.json()
    assert len(data) == 5
    codes = [p["code"] for p in data]
    assert codes[0] == "NGCM"
    assert sum(p["record_count"] for p in data) == 48210


def test_activity_feed(client, scientist_token):
    resp = client.get("/api/dashboard/activity?limit=3", headers=auth(scientist_token))
    data = resp.json()
    assert 1 <= len(data) <= 3
    assert data[0]["text"]
