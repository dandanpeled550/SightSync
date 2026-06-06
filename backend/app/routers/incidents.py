from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import DailyLog, SafetyIncident, User
from app.services.auth_service import get_current_user, require_project_member

router = APIRouter(tags=["incidents"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class IncidentCreate(BaseModel):
    incident_type: str
    description: str
    people_involved: Optional[str] = None
    corrective_action: Optional[str] = None


class IncidentOut(BaseModel):
    id: int
    daily_log_id: int
    incident_type: str
    description: str
    people_involved: Optional[str]
    corrective_action: Optional[str]

    model_config = ConfigDict(from_attributes=True)


class IncidentWithDate(IncidentOut):
    date: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/daily-logs/{log_id}/incidents", response_model=list[IncidentOut])
def list_incidents(
    log_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    log = db.query(DailyLog).filter(DailyLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Daily log not found")
    require_project_member(log.project_id, current_user, db)
    return db.query(SafetyIncident).filter(SafetyIncident.daily_log_id == log_id).all()


@router.post("/daily-logs/{log_id}/incidents", response_model=IncidentOut, status_code=201)
def create_incident(
    log_id: int,
    body: IncidentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    log = db.query(DailyLog).filter(DailyLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Daily log not found")
    require_project_member(log.project_id, current_user, db)
    incident = SafetyIncident(daily_log_id=log_id, **body.model_dump())
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return incident


@router.get("/projects/{project_id}/incidents", response_model=list[IncidentWithDate])
def list_project_incidents(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_project_member(project_id, current_user, db)
    rows = (
        db.query(SafetyIncident, DailyLog.date)
        .join(DailyLog, SafetyIncident.daily_log_id == DailyLog.id)
        .filter(DailyLog.project_id == project_id)
        .order_by(DailyLog.date.desc())
        .all()
    )
    return [
        IncidentWithDate(
            id=inc.id,
            daily_log_id=inc.daily_log_id,
            incident_type=inc.incident_type,
            description=inc.description,
            people_involved=inc.people_involved,
            corrective_action=inc.corrective_action,
            date=str(date),
        )
        for inc, date in rows
    ]


@router.delete("/daily-logs/{log_id}/incidents/{incident_id}", status_code=204)
def delete_incident(
    log_id: int,
    incident_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    log = db.query(DailyLog).filter(DailyLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Daily log not found")
    require_project_member(log.project_id, current_user, db)
    incident = (
        db.query(SafetyIncident)
        .filter(SafetyIncident.id == incident_id, SafetyIncident.daily_log_id == log_id)
        .first()
    )
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    db.delete(incident)
    db.commit()
