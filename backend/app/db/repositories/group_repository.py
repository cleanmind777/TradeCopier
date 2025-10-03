from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func
from sqlalchemy.future import select
import json
import secrets
from datetime import datetime, timezone
from uuid import UUID
from sqlalchemy.future import select
from app.schemas.group import GroupCreate, GroupNameChange, GroupAddBroker, GroupSetQTY
from app.models.group import Group
from app.models.group_broker import GroupBroker

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

def  user_change_group_name(db: Session, change_name: GroupNameChange):
    db_group = (
        db.query(Group)
        .filter(Group.id == change_name.group_id)
        .first()
    )
    db_group.name = change_name.new_name
    db.add(db_group)
    db.commit()
    db.refresh(db_group)
    return db.query(Group).filter(Group.user_id==db_group.user_id).all()

def user_add_broker_to_group(db: Session, group_add_broker: GroupAddBroker):
    for sub_broker in group_add_broker.sub_brokers:
        db_check = db.query(GroupBroker).filter(GroupBroker.group_id==group_add_broker.group_id).filter(GroupBroker.sub_broker_id==sub_broker).all()
        if db_check:
            continue
        db_group_broker = GroupBroker (
            group_id = group_add_broker.group_id,
            sub_broker_id = sub_broker
        )
        db.add(db_group_broker)
        db.commit() 
        db.refresh(db_group_broker)
    

    return db.query(GroupBroker).filter(GroupBroker.group_id==group_add_broker.group_id).all()

def  user_set_qty_to_group(db: Session, group_set_qty: GroupSetQTY):
    db_group = (
        db.query(Group)
        .filter(Group.id == group_set_qty.group_id)
        .first()
    )
    db_group.qty = group_set_qty.qty
    db.add(db_group)
    db.commit()
    db.refresh(db_group)
    return db.query(Group).filter(Group.user_id==db_group.user_id).all()