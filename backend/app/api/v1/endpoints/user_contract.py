from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from app.schemas.user_contract import UserContractCreate, UserContractInfo
from app.services.user_contract_service import (
    add_contract,
    get_contracts,
    delete_contract
)
from app.dependencies.database import get_db

router = APIRouter()


@router.post(
    "/add",
    response_model=UserContractInfo,
    status_code=status.HTTP_201_CREATED
)
def add_Contract(
    contract_create: UserContractCreate,
    db: Session = Depends(get_db)
):
    return add_contract(db, contract_create)


@router.get(
    "/get",
    response_model=list[UserContractInfo],
    status_code=status.HTTP_200_OK
)
def get_Contracts(
    user_id: UUID,
    db: Session = Depends(get_db)
):
    return get_contracts(db, user_id)


@router.delete(
    "/delete",
    status_code=status.HTTP_200_OK
)
def delete_Contract(
    contract_id: UUID,
    user_id: UUID,
    db: Session = Depends(get_db)
):
    success = delete_contract(db, contract_id, user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found"
        )
    return {"success": True}

