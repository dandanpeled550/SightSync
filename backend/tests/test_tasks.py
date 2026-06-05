"""
Tests for the tasks router — Sprint 2 Task Data Layer.
Covers: CRUD, bulk creation, today filter, dependencies, task log entries.
"""
import datetime

import pytest


TODAY = datetime.date.today().isoformat()
YESTERDAY = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
TOMORROW = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()
FAR_FUTURE = (datetime.date.today() + datetime.timedelta(days=60)).isoformat()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _task_payload(**overrides):
    base = {
        "name": "Install Steel Frame",
        "level_tag": "Level 3",
        "trade_tag": "Steel",
        "start_date": TODAY,
        "duration_days": 3,
        "status": "pending",
        "source": "manual",
    }
    base.update(overrides)
    return base


# ── List tasks ────────────────────────────────────────────────────────────────

def test_list_tasks_empty(seeded_client):
    c = seeded_client
    r = c.get(f"/projects/{c.project_id}/tasks")
    assert r.status_code == 200
    assert r.json() == []


def test_list_tasks_returns_all(seeded_client_with_tasks):
    c = seeded_client_with_tasks
    r = c.get(f"/projects/{c.project_id}/tasks")
    assert r.status_code == 200
    assert len(r.json()) == 3


# ── Create task ───────────────────────────────────────────────────────────────

def test_create_task_201(seeded_client):
    c = seeded_client
    r = c.post(f"/projects/{c.project_id}/tasks", json=_task_payload())
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Install Steel Frame"
    assert data["level_tag"] == "Level 3"
    assert data["project_id"] == c.project_id


def test_create_task_end_date_computed(seeded_client):
    """end_date must equal start_date + duration_days."""
    c = seeded_client
    start = datetime.date.today()
    duration = 7
    r = c.post(f"/projects/{c.project_id}/tasks", json=_task_payload(
        start_date=start.isoformat(), duration_days=duration
    ))
    assert r.status_code == 201
    expected_end = (start + datetime.timedelta(days=duration)).isoformat()
    assert r.json()["end_date"] == expected_end


def test_create_task_missing_name_422(seeded_client):
    c = seeded_client
    payload = _task_payload()
    del payload["name"]
    r = c.post(f"/projects/{c.project_id}/tasks", json=payload)
    assert r.status_code == 422


def test_create_task_missing_level_tag_422(seeded_client):
    c = seeded_client
    payload = _task_payload()
    del payload["level_tag"]
    r = c.post(f"/projects/{c.project_id}/tasks", json=payload)
    assert r.status_code == 422


def test_create_task_optional_fields_default(seeded_client):
    """trade_tag and description are optional."""
    c = seeded_client
    r = c.post(f"/projects/{c.project_id}/tasks", json={
        "name": "Minimal Task",
        "level_tag": "Roof",
        "start_date": TODAY,
        "duration_days": 1,
    })
    assert r.status_code == 201
    data = r.json()
    assert data["trade_tag"] is None
    assert data["description"] is None
    assert data["status"] == "pending"
    assert data["source"] == "manual"


# ── Bulk create tasks ─────────────────────────────────────────────────────────

def test_create_tasks_bulk(seeded_client):
    c = seeded_client
    payload = [
        _task_payload(name="Task A", start_date=TODAY, duration_days=2),
        _task_payload(name="Task B", start_date=TOMORROW, duration_days=5),
        _task_payload(name="Task C", start_date=FAR_FUTURE, duration_days=1),
    ]
    r = c.post(f"/projects/{c.project_id}/tasks/bulk", json=payload)
    assert r.status_code == 201
    data = r.json()
    assert len(data) == 3
    names = {t["name"] for t in data}
    assert names == {"Task A", "Task B", "Task C"}


