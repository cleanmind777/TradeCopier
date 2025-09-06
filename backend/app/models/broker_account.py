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
    last_sync = Column(DateTime, onupdate=func.now())
    status = Column(Boolean, default=False)
    user_broker_id = Column(String, nullable=True)
    access_token = Column(String, nullable=True)
    expire_in = Column(String, nullable=True)

    user = relationship("User", back_populates="broker_accounts")
