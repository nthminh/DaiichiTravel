/**
 * Supabase Edge Function: send-email-login-link
 *
 * Replaces the Firebase Cloud Function `sendEmailLoginLink`.
 * Sends a branded magic-link email via Resend (or falls back to Supabase Auth OTP).
 *
 * POST { email: string; redirectUrl: string }
 * → { success: boolean }
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'noreply@daiichitravel.vn';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' },
    });
  }

  try {
    const { email, redirectUrl } = await req.json() as { email: string; redirectUrl: string };

    if (RESEND_API_KEY) {
      // Generate magic link via Supabase Admin API
      const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo: redirectUrl },
      });
      if (linkError) throw linkError;

      const magicLink = linkData.properties?.action_link;

      // Send via Resend
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [email],
          subject: 'Đăng nhập Daiichi Travel',
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
              <h2 style="color:#E31B23">Daiichi Travel</h2>
              <p>Bạn đã yêu cầu đăng nhập. Nhấn nút bên dưới để tiếp tục:</p>
              <a href="${magicLink}"
                 style="display:inline-block;background:#E31B23;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">
                Đăng nhập ngay
              </a>
              <p style="color:#888;font-size:12px">Link có hiệu lực trong 60 phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
            </div>
          `,
        }),
      });
      if (!emailRes.ok) {
        const errBody = await emailRes.text();
        throw new Error(`Resend API error: ${errBody}`);
      }
      return Response.json({ success: true });
    }

    // Fallback: use Supabase Auth built-in OTP email
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { error } = await adminClient.auth.admin.inviteUserByEmail(email, { redirectTo: redirectUrl });
    if (error) throw error;

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ success: false, message: String(err) }, { status: 500 });
  }
});
