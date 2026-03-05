#!/bin/bash
set -e

echo "=== Setting up database ==="

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-'EOSQL'
    -- Extensions
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    -- Supabase roles (referenced by RLS policies)
    DO $$ BEGIN
        CREATE ROLE authenticated;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
        CREATE ROLE service_role;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
        CREATE ROLE anon;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    -- Grant roles access to public schema
    GRANT USAGE ON SCHEMA public TO authenticated, service_role, anon;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated, service_role;

    -- Stub: Supabase auth schema
    CREATE SCHEMA IF NOT EXISTS auth;

    CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        instance_id UUID,
        aud VARCHAR(255),
        role VARCHAR(255),
        email VARCHAR(255) UNIQUE,
        encrypted_password VARCHAR(255),
        email_confirmed_at TIMESTAMPTZ,
        confirmation_token VARCHAR(255),
        recovery_token VARCHAR(255),
        raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Stub: auth.uid() returns the default dev user
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
        SELECT '00000000-0000-0000-0000-000000000001'::UUID;
    $$ LANGUAGE SQL STABLE;
EOSQL

echo "=== Applying migrations ==="
for f in $(ls /app/migrations/*.sql | sort); do
    echo "  -> $(basename "$f")"
    psql -v ON_ERROR_STOP=0 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$f" 2>&1 | grep -v "^NOTICE" || true
done

echo "=== Applying seed data ==="
psql -v ON_ERROR_STOP=0 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /app/seed.sql

echo "=== Database ready ==="
