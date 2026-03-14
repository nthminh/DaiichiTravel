import * as admin from 'firebase-admin';
import * as https from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { defineString } from 'firebase-functions/params';

admin.initializeApp();

/**
 * reCAPTCHA Enterprise site key.
 * Defaults to the production key; override via the `RECAPTCHA_SITE_KEY`
 * environment variable or Firebase Functions params.
 */
const recaptchaSiteKey = defineString('RECAPTCHA_SITE_KEY', {
  default: '6LfaI4osAAAAALZbvyZnRddXaeb112xIo985XGYz',
  description: 'reCAPTCHA Enterprise site key used to verify client-side tokens.',
});

/**
 * Minimum reCAPTCHA Enterprise score to treat a request as human.
 * Scores range from 0.0 (bot) to 1.0 (human). 0.5 is Google's recommended threshold.
 */
const HUMAN_SCORE_THRESHOLD = 0.5;

interface VerifyRecaptchaRequest {
  /** reCAPTCHA Enterprise token obtained via grecaptcha.enterprise.execute() on the client */
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
 * Verifies a reCAPTCHA Enterprise token server-side using the Google
 * reCAPTCHA Enterprise API. If the score indicates a human user (>= 0.5),
 * it returns a success signal so the client can proceed to send the
 * Firebase SMS OTP to the whitelisted phone number.
 *
 * Usage from the client (firebase/functions):
 *   const verifyRecaptcha = httpsCallable(functions, 'verifyRecaptchaAndSendOtp');
 *   const result = await verifyRecaptcha({ token, action: 'LOGIN' });
 */
export const verifyRecaptchaAndSendOtp = https.onCall(
  { region: 'asia-southeast1' },
  async (request): Promise<VerifyRecaptchaResponse> => {
    const data = request.data as VerifyRecaptchaRequest;

    if (!data || typeof data.token !== 'string' || !data.token.trim()) {
      throw new https.HttpsError('invalid-argument', 'A non-empty reCAPTCHA token is required.');
    }

    const token = data.token.trim();
    const action = typeof data.action === 'string' ? data.action : 'LOGIN';

    // Retrieve the project ID from the Firebase Admin app config (populated at runtime).
    const projectId = admin.instanceId().app.options.projectId ?? process.env.GCLOUD_PROJECT;
    if (!projectId) {
      logger.error('Could not determine Firebase project ID');
      throw new https.HttpsError('internal', 'Server configuration error: missing project ID.');
    }

    // Call the reCAPTCHA Enterprise API using the Google APIs endpoint.
    // We use the Application Default Credentials attached to the Cloud Function
    // runtime service account, which is authorised to call the reCAPTCHA Enterprise API
    // when the API is enabled in the project.
    const apiUrl =
      `https://recaptchaenterprise.googleapis.com/v1/projects/${projectId}/assessments`;

    const body = JSON.stringify({
      event: {
        token,
        siteKey: recaptchaSiteKey.value(),
        expectedAction: action,
      },
    });

    let response: Response;
    try {
      // Obtain an access token from the runtime service account.
      const tokenResponse = await admin.app().options.credential?.getAccessToken();
      const accessToken = tokenResponse?.access_token;
      if (!accessToken) {
        throw new Error('Failed to obtain access token from service account credentials.');
      }

      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[verifyRecaptchaAndSendOtp] fetch error:', msg);
      throw new https.HttpsError('internal', `Failed to reach reCAPTCHA Enterprise API: ${msg}`);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      logger.error('[verifyRecaptchaAndSendOtp] API error', response.status, text);
      throw new https.HttpsError(
        'internal',
        `reCAPTCHA Enterprise API returned HTTP ${response.status}: ${text}`,
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assessment: any = await response.json();
    const score: number = assessment?.riskAnalysis?.score ?? assessment?.score ?? 0;
    const valid: boolean = assessment?.tokenProperties?.valid ?? false;
    const actionMatch: boolean =
      !assessment?.tokenProperties?.action ||
      assessment.tokenProperties.action === action;

    logger.info('[verifyRecaptchaAndSendOtp] assessment', {
      valid,
      score,
      actionMatch,
      reasons: assessment?.riskAnalysis?.reasons,
    });

    if (!valid || !actionMatch) {
      return {
        success: false,
        score,
        message: valid
          ? `reCAPTCHA action mismatch (expected "${action}", got "${assessment?.tokenProperties?.action}")`
          : `reCAPTCHA token is invalid: ${assessment?.tokenProperties?.invalidReason ?? 'unknown reason'}`,
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
