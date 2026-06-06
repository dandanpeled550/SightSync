"""Tests for cascade delay record persistence and GET /daily-logs/{log_id}/delays endpoint."""
import datetime
import pytest


@pytest.fixture()
def not_done_entry(seeded_client_with_tasks):
    """Helper: marks task1 as not_done and returns the response JSON."""
    c = seeded_client_with_tasks
    new_date = (datetime.date.today() + datetime.timedelta(days=5)).isoformat()
    r = c.post(
        f"/daily-logs/{c.log_id}/task-entries",
        json={"task_id": c.task_ids[0], "action": "not_done", "new_date": new_date, "reason": "Weather delay"},
    )
    assert r.status_code == 201, r.text
    return r.json()


# ── Record creation ───────────────────────────────────────────────────────────

def test_not_done_creates_cascade_delay_records(seeded_client_with_tasks, not_done_entry):
    """Marking a task not_done must create CascadeDelayRecord rows."""
    c = seeded_client_with_tasks
    r = c.get(f"/daily-logs/{c.log_id}/delays")
    assert r.status_code == 200
    groups = r.json()
    assert len(groups) == 1
    # At least the root record exists
    group = groups[0]
    assert group["trigger_task_name"] == "Pour Foundation Concrete"
    assert group["reason"] == "Weather delay"


def test_done_action_creates_no_delay_records(seeded_client_with_tasks):
    """Marking a task done must NOT create any delay records."""
    c = seeded_client_with_tasks
    r = c.post(
        f"/daily-logs/{c.log_id}/task-entries",
        json={"task_id": c.task_ids[0], "action": "done"},
    )
    assert r.status_code == 201
    r2 = c.get(f"/daily-logs/{c.log_id}/delays")
    assert r2.status_code == 200
    assert r2.json() == []


def test_root_record_has_is_root_true(seeded_client_with_tasks, not_done_entry):
    """The delay record for the directly-delayed task must have is_root=False in impacts
    (root info is in the group-level trigger fields, not the impacts list)."""
    c = seeded_client_with_tasks
    groups = c.get(f"/daily-logs/{c.log_id}/delays").json()
    group = groups[0]
    # Root task appears as group trigger, not in impacts list
    assert group["trigger_task_id"] == c.task_ids[0]
    for impact in group["impacts"]:
        assert impact["is_root"] is False


def test_cascade_impacts_in_impacts_list(seeded_client_with_tasks, not_done_entry):
    """Downstream cascade-shifted tasks must appear in impacts."""
    c = seeded_client_with_tasks
    groups = c.get(f"/daily-logs/{c.log_id}/delays").json()
    group = groups[0]
    # task2 and task3 depend on task1, so both should be in impacts
    impact_ids = [i["task_id"] for i in group["impacts"]]
    assert c.task_ids[1] in impact_ids  # task2
    assert c.task_ids[2] in impact_ids  # task3


def test_days_shifted_is_positive(seeded_client_with_tasks, not_done_entry):
    """All delay records must have days_shifted > 0 for a forward delay."""
    c = seeded_client_with_tasks
    groups = c.get(f"/daily-logs/{c.log_id}/delays").json()
    group = groups[0]
    for impact in group["impacts"]:
        assert impact["days_shifted"] > 0


def test_new_date_matches_entry(seeded_client_with_tasks, not_done_entry):
    """The group's new_date must match the task entry's new_date."""
    c = seeded_client_with_tasks
    groups = c.get(f"/daily-logs/{c.log_id}/delays").json()
    group = groups[0]
    assert group["new_date"] == not_done_entry["new_date"]


def test_delays_log_not_found_returns_404(seeded_client_with_tasks):
    c = seeded_client_with_tasks
    r = c.get("/daily-logs/99999/delays")
    assert r.status_code == 404


def test_no_delays_returns_empty_list(seeded_client_with_tasks):
    """With no not_done entries, the delays endpoint returns an empty list."""
    c = seeded_client_with_tasks
    r = c.get(f"/daily-logs/{c.log_id}/delays")
    assert r.status_code == 200
    assert r.json() == []


def test_leaf_task_delay_has_no_impacts(seeded_client_with_tasks):
    """Marking a leaf task (no downstream dependents) not_done has no impacts."""
    c = seeded_client_with_tasks
    # task3 is the leaf — nothing depends on it
    new_date = (datetime.date.today() + datetime.timedelta(days=20)).isoformat()
    r = c.post(
        f"/daily-logs/{c.log_id}/task-entries",
        json={"task_id": c.task_ids[2], "action": "not_done", "new_date": new_date},
    )
    assert r.status_code == 201
    groups = c.get(f"/daily-logs/{c.log_id}/delays").json()
    assert len(groups) == 1
    assert groups[0]["impacts"] == []


def test_multiple_not_done_entries_produce_multiple_groups(seeded_client_with_tasks):
    """Two separate not_done entries in one log produce two delay groups."""
    c = seeded_client_with_tasks
    # mark task1 not_done
    new1 = (datetime.date.today() + datetime.timedelta(days=5)).isoformat()
    c.post(f"/daily-logs/{c.log_id}/task-entries",
           json={"task_id": c.task_ids[0], "action": "not_done", "new_date": new1})
    # task2's date was cascaded by task1, but we can still mark task3 separately
    new3 = (datetime.date.today() + datetime.timedelta(days=25)).isoformat()
    c.post(f"/daily-logs/{c.log_id}/task-entries",
           json={"task_id": c.task_ids[2], "action": "not_done", "new_date": new3})

    groups = c.get(f"/daily-logs/{c.log_id}/delays").json()
    assert len(groups) == 2


def test_task_name_snapshot_preserved(seeded_client_with_tasks, not_done_entry):
    """Delay records store task_name as a snapshot in the group trigger."""
    c = seeded_client_with_tasks
    groups = c.get(f"/daily-logs/{c.log_id}/delays").json()
    assert groups[0]["trigger_task_name"] == "Pour Foundation Concrete"
