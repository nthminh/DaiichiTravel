-- ============================================================
-- DaiichiTravel – Supabase PostgreSQL Schema
-- Migration 001: Initial schema (replaces Firebase Firestore)
-- ============================================================
-- Column names use snake_case (PostgreSQL convention).
-- camelCase ↔ snake_case conversion is handled by the JS client
-- via toSnakeCaseObj / toCamelCaseObj in src/lib/supabase.ts.
-- JSONB columns (seats, addons, layout, etc.) store TypeScript
-- objects as-is (camelCase), since they are opaque to SQL queries.
-- ============================================================

-- ─── Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Group 1: Core Transport ─────────────────────────────────

-- 1. vehicle_types
CREATE TABLE IF NOT EXISTS vehicle_types (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  "order"    INT
);

-- 2. vehicles
CREATE TABLE IF NOT EXISTS vehicles (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stt                  INT,
  license_plate        TEXT NOT NULL,
  phone                TEXT,
  type                 TEXT,
  seats                INT,
  registration_expiry  DATE,
  status               TEXT,
  owner_id             TEXT,
  layout               JSONB,   -- VehicleSeat[] stored as camelCase JSON
  note                 TEXT,
  seat_type            TEXT     -- 'assigned' | 'free'
);

-- 3. stops
CREATE TABLE IF NOT EXISTS stops (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  address       TEXT,
  category      TEXT,   -- MAJOR|MINOR|TOLL|RESTAURANT|QUICK|TRANSIT|OFFICE|FREE
  surcharge     NUMERIC,
  distance_km   NUMERIC,
  note          TEXT,
  type          TEXT,   -- TERMINAL|STOP|FREE_STOP
  terminal_id   UUID REFERENCES stops(id),
  priority      INT,
  vehicle_types TEXT[],
  stt           INT
);

-- 4. routes
CREATE TABLE IF NOT EXISTS routes (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stt                        INT,
  name                       TEXT NOT NULL,
  note                       TEXT,
  departure_point            TEXT,
  arrival_point              TEXT,
  price                      NUMERIC,
  agent_price                NUMERIC,
  price_periods              JSONB,    -- PricePeriod[]
  surcharges                 JSONB,    -- RouteSurcharge[]
  details                    TEXT,
  route_stops                JSONB,    -- RouteStop[]
  disable_pickup_address     BOOLEAN,
  disable_dropoff_address    BOOLEAN,
  duration                   INT,
  departure_offset_minutes   INT,
  arrival_offset_minutes     INT,
  image_url                  TEXT,
  images                     TEXT[],
  vehicle_image_url          TEXT,
  updated_at                 TIMESTAMPTZ DEFAULT now(),
  child_pricing_rules        JSONB,    -- ChildPricingRule[]
  route_category             TEXT,     -- BUS|TOUR_SHORT|CRUISE|HOTEL
  addons                     JSONB     -- TripAddon[]
);

-- 5. route_fares  (replaces Firestore subcollection routeFares/{routeId}/fares)
CREATE TABLE IF NOT EXISTS route_fares (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id     UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  from_stop_id UUID REFERENCES stops(id),
  to_stop_id   UUID REFERENCES stops(id),
  price        NUMERIC,
  agent_price  NUMERIC,
  currency     TEXT DEFAULT 'VND',
  active       BOOLEAN DEFAULT true,
  updated_at   TIMESTAMPTZ DEFAULT now(),
  start_date   DATE,
  end_date     DATE,
  sort_order   INT,
  -- Deterministic doc-id kept as a unique key so upsert works like Firestore setDoc.
  fare_doc_id  TEXT UNIQUE
);

-- 6. route_seat_fares  (replaces Firestore subcollection routeSeatFares/{routeId}/seats)
CREATE TABLE IF NOT EXISTS route_seat_fares (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id     UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  seat_id      TEXT NOT NULL,
  price        NUMERIC,
  agent_price  NUMERIC,
  start_date   DATE,
  end_date     DATE,
  note         TEXT,
  active       BOOLEAN DEFAULT true,
  updated_at   TIMESTAMPTZ DEFAULT now(),
  -- Deterministic doc-id so upsert works like Firestore setDoc.
  fare_doc_id  TEXT UNIQUE
);

