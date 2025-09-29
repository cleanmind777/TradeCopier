import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.core.config import settings
from app.models import base  # Your declarative base with models
from app.services.broker_service import (
    refresh_new_token,
)  # Your async token refresh logic
from app.api.v1.routers import api_router  # Your routers

# Async SQLAlchemy engine and session maker
engine = create_async_engine(settings.ASYNC_DATABASE_URL, echo=True)
async_session = async_sessionmaker(engine, expire_on_commit=False)


# Dependency to provide async DB sessions for routes
async def get_db():
    async with async_session() as session:
        yield session


app = FastAPI(title="My FastAPI App")

# CORS origins
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

app.include_router(api_router, prefix="/api/v1")


# Async database schema initialization
async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(base.Base.metadata.create_all)


# Periodic background task to refresh tokens
async def regenerate_access_token_periodically():
    while True:
        async with async_session() as db:
            print("Regenerating access token...")
            await refresh_new_token(db)
        await asyncio.sleep(4200)  # Sleep 70 minutes


# FastAPI startup event to initialize DB and start background task
@app.on_event("startup")
async def on_startup():
    await init_db()
    asyncio.create_task(regenerate_access_token_periodically())
