/**
 * Supabase Edge Function: verify-recaptcha
 *
 * Replaces the Firebase Cloud Function `verifyRecaptchaAndSendOtp`.
 * Verifies a reCAPTCHA v3 token server-side and returns the score.
 *
 * POST { token: string; action: string }
 * → { success: boolean; score: number; message: string }
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const RECAPTCHA_SECRET = Deno.env.get('RECAPTCHA_SECRET_KEY') ?? '';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' },
    });
  }

  try {
    const { token, action } = await req.json() as { token: string; action: string };

    if (!RECAPTCHA_SECRET) {
      return Response.json({ success: false, score: 0, message: 'reCAPTCHA secret not configured' }, { status: 500 });
    }

    const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA_SECRET}&response=${token}`;
    const verifyRes = await fetch(verifyUrl, { method: 'POST' });
    const verifyData = await verifyRes.json() as { success: boolean; score: number; action: string; 'error-codes'?: string[] };

    if (!verifyData.success) {
      return Response.json({ success: false, score: 0, message: `reCAPTCHA failed: ${(verifyData['error-codes'] ?? []).join(', ')}` });
    }

    if (verifyData.action && action && verifyData.action !== action) {
      return Response.json({ success: false, score: verifyData.score, message: `Action mismatch: expected ${action}, got ${verifyData.action}` });
    }

    const MIN_SCORE = 0.5;
    if (verifyData.score < MIN_SCORE) {
      return Response.json({ success: false, score: verifyData.score, message: `Score too low: ${verifyData.score}` });
    }

    return Response.json({ success: true, score: verifyData.score, message: 'OK' });
  } catch (err) {
    return Response.json({ success: false, score: 0, message: String(err) }, { status: 500 });
  }
});
