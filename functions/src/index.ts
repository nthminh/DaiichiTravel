import * as admin from 'firebase-admin';
import * as https from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import * as nodemailer from 'nodemailer';

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
    const subject = `[Yêu cầu đặt vé] ${data.name} – ${data.from} → ${data.to} ngày ${data.date}`;
    const html = `
<h2>Yêu cầu tìm chuyến xe mới</h2>
<table cellpadding="8" style="border-collapse:collapse;width:100%;max-width:600px">
  <tr><td><b>Họ tên</b></td><td>${data.name}</td></tr>
  <tr><td><b>Điện thoại</b></td><td>${data.phone}</td></tr>
  ${data.email ? `<tr><td><b>Email</b></td><td>${data.email}</td></tr>` : ''}
  <tr><td><b>Loại vé</b></td><td>${tripType}${data.tripType === 'ROUND_TRIP' ? ` – ${phase}` : ''}</td></tr>
  <tr><td><b>Điểm đi</b></td><td>${data.from}</td></tr>
  <tr><td><b>Điểm đến</b></td><td>${data.to}</td></tr>
  <tr><td><b>Ngày đi</b></td><td>${data.date}</td></tr>
  ${data.returnDate ? `<tr><td><b>Ngày về</b></td><td>${data.returnDate}</td></tr>` : ''}
  <tr><td><b>Người lớn</b></td><td>${data.adults}</td></tr>
  <tr><td><b>Trẻ em</b></td><td>${data.children}</td></tr>
  ${data.notes ? `<tr><td><b>Ghi chú</b></td><td>${data.notes}</td></tr>` : ''}
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
