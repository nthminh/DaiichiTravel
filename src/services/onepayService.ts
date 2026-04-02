/**
 * Module tích hợp cổng thanh toán OnePay Việt Nam
 *
 * Hỗ trợ hai loại cổng thanh toán:
 *   - Nội địa (Domestic): dành cho thẻ ATM / tài khoản ngân hàng nội địa
 *   - Quốc tế (International): dành cho thẻ Visa, MasterCard, JCB, Amex
 *
 * Sử dụng HMAC-SHA256 (Web Crypto API) để tạo và xác thực chữ ký điện tử
 * theo đặc tả kỹ thuật mới nhất của OnePay Việt Nam.
 *
 * Các biến môi trường liên quan (tùy chọn, xem .env.example):
 *   VITE_ONEPAY_MERCHANT     — Mã merchant do OnePay cấp
 *   VITE_ONEPAY_ACCESS_CODE  — Access Code do OnePay cấp
 *   VITE_ONEPAY_HASH_KEY     — Khóa bí mật HMAC-SHA256 (dạng hex) do OnePay cấp
 *
 * Lưu ý bảo mật: HASH_KEY là thông tin nhạy cảm; không được commit vào source
 * code mà phải lưu trong biến môi trường hoặc Firestore (chỉ MANAGER mới xem).
 */

// ============================================================
// GIAO DIỆN DỮ LIỆU (Interfaces & Types)
// ============================================================

/** Cấu hình kết nối cổng thanh toán OnePay */
export interface OnepayConfig {
  /** Mã merchant (vpc_Merchant) — do OnePay cấp khi đăng ký */
  merchant: string;
  /** Mã access code (vpc_Access_Code) — do OnePay cấp khi đăng ký */
  accessCode: string;
  /**
   * Khóa bí mật dạng chuỗi hex dùng để tạo/xác thực chữ ký HMAC-SHA256
   * (được gọi là "Hash Secret" hoặc "Secure Hash Secret" trong tài liệu OnePay)
   */
  hashKey: string;
  /** Môi trường hoạt động: 'sandbox' (kiểm thử) hoặc 'production' (thật) */
  environment: 'sandbox' | 'production';
  /** Loại cổng thanh toán: 'domestic' (nội địa) hoặc 'international' (quốc tế) */
  gatewayType: 'domestic' | 'international';
}

/** Tham số đầu vào để tạo URL thanh toán */
export interface OnepayPaymentParams {
  /**
   * Số tiền cần thanh toán, đơn vị VNĐ (ví dụ: 500000 = 500,000 VNĐ).
   * Hàm sẽ tự động nhân 100 trước khi gửi đến OnePay theo đặc tả.
   */
  amount: number;
  /** Mã đơn hàng duy nhất (vpc_MerchTxnRef) — tối đa 40 ký tự */
  orderId: string;
  /** Thông tin mô tả đơn hàng (vpc_OrderInfo) — tối đa 255 ký tự */
  orderInfo: string;
  /**
   * Địa chỉ IP của khách hàng (vpc_TicketNo).
   * Dùng để phòng chống gian lận; điền '127.0.0.1' nếu không có.
   */
  customerIp: string;
  /** URL nhận kết quả trả về sau khi thanh toán (vpc_ReturnURL) */
  returnUrl: string;
  /** Ngôn ngữ hiển thị trên trang OnePay: 'vn' (mặc định) hoặc 'en' */
  locale?: 'vn' | 'en';
  /**
   * URL nhận IPN (Instant Payment Notification) từ OnePay sau khi giao dịch hoàn tất.
   * Khi được cung cấp, sẽ được thêm vào tham số `vpc_CallbackURL` trong URL thanh toán,
   * cho phép OnePay gọi trực tiếp đến endpoint này thay vì chỉ dựa vào URL đã đăng ký
   * tĩnh trong portal. Đây là trường bắt buộc để hàm `onepayIpn` Cloud Function hoạt động.
   * Ví dụ: 'https://onepayipn-xxxxxxxx-as.a.run.app'
   */
  callbackUrl?: string;
}

