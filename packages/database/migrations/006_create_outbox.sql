-- Migration: 006_create_outbox.sql
-- Goal: Create a durable outbox for exactly-once side effects.

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'outbox_status') THEN
        CREATE TYPE outbox_status AS ENUM ('pending', 'processing', 'published', 'failed', 'dead');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(255) NOT NULL,
    aggregate_type VARCHAR(255) NOT NULL,
    aggregate_id VARCHAR(255) NOT NULL,
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    payload JSONB NOT NULL,
    status outbox_status NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    locked_at TIMESTAMP WITH TIME ZONE,
    locked_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for polling: find pending/retryable events quickly
CREATE INDEX IF NOT EXISTS idx_outbox_polling 
ON outbox_events (status, next_attempt_at) 
WHERE status IN ('pending', 'failed');

-- Index for lock management: find stalled processing events
CREATE INDEX IF NOT EXISTS idx_outbox_lock 
ON outbox_events (locked_at) 
WHERE status = 'processing';

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION fn_update_outbox_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_outbox_timestamp ON outbox_events;
CREATE TRIGGER trg_update_outbox_timestamp
BEFORE UPDATE ON outbox_events
FOR EACH ROW EXECUTE FUNCTION fn_update_outbox_timestamp();

-- Verification indicator
SELECT 'Migration 006 (Outbox Schema) completed' as status;
