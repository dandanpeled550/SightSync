"""Site photo gallery — standalone photos attached to a project/daily log."""
from datetime import datetime as _dt
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import SitePhoto, User
from app.services.auth_service import get_current_user, require_project_member

router = APIRouter(tags=["photos"])


class SitePhotoCreate(BaseModel):
    photo_url: str
    caption: Optional[str] = None
    daily_log_id: Optional[int] = None


class SitePhotoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    daily_log_id: Optional[int]
    photo_url: str
    caption: Optional[str]
    created_at: _dt


@router.get("/projects/{project_id}/photos", response_model=List[SitePhotoOut])
def list_photos(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_project_member(project_id, current_user, db)
    return (
        db.query(SitePhoto)
        .filter(SitePhoto.project_id == project_id)
        .order_by(SitePhoto.created_at.desc())
        .all()
    )


@router.post("/projects/{project_id}/photos", response_model=SitePhotoOut, status_code=201)
def create_photo(
    project_id: int,
    body: SitePhotoCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_project_member(project_id, current_user, db)
    photo = SitePhoto(project_id=project_id, **body.model_dump())
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return photo


@router.delete("/projects/{project_id}/photos/{photo_id}", status_code=204)
def delete_photo(
    project_id: int,
    photo_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_project_member(project_id, current_user, db)
    photo = db.query(SitePhoto).filter(
        SitePhoto.id == photo_id,
        SitePhoto.project_id == project_id,
    ).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    db.delete(photo)
    db.commit()
