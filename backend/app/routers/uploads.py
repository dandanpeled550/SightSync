"""File upload endpoint — stores images in the database for persistent storage."""
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import StoredPhoto, User
from app.services.auth_service import get_current_user

router = APIRouter(tags=["uploads"])

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_SIZE = 10 * 1024 * 1024  # 10 MB


class PhotoUploadOut(BaseModel):
    url: str


@router.post("/uploads/photo", response_model=PhotoUploadOut)
async def upload_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="Only JPEG, PNG, WebP, or GIF images are allowed")

    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")

    photo = StoredPhoto(content_type=file.content_type, data=content)
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return PhotoUploadOut(url=f"/uploads/photo/{photo.id}")


@router.get("/uploads/photo/{photo_id}")
def serve_photo(photo_id: int, db: Session = Depends(get_db)):
    photo = db.get(StoredPhoto, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    return Response(content=photo.data, media_type=photo.content_type)
