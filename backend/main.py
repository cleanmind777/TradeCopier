import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.core.config import settings
from app.models import base  # Your models Base
from app.services.broker_service import (
    refresh_new_token,
)  # Your async token regeneration

# Create Async SQLAlchemy engine and sessionmaker
engine = create_async_engine(settings.ASYNC_DATABASE_URL, echo=True)
async_session = async_sessionmaker(engine, expire_on_commit=False)


# Dependency for injecting DB sessions in routes
async def get_db():
    async with async_session() as session:
        yield session


app = FastAPI(title="My FastAPI App")

# CORS setup
origins = [
    "http://localhost:5173",
    "http://tc.streetagent.ai",
    "https://tc.streetagent.ai",
]

app.add_middleware(SessionMiddleware, secret_key="!secret")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include your routers
app.include_router(api_router, prefix="/api/v1")


# Async DB initialization
async def init_db():
    async with engine.begin() as conn:
        # Creates tables for all models defined on base
        await conn.run_sync(base.Base.metadata.create_all)


# Background task to run every 2 minutes
async def regenerate_access_token_periodically():
    while True:
        async with async_session() as db:
            print("Regenerating access token...")
            await refresh_new_token(db)
        await asyncio.sleep(120)  # 2 minutes


# Startup event to run DB init and background task
@app.on_event("startup")
async def startup_event():
    await init_db()
    asyncio.create_task(regenerate_access_token_periodically())
