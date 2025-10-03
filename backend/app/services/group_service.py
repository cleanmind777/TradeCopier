from sqlalchemy.orm import Session
from sqlalchemy.future import select
from fastapi import HTTPException, status, BackgroundTasks
import json
from uuid import UUID
from datetime import datetime, date, time
from app.schemas.group import GroupCreate, GroupNameChange, GroupAddBroker, GroupSetQTY
from app.db.repositories.group_repository import user_create_group, user_change_group_name, user_add_broker_to_group, user_set_qty_to_group, user_del_group

def create_group(db: Session, group_create: GroupCreate):
    return user_create_group(db, group_create)

def change_group_name(db: Session, change_name: GroupNameChange):
    return user_change_group_name(db, change_name)

def add_broker_to_group(db: Session, group_add_broker: GroupAddBroker):
    return user_add_broker_to_group(db, group_add_broker)

def set_qty_to_group(db: Session, group_set_qty: GroupSetQTY):
    return user_set_qty_to_group (db, group_set_qty)

def del_group(db: Session, group_id: UUID):
    return user_del_group(db, group_id)