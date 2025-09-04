from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from uuid import UUID
from app.schemas.broker import BrokerConnect, BrokerInfo, BrokerFilter
from app.services.broker_service import add_broker, get_brokers, del_broker
from app.dependencies.database import get_db
from app.core.config import settings

router = APIRouter()


@router.post(
    "/add", response_model=list[BrokerInfo], status_code=status.HTTP_201_CREATED
)
def add_Broker(broker_connect: BrokerConnect, db: Session = Depends(get_db)):
    return add_broker(db, broker_connect)


@router.get(
    "/get", response_model=list[BrokerInfo], status_code=status.HTTP_201_CREATED
)
def get_Brokers(broker_filter: BrokerFilter, db: Session = Depends(get_db)):
    return get_brokers(db, broker_filter)


@router.delete(
    "/delete", response_model=list[BrokerInfo], status_code=status.HTTP_201_CREATED
)
def del_Broker(broker_id: UUID, db: Session = Depends(get_db)):
    return del_broker(db, broker_id)
