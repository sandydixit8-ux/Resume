from .conftest import auth


def test_workflow_stages(client, scientist_token):
    resp = client.get("/api/workflow/stages", headers=auth(scientist_token))
    assert resp.status_code == 200
    stages = resp.json()
    assert len(stages) == 8
    assert stages[0]["num"] == 1
    assert stages[0]["key"] == "acquisition"
    assert len(stages[0]["subtasks"]) >= 1


def test_workflow_stage_detail(client, scientist_token):
    stages = client.get("/api/workflow/stages", headers=auth(scientist_token)).json()
    sid = stages[1]["id"]
    resp = client.get(f"/api/workflow/stages/{sid}", headers=auth(scientist_token))
    assert resp.status_code == 200
    assert resp.json()["id"] == sid


def test_toggle_subtask(client, scientist_token):
    stages = client.get("/api/workflow/stages", headers=auth(scientist_token)).json()
    stage = stages[0]
    subtask = [s for s in stage["subtasks"] if not s["done"]][0]
    resp = client.patch(
        f"/api/workflow/stages/{stage['id']}/subtasks/{subtask['id']}",
        json={"done": True},
        headers=auth(scientist_token),
    )
    assert resp.status_code == 200
    updated = [s for s in resp.json()["subtasks"] if s["id"] == subtask["id"]][0]
    assert updated["done"] is True


def test_workflow_alerts(client, scientist_token):
    resp = client.get("/api/workflow/alerts", headers=auth(scientist_token))
    assert resp.status_code == 200
    assert len(resp.json()) == 3


def test_simulate_requires_admin_role(client, stakeholder_token):
    resp = client.post("/api/workflow/simulate", headers=auth(stakeholder_token))
    assert resp.status_code == 403


def test_simulate_advances_stages(client, scientist_token):
    before = client.get("/api/workflow/stages", headers=auth(scientist_token)).json()
    in_progress = [s for s in before if s["status"] == "In Progress"]
    assert in_progress
    before_progress = {s["id"]: (s["progress"] or 0) for s in before}

    resp = client.post("/api/workflow/simulate", headers=auth(scientist_token))
    assert resp.status_code == 200
    after = resp.json()["stages"]
    for s in after:
        if s["id"] in before_progress and s["status"] == "In Progress":
            assert (s["progress"] or 0) > before_progress[s["id"]], (
                f"stage {s['name']} should advance"
            )