/** Dữ liệu IPN (Instant Payment Notification) / Webhook nhận từ OnePay */
export interface OnepayIpnData {
  /** Mã phản hồi giao dịch ('0' = thành công) */
  vpc_TxnResponseCode: string;
  /** Số tiền giao dịch (đã nhân 100) */
  vpc_Amount: string;
  /** Mã đơn hàng đã gửi lúc tạo URL */
  vpc_MerchTxnRef: string;
  /** Số giao dịch OnePay (để đối soát) */
  vpc_TransactionNo?: string;
  /** Thông tin đơn hàng */
  vpc_OrderInfo?: string;
  /** Chữ ký điện tử HMAC-SHA256 do OnePay gửi về (để xác thực) */
  vpc_SecureHash?: string;
  /** Loại chữ ký (thường là 'SHA256') */
  vpc_SecureHashType?: string;
  /** Các tham số vpc_* / user_* khác */
  [key: string]: string | undefined;
}

/** Kết quả sau khi xác thực dữ liệu IPN */
export interface OnepayIpnResult {
  /** true nếu chữ ký điện tử hợp lệ (tham số chưa bị giả mạo) */
  isValid: boolean;
  /** true nếu giao dịch thành công (vpc_TxnResponseCode === '0') */
  isSuccess: boolean;
  /** Mã phản hồi từ OnePay (vpc_TxnResponseCode) */
  responseCode: string;
  /**
   * Số tiền giao dịch thực tế, đơn vị VNĐ (đã chia 100 từ vpc_Amount).
   * Cần kiểm tra lại với số tiền trong đơn hàng trước khi xác nhận.
   */
  amount: number;
  /** Mã đơn hàng (vpc_MerchTxnRef) */
  orderId: string;
  /** Số giao dịch OnePay để đối soát (vpc_TransactionNo) */
  transactionNo: string;
  /** Thông báo lỗi tiếng Việt (chỉ có khi isSuccess = false hoặc isValid = false) */
  errorMessage?: string;
}

// ============================================================
// ENDPOINT URL THEO MÔI TRƯỜNG VÀ LOẠI CỔNG
// ============================================================

/**
 * Bảng URL endpoint của OnePay.
 * - Domestic (nội địa):     vpcpay.op  — ATM/tài khoản ngân hàng Việt Nam
 * - International (quốc tế): vpc.op     — Thẻ Visa/MasterCard/JCB
 * - mtf.onepay.vn = sandbox (môi trường kiểm thử)
 * - onepay.vn      = production (môi trường thật)
 */
const ONEPAY_ENDPOINTS = {
  domestic: {
    sandbox:    'https://mtf.onepay.vn/paygate/vpcpay.op',
    production: 'https://onepay.vn/paygate/vpcpay.op',
  },
  international: {
    sandbox:    'https://mtf.onepay.vn/onecomm-pay/vpc.op',
    production: 'https://onepay.vn/onecomm-pay/vpc.op',
  },
} as const;

// ============================================================
// BẢNG MÃ PHẢN HỒI ONEPAY (tiếng Việt)
// ============================================================

/** Mô tả tiếng Việt cho từng mã phản hồi của OnePay */
const RESPONSE_MESSAGES: Record<string, string> = {
  '0':   'Giao dịch thành công',
  '1':   'Ngân hàng từ chối giao dịch',
  '2':   'Ngân hàng từ chối giao dịch (lý do khác)',
  '3':   'Không tìm thấy giao dịch',
  '4':   'Giao dịch đã được đổi chiều (reversed)',
  '5':   'Giao dịch đang được xử lý tại ngân hàng',
  '6':   'Lỗi khi tạo giao dịch tại OnePay',
  '7':   'Lỗi xác thực chữ ký điện tử',
  '8':   'Thẻ/tài khoản không đủ số dư hoặc vượt hạn mức',
  '9':   'Thẻ/tài khoản chưa đăng ký dịch vụ InternetBanking',
  '10':  'Thẻ hết hạn sử dụng hoặc bị khóa',
  '11':  'Thẻ chưa đăng ký dịch vụ thanh toán trực tuyến',
  '12':  'Ngày phát hành / hết hạn thẻ không đúng',
  '13':  'Giao dịch vượt quá hạn mức cho phép của ngân hàng',
  '21':  'Số tiền không đủ để hoàn trả',
  '22':  'Thông tin tài khoản không đúng',
  '23':  'Tài khoản bị khóa',
  '24':  'Thông tin thẻ không đúng',
  '25':  'OTP không đúng hoặc đã hết hạn',
  '253': 'Giao dịch quá thời gian cho phép',
  '99':  'Người dùng hủy giao dịch',
};

