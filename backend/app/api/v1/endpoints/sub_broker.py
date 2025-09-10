from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from uuid import UUID
from app.schemas.broker import (
    BrokerConnect,
    BrokerInfo,
    BrokerFilter,
    SubBrokerFilter,
    SubBrokerInfoPlus,
)
from app.services.broker_service import (
    add_broker,
    get_brokers,
    del_broker,
    get_sub_brokers,
)
from app.dependencies.database import get_db
from app.core.config import settings

router = APIRouter()


@router.post(
    "/get",
    response_model=list[SubBrokerInfoPlus] | None,
    status_code=status.HTTP_201_CREATED,
)
async def get_Sub_brokers(
    sub_broker_filter: SubBrokerFilter, db: Session = Depends(get_db)
):
    response = await get_sub_brokers(db, sub_broker_filter)
    if response is None:
        raise HTTPException(status_code=404, detail="SubBrokers not found")
    return response
