from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
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
    SummarySubBrokers,
    WebSocketCredintial,
    Tokens,
    WebSocketTokens
)
from app.utils.broker import get_access_token_for_websocket
import json
import secrets
from datetime import datetime, timezone
from uuid import UUID
from sqlalchemy.future import select


async def user_add_broker(db: Session, broker_add: BrokerAdd) -> BrokerInfo:
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
    print(f"[Add Broker] Committed broker account {db_broker.id} for user {broker_add.user_id}")
    return db_broker


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
        broker_account_id=sub_broker_add.broker_account_id,
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
    if brokers:
        print("SubBrokers:", brokers)
        return brokers
    return None


def user_del_broker(db: Session, broker_id: UUID) -> list[BrokerInfo]:
    db_broker_account = (
        db.query(BrokerAccount).filter(BrokerAccount.id == broker_id).first()
    )
    user_id = db_broker_account.user_id
    query = db.query(SubBrokerAccount).filter(
        SubBrokerAccount.broker_account_id == broker_id
    )
    query.delete(synchronize_session=False)
    db.commit()
    query = db.query(BrokerAccount).filter(BrokerAccount.id == broker_id)
    query.delete(synchronize_session=False)
    db.commit()
    return db.query(BrokerAccount).filter(BrokerAccount.user_id == user_id).all()


async def user_refresh_token(db: AsyncSession, id: int, new_tokens: Tokens):
    stmt = select(BrokerAccount).where(BrokerAccount.id == id)
    result = await db.execute(stmt)
    db_broker_account = result.scalars().first()  # or .one_or_none()

    if db_broker_account is None:
        # handle None case
        return

    if not new_tokens:
        return

    db_broker_account.access_token = new_tokens.access_token
    db_broker_account.md_access_token = new_tokens.md_access_token
    await db.commit()
    await db.refresh(db_broker_account)
    return db_broker_account

async def user_refresh_websocket_token(db: AsyncSession, id: int, new_tokens: Tokens):
    stmt = select(BrokerAccount).where(BrokerAccount.id == id)
    result = await db.execute(stmt)
    db_broker_account = result.scalars().first()  # or .one_or_none()

    if db_broker_account is None:
        # handle None case
        return
    if new_tokens:
        db_broker_account.websocket_access_token = new_tokens.access_token
        db_broker_account.websocket_md_access_token = new_tokens.md_access_token
        await db.commit()
        await db.refresh(db_broker_account)
    return db_broker_account

def user_change_broker(db: Session, broker_change: BrokerChange):
    db_broker_account = (
        db.query(BrokerAccount).filter(BrokerAccount.id == broker_change.id).first()
    )
    if broker_change.nickname:
        db_broker_account.nickname = broker_change.nickname
    if broker_change.status:
        db_broker_account.status = broker_change.status
    if broker_change.username:
        db_broker_account.username = broker_change.username
    if broker_change.password:
        db_broker_account.password = broker_change.password
    if broker_change.username and broker_change.password:
        data = get_access_token_for_websocket(broker_change.username, broker_change.password)
        if data:
            print(data)
            db_broker_account.websocket_access_token = data['access_token']
            db_broker_account.websocket_md_access_token = data['md_access_token']
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
    if sub_broker_change.is_active is not None:
        db_sub_broker_account.is_active = sub_broker_change.is_active
    db.commit()
    db.refresh(db_sub_broker_account)
    return db_sub_broker_account


def user_get_summary_sub_broker(
    db: Session, user_id: UUID, user_broker_id: str
) -> SummarySubBrokers:
    enable_sub_broker_accounts = (
        db.query(SubBrokerAccount)
        .filter(SubBrokerAccount.user_id == user_id)
        .filter(SubBrokerAccount.user_broker_id == user_broker_id)
        .filter(SubBrokerAccount.is_active == True)
        .all()
    )
    paper_sub_broker_accounts = (
        db.query(SubBrokerAccount)
        .filter(SubBrokerAccount.user_id == user_id)
        .filter(SubBrokerAccount.user_broker_id == user_broker_id)
        .filter(SubBrokerAccount.is_demo == True)
        .all()
    )
    live_sub_broker_accounts = (
        db.query(SubBrokerAccount)
        .filter(SubBrokerAccount.user_id == user_id)
        .filter(SubBrokerAccount.user_broker_id == user_broker_id)
        .filter(SubBrokerAccount.is_demo == False)
        .all()
    )
    summary_sub_broker = SummarySubBrokers(
        live=len(live_sub_broker_accounts),
        paper=len(paper_sub_broker_accounts),
        enable=len(enable_sub_broker_accounts),
    )
    return summary_sub_broker