-- 7. trips
CREATE TABLE IF NOT EXISTS trips (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route                 TEXT,
  time                  TEXT,
  date                  TEXT NOT NULL,
  license_plate         TEXT,
  driver_name           TEXT,
  status                TEXT DEFAULT 'WAITING',  -- WAITING|RUNNING|COMPLETED
  seats                 JSONB,                    -- Seat[] stored as camelCase JSON
  price                 NUMERIC,
  agent_price           NUMERIC,
  discount_percent      NUMERIC,
  addons                JSONB,                    -- TripAddon[]
  note                  TEXT,
  seat_type             TEXT,                     -- 'assigned' | 'free'
  is_merged             BOOLEAN DEFAULT false,
  merged_from_trip_ids  TEXT[],
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- ─── Group 2: Booking & Payment ──────────────────────────────

-- 8. customers  (linked to auth.users when phone/email OTP is used)
CREATE TABLE IF NOT EXISTS customers (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username                      TEXT UNIQUE,
  role                          TEXT,
  name                          TEXT,
  phone                         TEXT,
  email                         TEXT,
  address                       TEXT,
  agent_code                    TEXT,
  balance                       NUMERIC DEFAULT 0,
  password                      TEXT,
  status                        TEXT DEFAULT 'ACTIVE',
  registered_at                 TIMESTAMPTZ,
  total_bookings                INT DEFAULT 0,
  total_spent                   NUMERIC DEFAULT 0,
  last_activity_at              TIMESTAMPTZ,
  category_id                   UUID,
  category_name                 TEXT,
  category_verification_status  TEXT,
  category_proof_image_url      TEXT,
  firebase_uid                  TEXT,
  login_method                  TEXT,
  viewed_routes                 TEXT[],
  viewed_tours                  TEXT[],
  booked_routes                 TEXT[],
  preferences                   JSONB
);

-- 9. agents
CREATE TABLE IF NOT EXISTS agents (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                    TEXT UNIQUE NOT NULL,
  name                    TEXT NOT NULL,
  phone                   TEXT,
  email                   TEXT,
  address                 TEXT,
  commission_rate         NUMERIC,
  balance                 NUMERIC DEFAULT 0,
  status                  TEXT DEFAULT 'ACTIVE',
  username                TEXT,
  password                TEXT,
  note                    TEXT,
  payment_type            TEXT,
  credit_limit            NUMERIC,
  deposit_amount          NUMERIC,
  allowed_payment_options TEXT[],
  hold_ticket_hours       INT,
  route_commission_rates  JSONB,
  updated_at              TIMESTAMPTZ DEFAULT now()
);

-- 10. employees
CREATE TABLE IF NOT EXISTS employees (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  phone      TEXT,
  email      TEXT,
  address    TEXT,
  role       TEXT,
  position   TEXT,
  status     TEXT DEFAULT 'ACTIVE',
  username   TEXT,
  password   TEXT,
  note       TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 11. bookings
CREATE TABLE IF NOT EXISTS bookings (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type                     TEXT NOT NULL,           -- TICKET|TOUR
  user_id                  UUID,
  customer_name            TEXT,
  customer_phone           TEXT,
  total_amount             NUMERIC,
  status                   TEXT DEFAULT 'PENDING',  -- PENDING|CONFIRMED|CANCELLED
  created_at               TIMESTAMPTZ DEFAULT now(),
  trip_id                  UUID REFERENCES trips(id),
  seats                    JSONB,                   -- string[] seat IDs
  tour_id                  UUID,
  adults                   INT,
  children                 INT,
  selected_addons          JSONB,
  selected_room_type_id    TEXT,
  selected_room_type_name  TEXT,
  -- Additional fields used by the app
  ticket_code              TEXT,
  agent_id                 UUID REFERENCES agents(id),
  payment_method           TEXT,
  booking_date             TEXT,
  pickup_address           TEXT,
  dropoff_address          TEXT,
  from_stop_id             TEXT,
  to_stop_id               TEXT,
  note                     TEXT,
  fare_amount              NUMERIC,
  discount_amount          NUMERIC,
  segment_info             JSONB
);

-- 12. pending_payments
CREATE TABLE IF NOT EXISTS pending_payments (
  id             TEXT PRIMARY KEY,   -- equals payment_ref
  payment_ref    TEXT UNIQUE NOT NULL,
  expected_amount NUMERIC,
  customer_name  TEXT,
  route_info     TEXT,
  trip_id        UUID REFERENCES trips(id),
  status         TEXT DEFAULT 'PENDING',  -- PENDING|PAID|CANCELLED|EXPIRED
  paid_amount    NUMERIC,
  paid_content   TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  confirmed_at   TIMESTAMPTZ
);

-- 13. invoices
CREATE TABLE IF NOT EXISTS invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number  TEXT UNIQUE,
  type            TEXT,   -- RETAIL|AGENT
  customer_id     UUID,
  customer_name   TEXT,
  customer_phone  TEXT,
  agent_id        UUID REFERENCES agents(id),
  agent_name      TEXT,
  items           JSONB,
  subtotal        NUMERIC,
  discount        NUMERIC,
  tax             NUMERIC,
  total           NUMERIC,
  paid_amount     NUMERIC,
  debt_amount     NUMERIC,
  status          TEXT DEFAULT 'UNPAID',  -- UNPAID|PARTIAL|PAID
  payment_method  TEXT,
  due_date        DATE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  notes           TEXT
);

-- 14. inquiries
CREATE TABLE IF NOT EXISTS inquiries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT,
  phone       TEXT,
  email       TEXT,
  "from"      TEXT,
  "to"        TEXT,
  date        DATE,
  return_date DATE,
  adults      INT,
  children    INT,
  notes       TEXT,
  trip_type   TEXT,
  phase       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ─── Group 3: Tours & Properties ─────────────────────────────

-- 15. properties
CREATE TABLE IF NOT EXISTS properties (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  owner_id    UUID,
  country     TEXT,
  type        TEXT,   -- cruise|homestay|resort
  address     TEXT,
  description TEXT,
  images      TEXT[],
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 16. property_room_types  (replaces Firestore subcollection properties/{id}/room_types)
CREATE TABLE IF NOT EXISTS property_room_types (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id       UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  capacity_adults   INT,
  capacity_children INT,
  area_sqm          NUMERIC,
  base_price        NUMERIC,
  surcharges        JSONB,
  checkin_time      TEXT,
  checkout_time     TEXT,
  amenities         TEXT[],
  images            TEXT[],
  total_units       INT
);

-- 17. tours
CREATE TABLE IF NOT EXISTS tours (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                TEXT NOT NULL,
  description          TEXT,
  price                NUMERIC,
  image_url            TEXT,
  images               TEXT[],
  discount_percent     NUMERIC,
  price_adult          NUMERIC,
  price_child          NUMERIC,
  num_adults           INT,
  num_children         INT,
  duration             TEXT,
  nights               INT,
  price_per_night      NUMERIC,
  breakfast_count      INT,
  price_per_breakfast  NUMERIC,
  surcharge            NUMERIC,
  surcharge_note       TEXT,
  youtube_url          TEXT,
  start_date           DATE,
  end_date             DATE,
  departure_time       TEXT,
  departure_location   TEXT,
  return_time          TEXT,
  return_location      TEXT,
  room_types           JSONB,   -- TourRoomType[]
  itinerary            JSONB,   -- {day, content}[]
  addons               JSONB,   -- {id, name, price, description}[]
  linked_property_id   UUID REFERENCES properties(id),
  child_pricing_rules  JSONB,
  created_at           TIMESTAMPTZ DEFAULT now()
);

-- ─── Group 4: System & Audit ──────────────────────────────────

-- 18. customer_categories
CREATE TABLE IF NOT EXISTS customer_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT,
  sort_order  INT
);

-- 19. category_requests
CREATE TABLE IF NOT EXISTS category_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id       UUID REFERENCES customers(id),
  customer_name     TEXT,
  customer_phone    TEXT,
  category_id       UUID REFERENCES customer_categories(id),
  category_name     TEXT,
  proof_image_url   TEXT,
  status            TEXT DEFAULT 'PENDING',  -- PENDING|APPROVED|REJECTED
  submitted_at      TIMESTAMPTZ DEFAULT now(),
  reviewed_at       TIMESTAMPTZ,
  reviewed_by       TEXT,
  review_note       TEXT
);

