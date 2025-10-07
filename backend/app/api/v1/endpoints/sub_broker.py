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
    SubBrokerChange,
    SubBrokerSumary
)
from app.services.broker_service import (
    add_broker,
    get_brokers,
    del_broker,
    get_sub_brokers,
    change_sub_brokers,
    get_sub_brokers_for_group
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

@router.get(
    "/get-for-group",
    response_model=list[SubBrokerSumaryForGet] | None,
    status_code=status.HTTP_201_CREATED,
)
async def get_Sub_brokers_for_group(
    user_id: UUID, db: Session = Depends(get_db)
):
    response = await get_sub_brokers_for_group(db, user_id)
    if response is None:
        raise HTTPException(status_code=404, detail="SubBrokers not found")
    return response


@router.post(
    "/change",
    status_code=status.HTTP_201_CREATED,
)
def change_Sub_brokers(
    sub_broker_change: SubBrokerChange, db: Session = Depends(get_db)
):
    response = change_sub_brokers(db, sub_broker_change)
    if response is None:
        raise HTTPException(status_code=404, detail="SubBrokers not found")
    return response
