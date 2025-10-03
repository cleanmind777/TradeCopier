from sqlalchemy.orm import Session
from sqlalchemy.future import select
from fastapi import HTTPException, status, BackgroundTasks
import json
from uuid import UUID
from datetime import datetime, date, time
from app.schemas.group import GroupCreate
from app.db.repositories.group_repository import user_create_group

def create_group(db: Session, group_create: GroupCreate):
    return user_create_group(db, group_create)