from .conftest import auth, login


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_meta(client):
    resp = client.get("/api/meta")
    assert resp.status_code == 200
    assert "DPIIC" in resp.json()["name"]


def test_login_success(client):
    data = login(client, "scientist")
    assert data["access_token"]
    assert data["user"]["role"] == "GSI Scientist"
    assert data["user"]["tier"] == 5


def test_login_bad_password(client):
    resp = client.post(
        "/api/auth/login",
        json={"user_id": "demo.scientist@dpiic.gov.in", "password": "wrong"},
    )
    assert resp.status_code == 401


def test_login_unknown_user(client):
    resp = client.post(
        "/api/auth/login",
        json={"user_id": "nobody@dpiic.gov.in", "password": "Dpiic@2026"},
    )
    assert resp.status_code == 401


def test_me_requires_token(client):
    assert client.get("/api/auth/me").status_code == 401


def test_me_returns_profile(client, scientist_token):
    resp = client.get("/api/auth/me", headers=auth(scientist_token))
    assert resp.status_code == 200
    assert resp.json()["user_id"] == "demo.scientist@dpiic.gov.in"


def test_roles_endpoint(client):
    resp = client.get("/api/auth/roles")
    assert resp.status_code == 200
    assert "GSI Scientist" in resp.json()["roles"]
