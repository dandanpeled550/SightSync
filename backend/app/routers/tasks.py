"""Tasks router — Sprint 2 Task Data Layer + Sprint 3 Cascade endpoints."""
import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import DailyLog, Task, TaskDependency, TaskLogEntry
from app.services.cascade import CascadeResult, apply_cascade, preview_cascade

router = APIRouter(tags=["tasks"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class TaskCreate(BaseModel):
    name: str
    description: Optional[str] = None
    level_tag: str
    trade_tag: Optional[str] = None
    start_date: datetime.date
    duration_days: int = 1
    status: str = "pending"
    source: str = "manual"
    notes: Optional[str] = None


class TaskUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    level_tag: Optional[str] = None
    trade_tag: Optional[str] = None
    start_date: Optional[datetime.date] = None
    duration_days: Optional[int] = None
    status: Optional[str] = None
    source: Optional[str] = None
    notes: Optional[str] = None


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    name: str
    description: Optional[str]
    level_tag: str
    trade_tag: Optional[str]
    start_date: datetime.date
    duration_days: int
    end_date: datetime.date
    status: str
    source: str
    notes: Optional[str]


class TaskDependencyCreate(BaseModel):
    task_id: int
    depends_on_task_id: int
    lag_days: int = 0


class TaskDependencyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: int
    depends_on_task_id: int
    lag_days: int


class TaskLogEntryCreate(BaseModel):
    task_id: int
    action: str  # "done" or "not_done"
    new_date: Optional[datetime.date] = None
    reason: Optional[str] = None


class TaskLogEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    daily_log_id: int
    task_id: int
    action: str
    new_date: Optional[datetime.date]
    reason: Optional[str]


# ── Task CRUD ─────────────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/tasks", response_model=List[TaskOut])
def list_tasks(project_id: int, db: Session = Depends(get_db)):
    return db.query(Task).filter(Task.project_id == project_id).all()


@router.post("/projects/{project_id}/tasks", response_model=TaskOut, status_code=201)
def create_task(project_id: int, body: TaskCreate, db: Session = Depends(get_db)):
    end_date = body.start_date + datetime.timedelta(days=body.duration_days)
    task = Task(
        project_id=project_id,
        end_date=end_date,
        **body.model_dump(),
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.post("/projects/{project_id}/tasks/bulk", response_model=List[TaskOut], status_code=201)
def create_tasks_bulk(project_id: int, body: List[TaskCreate], db: Session = Depends(get_db)):
    tasks = []
    for item in body:
        end_date = item.start_date + datetime.timedelta(days=item.duration_days)
        task = Task(
            project_id=project_id,
            end_date=end_date,
            **item.model_dump(),
        )
        db.add(task)
        tasks.append(task)
    db.commit()
    for t in tasks:
        db.refresh(t)
    return tasks


@router.get("/projects/{project_id}/tasks/today", response_model=List[TaskOut])
def list_tasks_today(project_id: int, db: Session = Depends(get_db)):
    today = datetime.date.today()
    return (
        db.query(Task)
        .filter(
            Task.project_id == project_id,
            Task.start_date <= today,
            Task.status != "done",
        )
        .all()
    )


@router.put("/tasks/{task_id}", response_model=TaskOut)
def update_task(task_id: int, body: TaskUpdate, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    update_data = body.model_dump(exclude_unset=True)

    # Recompute end_date if start_date or duration_days changes
    if "start_date" in update_data or "duration_days" in update_data:
        new_start = update_data.get("start_date", task.start_date)
        new_duration = update_data.get("duration_days", task.duration_days)
        update_data["end_date"] = new_start + datetime.timedelta(days=new_duration)

    for field, value in update_data.items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)
    return task


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()


# ── Task Dependencies ─────────────────────────────────────────────────────────

@router.post("/projects/{project_id}/task-dependencies", response_model=TaskDependencyOut, status_code=201)
def create_task_dependency(project_id: int, body: TaskDependencyCreate, db: Session = Depends(get_db)):
    if body.task_id == body.depends_on_task_id:
        raise HTTPException(status_code=422, detail="A task cannot depend on itself")

    task = db.query(Task).filter(Task.id == body.task_id, Task.project_id == project_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="task_id not found in this project")

    depends_on = db.query(Task).filter(Task.id == body.depends_on_task_id, Task.project_id == project_id).first()
    if not depends_on:
        raise HTTPException(status_code=404, detail="depends_on_task_id not found in this project")

    existing = db.query(TaskDependency).filter(
        TaskDependency.task_id == body.task_id,
        TaskDependency.depends_on_task_id == body.depends_on_task_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Dependency already exists")

    dep = TaskDependency(
        task_id=body.task_id,
        depends_on_task_id=body.depends_on_task_id,
        lag_days=body.lag_days,
    )
    db.add(dep)
    db.commit()
    db.refresh(dep)
    return dep


@router.delete("/task-dependencies/{dep_id}", status_code=204)
def delete_task_dependency(dep_id: int, db: Session = Depends(get_db)):
    dep = db.query(TaskDependency).filter(TaskDependency.id == dep_id).first()
    if not dep:
        raise HTTPException(status_code=404, detail="Task dependency not found")
    db.delete(dep)
    db.commit()


# ── Task Log Entries ──────────────────────────────────────────────────────────

@router.post("/daily-logs/{log_id}/task-entries", response_model=TaskLogEntryOut, status_code=201)
def create_task_entry(log_id: int, body: TaskLogEntryCreate, db: Session = Depends(get_db)):
    log = db.query(DailyLog).filter(DailyLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Daily log not found")

    if body.action not in ("done", "not_done"):
        raise HTTPException(status_code=422, detail="action must be 'done' or 'not_done'")

    if body.action == "not_done" and body.new_date is None:
        raise HTTPException(status_code=422, detail="new_date is required when action is 'not_done'")

    task = db.query(Task).filter(Task.id == body.task_id, Task.project_id == log.project_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="task_id not found in this project")

    existing = db.query(TaskLogEntry).filter(
        TaskLogEntry.daily_log_id == log_id,
        TaskLogEntry.task_id == body.task_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Task entry already exists for this log and task")

    entry = TaskLogEntry(
        daily_log_id=log_id,
        task_id=body.task_id,
        action=body.action,
        new_date=body.new_date,
        reason=body.reason,
    )
    db.add(entry)

    # Reflect the mark on the task itself so tasks/today stays accurate
    if body.action == "done":
        task.status = "done"
    else:
        task.start_date = body.new_date
        task.end_date = body.new_date + datetime.timedelta(days=task.duration_days)

    db.commit()
    db.refresh(entry)
    return entry


@router.get("/daily-logs/{log_id}/task-entries", response_model=List[TaskLogEntryOut])
def list_task_entries(log_id: int, db: Session = Depends(get_db)):
    log = db.query(DailyLog).filter(DailyLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Daily log not found")
    return db.query(TaskLogEntry).filter(TaskLogEntry.daily_log_id == log_id).all()


# ── Cascade Delay Engine (Sprint 3) ──────────────────────────────────────────

class CascadeRequest(BaseModel):
    new_start_date: datetime.date


class CascadeResultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    task_id: int
    task_name: str
    old_start_date: datetime.date
    new_start_date: datetime.date
    old_end_date: datetime.date
    new_end_date: datetime.date
    days_shifted: int


def _cascade_result_to_out(r: CascadeResult) -> CascadeResultOut:
    return CascadeResultOut(
        task_id=r.task_id,
        task_name=r.task_name,
        old_start_date=r.old_start_date,
        new_start_date=r.new_start_date,
        old_end_date=r.old_end_date,
        new_end_date=r.new_end_date,
        days_shifted=r.days_shifted,
    )


@router.post("/tasks/{task_id}/cascade-preview", response_model=List[CascadeResultOut])
def cascade_preview(task_id: int, body: CascadeRequest, db: Session = Depends(get_db)):
    """Preview cascade delays without writing to the DB."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    try:
        results = preview_cascade(db, task_id, body.new_start_date, task.project_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return [_cascade_result_to_out(r) for r in results]


@router.post("/tasks/{task_id}/cascade-apply", response_model=List[CascadeResultOut])
def cascade_apply(task_id: int, body: CascadeRequest, db: Session = Depends(get_db)):
    """Apply cascade delays and persist new dates to the DB."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    try:
        results = apply_cascade(db, task_id, body.new_start_date, task.project_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return [_cascade_result_to_out(r) for r in results]
