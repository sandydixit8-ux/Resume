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