// ============================================================
// HÀM NỘI BỘ: TẠO CHỮ KÝ HMAC-SHA256
// ============================================================

/**
 * Tính toán chữ ký HMAC-SHA256 sử dụng Web Crypto API (native browser API).
 *
 * Theo đặc tả OnePay:
 *   - Khóa bí mật (hashKey) là chuỗi hex → cần giải mã thành bytes nhị phân trước khi dùng.
 *   - Thông điệp (message) là chuỗi query string đã sắp xếp theo ABC.
 *   - Kết quả trả về là chuỗi hex viết HOA (uppercase).
 *
 * @param hexKey  Khóa bí mật dạng chuỗi hex (do OnePay cấp)
 * @param message Chuỗi thông điệp cần ký
 * @returns       Chữ ký HMAC-SHA256 dạng hex (uppercase)
 */
async function computeHmacSha256(hexKey: string, message: string): Promise<string> {
  // Kiểm tra hợp lệ: chuỗi hex phải có độ dài chẵn và chỉ chứa ký tự 0-9, A-F
  if (!hexKey || hexKey.length === 0 || hexKey.length % 2 !== 0 || !/^[0-9A-Fa-f]+$/.test(hexKey)) {
    throw new Error('Hash Key không hợp lệ: phải là chuỗi hex có độ dài chẵn (ví dụ: "A1B2C3...")');
  }

  // Bước 1: Chuyển chuỗi hex → mảng bytes nhị phân (Uint8Array)
  const keyBytes = new Uint8Array(
    (hexKey.match(/.{1,2}/g) ?? []).map(byte => parseInt(byte, 16))
  );
  // Bước 2: Encode thông điệp thành UTF-8 bytes
  const msgBytes = new TextEncoder().encode(message);

  // Bước 3: Import khóa vào Web Crypto API với thuật toán HMAC-SHA256
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,        // không thể export lại khóa
    ['sign']      // chỉ dùng để ký
  );

  // Bước 4: Tính chữ ký
  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, msgBytes);

  // Bước 5: Chuyển ArrayBuffer → chuỗi hex viết hoa
  return Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

// ============================================================
// HÀM NỘI BỘ: XÂY DỰNG CHUỖI DỮ LIỆU ĐỂ KÝ
// ============================================================

/**
 * Xây dựng chuỗi dữ liệu để tính HMAC-SHA256 theo chuẩn OnePay:
 *   1. Chỉ lấy tham số bắt đầu bằng `vpc_` hoặc `user_`
 *   2. Loại bỏ `vpc_SecureHash` và `vpc_SecureHashType`
 *   3. Sắp xếp theo thứ tự bảng chữ cái (case-sensitive)
 *   4. Nối thành chuỗi `key=value&key=value...` (giá trị KHÔNG URL-encode)
 *
 * @param params Đối tượng chứa các tham số giao dịch
 * @returns      Chuỗi dữ liệu đã sắp xếp dùng để ký
 */
function buildHashData(params: Record<string, string>): string {
  return Object.keys(params)
    .filter(key =>
      (key.startsWith('vpc_') || key.startsWith('user_')) &&
      key !== 'vpc_SecureHash' &&
      key !== 'vpc_SecureHashType'
    )
    .sort()   // sắp xếp ABC theo tên tham số
    .map(key => `${key}=${params[key]}`)
    .join('&');
}

// ============================================================
// HÀM CHÍNH 1: TẠO URL THANH TOÁN (REDIRECT URL)
// ============================================================

/**
 * Tạo URL thanh toán để chuyển hướng (redirect) khách hàng đến cổng OnePay.
 *
 * Quy trình:
 *   1. Nhân số tiền × 100 (OnePay yêu cầu đơn vị nhỏ nhất, ví dụ: xu)
 *   2. Tập hợp tất cả tham số bắt buộc (vpc_*)
 *   3. Sắp xếp tham số và tạo chuỗi ký
 *   4. Tính chữ ký HMAC-SHA256
 *   5. Thêm vpc_SecureHash và vpc_SecureHashType vào tham số
 *   6. Trả về URL đầy đủ (endpoint + query string)
 *
 * Ví dụ sử dụng:
 * ```ts
 * const url = await createOnepayPaymentUrl(config, {
 *   amount: 500000,          // 500,000 VNĐ
 *   orderId: 'ORDER-001',
 *   orderInfo: 'Dat ve xe Daiichi Travel',
 *   customerIp: '127.0.0.1',
 *   returnUrl: 'https://example.com/payment/return',
 * });
 * window.location.href = url; // Chuyển hướng khách hàng
 * ```
 *
 * @param config  Cấu hình OnePay (merchant, accessCode, hashKey, environment, gatewayType)
 * @param params  Thông tin đơn hàng cần thanh toán
 * @returns       URL thanh toán đầy đủ (bao gồm chữ ký HMAC-SHA256)
 */
