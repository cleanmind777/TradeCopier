from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.routers import api_router
from app.db.session import engine
from app.models import base
from starlette.middleware.sessions import SessionMiddleware
import os
from dotenv import load_dotenv
import asyncio
from app.dependencies.database import get_db
from app.dependencies.database import SessionLocal
from app.services.broker_service import refresh_new_token

load_dotenv(dotenv_path=".env", encoding="utf-8-sig")

base.Base.metadata.create_all(bind=engine)

app = FastAPI(title="My FastAPI App")

# Add your frontend origin here exactly as you access it in the browser
origins = [
    "http://localhost:5173",
    "http://tc.streetagent.ai",
    "https://tc.streetagent.ai",
]

app.add_middleware(SessionMiddleware, secret_key="!secret")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # Exact frontend origin(s)
    allow_credentials=True,  # Allow cookies and auth headers
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)

app.include_router(api_router, prefix="/api/v1")


async def regenerate_access_token_periodically():
    while True:
        async with SessionLocal() as db:
            # Your regeneration logic here
            print("Regenerating access token...")
            await refresh_new_token(db)
        await asyncio.sleep(120)  # Sleep 2 minutes


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(regenerate_access_token_periodically())
