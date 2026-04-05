/**
 * Supabase Edge Function: onepay-ipn
 *
 * Replaces the Firebase Cloud Function `onepayIpn`.
 * Handles OnePay IPN (Instant Payment Notification) callbacks.
 *
 * Accepts GET or POST with OnePay IPN parameters, verifies the HMAC-SHA256
 * signature, then updates the pending_payments row to PAID or CANCELLED.
 *
 * When a payment is confirmed (PAID), this function also creates the booking
 * record(s) in the bookings table server-side using the booking_data stored
 * in pending_payments. This ensures bookings are never lost even when the
 * customer's browser tab is closed before the client-side listener fires.
 *
 * Response format required by OnePay:
 *   responsecode=1&desc=confirm-success   (success, HTTP 200)
 *   responsecode=0&desc=confirm-fail      (failure, non-200 or 200 with code 0)
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ONEPAY_HASH_KEY = Deno.env.get('ONEPAY_HASH_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

/** Convert a hex string to a Uint8Array. Throws if the input is not valid hex. */
function hexToBytes(hex: string): Uint8Array {
  if (!hex || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error(`Invalid hex string: "${hex}"`);
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Verify OnePay HMAC-SHA256 signature using the native Web Crypto API */
async function verifyHmac(params: URLSearchParams, hashKey: string): Promise<boolean> {
  const vpc_SecureHash = params.get('vpc_SecureHash') ?? '';
  // Build the sorted query string without vpc_SecureHash
  const sortedKeys = Array.from(params.keys())
    .filter((k) => k !== 'vpc_SecureHash' && k.startsWith('vpc_'))
    .sort();
  const rawData = sortedKeys.map((k) => `${k}=${params.get(k)}`).join('&');

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    hexToBytes(hashKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(rawData));
  const hmac = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return hmac === vpc_SecureHash.toUpperCase();
}

/** Convert a camelCase key to snake_case (top-level only, matches frontend toSnakeCaseObj) */
function toSnake(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/** Convert top-level object keys from camelCase to snake_case */
function toSnakeCaseObj(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [toSnake(k), v]),
  );
}

/** Generate a ticket code in the same format as the frontend (DT-XXXXXXXX) */
function generateTicketCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const timePart = Date.now().toString(36).toUpperCase().slice(-2);
  let randomPart = '';
  for (let i = 0; i < 6; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `DT-${randomPart}${timePart}`;
}

/**
 * Update seat statuses on a trip from BOOKED to PAID for the given seat IDs.
 * Mirrors the client-side transportService.bookSeats({ status: 'PAID' }) call.
 */
async function updateSeatsToPaid(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  tripId: string,
  seatIds: string[],
): Promise<void> {
  if (!tripId || !seatIds?.length) return;
  const { data: row } = await supabase.from('trips').select('seats').eq('id', tripId).single();
  if (!row?.seats) return;
  const seats = row.seats as Array<Record<string, unknown>>;
  const updatedSeats = seats.map((seat) => {
    if (!seatIds.includes(seat.id as string)) return seat;
    return { ...seat, status: 'PAID' };
  });
  await supabase
    .from('trips')
    .update({ seats: updatedSeats, updated_at: new Date().toISOString() })
    .eq('id', tripId);
}

/**
 * Insert a single booking row derived from the camelCase bookingData stored in
 * pending_payments.booking_data.  Returns the created booking id and ticketCode.
 */
async function createBookingFromData(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  bookingData: Record<string, unknown>,
): Promise<{ id: string; ticketCode: string } | null> {
  const ticketCode = generateTicketCode();
  const row = toSnakeCaseObj({
    ...bookingData,
    ticketCode,
    createdAt: new Date().toISOString(),
  });
  const { data, error } = await supabase.from('bookings').insert(row).select('id').single();
  if (error) {
    console.error('[onepay-ipn] createBooking error:', error);
    return null;
  }
  return { id: data.id, ticketCode };
}

Deno.serve(async (req) => {
  try {
    let params: URLSearchParams;
    if (req.method === 'POST') {
      const body = await req.text();
      params = new URLSearchParams(body);
    } else {
      params = new URL(req.url).searchParams;
    }

    const vpc_TxnResponseCode = params.get('vpc_TxnResponseCode') ?? '';
    const vpc_MerchTxnRef = params.get('vpc_MerchTxnRef') ?? '';
    const vpc_Amount = params.get('vpc_Amount') ?? '0';

    // Verify HMAC
    if (ONEPAY_HASH_KEY && !(await verifyHmac(params, ONEPAY_HASH_KEY))) {
      console.error('[onepay-ipn] HMAC verification failed');
      return new Response('responsecode=0&desc=confirm-fail', {
        status: 400,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const isPaid = vpc_TxnResponseCode === '0';
    const amountVND = Math.round(parseInt(vpc_Amount, 10) / 100);

    const update: Record<string, unknown> = {
      status: isPaid ? 'PAID' : 'CANCELLED',
      paid_amount: isPaid ? amountVND : null,
      paid_content: isPaid ? `OnePay TxnRef: ${vpc_MerchTxnRef}` : null,
      confirmed_at: isPaid ? new Date().toISOString() : null,
    };

    // Atomically transition from PENDING to final state.
    // Filtering by status=PENDING ensures that duplicate IPN callbacks for the
    // same transaction reference do NOT trigger a second balance credit.
    const { data: updatedRows, error } = await supabase
      .from('pending_payments')
      .update(update)
      .eq('payment_ref', vpc_MerchTxnRef)
      .eq('status', 'PENDING')
      .select('id, booking_data, trip_id');

    if (error) {
      console.error('[onepay-ipn] DB update error:', error);
      return new Response('responsecode=0&desc=confirm-fail', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // If 0 rows were updated the payment was already processed – acknowledge
    // success so OnePay stops retrying, but skip the balance credit.
    if (!updatedRows || updatedRows.length === 0) {
      console.log('[onepay-ipn] Payment already processed, skipping balance credit:', vpc_MerchTxnRef);
      return new Response('responsecode=1&desc=confirm-success', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // If this is an agent top-up payment, credit the agent's balance atomically.
    // Agent code is encoded in the payment reference as "TOPUP{code}".
    // credit_agent_from_topup() is idempotent – safe to call from both the IPN
    // and the client-side fallback without risk of double-crediting.
    if (isPaid && /^TOPUP[A-Za-z0-9]+/.test(vpc_MerchTxnRef)) {
      const { data: credited, error: creditErr } = await supabase.rpc('credit_agent_from_topup', {
        p_payment_ref: vpc_MerchTxnRef,
      });
      if (creditErr) {
        console.error('[onepay-ipn] credit_agent_from_topup error:', creditErr);
      } else {
        console.log(`[onepay-ipn] credit_agent_from_topup(${vpc_MerchTxnRef}) => ${credited}`);
      }
    }

    // ── Server-side booking creation ────────────────────────────────────────
    // Create the booking record(s) here so they are never lost if the customer
    // closes their browser tab before the client-side real-time listener fires.
    if (isPaid) {
      const pendingRow = updatedRows[0] as Record<string, unknown>;
      const storedPayload = pendingRow.booking_data as Record<string, unknown> | null;

      if (storedPayload) {
        // Idempotency: skip if the client-side listener already created the booking.
        const { data: existing } = await supabase
          .from('bookings')
          .select('id')
          .eq('payment_ref', vpc_MerchTxnRef)
          .limit(1);

        const bookingExists = existing && existing.length > 0;

        if (!bookingExists) {
          if (storedPayload.type === 'roundtrip') {
            // Round-trip: create outbound and return bookings separately
            const outboundData = storedPayload.outboundBookingData as Record<string, unknown>;
            const outboundTripId = storedPayload.outboundTripId as string;
            const outboundSeatIds = storedPayload.outboundSeatIds as string[];
            const returnData = storedPayload.returnBookingData as Record<string, unknown>;
            const returnTripId = storedPayload.returnTripId as string;
            const returnSeatIds = storedPayload.returnSeatIds as string[];

            const outboundResult = await createBookingFromData(supabase, outboundData);
            const returnResult = await createBookingFromData(supabase, returnData);

            if (outboundResult && returnResult) {
              console.log(`[onepay-ipn] Created round-trip bookings: ${outboundResult.ticketCode}, ${returnResult.ticketCode}`);
              await Promise.all([
                updateSeatsToPaid(supabase, outboundTripId, outboundSeatIds),
                updateSeatsToPaid(supabase, returnTripId, returnSeatIds),
              ]);
            }
          } else {
            // Single-leg booking
            const bookingData = storedPayload.bookingData as Record<string, unknown>;
            const tripId = storedPayload.tripId as string;
            const seatIds = storedPayload.seatIds as string[];

            const result = await createBookingFromData(supabase, bookingData);
            if (result) {
              console.log(`[onepay-ipn] Created booking: ${result.ticketCode}`);
              await updateSeatsToPaid(supabase, tripId, seatIds);
            }
          }
        } else {
          console.log(`[onepay-ipn] Booking already exists for ${vpc_MerchTxnRef}, skipping server-side creation`);
        }
      }
    }

    return new Response('responsecode=1&desc=confirm-success', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (err) {
    console.error('[onepay-ipn] unhandled error:', err);
    return new Response('responsecode=0&desc=confirm-fail', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
});

