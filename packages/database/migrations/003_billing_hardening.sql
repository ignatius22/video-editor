-- Migration: Production Billing Hardening (PR #1)
-- Description: Adds idempotency tracking and operation linking to credit_transactions.

-- 1. Add request_id and operation_id columns
ALTER TABLE credit_transactions 
ADD COLUMN IF NOT EXISTS request_id UUID,
ADD COLUMN IF NOT EXISTS operation_id VARCHAR(50);

-- 2. Update type constraint to include reservation and refund states
-- Note: We drop and recreate the constraint to ensure 'reservation', 'capture', 'refund' are allowed
ALTER TABLE credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_type_check;
ALTER TABLE credit_transactions ADD CONSTRAINT credit_transactions_type_check 
CHECK (type IN ('addition', 'deduction', 'reservation', 'debit_capture', 'refund'));

-- 3. Idempotency constraint: Prevent duplicate transactions for the same request
-- Using user_id + request_id to allow different users to potentially have colliding UUIDs (though rare)
ALTER TABLE credit_transactions DROP CONSTRAINT IF EXISTS unique_user_request;
ALTER TABLE credit_transactions ADD CONSTRAINT unique_user_request UNIQUE (user_id, request_id);

-- 4. Double-charge prevention: Prevent multiple captures for the same operation
-- This ensures that for any job (operation_id), we only ever have ONE 'debit_capture' entry.
-- We use a partial unique index for this if the DB supports it, or a standard unique if it's strictly one-to-one.
-- Since a job might have a reservation and a capture, we only care about multiple captures.
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_capture_per_op 
ON credit_transactions (operation_id) 
WHERE type = 'debit_capture';

-- 5. Index for reconciliation and lookups
CREATE INDEX IF NOT EXISTS idx_credit_transactions_op_id ON credit_transactions(operation_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_request_id ON credit_transactions(request_id);
