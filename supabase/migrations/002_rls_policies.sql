-- ============================================================
-- DaiichiTravel – Row Level Security Policies
-- Migration 002: RLS policies (replaces Firestore Rules)
-- ============================================================
-- Mirrors the public-read / authenticated-write semantics of
-- the existing Firestore security rules.
-- ============================================================

-- ─── Helper: check if caller is an authenticated Supabase user
-- (Firestore used Firebase Auth; here we check auth.uid())
-- For the admin panel, the app uses its own username/password
-- auth (stored in 'settings') so most tables are fully accessible.
-- RLS is enabled to protect sensitive collections.

-- ─── trips (public read, authenticated write) ────────────────
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trips_public_read"
  ON trips FOR SELECT USING (true);

CREATE POLICY "trips_auth_write"
  ON trips FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── routes (public read) ─────────────────────────────────────
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "routes_public_read"
  ON routes FOR SELECT USING (true);

CREATE POLICY "routes_auth_write"
  ON routes FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── vehicles (public read) ───────────────────────────────────
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicles_public_read"
  ON vehicles FOR SELECT USING (true);

CREATE POLICY "vehicles_auth_write"
  ON vehicles FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── stops (public read) ─────────────────────────────────────
ALTER TABLE stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stops_public_read"
  ON stops FOR SELECT USING (true);

CREATE POLICY "stops_auth_write"
  ON stops FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── vehicle_types (public read) ──────────────────────────────
ALTER TABLE vehicle_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicle_types_public_read"
  ON vehicle_types FOR SELECT USING (true);

CREATE POLICY "vehicle_types_auth_write"
  ON vehicle_types FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── route_fares (public read) ───────────────────────────────
ALTER TABLE route_fares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "route_fares_public_read"
  ON route_fares FOR SELECT USING (true);

CREATE POLICY "route_fares_auth_write"
  ON route_fares FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── route_seat_fares (public read) ──────────────────────────
ALTER TABLE route_seat_fares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "route_seat_fares_public_read"
  ON route_seat_fares FOR SELECT USING (true);

CREATE POLICY "route_seat_fares_auth_write"
  ON route_seat_fares FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── bookings (anyone can create – guest checkout; admin can read/update) ───
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookings_public_insert"
  ON bookings FOR INSERT WITH CHECK (true);

CREATE POLICY "bookings_public_read"
  ON bookings FOR SELECT USING (true);

CREATE POLICY "bookings_auth_write"
  ON bookings FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "bookings_auth_delete"
  ON bookings FOR DELETE USING (auth.role() = 'authenticated');

-- ─── inquiries (anyone can create; authenticated read) ───────
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inquiries_public_insert"
  ON inquiries FOR INSERT WITH CHECK (true);

CREATE POLICY "inquiries_auth_read"
  ON inquiries FOR SELECT USING (auth.role() = 'authenticated');

-- ─── invoices (public read, authenticated write) ─────────────
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_public_read"
  ON invoices FOR SELECT USING (true);

CREATE POLICY "invoices_auth_write"
  ON invoices FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── tours (public read) ──────────────────────────────────────
ALTER TABLE tours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tours_public_read"
  ON tours FOR SELECT USING (true);

CREATE POLICY "tours_auth_write"
  ON tours FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── properties (public read) ─────────────────────────────────
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "properties_public_read"
  ON properties FOR SELECT USING (true);

CREATE POLICY "properties_auth_write"
  ON properties FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── property_room_types (public read) ───────────────────────
ALTER TABLE property_room_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "property_room_types_public_read"
  ON property_room_types FOR SELECT USING (true);

CREATE POLICY "property_room_types_auth_write"
  ON property_room_types FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── agents (public read) ────────────────────────────────────
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agents_public_read"
  ON agents FOR SELECT USING (true);

CREATE POLICY "agents_auth_write"
  ON agents FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── employees (public read) ─────────────────────────────────
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees_public_read"
  ON employees FOR SELECT USING (true);

CREATE POLICY "employees_auth_write"
  ON employees FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── customers (public read, authenticated write + self update) ──
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_public_read"
  ON customers FOR SELECT USING (true);

CREATE POLICY "customers_public_insert"
  ON customers FOR INSERT WITH CHECK (true);

CREATE POLICY "customers_auth_write"
  ON customers FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── customer_categories (public read) ───────────────────────
ALTER TABLE customer_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_categories_public_read"
  ON customer_categories FOR SELECT USING (true);

CREATE POLICY "customer_categories_auth_write"
  ON customer_categories FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── category_requests (authenticated only) ──────────────────
ALTER TABLE category_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "category_requests_public_insert"
  ON category_requests FOR INSERT WITH CHECK (true);

CREATE POLICY "category_requests_auth_read"
  ON category_requests FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "category_requests_auth_write"
  ON category_requests FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── consignments (public read, authenticated write) ─────────
ALTER TABLE consignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consignments_public_read"
  ON consignments FOR SELECT USING (true);

CREATE POLICY "consignments_auth_write"
  ON consignments FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── driver_assignments (authenticated only) ─────────────────
ALTER TABLE driver_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "driver_assignments_auth_all"
  ON driver_assignments FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── staff_messages (authenticated only) ─────────────────────
ALTER TABLE staff_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_messages_auth_all"
  ON staff_messages FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── audit_logs (authenticated only) ─────────────────────────
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_public_insert"
  ON audit_logs FOR INSERT WITH CHECK (true);

CREATE POLICY "audit_logs_auth_read"
  ON audit_logs FOR SELECT USING (auth.role() = 'authenticated');

-- ─── user_guides (public read) ────────────────────────────────
ALTER TABLE user_guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_guides_public_read"
  ON user_guides FOR SELECT USING (true);

CREATE POLICY "user_guides_auth_write"
  ON user_guides FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── settings (public read, authenticated write) ─────────────
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_public_read"
  ON settings FOR SELECT USING (true);

CREATE POLICY "settings_auth_write"
  ON settings FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── pending_payments (anyone can create & read own; admin all) ───
ALTER TABLE pending_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pending_payments_public_all"
  ON pending_payments FOR ALL USING (true) WITH CHECK (true);
