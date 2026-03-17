import * as admin from 'firebase-admin';
import * as https from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import * as nodemailer from 'nodemailer';
import { sanitize } from 'isomorphic-dompurify';

/**
 * Sanitize a user-supplied value for safe inclusion in HTML content or plain-text
 * email headers. All HTML tags are stripped (ALLOWED_TAGS: []) and newline
 * characters are removed to prevent both XSS in the email body and SMTP
 * header-injection in the subject line.
 */
function clean(value: unknown): string {
  if (value == null) return '';
  return sanitize(String(value), {
    ALLOWED_TAGS: [],
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
  }).replace(/[\r\n]+/g, ' ');
}

admin.initializeApp();

/**
 * Minimum reCAPTCHA v3 score to treat a request as human.
 * Scores range from 0.0 (bot) to 1.0 (human). 0.5 is Google's recommended threshold.
 */
const HUMAN_SCORE_THRESHOLD = 0.5;

/** Standard reCAPTCHA v3 siteverify endpoint. */
const RECAPTCHA_SITEVERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

interface VerifyRecaptchaRequest {
  /** reCAPTCHA v3 token obtained via grecaptcha.execute() on the client */
  token: string;
  /** The action name used when the token was generated, e.g. "LOGIN" */
  action?: string;
}

interface VerifyRecaptchaResponse {
  success: boolean;
  score: number;
  message: string;
}

/**
 * HTTPS callable Cloud Function: verifyRecaptchaAndSendOtp
 *
 * Verifies a reCAPTCHA v3 token server-side using the Google reCAPTCHA
 * siteverify API. If the score indicates a human user (>= 0.5), it returns
 * a success signal so the client can proceed to send the Firebase SMS OTP
 * to the whitelisted phone number.
 *
 * The reCAPTCHA secret key is read from the RECAPTCHA_SECRET_KEY Firebase
 * secret, injected into the function as process.env.RECAPTCHA_SECRET_KEY.
 *
 * Usage from the client (firebase/functions):
 *   const verifyRecaptcha = httpsCallable(functions, 'verifyRecaptchaAndSendOtp');
 *   const result = await verifyRecaptcha({ token, action: 'LOGIN' });
 */
