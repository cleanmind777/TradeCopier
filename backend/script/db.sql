CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR NOT NULL UNIQUE,
    name VARCHAR NOT NULL,
    admin_role BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_verified BOOLEAN DEFAULT FALSE,
    is_accepted BOOLEAN DEFAULT FALSE,
    otp_code VARCHAR,
    otp_expire TIMESTAMPTZ,
    reset_token VARCHAR
);


CREATE TABLE broker_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    nickname VARCHAR NOT NULL,
    type VARCHAR NOT NULL,
    last_sync TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status BOOLEAN DEFAULT FALSE,
    user_broker_id VARCHAR,
    access_token VARCHAR,
    md_access_token VARCHAR
);
