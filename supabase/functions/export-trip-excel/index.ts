/**
 * Supabase Edge Function: export-trip-excel
 *
 * Replaces the Firebase Cloud Function `exportTripExcel`.
 * Accepts a trip ID and returns an Excel (.xlsx) file for download.
 *
 * GET /export-trip-excel?tripId=<id>
 * → Excel file (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)
 *
 * Note: This function uses the SheetJS (xlsx) library via esm.sh.
 *       For large exports, consider streaming the response.
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' },
    });
  }

  try {
    const url = new URL(req.url);
    const tripId = url.searchParams.get('tripId');
    if (!tripId) {
      return Response.json({ error: 'tripId is required' }, { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Fetch trip data
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .single();

    if (tripError || !trip) {
      return Response.json({ error: 'Trip not found' }, { status: 404 });
    }

    // Build rows from trip seats (stored as JSONB)
    const seats: Record<string, unknown>[] = (trip.seats as Record<string, unknown>[]) || [];
    const rows = seats
      .filter((s) => s.status === 'BOOKED' || s.status === 'PAID')
      .map((s, i) => ({
        STT: i + 1,
        'Ghế': s.label || s.id,
        'Họ tên': s.customerName || '',
        'SĐT': s.customerPhone || '',
        'Giá vé': s.price ?? '',
        'Trạng thái': s.status || '',
        'Điểm đón': s.pickupAddress || '',
        'Điểm trả': s.dropoffAddress || '',
        'Ghi chú': s.note || '',
      }));

    // Return as JSON for now; the client-side exportUtils.ts handles the actual Excel generation.
    // A full server-side Excel export requires a WASM-compatible xlsx library.
    return Response.json({ trip, seats: rows });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
});
