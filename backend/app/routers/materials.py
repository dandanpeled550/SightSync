from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import DailyLog, MaterialEntry, InventoryItem, User
from app.services.auth_service import get_current_user, require_project_member

router = APIRouter(tags=["materials"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class MaterialCreate(BaseModel):
    material_name: str
    quantity: float
    unit: str
    notes: Optional[str] = None
    inventory_item_id: Optional[int] = None


class MaterialOut(BaseModel):
    id: int
    daily_log_id: int
    material_name: str
    quantity: float
    unit: str
    notes: Optional[str]
    inventory_item_id: Optional[int]

    model_config = ConfigDict(from_attributes=True)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/daily-logs/{log_id}/materials", response_model=list[MaterialOut])
def list_materials(
    log_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    log = db.query(DailyLog).filter(DailyLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Daily log not found")
    require_project_member(log.project_id, current_user, db)
    return db.query(MaterialEntry).filter(MaterialEntry.daily_log_id == log_id).all()


@router.post("/daily-logs/{log_id}/materials", response_model=MaterialOut, status_code=201)
def create_material(
    log_id: int,
    body: MaterialCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    log = db.query(DailyLog).filter(DailyLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Daily log not found")
    require_project_member(log.project_id, current_user, db)

    if body.inventory_item_id is not None:
        inv = db.query(InventoryItem).filter(InventoryItem.id == body.inventory_item_id).first()
        if not inv:
            raise HTTPException(status_code=404, detail="Inventory item not found")
        inv.current_stock = max(0.0, inv.current_stock - body.quantity)

    entry = MaterialEntry(daily_log_id=log_id, **body.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/daily-logs/{log_id}/materials/{material_id}", status_code=204)
def delete_material(
    log_id: int,
    material_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    log = db.query(DailyLog).filter(DailyLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Daily log not found")
    require_project_member(log.project_id, current_user, db)
    entry = (
        db.query(MaterialEntry)
        .filter(MaterialEntry.id == material_id, MaterialEntry.daily_log_id == log_id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Material entry not found")

    if entry.inventory_item_id is not None:
        inv = db.query(InventoryItem).filter(InventoryItem.id == entry.inventory_item_id).first()
        if inv:
            inv.current_stock += entry.quantity

    db.delete(entry)
    db.commit()
