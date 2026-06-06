"""
Onboarding router: Excel schedule upload and confirm endpoints.

POST /projects/{project_id}/upload-schedule
POST /projects/{project_id}/confirm-schedule
"""

import asyncio
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Task, TaskDependency, User
from app.services.ai_extraction import ExtractionResult, extract_tasks_from_xlsx
from app.services.auth_service import get_current_user, require_project_member

router = APIRouter(tags=["onboarding"])


# ---------------------------------------------------------------------------
# Response / request schemas
# ---------------------------------------------------------------------------

class ExtractedTaskOut(BaseModel):
    name: str
    level_tag: str
    trade_tag: Optional[str]
    apartment_tag: Optional[str]
    room_tag: Optional[str]
    start_date: str
    duration_days: int
    workflow_id: str = ""


class WorkflowOut(BaseModel):
    id: str
    name: str
    task_indices: list


class InferredDependencyOut(BaseModel):
    task_index: int
    depends_on_index: int
    lag_days: int
    confidence: float
    reasoning: str
    type: str


class ExtractionResultOut(BaseModel):
    tasks: list[ExtractedTaskOut]
    workflows: list[WorkflowOut]
    dependencies: list[InferredDependencyOut]
    confidence: float
    error: Optional[str]
    raw_text_length: int


class ExtractedTaskIn(BaseModel):
    name: str
    level_tag: str
    trade_tag: Optional[str] = None
    apartment_tag: Optional[str] = None
    room_tag: Optional[str] = None
    start_date: str   # ISO date "YYYY-MM-DD"
    duration_days: int


class InferredDependencyIn(BaseModel):
    task_index: int
    depends_on_index: int
    lag_days: int = 0


class ConfirmScheduleIn(BaseModel):
    tasks: list[ExtractedTaskIn]
    dependencies: list[InferredDependencyIn] = []


class ConfirmScheduleOut(BaseModel):
    tasks_created: int
    deps_created: int = 0


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/projects/{project_id}/upload-schedule",
    response_model=ExtractionResultOut,
)
async def upload_schedule(
    project_id: int,
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_project_member(project_id, current_user, db)
    """Accept a .xlsx file, extract tasks via AI, and return the extraction result."""
    filename = file.filename or ""
    if not filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Only .xlsx files are supported")

    xlsx_bytes = await file.read()
    # Run the blocking AI call in a thread pool — keeps the event loop free
    # so uvicorn can handle keepalives during the 10-60s OpenAI/Claude API call.
    result: ExtractionResult = await asyncio.to_thread(extract_tasks_from_xlsx, xlsx_bytes)

    return ExtractionResultOut(
        tasks=[
            ExtractedTaskOut(
                name=t.name,
                level_tag=t.level_tag,
                trade_tag=t.trade_tag,
                apartment_tag=t.apartment_tag,
                room_tag=t.room_tag,
                start_date=t.start_date,
                duration_days=t.duration_days,
                workflow_id=t.workflow_id,
            )
            for t in result.tasks
        ],
        workflows=[
            WorkflowOut(
                id=wf.id,
                name=wf.name,
                task_indices=wf.task_indices,
            )
            for wf in result.workflows
        ],
        dependencies=[
            InferredDependencyOut(
                task_index=dep.task_index,
                depends_on_index=dep.depends_on_index,
                lag_days=dep.lag_days,
                confidence=dep.confidence,
                reasoning=dep.reasoning,
                type=dep.type,
            )
            for dep in result.dependencies
        ],
        confidence=result.confidence,
        error=result.error,
        raw_text_length=result.raw_text_length,
    )


@router.post(
    "/projects/{project_id}/confirm-schedule",
    response_model=ConfirmScheduleOut,
)
def confirm_schedule(
    project_id: int,
    body: ConfirmScheduleIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_project_member(project_id, current_user, db)
    """Delete all existing tasks for the project and insert the confirmed tasks."""
    # Clean slate: delete all existing tasks for this project
    db.query(Task).filter(Task.project_id == project_id).delete(synchronize_session=False)
    db.flush()

    # Insert new tasks — keep track of inserted DB ids by index
    inserted_tasks = []
    for task_in in body.tasks:
        start = date.fromisoformat(task_in.start_date)
        end = start + timedelta(days=task_in.duration_days)
        task = Task(
            project_id=project_id,
            name=task_in.name,
            level_tag=task_in.level_tag,
            trade_tag=task_in.trade_tag,
            apartment_tag=task_in.apartment_tag,
            room_tag=task_in.room_tag,
            start_date=start,
            duration_days=task_in.duration_days,
            end_date=end,
            status="pending",
            source="ai",
        )
        db.add(task)
        inserted_tasks.append(task)

    db.flush()  # populate task IDs before inserting dependencies

    # Insert dependencies — map task_index → DB task id
    deps_created = 0
    for dep_in in body.dependencies:
        task_idx = dep_in.task_index
        depends_on_idx = dep_in.depends_on_index

        # Validate indices are in range
        if task_idx < 0 or task_idx >= len(inserted_tasks):
            continue
        if depends_on_idx < 0 or depends_on_idx >= len(inserted_tasks):
            continue

        task_id = inserted_tasks[task_idx].id
        depends_on_task_id = inserted_tasks[depends_on_idx].id

        # Skip self-dependencies
        if task_id == depends_on_task_id:
            continue

        # Check for duplicate — skip silently
        existing = db.query(TaskDependency).filter(
            TaskDependency.task_id == task_id,
            TaskDependency.depends_on_task_id == depends_on_task_id,
        ).first()
        if existing:
            continue

        dep = TaskDependency(
            task_id=task_id,
            depends_on_task_id=depends_on_task_id,
            lag_days=dep_in.lag_days,
        )
        db.add(dep)
        deps_created += 1

    db.commit()
    return ConfirmScheduleOut(tasks_created=len(body.tasks), deps_created=deps_created)
