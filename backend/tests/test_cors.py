"""
CORS tests — verifies that the CORS middleware correctly allows and rejects
origins. These tests close the gap where TestClient bypasses real HTTP but
still processes the full ASGI middleware stack, including CORS, when Origin
headers are passed explicitly.
"""

ALLOWED = "http://localhost:5173"
SECOND_DEV_PORT = "http://localhost:5174"  # the exact port bump that caused the bug
DISALLOWED = "http://evil.com"

PREFLIGHT_HEADERS = {
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "content-type",
}


class TestCORSPreflight:
    def test_allowed_origin_returns_200(self, seeded_client):
        resp = seeded_client.options(
            f"/projects/{seeded_client.project_id}/crew",
            headers={"Origin": ALLOWED, **PREFLIGHT_HEADERS},
        )
        assert resp.status_code == 200
        assert resp.headers.get("access-control-allow-origin") == ALLOWED

    def test_second_dev_port_returns_200(self, seeded_client):
        """Port :5174 is the exact origin that caused the silent CORS failure."""
        resp = seeded_client.options(
            f"/projects/{seeded_client.project_id}/crew",
            headers={"Origin": SECOND_DEV_PORT, **PREFLIGHT_HEADERS},
        )
        assert resp.status_code == 200
        assert resp.headers.get("access-control-allow-origin") == SECOND_DEV_PORT

    def test_disallowed_origin_has_no_acao_header(self, seeded_client):
        resp = seeded_client.options(
            f"/projects/{seeded_client.project_id}/crew",
            headers={"Origin": DISALLOWED, **PREFLIGHT_HEADERS},
        )
        assert "access-control-allow-origin" not in resp.headers


class TestCORSActualRequests:
    def test_post_with_allowed_origin_succeeds(self, seeded_client):
        resp = seeded_client.post(
            f"/projects/{seeded_client.project_id}/crew",
            json={"name": "CORS Test Worker"},
            headers={"Origin": ALLOWED},
        )
        assert resp.status_code == 201
        assert resp.headers.get("access-control-allow-origin") == ALLOWED

    def test_post_with_disallowed_origin_has_no_acao_header(self, seeded_client):
        """A browser would block this response — no ACAO header means the
        browser discards the response even though the server processed it."""
        resp = seeded_client.post(
            f"/projects/{seeded_client.project_id}/crew",
            json={"name": "Should Be Blocked"},
            headers={"Origin": DISALLOWED},
        )
        assert "access-control-allow-origin" not in resp.headers
