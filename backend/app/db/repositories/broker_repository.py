from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from sqlalchemy.future import select
from app.models.broker_account import BrokerAccount
from app.schemas.broker import BrokerAdd, BrokerInfo, BrokerFilter
import json
import secrets
from datetime import datetime, timezone
from uuid import UUID


def user_add_broker(db: Session, broker_add: BrokerAdd) -> list[BrokerInfo]:
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


def user_get_brokers(
    db: Session, broker_filter: BrokerFilter
) -> list[BrokerInfo] | None:

    query = select(BrokerAccount)
    if broker_filter.id != None:
        query = query.filter(BrokerAccount.id == broker_filter.id)
    if broker_filter.user_id != None:
        query = query.filter(BrokerAccount.user_id == broker_filter.user_id)
    if broker_filter.nickname != None:
        query = query.filter(BrokerAccount.nickname == broker_filter.nickname)
    if broker_filter.type != None:
        query = query.filter(BrokerAccount.type == broker_filter.type)
    if broker_filter.status != None:
        query = query.filter(BrokerAccount.status == broker_filter.status)
    result = db.execute(query)
    brokers = result.scalars().all()
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
