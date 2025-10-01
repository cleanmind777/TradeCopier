from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    JSON,
    DateTime,
    ForeignKey,
    Float,
)
from sqlalchemy.dialects.postgresql import UUID
from app.db.session import Base
import uuid
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship


class BrokerAccount(Base):
    __tablename__ = "broker_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    nickname = Column(String, nullable=False)
    type = Column(String, nullable=False)
    last_sync = Column(DateTime, default=func.now())
    status = Column(Boolean, default=False)
    user_broker_id = Column(String, nullable=True)
    access_token = Column(String, nullable=True)
    expire_in = Column(String, nullable=True)

    user = relationship("User", back_populates="broker_accounts")
    sub_broker_accounts = relationship("SubBrokerAccount", back_populates="broker_account", cascade="all, delete-orphan")

class SubBrokerAccount(Base):
    __tablename__ = "sub_broker_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    user_broker_id = Column(String, nullable=False)
    broker_account_id = Column(UUID, ForeignKey('broker_accounts.id', ondelete='CASCADE'))
    sub_account_id = Column(String, nullable=False)
    nickname = Column(String, nullable=False)
    sub_account_name = Column(String, nullable=False)
    type = Column(String, nullable=False)
    account_type = Column(String, nullable=False)
    is_demo = Column(Boolean, nullable=False)
    last_sync = Column(DateTime, default=func.now())
    status = Column(Boolean, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)

    user = relationship("User", back_populates="sub_broker_accounts")
    broker_account = relationship("BrokerAccount", back_populates="sub_broker_accounts")
