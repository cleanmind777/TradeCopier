from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func
from sqlalchemy.future import select
import json
import secrets
from datetime import datetime, timezone
from uuid import UUID
from sqlalchemy.future import select
from app.schemas.group import GroupCreate
from app.models.group import Group

def user_create_group(
    db: Session, group_create: GroupCreate
):
    db_group = Group (
        user_id=group_create.user_id,
        name=group_create.name
    )
    db.add(db_group)
    db.commit()
    db.refresh(db_group)
    return db.query(Group).filter(Group.user_id==group_create.user_id).all()