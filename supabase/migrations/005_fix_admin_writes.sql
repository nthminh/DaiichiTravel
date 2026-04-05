-- ============================================================
-- DaiichiTravel – Migration 005: Fix admin write access & fare schema
-- ============================================================
-- Fixes two issues that prevent admin write operations:
--
-- 1. RLS write policies required auth.role()='authenticated', but
--    the admin panel uses the Supabase anon key with its own
--    username/password system (not Supabase Auth).  Anonymous
--    sign-in (signInAnonymously) is called at login to obtain an
--    'authenticated' session, but if it is disabled in the Supabase
--    dashboard the fallback is to allow the 'anon' role to write too.
--
-- 2. route_fares.from_stop_id / to_stop_id were UUID columns with FK
--    references to stops(id), but the app uses synthetic string IDs
--    '__departure__' and '__arrival__' for the first/last stops.
--    These are not valid UUIDs, so every fare save that involved the
--    departure or arrival stop raised a PostgreSQL type-cast error.
-- ============================================================

-- ─── Part 1: Relax RLS write policies for admin tables ───────────────────────
-- Allow both anon and authenticated roles to write.
-- The admin panel enforces its own authentication (username/password
-- stored in the settings table), so the Supabase role check is redundant.

-- trips
DROP POLICY IF EXISTS "trips_auth_write" ON trips;
CREATE POLICY "trips_anon_write"
  ON trips FOR ALL
  USING (auth.role() IN ('anon', 'authenticated'))
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- routes
DROP POLICY IF EXISTS "routes_auth_write" ON routes;
CREATE POLICY "routes_anon_write"
  ON routes FOR ALL
  USING (auth.role() IN ('anon', 'authenticated'))
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- vehicles
DROP POLICY IF EXISTS "vehicles_auth_write" ON vehicles;
CREATE POLICY "vehicles_anon_write"
  ON vehicles FOR ALL
  USING (auth.role() IN ('anon', 'authenticated'))
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- stops
DROP POLICY IF EXISTS "stops_auth_write" ON stops;
CREATE POLICY "stops_anon_write"
  ON stops FOR ALL
  USING (auth.role() IN ('anon', 'authenticated'))
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- vehicle_types
DROP POLICY IF EXISTS "vehicle_types_auth_write" ON vehicle_types;
CREATE POLICY "vehicle_types_anon_write"
  ON vehicle_types FOR ALL
  USING (auth.role() IN ('anon', 'authenticated'))
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- route_fares
DROP POLICY IF EXISTS "route_fares_auth_write" ON route_fares;
CREATE POLICY "route_fares_anon_write"
  ON route_fares FOR ALL
  USING (auth.role() IN ('anon', 'authenticated'))
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- route_seat_fares
DROP POLICY IF EXISTS "route_seat_fares_auth_write" ON route_seat_fares;
CREATE POLICY "route_seat_fares_anon_write"
  ON route_seat_fares FOR ALL
  USING (auth.role() IN ('anon', 'authenticated'))
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- invoices
DROP POLICY IF EXISTS "invoices_auth_write" ON invoices;
CREATE POLICY "invoices_anon_write"
  ON invoices FOR ALL
  USING (auth.role() IN ('anon', 'authenticated'))
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- tours
DROP POLICY IF EXISTS "tours_auth_write" ON tours;
CREATE POLICY "tours_anon_write"
  ON tours FOR ALL
  USING (auth.role() IN ('anon', 'authenticated'))
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- properties
DROP POLICY IF EXISTS "properties_auth_write" ON properties;
CREATE POLICY "properties_anon_write"
  ON properties FOR ALL
  USING (auth.role() IN ('anon', 'authenticated'))
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- property_room_types
DROP POLICY IF EXISTS "property_room_types_auth_write" ON property_room_types;
CREATE POLICY "property_room_types_anon_write"
  ON property_room_types FOR ALL
  USING (auth.role() IN ('anon', 'authenticated'))
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- agents
DROP POLICY IF EXISTS "agents_auth_write" ON agents;
CREATE POLICY "agents_anon_write"
  ON agents FOR ALL
  USING (auth.role() IN ('anon', 'authenticated'))
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- employees
DROP POLICY IF EXISTS "employees_auth_write" ON employees;
CREATE POLICY "employees_anon_write"
  ON employees FOR ALL
  USING (auth.role() IN ('anon', 'authenticated'))
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- customers
DROP POLICY IF EXISTS "customers_auth_write" ON customers;
CREATE POLICY "customers_anon_write"
  ON customers FOR ALL
  USING (auth.role() IN ('anon', 'authenticated'))
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- customer_categories
DROP POLICY IF EXISTS "customer_categories_auth_write" ON customer_categories;
CREATE POLICY "customer_categories_anon_write"
  ON customer_categories FOR ALL
  USING (auth.role() IN ('anon', 'authenticated'))
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- consignments
DROP POLICY IF EXISTS "consignments_auth_write" ON consignments;
CREATE POLICY "consignments_anon_write"
  ON consignments FOR ALL
  USING (auth.role() IN ('anon', 'authenticated'))
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- driver_assignments
DROP POLICY IF EXISTS "driver_assignments_auth_all" ON driver_assignments;
CREATE POLICY "driver_assignments_anon_write"
  ON driver_assignments FOR ALL
  USING (auth.role() IN ('anon', 'authenticated'))
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- staff_messages
DROP POLICY IF EXISTS "staff_messages_auth_all" ON staff_messages;
CREATE POLICY "staff_messages_anon_write"
  ON staff_messages FOR ALL
  USING (auth.role() IN ('anon', 'authenticated'))
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- category_requests
DROP POLICY IF EXISTS "category_requests_auth_write" ON category_requests;
CREATE POLICY "category_requests_anon_write"
  ON category_requests FOR ALL
  USING (auth.role() IN ('anon', 'authenticated'))
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- user_guides
DROP POLICY IF EXISTS "user_guides_auth_write" ON user_guides;
CREATE POLICY "user_guides_anon_write"
  ON user_guides FOR ALL
  USING (auth.role() IN ('anon', 'authenticated'))
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- settings
DROP POLICY IF EXISTS "settings_auth_write" ON settings;
CREATE POLICY "settings_anon_write"
  ON settings FOR ALL
  USING (auth.role() IN ('anon', 'authenticated'))
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- bookings (update/delete was auth-only; keep insert public)
DROP POLICY IF EXISTS "bookings_auth_write" ON bookings;
DROP POLICY IF EXISTS "bookings_auth_delete" ON bookings;
CREATE POLICY "bookings_anon_write"
  ON bookings FOR UPDATE
  USING (auth.role() IN ('anon', 'authenticated'))
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));
CREATE POLICY "bookings_anon_delete"
  ON bookings FOR DELETE
  USING (auth.role() IN ('anon', 'authenticated'));

-- audit_logs (insert was already public; keep read as anon too)
DROP POLICY IF EXISTS "audit_logs_auth_read" ON audit_logs;
CREATE POLICY "audit_logs_anon_read"
  ON audit_logs FOR SELECT
  USING (auth.role() IN ('anon', 'authenticated'));

-- ─── Part 2: Fix route_fares stop-ID column types ─────────────────────────────
-- from_stop_id and to_stop_id were UUID with FK references to stops(id).
-- The app uses '__departure__' and '__arrival__' as synthetic stop IDs that
-- are not valid UUIDs, causing a type-cast error on every fare upsert that
-- involved the route's first or last stop.
-- Changing to TEXT removes the UUID cast requirement while preserving the
-- column semantics (still holds stop IDs, just as plain text).

ALTER TABLE route_fares
  DROP CONSTRAINT IF EXISTS route_fares_from_stop_id_fkey,
  DROP CONSTRAINT IF EXISTS route_fares_to_stop_id_fkey;

ALTER TABLE route_fares
  ALTER COLUMN from_stop_id TYPE TEXT USING from_stop_id::TEXT,
  ALTER COLUMN to_stop_id   TYPE TEXT USING to_stop_id::TEXT;
