from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from uuid import UUID
from app.dependencies.database import get_db
from app.core.config import settings
from app.schemas.group import GroupAddBroker, GroupCreate, GroupNameChange, GroupSetQTY, GroupEdit
from app.services.group_service import create_group, change_group_name, add_broker_to_group, del_group, edit_group, get_group

router = APIRouter()


@router.post(
    "/create", status_code=status.HTTP_201_CREATED
)
def create_Group(group_create: GroupCreate, db: Session = Depends(get_db)):
    return create_group(db, group_create)

@router.get(
    "/get", status_code=status.HTTP_201_CREATED
)
def get_Group(user_id: UUID, db: Session = Depends(get_db)):
    return get_group(db, user_id)

@router.post(
    "/edit", status_code=status.HTTP_201_CREATED
)
def edit_Group(group_edit: GroupEdit, db: Session = Depends(get_db)):
    return edit_group(db, group_edit)

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

@router.delete(
    "/delete", status_code=status.HTTP_201_CREATED
)
def del_Group(group_id: UUID, db: Session = Depends(get_db)):
    return del_group(db, group_id)