from sqlalchemy import (
    Column,
    String,
    DateTime,
    ForeignKey,
)
from sqlalchemy.dialects.postgresql import UUID
from app.db.session import Base
import uuid
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship


class UserContract(Base):
    __tablename__ = "usercontracts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    symbol = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())

    user = relationship("User", back_populates="user_contracts")

