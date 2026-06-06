"""
Tests for the onboarding endpoints:
  POST /projects/{project_id}/upload-schedule
  POST /projects/{project_id}/confirm-schedule

Claude API is ALWAYS mocked — no real API calls are made.
"""

import datetime
import io
import json
import os
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import openpyxl
import pytest

# Ensure env is set before any app import (mirrors conftest.py pattern)
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("FRONTEND_URL", "http://localhost:5173")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_xlsx(rows=None) -> bytes:
    """Return minimal xlsx bytes. Default rows are a header + one task row."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Task", "Level", "Trade", "Start", "Duration"])
    if rows is None:
        ws.append(["Foundation Work", "Level 1", "Concrete", "2025-01-15", 10])
    else:
        for row in rows:
            ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()


def _mock_claude_response(tasks: list[dict], confidence: float = 0.85) -> MagicMock:
    """Build a fake anthropic message response object."""
    payload = json.dumps({"tasks": tasks, "confidence": confidence})
    content_block = SimpleNamespace(text=payload)
    message = MagicMock()
    message.content = [content_block]
    return message


def _upload(client, xlsx_bytes: bytes, filename: str = "schedule.xlsx"):
    return client.post(
        f"/projects/{client.project_id}/upload-schedule",
        files={
            "file": (
                filename,
                xlsx_bytes,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )


# ---------------------------------------------------------------------------
# Upload tests
# ---------------------------------------------------------------------------

class TestUploadSchedule:
    """Tests for POST /projects/{project_id}/upload-schedule."""

    @patch("app.services.ai_extraction.settings")
    @patch("anthropic.Anthropic")
    def test_upload_valid_xlsx_returns_extraction_shape(
        self, mock_anthropic_cls, mock_settings, seeded_client
    ):
        """Upload a valid .xlsx — response has the ExtractionResult shape."""
        mock_settings.anthropic_api_key = "test-key"
        mock_settings.anthropic_model = "claude-sonnet-4-6"

        mock_instance = MagicMock()
        mock_instance.messages.create.return_value = _mock_claude_response(
            [
                {
                    "name": "Foundation Work",
                    "level_tag": "Level 1",
                    "trade_tag": "Concrete",
                    "start_date": "2025-01-15",
                    "duration_days": 10,
                }
            ]
        )
        mock_anthropic_cls.return_value = mock_instance

        resp = _upload(seeded_client, _make_xlsx())
        assert resp.status_code == 200
        data = resp.json()
        assert "tasks" in data
        assert isinstance(data["tasks"], list)
        assert "confidence" in data
        assert "error" in data
        assert "raw_text_length" in data

    def test_upload_non_xlsx_returns_400(self, seeded_client):
        """Uploading a non-.xlsx file should return 400."""
        csv_bytes = b"task,level\nFoundation,L1\n"
        resp = seeded_client.post(
            f"/projects/{seeded_client.project_id}/upload-schedule",
            files={"file": ("schedule.csv", csv_bytes, "text/csv")},
        )
        assert resp.status_code == 400
        assert "xlsx" in resp.json()["detail"].lower()

    @patch("app.services.ai_extraction.settings")
    def test_upload_xlsx_without_api_key_returns_error_field(
        self, mock_settings, seeded_client
    ):
        """When ANTHROPIC_API_KEY is empty, result should have error='ANTHROPIC_API_KEY not configured'."""
        mock_settings.anthropic_api_key = ""
        mock_settings.anthropic_model = "claude-sonnet-4-6"

        resp = _upload(seeded_client, _make_xlsx())
        assert resp.status_code == 200
        data = resp.json()
        assert data["tasks"] == []
        assert data["error"] == "ANTHROPIC_API_KEY not configured"

    @patch("app.services.ai_extraction.settings")
    @patch("anthropic.Anthropic")
    def test_upload_mocked_claude_valid_json_parses_tasks(
        self, mock_anthropic_cls, mock_settings, seeded_client
    ):
        """When Claude returns valid JSON, tasks are parsed correctly."""
        mock_settings.anthropic_api_key = "test-key"
        mock_settings.anthropic_model = "claude-sonnet-4-6"

        task_payload = [
            {
                "name": "Roof Installation",
                "level_tag": "Roof",
                "trade_tag": "Roofing",
                "start_date": "2025-03-01",
                "duration_days": 7,
            }
        ]
        mock_instance = MagicMock()
        mock_instance.messages.create.return_value = _mock_claude_response(task_payload, confidence=0.9)
        mock_anthropic_cls.return_value = mock_instance

        resp = _upload(seeded_client, _make_xlsx())
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["tasks"]) == 1
        t = data["tasks"][0]
        assert t["name"] == "Roof Installation"
        assert t["level_tag"] == "Roof"
        assert t["trade_tag"] == "Roofing"
        assert t["start_date"] == "2025-03-01"
        assert t["duration_days"] == 7
        assert data["confidence"] == pytest.approx(0.9)

    @patch("app.services.ai_extraction.settings")
    @patch("anthropic.Anthropic")
    def test_upload_mocked_claude_malformed_json_returns_error(
        self, mock_anthropic_cls, mock_settings, seeded_client
    ):
        """When Claude returns malformed JSON, result has an error field and tasks=[]."""
        mock_settings.anthropic_api_key = "test-key"
        mock_settings.anthropic_model = "claude-sonnet-4-6"

        content_block = SimpleNamespace(text="this is not valid json {{{")
        bad_message = MagicMock()
        bad_message.content = [content_block]

        mock_instance = MagicMock()
        mock_instance.messages.create.return_value = bad_message
        mock_anthropic_cls.return_value = mock_instance

        resp = _upload(seeded_client, _make_xlsx())
        assert resp.status_code == 200
        data = resp.json()
        assert data["tasks"] == []
        assert data["error"] is not None
        assert len(data["error"]) > 0


# ---------------------------------------------------------------------------
# Confirm schedule tests
# ---------------------------------------------------------------------------

SAMPLE_TASKS = [
    {"name": "Task A", "level_tag": "L1", "trade_tag": "Concrete", "start_date": "2025-02-01", "duration_days": 5},
    {"name": "Task B", "level_tag": "L2", "trade_tag": None, "start_date": "2025-02-10", "duration_days": 3},
    {"name": "Task C", "level_tag": "L3", "trade_tag": "Steel", "start_date": "2025-02-20", "duration_days": 10},
]


class TestConfirmSchedule:
    """Tests for POST /projects/{project_id}/confirm-schedule."""

    def test_confirm_3_tasks_returns_tasks_created_3(self, seeded_client):
        """Confirming 3 tasks should return {"tasks_created": 3}."""
        resp = seeded_client.post(
            f"/projects/{seeded_client.project_id}/confirm-schedule",
            json={"tasks": SAMPLE_TASKS},
        )
        assert resp.status_code == 200
        assert resp.json() == {"tasks_created": 3}

    def test_confirm_replaces_existing_tasks_clean_slate(self, seeded_client_with_tasks):
        """Confirming 3 new tasks when 3 already exist should leave only 3 in DB."""
        c = seeded_client_with_tasks
        # seeded_client_with_tasks already has 3 tasks; confirm with a different 3
        resp = c.post(
            f"/projects/{c.project_id}/confirm-schedule",
            json={"tasks": SAMPLE_TASKS},
        )
        assert resp.status_code == 200
        assert resp.json()["tasks_created"] == 3

        # Verify only 3 tasks remain by listing via the tasks endpoint
        list_resp = c.get(f"/projects/{c.project_id}/tasks")
        assert list_resp.status_code == 200
        tasks = list_resp.json()
        assert len(tasks) == 3
        task_names = {t["name"] for t in tasks}
        assert task_names == {"Task A", "Task B", "Task C"}

    def test_confirm_empty_list_returns_0(self, seeded_client):
        """Confirming an empty task list should return {"tasks_created": 0}."""
        resp = seeded_client.post(
            f"/projects/{seeded_client.project_id}/confirm-schedule",
            json={"tasks": []},
        )
        assert resp.status_code == 200
        assert resp.json() == {"tasks_created": 0}

    def test_confirm_sets_source_ai_and_status_pending(self, seeded_client):
        """All confirmed tasks should have source='ai' and status='pending'."""
        resp = seeded_client.post(
            f"/projects/{seeded_client.project_id}/confirm-schedule",
            json={
                "tasks": [
                    {
                        "name": "AI Task",
                        "level_tag": "L1",
                        "trade_tag": "Electrical",
                        "start_date": "2025-05-01",
                        "duration_days": 4,
                    }
                ]
            },
        )
        assert resp.status_code == 200
        list_resp = seeded_client.get(f"/projects/{seeded_client.project_id}/tasks")
        assert list_resp.status_code == 200
        tasks = list_resp.json()
        assert len(tasks) == 1
        t = tasks[0]
        assert t["source"] == "ai"
        assert t["status"] == "pending"

    def test_confirm_end_date_computed_correctly(self, seeded_client):
        """end_date should equal start_date + duration_days."""
        resp = seeded_client.post(
            f"/projects/{seeded_client.project_id}/confirm-schedule",
            json={
                "tasks": [
                    {
                        "name": "Compute Test Task",
                        "level_tag": "L1",
                        "trade_tag": None,
                        "start_date": "2025-06-01",
                        "duration_days": 10,
                    }
                ]
            },
        )
        assert resp.status_code == 200
        list_resp = seeded_client.get(f"/projects/{seeded_client.project_id}/tasks")
        tasks = list_resp.json()
        assert len(tasks) == 1
        t = tasks[0]
        start = datetime.date.fromisoformat(t["start_date"])
        end = datetime.date.fromisoformat(t["end_date"])
        assert (end - start).days == 10
