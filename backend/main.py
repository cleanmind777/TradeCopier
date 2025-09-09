from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.routers import api_router
from app.db.session import engine
from app.models import base
from starlette.middleware.sessions import SessionMiddleware
import os
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env", encoding="utf-8-sig")

base.Base.metadata.create_all(bind=engine)

app = FastAPI(title="My FastAPI App")

# Add your frontend origin here exactly as you access it in the browser
origins = [
    "http://localhost:5173",
    "https://5a5f0ab14919.ngrok-free.app"
]

app.add_middleware(SessionMiddleware, secret_key="!secret")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,       # Exact frontend origin(s)
    allow_credentials=True,      # Allow cookies and auth headers
    allow_methods=["*"],         # Allow all HTTP methods
    allow_headers=["*"],         # Allow all headers
)

app.include_router(api_router, prefix="/api/v1")