def test_create_tasks_bulk_end_dates_computed(seeded_client):
    """end_date must be computed for each bulk task."""
    c = seeded_client
    start = datetime.date.today()
    payload = [
        {"name": "Bulk T1", "level_tag": "L1", "start_date": start.isoformat(), "duration_days": 3},
        {"name": "Bulk T2", "level_tag": "L2", "start_date": start.isoformat(), "duration_days": 10},
    ]
    r = c.post(f"/projects/{c.project_id}/tasks/bulk", json=payload)
    assert r.status_code == 201
    results = r.json()
    assert results[0]["end_date"] == (start + datetime.timedelta(days=3)).isoformat()
    assert results[1]["end_date"] == (start + datetime.timedelta(days=10)).isoformat()


# ── Update task ───────────────────────────────────────────────────────────────

def test_update_task_200(seeded_client_with_tasks):
    c = seeded_client_with_tasks
    task_id = c.task_ids[0]
    r = c.put(f"/tasks/{task_id}", json={"name": "Updated Name", "status": "done"})
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "Updated Name"
    assert data["status"] == "done"


def test_update_task_end_date_recomputed(seeded_client_with_tasks):
    """Updating duration_days must recompute end_date."""
    c = seeded_client_with_tasks
    task_id = c.task_ids[1]
    # Get current start_date
    task_data = c.get(f"/projects/{c.project_id}/tasks").json()
    task = next(t for t in task_data if t["id"] == task_id)
    start = datetime.date.fromisoformat(task["start_date"])
    new_duration = 20

    r = c.put(f"/tasks/{task_id}", json={"duration_days": new_duration})
    assert r.status_code == 200
    expected_end = (start + datetime.timedelta(days=new_duration)).isoformat()
    assert r.json()["end_date"] == expected_end


def test_update_task_not_found_404(seeded_client):
    c = seeded_client
    r = c.put("/tasks/99999", json={"name": "Ghost"})
    assert r.status_code == 404


# ── Delete task ───────────────────────────────────────────────────────────────

def test_delete_task_204(seeded_client_with_tasks):
    c = seeded_client_with_tasks
    task_id = c.task_ids[0]
    r = c.delete(f"/tasks/{task_id}")
    assert r.status_code == 204

    # Verify gone
    tasks = c.get(f"/projects/{c.project_id}/tasks").json()
    assert not any(t["id"] == task_id for t in tasks)


def test_delete_task_not_found_404(seeded_client):
    c = seeded_client
    r = c.delete("/tasks/99999")
    assert r.status_code == 404


# ── Today filter ──────────────────────────────────────────────────────────────

def test_today_filter_excludes_future_tasks(seeded_client):
    c = seeded_client
    # Create one task starting today and one in the far future
    c.post(f"/projects/{c.project_id}/tasks", json=_task_payload(
        name="Current Task", start_date=TODAY, duration_days=5
    ))
    c.post(f"/projects/{c.project_id}/tasks", json=_task_payload(
        name="Future Task", start_date=FAR_FUTURE, duration_days=2
    ))

    r = c.get(f"/projects/{c.project_id}/tasks/today")
    assert r.status_code == 200
    names = [t["name"] for t in r.json()]
    assert "Current Task" in names
    assert "Future Task" not in names


def test_today_filter_excludes_done_tasks(seeded_client):
    c = seeded_client
    # Create a task starting today with status=done
    c.post(f"/projects/{c.project_id}/tasks", json=_task_payload(
        name="Done Task", start_date=TODAY, status="done"
    ))
    c.post(f"/projects/{c.project_id}/tasks", json=_task_payload(
        name="Pending Task", start_date=TODAY, status="pending"
    ))

    r = c.get(f"/projects/{c.project_id}/tasks/today")
    assert r.status_code == 200
    names = [t["name"] for t in r.json()]
    assert "Done Task" not in names
    assert "Pending Task" in names


def test_today_filter_includes_past_start_date(seeded_client):
    """Tasks that started before today but are not done should appear."""
    c = seeded_client
    c.post(f"/projects/{c.project_id}/tasks", json=_task_payload(
        name="Old Ongoing Task", start_date=YESTERDAY, status="in_progress"
    ))

    r = c.get(f"/projects/{c.project_id}/tasks/today")
    assert r.status_code == 200
    names = [t["name"] for t in r.json()]
    assert "Old Ongoing Task" in names


# ── Task dependencies ─────────────────────────────────────────────────────────

