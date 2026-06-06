"""File upload endpoint — stores images to the local uploads/ directory."""
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.models import User
from app.services.auth_service import get_current_user

router = APIRouter(tags=["uploads"])

UPLOAD_DIR = Path("uploads")
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_SIZE = 10 * 1024 * 1024  # 10 MB


class PhotoUploadOut(BaseModel):
    url: str


@router.post("/uploads/photo", response_model=PhotoUploadOut)
async def upload_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="Only JPEG, PNG, WebP, or GIF images are allowed")

    UPLOAD_DIR.mkdir(exist_ok=True)

    ext = Path(file.filename or "photo.jpg").suffix.lower() or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = UPLOAD_DIR / filename

    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")

    dest.write_bytes(content)
    return PhotoUploadOut(url=f"/static/uploads/{filename}")
