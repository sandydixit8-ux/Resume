"""Admin auth hardening tests: signed tokens, rate limiting, endpoint auth."""

import base64

from tests.conftest import auth_headers


def test_login_success(client):
    r = client.post(
        "/api/v1/admin/login", json={"username": "admin", "password": "admin123"}
    )
    assert r.status_code == 200
    data = r.json()
    assert "token" in data
    assert data["expires_in"] == 28800


def test_login_wrong_password(client):
    r = client.post(
        "/api/v1/admin/login", json={"username": "admin", "password": "wrong"}
    )
    assert r.status_code == 401


def test_login_sql_injection(client):
    r = client.post(
        "/api/v1/admin/login", json={"username": "admin' OR '1'='1", "password": "x"}
    )
    assert r.status_code == 401


def test_login_rate_limited(client):
    for _ in range(5):
        client.post("/api/v1/admin/login", json={"username": "admin", "password": "wrong"})
    r = client.post(
        "/api/v1/admin/login", json={"username": "admin", "password": "admin123"}
    )
    assert r.status_code == 429


def test_admin_stats_with_token(client):
    r = client.get("/api/v1/admin/stats", headers=auth_headers(client))
    assert r.status_code == 200
    assert "total_visits" in r.json()


def test_admin_financials_with_token(client):
    r = client.get("/api/v1/admin/financials", headers=auth_headers(client))
    assert r.status_code == 200
    data = r.json()
    assert "mrr" in data
    assert "plan_breakdown" in data


def test_admin_endpoints_reject_no_token(client):
    assert client.get("/api/v1/admin/stats").status_code == 401
    assert client.get("/api/v1/admin/financials").status_code == 401


def test_admin_rejects_old_style_token(client):
    old = base64.b64encode(b"admin:admin123").decode()
    r = client.get("/api/v1/admin/stats", headers={"Authorization": f"Bearer {old}"})
    assert r.status_code == 401


def test_admin_rejects_garbage_token(client):
    r = client.get(
        "/api/v1/admin/stats", headers={"Authorization": "Bearer not-a-real-token"}
    )
    assert r.status_code == 401


def test_forgot_password_returns_404_when_email_unset(client):
    r = client.post("/api/v1/admin/forgot-password", json={"email": "admin@example.com"})
    assert r.status_code == 404


def test_reset_password_missing_fields(client):
    r = client.post("/api/v1/admin/reset-password", json={})
    assert r.status_code == 400


def test_password_hashing_is_pbkdf2_salted(client):
    from app.api.admin import _hash_password, _verify_password

    h = _hash_password("secret")
    assert h.startswith("pbkdf2$")
    assert h != _hash_password("secret")  # salted, so no two hashes equal
    assert _verify_password("secret", h)
    assert not _verify_password("wrong", h)
    assert not _verify_password("secret", "plaintext-legacy")
