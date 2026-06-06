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
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Task
from app.services.ai_extraction import ExtractionResult, extract_tasks_from_xlsx

router = APIRouter(tags=["onboarding"])


# ---------------------------------------------------------------------------
# Response / request schemas
# ---------------------------------------------------------------------------

class ExtractedTaskOut(BaseModel):
    name: str
    level_tag: str
    trade_tag: Optional[str]
    start_date: str
    duration_days: int


class ExtractionResultOut(BaseModel):
    tasks: list[ExtractedTaskOut]
    confidence: float
    error: Optional[str]
    raw_text_length: int


class ExtractedTaskIn(BaseModel):
    name: str
    level_tag: str
    trade_tag: Optional[str] = None
    start_date: str   # ISO date "YYYY-MM-DD"
    duration_days: int


class ConfirmScheduleIn(BaseModel):
    tasks: list[ExtractedTaskIn]


class ConfirmScheduleOut(BaseModel):
    tasks_created: int


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
    db: Session = Depends(get_db),
):
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
                start_date=t.start_date,
                duration_days=t.duration_days,
            )
            for t in result.tasks
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
    db: Session = Depends(get_db),
):
    """Delete all existing tasks for the project and insert the confirmed tasks."""
    # Clean slate: delete all existing tasks for this project
    db.query(Task).filter(Task.project_id == project_id).delete(synchronize_session=False)
    db.flush()

    # Insert new tasks
    for task_in in body.tasks:
        start = date.fromisoformat(task_in.start_date)
        end = start + timedelta(days=task_in.duration_days)
        task = Task(
            project_id=project_id,
            name=task_in.name,
            level_tag=task_in.level_tag,
            trade_tag=task_in.trade_tag,
            start_date=start,
            duration_days=task_in.duration_days,
            end_date=end,
            status="pending",
            source="ai",
        )
        db.add(task)

    db.commit()
    return ConfirmScheduleOut(tasks_created=len(body.tasks))
