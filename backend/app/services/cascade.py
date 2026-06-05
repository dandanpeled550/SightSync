"""Cascade delay engine — Sprint 3 Stream A.

Implements BFS-based (Kahn's algorithm) cascade preview and apply for task
scheduling.  preview_cascade() never writes to the DB; apply_cascade() commits
the shifted dates.
"""

from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Dict, List, Set

from sqlalchemy.orm import Session

from app.models import Task, TaskDependency


@dataclass
class CascadeResult:
    task_id: int
    task_name: str
    old_start_date: date
    new_start_date: date
    old_end_date: date
    new_end_date: date
    days_shifted: int


def preview_cascade(
    db: Session,
    task_id: int,
    new_start_date: date,
    project_id: int,
) -> List[CascadeResult]:
    """Compute cascade shifts without writing to the DB.

    Raises ValueError if:
    - root task is not found (or does not belong to project_id)
    - a dependency cycle is detected
    """
    # 1. Load root task
    root = (
        db.query(Task)
        .filter(Task.id == task_id, Task.project_id == project_id)
        .first()
    )
    if root is None:
        raise ValueError(f"Task {task_id} not found in project {project_id}")

    # 2. Load all tasks for this project into a dict
    all_tasks: Dict[int, Task] = {
        t.id: t
        for t in db.query(Task).filter(Task.project_id == project_id).all()
    }
    all_task_ids: Set[int] = set(all_tasks.keys())

    # 3. Load all TaskDependency rows for tasks in this project
    deps = (
        db.query(TaskDependency)
        .filter(
            TaskDependency.task_id.in_(all_task_ids),
            TaskDependency.depends_on_task_id.in_(all_task_ids),
        )
        .all()
    )

    # 4. Build adjacency maps
    # successors[t] = list of (successor_task_id, lag_days) — tasks that depend ON t
    successors: Dict[int, List[tuple]] = defaultdict(list)
    # predecessors[t] = list of (predecessor_task_id, lag_days) — tasks t depends on
    predecessors: Dict[int, List[tuple]] = defaultdict(list)

    for dep in deps:
        # dep.task_id depends ON dep.depends_on_task_id
        successors[dep.depends_on_task_id].append((dep.task_id, dep.lag_days))
        predecessors[dep.task_id].append((dep.depends_on_task_id, dep.lag_days))

    # 5. BFS from root to find all downstream (transitively reachable successor) tasks
    downstream: Set[int] = set()
    bfs_queue: deque = deque([task_id])
    while bfs_queue:
        current = bfs_queue.popleft()
        for succ_id, _lag in successors[current]:
            if succ_id not in downstream:
                downstream.add(succ_id)
                bfs_queue.append(succ_id)

    # 6. Cycle check: if root is reachable from itself downstream → cycle
    if task_id in downstream:
        raise ValueError("Cycle detected in task dependencies")

    # 7. scheduled_end tracks the computed end-date for already-processed nodes
    # Initialise with root using the NEW start date
    scheduled_end: Dict[int, date] = {
        task_id: new_start_date + timedelta(days=root.duration_days)
    }

    # 8. Compute in-degree for downstream tasks, counting only edges from nodes
    #    in (downstream | {task_id}) — i.e., from the subgraph we are processing.
    #    The root (task_id) is already "resolved", so edges FROM the root to
    #    downstream nodes are pre-counted and then immediately decremented so
    #    that direct successors of the root enter the Kahn queue correctly.
    relevant_nodes: Set[int] = downstream | {task_id}
    in_degree: Dict[int, int] = {t: 0 for t in downstream}
    for t in downstream:
        for pred_id, _lag in predecessors[t]:
            if pred_id in relevant_nodes:
                in_degree[t] += 1

    # Pre-decrement for edges coming from the root, since the root is already
    # processed (its scheduled_end is initialised above).
    for succ_id, _lag in successors[task_id]:
        if succ_id in in_degree:
            in_degree[succ_id] -= 1

    # 9. Kahn's BFS: start with downstream nodes whose in-degree is 0
    kahn_queue: deque = deque(
        [t for t in downstream if in_degree[t] == 0]
    )

    results: List[CascadeResult] = []
    processed: Set[int] = set()

    # 10. Process each node in topological order
    while kahn_queue:
        curr_id = kahn_queue.popleft()
        processed.add(curr_id)
        task = all_tasks[curr_id]

        # Compute new_start = max over all predecessors within relevant_nodes
        new_start: date = task.start_date  # default: unchanged
        for pred_id, lag in predecessors[curr_id]:
            if pred_id in relevant_nodes:
                if pred_id in scheduled_end:
                    candidate = scheduled_end[pred_id] + timedelta(days=lag)
                else:
                    # Predecessor not shifted; use its stored end_date
                    candidate = all_tasks[pred_id].end_date + timedelta(days=lag)
                if candidate > new_start:
                    new_start = candidate

        if new_start > task.start_date:
            new_end = new_start + timedelta(days=task.duration_days)
            scheduled_end[curr_id] = new_end
            results.append(
                CascadeResult(
                    task_id=curr_id,
                    task_name=task.name,
                    old_start_date=task.start_date,
                    new_start_date=new_start,
                    old_end_date=task.end_date,
                    new_end_date=new_end,
                    days_shifted=(new_start - task.start_date).days,
                )
            )
        else:
            # Not shifted; record scheduled_end using the original dates so
            # further successors can use it as a potential predecessor
            scheduled_end[curr_id] = task.end_date

        # Decrement in-degree for successors; enqueue when it reaches 0
        for succ_id, _lag in successors[curr_id]:
            if succ_id in in_degree:
                in_degree[succ_id] -= 1
                if in_degree[succ_id] == 0:
                    kahn_queue.append(succ_id)

    # 11. Cycle check: if not all downstream nodes processed → cycle
    if len(processed) != len(downstream):
        raise ValueError("Cycle detected in task dependencies")

    # 12. Always include the root task itself as the first result
    root_new_end = new_start_date + timedelta(days=root.duration_days)
    root_result = CascadeResult(
        task_id=root.id,
        task_name=root.name,
        old_start_date=root.start_date,
        new_start_date=new_start_date,
        old_end_date=root.end_date,
        new_end_date=root_new_end,
        days_shifted=(new_start_date - root.start_date).days,
    )

    # 13. Return root first, then downstream results in BFS topological order
    return [root_result] + results


def apply_cascade(
    db: Session,
    task_id: int,
    new_start_date: date,
    project_id: int,
) -> List[CascadeResult]:
    """Compute cascade shifts AND write updated dates to the DB.

    Delegates to preview_cascade for cycle detection and calculation, then
    commits the new start_date/end_date for every affected task.

    Returns the same shape as preview_cascade.
    """
    results = preview_cascade(db, task_id, new_start_date, project_id)

    # Write all shifted dates back to the DB
    for r in results:
        task = db.query(Task).filter(Task.id == r.task_id).first()
        if task is not None:
            task.start_date = r.new_start_date
            task.end_date = r.new_end_date

    db.commit()
    return results
