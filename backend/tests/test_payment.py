"""Payment config / checkout / subscription tests (INR, demo mode)."""


def test_payment_config_inr(client):
    r = client.get("/api/v1/payment/config")
    assert r.status_code == 200
    data = r.json()
    assert data["currency"] == "INR"
    assert data["currency_symbol"] == "₹"
    plans = data["plans"]
    assert plans["free"]["price"] == 0
    assert plans["pro"]["price"] == 1900
    assert plans["recruiter"]["price"] == 9900


def test_checkout_invalid_plan(client):
    r = client.post(
        "/api/v1/payment/create-checkout", json={"plan": "hacker", "email": "a@b.com"}
    )
    assert r.status_code == 400


def test_checkout_missing_email(client):
    r = client.post("/api/v1/payment/create-checkout", json={"plan": "pro"})
    assert r.status_code == 400


def test_checkout_demo_creates_subscription(client):
    r = client.post(
        "/api/v1/payment/create-checkout", json={"plan": "pro", "email": "demo@test.com"}
    )
    assert r.status_code == 200
    data = r.json()
    assert data["demo"] is True

    sub = client.get("/api/v1/payment/subscription", params={"email": "demo@test.com"})
    assert sub.status_code == 200
    assert sub.json()["plan"] == "pro"
    assert sub.json()["status"] == "active"


def test_subscription_unknown_email_free(client):
    r = client.get(
        "/api/v1/payment/subscription", params={"email": "nobody@example.com"}
    )
    assert r.status_code == 200
    assert r.json()["plan"] == "free"
    assert r.json()["status"] == "inactive"


def test_webhook_ignored_without_stripe(client):
    r = client.post("/api/v1/payment/webhook")
    assert r.status_code == 200
    assert r.json()["status"] == "ignored"
