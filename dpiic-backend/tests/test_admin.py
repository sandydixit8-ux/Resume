from .conftest import auth


def test_admin_requires_admin(client, scientist_token):
    resp = client.get("/api/admin/access-requests", headers=auth(scientist_token))
    assert resp.status_code == 403


def test_pending_requests(client, admin_token):
    resp = client.get("/api/admin/access-requests", headers=auth(admin_token))
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert all(r["status"] == "pending" for r in data)
    assert data[0]["dataset_name"]
    assert data[0]["requester_role"]


def test_approve_request(client, admin_token):
    requests = client.get(
        "/api/admin/access-requests", headers=auth(admin_token)
    ).json()
    rid = requests[0]["id"]
    resp = client.post(
        f"/api/admin/access-requests/{rid}/decision",
        json={"decision": "approve"},
        headers=auth(admin_token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "approved"
    assert resp.json()["decided_by"] == "DPIIC Platform Admin"


def test_deny_request(client, admin_token):
    requests = client.get(
        "/api/admin/access-requests", headers=auth(admin_token)
    ).json()
    rid = requests[-1]["id"]
    resp = client.post(
        f"/api/admin/access-requests/{rid}/decision",
        json={"decision": "deny"},
        headers=auth(admin_token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "denied"


def test_invalid_decision(client, admin_token):
    requests = client.get(
        "/api/admin/access-requests?include_resolved=true", headers=auth(admin_token)
    ).json()
    rid = requests[0]["id"]
    resp = client.post(
        f"/api/admin/access-requests/{rid}/decision",
        json={"decision": "maybe"},
        headers=auth(admin_token),
    )
    assert resp.status_code == 422
