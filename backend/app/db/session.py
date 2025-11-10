from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Increase pool and enable pre-ping to avoid stale connections; allow env to override defaults if needed
# pool_reset_on_return='commit' ensures connections are properly reset when returned to the pool
# This prevents PendingRollbackError when connections are reused
# isolation_level='READ COMMITTED' ensures we see committed data from other transactions
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    pool_recycle=1800,
    pool_reset_on_return='commit',  # Reset connections on return to pool
    isolation_level='READ COMMITTED',  # Ensure we see committed data from other sessions
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
