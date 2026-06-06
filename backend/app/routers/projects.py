from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project, ProjectMember, User
from app.services.auth_service import get_current_user, require_project_member, require_project_owner

router = APIRouter(tags=["projects"])


class ProjectIn(BaseModel):
    name: str
    location_city: str
    latitude: float
    longitude: float


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    location_city: str
    latitude: float
    longitude: float


class MemberIn(BaseModel):
    email: str
    role: str = "member"


@router.get("/projects", response_model=List[ProjectOut])
def list_projects(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ids = [m.project_id for m in db.query(ProjectMember).filter(ProjectMember.user_id == current_user.id).all()]
    return db.query(Project).filter(Project.id.in_(ids)).all()


@router.post("/projects", response_model=ProjectOut, status_code=201)
def create_project(payload: ProjectIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = Project(**payload.model_dump())
    db.add(p)
    db.flush()
    db.add(ProjectMember(user_id=current_user.id, project_id=p.id, role="owner"))
    db.commit()
    db.refresh(p)
    return p


@router.get("/projects/{project_id}", response_model=ProjectOut)
def get_project(project_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_project_member(project_id, current_user, db)
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return p


@router.put("/projects/{project_id}", response_model=ProjectOut)
def update_project(project_id: int, payload: ProjectIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_project_owner(project_id, current_user, db)
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    for k, v in payload.dict().items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_project_owner(project_id, current_user, db)
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(p)
    db.commit()


@router.post("/projects/{project_id}/members", status_code=201)
def add_member(project_id: int, payload: MemberIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_project_owner(project_id, current_user, db)
    u = db.query(User).filter(User.email == payload.email).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if db.query(ProjectMember).filter(ProjectMember.project_id == project_id, ProjectMember.user_id == u.id).first():
        raise HTTPException(status_code=409, detail="Already a member")
    db.add(ProjectMember(user_id=u.id, project_id=project_id, role=payload.role))
    db.commit()
    return {"user_id": u.id, "project_id": project_id, "role": payload.role}


@router.delete("/projects/{project_id}/members/{user_id}", status_code=204)
def remove_member(project_id: int, user_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_project_owner(project_id, current_user, db)
    m = db.query(ProjectMember).filter(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Member not found")
    db.delete(m)
    db.commit()
