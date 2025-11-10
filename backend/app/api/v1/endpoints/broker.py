from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from uuid import UUID
from app.schemas.broker import (
    BrokerConnect,
    BrokerInfo,
    BrokerFilter,
    BrokerChange,
    ExitPosition,
    WebSocketCredintial,
    WebSocketTokens
)
from app.schemas.order import (
    MarketOrder,
    SLTP,
    LimitOrder,
    LimitOrderWithSLTP
)
from app.services.broker_service import (
    add_broker,
    get_brokers,
    del_broker,
    change_broker,
    get_positions,
    get_orders,
    get_accounts,
    exit_position,
    get_token_for_websocket,
    get_all_tokens_for_websocket,
    get_token_for_group_websocket,
    execute_market_order,
    execute_limit_order,
    execute_limit_order_with_sltp
)
from app.dependencies.database import get_db
from app.core.config import settings

router = APIRouter()


@router.post(
    "/add", response_model=list[BrokerInfo], status_code=status.HTTP_201_CREATED
)
def add_Broker(broker_connect: BrokerConnect, db: Session = Depends(get_db)):
    return add_broker(db, broker_connect)


@router.post(
    "/get", response_model=list[BrokerInfo], status_code=status.HTTP_201_CREATED
)
def get_Brokers(broker_filter: BrokerFilter, db: Session = Depends(get_db)):
    response = get_brokers(db, broker_filter)
    if response is None:
        raise HTTPException(status_code=404, detail="Brokers not found")
    return response


@router.delete(
    "/delete", response_model=list[BrokerInfo], status_code=status.HTTP_201_CREATED
)
def del_Broker(id: UUID, db: Session = Depends(get_db)):
    return del_broker(db, id)


@router.post("/change", status_code=status.HTTP_201_CREATED)
def change_Broker(broker_change: BrokerChange, db: Session = Depends(get_db)):
    response = change_broker(db, broker_change)
    if response is None:
        raise HTTPException(status_code=404, detail="Brokers not found")
    return response


@router.get("/positions", status_code=status.HTTP_200_OK)
async def get_Positions(user_id: UUID, db: Session = Depends(get_db)):
    response = await get_positions(db, user_id)
    if response is None:
        raise HTTPException(status_code=404, detail="Positions not found")
    return response


@router.post("/position/exit", status_code=status.HTTP_200_OK)
async def exit_Position(
    exit_position_data: ExitPosition, db: Session = Depends(get_db)
):
    response = exit_position(db, exit_position_data)
    if response is None:
        raise HTTPException(status_code=400, detail="Exit order failed")
    if isinstance(response, dict) and response.get("error"):
        raise HTTPException(status_code=502, detail=response)
    return response


