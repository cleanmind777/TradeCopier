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


class GroupBroker(Base):
    __tablename__ = "groups_brokers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id = Column(String, nullable=False)
    sub_broker_id = Column(DateTime(timezone=True), nullable=False, default=func.now())
    qty = Column(Integer, nullable=False, default=0)

