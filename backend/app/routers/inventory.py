from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import InventoryItem, Project, User
from app.services.auth_service import get_current_user, require_project_member

router = APIRouter(tags=["inventory"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class InventoryItemCreate(BaseModel):
    name: str
    unit: str = ""
    current_stock: float = 0.0
    min_stock_alert: Optional[float] = None


class InventoryItemUpdate(BaseModel):
    name: Optional[str] = None
    unit: Optional[str] = None
    current_stock: Optional[float] = None
    min_stock_alert: Optional[float] = None


class InventoryItemOut(BaseModel):
    id: int
    project_id: int
    name: str
    unit: str
    current_stock: float
    min_stock_alert: Optional[float]

    model_config = ConfigDict(from_attributes=True)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/inventory", response_model=list[InventoryItemOut])
def list_inventory(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_project_member(project_id, current_user, db)
    return db.query(InventoryItem).filter(InventoryItem.project_id == project_id).all()


@router.post("/projects/{project_id}/inventory", response_model=InventoryItemOut, status_code=201)
def create_inventory_item(
    project_id: int,
    body: InventoryItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_project_member(project_id, current_user, db)
    item = InventoryItem(project_id=project_id, **body.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/inventory/{item_id}", response_model=InventoryItemOut)
def update_inventory_item(
    item_id: int,
    body: InventoryItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    require_project_member(item.project_id, current_user, db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/inventory/{item_id}", status_code=204)
def delete_inventory_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    require_project_member(item.project_id, current_user, db)
    db.delete(item)
    db.commit()
