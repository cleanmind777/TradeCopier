from sqlalchemy.orm import Session
from fastapi import HTTPException, status, BackgroundTasks
import json
from uuid import UUID
from datetime import datetime, date, time
from app.schemas.broker import BrokerConnect, BrokerInfo, BrokerAdd, BrokerFilter
from app.utils.broker import getAccessTokenForTradoVate
from app.db.repositories.broker_repository import (
    user_add_broker,
    user_get_brokers,
    user_del_broker,
)


def add_broker(db: Session, broker_connect: BrokerConnect) -> list[BrokerInfo]:
    response = getAccessTokenForTradoVate(broker_connect)
    broker_add = BrokerAdd(
        user_id=broker_connect.user_id,
        nickname=broker_connect.nickname,
        type=broker_connect.type,
        user_broker_id=response.userId,
        access_token=response.accessToken,
        expire_in=response.mdAccessToken,
    )

    return user_add_broker(db, broker_add)


def add_tradovate_broker(db: Session, broker_add: BrokerAdd) -> list[BrokerInfo]:
    return user_add_broker(db, broker_add)


def get_brokers(db: Session, broker_filter: BrokerFilter) -> list[BrokerInfo] | None:
    return user_get_brokers(db, broker_filter)


def del_broker(db: Session, broker_id: UUID) -> list[BrokerInfo]:
    return user_del_broker(db, broker_id)
