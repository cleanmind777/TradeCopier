from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from sqlalchemy.future import select
from app.models.broker_account import BrokerAccount, SubBrokerAccount
from app.schemas.broker import (
    BrokerAdd,
    BrokerInfo,
    BrokerFilter,
    BrokerChange,
    SubBrokerAdd,
    SubBrokerInfo,
    SubBrokerFilter,
    SubBrokerChange,
)
import json
import secrets
from datetime import datetime, timezone
from uuid import UUID


async def user_add_broker(db: Session, broker_add: BrokerAdd) -> list[BrokerInfo]:
    db_broker_account = (
        db.query(BrokerAccount)
        .filter(BrokerAccount.user_id == broker_add.user_id)
        .filter(BrokerAccount.type == broker_add.type)
        .all()
    )
    counter = len(db_broker_account)
    db_broker = BrokerAccount(
        user_id=broker_add.user_id,
        nickname=f"{broker_add.type} {counter}",
        type=broker_add.type,
        user_broker_id=broker_add.user_broker_id,
        access_token=broker_add.access_token,
        expire_in=broker_add.expire_in,
    )
    db.add(db_broker)
    db.commit()
    db.refresh(db_broker)
    return db.query(BrokerAccount).all()


def user_add_sub_broker(
    db: Session, sub_broker_add: SubBrokerAdd
) -> list[SubBrokerInfo]:
    db_sub_broker_account = (
        db.query(SubBrokerAccount)
        .filter(SubBrokerAccount.user_id == sub_broker_add.user_id)
        .filter(SubBrokerAccount.type == sub_broker_add.type)
        .all()
    )
    counter = len(db_sub_broker_account)
    db_sub_broker = SubBrokerAccount(
        user_id=sub_broker_add.user_id,
        nickname=f"Sub {sub_broker_add.type} {counter}",
        type=sub_broker_add.type,
        account_type=sub_broker_add.account_type,
        user_broker_id=sub_broker_add.user_broker_id,
        sub_account_id=sub_broker_add.sub_account_id,
        sub_account_name=sub_broker_add.sub_account_name,
        status=sub_broker_add.status,
        is_active=True,
        is_demo=sub_broker_add.is_demo,
    )
    db.add(db_sub_broker)
    db.commit()
    db.refresh(db_sub_broker)
    return db.query(SubBrokerAccount).all()


def user_get_brokers(
    db: Session, broker_filter: BrokerFilter
) -> list[BrokerInfo] | None:

    query = select(BrokerAccount)
    if broker_filter.id != None:
        query = query.filter(BrokerAccount.id == broker_filter.id)
    if broker_filter.user_id != None:
        query = query.filter(BrokerAccount.user_id == broker_filter.user_id)
    if broker_filter.user_broker_id != None:
        query = query.filter(
            BrokerAccount.user_broker_id == broker_filter.user_broker_id
        )
    if broker_filter.nickname != None:
        query = query.filter(BrokerAccount.nickname == broker_filter.nickname)
    if broker_filter.type != None:
        query = query.filter(BrokerAccount.type == broker_filter.type)
    if broker_filter.status != None:
        query = query.filter(BrokerAccount.status == broker_filter.status)
    result = db.execute(query)
    brokers = result.scalars().all()
    return brokers


def user_get_sub_brokers(
    db: Session, sub_broker_filter: SubBrokerFilter
) -> list[SubBrokerInfo] | None:
    query = select(SubBrokerAccount)
    if sub_broker_filter.id != None:
        query = query.filter(SubBrokerAccount.id == sub_broker_filter.id)
    if sub_broker_filter.user_id != None:
        query = query.filter(SubBrokerAccount.user_id == sub_broker_filter.user_id)
    if sub_broker_filter.user_broker_id != None:
        query = query.filter(
            SubBrokerAccount.user_broker_id == sub_broker_filter.user_broker_id
        )
    if sub_broker_filter.sub_account_id != None:
        query = query.filter(
            SubBrokerAccount.sub_account_id == sub_broker_filter.sub_account_id
        )
    if sub_broker_filter.nickname != None:
        query = query.filter(SubBrokerAccount.nickname == sub_broker_filter.nickname)
    if sub_broker_filter.sub_account_name != None:
        query = query.filter(
            SubBrokerAccount.sub_account_name == sub_broker_filter.sub_account_name
        )
    if sub_broker_filter.type != None:
        query = query.filter(SubBrokerAccount.type == sub_broker_filter.type)
    if sub_broker_filter.status != None:
        query = query.filter(SubBrokerAccount.status == sub_broker_filter.status)
    if sub_broker_filter.is_demo != None:
        query = query.filter(SubBrokerAccount.status == sub_broker_filter.is_demo)
    if sub_broker_filter.is_active != None:
        query = query.filter(SubBrokerAccount.is_active == sub_broker_filter.is_active)
    result = db.execute(query)
    brokers = result.scalars().all()
    print("SubBrokers:", brokers)
    return brokers


def user_del_broker(db: Session, broker_id: UUID) -> list[BrokerInfo]:
    db_broker_account = (
        db.query(BrokerAccount).filter(BrokerAccount.id == broker_id).first()
    )
    user_id = db_broker_account.user_id
    query = db.query(BrokerAccount).filter(BrokerAccount.id == broker_id)
    query.delete(synchronize_session=False)
    db.commit()
    return db.query(BrokerAccount).filter(BrokerAccount.user_id == user_id).all()


def user_refresh_token(db: Session, id: UUID, new_token: str):
    db_broker_account = db.query(BrokerAccount).filter(BrokerAccount.id == id).first()
    db_broker_account.access_token = new_token
    db.commit()
    db.refresh(db_broker_account)
    return db_broker_account


def user_change_broker(db: Session, broker_change: BrokerChange):
    db_broker_account = (
        db.query(BrokerAccount).filter(BrokerAccount.id == broker_change.id).first()
    )
    if broker_change.nickname:
        db_broker_account.nickname = broker_change.nickname
    if broker_change.status:
        db_broker_account.status = broker_change.status
    db.commit()
    db.refresh(db_broker_account)
    return db_broker_account


def user_change_sub_brokers(db: Session, sub_broker_change: SubBrokerChange):
    db_sub_broker_account = (
        db.query(SubBrokerAccount)
        .filter(SubBrokerAccount.id == sub_broker_change.id)
        .first()
    )
    if sub_broker_change.nickname:
        db_sub_broker_account.nickname = sub_broker_change.nickname
    if sub_broker_change.is_active:
        db_sub_broker_account.is_active = sub_broker_change.is_active
    db.commit()
    db.refresh(db_sub_broker_account)
    return db_sub_broker_account