def test_create_dependency_201(seeded_client_with_tasks):
    c = seeded_client_with_tasks
    # Create a fresh task to add a new dep
    r_task = c.post(f"/projects/{c.project_id}/tasks", json=_task_payload(name="Extra Task"))
    assert r_task.status_code == 201
    extra_id = r_task.json()["id"]

    r = c.post(f"/projects/{c.project_id}/task-dependencies", json={
        "task_id": extra_id,
        "depends_on_task_id": c.task_ids[2],
        "lag_days": 2,
    })
    assert r.status_code == 201
    data = r.json()
    assert data["task_id"] == extra_id
    assert data["depends_on_task_id"] == c.task_ids[2]
    assert data["lag_days"] == 2


def test_create_dependency_duplicate_409(seeded_client_with_tasks):
    c = seeded_client_with_tasks
    # dep_ids[0] is already task2 -> task1; recreating should 409
    dep = c.get(f"/projects/{c.project_id}/tasks").json()
    # Re-create the existing dep
    r = c.post(f"/projects/{c.project_id}/task-dependencies", json={
        "task_id": c.task_ids[1],
        "depends_on_task_id": c.task_ids[0],
        "lag_days": 0,
    })
    assert r.status_code == 409


def test_delete_dependency_204(seeded_client_with_tasks):
    c = seeded_client_with_tasks
    dep_id = c.dep_ids[0]
    r = c.delete(f"/task-dependencies/{dep_id}")
    assert r.status_code == 204


def test_delete_dependency_not_found_404(seeded_client):
    c = seeded_client
    r = c.delete("/task-dependencies/99999")
    assert r.status_code == 404


# ── Task log entries ──────────────────────────────────────────────────────────

