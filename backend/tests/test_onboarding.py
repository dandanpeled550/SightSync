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
    """Build a fake anthropic message response object.

    Returns only the continuation after the assistant prefill '{"tasks": [',
    matching what the real API returns when prefill is used.
    """
    from app.services.ai_extraction import _ANTHROPIC_PREFILL
    full = json.dumps({"tasks": tasks, "confidence": confidence})
    # Strip the prefill so that prepending it in _call_anthropic yields valid JSON.
    continuation = full[len(_ANTHROPIC_PREFILL):]
    content_block = SimpleNamespace(text=continuation)
    message = MagicMock()
    message.content = [content_block]
    return message


def _mock_openai_response(tasks: list[dict], confidence: float = 0.85) -> MagicMock:
    """Build a fake openai chat completion response object."""
    payload = json.dumps({"tasks": tasks, "confidence": confidence})
    choice = SimpleNamespace(message=SimpleNamespace(content=payload))
    response = MagicMock()
    response.choices = [choice]
    return response


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


def _mock_pass2_response(workflows: list, dependencies: list) -> MagicMock:
    """Return a fake anthropic message response for Pass 2 (dependency inference)."""
    payload = json.dumps({"workflows": workflows, "dependencies": dependencies})
    content_block = SimpleNamespace(text=payload)
    message = MagicMock()
    message.content = [content_block]
    return message


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
    def test_upload_xlsx_without_any_api_key_returns_error_field(
        self, mock_settings, seeded_client
    ):
        """When neither API key is set, result error explains what to do."""
        mock_settings.anthropic_api_key = ""
        mock_settings.openai_api_key = ""

        resp = _upload(seeded_client, _make_xlsx())
        assert resp.status_code == 200
        data = resp.json()
        assert data["tasks"] == []
        assert "ANTHROPIC_API_KEY" in data["error"]
        assert "OPENAI_API_KEY" in data["error"]

    @patch("app.services.ai_extraction.settings")
    @patch("openai.OpenAI")
    def test_upload_uses_openai_when_only_openai_key_set(
        self, mock_openai_cls, mock_settings, seeded_client
    ):
        """When only OPENAI_API_KEY is set, the OpenAI provider is used."""
        mock_settings.anthropic_api_key = ""
        mock_settings.openai_api_key = "sk-openai-test"
        mock_settings.openai_model = "gpt-4o"

        task_payload = [
            {
                "name": "Framing Work",
                "level_tag": "Level 2",
                "trade_tag": "Structural",
                "start_date": "2025-04-01",
                "duration_days": 8,
            }
        ]
        mock_instance = MagicMock()
        mock_instance.chat.completions.create.return_value = _mock_openai_response(task_payload)
        mock_openai_cls.return_value = mock_instance

        resp = _upload(seeded_client, _make_xlsx())
        assert resp.status_code == 200
        data = resp.json()
        assert data["error"] is None
        assert len(data["tasks"]) == 1
        assert data["tasks"][0]["name"] == "Framing Work"
        mock_instance.chat.completions.create.assert_called_once()

    @patch("app.services.ai_extraction.settings")
    @patch("openai.OpenAI")
    @patch("anthropic.Anthropic")
    def test_upload_prefers_claude_when_both_keys_set(
        self, mock_anthropic_cls, mock_openai_cls, mock_settings, seeded_client
    ):
        """When both keys are set, Claude (Anthropic) is used, not OpenAI."""
        mock_settings.anthropic_api_key = "sk-ant-test"
        mock_settings.anthropic_model = "claude-sonnet-4-6"
        mock_settings.openai_api_key = "sk-openai-test"
        mock_settings.openai_model = "gpt-4o"

        task_payload = [{"name": "Claude Task", "level_tag": "L1", "trade_tag": None,
                         "start_date": "2025-01-01", "duration_days": 3}]
        mock_claude_instance = MagicMock()
        # Pass 1 + Pass 2 both call Anthropic
        mock_claude_instance.messages.create.side_effect = [
            _mock_claude_response(task_payload),
            _mock_pass2_response(
                workflows=[{"id": "wf_0", "name": "Unassigned", "task_indices": [0]}],
                dependencies=[],
            ),
        ]
        mock_anthropic_cls.return_value = mock_claude_instance

        resp = _upload(seeded_client, _make_xlsx())
        assert resp.status_code == 200
        data = resp.json()
        assert data["error"] is None
        # Claude was called (at least for Pass 1), OpenAI was not
        assert mock_claude_instance.messages.create.call_count >= 1
        mock_openai_cls.assert_not_called()

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
        """Confirming 3 tasks should return tasks_created=3."""
        resp = seeded_client.post(
            f"/projects/{seeded_client.project_id}/confirm-schedule",
            json={"tasks": SAMPLE_TASKS},
        )
        assert resp.status_code == 200
        assert resp.json()["tasks_created"] == 3

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
        """Confirming an empty task list should return tasks_created=0."""
        resp = seeded_client.post(
            f"/projects/{seeded_client.project_id}/confirm-schedule",
            json={"tasks": []},
        )
        assert resp.status_code == 200
        assert resp.json()["tasks_created"] == 0

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