export async function createOnepayPaymentUrl(
  config: OnepayConfig,
  params: OnepayPaymentParams
): Promise<string> {
  // Lấy URL endpoint phù hợp với môi trường và loại cổng
  const endpoint = ONEPAY_ENDPOINTS[config.gatewayType][config.environment];

  // Số tiền PHẢI được nhân 100 theo yêu cầu của OnePay
  // Ví dụ: 500,000 VNĐ → vpc_Amount = "50000000"
  const vpcAmount = Math.round(params.amount * 100).toString();

  // Tập hợp đầy đủ tham số giao dịch
  const vpcParams: Record<string, string> = {
    vpc_Version:     '2',                         // Phiên bản API
    vpc_Currency:    'VND',                       // Đơn vị tiền tệ
    vpc_Command:     'pay',                       // Loại lệnh: thanh toán
    vpc_Access_Code: config.accessCode,           // Mã truy cập (do OnePay cấp)
    vpc_Merchant:    config.merchant,             // Mã merchant (do OnePay cấp)
    vpc_Locale:      params.locale ?? 'vn',       // Ngôn ngữ hiển thị ('vn' hoặc 'en')
    vpc_ReturnURL:   params.returnUrl,            // URL nhận kết quả thanh toán
    vpc_MerchTxnRef: params.orderId,              // Mã đơn hàng (duy nhất)
    vpc_OrderInfo:   params.orderInfo,            // Thông tin đơn hàng
    vpc_Amount:      vpcAmount,                   // Số tiền (đã nhân 100)
    vpc_TicketNo:    params.customerIp,           // IP khách hàng (chống gian lận)
  };

  // Thêm vpc_CallbackURL khi được cung cấp.
  // Đây là URL mà OnePay sẽ gọi (server-to-server) sau khi giao dịch hoàn tất.
  // Nếu thiếu, OnePay chỉ dùng URL đã đăng ký tĩnh trong portal (nếu có).
  if (params.callbackUrl) {
    vpcParams['vpc_CallbackURL'] = params.callbackUrl;
  }

  // Tạo chuỗi dữ liệu đã sắp xếp ABC để tính chữ ký
  const hashData = buildHashData(vpcParams);

  // Tính chữ ký điện tử HMAC-SHA256
  const secureHash = await computeHmacSha256(config.hashKey, hashData);

  // Thêm chữ ký và loại chữ ký vào tham số
  vpcParams['vpc_SecureHash']     = secureHash;
  vpcParams['vpc_SecureHashType'] = 'SHA256';

  // Tạo query string (URL-encode toàn bộ giá trị)
  const queryString = new URLSearchParams(vpcParams).toString();
  return `${endpoint}?${queryString}`;
}

// ============================================================
// HÀM CHÍNH 2: XÁC THỰC DỮ LIỆU IPN / WEBHOOK
// ============================================================

/**
 * Xác thực dữ liệu IPN (Instant Payment Notification) trả về từ OnePay.
 *
 * Quy trình xác thực:
 *   1. Lấy `vpc_SecureHash` từ dữ liệu nhận được
 *   2. Loại bỏ `vpc_SecureHash` và `vpc_SecureHashType` khỏi tập tham số
 *   3. Tái tạo chuỗi ký từ các tham số còn lại (sắp xếp ABC)
 *   4. Tính lại HMAC-SHA256 và so sánh với chữ ký nhận được
 *   5. Nếu hợp lệ, phân tích mã phản hồi và số tiền
 *
 * Lưu ý quan trọng:
 *   - Luôn kiểm tra `isValid` TRƯỚC KHI xử lý đơn hàng.
 *   - Sau khi xác nhận hợp lệ, kiểm tra lại `amount` với số tiền trong đơn hàng.
 *   - Dùng `orderId` để tìm và cập nhật trạng thái đơn hàng trong database.
 *
 * Ví dụ sử dụng:
 * ```ts
 * const result = await verifyOnepayIpn(config, req.query as OnepayIpnData);
 * if (!result.isValid) {
 *   return res.status(400).json({ error: 'Chữ ký không hợp lệ' });
 * }
 * if (result.isSuccess) {
 *   await updateOrderStatus(result.orderId, 'PAID', result.transactionNo);
 * }
 * ```
 *
 * @param config   Cấu hình OnePay (bắt buộc có hashKey để xác thực)
 * @param ipnData  Tất cả tham số nhận được từ OnePay (query params hoặc POST body)
 * @returns        Kết quả xác thực và thông tin giao dịch
 */
