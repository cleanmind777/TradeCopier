from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth,
    user,
    admin,
    broker,
    tradovate,
    sub_broker,
    signalstack,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(user.router, prefix="/user", tags=["user"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(broker.router, prefix="/broker", tags=["broker"])
api_router.include_router(sub_broker.router, prefix="/subbroker", tags=["subbroker"])
api_router.include_router(tradovate.router, prefix="/tradovate", tags=["tradovate"])
api_router.include_router(tradovate.router, prefix="/signalstack", tags=["signalstack"])
