-- Migration: 005_add_recon_type.sql
-- Description: Adds 'reconciliation_adjustment' to the allowed transaction types.

ALTER TABLE credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_type_check;
ALTER TABLE credit_transactions ADD CONSTRAINT credit_transactions_type_check 
CHECK (type IN ('addition', 'deduction', 'reservation', 'debit_capture', 'refund', 'reconciliation_adjustment'));

SELECT 'Migration 005 (Recon Type) completed' as status;
