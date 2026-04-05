import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

const isConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (null as unknown as ReturnType<typeof createClient>);

export { isConfigured as isSupabaseConfigured };

// ─── Storage helpers ──────────────────────────────────────────────────────────

/**
 * Upload a file to a Supabase Storage bucket and return its public URL.
 * @param bucket  Bucket name (e.g. 'tours', 'routes')
 * @param path    Path inside the bucket (e.g. 'tours/1234_img.webp')
 * @param file    The File/Blob to upload
 * @param onProgress  Optional progress callback (0–100)
 */
export async function uploadFile(
  bucket: string,
  path: string,
  file: File | Blob,
  onProgress?: (pct: number) => void,
): Promise<string> {
  if (!supabase) throw new Error('Supabase not configured');

  // Supabase storage v2 doesn't have built-in progress – simulate 50% then 100%.
  onProgress?.(50);

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType: (file as File).type || 'application/octet-stream', upsert: true });

  if (error) throw error;

  onProgress?.(100);

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

// ─── camelCase ↔ snake_case helpers ──────────────────────────────────────────

/** Convert a camelCase key to snake_case (one level only). */
function toSnake(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/** Convert a snake_case key to camelCase (one level only). */
function toCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Convert top-level object keys from camelCase to snake_case.
 * Nested objects / arrays are left untouched (so JSONB columns keep camelCase
 * for the data they store, matching what the TypeScript types expect).
 */
export function toSnakeCaseObj(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [toSnake(k), v]),
  );
}

/**
 * Convert top-level object keys from snake_case to camelCase.
 * Nested objects / arrays (e.g. stored JSONB) are left untouched.
 */
export function toCamelCaseObj<T = Record<string, unknown>>(
  obj: Record<string, unknown>,
): T {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [toCamel(k), v]),
  ) as T;
}
