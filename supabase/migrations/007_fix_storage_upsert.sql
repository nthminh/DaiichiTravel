-- ============================================================
-- DaiichiTravel – Fix Storage Policies for Upsert Support
-- Migration 007: Add UPDATE and DELETE policies for storage buckets
-- ============================================================
-- The uploadFile() helper was changed to use `upsert: true` so that
-- re-uploads of files at the same path succeed gracefully (e.g. retries).
-- Supabase Storage's upsert path internally uses UPDATE on storage.objects,
-- so we need UPDATE policies in addition to the existing INSERT ones.
-- DELETE policies are added so the app can remove images when users delete
-- tours, properties, routes, etc.
-- ============================================================

-- ─── tours ───────────────────────────────────────────────────────────────────

CREATE POLICY "tours_auth_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'tours')
  WITH CHECK (bucket_id = 'tours');

CREATE POLICY "tours_auth_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'tours');

-- ─── routes ──────────────────────────────────────────────────────────────────

CREATE POLICY "routes_auth_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'routes')
  WITH CHECK (bucket_id = 'routes');

CREATE POLICY "routes_auth_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'routes');

-- ─── addon-images ─────────────────────────────────────────────────────────────

CREATE POLICY "addon_images_auth_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'addon-images')
  WITH CHECK (bucket_id = 'addon-images');

CREATE POLICY "addon_images_auth_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'addon-images');

-- ─── properties ───────────────────────────────────────────────────────────────

CREATE POLICY "properties_auth_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'properties')
  WITH CHECK (bucket_id = 'properties');

CREATE POLICY "properties_auth_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'properties');

-- ─── room-types ───────────────────────────────────────────────────────────────

CREATE POLICY "room_types_auth_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'room-types')
  WITH CHECK (bucket_id = 'room-types');

CREATE POLICY "room_types_auth_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'room-types');

-- ─── user-guides ──────────────────────────────────────────────────────────────

CREATE POLICY "user_guides_auth_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'user-guides')
  WITH CHECK (bucket_id = 'user-guides');

CREATE POLICY "user_guides_auth_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'user-guides');

-- ─── category-proofs (authenticated only) ────────────────────────────────────

CREATE POLICY "category_proofs_auth_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'category-proofs' AND auth.role() = 'authenticated')
  WITH CHECK (bucket_id = 'category-proofs' AND auth.role() = 'authenticated');

CREATE POLICY "category_proofs_auth_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'category-proofs' AND auth.role() = 'authenticated');

-- ─── chat-audio (authenticated only) ─────────────────────────────────────────

CREATE POLICY "chat_audio_auth_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'chat-audio' AND auth.role() = 'authenticated')
  WITH CHECK (bucket_id = 'chat-audio' AND auth.role() = 'authenticated');

CREATE POLICY "chat_audio_auth_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'chat-audio' AND auth.role() = 'authenticated');
