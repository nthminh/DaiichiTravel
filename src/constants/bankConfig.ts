/**
 * OnePay QR Payment Configuration
 *
 * DEMO MODE (current): Uses placeholder/test OnePay merchant credentials.
 * The QR code generated is a simulated OnePay payment QR.
 *
 * TO SWITCH TO PRODUCTION:
 * 1. Replace BANK_CONFIG.accountNumber with your real OnePay merchant code
 * 2. Replace BANK_CONFIG.accountName with the registered merchant name
 * 3. Replace BANK_CONFIG.branch with your OnePay access code
 * 4. Set BANK_CONFIG.isDemoMode = false
 * 5. Change paymentBaseUrl to production: https://onepay.vn/paygate/vpcpay.op
 *
 * OnePay payment URL format:
 * https://mtf.onepay.vn/paygate/vpcpay.op?vpc_Version=2&vpc_Command=pay&vpc_Amount={amount}&vpc_MerchTxnRef={ref}&vpc_Merchant={merchant}&vpc_Locale=vn
 */

export interface BankConfig {
  /** Bank BIN (unused for OnePay gateway; kept for interface compatibility) */
  bankBin: string;
  /** Short provider identifier */
  bankId: string;
  /** Payment gateway / bank display name */
  bankName: string;
  /** Merchant code (OnePay) or account number (bank) */
  accountNumber: string;
  /** Merchant name or account holder name */
  accountName: string;
  /** Optional access code / branch for display */
  branch?: string;
  /** Whether running in demo/test mode */
  isDemoMode: boolean;
  /** QR template style (unused for OnePay) */
  qrTemplate: 'compact' | 'compact2' | 'qr_only' | 'print';
  /** Base URL for OnePay payment page */
  paymentBaseUrl?: string;
}

export const BANK_CONFIG: BankConfig = {
  bankBin: '',
  bankId: 'ONEPAY',
  bankName: 'OnePay',
  // ⚠️  DEMO CREDENTIALS — replace before going live  ⚠️
  accountNumber: 'TESTONEPAY',         // TODO: replace with real OnePay merchant code
  accountName: 'CONG TY TNHH DAIICHI TRAVEL', // TODO: replace with real merchant name
  branch: 'DAIICHI001',                // optional access/store code – for display only
  isDemoMode: true,                    // set to false when real credentials are in place
  qrTemplate: 'compact2',
  paymentBaseUrl: 'https://mtf.onepay.vn/paygate/vpcpay.op', // test environment
};

/**
 * Generate an OnePay payment image URL.
 * Returns empty string so the <img> tag will fail and the SVG QR fallback is shown.
 * (OnePay does not expose a public QR image API like VietQR does.)
 */
export function generatePaymentQrUrl(_params: {
  amount: number;
  description: string;
  accountName?: string;
}): string {
  // Return empty so PaymentQRModal falls back to the QRCodeSVG with generatePaymentQrString()
  return '';
}

/**
 * Generate an OnePay-style payment QR string for use with qrcode.react.
 * In demo mode this produces a simulated OnePay payment URL that can be scanned
 * to inspect the payment details (no real transaction is triggered).
 */
export function generatePaymentQrString(params: {
  amount: number;
  description: string;
}): string {
  const cfg = BANK_CONFIG;
  const base = cfg.paymentBaseUrl ?? 'https://mtf.onepay.vn/paygate/vpcpay.op';
  const ref = encodeURIComponent(params.description.slice(0, 50));
  const merchant = encodeURIComponent(cfg.accountNumber);
  // OnePay vpc_Amount is in VND × 100 (smallest unit)
  const vpcAmount = params.amount * 100;
  return (
    `${base}?vpc_Version=2&vpc_Command=pay` +
    `&vpc_Amount=${vpcAmount}` +
    `&vpc_MerchTxnRef=${ref}` +
    `&vpc_Merchant=${merchant}` +
    `&vpc_OrderInfo=${ref}` +
    `&vpc_Locale=vn`
  );
}

/** @deprecated Use generatePaymentQrUrl instead */
export const generateVietQrUrl = generatePaymentQrUrl;
/** @deprecated Use generatePaymentQrString instead */
export const generateVietQrString = generatePaymentQrString;
