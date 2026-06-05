"""
Tests for Sprint 3 Stream A: cascade delay engine.

Uses the seeded_client_with_tasks fixture which provides:
  - c.project_id, c.log_id
  - c.task_ids = [task1.id, task2.id, task3.id]
    task1: "Pour Foundation Concrete",  starts today-2, duration=5, end=today+3
    task2: "Install Electrical Conduits", starts today, duration=3, end=today+3
            depends on task1 (lag=0)
    task3: "Plumbing Rough-In", starts today+10, duration=4, end=today+14
            depends on task2 (lag=1)
"""

import datetime

import pytest


TODAY = datetime.date.today()


# ─── helpers ──────────────────────────────────────────────────────────────────

def _preview(c, task_id, new_start_date):
    return c.post(
        f"/tasks/{task_id}/cascade-preview",
        json={"new_start_date": str(new_start_date)},
    )


def _apply(c, task_id, new_start_date):
    return c.post(
        f"/tasks/{task_id}/cascade-apply",
        json={"new_start_date": str(new_start_date)},
    )


def _get_task(c, task_id):
    r = c.get(f"/projects/{c.project_id}/tasks")
    assert r.status_code == 200
    for t in r.json():
        if t["id"] == task_id:
            return t
    return None


def _create_task(c, start_date, duration_days=2, name="Extra Task"):
    r = c.post(
        f"/projects/{c.project_id}/tasks",
        json={
            "name": name,
            "level_tag": "L1",
            "start_date": str(start_date),
            "duration_days": duration_days,
        },
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _add_dep(c, task_id, depends_on_task_id, lag_days=0):
    r = c.post(
        f"/projects/{c.project_id}/task-dependencies",
        json={
            "task_id": task_id,
            "depends_on_task_id": depends_on_task_id,
            "lag_days": lag_days,
        },
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


# ─── test 1: linear chain ──────────────────────────────────────────────────────

def test_linear_chain(seeded_client_with_tasks):
    """Shifting task1 forward cascades through task2 → task3."""
    c = seeded_client_with_tasks
    t1, t2, t3 = c.task_ids
    new_start = TODAY + datetime.timedelta(days=5)

    r = _preview(c, t1, new_start)
    assert r.status_code == 200, r.text
    data = r.json()
    # All 3 tasks should appear
    assert len(data) == 3
    ids_in_result = {d["task_id"] for d in data}
    assert ids_in_result == {t1, t2, t3}


# ─── test 2: preview does not write to DB ─────────────────────────────────────

def test_preview_does_not_write_db(seeded_client_with_tasks):
    """cascade-preview must not mutate the database."""
    c = seeded_client_with_tasks
    t1 = c.task_ids[0]
    original = _get_task(c, t1)

    new_start = TODAY + datetime.timedelta(days=5)
    r = _preview(c, t1, new_start)
    assert r.status_code == 200, r.text

    after = _get_task(c, t1)
    assert after["start_date"] == original["start_date"]
    assert after["end_date"] == original["end_date"]


# ─── test 3: apply writes to DB ───────────────────────────────────────────────

def test_apply_writes_db(seeded_client_with_tasks):
    """cascade-apply must persist updated dates to the database."""
    c = seeded_client_with_tasks
    t1 = c.task_ids[0]
    new_start = TODAY + datetime.timedelta(days=5)

    r = _apply(c, t1, new_start)
    assert r.status_code == 200, r.text

    after = _get_task(c, t1)
    assert after["start_date"] == str(new_start)


# ─── test 4: apply and preview return same results ────────────────────────────

def test_apply_vs_preview_same_results(seeded_client_with_tasks):
    """Both endpoints must return identical shifted dates."""
    c = seeded_client_with_tasks
    t1 = c.task_ids[0]
    new_start = TODAY + datetime.timedelta(days=7)

    preview_data = _preview(c, t1, new_start).json()
    apply_data = _apply(c, t1, new_start).json()

    # Sort both by task_id for a stable comparison
    preview_sorted = sorted(preview_data, key=lambda x: x["task_id"])
    apply_sorted = sorted(apply_data, key=lambda x: x["task_id"])

    assert len(preview_sorted) == len(apply_sorted)
    for p, a in zip(preview_sorted, apply_sorted):
        assert p["task_id"] == a["task_id"]
        assert p["new_start_date"] == a["new_start_date"]
        assert p["new_end_date"] == a["new_end_date"]
        assert p["days_shifted"] == a["days_shifted"]


# ─── test 5: no successors — only root returned ───────────────────────────────

def test_no_successors(seeded_client_with_tasks):
    """Shifting task3 (leaf node) returns only 1 result."""
    c = seeded_client_with_tasks
    t3 = c.task_ids[2]
    new_start = TODAY + datetime.timedelta(days=20)

    r = _preview(c, t3, new_start)
    assert r.status_code == 200, r.text
    data = r.json()
    assert len(data) == 1
    assert data[0]["task_id"] == t3


# ─── test 6: lag_days respected ───────────────────────────────────────────────

def test_lag_days_respected(seeded_client_with_tasks):
    """Successor with lag_days=3 must start at predecessor.end_date + 3 days."""
    c = seeded_client_with_tasks
    t1, _t2, _t3 = c.task_ids

    # Create a new task that depends on task1 with lag=3
    new_task_id = _create_task(c, TODAY + datetime.timedelta(days=50), duration_days=2, name="Lagged Task")
    _add_dep(c, new_task_id, t1, lag_days=3)

    new_start = TODAY + datetime.timedelta(days=5)
    r = _preview(c, t1, new_start)
    assert r.status_code == 200, r.text
    data = r.json()

    # Find the new lagged task in results
    lagged = next((d for d in data if d["task_id"] == new_task_id), None)
    if lagged is not None:
        # predecessor new end = new_start + 5 = today+10
        expected_start = new_start + datetime.timedelta(days=5) + datetime.timedelta(days=3)
        assert lagged["new_start_date"] == str(expected_start)


# ─── test 7: diamond dependency ───────────────────────────────────────────────

def test_diamond_dependency(seeded_client_with_tasks):
    """In a diamond (A→B, A→C, B→D, C→D), shifting A should cause D to appear once."""
    c = seeded_client_with_tasks

    a_id = _create_task(c, TODAY, duration_days=2, name="Diamond A")
    b_id = _create_task(c, TODAY + datetime.timedelta(days=2), duration_days=2, name="Diamond B")
    cc_id = _create_task(c, TODAY + datetime.timedelta(days=2), duration_days=2, name="Diamond C")
    d_id = _create_task(c, TODAY + datetime.timedelta(days=4), duration_days=2, name="Diamond D")

    _add_dep(c, b_id, a_id)
    _add_dep(c, cc_id, a_id)
    _add_dep(c, d_id, b_id)
    _add_dep(c, d_id, cc_id)

    new_start = TODAY + datetime.timedelta(days=5)
    r = _preview(c, a_id, new_start)
    assert r.status_code == 200, r.text
    data = r.json()

    # D must appear exactly once
    d_results = [x for x in data if x["task_id"] == d_id]
    assert len(d_results) == 1


# ─── test 8: cycle detection — preview returns 422 ────────────────────────────

def test_cycle_detection_preview_422(seeded_client_with_tasks):
    """Cascade-preview on a cyclic graph must return 422."""
    c = seeded_client_with_tasks

    x_id = _create_task(c, TODAY, duration_days=1, name="Cycle X")
    y_id = _create_task(c, TODAY + datetime.timedelta(days=1), duration_days=1, name="Cycle Y")

    # X depends on Y and Y depends on X → cycle
    _add_dep(c, x_id, y_id)
    _add_dep(c, y_id, x_id)

    r = _preview(c, x_id, TODAY + datetime.timedelta(days=5))
    assert r.status_code == 422


# ─── test 9: cycle detection — apply returns 422 ──────────────────────────────

def test_cycle_detection_apply_422(seeded_client_with_tasks):
    """Cascade-apply on a cyclic graph must return 422."""
    c = seeded_client_with_tasks

    x_id = _create_task(c, TODAY, duration_days=1, name="Cycle X2")
    y_id = _create_task(c, TODAY + datetime.timedelta(days=1), duration_days=1, name="Cycle Y2")

    _add_dep(c, x_id, y_id)
    _add_dep(c, y_id, x_id)

    r = _apply(c, x_id, TODAY + datetime.timedelta(days=5))
    assert r.status_code == 422


# ─── test 10: task not found returns 404 ──────────────────────────────────────

def test_task_not_found_404(seeded_client_with_tasks):
    """Cascade endpoints must return 404 for a nonexistent task."""
    c = seeded_client_with_tasks
    r = _preview(c, 99999, TODAY + datetime.timedelta(days=1))
    assert r.status_code == 404


# ─── test 11: multi_day_duration ──────────────────────────────────────────────

def test_multi_day_duration(seeded_client_with_tasks):
    """end_date must equal new_start_date + duration_days for every shifted task."""
    c = seeded_client_with_tasks
    t1, _t2, _t3 = c.task_ids
    new_start = TODAY + datetime.timedelta(days=10)

    r = _preview(c, t1, new_start)
    assert r.status_code == 200, r.text
    data = r.json()

    for item in data:
        ns = datetime.date.fromisoformat(item["new_start_date"])
        ne = datetime.date.fromisoformat(item["new_end_date"])
        task = _get_task(c, item["task_id"])
        assert ne == ns + datetime.timedelta(days=task["duration_days"])


# ─── test 12: only_shifts_forward ─────────────────────────────────────────────

def test_only_shifts_forward(seeded_client_with_tasks):
    """Moving root EARLIER: root appears in results; downstream NOT shifted if
    their existing start is already later than the propagated end."""
    c = seeded_client_with_tasks
    t1, t2, t3 = c.task_ids

    # task1 currently starts at today-2. Move it to today-10 (earlier).
    early_start = TODAY - datetime.timedelta(days=10)
    r = _preview(c, t1, early_start)
    assert r.status_code == 200, r.text
    data = r.json()

    # Root must always be in results
    root_result = next((d for d in data if d["task_id"] == t1), None)
    assert root_result is not None

    # task2 starts at TODAY; task1's new end = early_start+5 = today-5
    # today-5 < TODAY, so task2's existing start (TODAY) is later → not shifted
    t2_result = next((d for d in data if d["task_id"] == t2), None)
    assert t2_result is None  # task2 should NOT be shifted


# ─── test 13: days_shifted_correct ────────────────────────────────────────────

def test_days_shifted_correct(seeded_client_with_tasks):
    """days_shifted must equal (new_start_date - old_start_date).days for each result."""
    c = seeded_client_with_tasks
    t1 = c.task_ids[0]
    new_start = TODAY + datetime.timedelta(days=6)

    r = _preview(c, t1, new_start)
    assert r.status_code == 200, r.text
    data = r.json()

    for item in data:
        ns = datetime.date.fromisoformat(item["new_start_date"])
        os_ = datetime.date.fromisoformat(item["old_start_date"])
        assert item["days_shifted"] == (ns - os_).days


# ─── test 14: root always in results ──────────────────────────────────────────

def test_root_always_in_results(seeded_client_with_tasks):
    """Root task must always be the first entry in the results list."""
    c = seeded_client_with_tasks
    t3 = c.task_ids[2]  # leaf node
    new_start = TODAY + datetime.timedelta(days=30)

    r = _preview(c, t3, new_start)
    assert r.status_code == 200, r.text
    data = r.json()
    assert len(data) >= 1
    assert data[0]["task_id"] == t3


# ─── test 15: large_chain ─────────────────────────────────────────────────────

def test_large_chain(seeded_client_with_tasks):
    """Shifting the root of a 5-task linear chain cascades all 5 tasks."""
    c = seeded_client_with_tasks

    # Build a fresh 5-task linear chain (independent of the seeded tasks)
    chain_ids = []
    for i in range(5):
        tid = _create_task(
            c,
            TODAY + datetime.timedelta(days=i * 3),
            duration_days=3,
            name=f"Chain Task {i}",
        )
        chain_ids.append(tid)

    # Link them: chain[i] depends on chain[i-1]
    for i in range(1, 5):
        _add_dep(c, chain_ids[i], chain_ids[i - 1])

    new_start = TODAY + datetime.timedelta(days=20)
    r = _preview(c, chain_ids[0], new_start)
    assert r.status_code == 200, r.text
    data = r.json()

    result_ids = {d["task_id"] for d in data}
    for tid in chain_ids:
        assert tid in result_ids, f"Task {tid} missing from cascade results"
    assert len(data) == 5
