import os

os.environ["DATABASE_URL"] = "sqlite:///./test_dpiic.db"
os.environ["SECRET_KEY"] = "test-secret"

from pathlib import Path

import pytest

TEST_DB = Path(__file__).resolve().parent.parent / "test_dpiic.db"


def _reset_db() -> None:
    """Wipe any test database so each session starts from a clean seed."""
    for path in (
        TEST_DB,
        Path(str(TEST_DB) + "-shm"),
        Path(str(TEST_DB) + "-wal"),
    ):
        try:
            if path.exists():
                path.unlink()
        except PermissionError:
            pass


_reset_db()

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.database import SessionLocal  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def db():
    session = SessionLocal()
    yield session
    session.close()


def login(client, suffix="admin") -> dict:
    resp = client.post(
        "/api/auth/login",
        json={"user_id": f"demo.{suffix}@dpiic.gov.in", "password": "Dpiic@2026"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


@pytest.fixture(scope="session")
def admin_token(client) -> str:
    return login(client, "admin")["access_token"]


@pytest.fixture(scope="session")
def scientist_token(client) -> str:
    return login(client, "scientist")["access_token"]


@pytest.fixture(scope="session")
def stakeholder_token(client) -> str:
    return login(client, "stakeholder")["access_token"]


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