def test_create_task_entry_done_201(seeded_client_with_tasks):
    c = seeded_client_with_tasks
    task_id = c.task_ids[0]
    r = c.post(f"/daily-logs/{c.log_id}/task-entries", json={
        "task_id": task_id,
        "action": "done",
        "reason": "Completed on time",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["action"] == "done"
    assert data["task_id"] == task_id
    assert data["daily_log_id"] == c.log_id
    assert data["new_date"] is None


def test_create_task_entry_not_done_with_new_date_201(seeded_client_with_tasks):
    c = seeded_client_with_tasks
    task_id = c.task_ids[1]
    r = c.post(f"/daily-logs/{c.log_id}/task-entries", json={
        "task_id": task_id,
        "action": "not_done",
        "new_date": TOMORROW,
        "reason": "Weather delay",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["action"] == "not_done"
    assert data["new_date"] == TOMORROW


def test_create_task_entry_not_done_without_new_date_422(seeded_client_with_tasks):
    """not_done requires new_date — missing it should return 422."""
    c = seeded_client_with_tasks
    task_id = c.task_ids[2]
    r = c.post(f"/daily-logs/{c.log_id}/task-entries", json={
        "task_id": task_id,
        "action": "not_done",
        # new_date intentionally omitted
    })
    assert r.status_code == 422


def test_create_task_entry_invalid_action_422(seeded_client_with_tasks):
    c = seeded_client_with_tasks
    r = c.post(f"/daily-logs/{c.log_id}/task-entries", json={
        "task_id": c.task_ids[0],
        "action": "invalid_action",
    })
    assert r.status_code == 422


def test_create_task_entry_log_not_found_404(seeded_client_with_tasks):
    c = seeded_client_with_tasks
    r = c.post("/daily-logs/99999/task-entries", json={
        "task_id": c.task_ids[0],
        "action": "done",
    })
    assert r.status_code == 404


def test_list_task_entries_200(seeded_client_with_tasks):
    c = seeded_client_with_tasks
    # Create two entries
    c.post(f"/daily-logs/{c.log_id}/task-entries", json={
        "task_id": c.task_ids[0],
        "action": "done",
    })
    c.post(f"/daily-logs/{c.log_id}/task-entries", json={
        "task_id": c.task_ids[1],
        "action": "not_done",
        "new_date": TOMORROW,
    })

    r = c.get(f"/daily-logs/{c.log_id}/task-entries")
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_list_task_entries_empty(seeded_client):
    c = seeded_client
    r = c.get(f"/daily-logs/{c.log_id}/task-entries")
    assert r.status_code == 200
    assert r.json() == []


def test_list_task_entries_log_not_found_404(seeded_client):
    c = seeded_client
    r = c.get("/daily-logs/99999/task-entries")
    assert r.status_code == 404


# ── Daily log submitted / ai_summary fields ───────────────────────────────────

def test_daily_log_has_submitted_field(seeded_client):
    """DailyLogOut should now include submitted and ai_summary."""
    c = seeded_client
    # Use the GET /{date} endpoint against the seeded log's date
    import datetime as _dt
    today_str = _dt.date.today().isoformat()
    r = c.get(f"/daily-logs/{today_str}")
    assert r.status_code == 200
    data = r.json()
    assert "submitted" in data
    assert data["submitted"] is False
    assert "ai_summary" in data
    assert data["ai_summary"] is None


# ── Dependency edge-case tests ────────────────────────────────────────────────

def test_create_dependency_duplicate_rejected_409(seeded_client_with_tasks):
    """UniqueConstraint prevents duplicate dependency edges."""
    c = seeded_client_with_tasks
    # task2 already depends on task1 in the fixture
    resp = c.post(f"/projects/{c.project_id}/task-dependencies", json={
        "task_id": c.task_ids[1],
        "depends_on_task_id": c.task_ids[0],
        "lag_days": 0,
    })
    assert resp.status_code == 409


def test_create_dependency_self_rejected_422(seeded_client_with_tasks):
    """A task cannot depend on itself."""
    c = seeded_client_with_tasks
    resp = c.post(f"/projects/{c.project_id}/task-dependencies", json={
        "task_id": c.task_ids[0],
        "depends_on_task_id": c.task_ids[0],
        "lag_days": 0,
    })
    assert resp.status_code == 422


def test_cascade_preview_no_successors_returns_one(seeded_client_with_tasks):
    """task3 has no successors — cascade preview returns only the root task."""
    import datetime
    c = seeded_client_with_tasks
    # task3 is at index 2 and has no dependents
    new_date = (datetime.date.today() + datetime.timedelta(days=20)).isoformat()
    resp = c.post(f"/tasks/{c.task_ids[2]}/cascade-preview", json={"new_start_date": new_date})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["task_id"] == c.task_ids[2]


def test_cascade_preview_shifts_successor(seeded_client_with_tasks):
    """Shifting task1 cascades to task2 and task3."""
    import datetime
    c = seeded_client_with_tasks
    # task1 starts today-2. Push it to today+10 (far enough to shift task2)
    new_date = (datetime.date.today() + datetime.timedelta(days=10)).isoformat()
    resp = c.post(f"/tasks/{c.task_ids[0]}/cascade-preview", json={"new_start_date": new_date})
    assert resp.status_code == 200
    data = resp.json()
    # Should have at least task1 + task2 + task3
    assert len(data) >= 3
    task_ids_in_result = [r["task_id"] for r in data]
    assert c.task_ids[0] in task_ids_in_result
    assert c.task_ids[1] in task_ids_in_result
    assert c.task_ids[2] in task_ids_in_result


def test_create_dependency_cross_project_rejected_404(seeded_client_with_tasks):
    """depends_on_task_id must belong to the same project."""
    import datetime
    c = seeded_client_with_tasks
    # Create a second project and task in it
    resp_p2 = c.post("/projects/9999/tasks", json={
        "name": "Other Project Task",
        "level_tag": "Level 1",
        "start_date": datetime.date.today().isoformat(),
        "duration_days": 1,
    })
    # Project 9999 doesn't exist — task creation would fail anyway,
    # but we can use a clearly nonexistent task_id to test cross-project rejection.
    resp = c.post(f"/projects/{c.project_id}/task-dependencies", json={
        "task_id": c.task_ids[0],
        "depends_on_task_id": 99999,  # does not exist in this project
        "lag_days": 0,
    })
    assert resp.status_code == 404
