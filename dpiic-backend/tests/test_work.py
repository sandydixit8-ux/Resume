from .conftest import auth


def test_projects(client, scientist_token):
    resp = client.get("/api/projects", headers=auth(scientist_token))
    assert resp.status_code == 200
    assert len(resp.json()) == 3


def test_create_project(client, scientist_token):
    resp = client.post(
        "/api/projects",
        json={"name": "Test Project", "lead": "Dr. R. Iyer", "stage": "Intake"},
        headers=auth(scientist_token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Test Project"
    assert data["status"] == "In progress"

    detail = client.get(f"/api/projects/{data['id']}", headers=auth(scientist_token))
    assert detail.status_code == 200


def test_knowledge_list_and_filter(client, scientist_token):
    resp = client.get("/api/knowledge", headers=auth(scientist_token))
    data = resp.json()
    assert len(data) == 6

    sop = client.get("/api/knowledge?item_type=SOP", headers=auth(scientist_token)).json()
    assert len(sop) == 2
    assert all(k["item_type"] == "SOP" for k in sop)


def test_create_knowledge(client, scientist_token):
    resp = client.post(
        "/api/knowledge",
        json={
            "item_type": "SOP",
            "title": "Test SOP",
            "summary": "A test entry",
            "source": "Tests",
        },
        headers=auth(scientist_token),
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Test SOP"


def test_reports(client, scientist_token):
    resp = client.get("/api/reports", headers=auth(scientist_token))
    assert resp.status_code == 200
    assert len(resp.json()) == 3


def test_generate_report(client, scientist_token):
    resp = client.post(
        "/api/reports/generate",
        json={"title": "Q3 Summary", "source": "Unit test"},
        headers=auth(scientist_token),
    )
    assert resp.status_code == 200
    assert resp.json()["format"] == "PDF"