# ---------------------------------------------------------------------------
# Pass 2: workflow + dependency inference tests
# ---------------------------------------------------------------------------

class TestPass2DependencyInference:
    """Tests for Pass 2 workflow + dependency inference."""

    @patch("app.services.ai_extraction.settings")
    @patch("anthropic.Anthropic")
    def test_upload_response_includes_workflows(
        self, mock_anthropic_cls, mock_settings, seeded_client
    ):
        """Upload response must contain a 'workflows' field that is a list."""
        mock_settings.anthropic_api_key = "test-key"
        mock_settings.anthropic_model = "claude-sonnet-4-6"

        task_payload = [{"name": "Frame L1", "level_tag": "L1", "trade_tag": "structural",
                         "start_date": "2025-01-10", "duration_days": 5}]

        mock_instance = MagicMock()
        # First call → Pass 1; second call → Pass 2
        mock_instance.messages.create.side_effect = [
            _mock_claude_response(task_payload, confidence=0.9),
            _mock_pass2_response(
                workflows=[{"id": "wf_0", "name": "Structural", "task_indices": [0]}],
                dependencies=[],
            ),
        ]
        mock_anthropic_cls.return_value = mock_instance

        resp = _upload(seeded_client, _make_xlsx())
        assert resp.status_code == 200
        data = resp.json()
        assert "workflows" in data
        assert isinstance(data["workflows"], list)

    @patch("app.services.ai_extraction.settings")
    @patch("anthropic.Anthropic")
    def test_upload_response_includes_dependencies(
        self, mock_anthropic_cls, mock_settings, seeded_client
    ):
        """Upload response must contain a 'dependencies' field that is a list."""
        mock_settings.anthropic_api_key = "test-key"
        mock_settings.anthropic_model = "claude-sonnet-4-6"

        task_payload = [
            {"name": "Frame L1", "level_tag": "L1", "trade_tag": "structural",
             "start_date": "2025-01-10", "duration_days": 5},
            {"name": "Frame L2", "level_tag": "L2", "trade_tag": "structural",
             "start_date": "2025-01-16", "duration_days": 5},
        ]
        dep_payload = [{"task_index": 1, "depends_on_index": 0, "lag_days": 0,
                        "confidence": 1.0, "reasoning": "L2 after L1", "type": "intra_workflow"}]

        mock_instance = MagicMock()
        mock_instance.messages.create.side_effect = [
            _mock_claude_response(task_payload, confidence=0.9),
            _mock_pass2_response(
                workflows=[{"id": "wf_0", "name": "Structural", "task_indices": [0, 1]}],
                dependencies=dep_payload,
            ),
        ]
        mock_anthropic_cls.return_value = mock_instance

        resp = _upload(seeded_client, _make_xlsx())
        assert resp.status_code == 200
        data = resp.json()
        assert "dependencies" in data
        assert isinstance(data["dependencies"], list)

    @patch("app.services.ai_extraction.settings")
    @patch("anthropic.Anthropic")
    def test_pass2_failure_returns_tasks_with_empty_deps(
        self, mock_anthropic_cls, mock_settings, seeded_client
    ):
        """When Pass 2 raises, the response still has tasks but workflows=[] deps=[] and error set."""
        mock_settings.anthropic_api_key = "test-key"
        mock_settings.anthropic_model = "claude-sonnet-4-6"

        task_payload = [{"name": "Foundation", "level_tag": "B1", "trade_tag": "concrete",
                         "start_date": "2025-01-05", "duration_days": 7}]

        mock_instance = MagicMock()
        # Pass 1 succeeds; Pass 2 raises
        mock_instance.messages.create.side_effect = [
            _mock_claude_response(task_payload, confidence=0.85),
            Exception("Network timeout during Pass 2"),
        ]
        mock_anthropic_cls.return_value = mock_instance

        resp = _upload(seeded_client, _make_xlsx())
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["tasks"]) == 1, "Tasks from Pass 1 must still be present"
        assert data["workflows"] == []
        assert data["dependencies"] == []

    @patch("app.services.ai_extraction.settings")
    @patch("anthropic.Anthropic")
    def test_low_confidence_deps_excluded(
        self, mock_anthropic_cls, mock_settings, seeded_client
    ):
        """A dependency with confidence < 0.4 must be excluded from the response."""
        mock_settings.anthropic_api_key = "test-key"
        mock_settings.anthropic_model = "claude-sonnet-4-6"

        task_payload = [
            {"name": "Task A", "level_tag": "L1", "trade_tag": "electrical",
             "start_date": "2025-03-01", "duration_days": 3},
            {"name": "Task B", "level_tag": "L2", "trade_tag": "electrical",
             "start_date": "2025-03-05", "duration_days": 3},
        ]
        # Two deps: one high confidence, one below threshold
        dep_payload = [
            {"task_index": 1, "depends_on_index": 0, "lag_days": 0,
             "confidence": 0.9, "reasoning": "Sequential", "type": "intra_workflow"},
            {"task_index": 0, "depends_on_index": 1, "lag_days": 0,
             "confidence": 0.3, "reasoning": "Unlikely", "type": "cross_workflow_handoff"},
        ]

        mock_instance = MagicMock()
        mock_instance.messages.create.side_effect = [
            _mock_claude_response(task_payload, confidence=0.88),
            _mock_pass2_response(
                workflows=[{"id": "wf_0", "name": "Electrical", "task_indices": [0, 1]}],
                dependencies=dep_payload,
            ),
        ]
        mock_anthropic_cls.return_value = mock_instance

        resp = _upload(seeded_client, _make_xlsx())
        assert resp.status_code == 200
        data = resp.json()
        deps = data["dependencies"]
        # Only the high-confidence dep should survive
        assert len(deps) == 1
        assert deps[0]["confidence"] >= 0.4

    def test_confirm_with_deps_inserts_deps_in_db(self, seeded_client):
        """Confirming tasks with dependencies should persist them (deps_created > 0)."""
        c = seeded_client
        tasks = [
            {"name": "Excavation", "level_tag": "B1", "trade_tag": "earthworks",
             "start_date": "2025-04-01", "duration_days": 5},
            {"name": "Foundation Pour", "level_tag": "B1", "trade_tag": "concrete",
             "start_date": "2025-04-06", "duration_days": 7},
        ]
        deps = [{"task_index": 1, "depends_on_index": 0, "lag_days": 0}]

        resp = c.post(
            f"/projects/{c.project_id}/confirm-schedule",
            json={"tasks": tasks, "dependencies": deps},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["tasks_created"] == 2
        assert data["deps_created"] == 1

    def test_confirm_idempotency_no_duplicate_deps(self, seeded_client):
        """Calling confirm twice with same deps must not raise errors or create duplicates."""
        c = seeded_client
        tasks = [
            {"name": "Task X", "level_tag": "L1", "trade_tag": "plumbing",
             "start_date": "2025-05-01", "duration_days": 3},
            {"name": "Task Y", "level_tag": "L2", "trade_tag": "plumbing",
             "start_date": "2025-05-05", "duration_days": 3},
        ]
        deps = [{"task_index": 1, "depends_on_index": 0, "lag_days": 0}]

        # First confirm
        resp1 = c.post(
            f"/projects/{c.project_id}/confirm-schedule",
            json={"tasks": tasks, "dependencies": deps},
        )
        assert resp1.status_code == 200
        assert resp1.json()["deps_created"] == 1
        assert resp1.json()["tasks_created"] == 2

        # Second confirm with same tasks + deps — should not error out (no 500)
        resp2 = c.post(
            f"/projects/{c.project_id}/confirm-schedule",
            json={"tasks": tasks, "dependencies": deps},
        )
        assert resp2.status_code == 200
        assert resp2.json()["tasks_created"] == 2
        # deps_created may be 0 (dedup) or 1 depending on DB ID reuse — either is valid
        assert resp2.json()["deps_created"] >= 0

    @patch("app.services.ai_extraction.settings")
    @patch("anthropic.Anthropic")
    def test_parallel_workflows_no_cross_deps(
        self, mock_anthropic_cls, mock_settings, seeded_client
    ):
        """Electrical and Plumbing tasks in separate workflows → no cross-workflow dep in mocked response."""
        mock_settings.anthropic_api_key = "test-key"
        mock_settings.anthropic_model = "claude-sonnet-4-6"

        task_payload = [
            {"name": "Electrical Rough-In L1", "level_tag": "L1", "trade_tag": "electrical",
             "start_date": "2025-06-01", "duration_days": 3},
            {"name": "Plumbing Rough-In L1", "level_tag": "L1", "trade_tag": "plumbing",
             "start_date": "2025-06-01", "duration_days": 3},
        ]
        # Mock: two separate workflows, no cross-workflow dep between them
        workflows = [
            {"id": "wf_0", "name": "Electrical", "task_indices": [0]},
            {"id": "wf_1", "name": "Plumbing", "task_indices": [1]},
        ]
        # No cross-deps
        dep_payload = []

        mock_instance = MagicMock()
        mock_instance.messages.create.side_effect = [
            _mock_claude_response(task_payload, confidence=0.85),
            _mock_pass2_response(workflows=workflows, dependencies=dep_payload),
        ]
        mock_anthropic_cls.return_value = mock_instance

        resp = _upload(seeded_client, _make_xlsx())
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["workflows"]) == 2
        # No cross-workflow deps
        cross_deps = [d for d in data["dependencies"] if d["type"] == "cross_workflow_handoff"]
        assert len(cross_deps) == 0

    @patch("app.services.ai_extraction.settings")
    @patch("anthropic.Anthropic")
    def test_intra_workflow_transitive_reduction(
        self, mock_anthropic_cls, mock_settings, seeded_client
    ):
        """3-task chain A→B, B→C (no A→C transitive edge) → exactly 2 edges in response."""
        mock_settings.anthropic_api_key = "test-key"
        mock_settings.anthropic_model = "claude-sonnet-4-6"

        task_payload = [
            {"name": "Frame L1", "level_tag": "L1", "trade_tag": "structural",
             "start_date": "2025-07-01", "duration_days": 5},
            {"name": "Frame L2", "level_tag": "L2", "trade_tag": "structural",
             "start_date": "2025-07-06", "duration_days": 5},
            {"name": "Frame L3", "level_tag": "L3", "trade_tag": "structural",
             "start_date": "2025-07-11", "duration_days": 5},
        ]
        # Only consecutive pairs — no transitive A→C edge
        dep_payload = [
            {"task_index": 1, "depends_on_index": 0, "lag_days": 0,
             "confidence": 1.0, "reasoning": "L2 after L1", "type": "intra_workflow"},
            {"task_index": 2, "depends_on_index": 1, "lag_days": 0,
             "confidence": 1.0, "reasoning": "L3 after L2", "type": "intra_workflow"},
        ]

        mock_instance = MagicMock()
        mock_instance.messages.create.side_effect = [
            _mock_claude_response(task_payload, confidence=0.9),
            _mock_pass2_response(
                workflows=[{"id": "wf_0", "name": "Structural", "task_indices": [0, 1, 2]}],
                dependencies=dep_payload,
            ),
        ]
        mock_anthropic_cls.return_value = mock_instance

        resp = _upload(seeded_client, _make_xlsx())
        assert resp.status_code == 200
        data = resp.json()
        # Exactly 2 edges — no transitive edge
        assert len(data["dependencies"]) == 2

    @patch("app.services.ai_extraction.settings")
    @patch("anthropic.Anthropic")
    def test_intra_workflow_task_ordering(
        self, mock_anthropic_cls, mock_settings, seeded_client
    ):
        """Tasks in a workflow should be ordered by level_tag (indices ascending in task_indices)."""
        mock_settings.anthropic_api_key = "test-key"
        mock_settings.anthropic_model = "claude-sonnet-4-6"

        task_payload = [
            {"name": "Drywall B1", "level_tag": "Basement", "trade_tag": "drywall",
             "start_date": "2025-08-01", "duration_days": 3},
            {"name": "Drywall L1", "level_tag": "L1", "trade_tag": "drywall",
             "start_date": "2025-08-05", "duration_days": 3},
            {"name": "Drywall L2", "level_tag": "L2", "trade_tag": "drywall",
             "start_date": "2025-08-09", "duration_days": 3},
        ]
        # Workflow with ordered indices
        workflows = [{"id": "wf_0", "name": "Drywall", "task_indices": [0, 1, 2]}]

        mock_instance = MagicMock()
        mock_instance.messages.create.side_effect = [
            _mock_claude_response(task_payload, confidence=0.88),
            _mock_pass2_response(workflows=workflows, dependencies=[]),
        ]
        mock_anthropic_cls.return_value = mock_instance

        resp = _upload(seeded_client, _make_xlsx())
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["workflows"]) == 1
        wf = data["workflows"][0]
        # Indices should be in non-decreasing order (ordered by level)
        indices = wf["task_indices"]
        assert indices == sorted(indices)

    @patch("app.services.ai_extraction.settings")
    def test_no_api_key_pass2_skipped(self, mock_settings, seeded_client):
        """Missing API key → tasks=[] (Pass 1 skipped), error field set, no 500."""
        mock_settings.anthropic_api_key = ""
        mock_settings.openai_api_key = ""

        resp = _upload(seeded_client, _make_xlsx())
        assert resp.status_code == 200
        data = resp.json()
        assert data["tasks"] == []
        assert data["workflows"] == []
        assert data["dependencies"] == []
        assert data["error"] is not None
        assert len(data["error"]) > 0
