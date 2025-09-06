from app.core.config import settings

CLIENT_ID = settings.CID
REDIRECT_URI = settings.TRADOVATE_REDIRECT_URL
AUTH_URL = settings.TRADOVATE_AUTH_URL


def get_auth_url():
    return f"{AUTH_URL}?response_type=code&client_id={CLIENT_ID}&redirect_uri={REDIRECT_URI}"
