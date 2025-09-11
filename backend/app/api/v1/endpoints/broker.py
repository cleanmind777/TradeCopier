from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from uuid import UUID
from app.schemas.broker import BrokerConnect, BrokerInfo, BrokerFilter, BrokerChange
from app.services.broker_service import (
    add_broker,
    get_brokers,
    del_broker,
    change_broker,
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
def del_Broker(broker_id: UUID, db: Session = Depends(get_db)):
    return del_broker(db, broker_id)


@router.post("/change", response_model=bool, status_code=status.HTTP_201_CREATED)
def change_Broker(broker_change: BrokerChange, db: Session = Depends(get_db)):
    response = change_broker(db, broker_change)
    if response is None:
        raise HTTPException(status_code=404, detail="Brokers not found")
    return response
