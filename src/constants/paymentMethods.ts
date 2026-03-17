export const PAYMENT_METHODS = ['Chuyển khoản QR', 'Tiền mặt', 'Chuyển khoản', 'Thẻ tín dụng', 'MoMo', 'Giữ vé'] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];
