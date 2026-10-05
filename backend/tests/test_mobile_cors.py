"""Native Capacitor origins must reach authenticated API endpoints."""

import os
import sys
from pathlib import Path

from fastapi.testclient import TestClient
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:18770")
os.environ.setdefault("DB_NAME", "sf_mobile_cors_test")
os.environ.setdefault("JWT_SECRET", "mobile-cors-test-secret-not-for-production-123456789")
import server


@pytest.mark.parametrize("origin", ["capacitor://localhost", "https://localhost"])
def test_native_preflight_allows_authenticated_requests(origin):
    response = TestClient(server.app).options(
        "/api/auth/me",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
    assert response.headers["access-control-allow-credentials"] == "true"
