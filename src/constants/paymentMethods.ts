export const PAYMENT_METHODS = ['Tiền mặt', 'Chuyển khoản', 'Thẻ tín dụng', 'MoMo', 'Giữ vé'] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];
