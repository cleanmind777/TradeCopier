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
    user_id UUID NOT NULL REFERENCES users(id),
    nickname VARCHAR NOT NULL,
    type VARCHAR NOT NULL,
    last_sync TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status BOOLEAN DEFAULT FALSE,
    user_broker_id VARCHAR,
    access_token VARCHAR,
    expire_in VARCHAR
);

CREATE TABLE sub_broker_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    user_broker_id VARCHAR NOT NULL,
    broker_account_id UUID NOT NULL REFERENCES broker_accounts(id),
    sub_account_id VARCHAR NOT NULL,
    nickname VARCHAR NOT NULL,
    sub_account_name VARCHAR NOT NULL,
    type VARCHAR NOT NULL,
    account_type VARCHAR NOT NULL,
    is_demo BOOLEAN NOT NULL,
    last_sync TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status BOOLEAN NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);


CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    qty INTEGER NOT NULL DEFAULT 0
)

CREATE TABLE groups_brokers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL,
    sub_broker_id UUID NOT NULL
)