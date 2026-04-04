/**
 * Supabase Edge Function: onepay-ipn
 *
 * Replaces the Firebase Cloud Function `onepayIpn`.
 * Handles OnePay IPN (Instant Payment Notification) callbacks.
 *
 * Accepts GET or POST with OnePay IPN parameters, verifies the HMAC-SHA256
 * signature, then updates the pending_payments row to PAID or CANCELLED.
 *
 * Response format required by OnePay:
 *   responsecode=1&desc=confirm-success   (success, HTTP 200)
 *   responsecode=0&desc=confirm-fail      (failure, non-200 or 200 with code 0)
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.177.0/node/crypto.ts';

const ONEPAY_HASH_KEY = Deno.env.get('ONEPAY_HASH_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

/** Verify OnePay HMAC-SHA256 signature */
function verifyHmac(params: URLSearchParams, hashKey: string): boolean {
  const vpc_SecureHash = params.get('vpc_SecureHash') ?? '';
  // Build the sorted query string without vpc_SecureHash
  const sortedKeys = Array.from(params.keys())
    .filter((k) => k !== 'vpc_SecureHash' && k.startsWith('vpc_'))
    .sort();
  const rawData = sortedKeys.map((k) => `${k}=${params.get(k)}`).join('&');
  const hmac = createHmac('sha256', Buffer.from(hashKey, 'hex'))
    .update(rawData)
    .digest('hex')
    .toUpperCase();
  return hmac === vpc_SecureHash.toUpperCase();
}

serve(async (req) => {
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
    if (ONEPAY_HASH_KEY && !verifyHmac(params, ONEPAY_HASH_KEY)) {
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

    const { error } = await supabase
      .from('pending_payments')
      .update(update)
      .eq('payment_ref', vpc_MerchTxnRef);

    if (error) {
      console.error('[onepay-ipn] DB update error:', error);
      return new Response('responsecode=0&desc=confirm-fail', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      });
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
