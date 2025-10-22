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
    LimitOrder
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
    execute_market_order,
    execute_limit_order
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
        raise HTTPException(status_code=404, detail="Positions not found")
    return response


@router.post("/position/exitall", status_code=status.HTTP_200_OK)
async def exit_Position(
    exit_positions_data: list[ExitPosition], db: Session = Depends(get_db)
):
    for exit_position_data in exit_positions_data:
        response = exit_position(db, exit_position_data)
    if response is None:
        raise HTTPException(status_code=404, detail="Positions not found")
    return True


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