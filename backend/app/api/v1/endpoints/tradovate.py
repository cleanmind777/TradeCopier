from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
import httpx
from app.schemas.broker import BrokerAdd
from app.services.broker_service import add_tradovate_broker
from app.dependencies.database import get_db
from app.core.config import settings
from app.utils.tradovate import get_auth_url

CLIENT_ID = settings.CID
CLIENT_SECRET = settings.SEC
REDIRECT_URI = settings.TRADOVATE_REDIRECT_URL
AUTH_URL = settings.TRADOVATE_AUTH_URL
EXCHANGE_URL = settings.TRADOVATE_EXCHANGE_URL
API_ME_URL = settings.TRADOVATE_API_ME_URL
FRONTEND_URL = settings.FRONTEND_URL

router = APIRouter()

router.user_id = ""


@router.get("/", response_class=HTMLResponse)
async def homepage(request: Request, db: Session = Depends(get_db)):
    access_token = request.session.get("access_token")
    expire_in = request.session.get("expires_in")
    if access_token:
        # Fetch user info
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {access_token}"}
            r = await client.get(API_ME_URL, headers=headers)
            if r.status_code == 200:
                me = r.json()
            else:
                # Token might be invalid or expired, clear session
                request.session.pop("access_token", None)
                return HTMLResponse(
                    """
                    <h2>Tradovate OAuth</h2>
                    <a href="/auth"><h3>Click to Authenticate</h3></a>
                """
                )
        broker_add = BrokerAdd(
            user_id=router.user_id,
            type="tradovate",
            user_broker_id=me.get("userId"),
            access_token=access_token,
            expire_in=expire_in,
        )
        html = f"""
        <h2>Welcome, {me.get('fullName')}</h2>
        <p>ID: {me.get('userId')}</p>
        <p>Email: {me.get('email')}</p>
        <p>Verified?: {me.get('emailVerified')}</p>
        <p>Trial?: {me.get('isTrial')}</p>
        <a href="/logout"><h3>Logout</h3></a>
        """
        user_brokers_list = add_tradovate_broker(db, broker_add)
        return RedirectResponse(f"{FRONTEND_URL}/broker")
    else:
        # No token - show login link
        return HTMLResponse(
            """
            <h2>Tradovate OAuth</h2>
            <a href="/auth"><h3>Click to Authenticate</h3></a>
        """
        )


@router.get("/auth")
async def auth(request: Request):
    # Redirect user to Tradovate OAuth login page
    print(router.user_id)
    user_id = request.query_params.get("user_id")
    router.user_id = user_id
    request.session["user_id"] = user_id
    print(router.user_id)
    return RedirectResponse(get_auth_url())


@router.get("/oauth/tradovate/callback")
async def oauth_callback(
    request: Request, code: str = None, db: Session = Depends(get_db)
):
    if not code:
        return HTMLResponse("No code provided", status_code=400)
    # Exchange code for token
    data = {
        "grant_type": "authorization_code",
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "redirect_uri": REDIRECT_URI,
        "code": code,
    }
    async with httpx.AsyncClient() as client:
        r = await client.post(EXCHANGE_URL, data=data)
        if r.status_code != 200:
            return HTMLResponse(f"Failed to exchange code: {r.text}", status_code=400)
        token_data = r.json()
        print(token_data)
        if "error" in token_data:
            return HTMLResponse(
                f"Error: {token_data['error_description']}", status_code=400
            )

        # Save access token in session
        request.session["access_token"] = token_data["access_token"]
        request.session["expires_in"] = token_data["expires_in"]
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {token_data['access_token']}"}
            r = await client.get(API_ME_URL, headers=headers)
            print("asdfasdfsdf,", r.status_code)
            if r.status_code == 200:
                me = r.json()
            else:
                # Token might be invalid or expired, clear session
                request.session.pop("access_token", None)
                return HTMLResponse(
                    """
                    <h2>Tradovate OAuth</h2>
                    <a href="/auth"><h3>Click to Authenticate</h3></a>
                """
                )
        broker_add = BrokerAdd(
            user_id=router.user_id,
            type="tradovate",
            user_broker_id=str(me.get("userId")),
            access_token=token_data["access_token"],
            expire_in=token_data["expires_in"],
        )
        user_brokers_list = await add_tradovate_broker(db, broker_add)
    print(token_data["access_token"], token_data["expires_in"])
    return RedirectResponse(f"{FRONTEND_URL}/broker")


@router.get("/logout")
async def logout(request: Request):
    request.session.pop("access_token", None)
    return RedirectResponse("/")
