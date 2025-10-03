from sqlalchemy.orm import Session
from sqlalchemy.future import select
from fastapi import HTTPException, status, BackgroundTasks
import json
from uuid import UUID
from datetime import datetime, date, time
from app.schemas.group import GroupCreate, GroupNameChange
from app.db.repositories.group_repository import user_create_group, user_change_group_name

def create_group(db: Session, group_create: GroupCreate):
    return user_create_group(db, group_create)

def change_group_name(db: Session, change_name: GroupNameChange):
    return user_change_group_name(db, change_name)