def user_get_tokens_for_websocket(
    db: Session, user_id: UUID
) -> WebSocketTokens | None:
    broker_accounts = (
        db.query(BrokerAccount).filter(BrokerAccount.user_id == user_id).all()
    )
    for broker in broker_accounts:
        # Check if any active sub-broker is demo to determine endpoint
        is_demo = False
        sub_brokers = (
            db.query(SubBrokerAccount)
            .filter(SubBrokerAccount.broker_account_id == broker.id)
            .filter(SubBrokerAccount.is_active == True)
            .all()
        )
        if sub_brokers:
            # If any active sub-broker is demo, use demo endpoint
            is_demo = any(sub.is_demo for sub in sub_brokers)
        
        # Prefer websocket tokens if available
        if broker.websocket_access_token:
            websocket_token = WebSocketTokens(
                id=broker.id,
                access_token=broker.websocket_access_token,
                md_access_token=broker.websocket_md_access_token,
                is_demo=is_demo
            )
            return websocket_token
        # Fallback to regular access tokens if websocket tokens don't exist
        elif broker.access_token and broker.md_access_token:
            websocket_token = WebSocketTokens(
                id=broker.id,
                access_token=broker.access_token,
                md_access_token=broker.md_access_token,
                is_demo=is_demo
            )
            return websocket_token
    return None

def user_get_all_tokens_for_websocket(
    db: Session, user_id: UUID
) -> list[WebSocketTokens]:
    """Get WebSocket tokens for all broker accounts for a user"""
    from app.utils.tradovate import get_renew_token
    from app.db.repositories.broker_repository import user_refresh_websocket_token
    from sqlalchemy import text
    import asyncio
    
    # CRITICAL FIX: Use raw SQL to bypass ALL ORM caching and connection state issues
    # This ensures we ALWAYS query the database directly and see committed data
    # Even if the ORM session has cached data or connection pooling issues
    
    try:
        # Use raw SQL query - this bypasses all ORM caching and queries the database directly
        # This is the ONLY reliable way to see newly committed data from other sessions
        raw_result = db.execute(
            text("""
                SELECT id, user_id, username, password, nickname, type, last_sync, status, 
                       user_broker_id, access_token, md_access_token, 
                       websocket_access_token, websocket_md_access_token, expire_in
                FROM broker_accounts 
                WHERE user_id = :user_id
            """),
            {"user_id": str(user_id)}
        )
        
        # Convert raw results to BrokerAccount objects manually
        broker_accounts = []
        for row in raw_result:
            row_dict = dict(row._mapping)
            # Create BrokerAccount instance - we need to handle UUID conversion
            from uuid import UUID as UUIDType
            try:
                if isinstance(row_dict.get('id'), str):
                    row_dict['id'] = UUIDType(row_dict['id'])
                if isinstance(row_dict.get('user_id'), str):
                    row_dict['user_id'] = UUIDType(row_dict['user_id'])
            except:
                pass
            
            # Create BrokerAccount object - we'll use the ORM model but populate it manually
            # This creates a detached instance (not in session) which is fine for read-only access
            broker = BrokerAccount()
            for key, value in row_dict.items():
                if hasattr(broker, key) and value is not None:
                    try:
                        setattr(broker, key, value)
                    except Exception as e:
                        print(f"[WebSocket Tokens] Warning: Could not set {key} on BrokerAccount: {e}")
            broker_accounts.append(broker)
        
        print(f"[WebSocket Tokens] Raw SQL query returned {len(broker_accounts)} broker accounts for user {user_id}")
        if len(broker_accounts) > 0:
            print(f"[WebSocket Tokens] Broker account IDs: {[str(b.id) for b in broker_accounts]}")
    except Exception as e:
        print(f"[WebSocket Tokens] ERROR: Raw SQL query failed: {e}")
        print(f"[WebSocket Tokens] Falling back to ORM query")
        # Fallback to ORM query if raw SQL fails
        broker_accounts = (
            db.query(BrokerAccount)
            .filter(BrokerAccount.user_id == user_id)
            .all()
        )
        print(f"[WebSocket Tokens] ORM query returned {len(broker_accounts)} broker accounts")
    tokens_list = []
    for broker in broker_accounts:
        # Check if any active sub-broker is demo to determine endpoint
        is_demo = False
        sub_brokers = (
            db.query(SubBrokerAccount)
            .filter(SubBrokerAccount.broker_account_id == broker.id)
            .filter(SubBrokerAccount.is_active == True)
            .all()
        )
        if sub_brokers:
            # If any active sub-broker is demo, use demo endpoint
            is_demo = any(sub.is_demo for sub in sub_brokers)
        
        # Try to refresh tokens before using them
        access_token_to_use = None
        md_access_token_to_use = None
        
        # Prefer websocket tokens if available, but refresh them first
        if broker.websocket_access_token:
            try:
                # Try to refresh the token with retry
                new_tokens = None
                for attempt in range(2):  # Try twice
                    try:
                        new_tokens = get_renew_token(broker.websocket_access_token)
                        if new_tokens:
                            break
                    except Exception as e:
                        if attempt == 0:
                            print(f"[WebSocket Tokens] Token refresh attempt {attempt + 1} failed for broker {broker.id}: {e}")
                        else:
                            print(f"[WebSocket Tokens] Token refresh failed for broker {broker.id} after 2 attempts: {e}")
                
                if new_tokens:
                    # Update in database (async function needs to be called properly)
                    # For now, use the refreshed tokens directly
                    access_token_to_use = new_tokens.access_token
                    md_access_token_to_use = new_tokens.md_access_token
                    print(f"[WebSocket Tokens] Successfully refreshed websocket token for broker {broker.id}")
                else:
                    # Use existing token if refresh failed
                    access_token_to_use = broker.websocket_access_token
                    md_access_token_to_use = broker.websocket_md_access_token
                    print(f"[WebSocket Tokens] Using existing websocket token for broker {broker.id} (refresh returned None)")
            except Exception as e:
                # Fallback to existing token
                access_token_to_use = broker.websocket_access_token
                md_access_token_to_use = broker.websocket_md_access_token
                print(f"[WebSocket Tokens] Exception refreshing websocket token for broker {broker.id}: {e}, using existing token")
        
        # Fallback to regular access tokens if websocket tokens don't exist
        elif broker.access_token and broker.md_access_token:
            try:
                # Try to refresh the token with retry
                new_tokens = None
                for attempt in range(2):  # Try twice
                    try:
                        new_tokens = get_renew_token(broker.access_token)
                        if new_tokens:
                            break
                    except Exception as e:
                        if attempt == 0:
                            print(f"[WebSocket Tokens] Token refresh attempt {attempt + 1} failed for broker {broker.id}: {e}")
                        else:
                            print(f"[WebSocket Tokens] Token refresh failed for broker {broker.id} after 2 attempts: {e}")
                
                if new_tokens:
                    access_token_to_use = new_tokens.access_token
                    md_access_token_to_use = new_tokens.md_access_token
                    print(f"[WebSocket Tokens] Successfully refreshed regular token for broker {broker.id}")
                else:
                    access_token_to_use = broker.access_token
                    md_access_token_to_use = broker.md_access_token
                    print(f"[WebSocket Tokens] Using existing regular token for broker {broker.id} (refresh returned None)")
            except Exception as e:
                access_token_to_use = broker.access_token
                md_access_token_to_use = broker.md_access_token
                print(f"[WebSocket Tokens] Exception refreshing regular token for broker {broker.id}: {e}, using existing token")
        
        if access_token_to_use and md_access_token_to_use:
            websocket_token = WebSocketTokens(
                id=broker.id,
                access_token=access_token_to_use,
                md_access_token=md_access_token_to_use,
                is_demo=is_demo
            )
            tokens_list.append(websocket_token)
            print(f"[WebSocket Tokens] Added token for broker {broker.id} (is_demo: {is_demo})")
        else:
            print(f"[WebSocket Tokens] Skipping broker {broker.id} - missing tokens (access_token: {bool(access_token_to_use)}, md_access_token: {bool(md_access_token_to_use)})")
    print(f"[WebSocket Tokens] Returning {len(tokens_list)} tokens for user {user_id}")
    return tokens_list

