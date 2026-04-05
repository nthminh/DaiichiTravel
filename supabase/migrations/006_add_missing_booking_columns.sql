-- Migration 006: Add missing columns to bookings table
-- These columns are required to store all fields written by the frontend
-- after migration from Firebase (which used flexible document storage).

ALTER TABLE bookings
  -- Customer contact (frontend writes 'phone' directly)
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,

  -- Trip/tour identifiers for display
  ADD COLUMN IF NOT EXISTS route TEXT,
  ADD COLUMN IF NOT EXISTS date TEXT,        -- trip/tour departure date (e.g. "2024-06-15")
  ADD COLUMN IF NOT EXISTS time TEXT,        -- trip departure time (e.g. "07:00")

  -- Seat references
  ADD COLUMN IF NOT EXISTS seat_id TEXT,     -- primary seat ID (single-seat booking)
  ADD COLUMN IF NOT EXISTS seat_ids JSONB,   -- all seat IDs (array of strings)

  -- Pricing (frontend writes 'amount' for the booking total)
  ADD COLUMN IF NOT EXISTS amount NUMERIC,

  -- Staff / agent info
  ADD COLUMN IF NOT EXISTS agent TEXT,
  ADD COLUMN IF NOT EXISTS booked_by_name TEXT,
  ADD COLUMN IF NOT EXISTS booked_by_role TEXT,
  ADD COLUMN IF NOT EXISTS agent_commission_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS agent_commission_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS agent_retail_amount NUMERIC,

  -- Pickup / dropoff details
  ADD COLUMN IF NOT EXISTS pickup_point TEXT,
  ADD COLUMN IF NOT EXISTS dropoff_point TEXT,
  ADD COLUMN IF NOT EXISTS pickup_address_detail TEXT,
  ADD COLUMN IF NOT EXISTS dropoff_address_detail TEXT,
  ADD COLUMN IF NOT EXISTS pickup_stop_address TEXT,
  ADD COLUMN IF NOT EXISTS dropoff_stop_address TEXT,

  -- Notes and flags
  ADD COLUMN IF NOT EXISTS booking_note TEXT,
  ADD COLUMN IF NOT EXISTS free_seating BOOLEAN DEFAULT FALSE,

  -- Surcharges
  ADD COLUMN IF NOT EXISTS route_surcharges JSONB,
  ADD COLUMN IF NOT EXISTS pickup_surcharge_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS dropoff_surcharge_amount NUMERIC,

  -- Fare details
  ADD COLUMN IF NOT EXISTS fare_doc_id TEXT,
  ADD COLUMN IF NOT EXISTS fare_price_per_person NUMERIC,
  ADD COLUMN IF NOT EXISTS fare_retail_price_per_person NUMERIC,

  -- Payment tracking
  ADD COLUMN IF NOT EXISTS payment_ref TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT,

  -- Round-trip bookings
  ADD COLUMN IF NOT EXISTS is_round_trip BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS outbound_leg JSONB,

  -- Tour-specific fields
  ADD COLUMN IF NOT EXISTS accommodation TEXT,
  ADD COLUMN IF NOT EXISTS meal_plan TEXT,
  ADD COLUMN IF NOT EXISTS nights_booked INT,
  ADD COLUMN IF NOT EXISTS breakfasts_booked INT,
  ADD COLUMN IF NOT EXISTS surcharge NUMERIC,
  ADD COLUMN IF NOT EXISTS surcharge_note TEXT,
  ADD COLUMN IF NOT EXISTS duration TEXT,
  ADD COLUMN IF NOT EXISTS nights INT,
  ADD COLUMN IF NOT EXISTS notes TEXT;