export const verifyRecaptchaAndSendOtp = https.onCall(
  { region: 'asia-southeast1', cors: true, secrets: ['RECAPTCHA_SECRET_KEY'] },
  async (request): Promise<VerifyRecaptchaResponse> => {
    const data = request.data as VerifyRecaptchaRequest;

    if (!data || typeof data.token !== 'string' || !data.token.trim()) {
      throw new https.HttpsError('invalid-argument', 'A non-empty reCAPTCHA token is required.');
    }

    const token = data.token.trim();
    const action = typeof data.action === 'string' ? data.action : 'LOGIN';

    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    if (!secretKey) {
      logger.error('RECAPTCHA_SECRET_KEY is not set');
      throw new https.HttpsError('internal', 'Server configuration error: missing reCAPTCHA secret key.');
    }

    // Call the standard reCAPTCHA v3 siteverify API.
    const body = new URLSearchParams({ secret: secretKey, response: token }).toString();

    let response: Response;
    try {
      response = await fetch(RECAPTCHA_SITEVERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[verifyRecaptchaAndSendOtp] fetch error:', msg);
      throw new https.HttpsError('internal', `Failed to reach reCAPTCHA siteverify API: ${msg}`);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      logger.error('[verifyRecaptchaAndSendOtp] API error', response.status, text);
      throw new https.HttpsError(
        'internal',
        `reCAPTCHA siteverify API returned HTTP ${response.status}: ${text}`,
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await response.json();
    const verified: boolean = result?.success === true;
    // If score is absent in a successful response, default to 0 so the threshold
    // check below always blocks the request rather than silently passing it.
    const score: number = typeof result?.score === 'number' ? result.score : 0;
    // When the API omits the action field (e.g. tokens generated without an action),
    // skip action validation rather than incorrectly rejecting the request.
    const returnedAction: string = typeof result?.action === 'string' ? result.action : '';
    const actionMatch = !returnedAction || returnedAction === action;

    logger.info('[verifyRecaptchaAndSendOtp] siteverify result', {
      verified,
      score,
      returnedAction,
      errorCodes: result?.['error-codes'],
    });

    if (!verified) {
      const errorCodes: string[] = Array.isArray(result?.['error-codes'])
        ? result['error-codes']
        : [];
      return {
        success: false,
        score,
        message: `reCAPTCHA verification failed: ${errorCodes.join(', ') || 'unknown error'}`,
      };
    }

    if (!actionMatch) {
      return {
        success: false,
        score,
        message: `reCAPTCHA action mismatch (expected "${action}", got "${returnedAction}")`,
      };
    }

    if (score < HUMAN_SCORE_THRESHOLD) {
      return {
        success: false,
        score,
        message: `reCAPTCHA score too low (${score.toFixed(2)}). Request blocked as potential bot.`,
      };
    }

    // Score is high enough → signal the client to proceed with Firebase SMS OTP.
    return {
      success: true,
      score,
      message: 'reCAPTCHA verification passed. Proceed to send SMS OTP.',
    };
  },
);

/** Sales email to notify when a new trip inquiry is created in Firestore.
 *
 * Reads SMTP configuration from environment variables:
 *   SMTP_HOST  – e.g. "smtp.gmail.com"
 *   SMTP_PORT  – e.g. "587"
 *   SMTP_USER  – sender email address
 *   SMTP_PASS  – sender email password / app password
 *   SALES_EMAIL – recipient email (defaults to sale@daiichitravel.com)
 *
 * The inquiry is always saved to Firestore regardless of whether the email is
 * sent. If SMTP_USER or SMTP_PASS are not set, the function logs a warning and
 * exits gracefully without sending an email and without throwing. Administrators
 * should configure these secrets in production to ensure the sales team receives
 * real-time email notifications:
 *   firebase functions:secrets:set SMTP_USER
 *   firebase functions:secrets:set SMTP_PASS
 */
export const notifyInquiry = onDocumentCreated(
  { document: 'inquiries/{inquiryId}', region: 'asia-southeast1' },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const data = snapshot.data() as Record<string, unknown>;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpUser || !smtpPass) {
      logger.warn('[notifyInquiry] SMTP credentials not configured – skipping email send.', { inquiryId: event.params.inquiryId });
      return;
    }

    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const salesEmail = process.env.SALES_EMAIL || 'sale@daiichitravel.com';

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const tripType = data.tripType === 'ROUND_TRIP' ? 'Khứ hồi' : 'Một chiều';
    const phase = data.phase === 'return' ? 'Chiều về' : 'Chiều đi';
    const subject = `[Yêu cầu đặt vé] ${clean(data.name)} – ${clean(data.from)} → ${clean(data.to)} ngày ${clean(data.date)}`;
    const html = `
<h2>Yêu cầu tìm chuyến xe mới</h2>
<table cellpadding="8" style="border-collapse:collapse;width:100%;max-width:600px">
  <tr><td><b>Họ tên</b></td><td>${clean(data.name)}</td></tr>
  <tr><td><b>Điện thoại</b></td><td>${clean(data.phone)}</td></tr>
  ${data.email ? `<tr><td><b>Email</b></td><td>${clean(data.email)}</td></tr>` : ''}
  <tr><td><b>Loại vé</b></td><td>${tripType}${data.tripType === 'ROUND_TRIP' ? ` – ${phase}` : ''}</td></tr>
  <tr><td><b>Điểm đi</b></td><td>${clean(data.from)}</td></tr>
  <tr><td><b>Điểm đến</b></td><td>${clean(data.to)}</td></tr>
  <tr><td><b>Ngày đi</b></td><td>${clean(data.date)}</td></tr>
  ${data.returnDate ? `<tr><td><b>Ngày về</b></td><td>${clean(data.returnDate)}</td></tr>` : ''}
  <tr><td><b>Người lớn</b></td><td>${clean(data.adults)}</td></tr>
  <tr><td><b>Trẻ em</b></td><td>${clean(data.children)}</td></tr>
  ${data.notes ? `<tr><td><b>Ghi chú</b></td><td>${clean(data.notes)}</td></tr>` : ''}
</table>
<p style="color:#888;font-size:12px">Gửi tự động từ hệ thống Daiichi Travel – ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</p>
`;

    try {
      await transporter.sendMail({
        from: `Daiichi Travel <${smtpUser}>`,
        to: salesEmail,
        subject,
        html,
      });
      logger.info('[notifyInquiry] Email sent successfully', { inquiryId: event.params.inquiryId, to: salesEmail });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[notifyInquiry] Failed to send email', { inquiryId: event.params.inquiryId, error: msg });
    }
  },
);

/** Shared HTML block: trilingual header text used in both the sign-in link
 *  email and the welcome email. Displayed below the logo banner. */
const HTML_ESCAPE_MAP: Record<string, string> = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  '"': '&quot;',
  "'": '&#39;',
};