-- 20. consignments
CREATE TABLE IF NOT EXISTS consignments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_name    TEXT,
  sender_phone   TEXT,
  receiver_name  TEXT,
  receiver_phone TEXT,
  status         TEXT DEFAULT 'PENDING',  -- PENDING|PICKED_UP|DELIVERED
  qr_code        TEXT,
  photo_url      TEXT,
  type           TEXT,
  weight         NUMERIC,
  cod            NUMERIC,
  items          JSONB,
  route_id       UUID REFERENCES routes(id),
  trip_id        UUID REFERENCES trips(id),
  created_at     TIMESTAMPTZ DEFAULT now(),
  notes          TEXT
);

-- 21. driver_assignments
CREATE TABLE IF NOT EXISTS driver_assignments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id             UUID REFERENCES trips(id),
  seat_id             TEXT,
  seat_ids            TEXT[],
  trip_route          TEXT,
  trip_date           DATE,
  trip_time           TEXT,
  license_plate       TEXT,
  customer_name       TEXT,
  customer_phone      TEXT,
  adults              INT,
  children            INT,
  pickup_address      TEXT,
  dropoff_address     TEXT,
  pickup_address_detail    TEXT,
  dropoff_address_detail   TEXT,
  pickup_stop_address      TEXT,
  dropoff_stop_address     TEXT,
  task_type           TEXT,   -- pickup|dropoff
  driver_employee_id  UUID REFERENCES employees(id),
  driver_name         TEXT,
  assigned_by         TEXT,
  assigned_at         TIMESTAMPTZ DEFAULT now(),
  status              TEXT DEFAULT 'pending',  -- pending|accepted|rejected|completed
  responded_at        TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  rejection_reason    TEXT,
  note                TEXT
);

