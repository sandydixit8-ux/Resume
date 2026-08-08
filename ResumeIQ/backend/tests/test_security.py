"""Health, CORS origin enforcement, and security-relevant behavior."""


def test_health_ok(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["version"] == "1.0.0"


def test_cors_allowed_origin(client):
    r = client.get("/api/v1/health", headers={"Origin": "http://localhost:3000"})
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_cors_second_allowed_origin(client):
    r = client.get("/api/v1/health", headers={"Origin": "http://127.0.0.1:3000"})
    assert r.headers.get("access-control-allow-origin") == "http://127.0.0.1:3000"


def test_cors_evil_origin_blocked(client):
    r = client.get("/api/v1/health", headers={"Origin": "http://evil.com"})
    assert r.headers.get("access-control-allow-origin") is None


def test_cors_no_origin_ok(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200


def test_unknown_api_route_404(client):
    assert client.get("/api/v1/does-not-exist").status_code == 404


def test_resume_access_without_session_token_rejected(client):
    r = client.post(
        "/api/v1/resume/paste",
        data={"text": "Private resume of a stranger", "filename": "x.txt"},
    )
    assert r.status_code == 200
    rid = r.json()["id"]
    assert client.get(f"/api/v1/resume/{rid}").status_code == 401
    assert client.delete(f"/api/v1/resume/{rid}").status_code == 401
    assert client.get("/api/v1/resume/").status_code == 401
    assert client.post(f"/api/v1/analyze/{rid}").status_code == 401
    assert client.post(f"/api/v1/ai/achievements/{rid}", json={}).status_code == 401
    client.delete(f"/api/v1/resume/{rid}", headers={"X-Session-Token": r.json()["session_token"]})


def test_resume_access_with_wrong_session_token_forbidden(client):
    created = client.post(
        "/api/v1/resume/paste",
        data={"text": "Owner-only resume", "filename": "x.txt"},
        headers={"X-Session-Token": "owner-token-a"},
    )
    assert created.status_code == 200
    rid = created.json()["id"]
    assert client.get(f"/api/v1/resume/{rid}", headers={"X-Session-Token": "other-token-b"}).status_code == 403
    assert client.post(f"/api/v1/analyze/{rid}", headers={"X-Session-Token": "other-token-b"}).status_code == 403
    assert client.post(f"/api/v1/export", json={"format": "pdf", "resume_id": rid}, headers={"X-Session-Token": "other-token-b"}).status_code == 403
    client.delete(f"/api/v1/resume/{rid}", headers={"X-Session-Token": "owner-token-a"})


def test_list_only_returns_owned_resumes(client):
    mine = client.post(
        "/api/v1/resume/paste",
        data={"text": "My resume A", "filename": "a.txt"},
        headers={"X-Session-Token": "list-owner"},
    ).json()["id"]
    client.post(
        "/api/v1/resume/paste",
        data={"text": "Someone else's resume", "filename": "b.txt"},
        headers={"X-Session-Token": "list-stranger"},
    )
    listed = client.get("/api/v1/resume/", headers={"X-Session-Token": "list-owner"}).json()
    ids = [r["id"] for r in listed]
    assert mine in ids
    assert all(client.get(f"/api/v1/resume/{i}", headers={"X-Session-Token": "list-owner"}).status_code == 200 for i in ids)
    client.delete(f"/api/v1/resume/{mine}", headers={"X-Session-Token": "list-owner"})
