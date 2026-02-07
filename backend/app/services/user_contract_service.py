from sqlalchemy.orm import Session
from uuid import UUID
from app.schemas.user_contract import UserContractCreate, UserContractInfo
from app.db.repositories.user_contract_repository import (
    user_add_contract,
    user_get_contracts,
    user_delete_contract
)


def add_contract(db: Session, contract_create: UserContractCreate) -> UserContractInfo:
    return user_add_contract(db, contract_create)


def get_contracts(db: Session, user_id: UUID) -> list[UserContractInfo]:
    return user_get_contracts(db, user_id)


def delete_contract(db: Session, contract_id: UUID, user_id: UUID) -> bool:
    return user_delete_contract(db, contract_id, user_id)

