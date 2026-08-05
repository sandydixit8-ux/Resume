from .conftest import auth


def test_list_datasets(client, scientist_token):
    resp = client.get("/api/datasets", headers=auth(scientist_token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 6
    assert data["limit"] == 20
    assert len(data["items"]) == 6


def test_dataset_search_by_programme(client, scientist_token):
    resp = client.get(
        "/api/datasets?programme=NGCM", headers=auth(scientist_token)
    )
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["programme"] == "NGCM"


def test_dataset_search_by_query(client, scientist_token):
    resp = client.get(
        "/api/datasets?q=singhbhum", headers=auth(scientist_token)
    )
    data = resp.json()
    assert data["total"] >= 1
    assert "Singhbhum" in data["items"][0]["name"]


def test_dataset_detail(client, scientist_token):
    listing = client.get("/api/datasets", headers=auth(scientist_token)).json()
    ds_id = listing["items"][0]["id"]
    resp = client.get(f"/api/datasets/{ds_id}", headers=auth(scientist_token))
    assert resp.status_code == 200
    assert resp.json()["id"] == ds_id


def test_dataset_not_found(client, scientist_token):
    assert client.get("/api/datasets/99999", headers=auth(scientist_token)).status_code == 404


def test_request_access_and_duplicate(client, scientist_token):
    listing = client.get("/api/datasets", headers=auth(scientist_token)).json()
    ds_id = listing["items"][0]["id"]
    resp = client.post(
        f"/api/datasets/{ds_id}/request-access",
        json={"purpose": "Testing"},
        headers=auth(scientist_token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "pending"

    dup = client.post(
        f"/api/datasets/{ds_id}/request-access",
        json={"purpose": "Again"},
        headers=auth(scientist_token),
    )
    assert dup.status_code == 409


def test_programmes_list(client, scientist_token):
    resp = client.get("/api/programmes", headers=auth(scientist_token))
    assert resp.status_code == 200
    assert len(resp.json()) == 5
