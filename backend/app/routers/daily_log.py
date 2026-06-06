import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import DailyLog, Project, User
from app.services.weather import fetch_weather_for_location
from app.services.auth_service import get_current_user, require_project_member

router = APIRouter(tags=["daily-logs"])


class WeatherOut(BaseModel):
    temp_max: Optional[float]
    temp_min: Optional[float]
    conditions: Optional[str]
    precipitation: Optional[float]
    wind_speed: Optional[float]
    error: Optional[str]


class DailyLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    date: str
    weather: WeatherOut
    submitted: bool
    ai_summary: Optional[str]


def _serialize(log: DailyLog) -> DailyLogOut:
    return DailyLogOut(
        id=log.id,
        project_id=log.project_id,
        date=log.date.isoformat(),
        weather=WeatherOut(
            temp_max=log.weather_temp_max,
            temp_min=log.weather_temp_min,
            conditions=log.weather_conditions,
            precipitation=log.weather_precipitation,
            wind_speed=log.weather_wind_speed,
            error=log.weather_error,
        ),
        submitted=log.submitted if log.submitted is not None else False,
        ai_summary=log.ai_summary,
    )


@router.post("/projects/{project_id}/daily-logs/today", response_model=DailyLogOut)
async def get_or_create_today(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DailyLogOut:
    require_project_member(project_id, current_user, db)
    today = datetime.date.today()

    existing = (
        db.query(DailyLog)
        .filter(DailyLog.project_id == project_id, DailyLog.date == today)
        .first()
    )
    if existing:
        return _serialize(existing)

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    log = DailyLog(project_id=project_id, date=today)

    try:
        weather = await fetch_weather_for_location(project.latitude, project.longitude)
        for key, val in weather.items():
            setattr(log, key, val)
    except Exception as exc:
        log.weather_error = str(exc)

    db.add(log)
    db.commit()
    db.refresh(log)
    return _serialize(log)


@router.post("/projects/{project_id}/daily-logs/{log_id}/refetch-weather", response_model=DailyLogOut)
async def refetch_weather(
    project_id: int,
    log_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DailyLogOut:
    require_project_member(project_id, current_user, db)
    log = db.query(DailyLog).filter(DailyLog.id == log_id, DailyLog.project_id == project_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Daily log not found")

    project = db.query(Project).filter(Project.id == log.project_id).first()
    try:
        weather = await fetch_weather_for_location(project.latitude, project.longitude)
        for key, val in weather.items():
            setattr(log, key, val)
        log.weather_error = None
    except Exception as exc:
        log.weather_error = str(exc)

    db.commit()
    db.refresh(log)
    return _serialize(log)


@router.get("/projects/{project_id}/daily-logs/{date}", response_model=DailyLogOut)
def get_log_by_date(
    project_id: int,
    date: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DailyLogOut:
    require_project_member(project_id, current_user, db)
    try:
        parsed = datetime.date.fromisoformat(date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Date must be ISO format: YYYY-MM-DD")

    log = (
        db.query(DailyLog)
        .filter(DailyLog.project_id == project_id, DailyLog.date == parsed)
        .first()
    )
    if not log:
        raise HTTPException(status_code=404, detail=f"No log found for {date}")

    return _serialize(log)
