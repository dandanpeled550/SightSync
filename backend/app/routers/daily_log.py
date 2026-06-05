import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import DailyLog, Project
from app.services.weather import fetch_weather_for_location

router = APIRouter(prefix="/daily-logs", tags=["daily-logs"])

HARDCODED_PROJECT_ID = 1


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
    )


@router.post("/today", response_model=DailyLogOut)
async def get_or_create_today(db: Session = Depends(get_db)) -> DailyLogOut:
    today = datetime.date.today()

    existing = (
        db.query(DailyLog)
        .filter(DailyLog.project_id == HARDCODED_PROJECT_ID, DailyLog.date == today)
        .first()
    )
    if existing:
        return _serialize(existing)

    project = db.query(Project).filter(Project.id == HARDCODED_PROJECT_ID).first()
    if not project:
        raise HTTPException(status_code=404, detail="Default project not found. Run the seed script first.")

    log = DailyLog(project_id=HARDCODED_PROJECT_ID, date=today)

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


@router.post("/{log_id}/refetch-weather", response_model=DailyLogOut)
async def refetch_weather(log_id: int, db: Session = Depends(get_db)) -> DailyLogOut:
    log = db.query(DailyLog).filter(DailyLog.id == log_id).first()
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


@router.get("/{date}", response_model=DailyLogOut)
def get_log_by_date(date: str, db: Session = Depends(get_db)) -> DailyLogOut:
    try:
        parsed = datetime.date.fromisoformat(date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Date must be ISO format: YYYY-MM-DD")

    log = (
        db.query(DailyLog)
        .filter(DailyLog.project_id == HARDCODED_PROJECT_ID, DailyLog.date == parsed)
        .first()
    )
    if not log:
        raise HTTPException(status_code=404, detail=f"No log found for {date}")

    return _serialize(log)