export async function verifyOnepayIpn(
  config: OnepayConfig,
  ipnData: OnepayIpnData
): Promise<OnepayIpnResult> {
  // Bước 1: Lấy chữ ký từ dữ liệu OnePay gửi về
  const receivedHash = ipnData['vpc_SecureHash'];

  if (!receivedHash) {
    return {
      isValid:      false,
      isSuccess:    false,
      responseCode: '',
      amount:       0,
      orderId:      ipnData['vpc_MerchTxnRef'] ?? '',
      transactionNo: '',
      errorMessage: 'Thiếu chữ ký điện tử (vpc_SecureHash) trong dữ liệu trả về',
    };
  }

  // Bước 2: Tách các tham số dùng để tính lại chữ ký
  //         (loại bỏ vpc_SecureHash và vpc_SecureHashType)
  const paramsForHash: Record<string, string> = {};
  for (const [key, val] of Object.entries(ipnData)) {
    if (
      val !== undefined &&
      key !== 'vpc_SecureHash' &&
      key !== 'vpc_SecureHashType'
    ) {
      paramsForHash[key] = val;
    }
  }

  // Bước 3: Tái tạo chuỗi ký và tính HMAC-SHA256
  const hashData     = buildHashData(paramsForHash);
  const computedHash = await computeHmacSha256(config.hashKey, hashData);

  // Bước 4: So sánh chữ ký (không phân biệt chữ hoa/thường)
  const isValid = computedHash.toUpperCase() === receivedHash.toUpperCase();

  if (!isValid) {
    return {
      isValid:       false,
      isSuccess:     false,
      responseCode:  ipnData['vpc_TxnResponseCode'] ?? '',
      amount:        0,
      orderId:       ipnData['vpc_MerchTxnRef'] ?? '',
      transactionNo: ipnData['vpc_TransactionNo'] ?? '',
      errorMessage:  'Chữ ký điện tử không hợp lệ — dữ liệu có thể đã bị giả mạo',
    };
  }

  // Bước 5: Phân tích kết quả giao dịch
  const responseCode = ipnData['vpc_TxnResponseCode'] ?? '';
  const isSuccess    = responseCode === '0';

  // Số tiền OnePay gửi về đã được nhân 100 → chia 100 để lấy VNĐ thực
  const rawAmount = parseInt(ipnData['vpc_Amount'] ?? '0', 10);

  return {
    isValid:       true,
    isSuccess,
    responseCode,
    amount:        rawAmount / 100,           // Chuyển về đơn vị VNĐ
    orderId:       ipnData['vpc_MerchTxnRef'] ?? '',
    transactionNo: ipnData['vpc_TransactionNo'] ?? '',
    errorMessage:  isSuccess
      ? undefined
      : (RESPONSE_MESSAGES[responseCode] ?? `Lỗi không xác định (mã: ${responseCode})`),
  };
}

// ============================================================
// HÀM TIỆN ÍCH (Utility Functions)
// ============================================================

/**
 * Lấy thông báo tiếng Việt tương ứng với mã phản hồi của OnePay.
 *
 * @param responseCode Mã phản hồi từ vpc_TxnResponseCode
 * @returns            Chuỗi mô tả tiếng Việt
 */
export function getOnepayResponseMessage(responseCode: string): string {
  return RESPONSE_MESSAGES[responseCode] ?? `Mã lỗi không xác định: ${responseCode}`;
}

/**
 * Lấy URL endpoint của OnePay dựa trên cấu hình.
 *
 * @param config Phần cấu hình chứa gatewayType và environment
 * @returns      URL endpoint đầy đủ
 */
export function getOnepayEndpoint(
  config: Pick<OnepayConfig, 'gatewayType' | 'environment'>
): string {
  return ONEPAY_ENDPOINTS[config.gatewayType][config.environment];
}
