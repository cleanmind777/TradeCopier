from sqlalchemy.orm import Session
from fastapi import HTTPException, status, BackgroundTasks
import json
from uuid import UUID
from datetime import datetime, date, time
from app.schemas.broker import (
    BrokerConnect,
    BrokerInfo,
    BrokerAdd,
    BrokerFilter,
    SubBrokerAdd,
    SubBrokerInfo,
    SubBrokerFilter,
    SubBrokerInfoPlus,
)
from app.models.broker_account import BrokerAccount, SubBrokerAccount
from app.utils.broker import getAccessTokenForTradoVate
from app.utils.tradovate import get_account_list, get_account_balance
from app.db.repositories.broker_repository import (
    user_add_broker,
    user_get_brokers,
    user_del_broker,
    user_add_sub_broker,
    user_get_sub_brokers,
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


async def add_tradovate_broker(db: Session, broker_add: BrokerAdd) -> list[BrokerInfo]:
    sub_demo_account_list = await get_account_list(broker_add.access_token, True)
    sub_live_account_list = await get_account_list(broker_add.access_token, False)
    if len(sub_demo_account_list):
        for demo_account in sub_demo_account_list:
            sub_demo_account = SubBrokerAdd(
                user_id=broker_add.user_id,
                user_broker_id=str(broker_add.user_broker_id),
                sub_account_id=str(demo_account["id"]),
                sub_account_name=str(demo_account["name"]),
                type=broker_add.type,
                account_type=str(demo_account["accountType"]),
                is_demo=True,
                status=demo_account["active"],
            )
            user_add_sub_broker(db, sub_demo_account)
    if len(sub_live_account_list):
        for live_account in sub_live_account_list:
            sub_live_account = SubBrokerAdd(
                user_id=broker_add.user_id,
                user_broker_id=str(broker_add.user_broker_id),
                sub_account_id=str(live_account["id"]),
                sub_account_name=str(live_account["name"]),
                type=broker_add.type,
                account_type=str(live_account["accountType"]),
                is_demo=False,
                status=live_account["active"],
            )
            user_add_sub_broker(db, sub_live_account)
    return await user_add_broker(db, broker_add)


def get_brokers(db: Session, broker_filter: BrokerFilter) -> list[BrokerInfo] | None:
    return user_get_brokers(db, broker_filter)


async def get_sub_brokers(
    db: Session, sub_broker_filter: SubBrokerFilter
) -> list[SubBrokerInfoPlus] | None:
    sub_broker_info_plus_list: list[SubBrokerInfoPlus] = []
    print("Sub Broker Filter: ", sub_broker_filter)
    sub_broker_info_list = await user_get_sub_brokers(db, sub_broker_filter)
    print("sub_broker_info_list:", sub_broker_info_list)
    db_broker_account = (
        db.query(BrokerAccount)
        .filter(BrokerAccount.user_broker_id == sub_broker_filter.user_broker_id)
        .first()
    )
    access_token = db_broker_account.access_token
    print("Access Token:", access_token)
    if sub_broker_info_list:
        for sub_broker_info in sub_broker_info_list:
            response = await get_account_balance(
                access_token, sub_broker_info.sub_account_id, sub_broker_info.is_demo
            )
            balance = response.data["amount"]
            sub_broker_info_plus = SubBrokerInfoPlus(
                user_id=sub_broker_info.user_id,
                user_broker_id=sub_broker_info.user_broker_id,
                sub_account_id=sub_broker_info.sub_account_id,
                nickname=sub_broker_info.nickname,
                sub_account_name=sub_broker_info.sub_account_name,
                type=sub_broker_info.type,
                account_type=sub_broker_info.account_type,
                is_demo=sub_broker_info.is_demo,
                status=sub_broker_info.status,
                id=sub_broker_info.id,
                last_sync=sub_broker_info.last_sync,
                is_active=sub_broker_info.is_active,
                balance=balance,
            )
            sub_broker_info_plus_list.append(sub_broker_info_plus)
    print("sub_broker_info_plus_list: ", sub_broker_info_plus_list)
    return sub_broker_info_plus_list


def del_broker(db: Session, broker_id: UUID) -> list[BrokerInfo]:
    return user_del_broker(db, broker_id)