function trilingualIntroHtml(name: string): string {
  const escaped = name.replace(/[<>&"']/g, c => HTML_ESCAPE_MAP[c] ?? c);
  return `
<p style="font-size:16px;color:#333333;margin:0 0 6px">
  <strong>🇻🇳 Kính chào ${escaped},</strong>
</p>
<p style="font-size:14px;color:#555555;margin:0 0 6px">
  Cảm ơn bạn đã đăng ký thành viên <strong>Daiichi Travel</strong> – công ty tổ chức tour du lịch
  và vận tải hành khách chất lượng cao tại Việt Nam. Chúng tôi rất vui mừng chào đón bạn!
</p>
<p style="font-size:16px;color:#333333;margin:16px 0 6px">
  <strong>🇬🇧 Dear ${escaped},</strong>
</p>
<p style="font-size:14px;color:#555555;margin:0 0 6px">
  Thank you for registering as a <strong>Daiichi Travel</strong> member – a premium travel &amp;
  passenger transport company in Vietnam. We are delighted to welcome you!
</p>
<p style="font-size:16px;color:#333333;margin:16px 0 6px">
  <strong>🇯🇵 ${escaped} 様,</strong>
</p>
<p style="font-size:14px;color:#555555;margin:0 0 16px">
  <strong>Daiichi Travel</strong>の会員にご登録いただきありがとうございます。
  高品質なツアー・旅客輸送サービスを提供するベトナムの旅行会社です。心よりお迎えいたします。
</p>`;
}

/** Shared HTML block: company links + contact info reused across email templates. */
function companyInfoHtml(appUrl: string): string {
  return `
<hr style="border:none;border-top:1px solid #eeeeee;margin:8px 0 20px">
<h3 style="font-size:14px;color:#333333;margin:0 0 12px;font-weight:700">🌐 Kết nối với chúng tôi / Stay Connected / ご連絡先</h3>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px">
  <tr><td style="padding:4px 0">
    <a href="${appUrl}" style="color:#c8102e;text-decoration:none;font-size:13px;font-weight:600">
      🌍 Website: daiichitravel.com
    </a>
  </td></tr>
  <tr><td style="padding:4px 0">
    <a href="https://www.facebook.com/Fanpagedaiichitravel" style="color:#1877f2;text-decoration:none;font-size:13px;font-weight:600">
      📘 Facebook: facebook.com/Fanpagedaiichitravel
    </a>
  </td></tr>
  <tr><td style="padding:4px 0">
    <a href="https://www.youtube.com/@daiichitravel63" style="color:#ff0000;text-decoration:none;font-size:13px;font-weight:600">
      ▶️ YouTube: youtube.com/@daiichitravel63
    </a>
  </td></tr>
  <tr><td style="padding:4px 0">
    <a href="https://www.instagram.com/daiichi_travel_official/" style="color:#e1306c;text-decoration:none;font-size:13px;font-weight:600">
      📸 Instagram: @daiichi_travel_official
    </a>
  </td></tr>
</table>
<hr style="border:none;border-top:1px solid #eeeeee;margin:0 0 20px">
<h3 style="font-size:14px;color:#333333;margin:0 0 12px;font-weight:700">📞 Thông tin liên hệ / Contact / 連絡先</h3>
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td style="padding:4px 0;font-size:13px;color:#555555">📱 Hotline 24/7: <strong>+84 96 100 47 09</strong></td></tr>
  <tr><td style="padding:4px 0;font-size:13px;color:#555555">📧 Email: <strong>info@daiichitravel.com</strong></td></tr>
  <tr><td style="padding:4px 0;font-size:13px;color:#555555">📍 Địa chỉ: <strong>96 Nguyễn Hữu Huân, Hoàn Kiếm, Hà Nội</strong></td></tr>
</table>`;
}

/** Shared email wrapper: header banner + body content + footer. */
function buildEmailHtml(opts: {
  logoUrl: string;
  headerTitle: string;
  bodyHtml: string;
  footerNote: string;
}): string {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Daiichi Travel</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:16px;overflow:hidden;max-width:600px;width:100%;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#c8102e 0%,#8b0000 100%);padding:32px 32px;text-align:center">
            <img src="${opts.logoUrl}" alt="Daiichi Travel" height="52"
                 style="max-width:200px;display:block;margin:0 auto 14px">
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;letter-spacing:-0.5px">
              ${opts.headerTitle}
            </h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px 32px 24px">
            ${opts.bodyHtml}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9f9f9;padding:18px 32px;text-align:center;border-top:1px solid #eeeeee">
            <p style="color:#888888;font-size:12px;margin:0 0 4px">${opts.footerNote}</p>
            <p style="color:#aaaaaa;font-size:11px;margin:0">© 2026 Daiichi Travel. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── sendEmailLoginLink ───────────────────────────────────────────────────────
/** HTTPS Callable: generate a Firebase email sign-in link via Admin SDK and
 *  deliver a fully branded trilingual HTML email (Vietnamese / English / Japanese)
 *  instead of Firebase's generic default email.
 *
 *  Request:  { email: string, redirectUrl?: string }
 *  Response: { success: boolean }
 *
 *  If SMTP credentials are not configured the function throws "unavailable" so
 *  the client can gracefully fall back to Firebase's native sendSignInLinkToEmail.
 */
interface SendEmailLoginLinkRequest {
  email: string;
  redirectUrl?: string;
}

interface SendEmailLoginLinkResponse {
  success: boolean;
}

export const sendEmailLoginLink = https.onCall(
  { region: 'asia-southeast1', cors: true },
  async (request): Promise<SendEmailLoginLinkResponse> => {
    const data = request.data as SendEmailLoginLinkRequest;

    if (!data || typeof data.email !== 'string' || !data.email.trim()) {
      throw new https.HttpsError('invalid-argument', 'A valid email address is required.');
    }

    const email = data.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new https.HttpsError('invalid-argument', 'Invalid email address format.');
    }

    const appUrl = process.env.APP_URL || 'https://daiichitravel.com';
    const redirectUrl =
      typeof data.redirectUrl === 'string' && data.redirectUrl.trim()
        ? data.redirectUrl.trim()
        : appUrl;

    // Generate the sign-in link using Firebase Admin SDK (does NOT send an email)
    let signInLink: string;
    try {
      signInLink = await admin.auth().generateSignInWithEmailLink(email, {
        url: redirectUrl,
        handleCodeInApp: true,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[sendEmailLoginLink] Failed to generate sign-in link', { email, error: msg });
      throw new https.HttpsError('internal', 'Failed to generate sign-in link.');
    }

    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpUser || !smtpPass) {
      logger.warn('[sendEmailLoginLink] SMTP credentials not configured – cannot send branded email.', { email });
      throw new https.HttpsError('unavailable', 'Email service not configured.');
    }

    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const logoUrl =
      'https://firebasestorage.googleapis.com/v0/b/daiichitravel-f49fd.firebasestorage.app/o/daiichilogo.png?alt=media&token=bcc9d130-5370-42e2-b0f6-d0b4a3b32724';
    const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

    const activationButton = `
<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 28px">
  <tr><td align="center">
    <a href="${signInLink}"
       style="background:#c8102e;color:#ffffff;text-decoration:none;padding:16px 48px;
              border-radius:8px;font-size:17px;font-weight:900;display:inline-block;
              letter-spacing:0.5px;border:3px solid #8b0000">
      🔑 ĐĂNG NHẬP / SIGN IN / サインイン
    </a>
  </td></tr>
  <tr><td align="center" style="padding-top:14px">
    <p style="font-size:12px;color:#888;margin:0">
      Hoặc sao chép liên kết bên dưới / Or copy the link below / または以下のリンクをコピー:
    </p>
    <p style="font-size:11px;word-break:break-all;color:#c8102e;margin:6px 0 0;font-weight:700">
      <a href="${signInLink}" style="color:#c8102e">${signInLink}</a>
    </p>
  </td></tr>
</table>
<p style="font-size:12px;color:#888888;text-align:center;margin:0 0 24px">
  ⏱ Liên kết có hiệu lực trong <strong>1 giờ</strong> / Valid for <strong>1 hour</strong> / 有効期限 <strong>1時間</strong>
</p>`;

    const bodyHtml = `
${trilingualIntroHtml('Quý khách')}
<hr style="border:none;border-top:2px solid #c8102e;margin:8px 0 20px">
<!-- Trilingual activation instructions -->
<p style="font-size:14px;color:#333333;margin:0 0 6px;font-weight:700">
  🇻🇳 Nhấn nút bên dưới để kích hoạt và đăng nhập vào tài khoản của bạn:
</p>
<p style="font-size:14px;color:#333333;margin:6px 0 6px;font-weight:700">
  🇬🇧 Click the button below to activate and sign in to your account:
</p>
<p style="font-size:14px;color:#333333;margin:6px 0 16px;font-weight:700">
  🇯🇵 以下のボタンをクリックして、アカウントを有効化してサインインしてください：
</p>
${activationButton}
${companyInfoHtml(appUrl)}`;

    const html = buildEmailHtml({
      logoUrl,
      headerTitle: 'Kích hoạt tài khoản / Account Activation / アカウント有効化',
      bodyHtml,
      footerNote: `Gửi tự động từ hệ thống Daiichi Travel – ${now}`,
    });

    const subject =
      '【Daiichi Travel】 Liên kết đăng nhập / Sign-in Link / サインインリンク';

    try {
      await transporter.sendMail({
        from: `Daiichi Travel <${smtpUser}>`,
        to: email,
        subject,
        html,
      });
      logger.info('[sendEmailLoginLink] Sign-in link email sent', { email });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[sendEmailLoginLink] Failed to send email', { email, error: msg });
      throw new https.HttpsError('internal', 'Failed to send sign-in email.');
    }

    return { success: true };
  },
);

/** Welcome email sent to a newly registered customer.
 *
 * Triggered when a new document is created in the `customers` collection.
 * If the customer document contains an email address the function sends a
 * branded trilingual welcome email (Vietnamese / English / Japanese) that
 * introduces Daiichi Travel, includes links to all company channels, and
 * provides a prominent button directing the customer back to the main website.
 *
 * Reads SMTP configuration from the same environment variables as notifyInquiry:
 *   SMTP_HOST  – e.g. "smtp.gmail.com"
 *   SMTP_PORT  – e.g. "587"
 *   SMTP_USER  – sender email address
 *   SMTP_PASS  – sender email password / app password
 *   APP_URL    – base URL used for the confirmation button
 *                (defaults to https://daiichitravel.com)
 *
 * If the customer has no email, or if SMTP credentials are absent, the
 * function exits gracefully without throwing.
 */
export const onCustomerCreated = onDocumentCreated(
  { document: 'customers/{customerId}', region: 'asia-southeast1' },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const data = snapshot.data() as Record<string, unknown>;
    const customerEmail = typeof data.email === 'string' ? data.email.trim() : '';

    if (!customerEmail) {
      logger.info('[onCustomerCreated] No email on customer – skipping welcome email.', {
        customerId: event.params.customerId,
      });
      return;
    }

    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpUser || !smtpPass) {
      logger.warn('[onCustomerCreated] SMTP credentials not configured – skipping welcome email.', {
        customerId: event.params.customerId,
      });
      return;
    }

    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const appUrl = process.env.APP_URL || 'https://daiichitravel.com';

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const customerName = clean(data.name) || 'Quý khách';
    const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

    const logoUrl =
      'https://firebasestorage.googleapis.com/v0/b/daiichitravel-f49fd.firebasestorage.app/o/daiichilogo.png?alt=media&token=bcc9d130-5370-42e2-b0f6-d0b4a3b32724';

    const confirmButton = `
<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 28px">
  <tr><td align="center">
    <a href="${appUrl}"
       style="background:#c8102e;color:#ffffff;text-decoration:none;padding:16px 48px;
              border-radius:8px;font-size:17px;font-weight:900;display:inline-block;
              letter-spacing:0.5px;border:3px solid #8b0000">
      ✅ TRUY CẬP WEBSITE / VISIT WEBSITE / ウェブサイトへ
    </a>
  </td></tr>
  <tr><td align="center" style="padding-top:10px">
    <a href="${appUrl}" style="font-size:13px;color:#c8102e;font-weight:700">${appUrl}</a>
  </td></tr>
</table>`;

    const bodyHtml = `
${trilingualIntroHtml(customerName)}
<p style="font-size:14px;color:#555555;line-height:1.7;margin:0 0 6px">
  🇻🇳 Với đội ngũ chuyên nghiệp và hệ thống xe hiện đại, chúng tôi cam kết mang đến
  những chuyến đi <strong>an toàn, thoải mái</strong> và đáng nhớ nhất.
</p>
<p style="font-size:14px;color:#555555;line-height:1.7;margin:0 0 6px">
  🇬🇧 With a professional team and modern fleet, we are committed to providing you with
  the <strong>safest, most comfortable</strong> and most memorable journeys.
</p>
<p style="font-size:14px;color:#555555;line-height:1.7;margin:0 0 20px">
  🇯🇵 プロのチームと最新の車両で、<strong>安全・快適</strong>で思い出に残る旅をお届けします。
</p>
<hr style="border:none;border-top:2px solid #c8102e;margin:8px 0 20px">
<p style="font-size:14px;color:#333333;margin:0 0 4px;font-weight:700">🇻🇳 Nhấn nút bên dưới để truy cập website và khám phá các chuyến đi:</p>
<p style="font-size:14px;color:#333333;margin:0 0 4px;font-weight:700">🇬🇧 Click the button below to visit the website and explore our trips:</p>
<p style="font-size:14px;color:#333333;margin:0 0 16px;font-weight:700">🇯🇵 以下のボタンをクリックしてウェブサイトをご覧ください：</p>
${confirmButton}
${companyInfoHtml(appUrl)}`;

    const subject =
      `【Daiichi Travel】 Chào mừng ${customerName}! Welcome! ようこそ! 🎉`;

    const welcomeHeaderTitle =
      'Chào mừng đến với Daiichi Travel! 🎉' +
      '<br><span style="font-size:16px;font-weight:400">Welcome! / ようこそ!</span>';

    const html = buildEmailHtml({
      logoUrl,
      headerTitle: welcomeHeaderTitle,
      bodyHtml,
      footerNote: `Gửi tự động từ hệ thống Daiichi Travel – ${now}`,
    });

    try {
      await transporter.sendMail({
        from: `Daiichi Travel <${smtpUser}>`,
        to: customerEmail,
        subject,
        html,
      });
      logger.info('[onCustomerCreated] Welcome email sent', {
        customerId: event.params.customerId,
        to: customerEmail,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[onCustomerCreated] Failed to send welcome email', {
        customerId: event.params.customerId,
        error: msg,
      });
    }
  },
);
