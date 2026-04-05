-- Migration: add atomic agent balance increment function for OnePay top-up IPN
-- This prevents race conditions when multiple IPN callbacks arrive concurrently
-- for the same or different top-up transactions targeting the same agent.

CREATE OR REPLACE FUNCTION increment_agent_balance(agent_id UUID, amount NUMERIC)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE agents
  SET balance = COALESCE(balance, 0) + amount,
      updated_at = now()
  WHERE id = agent_id;
END;
$$;
