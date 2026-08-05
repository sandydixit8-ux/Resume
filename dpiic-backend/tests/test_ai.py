from .conftest import auth


def test_mpa_models(client, scientist_token):
    resp = client.get("/api/mpa/models", headers=auth(scientist_token))
    assert resp.status_code == 200
    models = resp.json()
    assert len(models) == 6
    assert models[0]["auc"] >= models[-1]["auc"]  # sorted desc by AUC


def test_mpa_filter_by_mineral(client, scientist_token):
    resp = client.get(
        "/api/mpa/models?mineral=orogenic-gold", headers=auth(scientist_token)
    )
    data = resp.json()
    assert len(data) == 1
    assert data[0]["algorithm"] == "cnn"


def test_mpa_filter_by_algorithm(client, scientist_token):
    resp = client.get(
        "/api/mpa/models?algorithm=rf", headers=auth(scientist_token)
    )
    data = resp.json()
    assert all(m["algorithm"] == "rf" for m in data)


def test_mpa_search(client, scientist_token):
    resp = client.get("/api/mpa/models?q=bastar", headers=auth(scientist_token))
    assert len(resp.json()) >= 1


def test_mpa_detail(client, scientist_token):
    models = client.get("/api/mpa/models", headers=auth(scientist_token)).json()
    mid = models[0]["id"]
    resp = client.get(f"/api/mpa/models/{mid}", headers=auth(scientist_token))
    assert resp.status_code == 200
    assert resp.json()["id"] == mid


def test_run_mpa_model(client, scientist_token):
    models = client.get("/api/mpa/models", headers=auth(scientist_token)).json()
    mid = models[0]["id"]
    resp = client.post(
        f"/api/mpa/models/{mid}/run",
        json={"target": "Bastar Craton AOI"},
        headers=auth(scientist_token),
    )
    assert resp.status_code == 200
    assert resp.json()["execution"]["status"] == "queued"


def test_run_mpa_denied_for_stakeholder(client, stakeholder_token):
    models = client.get("/api/mpa/models", headers=auth(stakeholder_token)).json()
    mid = models[0]["id"]
    resp = client.post(
        f"/api/mpa/models/{mid}/run",
        json={},
        headers=auth(stakeholder_token),
    )
    assert resp.status_code == 403


def test_executions_and_summary(client, scientist_token):
    execs = client.get("/api/ai/executions", headers=auth(scientist_token)).json()
    assert len(execs) >= 5
    summary = client.get("/api/ai/summary", headers=auth(scientist_token)).json()
    assert summary["running"] == 2
    assert summary["queued"] >= 2
    assert summary["completed"] == 1


def test_outputs(client, scientist_token):
    outputs = client.get("/api/ai/outputs", headers=auth(scientist_token)).json()
    titles = {o["title"] for o in outputs}
    assert len(outputs) == 4
    assert "Prospectivity Index Map" in titles
    assert "Exploration Recommendation Report" in titles
