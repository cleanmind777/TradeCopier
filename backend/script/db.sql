CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR NOT NULL UNIQUE,
    name VARCHAR NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_verified BOOLEAN DEFAULT FALSE,
    otp_code VARCHAR,
    otp_expire TIMESTAMPTZ,
    reset_token VARCHAR
);
