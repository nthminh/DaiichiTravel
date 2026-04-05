-- Migration 011: Add missing route settings columns
--
-- Adds the columns used by the route settings modal (Thiết lập) that were
-- present in the TypeScript types and UI but were never added to the DB schema.
-- Without these columns every route UPDATE silently failed (PostgREST rejected
-- the request with PGRST204 "column not found" but the error was swallowed).
--
-- Columns for Cấu hình điểm đón / điểm trả (pickup/dropoff disable date range)
ALTER TABLE routes
  ADD COLUMN IF NOT EXISTS disable_pickup_address_from       TEXT,
  ADD COLUMN IF NOT EXISTS disable_pickup_address_to         TEXT,
  ADD COLUMN IF NOT EXISTS disable_pickup_address_stop_type  TEXT DEFAULT 'ALL',
  ADD COLUMN IF NOT EXISTS disable_dropoff_address_from      TEXT,
  ADD COLUMN IF NOT EXISTS disable_dropoff_address_to        TEXT,
  ADD COLUMN IF NOT EXISTS disable_dropoff_address_stop_type TEXT DEFAULT 'ALL';

-- Columns for Vô hiệu hóa theo loại điểm dừng (disable by stop category)
ALTER TABLE routes
  ADD COLUMN IF NOT EXISTS disabled_pickup_categories           JSONB,
  ADD COLUMN IF NOT EXISTS disabled_pickup_categories_from_date TEXT,
  ADD COLUMN IF NOT EXISTS disabled_pickup_categories_to_date   TEXT,
  ADD COLUMN IF NOT EXISTS disabled_dropoff_categories           JSONB,
  ADD COLUMN IF NOT EXISTS disabled_dropoff_categories_from_date TEXT,
  ADD COLUMN IF NOT EXISTS disabled_dropoff_categories_to_date   TEXT;
