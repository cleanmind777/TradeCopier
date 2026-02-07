from sqlalchemy.orm import Session
from uuid import UUID
from app.models.user_contract import UserContract
from app.schemas.user_contract import UserContractCreate, UserContractInfo


def user_add_contract(db: Session, contract_create: UserContractCreate) -> UserContractInfo:
    # Check if contract already exists for this user
    existing = db.query(UserContract).filter(
        UserContract.user_id == contract_create.user_id,
        UserContract.symbol == contract_create.symbol.upper()
    ).first()
    
    if existing:
        return UserContractInfo(
            id=existing.id,
            user_id=existing.user_id,
            symbol=existing.symbol,
            created_at=existing.created_at
        )
    
    db_contract = UserContract(
        user_id=contract_create.user_id,
        symbol=contract_create.symbol.upper()
    )
    db.add(db_contract)
    db.commit()
    db.refresh(db_contract)
    return UserContractInfo(
        id=db_contract.id,
        user_id=db_contract.user_id,
        symbol=db_contract.symbol,
        created_at=db_contract.created_at
    )


def user_get_contracts(db: Session, user_id: UUID) -> list[UserContractInfo]:
    db_contracts = db.query(UserContract).filter(
        UserContract.user_id == user_id
    ).order_by(UserContract.created_at.desc()).all()
    
    return [
        UserContractInfo(
            id=contract.id,
            user_id=contract.user_id,
            symbol=contract.symbol,
            created_at=contract.created_at
        )
        for contract in db_contracts
    ]


def user_delete_contract(db: Session, contract_id: UUID, user_id: UUID) -> bool:
    db_contract = db.query(UserContract).filter(
        UserContract.id == contract_id,
        UserContract.user_id == user_id
    ).first()
    
    if not db_contract:
        return False
    
    db.delete(db_contract)
    db.commit()
    return True