@router.post("/position/exitall", status_code=status.HTTP_200_OK)
async def exit_Position(
    exit_positions_data: list[ExitPosition], db: Session = Depends(get_db)
):
    if not exit_positions_data:
        raise HTTPException(status_code=404, detail="Positions not found")
    
    print(f"[FLATTEN DEBUG] Processing {len(exit_positions_data)} exit positions")
    
    # Group positions by broker account to refresh tokens once per broker
    # This ensures each broker's token is refreshed before processing any positions from that broker
    from app.models.broker_account import SubBrokerAccount, BrokerAccount
    
    # First, identify which broker accounts are involved
    # Use the same string conversion logic as exit_position
    # IMPORTANT: Filter by is_active=True to match exit_position query
    account_ids = [str(pos.accountId) for pos in exit_positions_data]
    sub_brokers = (
        db.query(SubBrokerAccount)
        .filter(SubBrokerAccount.sub_account_id.in_(account_ids))
        .filter(SubBrokerAccount.is_active == True)  # Only use active accounts
        .all()
    )
    
    # Create mapping: accountId (as string) -> broker_id for quick lookup
    # Ensure we use the same string format as exit_position will use
    # If there are duplicates (same accountId pointing to different brokers), prefer the one with a refreshable token
    account_to_broker = {}
    for sb in sub_brokers:
        # Normalize account_id to string to match exit_position query
        account_id_str = str(sb.sub_account_id)
        
        # If we already have a mapping for this accountId, check which broker has a valid token
        if account_id_str in account_to_broker:
            existing_broker_id = account_to_broker[account_id_str]
            if existing_broker_id != sb.broker_account_id:
                print(f"[FLATTEN DEBUG] WARNING: Duplicate SubBrokerAccount found for accountId {account_id_str}")
                print(f"[FLATTEN DEBUG]   Existing: broker {existing_broker_id}")
                print(f"[FLATTEN DEBUG]   New: broker {sb.broker_account_id}")
                
                # Check which broker has a refreshable token
                existing_broker = db.query(BrokerAccount).filter(BrokerAccount.id == existing_broker_id).first()
                new_broker = db.query(BrokerAccount).filter(BrokerAccount.id == sb.broker_account_id).first()
                
                existing_token_valid = False
                new_token_valid = False
                
                if existing_broker and existing_broker.access_token:
                    try:
                        from app.utils.tradovate import get_renew_token
                        test_refresh = get_renew_token(existing_broker.access_token)
                        existing_token_valid = test_refresh is not None
                    except:
                        pass
                
                if new_broker and new_broker.access_token:
                    try:
                        from app.utils.tradovate import get_renew_token
                        test_refresh = get_renew_token(new_broker.access_token)
                        new_token_valid = test_refresh is not None
                    except:
                        pass
                
                # Prefer the broker with a valid, refreshable token
                if new_token_valid and not existing_token_valid:
                    account_to_broker[account_id_str] = sb.broker_account_id
                    print(f"[FLATTEN DEBUG]   Using NEW broker {sb.broker_account_id} (has refreshable token)")
                elif existing_token_valid and not new_token_valid:
                    print(f"[FLATTEN DEBUG]   Using EXISTING broker {existing_broker_id} (has refreshable token)")
                else:
                    # Both or neither have valid tokens, use the first one
                    print(f"[FLATTEN DEBUG]   Using first mapping (broker {existing_broker_id})")
        else:
            account_to_broker[account_id_str] = sb.broker_account_id
            print(f"[FLATTEN DEBUG] Mapping: accountId {account_id_str} -> broker {sb.broker_account_id}")
    
    # Group by broker_account_id and refresh tokens for each unique broker
    broker_ids = set(sb.broker_account_id for sb in sub_brokers)
    print(f"[FLATTEN DEBUG] Found {len(broker_ids)} unique broker accounts: {list(broker_ids)}")
    
    # Pre-refresh tokens for each unique broker
    refreshed_brokers = set()
    for broker_id in broker_ids:
        db_broker = db.query(BrokerAccount).filter(BrokerAccount.id == broker_id).first()
        if not db_broker:
            print(f"[FLATTEN DEBUG] Broker {broker_id} not found in database")
            continue
        if not db_broker.access_token:
            print(f"[FLATTEN DEBUG] Broker {broker_id} has no access_token")
            continue
        try:
            from app.utils.tradovate import get_renew_token
            new_tokens = get_renew_token(db_broker.access_token)
            if new_tokens:
                db_broker.access_token = new_tokens.access_token
                db_broker.md_access_token = new_tokens.md_access_token
                db.commit()
                db.refresh(db_broker)  # Ensure the object is refreshed
                refreshed_brokers.add(broker_id)
                print(f"[FLATTEN DEBUG] Pre-refreshed token for broker {broker_id}, token_preview={new_tokens.access_token[:20]}...")
            else:
                print(f"[FLATTEN DEBUG] Token refresh returned None for broker {broker_id} - token may be expired/invalid")
                # Even if refresh returns None, we should still try to use the existing token
                # The exit_position function will try to refresh it again
        except Exception as e:
            print(f"[FLATTEN DEBUG] Could not pre-refresh token for broker {broker_id}: {e}")
            # Continue - exit_position will try to refresh it
    
    print(f"[FLATTEN DEBUG] Successfully pre-refreshed {len(refreshed_brokers)}/{len(broker_ids)} brokers")
    
    errors: list[dict] = []
    # Now process each position - each will use its own broker's token
    for exit_position_data in exit_positions_data:
        expected_broker_id = account_to_broker.get(str(exit_position_data.accountId))
        print(f"[FLATTEN DEBUG] Processing accountId {exit_position_data.accountId}, expected broker {expected_broker_id}")
        response = exit_position(db, exit_position_data)
        if response is None:
            errors.append({"error": "Exit order failed", "accountId": exit_position_data.accountId, "symbol": exit_position_data.symbol})
        elif isinstance(response, dict) and response.get("error"):
            errors.append(response)
    if errors:
        raise HTTPException(status_code=502, detail={"errors": errors})
    return {"success": True}


@router.get("/orders", status_code=status.HTTP_200_OK)
async def get_Orders(user_id: UUID, db: Session = Depends(get_db)):
    response = await get_orders(db, user_id)
    if response is None:
        raise HTTPException(status_code=404, detail="Positions not found")
    return response


@router.get("/accounts", status_code=status.HTTP_200_OK)
async def get_Accounts(user_id: UUID, db: Session = Depends(get_db)):
    response = await get_accounts(db, user_id)
    if response is None:
        raise HTTPException(status_code=404, detail="Positions not found")
    return response


@router.get(
    "/websockettoken",
    response_model=WebSocketTokens | None,
    status_code=status.HTTP_201_CREATED,
)
def get_Tokens_for_websocket(user_id: UUID, db: Session = Depends(get_db)):
    return get_token_for_websocket(db, user_id)

@router.get(
    "/websockettoken/all",
    response_model=list[WebSocketTokens],
    status_code=status.HTTP_200_OK,
)
def get_All_Tokens_for_websocket(user_id: UUID, db: Session = Depends(get_db)):
    tokens = get_all_tokens_for_websocket(db, user_id)
    print(f"[WebSocket Tokens API] Returning {len(tokens)} tokens for user {user_id}")
    return tokens

@router.get(
    "/websockettoken/group/{group_id}",
    response_model=WebSocketTokens | None,
    status_code=status.HTTP_200_OK,
)
def get_Tokens_for_group_websocket(group_id: UUID, db: Session = Depends(get_db)):
    return get_token_for_group_websocket(db, group_id)

@router.post(
    "/execute-order/market",
    status_code=status.HTTP_201_CREATED,
)
async def execute_Market_order(order: MarketOrder, db: Session = Depends(get_db)):
    return await execute_market_order(db, order)

@router.post(
    "/execute-order/limit",
    status_code=status.HTTP_201_CREATED,
)
async def execute_Limit_order(order: LimitOrder, db: Session = Depends(get_db)):
    return await execute_limit_order(db, order)

@router.post(
    "/execute-order/limitwithsltp",
    status_code=status.HTTP_201_CREATED,
)
async def execute_Limit_order_with_sltp(order: LimitOrderWithSLTP, db: Session = Depends(get_db)):
    return await execute_limit_order_with_sltp(db, order)