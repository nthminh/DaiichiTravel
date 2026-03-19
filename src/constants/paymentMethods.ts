export const PAYMENT_METHODS = ['Chuyển khoản QR', 'Tiền mặt', 'Chuyển khoản', 'Thẻ tín dụng', 'MoMo', 'Giữ vé', 'Thanh toán sau'] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];

export const DEFAULT_PAYMENT_METHOD: PaymentMethod = 'Chuyển khoản QR';

export const PAYMENT_METHOD_TRANSLATION_KEYS: Record<PaymentMethod, string> = {
  'Chuyển khoản QR': 'payment_qr',
  'Tiền mặt': 'payment_cash',
  'Chuyển khoản': 'payment_transfer',
  'Thẻ tín dụng': 'payment_card',
  'MoMo': 'payment_momo',
  'Giữ vé': 'payment_hold',
  'Thanh toán sau': 'payment_later',
};
