-- ============================================================
-- DaiichiTravel – Enable Supabase Realtime
-- Migration 003: Add tables to the realtime publication
-- ============================================================
-- All tables that use onSnapshot() in the Firestore version need
-- to be added to the supabase_realtime publication so the JS
-- client can subscribe to changes.
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE trips;
ALTER PUBLICATION supabase_realtime ADD TABLE routes;
ALTER PUBLICATION supabase_realtime ADD TABLE vehicles;
ALTER PUBLICATION supabase_realtime ADD TABLE vehicle_types;
ALTER PUBLICATION supabase_realtime ADD TABLE stops;
ALTER PUBLICATION supabase_realtime ADD TABLE bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE agents;
ALTER PUBLICATION supabase_realtime ADD TABLE employees;
ALTER PUBLICATION supabase_realtime ADD TABLE customers;
ALTER PUBLICATION supabase_realtime ADD TABLE invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE tours;
ALTER PUBLICATION supabase_realtime ADD TABLE properties;
ALTER PUBLICATION supabase_realtime ADD TABLE property_room_types;
ALTER PUBLICATION supabase_realtime ADD TABLE consignments;
ALTER PUBLICATION supabase_realtime ADD TABLE driver_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE staff_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE customer_categories;
ALTER PUBLICATION supabase_realtime ADD TABLE category_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE audit_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE user_guides;
ALTER PUBLICATION supabase_realtime ADD TABLE settings;
ALTER PUBLICATION supabase_realtime ADD TABLE pending_payments;
ALTER PUBLICATION supabase_realtime ADD TABLE route_fares;
ALTER PUBLICATION supabase_realtime ADD TABLE route_seat_fares;
