from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func
from sqlalchemy.future import select
import json
import secrets
from datetime import datetime, timezone
from uuid import UUID
from sqlalchemy.future import select
from app.schemas.group import (
    GroupCreate,
    GroupNameChange,
    GroupAddBroker,
    GroupInfo,
    GroupEdit,
)
from app.schemas.broker import SubBrokerSumary
from app.models.group import Group
from app.models.group_broker import GroupBroker
from app.models.broker_account import SubBrokerAccount


def user_get_group(db: Session, user_id: UUID) -> list[GroupInfo]:
    db_groups = db.query(Group).filter(Group.user_id == user_id).all()
    groups_summary: list[GroupInfo] = []
    for group in db_groups:
        sub_brokers = (
            db.query(GroupBroker).filter(GroupBroker.group_id == group.id).all()
        )
        response_brokers: list[SubBrokerSumary] = []
        for sub_broker in sub_brokers:
            response_broker: SubBrokerSumary = {}
            db_sub_broker = (
                db.query(SubBrokerAccount)
                .filter(SubBrokerAccount.id == sub_broker.sub_broker_id)
                .first()
            )
            if db_sub_broker is None:
                # Skip missing sub-broker (might have been deleted)
                continue
            else:
                response_broker["id"] = db_sub_broker.id
                response_broker["nickname"] = db_sub_broker.nickname
                response_broker["sub_account_name"] = db_sub_broker.sub_account_name
                response_broker['qty'] = sub_broker.qty
                response_broker["sub_account_id"] = db_sub_broker.sub_account_id
                response_brokers.append(response_broker)
        group_summary = GroupInfo(
            id=group.id, name=group.name, sub_brokers=response_brokers,
            sl=group.sl if group.sl is not None else 0.0, 
            tp=group.tp if group.tp is not None else 0.0
        )
        groups_summary.append(group_summary)
    return groups_summary


def user_create_group(db: Session, group_create: GroupCreate) -> list[GroupInfo]:
    db_group = Group(
        user_id=group_create.user_id,
        name=group_create.name,
        sl=group_create.sl,
        tp=group_create.tp
    )
    db.add(db_group)
    db.commit()
    db.refresh(db_group)
    group_add_broker = GroupAddBroker(
        group_id=db_group.id, sub_brokers=group_create.sub_brokers
    )
    user_add_broker_to_group(db, group_add_broker)
    db_groups = db.query(Group).filter(Group.user_id == group_create.user_id).all()
    groups_summary: list[GroupInfo] = []
    for group in db_groups:
        sub_brokers = (
            db.query(GroupBroker).filter(GroupBroker.group_id == group.id).all()
        )
        response_brokers: list[SubBrokerSumary] = []
        for sub_broker in sub_brokers:
            response_broker: SubBrokerSumary = {}
            db_sub_broker = (
                db.query(SubBrokerAccount)
                .filter(SubBrokerAccount.id == sub_broker.sub_broker_id)
                .first()
            )
            response_broker["id"] = db_sub_broker.id
            response_broker["nickname"] = db_sub_broker.nickname
            response_broker["sub_account_name"] = db_sub_broker.sub_account_name
            response_broker["qty"] = sub_broker.qty
            response_broker["sub_account_id"] = db_sub_broker.sub_account_id
            response_brokers.append(response_broker)
        group_summary = GroupInfo(
            id=group.id, name=group.name, sub_brokers=response_brokers, 
            sl=group.sl if group.sl is not None else 0.0, 
            tp=group.tp if group.tp is not None else 0.0
        )
        groups_summary.append(group_summary)
    return groups_summary


