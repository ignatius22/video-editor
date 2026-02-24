-- Migration: 004_billing_state_guards.sql
-- Goal: Enforce legal transitions for credit reservations in the ledger.

-- 1. Ensure uniqueness of 'refund' type per operation
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_refund_per_op 
ON credit_transactions (operation_id) 
WHERE type = 'refund';

-- 2. State Machine Guard Trigger
CREATE OR REPLACE FUNCTION fn_guard_credit_state_transitions()
RETURNS TRIGGER AS $$
DECLARE
    v_existing_type VARCHAR;
    v_original_amount NUMERIC;
BEGIN
    -- Only apply logic to job-linked transactions (reservation-related)
    IF NEW.operation_id IS NULL OR NEW.type NOT IN ('debit_capture', 'refund') THEN
        RETURN NEW;
    END IF;

    -- Look for the mandatory original reservation
    SELECT type, amount INTO v_existing_type, v_original_amount
    FROM credit_transactions
    WHERE operation_id = NEW.operation_id AND type = 'reservation'
    LIMIT 1;

    -- Rule: Must have a reservation before capture or refund
    IF v_existing_type IS NULL THEN
        RAISE EXCEPTION 'Illegal state transition: No reservation found for operation %', NEW.operation_id;
    END IF;

    -- Rule: Cannot capture/refund if the other already exists
    IF EXISTS (
        SELECT 1 FROM credit_transactions 
        WHERE operation_id = NEW.operation_id 
        AND type = (CASE WHEN NEW.type = 'debit_capture' THEN 'refund' ELSE 'debit_capture' END)
    ) THEN
        RAISE EXCEPTION 'Illegal state transition: Operation % already has a terminal state (cannot mix capture and refund)', NEW.operation_id;
    END IF;

    -- Rule: Amount must be consistent
    -- For 'refund', it must exactly match the absolute value of the reservation.
    -- For 'debit_capture', we use 0 to avoid double-deducting from the ledger sum.
    IF NEW.type = 'refund' AND ABS(NEW.amount) != ABS(v_original_amount) THEN
        RAISE EXCEPTION 'Amount mismatch: Original reservation was %, but refund attempt is %', 
            v_original_amount, NEW.amount;
    END IF;

    IF NEW.type = 'debit_capture' AND NEW.amount != 0 THEN
        RAISE EXCEPTION 'Invalid capture amount: Capture must be 0 (marker) as reservation % already deducted credits', 
            v_original_amount;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_billing_state ON credit_transactions;
CREATE TRIGGER trg_guard_billing_state
BEFORE INSERT ON credit_transactions
FOR EACH ROW EXECUTE FUNCTION fn_guard_credit_state_transitions();

-- 3. Prevent UPDATES to existing ledger entries (Immutability)
CREATE OR REPLACE FUNCTION fn_prevent_ledger_update()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Ledger entries are immutable. Cannot update record id %', OLD.id;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_ledger_immutable ON credit_transactions;
CREATE TRIGGER trg_prevent_ledger_immutable
BEFORE UPDATE ON credit_transactions
FOR EACH ROW EXECUTE FUNCTION fn_prevent_ledger_update();

-- Verification indicator
SELECT 'Migration 004 (State Guards) completed' as status;
