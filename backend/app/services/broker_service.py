from sqlalchemy.orm import Session
from sqlalchemy.future import select
from fastapi import HTTPException, status, BackgroundTasks
import json
from uuid import UUID
from datetime import datetime, date, time
from app.schemas.broker import (
    BrokerConnect,
    BrokerInfo,
    BrokerAdd,
    BrokerFilter,
    BrokerChange,
    SubBrokerAdd,
    SubBrokerInfo,
    SubBrokerFilter,
    SubBrokerInfoPlus,
    SubBrokerChange,
    SummarySubBrokers,
    SubBrokerSumary,
    SubBrokerSummaryForGet,
    ExitPosition,
    WebSocketCredintial,
    WebSocketTokens
)
from app.schemas.order import (
    MarketOrder,
    LimitOrder,
    LimitOrderWithSLTP,
    SLTP
)
from app.schemas.tradovate import (
    TradovatePositionListForFrontend,
    TradovateOrderListResponse,
    TradeDate,
    TradovateContractItemResponse,
    TradovateContractMaturityItemResponse,
    TradovatePositionListResponse,
    TradovateProductItemResponse,
    TradovateOrderForFrontend,
    TradovateCashBalanceResponse,
    TradovateAccountsForFrontend,
    TradovateMarketOrder,
    TradovateLimitOrder,
    TradovateLimitOrderWithSLTP,
    TradovateLimitBracket,
    TradovateStopBracket
)
from app.models.broker_account import BrokerAccount, SubBrokerAccount
from app.models.group_broker import GroupBroker
from app.utils.broker import getAccessTokenForTradoVate
from app.utils.tradovate import (
    get_account_list,
    get_account_balance,
    get_renew_token,
    get_position_list_of_demo_account,
    get_position_list_of_live_account,
    get_order_list_of_demo_account,
    get_order_list_of_live_account,
    get_contract_item,
    get_contract_maturity_item,
    get_product_item,
    get_cash_balances,
    place_order,
    get_order_version_depends,
    tradovate_execute_limit_order,
    tradovate_execute_limit_order_with_sltp,
    tradovate_execute_market_order
)
import asyncio
from app.utils.cache import cache_get_json, cache_set_json
from app.core.config import settings
from app.db.repositories.broker_repository import (
    user_add_broker,
    user_get_brokers,
    user_del_broker,
    user_add_sub_broker,
    user_get_sub_brokers,
    user_refresh_token,
    user_refresh_websocket_token,
    user_change_broker,
    user_change_sub_brokers,
    user_get_summary_sub_broker,
    user_get_tokens_for_websocket,
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
    broker_account = await user_add_broker(db, broker_add)
    sub_demo_account_list = await get_account_list(broker_add.access_token, True)
    sub_live_account_list = await get_account_list(broker_add.access_token, False)
    if len(sub_demo_account_list):
        for demo_account in sub_demo_account_list:
            sub_demo_account = SubBrokerAdd(
                user_id=broker_add.user_id,
                broker_account_id=broker_account.id,
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
                broker_account_id=broker_account.id,
                user_broker_id=str(broker_add.user_broker_id),
                sub_account_id=str(live_account["id"]),
                sub_account_name=str(live_account["name"]),
                type=broker_add.type,
                account_type=str(live_account["accountType"]),
                is_demo=False,
                status=live_account["active"],
            )
            user_add_sub_broker(db, sub_live_account)
    broker_filter = BrokerFilter(
        id=broker_account.id,
    )
    return get_brokers(db, broker_filter)


def get_brokers(db: Session, broker_filter: BrokerFilter) -> list[BrokerInfo] | None:
    brokers = user_get_brokers(db, broker_filter)
    fixed_brokers: list[BrokerInfo] = []
    for broker in brokers:
        summary_sub_broker = get_summary_sub_broker(
            db, broker_filter.user_id, broker.user_broker_id
        )
        broker.live = summary_sub_broker.live
        broker.paper = summary_sub_broker.paper
        broker.enable = summary_sub_broker.enable
        fixed_brokers.append(broker)
    return fixed_brokers


def get_summary_sub_broker(
    db: Session, user_id: UUID, user_broker_id: str
) -> SummarySubBrokers:
    return user_get_summary_sub_broker(db, user_id, user_broker_id)


async def get_sub_brokers(
    db: Session, sub_broker_filter: SubBrokerFilter
) -> list[SubBrokerInfoPlus] | None:
    sub_broker_info_plus_list: list[SubBrokerInfoPlus] = []
    sub_broker_info_list = user_get_sub_brokers(db, sub_broker_filter)
    if sub_broker_info_list == None:
        return None
    db_broker_account = (
        db.query(BrokerAccount)
        .filter(BrokerAccount.user_broker_id == sub_broker_filter.user_broker_id)
        .first()
    )
    access_token = db_broker_account.access_token
    if sub_broker_info_list:
        for sub_broker_info in sub_broker_info_list:
            response = await get_account_balance(
                access_token, sub_broker_info.sub_account_id, sub_broker_info.is_demo
            )
            if response:
                balance = response[0]["amount"]
            else:
                balance = 0
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
    return sub_broker_info_plus_list


def del_broker(db: Session, broker_id: UUID) -> list[BrokerInfo]:
    return user_del_broker(db, broker_id)


async def refresh_new_token(db: Session):
    result = await db.execute(select(BrokerAccount))
    db_broker_accounts = result.scalars().all()
    if len(db_broker_accounts) != 0 and db_broker_accounts:
        for broker in db_broker_accounts:
            # Refresh REST tokens
            if broker.access_token:
                new_tokens = get_renew_token(broker.access_token)
                if new_tokens:
                    await user_refresh_token(db, broker.id, new_tokens)
            # Refresh WebSocket tokens
            if getattr(broker, "websocket_access_token", None):
                new_websocket_tokens = get_renew_token(broker.websocket_access_token)
                if new_websocket_tokens:
                    await user_refresh_websocket_token(db, broker.id, new_websocket_tokens)


def change_broker(db: Session, broker_change: BrokerChange):
    return user_change_broker(db, broker_change)


def change_sub_brokers(db: Session, sub_broker_change: SubBrokerChange):
    return user_change_sub_brokers(db, sub_broker_change)


async def get_positions(db: Session, user_id: UUID):
    cache_key = f"user:{user_id}:positions"
    cached = await cache_get_json(cache_key)
    if cached is not None:
        return cached
    positions_status: list[TradovatePositionListResponse] = []
    positions_for_frontend: list[TradovatePositionListForFrontend] = []
    db_broker_accounts = (
        db.query(BrokerAccount)
        .filter(BrokerAccount.user_id == user_id)
        .all()
    )
    # Gather all demo/live calls concurrently across accounts
    tasks = []
    for db_broker_account in db_broker_accounts:
        token = db_broker_account.access_token
        tasks.append(get_position_list_of_demo_account(token))
        tasks.append(get_position_list_of_live_account(token))
    if tasks:
        results = await asyncio.gather(*tasks, return_exceptions=False)
        for res in results:
            if res:
                positions_status.extend(res)
    if positions_status != []:
        account_ids = {str(p["accountId"]) for p in positions_status}
        sub_accounts = (
            db.query(SubBrokerAccount)
            .filter(SubBrokerAccount.sub_account_id.in_(list(account_ids)))
            .all()
        )
        sub_map = {s.sub_account_id: s for s in sub_accounts}
        # Batch contract name lookups by (is_demo, contractId)
        unique_keys = set()
        for pos in positions_status:
            sba = sub_map.get(str(pos["accountId"]))
            if not sba:
                continue
            unique_keys.add((sba.is_demo, pos["contractId"]))
        fetch_tasks = [
            get_contract_item(contract_id, next((ba.access_token for ba in db.query(BrokerAccount).filter(BrokerAccount.id == sba.broker_account_id)), None) if False else "", is_demo)
            for (is_demo, contract_id) in unique_keys
        ]
        # Above access token retrieval is not needed for cached endpoints; we will reuse any token from the user's accounts
        # pick first available token per venue
        tokens = {True: None, False: None}
        for ba in db.query(BrokerAccount).filter(BrokerAccount.user_id == user_id).all():
            tokens[True] = tokens[True] or ba.access_token
            tokens[False] = tokens[False] or ba.access_token
        fetch_tasks = [get_contract_item(cid, tokens[is_demo], is_demo) for (is_demo, cid) in unique_keys]
        results = await asyncio.gather(*fetch_tasks, return_exceptions=True) if unique_keys else []
        key_list = list(unique_keys)
        contract_name_map = {}
        for idx, res in enumerate(results):
            try:
                key = key_list[idx]
                if res and isinstance(res, dict):
                    contract_name_map[key] = res.get("name")
            except Exception:
                continue
        for position in positions_status:
            sba = sub_map.get(str(position["accountId"]))
            if not sba or not sba.is_active or position.get("netPos", 0) == 0:
                continue
            name = contract_name_map.get((sba.is_demo, position["contractId"]))
            p = TradovatePositionListForFrontend(
                id=position["id"],
                accountId=position["accountId"],
                contractId=position["contractId"],
                accountNickname=sba.nickname,
                symbol=name if name else str(position["contractId"]),
                netPos=position["netPos"],
                netPrice=position.get("netPrice", 0),
                bought=position["bought"],
                boughtValue=position["boughtValue"],
                sold=position["sold"],
                soldValue=position["soldValue"],
                accountDisplayName=sba.sub_account_name,
            )
            positions_for_frontend.append(p)
    await cache_set_json(cache_key, [p.model_dump() for p in positions_for_frontend], settings.CACHE_TTL_SECONDS)
    return positions_for_frontend


async def get_orders(db: Session, user_id: UUID):
    cache_key = f"user:{user_id}:orders"
    cached = await cache_get_json(cache_key)
    if cached is not None:
        return cached
    order_status: list[TradovateOrderListResponse] = []
    order_for_frontend = []
    db_broker_accounts = (
        db.query(BrokerAccount)
        .filter(BrokerAccount.user_id == user_id)
        .all()
    )
    tasks = []
    for db_broker_account in db_broker_accounts:
        token = db_broker_account.access_token
        tasks.append(get_order_list_of_demo_account(token))
        tasks.append(get_order_list_of_live_account(token))
    if tasks:
        results = await asyncio.gather(*tasks, return_exceptions=False)
        for res in results:
            if res:
                order_status.extend(res)
    if order_status != []:
        account_ids = {str(o["accountId"]) for o in order_status}
        sub_accounts = (
            db.query(SubBrokerAccount)
            .filter(SubBrokerAccount.sub_account_id.in_(list(account_ids)))
            .all()
        )
        sub_map = {s.sub_account_id: s for s in sub_accounts}
        # Batch contract names by (is_demo, contractId)
        unique_keys = set()
        for o in order_status:
            sba = sub_map.get(str(o["accountId"]))
            if not sba:
                continue
            unique_keys.add((sba.is_demo, o["contractId"]))
        tokens = {True: None, False: None}
        for ba in db.query(BrokerAccount).filter(BrokerAccount.user_id == user_id).all():
            tokens[True] = tokens[True] or ba.access_token
            tokens[False] = tokens[False] or ba.access_token
        fetch_tasks = [get_contract_item(cid, tokens[is_demo], is_demo) for (is_demo, cid) in unique_keys]
        results = await asyncio.gather(*fetch_tasks, return_exceptions=True) if unique_keys else []
        key_list = list(unique_keys)
        contract_name_map = {}
        for idx, res in enumerate(results):
            try:
                key = key_list[idx]
                if res and isinstance(res, dict):
                    contract_name_map[key] = res.get("name")
            except Exception:
                continue
        for order in order_status:
            sba = sub_map.get(str(order["accountId"]))
            if not sba or not sba.is_active:
                continue
            name = contract_name_map.get((sba.is_demo, order["contractId"]))
            o = TradovateOrderForFrontend(
                id=order["id"],
                accountId=order["accountId"],
                accountNickname=sba.nickname,
                price=0,
                contractId=order["contractId"],
                timestamp=order["timestamp"],
                action=order["action"],
                ordStatus=order["ordStatus"],
                executionProviderId=order.get("executionProviderId"),
                archived=order["archived"],
                external=order["external"],
                admin=order["admin"],
                symbol=name if name else str(order["contractId"]),
                accountDisplayName=sba.sub_account_name,
            )
            order_for_frontend.append(o)
    await cache_set_json(cache_key, [o.model_dump() for o in order_for_frontend], settings.CACHE_TTL_SECONDS)
    return order_for_frontend


async def get_accounts(db: Session, user_id: UUID):
    cache_key = f"user:{user_id}:accounts"
    cached = await cache_get_json(cache_key)
    if cached is not None:
        return cached
    accounts_status: list[TradovateCashBalanceResponse] = []
    accounts_for_dashboard = []
    db_broker_accounts = (
        db.query(BrokerAccount)
        .filter(BrokerAccount.user_id == user_id)
        .all()
    )
    tasks = []
    for db_broker_account in db_broker_accounts:
        token = db_broker_account.access_token
        tasks.append(get_cash_balances(token, True))
        tasks.append(get_cash_balances(token, False))
    if tasks:
        results = await asyncio.gather(*tasks, return_exceptions=False)
        for res in results:
            if res:
                accounts_status.extend(res)
    if accounts_status != []:
        account_ids = {str(a["accountId"]) for a in accounts_status}
        sub_accounts = (
            db.query(SubBrokerAccount)
            .filter(SubBrokerAccount.sub_account_id.in_(list(account_ids)))
            .all()
        )
        sub_map = {s.sub_account_id: s for s in sub_accounts}
        for account in accounts_status:
            sba = sub_map.get(str(account["accountId"]))
            if not sba or not sba.is_active:
                continue
            a = TradovateAccountsForFrontend(
                id=account["id"],
                accountId=account["accountId"],
                accountNickname=sba.nickname,
                timestamp=account["timestamp"],
                currencyId=account["currencyId"],
                amount=account["amount"],
                realizedPnL=account["realizedPnL"],
                weekRealizedPnL=account["weekRealizedPnL"],
                archived=account["archived"],
                amountSOD=account["amountSOD"],
                accountDisplayName=sba.sub_account_name,
            )
            accounts_for_dashboard.append(a)
    await cache_set_json(cache_key, [a.model_dump() for a in accounts_for_dashboard], settings.CACHE_TTL_SECONDS)
    return accounts_for_dashboard


async def get_sub_brokers_for_group(
    db: Session, user_id: UUID
) -> list[SubBrokerSummaryForGet]:
    db_broker_accounts = (
        db.query(SubBrokerAccount).filter(SubBrokerAccount.user_id == user_id).all()
    )
    return db_broker_accounts


def exit_position(db: Session, exit_position_data: ExitPosition):
    db_sub_broker = (
        db.query(SubBrokerAccount)
        .filter(SubBrokerAccount.sub_account_id == str(exit_position_data.accountId))
        .first()
    )
    if db_sub_broker is None:
        return {"error": "Sub broker account not found", "accountId": exit_position_data.accountId}
    db_broker = (
        db.query(BrokerAccount)
        .filter(BrokerAccount.id == db_sub_broker.broker_account_id)
        .first()
    )
    if db_broker is None:
        return {"error": "Broker account not found", "broker_account_id": db_sub_broker.broker_account_id}
    access_token = db_broker.access_token
    # Build full payload including accountSpec as required by provider
    order_payload = {
        "accountId": int(db_sub_broker.sub_account_id),
        "accountSpec": db_sub_broker.sub_account_name,
        "symbol": exit_position_data.symbol,
        "orderQty": int(exit_position_data.orderQty),
        "orderType": exit_position_data.orderType,
        "action": exit_position_data.action,
        "isAutomated": bool(exit_position_data.isAutomated),
    }
    response = place_order(access_token, db_sub_broker.is_demo, order_payload)
    if isinstance(response, dict) and response.get("status") == 401:
        # Try to renew token and retry once
        new_tokens = get_renew_token(access_token)
        if new_tokens:
            try:
                db_broker.access_token = new_tokens.access_token
                db_broker.md_access_token = new_tokens.md_access_token
                db.commit()
                db.refresh(db_broker)
            except Exception:
                db.rollback()
            return place_order(db_broker.access_token, db_sub_broker.is_demo, order_payload)
    return response


def get_token_for_websocket(
    db: Session, user_id: UUID
) -> WebSocketTokens | None:
    return user_get_tokens_for_websocket(db, user_id)

async def execute_market_order(db: Session, order: MarketOrder):
    db_subroker_accounts = (
        db.query(GroupBroker).filter(GroupBroker.group_id == order.group_id).all()
    )
    for subbroker in db_subroker_accounts:
        db_subroker_account = (
            db.query(SubBrokerAccount).filter(SubBrokerAccount.id == subbroker.sub_broker_id).first()
        )
        tradovate_order = TradovateMarketOrder(
            accountId=int(db_subroker_account.sub_account_id),
            accountSpec=db_subroker_account.sub_account_name,
            symbol=order.symbol,
            orderQty=int(order.quantity * subbroker.qty),
            orderType='Market',
            action=order.action,
            isAutomated=True
        )
        db_broker_account = (
            db.query(BrokerAccount).filter(BrokerAccount.id == db_subroker_account.broker_account_id).first()
        )
        access_token = db_broker_account.access_token
        is_demo = db_subroker_account.is_demo
        response = await tradovate_execute_market_order(tradovate_order, access_token, is_demo)
    
    return "Success"

async def execute_limit_order(db: Session, order: LimitOrder):
    db_subroker_accounts = (
        db.query(GroupBroker).filter(GroupBroker.group_id == order.group_id).all()
    )
    for subbroker in db_subroker_accounts:
        db_subroker_account = (
            db.query(SubBrokerAccount).filter(SubBrokerAccount.id == subbroker.sub_broker_id).first()
        )
        tradovate_order = TradovateLimitOrder(
            accountId=int(db_subroker_account.sub_account_id),
            accountSpec=db_subroker_account.sub_account_name,
            symbol=order.symbol,
            orderQty=int(order.quantity * subbroker.qty),
            price=order.price,
            orderType='Limit',
            action=order.action,
            isAutomated=True
        )
        db_broker_account = (
            db.query(BrokerAccount).filter(BrokerAccount.id == db_subroker_account.broker_account_id).first()
        )
        access_token = db_broker_account.access_token
        is_demo = db_subroker_account.is_demo
        response = await tradovate_execute_limit_order(tradovate_order, access_token, is_demo)
    
    return "Success"

async def execute_limit_order_with_sltp(db: Session, order: LimitOrderWithSLTP):
    db_subroker_accounts = (
        db.query(GroupBroker).filter(GroupBroker.group_id == order.group_id).all()
    )
    for subbroker in db_subroker_accounts:
        db_subroker_account = (
            db.query(SubBrokerAccount).filter(SubBrokerAccount.id == subbroker.sub_broker_id).first()
        )
        sltp:SLTP = order.sltp
        bracket1 = TradovateLimitBracket(
            action = "Sell" if order.action == "Buy" else "Buy",
            orderType='Limit',
            price=sltp.tp + order.price if order.action == "Buy" else order.price - sltp.tp
        )
        bracket2 = TradovateStopBracket(
            action = "Sell" if order.action == "Buy" else "Buy",
            orderType='Stop',
            stopPrice=order.price - sltp.sl if order.action == "Buy" else order.price + sltp.tp
        )
        tradovate_order = TradovateLimitOrderWithSLTP(
            accountId=int(db_subroker_account.sub_account_id),
            accountSpec=db_subroker_account.sub_account_name,
            symbol=order.symbol,
            orderQty=int(order.quantity * subbroker.qty),
            price=order.price,
            orderType='Limit',
            action=order.action,
            isAutomated=True,
            bracket1=bracket1,
            bracket2=bracket2
        )
        db_broker_account = (
            db.query(BrokerAccount).filter(BrokerAccount.id == db_subroker_account.broker_account_id).first()
        )
        access_token = db_broker_account.access_token
        is_demo = db_subroker_account.is_demo
        response = await tradovate_execute_limit_order_with_sltp(tradovate_order, access_token, is_demo)
    
    return "Success"
