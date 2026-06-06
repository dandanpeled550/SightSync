from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import CrewAttendance, CrewMember, DailyLog, User
from app.services.auth_service import get_current_user, require_project_member

router = APIRouter(tags=["crew"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class CrewMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    name: str
    id_number: Optional[str]
    profession: Optional[str]
    reason: Optional[str]


class CrewMemberCreate(BaseModel):
    name: str
    id_number: Optional[str] = None
    profession: Optional[str] = None
    reason: Optional[str] = None


class AttendanceUpsert(BaseModel):
    status: str  # present / absent / partial
    note: Optional[str] = None


class AttendanceOut(BaseModel):
    crew_member_id: int
    name: str
    id_number: Optional[str]
    profession: Optional[str]
    status: str
    note: Optional[str]


# ── Crew registry endpoints ───────────────────────────────────────────────────

@router.get("/projects/{project_id}/crew", response_model=list[CrewMemberOut])
def list_crew(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_project_member(project_id, current_user, db)
    return db.query(CrewMember).filter(CrewMember.project_id == project_id).all()


@router.post("/projects/{project_id}/crew", response_model=CrewMemberOut, status_code=201)
def add_crew_member(
    project_id: int,
    body: CrewMemberCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_project_member(project_id, current_user, db)
    member = CrewMember(project_id=project_id, **body.model_dump())
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


@router.put("/crew/{member_id}", response_model=CrewMemberOut)
def update_crew_member(
    member_id: int,
    body: CrewMemberCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    member = db.query(CrewMember).filter(CrewMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Crew member not found")
    require_project_member(member.project_id, current_user, db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(member, field, value)
    db.commit()
    db.refresh(member)
    return member


@router.delete("/crew/{member_id}", status_code=204)
def delete_crew_member(
    member_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    member = db.query(CrewMember).filter(CrewMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Crew member not found")
    require_project_member(member.project_id, current_user, db)
    db.delete(member)
    db.commit()


# ── Daily attendance endpoints ────────────────────────────────────────────────

@router.get("/daily-logs/{log_id}/attendance", response_model=list[AttendanceOut])
def get_attendance(
    log_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    log = db.query(DailyLog).filter(DailyLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Daily log not found")
    require_project_member(log.project_id, current_user, db)

    all_crew = db.query(CrewMember).filter(CrewMember.project_id == log.project_id).all()
    attendance_map = {
        a.crew_member_id: a
        for a in db.query(CrewAttendance).filter(CrewAttendance.daily_log_id == log_id).all()
    }

    return [
        AttendanceOut(
            crew_member_id=m.id,
            name=m.name,
            id_number=m.id_number,
            profession=m.profession,
            status=attendance_map[m.id].status if m.id in attendance_map else "absent",
            note=attendance_map[m.id].note if m.id in attendance_map else None,
        )
        for m in all_crew
    ]


@router.put("/daily-logs/{log_id}/attendance/{member_id}", response_model=AttendanceOut)
def upsert_attendance(
    log_id: int,
    member_id: int,
    body: AttendanceUpsert,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.status not in ("present", "absent", "partial"):
        raise HTTPException(status_code=422, detail="status must be present, absent, or partial")

    log = db.query(DailyLog).filter(DailyLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Daily log not found")
    require_project_member(log.project_id, current_user, db)

    member = db.query(CrewMember).filter(CrewMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Crew member not found")

    record = (
        db.query(CrewAttendance)
        .filter(CrewAttendance.daily_log_id == log_id, CrewAttendance.crew_member_id == member_id)
        .first()
    )
    if record:
        record.status = body.status
        record.note = body.note
    else:
        record = CrewAttendance(
            daily_log_id=log_id, crew_member_id=member_id, status=body.status, note=body.note
        )
        db.add(record)

    db.commit()
    return AttendanceOut(
        crew_member_id=member.id,
        name=member.name,
        id_number=member.id_number,
        profession=member.profession,
        status=record.status,
        note=record.note,
    )
