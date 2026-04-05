-- Migration 010: Add booking_data to pending_payments
-- This allows the onepay-ipn Edge Function to create booking records
-- server-side when a payment is confirmed, so bookings are never lost
-- if the browser tab is closed before the real-time listener fires.

ALTER TABLE pending_payments
  ADD COLUMN IF NOT EXISTS booking_data JSONB;  -- full booking payload (camelCase) for server-side booking creation