-- 22. staff_messages
CREATE TABLE IF NOT EXISTS staff_messages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id      UUID,
  sender_name    TEXT,
  content        TEXT,
  mentions       TEXT[],
  created_at     TIMESTAMPTZ DEFAULT now(),
  assignment_id  UUID REFERENCES driver_assignments(id),
  voice_url      TEXT,
  message_type   TEXT DEFAULT 'text'   -- text|voice
);

-- 23. audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     UUID,
  actor_name   TEXT,
  actor_role   TEXT,
  action       TEXT,
  target_type  TEXT,
  target_id    TEXT,
  target_label TEXT,
  detail       TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  ip_address   TEXT
);

-- 24. user_guides
CREATE TABLE IF NOT EXISTS user_guides (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role       TEXT,
  title      TEXT,
  blocks     JSONB,   -- {type: 'text'|'image', content: string}[]
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 25. settings
CREATE TABLE IF NOT EXISTS settings (
  id         TEXT PRIMARY KEY,   -- e.g. 'permissions', 'adminCredentials', 'paymentSettings'
  value      JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Indexes ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_trips_date       ON trips(date DESC);
CREATE INDEX IF NOT EXISTS idx_trips_status     ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_license    ON trips(license_plate);
CREATE INDEX IF NOT EXISTS idx_bookings_trip    ON bookings(trip_id);
CREATE INDEX IF NOT EXISTS idx_bookings_phone   ON bookings(customer_phone);
CREATE INDEX IF NOT EXISTS idx_bookings_status  ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_type    ON bookings(type);
CREATE INDEX IF NOT EXISTS idx_customers_phone  ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_invoices_status  ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_route_fares_doc  ON route_fares(fare_doc_id);
CREATE INDEX IF NOT EXISTS idx_route_seat_fares_doc ON route_seat_fares(fare_doc_id);
CREATE INDEX IF NOT EXISTS idx_route_fares_route ON route_fares(route_id);
CREATE INDEX IF NOT EXISTS idx_route_seat_fares_route ON route_seat_fares(route_id);
CREATE INDEX IF NOT EXISTS idx_property_room_types_property ON property_room_types(property_id);
CREATE INDEX IF NOT EXISTS idx_pending_payments_ref ON pending_payments(payment_ref);
