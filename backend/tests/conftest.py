import os
import shutil
import tempfile

_temp = tempfile.mkdtemp(prefix="resumeiq_test_")
os.environ["DATABASE_URL"] = "sqlite:///" + os.path.join(_temp, "test.db").replace(os.sep, "/")
os.environ["UPLOAD_DIR"] = os.path.join(_temp, "uploads")
os.environ["CORS_ORIGINS"] = "http://localhost:3000,http://127.0.0.1:3000"
os.environ["APP_NAME"] = "ResumeIQ AI"
os.environ["APP_VERSION"] = "1.0.0"

import pytest
from fastapi.testclient import TestClient

from app.main import app
import app.api.admin as admin_module


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def _clear_rate_limiter():
    admin_module._login_attempts.clear()
    yield
    admin_module._login_attempts.clear()


@pytest.fixture(scope="session", autouse=True)
def _cleanup():
    yield
    shutil.rmtree(_temp, ignore_errors=True)


def auth_headers(client: TestClient) -> dict:
    r = client.post(
        "/api/v1/admin/login", json={"username": "admin", "password": "admin123"}
    )
    return {"Authorization": f"Bearer {r.json()['token']}"}
