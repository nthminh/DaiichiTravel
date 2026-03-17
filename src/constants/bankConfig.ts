/**
 * VietinBank QR Payment Configuration
 *
 * DEMO MODE (current): Uses placeholder/test bank account info.
 * The QR code generated is a valid VietQR format but with demo credentials.
 *
 * TO SWITCH TO PRODUCTION:
 * 1. Replace BANK_CONFIG.accountNumber with your real VietinBank account number
 * 2. Replace BANK_CONFIG.accountName with the registered account holder name
 * 3. Replace BANK_CONFIG.bankBin with "970415" (VietinBank BIN) if not already set
 * 4. Set BANK_CONFIG.isDemoMode = false
 * 5. Optionally set BANK_CONFIG.logoUrl to your bank logo URL
 *
 * VietQR URL format:
 * https://img.vietqr.io/image/{bankId}-{accountNumber}-{template}.png?amount={amount}&addInfo={info}&accountName={name}
 */

export interface BankConfig {
  /** Bank BIN code. VietinBank = 970415 */
  bankBin: string;
  /** Short bank identifier for VietQR API. VietinBank = "ICB" */
  bankId: string;
  /** Bank display name */
  bankName: string;
  /** Account number. Replace with real account in production */
  accountNumber: string;
  /** Account holder name. Replace with real name in production */
  accountName: string;
  /** Optional branch name for display */
  branch?: string;
  /** Whether running in demo/test mode */
  isDemoMode: boolean;
  /** QR template style */
  qrTemplate: 'compact' | 'compact2' | 'qr_only' | 'print';
}

export const BANK_CONFIG: BankConfig = {
  bankBin: '970415',          // VietinBank BIN — do NOT change in production
  bankId: 'ICB',              // VietinBank short ID for VietQR API
  bankName: 'VietinBank',
  // ⚠️  DEMO CREDENTIALS — replace before going live  ⚠️
  accountNumber: '0123456789',   // TODO: replace with real account number
  accountName: 'CONG TY TNHH DAIICHI TRAVEL', // TODO: replace with real account name
  branch: 'Chi nhánh TP.HCM',   // optional – for display only
  isDemoMode: true,              // set to false when real credentials are in place
  qrTemplate: 'compact2',
};

/**
 * Generate a VietQR image URL for a given amount and reference.
 * Returns a URL pointing to img.vietqr.io that renders the QR code as PNG.
 */
export function generateVietQrUrl(params: {
  amount: number;
  description: string;
  accountName?: string;
}): string {
  const cfg = BANK_CONFIG;
  const encoded = encodeURIComponent(params.description);
  const name = encodeURIComponent(params.accountName ?? cfg.accountName);
  return (
    `https://img.vietqr.io/image/${cfg.bankId}-${cfg.accountNumber}-${cfg.qrTemplate}.png` +
    `?amount=${params.amount}&addInfo=${encoded}&accountName=${name}`
  );
}

/**
 * Generate a VietQR string (EMVCo format) for use with qrcode.react.
 * This string encodes enough information for any banking app to parse.
 * Format follows NAPAS/VietQR specification.
 */
export function generateVietQrString(params: {
  amount: number;
  description: string;
}): string {
  const cfg = BANK_CONFIG;
  // EMVCo QRCPS-MPM static QR string format used by VietQR
  // Field 00: Payload Format Indicator
  // Field 01: Point of Initiation Method (12 = static)
  // Field 38: Consumer Account Information (NAPAS merchant)
  // Field 52: Merchant Category Code
  // Field 53: Transaction Currency (704 = VND)
  // Field 54: Transaction Amount
  // Field 58: Country Code
  // Field 59: Merchant Name
  // Field 60: Merchant City
  // Field 62: Additional Data (reference label)
  const amount = params.amount.toString();
  const desc = params.description.slice(0, 25); // max 25 chars per EMVCo spec
  // Field 38 inner content: GUID (14 chars) + tag 01 (bankBin) + tag 02 (accountNumber)
  const innerContent =
    `0010A000000727` +
    `01${cfg.bankBin.length.toString().padStart(2, '0')}${cfg.bankBin}` +
    `02${cfg.accountNumber.length.toString().padStart(2, '0')}${cfg.accountNumber}`;
  // Field 62 additional data: tag 01 (reference label) = 2 bytes tag + 2 bytes length + value
  // The outer length = 4 (for "01" + 2-digit length indicator) + desc.length
  const additionalDataLen = (4 + desc.length).toString().padStart(2, '0');
  return [
    '000201',
    '010212',
    `38${innerContent.length.toString().padStart(2, '0')}${innerContent}`,
    '5204' + '7999',
    '5303' + '704',
    `54${amount.length.toString().padStart(2, '0')}${amount}`,
    '5802VN',
    `59${cfg.accountName.slice(0, 25).length.toString().padStart(2, '0')}${cfg.accountName.slice(0, 25)}`,
    '6007HCMC',
    `62${additionalDataLen}01${desc.length.toString().padStart(2, '0')}${desc}`,
    '6304',
  ].join('');
}
