from tests.conftest import auth_headers


def test_submit_contact_success(client):
    r = client.post(
        "/api/v1/contact",
        json={
            "name": "Jane Doe",
            "email": "jane@company.com",
            "company": "Acme Corp",
            "subject": "Sales Inquiry",
            "message": "We want the recruiter plan for our hiring team.",
        },
    )
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_submit_contact_missing_message(client):
    r = client.post(
        "/api/v1/contact",
        json={"name": "Jane", "email": "jane@company.com", "message": "short"},
    )
    assert r.status_code == 422


def test_submit_contact_invalid_email(client):
    r = client.post(
        "/api/v1/contact",
        json={"name": "Jane", "email": "not-an-email", "message": "This is a sufficiently long message."},
    )
    assert r.status_code == 422


def test_admin_contact_requires_auth(client):
    r = client.get("/api/v1/admin/contact")
    assert r.status_code == 401


def test_admin_contact_lists_and_deletes(client):
    r = client.post(
        "/api/v1/contact",
        json={
            "name": "Acme Buyer",
            "email": "buyer@acme.com",
            "subject": "Partnership",
            "message": "We are interested in a team license for 25 seats.",
        },
    )
    assert r.status_code == 200

    headers = auth_headers(client)
    r = client.get("/api/v1/admin/contact", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["total"] >= 1
    assert any(m["email"] == "buyer@acme.com" for m in data["messages"])

    target = next(m for m in data["messages"] if m["email"] == "buyer@acme.com")
    r = client.delete(f"/api/v1/admin/contact/{target['id']}", headers=headers)
    assert r.status_code == 200
    assert r.json()["deleted"] == target["id"]

    r = client.get("/api/v1/admin/contact", headers=headers)
    assert all(m["id"] != target["id"] for m in r.json()["messages"])


def test_admin_contact_delete_missing(client):
    headers = auth_headers(client)
    r = client.delete("/api/v1/admin/contact/999999", headers=headers)
    assert r.status_code == 404