def user_edit_group(db: Session, group_edit: GroupEdit):
    db_group = db.query(Group).filter(Group.id == group_edit.id).first()
    user_id = db_group.user_id
    db_group.name = group_edit.name
    db_group.sl = group_edit.sl
    db_group.tp = group_edit.tp
    db.commit()
    db.refresh(db_group)
    sub_brokers = (
        db.query(GroupBroker).filter(GroupBroker.group_id == group_edit.id).all()
    )
    for sub_broker in sub_brokers:
        db.delete(sub_broker)
    db.commit()
    for sub_broker in group_edit.sub_brokers:
        db_check = (
            db.query(GroupBroker)
            .filter(GroupBroker.group_id == group_edit.id)
            .filter(GroupBroker.sub_broker_id == sub_broker.id)
            .all()
        )
        if db_check:
            continue
        db_group_broker = GroupBroker(
            group_id=group_edit.id, sub_broker_id=sub_broker.id, qty=sub_broker.qty
        )
        db.add(db_group_broker)
        db.commit()
        db.refresh(db_group_broker)
    db_groups = db.query(Group).filter(Group.user_id == user_id).all()
    groups_summary: list[GroupInfo] = []
    for group in db_groups:
        sub_brokers = (
            db.query(GroupBroker).filter(GroupBroker.group_id == group.id).all()
        )
        response_brokers: list[SubBrokerSumary] = []
        for sub_broker in sub_brokers:
            response_broker: SubBrokerSumary = {}
            db_sub_broker = (
                db.query(SubBrokerAccount)
                .filter(SubBrokerAccount.id == sub_broker.sub_broker_id)
                .first()
            )
            response_broker["id"] = db_sub_broker.id
            response_broker["nickname"] = db_sub_broker.nickname
            response_broker["sub_account_name"] = db_sub_broker.sub_account_name
            response_broker['qty'] = sub_broker.qty
            response_broker["sub_account_id"] = db_sub_broker.sub_account_id
            response_brokers.append(response_broker)
        group_summary = GroupInfo(
            id=group.id, name=group.name, sub_brokers=response_brokers, 
            sl=group.sl if group.sl is not None else 0.0, 
            tp=group.tp if group.tp is not None else 0.0
        )
        groups_summary.append(group_summary)
    return groups_summary


def user_change_group_name(db: Session, change_name: GroupNameChange):
    db_group = db.query(Group).filter(Group.id == change_name.group_id).first()
    db_group.name = change_name.new_name
    db.add(db_group)
    db.commit()
    db.refresh(db_group)
    return db.query(Group).filter(Group.user_id == db_group.user_id).all()


def user_add_broker_to_group(db: Session, group_add_broker: GroupAddBroker):
    for sub_broker in group_add_broker.sub_brokers:
        db_check = (
            db.query(GroupBroker)
            .filter(GroupBroker.group_id == group_add_broker.group_id)
            .filter(GroupBroker.sub_broker_id == sub_broker.id)
            .all()
        )
        if db_check:
            continue
        db_group_broker = GroupBroker(
            group_id=group_add_broker.group_id,
            sub_broker_id=sub_broker.id,
            qty=sub_broker.qty,
        )
        db.add(db_group_broker)
        db.commit()
        db.refresh(db_group_broker)

    return (
        db.query(GroupBroker)
        .filter(GroupBroker.group_id == group_add_broker.group_id)
        .all()
    )

def user_del_group(db: Session, group_id: UUID):
    db_group = db.query(Group).filter(Group.id == group_id).first()
    if not db_group:
        return None  # or raise exception
    user_id = db_group.user_id

    # Delete associated GroupBroker entries without calling .all()
    db.query(GroupBroker).filter(GroupBroker.group_id == group_id).delete(
        synchronize_session=False
    )

    # Delete the group itself
    db.query(Group).filter(Group.id == group_id).delete(synchronize_session=False)

    db.commit()

    db_groups = db.query(Group).filter(Group.user_id == user_id).all()
    groups_summary: list[GroupInfo] = []
    for group in db_groups:
        sub_brokers = (
            db.query(GroupBroker).filter(GroupBroker.group_id == group.id).all()
        )
        response_brokers: list[SubBrokerSumary] = []
        for sub_broker in sub_brokers:
            response_broker: SubBrokerSumary = {}
            db_sub_broker = (
                db.query(SubBrokerAccount)
                .filter(SubBrokerAccount.id == sub_broker.sub_broker_id)
                .first()
            )
            response_broker["id"] = db_sub_broker.id
            response_broker["nickname"] = db_sub_broker.nickname
            response_broker["sub_account_name"] = db_sub_broker.sub_account_name
            response_broker['qty'] = sub_broker.qty
            response_broker["sub_account_id"] = db_sub_broker.sub_account_id
            response_brokers.append(response_broker)
        group_summary = GroupInfo(
            id=group.id, name=group.name, sub_brokers=response_brokers, 
            sl=group.sl if group.sl is not None else 0.0, 
            tp=group.tp if group.tp is not None else 0.0
        )
        groups_summary.append(group_summary)
    return groups_summary
