from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    JSON,
    DateTime,
    ForeignKey,
    Table,
    Float,
)
from sqlalchemy.dialects.postgresql import UUID as SQLAlchemyUUID
from uuid import UUID, uuid4
from sqlalchemy.dialects.postgresql import UUID
from app.db.session import Base
import uuid
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    admin_role = Column(Boolean, default=False)
    is_accepted = Column(Boolean, default=False)
    is_verified = Column(Boolean, default=False)
    reset_token = Column(String, nullable=True)
    otp_code = Column(String, nullable=True)
    otp_expire = Column(DateTime, nullable=True)

    broker_accounts = relationship("BrokerAccount", back_populates="user")
    sub_broker_accounts = relationship("SubBrokerAccount", back_populates="user")
    groups = relationship("Group", back_populates="user")
