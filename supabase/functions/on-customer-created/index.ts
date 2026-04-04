/**
 * Supabase Edge Function: on-customer-created
 *
 * Replaces the Firebase Cloud Function `onCustomerCreated`.
 * Triggered via a Supabase Database Webhook on INSERT to the `customers` table.
 * Sends a welcome email to the new customer.
 *
 * Webhook payload: { type: 'INSERT', record: CustomerRow }
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'noreply@daiichitravel.vn';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' },
    });
  }

  try {
    const payload = await req.json() as {
      type: string;
      record: { id: string; name?: string; email?: string; phone?: string };
    };

    if (payload.type !== 'INSERT') {
      return Response.json({ skipped: true });
    }

    const customer = payload.record;

    if (!customer.email || !RESEND_API_KEY) {
      return Response.json({ success: true, emailSent: false });
    }

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [customer.email],
        subject: 'Chào mừng đến với Daiichi Travel!',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
            <h2 style="color:#E31B23">Chào mừng, ${customer.name || 'Bạn'}!</h2>
            <p>Tài khoản của bạn đã được tạo thành công trên <strong>Daiichi Travel</strong>.</p>
            <p>Bạn có thể đặt vé, theo dõi hành trình và nhận nhiều ưu đãi độc quyền dành cho thành viên.</p>
            <p style="color:#888;font-size:12px">Nếu bạn không đăng ký tài khoản này, vui lòng liên hệ với chúng tôi.</p>
          </div>
        `,
      }),
    });

    return Response.json({ success: true, emailSent: emailRes.ok });
  } catch (err) {
    return Response.json({ success: false, message: String(err) }, { status: 500 });
  }
});
