"""
CORS tests — verifies that the CORS middleware allows all origins.
allow_origins=["*"] is used because the app has no auth (no cookies, no
credentials), so wildcard CORS is safe and avoids env-var configuration issues
across Render deploys.
"""

ALLOWED = "http://localhost:5173"
DISALLOWED = "http://evil.com"

PREFLIGHT_HEADERS = {
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "content-type",
}


class TestCORSPreflight:
    def test_allowed_origin_returns_wildcard_acao(self, seeded_client):
        resp = seeded_client.options(
            f"/projects/{seeded_client.project_id}/crew",
            headers={"Origin": ALLOWED, **PREFLIGHT_HEADERS},
        )
        assert resp.status_code == 200
        assert resp.headers.get("access-control-allow-origin") == "*"

    def test_any_origin_returns_wildcard_acao(self, seeded_client):
        """allow_origins=["*"] means all origins get Access-Control-Allow-Origin: *"""
        resp = seeded_client.options(
            f"/projects/{seeded_client.project_id}/crew",
            headers={"Origin": DISALLOWED, **PREFLIGHT_HEADERS},
        )
        assert resp.status_code == 200
        assert resp.headers.get("access-control-allow-origin") == "*"


class TestCORSActualRequests:
    def test_post_with_any_origin_gets_wildcard_acao(self, seeded_client):
        resp = seeded_client.post(
            f"/projects/{seeded_client.project_id}/crew",
            json={"name": "CORS Test Worker"},
            headers={"Origin": ALLOWED},
        )
        assert resp.status_code == 201
        assert resp.headers.get("access-control-allow-origin") == "*"

    def test_post_from_production_origin_gets_wildcard_acao(self, seeded_client):
        resp = seeded_client.post(
            f"/projects/{seeded_client.project_id}/crew",
            json={"name": "Prod Origin Worker"},
            headers={"Origin": "https://sightsync-web.onrender.com"},
        )
        assert resp.status_code == 201
        assert resp.headers.get("access-control-allow-origin") == "*"
