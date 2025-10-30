from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    debug: bool = False
    # Database connection URL
    DATABASE_URL: str = Field(..., env="DATABASE_URL")

    ASYNC_DATABASE_URL: str = Field(..., env="ASYNC_DATABASE_URL")

    # Secret key for JWT signing
    SECRET_KEY: str = Field(..., env="SECRET_KEY")

    # JWT token expiration time in minutes (default 8 hours)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(480, env="ACCESS_TOKEN_EXPIRE_MINUTES")

    # Algorithm used for JWT encoding
    ALGORITHM: str = Field("HS256", env="ALGORITHM")

    FRONTEND_URL: str = Field("http://localhost:5173", env="FRONTEND_URL")

    EMAILJS_SERVICE_ID: str = Field(env="EMAILJS_SERVICE_ID")

    EMAILJS_OTP_TEMPLATE_ID: str = Field(env="EMAILJS_OTP_TEMPLATE_ID")

    EMAILJS_PUBLIC_KEY: str = Field(env="EMAILJS_PUBLIC_KEY")

    EMAILJS_RRIVATE_KEY: str = Field(env="EMAILJS_RRIVATE_KEY")

    OTP_EXPIRE_MINUTES: int = Field(env="OTP_EXPIRE_MINUTES")

    GOOGLE_CLIENT_ID: str = Field(env="GOOGLE_CLIENT_ID")

    ENVIRONMENT: str = Field(env="ENVIRONMENT")

    APP_VERSION: str = Field(env="APP_VERSION")

    APP_ID: str = Field(env="APP_ID")

    CID: str = Field(env="CID")

    SEC: str = Field(env="SEC")

    TRADOVATE_LIVE_API_URL: str = Field(env="TRADOVATE_LIVE_API_URL")

    TRADOVATE_DEMO_API_URL: str = Field(env="TRADOVATE_DEMO_API_URL")

    TRADOVATE_REDIRECT_URL: str = Field(env="TRADOVATE_REDIRECT_URL")

    TRADOVATE_AUTH_URL: str = Field(env="TRADOVATE_AUTH_URL")

    TRADOVATE_EXCHANGE_URL: str = Field(env="TRADOVATE_EXCHANGE_URL")

    TRADOVATE_API_ME_URL: str = Field(env="TRADOVATE_API_ME_URL")

    DATABENTO_KEY: str = Field(env="DATABENTO_KEY")

    # Optional Redis cache
    REDIS_URL: str | None = Field(default=None, env="REDIS_URL")
    CACHE_TTL_SECONDS: int = Field(default=2, env="CACHE_TTL_SECONDS")

    class Config:
        # Path to the .env file (relative to project root)
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "forbid"


# Create a singleton settings instance to be imported and used throughout the app
settings = Settings()
