import * as admin from 'firebase-admin';
import * as https from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';

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
  { region: 'us-central1', secrets: ['RECAPTCHA_SECRET_KEY'] },
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
