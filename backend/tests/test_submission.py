"""Tests for log submission, AI summary background task, and PDF export."""

import io
import os

import pytest
from unittest.mock import patch, MagicMock

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("FRONTEND_URL", "http://localhost:5173")

from app.services.ai_summary import generate_and_store_summary  # noqa: E402


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _submit_url(c):
    return f"/projects/{c.project_id}/daily-logs/{c.log_id}/submit"


def _pdf_url(c):
    return f"/projects/{c.project_id}/daily-logs/{c.log_id}/export-pdf"


# ---------------------------------------------------------------------------
# Unauthenticated client fixture (no get_current_user override)
# ---------------------------------------------------------------------------

@pytest.fixture()
def unauth_client(SessionFactory):
    """TestClient that only overrides get_db — no auth override, so real JWT check runs."""
    from fastapi.testclient import TestClient
    from app.database import get_db
    from app.main import app

    def override_get_db():
        db = SessionFactory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# TestSubmitEndpoint
# ---------------------------------------------------------------------------

class TestSubmitEndpoint:
    def test_submit_sets_submitted_flag(self, seeded_client):
        """POST submit → log.submitted is True in the response."""
        r = seeded_client.post(_submit_url(seeded_client))
        assert r.status_code == 200
        assert r.json()["submitted"] is True

    def test_submit_idempotent(self, seeded_client):
        """Submitting twice returns 200 both times and submitted remains True."""
        r1 = seeded_client.post(_submit_url(seeded_client))
        assert r1.status_code == 200
        r2 = seeded_client.post(_submit_url(seeded_client))
        assert r2.status_code == 200
        assert r2.json()["submitted"] is True

    def test_submit_returns_daily_log_out(self, seeded_client):
        """Response contains the expected DailyLogOut fields."""
        r = seeded_client.post(_submit_url(seeded_client))
        assert r.status_code == 200
        body = r.json()
        assert "id" in body
        assert "submitted" in body
        assert "ai_summary" in body
        assert body["id"] == seeded_client.log_id

    def test_submit_requires_auth(self, unauth_client):
        """Calling submit without a token returns 401 (or 422 — FastAPI JWT behaviour)."""
        # Use any project_id/log_id — auth check fires before DB lookup
        url = "/projects/1/daily-logs/1/submit"
        r = unauth_client.post(url)
        assert r.status_code in (401, 422)

    def test_submit_nonexistent_log_returns_404(self, seeded_client):
        """Submitting a log_id that doesn't exist returns 404."""
        url = f"/projects/{seeded_client.project_id}/daily-logs/9999/submit"
        r = seeded_client.post(url)
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# TestExportPdf
# ---------------------------------------------------------------------------

class TestExportPdf:
    def test_export_pdf_returns_application_pdf(self, seeded_client):
        """GET export-pdf → content-type contains application/pdf."""
        r = seeded_client.get(_pdf_url(seeded_client))
        assert r.status_code == 200
        assert "application/pdf" in r.headers["content-type"]

    def test_export_pdf_content_is_non_empty(self, seeded_client):
        """PDF bytes are non-empty and start with the PDF magic bytes."""
        r = seeded_client.get(_pdf_url(seeded_client))
        assert r.status_code == 200
        assert len(r.content) > 0
        assert r.content[:4] == b"%PDF"

    def test_export_pdf_content_disposition_header(self, seeded_client):
        """Content-Disposition header contains the log date and .pdf extension."""
        r = seeded_client.get(_pdf_url(seeded_client))
        assert r.status_code == 200
        disposition = r.headers.get("content-disposition", "")
        assert "attachment" in disposition
        assert ".pdf" in disposition

    def test_export_pdf_for_missing_log_returns_404(self, seeded_client):
        """GET export-pdf for a non-existent log_id returns 404."""
        url = f"/projects/{seeded_client.project_id}/daily-logs/9999/export-pdf"
        r = seeded_client.get(url)
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# TestAiSummary
# ---------------------------------------------------------------------------

class TestAiSummary:
    def test_ai_summary_stored_on_mocked_call(self, seeded_client, SessionFactory):
        """generate_and_store_summary stores Claude's text in log.ai_summary."""
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="Great day on site. All tasks completed.")]

        mock_client_instance = MagicMock()
        mock_client_instance.messages.create.return_value = mock_response

        db = SessionFactory()
        try:
            with patch("anthropic.Anthropic", return_value=mock_client_instance), \
                 patch("app.services.ai_summary.settings") as mock_settings:
                mock_settings.anthropic_api_key = "test-key"
                mock_settings.anthropic_model = "claude-sonnet-4-6"
                generate_and_store_summary(seeded_client.log_id, db)

            from app.models import DailyLog
            log = db.query(DailyLog).filter(DailyLog.id == seeded_client.log_id).first()
            assert log.ai_summary == "Great day on site. All tasks completed."
        finally:
            db.close()

    def test_ai_summary_stored_on_failure(self, seeded_client, SessionFactory):
        """When Claude raises an exception, a fallback string is stored (not null)."""
        mock_client_instance = MagicMock()
        mock_client_instance.messages.create.side_effect = RuntimeError("API timeout")

        db = SessionFactory()
        try:
            with patch("anthropic.Anthropic", return_value=mock_client_instance), \
                 patch("app.services.ai_summary.settings") as mock_settings:
                mock_settings.anthropic_api_key = "test-key"
                mock_settings.anthropic_model = "claude-sonnet-4-6"
                generate_and_store_summary(seeded_client.log_id, db)

            from app.models import DailyLog
            log = db.query(DailyLog).filter(DailyLog.id == seeded_client.log_id).first()
            assert log.ai_summary is not None
            assert "failed" in log.ai_summary.lower() or "Summary" in log.ai_summary
        finally:
            db.close()

    def test_ai_summary_graceful_no_api_key(self, seeded_client, SessionFactory):
        """When anthropic_api_key is empty, a graceful fallback string is stored."""
        db = SessionFactory()
        try:
            with patch("app.services.ai_summary.settings") as mock_settings:
                mock_settings.anthropic_api_key = ""
                mock_settings.anthropic_model = "claude-sonnet-4-6"
                generate_and_store_summary(seeded_client.log_id, db)

            from app.models import DailyLog
            log = db.query(DailyLog).filter(DailyLog.id == seeded_client.log_id).first()
            assert log.ai_summary is not None
            assert "no API key" in log.ai_summary or "failed" in log.ai_summary.lower()
        finally:
            db.close()
