from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from uuid import UUID
from app.dependencies.database import get_db
from app.core.config import settings
from app.schemas.group import GroupAddBroker, GroupCreate, GroupNameChange, GroupSetQTY
from app.services.group_service import create_group, change_group_name, add_broker_to_group, set_qty_to_group, del_group

router = APIRouter()


@router.post(
    "/create", status_code=status.HTTP_201_CREATED
)
def create_Group(group_create: GroupCreate, db: Session = Depends(get_db)):
    return create_group(db, group_create)

@router.post(
    "/change-name", status_code=status.HTTP_201_CREATED
)
def change_Group_name(change_name: GroupNameChange, db: Session = Depends(get_db)):
    return change_group_name(db, change_name)

@router.post(
    "/add-broker", status_code=status.HTTP_201_CREATED
)
def add_Broker_to_group(group_add_broker: GroupAddBroker, db: Session = Depends(get_db)):
    return add_broker_to_group(db, group_add_broker)

@router.post(
    "/set-qty", status_code=status.HTTP_201_CREATED
)
def set_Qty_to_group(group_set_qty: GroupSetQTY, db: Session = Depends(get_db)):
    return set_qty_to_group(db, group_set_qty)

@router.delete(
    "/delete", status_code=status.HTTP_201_CREATED
)
def del_Group(group_id: UUID, db: Session = Depends(get_db)):
    return del_group(db, group_id)