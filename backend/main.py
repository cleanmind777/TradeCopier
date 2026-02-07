import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.core.config import settings
# Import Base from session (same one used by all models)
from app.db.session import Base
# Import all models to ensure they're registered with SQLAlchemy
from app.models import (
    User,
    BrokerAccount,
    SubBrokerAccount,
    Group,
    GroupBroker,
    UserContract,
)
from app.services.broker_service import (
    refresh_new_token,
)  # Your async token refresh logic
from app.api.v1.routers import api_router  # Your routers

# Async SQLAlchemy engine and session maker
# Configure connection pool to handle connection errors and stale connections
engine = create_async_engine(
    settings.ASYNC_DATABASE_URL,
    echo=True,
    pool_pre_ping=True,  # Verify connections before using them
    pool_size=10,  # Number of connections to maintain
    max_overflow=20,  # Maximum number of connections beyond pool_size
    pool_recycle=1800,  # Recycle connections after 30 minutes (1800 seconds)
    pool_reset_on_return='commit',  # Reset connections on return
)
async_session = async_sessionmaker(engine, expire_on_commit=False)


# Dependency to provide async DB sessions for routes
async def get_db():
    async with async_session() as session:
        yield session


app = FastAPI(title="My FastAPI App")

# CORS origins
origins = [
    "http://localhost:5173",
    "http://localhost:5175",
    "http://tc.streetagent.ai",
    "http://dev.tc.streetagent.ai",
    "https://tc.streetagent.ai",
    "https://dev.tc.streetagent.ai",
]

app.add_middleware(SessionMiddleware, secret_key="!secret")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


# Async database schema initialization
async def init_db():
    # Create tables on async engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Also create tables on sync engine (used by repositories)
    from app.db.session import engine as sync_engine
    Base.metadata.create_all(bind=sync_engine)


# Periodic background task to refresh tokens
async def regenerate_access_token_periodically():
    while True:
        async with async_session() as db:
            print("Regenerating access token...")
            await refresh_new_token(db)
        await asyncio.sleep(1200)  # Sleep 20 minutes


# FastAPI startup event to initialize DB and start background task
@app.on_event("startup")
async def on_startup():
    await init_db()
    asyncio.create_task(regenerate_access_token_periodically())
