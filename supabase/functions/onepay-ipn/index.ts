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

    // If this is an agent top-up payment, credit the agent's balance
    if (isPaid && /^TOPUP/i.test(vpc_MerchTxnRef)) {
      const agentCode = vpc_MerchTxnRef.replace(/^TOPUP/i, '');
      const { data: agentRow, error: agentFetchErr } = await supabase
        .from('agents')
        .select('id, balance')
        .eq('code', agentCode)
        .single();

      if (agentFetchErr || !agentRow) {
        console.error('[onepay-ipn] Agent not found for code:', agentCode, agentFetchErr);
      } else {
        const newBalance = (Number(agentRow.balance) || 0) + amountVND;
        const { error: balanceErr } = await supabase
          .from('agents')
          .update({ balance: newBalance })
          .eq('id', agentRow.id);
        if (balanceErr) {
          console.error('[onepay-ipn] Failed to update agent balance:', balanceErr);
        } else {
          console.log(`[onepay-ipn] Credited ${amountVND} to agent ${agentCode}, new balance: ${newBalance}`);
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