def user_get_tokens_for_group(
    db: Session, group_id: UUID
) -> WebSocketTokens | None:
    """Get WebSocket token for the broker account associated with a group's sub-brokers"""
    from app.models.group_broker import GroupBroker
    from app.models.broker_account import SubBrokerAccount
    
    # Get all sub-brokers in this group
    group_brokers = (
        db.query(GroupBroker).filter(GroupBroker.group_id == group_id).all()
    )
    
    if not group_brokers:
        return None
    
    # Get the broker_account_id from the first sub-broker
    # (assuming all sub-brokers in a group belong to the same broker account)
    first_sub_broker_id = group_brokers[0].sub_broker_id
    sub_broker = (
        db.query(SubBrokerAccount)
        .filter(SubBrokerAccount.id == first_sub_broker_id)
        .first()
    )
    
    if not sub_broker or not sub_broker.broker_account_id:
        return None
    
    # Get the broker account and its WebSocket token
    broker_account = (
        db.query(BrokerAccount)
        .filter(BrokerAccount.id == sub_broker.broker_account_id)
        .first()
    )
    
    if not broker_account:
        return None
    
    # Check if any sub-broker in the group is demo to determine endpoint
    is_demo = False
    if sub_broker:
        is_demo = sub_broker.is_demo
    else:
        # Fallback: check all sub-brokers in the group
        sub_broker_ids = [gb.sub_broker_id for gb in group_brokers]
        sub_brokers_in_group = (
            db.query(SubBrokerAccount)
            .filter(SubBrokerAccount.id.in_(sub_broker_ids))
            .all()
        )
        if sub_brokers_in_group:
            # If any sub-broker in group is demo, use demo endpoint
            is_demo = any(sub.is_demo for sub in sub_brokers_in_group)
    
    # Prefer websocket tokens if available
    if broker_account.websocket_access_token:
        websocket_token = WebSocketTokens(
            id=broker_account.id,
            access_token=broker_account.websocket_access_token,
            md_access_token=broker_account.websocket_md_access_token,
            is_demo=is_demo
        )
        return websocket_token
    # Fallback to regular access tokens if websocket tokens don't exist
    elif broker_account.access_token and broker_account.md_access_token:
        websocket_token = WebSocketTokens(
            id=broker_account.id,
            access_token=broker_account.access_token,
            md_access_token=broker_account.md_access_token,
            is_demo=is_demo
        )
        return websocket_token
    
    return None