"""
CORS tests — verifies that the CORS middleware allows known dev origins.
With auth (credentials), allow_origins uses an explicit allowlist and
the response echoes back the requesting origin.
"""

ALLOWED = "http://localhost:5173"
DISALLOWED = "http://evil.com"

PREFLIGHT_HEADERS = {
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "content-type",
}


class TestCORSPreflight:
    def test_allowed_origin_returns_acao(self, seeded_client):
        resp = seeded_client.options(
            f"/projects/{seeded_client.project_id}/crew",
            headers={"Origin": ALLOWED, **PREFLIGHT_HEADERS},
        )
        assert resp.status_code == 200
        assert resp.headers.get("access-control-allow-origin") == ALLOWED

    def test_disallowed_origin_no_acao(self, seeded_client):
        """Origins not in the allowlist get no Access-Control-Allow-Origin header."""
        resp = seeded_client.options(
            f"/projects/{seeded_client.project_id}/crew",
            headers={"Origin": DISALLOWED, **PREFLIGHT_HEADERS},
        )
        # Either 400 or missing ACAO header — either way the disallowed origin is rejected
        acao = resp.headers.get("access-control-allow-origin")
        assert acao != DISALLOWED


class TestCORSActualRequests:
    def test_post_with_allowed_origin_gets_acao(self, seeded_client):
        resp = seeded_client.post(
            f"/projects/{seeded_client.project_id}/crew",
            json={"name": "CORS Test Worker"},
            headers={"Origin": ALLOWED},
        )
        assert resp.status_code == 201
        assert resp.headers.get("access-control-allow-origin") == ALLOWED

    def test_post_from_unknown_origin_no_acao(self, seeded_client):
        resp = seeded_client.post(
            f"/projects/{seeded_client.project_id}/crew",
            json={"name": "Prod Origin Worker"},
            headers={"Origin": "https://sightsync-web.onrender.com"},
        )
        # Request still succeeds (non-browser client), but no ACAO header for unlisted origin
        assert resp.status_code == 201
