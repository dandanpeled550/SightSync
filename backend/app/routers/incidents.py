from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import DailyLog, SafetyIncident

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


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/daily-logs/{log_id}/incidents", response_model=list[IncidentOut])
def list_incidents(log_id: int, db: Session = Depends(get_db)):
    if not db.query(DailyLog).filter(DailyLog.id == log_id).first():
        raise HTTPException(status_code=404, detail="Daily log not found")
    return db.query(SafetyIncident).filter(SafetyIncident.daily_log_id == log_id).all()


@router.post("/daily-logs/{log_id}/incidents", response_model=IncidentOut, status_code=201)
def create_incident(log_id: int, body: IncidentCreate, db: Session = Depends(get_db)):
    if not db.query(DailyLog).filter(DailyLog.id == log_id).first():
        raise HTTPException(status_code=404, detail="Daily log not found")
    incident = SafetyIncident(daily_log_id=log_id, **body.model_dump())
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return incident


@router.delete("/daily-logs/{log_id}/incidents/{incident_id}", status_code=204)
def delete_incident(log_id: int, incident_id: int, db: Session = Depends(get_db)):
    incident = (
        db.query(SafetyIncident)
        .filter(SafetyIncident.id == incident_id, SafetyIncident.daily_log_id == log_id)
        .first()
    )
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    db.delete(incident)
    db.commit()
