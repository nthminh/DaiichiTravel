-- Migration 009: Check-in support + atomic agent top-up balance credit
--
-- 1. Add is_checked_in / checked_in_at to bookings (for kiosk check-in feature)
-- 2. Add balance_credited flag to pending_payments (idempotency guard)
-- 3. Create credit_agent_from_topup() – callable from both IPN and client as a
--    safe fallback; uses the balance_credited flag to ensure single execution.

-- ── 1. Bookings: check-in columns ─────────────────────────────────────────────
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS is_checked_in  BOOLEAN      DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS checked_in_at  TIMESTAMPTZ;

-- ── 2. Pending payments: idempotency flag ─────────────────────────────────────
ALTER TABLE pending_payments
  ADD COLUMN IF NOT EXISTS balance_credited BOOLEAN DEFAULT FALSE;

-- ── 3. Atomic top-up credit function ──────────────────────────────────────────
-- Finds the pending_payment by payment_ref, extracts the agent code from
-- a TOPUP* reference, and credits the agent balance exactly once.
-- Returns TRUE when a credit was applied, FALSE if already credited or not found.
CREATE OR REPLACE FUNCTION credit_agent_from_topup(p_payment_ref TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment        RECORD;
  v_agent_code     TEXT;
  v_agent_id       UUID;
  v_amount         NUMERIC;
BEGIN
  -- Only process TOPUP* references
  IF p_payment_ref NOT LIKE 'TOPUP%' THEN
    RETURN FALSE;
  END IF;

  -- Lock the row and check if already credited
  SELECT *
    INTO v_payment
    FROM pending_payments
   WHERE payment_ref = p_payment_ref
     AND status = 'PAID'
     AND COALESCE(balance_credited, FALSE) = FALSE
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;  -- already credited or not paid yet
  END IF;

  -- Mark credited first (idempotency guard)
  UPDATE pending_payments
     SET balance_credited = TRUE
   WHERE payment_ref = p_payment_ref
     AND COALESCE(balance_credited, FALSE) = FALSE;

  IF NOT FOUND THEN
    RETURN FALSE;  -- another concurrent call won the race
  END IF;

  -- Extract agent code: strip the leading 'TOPUP' prefix
  v_agent_code := regexp_replace(p_payment_ref, '^TOPUP', '');

  SELECT id INTO v_agent_id
    FROM agents
   WHERE code = v_agent_code;

  IF v_agent_id IS NULL THEN
    RETURN FALSE;
  END IF;

  v_amount := COALESCE(v_payment.paid_amount, v_payment.expected_amount, 0);

  PERFORM increment_agent_balance(v_agent_id, v_amount);

  RETURN TRUE;
END;
$$;
