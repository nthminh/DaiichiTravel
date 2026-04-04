/**
 * Supabase Edge Function: notify-inquiry
 *
 * Replaces the Firebase Cloud Function `notifyInquiry`.
 * Triggered via a Supabase Database Webhook on INSERT to the `inquiries` table.
 * Sends an email notification to the admin when a new inquiry is submitted.
 *
 * Webhook payload: { type: 'INSERT', record: InquiryRow }
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'noreply@daiichitravel.vn';
const ADMIN_EMAIL = Deno.env.get('ADMIN_NOTIFY_EMAIL') ?? '';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' },
    });
  }

  try {
    const payload = await req.json() as {
      type: string;
      record: {
        id: string;
        name?: string;
        phone?: string;
        email?: string;
        from?: string;
        to?: string;
        date?: string;
        adults?: number;
        children?: number;
        notes?: string;
        created_at?: string;
      };
    };

    if (payload.type !== 'INSERT') {
      return Response.json({ skipped: true });
    }

    const inquiry = payload.record;

    if (!ADMIN_EMAIL || !RESEND_API_KEY) {
      console.log('[notify-inquiry] RESEND_API_KEY or ADMIN_EMAIL not set, skipping email');
      return Response.json({ success: true, emailSent: false });
    }

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [ADMIN_EMAIL],
        subject: `[Daiichi Travel] Yêu cầu mới từ ${inquiry.name || 'Khách hàng'}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px">
            <h2 style="color:#E31B23">Yêu cầu mới – Daiichi Travel</h2>
            <table style="border-collapse:collapse;width:100%">
              <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Họ tên</td><td style="padding:8px;border:1px solid #eee">${inquiry.name || '-'}</td></tr>
              <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Điện thoại</td><td style="padding:8px;border:1px solid #eee">${inquiry.phone || '-'}</td></tr>
              <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Email</td><td style="padding:8px;border:1px solid #eee">${inquiry.email || '-'}</td></tr>
              <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Từ</td><td style="padding:8px;border:1px solid #eee">${inquiry.from || '-'}</td></tr>
              <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Đến</td><td style="padding:8px;border:1px solid #eee">${inquiry.to || '-'}</td></tr>
              <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Ngày đi</td><td style="padding:8px;border:1px solid #eee">${inquiry.date || '-'}</td></tr>
              <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Người lớn / Trẻ em</td><td style="padding:8px;border:1px solid #eee">${inquiry.adults ?? '-'} / ${inquiry.children ?? '-'}</td></tr>
              <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Ghi chú</td><td style="padding:8px;border:1px solid #eee">${inquiry.notes || '-'}</td></tr>
              <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Thời gian</td><td style="padding:8px;border:1px solid #eee">${inquiry.created_at || '-'}</td></tr>
            </table>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      const errBody = await emailRes.text();
      console.error('[notify-inquiry] Resend error:', errBody);
    }

    return Response.json({ success: true, emailSent: emailRes.ok });
  } catch (err) {
    console.error('[notify-inquiry] error:', err);
    return Response.json({ success: false, message: String(err) }, { status: 500 });
  }
});
