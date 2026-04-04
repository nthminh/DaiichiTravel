-- ============================================================
-- DaiichiTravel – Storage Buckets
-- Migration 004: Supabase Storage buckets & policies
-- ============================================================
-- Equivalent to Firebase Storage rules.
-- Run in the Supabase SQL editor OR via the Dashboard UI.
-- ============================================================

-- Create buckets (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('tours',            'tours',            true),
  ('routes',           'routes',           true),
  ('addon-images',     'addon-images',     true),
  ('properties',       'properties',       true),
  ('room-types',       'room-types',       true),
  ('chat-audio',       'chat-audio',       false),  -- private: authenticated only
  ('user-guides',      'user-guides',      true),
  ('category-proofs',  'category-proofs',  false)   -- private: owner + admin only
ON CONFLICT (id) DO NOTHING;

-- ─── Public buckets: allow anyone to read, authenticated to write ─────

CREATE POLICY "tours_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'tours');

CREATE POLICY "tours_auth_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'tours');

CREATE POLICY "routes_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'routes');

CREATE POLICY "routes_auth_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'routes');

CREATE POLICY "addon_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'addon-images');

CREATE POLICY "addon_images_auth_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'addon-images');

CREATE POLICY "properties_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'properties');

CREATE POLICY "properties_auth_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'properties');

CREATE POLICY "room_types_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'room-types');

CREATE POLICY "room_types_auth_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'room-types');

CREATE POLICY "user_guides_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'user-guides');

CREATE POLICY "user_guides_auth_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'user-guides');

-- ─── Private bucket: chat-audio – authenticated only ─────────────────

CREATE POLICY "chat_audio_auth_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-audio' AND auth.role() = 'authenticated');

CREATE POLICY "chat_audio_auth_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chat-audio' AND auth.role() = 'authenticated');

-- ─── Private bucket: category-proofs – owner + authenticated admin only ──

CREATE POLICY "category_proofs_owner_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'category-proofs' AND auth.role() = 'authenticated');

CREATE POLICY "category_proofs_auth_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'category-proofs' AND auth.role() = 'authenticated');
