/**
 * Supabase Edge Function: export-generic-excel
 *
 * Replaces the Firebase Cloud Function `exportGenericExcel`.
 * Accepts a table name and optional filters, returns data for client-side Excel export.
 *
 * POST { table: string; filters?: Record<string, string>; columns?: string[] }
 * → { rows: Record<string, unknown>[] }
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Tables that are allowed to be exported (allowlist for security)
const ALLOWED_TABLES = [
  'trips', 'bookings', 'invoices', 'customers', 'agents',
  'routes', 'stops', 'vehicles', 'consignments', 'inquiries',
  'driver_assignments', 'audit_logs',
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' },
    });
  }

  try {
    const {
      table,
      filters = {},
      columns = '*',
      limit = 5000,
    } = await req.json() as {
      table: string;
      filters?: Record<string, string>;
      columns?: string | string[];
      limit?: number;
    };

    if (!ALLOWED_TABLES.includes(table)) {
      return Response.json({ error: `Table '${table}' is not allowed for export` }, { status: 403 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const selectColumns = Array.isArray(columns) ? columns.join(', ') : columns;
    let query = supabase.from(table).select(selectColumns).limit(limit);

    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value);
    }

    const { data, error } = await query;
    if (error) throw error;

    return Response.json({ rows: data || [] });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
});
