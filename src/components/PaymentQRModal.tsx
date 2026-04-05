import React, { useState, useCallback, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Copy, CheckCircle, AlertTriangle, Info, Smartphone, Clock, Zap, CreditCard, Building2, List } from 'lucide-react';
import { cn } from '../lib/utils';
import { BANK_CONFIG, generatePaymentQrUrl, generatePaymentQrString } from '../constants/bankConfig';
import { createOnepayPaymentUrl } from '../services/onepayService';
import { Language, TRANSLATIONS } from '../App';
import { transportService } from '../services/transportService';
import { PriceBreakdownItem } from '../hooks/usePayment';

const PAYMENT_TIMEOUT_SECONDS = 30 * 60; // 30 minutes
const EXPIRED_AUTO_CLOSE_MS = 3000; // 3 seconds after expiry, auto-close
const AUTO_CONFIRM_DELAY_MS = 1200; // brief visual feedback before auto-confirming from Firestore
const MANUAL_CONFIRM_DELAY_MS = 600; // simulated processing delay for manual confirm button
const CARD_PROCESSING_DELAY_MS = 2000; // simulated card processing delay

type PaymentTab = 'qr' | 'atm' | 'card';

const DOMESTIC_BANKS = [
  'Vietcombank (VCB)',
  'BIDV',
  'Agribank',
  'Techcombank',
  'MB Bank',
  'VPBank',
  'ACB',
  'SHB',
  'TPBank',
  'HDBank',
  'SeABank',
  'OCB',
  'ABBank (ABB)',
  'VietinBank',
  'Sacombank',
  'Eximbank',
  'MSB',
  'NamABank',
  'LienVietPostBank',
  'PVcomBank',
];

/** Format card number with spaces every 4 digits */
function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

/** Format expiry as MM/YY */
function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 3) return digits.slice(0, 2) + '/' + digits.slice(2);
  return digits;
}

/** Validate that expiry MM/YY is in the future */
function isExpiryValid(value: string): boolean {
  if (!value.match(/^\d{2}\/\d{2}$/)) return false;
  const [mm, yy] = value.split('/').map(Number);
  if (mm < 1 || mm > 12) return false;
  const now = new Date();
  const expYear = 2000 + yy;
  const expMonth = mm; // 1-based
  return expYear > now.getFullYear() || (expYear === now.getFullYear() && expMonth >= now.getMonth() + 1);
}

interface PaymentQRModalProps {
  /** Total amount to pay in VND */
  amount: number;
  /** Auto-generated payment reference (ticket code or similar) */
  paymentRef: string;
  /** Language setting */
  language: Language;
  /** Called when user confirms payment (booking continues) */
  onConfirm: () => void;
  /** Called when user cancels (booking is abandoned) */
  onCancel: () => void;
  /** Optional extra label shown on modal (e.g. customer name) */
  bookingLabel?: string;
  /** Optional price breakdown items for the "Xem chi tiết giá" modal */
  priceBreakdown?: PriceBreakdownItem[];
}

export const PaymentQRModal: React.FC<PaymentQRModalProps> = ({
  amount,
  paymentRef,
  language,
  onConfirm,
  onCancel,
  bookingLabel,
  priceBreakdown,
}) => {
  const t = TRANSLATIONS[language];
  const [activeTab, setActiveTab] = useState<PaymentTab>('qr');
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(PAYMENT_TIMEOUT_SECONDS);
  const [expired, setExpired] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  // Auto-payment detection state
  const [autoDetected, setAutoDetected] = useState(false);
  const [amountMismatch, setAmountMismatch] = useState(false);
  // Track whether we've already auto-opened the OnePay tab
  const [onepayTabOpened, setOnepayTabOpened] = useState(false);
  const openedOnepayRef = useRef(false);
  // Prevent duplicate auto-confirm calls
  const autoConfirmCalledRef = useRef(false);
  // Keep stable reference to onConfirm/onCancel for use inside subscriptions
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  // ── Domestic ATM card state ────────────────────────────────────────────────
  const [atmCardNumber, setAtmCardNumber] = useState('');
  const [atmExpiry, setAtmExpiry] = useState('');
  const [atmBank, setAtmBank] = useState('');
  const [atmError, setAtmError] = useState('');

  // ── International card (Visa/Master) state ────────────────────────────────
  const [intlCardNumber, setIntlCardNumber] = useState('');
  const [intlExpiry, setIntlExpiry] = useState('');
  const [intlCvv, setIntlCvv] = useState('');
  const [intlCardName, setIntlCardName] = useState('');
  const [intlError, setIntlError] = useState('');

  // 30-minute countdown timer
  useEffect(() => {
    const intervalId = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalId);
          setExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalId);
  }, []);

  // Auto-cancel after EXPIRED_AUTO_CLOSE_MS when timer expires
  useEffect(() => {
    if (expired) {
      const timer = setTimeout(() => onCancelRef.current(), EXPIRED_AUTO_CLOSE_MS);
      return () => clearTimeout(timer);
    }
  }, [expired]);

  // Subscribe to Firestore pendingPayments document for automatic payment detection
  useEffect(() => {
    const unsubscribe = transportService.subscribeToPendingPayment(paymentRef, (data) => {
      if (!data || autoConfirmCalledRef.current) return;

      if (data.status === 'PAID') {
        const paidAmt = data.paidAmount ?? 0;
        const paidContent = (data.paidContent ?? '').toUpperCase();
        const refUpper = paymentRef.toUpperCase();

        // Verify: amount must match AND content must include the payment reference
        const amountOk = paidAmt === amount;
        const contentOk = paidContent.includes(refUpper);

        if (amountOk && contentOk) {
          autoConfirmCalledRef.current = true;
          setAutoDetected(true);
          setConfirming(true);
          // Brief visual feedback then auto-confirm
          setTimeout(() => onConfirmRef.current(), AUTO_CONFIRM_DELAY_MS);
        } else {
          // Payment was registered but data doesn't match – show warning
          setAmountMismatch(true);
        }
      }
    });
    return unsubscribe;
  }, [paymentRef, amount]);

  // Load OnePay settings from Firestore and generate a properly-signed payment URL.
  // When onepayEnabled=true with valid credentials (merchant, accessCode, hashKey),
  // we use createOnepayPaymentUrl() which adds the required vpc_Access_Code,
  // vpc_SecureHash, and vpc_ReturnURL parameters that OnePay's gateway demands.
  // Without these the sandbox gateway rejects the request.
  const [onepayQrString, setOnepayQrString] = useState<string | null>(null);
  const [onepayEnabled, setOnepayEnabled] = useState(false);
  const [onepayEnvironment, setOnepayEnvironment] = useState<'sandbox' | 'production'>('sandbox');

  useEffect(() => {
    const unsubscribe = transportService.subscribeToPaymentSettings((saved) => {
      if (!saved || typeof saved !== 'object') return;
      const enabled = saved.onepayEnabled === true;
      const merchant = (saved.onepayMerchant as string) || '';
      const accessCode = (saved.onepayAccessCode as string) || '';
      const hashKey = (saved.onepayHashKey as string) || '';
      const environment = ((saved.onepayEnvironment as string) === 'production' ? 'production' : 'sandbox') as 'sandbox' | 'production';
      const gatewayType = ((saved.onepayGatewayType as string) === 'international' ? 'international' : 'domestic') as 'domestic' | 'international';
      const returnUrl = (saved.onepayReturnUrl as string) || window.location.origin;
      const ipnUrl = (saved.onepayIpnUrl as string) || '';

      setOnepayEnabled(enabled);
      setOnepayEnvironment(environment);

      // Only generate a signed URL when all required credentials are present
      if (enabled && merchant && accessCode && hashKey) {
        createOnepayPaymentUrl(
          { merchant, accessCode, hashKey, environment, gatewayType },
          {
            amount,
            orderId: paymentRef,
            orderInfo: paymentRef,
            // Browser apps cannot determine the external client IP without a server call.
            // '127.0.0.1' is the recommended placeholder per the onepayService docs.
            customerIp: '127.0.0.1',
            returnUrl,
            locale: 'vn',
            // Pass the IPN URL so OnePay knows where to deliver payment notifications.
            // Without this, the onepayIpn Cloud Function is never called.
            callbackUrl: ipnUrl || undefined,
          }
        )
          .then(url => {
            setOnepayQrString(url);
            // Auto-open OnePay payment page in a new tab on first URL load.
            // window.open() may return null if blocked by a popup blocker;
            // in that case we still set onepayTabOpened so the banner with the
            // manual re-open button is shown.
            if (!openedOnepayRef.current) {
              openedOnepayRef.current = true;
              window.open(url, '_blank', 'noopener,noreferrer');
              setOnepayTabOpened(true);
            }
          })
          .catch(err => {
            console.error('[PaymentQRModal] Failed to generate OnePay URL:', err);
            setOnepayQrString(null);
          });
      } else {
        setOnepayQrString(null);
      }
    });
    return unsubscribe;
  }, [paymentRef, amount]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timerIsUrgent = secondsLeft <= 60; // last 1 minute

  const description = `${paymentRef}${bookingLabel ? ' ' + bookingLabel : ''}`;
  // Use the properly-signed OnePay URL when available; fall back to the demo URL.
  const qrImageUrl = generatePaymentQrUrl({ amount, description });
  const qrString = onepayQrString ?? generatePaymentQrString({ amount, description });
  // Show demo banner only when OnePay is not configured/enabled
  const isDemo = !onepayEnabled || BANK_CONFIG.isDemoMode;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(paymentRef).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [paymentRef]);

  const handleConfirm = async () => {
    if (expired || autoConfirmCalledRef.current) return;
    autoConfirmCalledRef.current = true;
    setConfirming(true);
    // Small delay to simulate processing
    await new Promise(r => setTimeout(r, MANUAL_CONFIRM_DELAY_MS));
    onConfirmRef.current();
  };

  const handleAtmPay = async () => {
    setAtmError('');
    const rawNumber = atmCardNumber.replace(/\s/g, '');
    if (rawNumber.length < 13 || rawNumber.length > 19) {
      setAtmError(language === 'vi' ? 'Số thẻ không hợp lệ.' : 'Invalid card number.');
      return;
    }
    if (!isExpiryValid(atmExpiry)) {
      setAtmError(language === 'vi' ? 'Ngày hết hạn không hợp lệ hoặc đã hết hạn.' : 'Invalid or expired expiry date.');
      return;
    }
    if (!atmBank) {
      setAtmError(language === 'vi' ? 'Vui lòng chọn ngân hàng.' : 'Please select a bank.');
      return;
    }
    if (autoConfirmCalledRef.current) return;
    autoConfirmCalledRef.current = true;
    setConfirming(true);
    await new Promise(r => setTimeout(r, CARD_PROCESSING_DELAY_MS));
    onConfirmRef.current();
  };

  const handleIntlPay = async () => {
    setIntlError('');
    const rawNumber = intlCardNumber.replace(/\s/g, '');
    if (rawNumber.length < 13 || rawNumber.length > 19) {
      setIntlError(language === 'vi' ? 'Số thẻ không hợp lệ.' : 'Invalid card number.');
      return;
    }
    if (!isExpiryValid(intlExpiry)) {
      setIntlError(language === 'vi' ? 'Ngày hết hạn không hợp lệ hoặc đã hết hạn.' : 'Invalid or expired expiry date.');
      return;
    }
    if (intlCvv.length < 3) {
      setIntlError(language === 'vi' ? 'Mã CVV không hợp lệ.' : 'Invalid CVV code.');
      return;
    }
    if (!intlCardName.trim()) {
      setIntlError(language === 'vi' ? 'Vui lòng nhập tên chủ thẻ.' : 'Please enter cardholder name.');
      return;
    }
    if (autoConfirmCalledRef.current) return;
    autoConfirmCalledRef.current = true;
    setConfirming(true);
    await new Promise(r => setTimeout(r, CARD_PROCESSING_DELAY_MS));
    onConfirmRef.current();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className={cn("p-5 text-white relative", expired ? "bg-gradient-to-r from-red-600 to-red-700" : "bg-gradient-to-r from-blue-600 to-blue-700")}>
            <button
              onClick={onCancel}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 transition-colors"
            >
              <X size={16} />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                {activeTab === 'qr' ? <Smartphone size={20} /> : <CreditCard size={20} />}
              </div>
              <div>
                <p className="font-bold text-lg leading-tight">
                  {expired
                    ? (t.qr_payment_expired_title || 'Hết thời gian thanh toán')
                    : (language === 'vi' ? 'Thanh toán' : language === 'ja' ? '支払い' : 'Payment')}
                </p>
                <p className="text-blue-100 text-xs">
                  {language === 'vi' ? 'Chọn phương thức thanh toán' : language === 'ja' ? '支払い方法を選択' : 'Select payment method'}
                </p>
              </div>
            </div>
            {/* Countdown timer */}
            <div className={cn(
              "mt-3 flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold w-fit",
              expired ? "bg-red-500/40 text-white" : timerIsUrgent ? "bg-orange-400/40 text-orange-100" : "bg-white/20 text-white"
            )}>
              <Clock size={12} />
              <span>
                {expired
                  ? (t.qr_payment_expired_title || 'Hết thời gian')
                  : `${t.qr_payment_timer_label || 'Còn lại'}: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`}
              </span>
            </div>
          </div>

          {/* Expired overlay */}
          {expired && (
            <div className="p-5 text-center space-y-3">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <Clock size={32} className="text-red-500" />
              </div>
              <p className="font-bold text-gray-800 text-lg">{t.qr_payment_expired_title || 'Hết thời gian thanh toán'}</p>
              <p className="text-sm text-gray-500">{t.qr_payment_expired_msg || 'Phiên đặt chỗ đã hết hạn. Chỗ ngồi được trả về để người khác đặt.'}</p>
              <p className="text-xs text-gray-400">{language === 'vi' ? 'Tự động đóng...' : language === 'ja' ? '自動クローズ中...' : 'Closing automatically...'}</p>
            </div>
          )}

          {!expired && (
          <div className="p-5 space-y-4">
            {/* Payment method tabs */}
            <div className="flex gap-1 p-1 bg-gray-100 rounded-2xl">
              <button
                type="button"
                onClick={() => setActiveTab('qr')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all',
                  activeTab === 'qr'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                <Smartphone size={13} />
                {language === 'vi' ? 'QR / CK' : 'QR'}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('atm')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all',
                  activeTab === 'atm'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                <Building2 size={13} />
                {language === 'vi' ? 'ATM nội địa' : 'ATM'}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('card')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all',
                  activeTab === 'card'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                <CreditCard size={13} />
                Visa / Master
              </button>
            </div>

            {/* Amount */}
            <div className="text-center">
              <p className="text-xs text-gray-400 uppercase font-bold tracking-widest mb-1">
                {t.qr_payment_amount || 'Số tiền cần thanh toán'}
              </p>
              <p className="text-4xl font-extrabold text-blue-600">
                {amount.toLocaleString('vi-VN')}<span className="text-2xl ml-1">đ</span>
              </p>
              {priceBreakdown && priceBreakdown.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowBreakdown(true)}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-700 font-semibold transition-colors"
                >
                  <List size={13} />
                  {language === 'vi' ? 'Xem chi tiết giá' : language === 'ja' ? '料金明細を見る' : 'View price details'}
                </button>
              )}
            </div>

            {/* ── QR Tab ── */}
            {activeTab === 'qr' && (
              <>
                {/* Demo mode banner — shown when OnePay is not fully configured */}
                {isDemo && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2.5 flex items-start gap-2">
                    <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700 font-medium">
                      {t.qr_payment_demo_banner || '🧪 CHẾ ĐỘ THỬ — Thông tin ngân hàng là giả, KHÔNG chuyển tiền thật'}
                    </p>
                  </div>
                )}
                {/* Sandbox mode banner */}
                {!isDemo && onepayEnvironment === 'sandbox' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-2.5 flex items-start gap-2">
                    <Info size={14} className="text-blue-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-blue-700 font-medium">
                      {language === 'vi'
                        ? '🔬 MÔI TRƯỜNG THỬ NGHIỆM (Sandbox) — Dùng thẻ test OnePay, KHÔNG dùng thẻ thật'
                        : '🔬 SANDBOX ENVIRONMENT — Use OnePay test cards only, NOT real cards'}
                    </p>
                  </div>
                )}

                {/* Payment URL — only shown in test/sandbox/demo mode, hidden in production */}
                {(isDemo || onepayEnvironment === 'sandbox') && qrString && (
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5">
                    <p className="text-xs text-gray-500 font-medium mb-1">
                      {language === 'vi' ? '🔗 URL thanh toán (chỉ hiện khi thử nghiệm)' : '🔗 Payment URL (test only)'}
                    </p>
                    <a
                      href={qrString}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 break-all hover:underline"
                    >
                      {qrString}
                    </a>
                  </div>
                )}

                {/* OnePay tab opened banner */}
                {onepayTabOpened && !autoDetected && (
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 flex items-start gap-3">
                    <Zap size={16} className="text-blue-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-blue-700 font-bold">
                        {language === 'vi'
                          ? '🔗 Trang thanh toán OnePay đã mở trong tab mới'
                          : language === 'ja'
                          ? '🔗 OnePay支払いページが新しいタブで開きました'
                          : '🔗 OnePay payment page opened in a new tab'}
                      </p>
                      <p className="text-xs text-blue-500 mt-0.5">
                        {language === 'vi'
                          ? 'Hoàn tất thanh toán trên trang OnePay, sau đó quay lại đây để nhận vé.'
                          : language === 'ja'
                          ? 'OnePay ページで支払いを完了し、チケットを受け取るためにここに戻ってください。'
                          : 'Complete payment on the OnePay page, then return here to receive your ticket.'}
                      </p>
                      {onepayQrString && (
                        <button
                          type="button"
                          onClick={() => window.open(onepayQrString, '_blank', 'noopener,noreferrer')}
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors"
                        >
                          {language === 'vi' ? '↗ Mở lại trang thanh toán' : language === 'ja' ? '↗ 支払いページを再度開く' : '↗ Re-open payment page'}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Auto-detected success */}
                {autoDetected && (
                  <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-center gap-3">
                    <Zap size={18} className="text-green-600 shrink-0" />
                    <p className="text-sm text-green-700 font-bold">
                      {language === 'vi'
                        ? '✅ Đã nhận thanh toán! Đang xác nhận đơn hàng...'
                        : language === 'ja'
                        ? '✅ 支払いを受領しました！注文を確認中...'
                        : '✅ Payment received! Confirming your order...'}
                    </p>
                  </div>
                )}

                {/* Amount mismatch warning */}
                {amountMismatch && !autoDetected && (
                  <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-start gap-2">
                    <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-700 font-medium">
                      {language === 'vi'
                        ? '⚠️ Số tiền hoặc nội dung chuyển khoản không khớp. Vui lòng kiểm tra lại.'
                        : language === 'ja'
                        ? '⚠️ 金額または振込内容が一致しません。ご確認ください。'
                        : '⚠️ Payment amount or content does not match. Please check again.'}
                    </p>
                  </div>
                )}

                {/* QR code */}
                <div className="flex flex-col items-center gap-2">
                  <div className="p-4 bg-white border-2 border-blue-100 rounded-2xl shadow-sm relative">
                    <img
                      src={qrImageUrl}
                      alt="OnePay payment QR code"
                      className="w-48 h-48 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'block';
                      }}
                    />
                    <div style={{ display: 'none' }}>
                      <QRCodeSVG value={qrString} size={192} includeMargin={false} level="M" />
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 font-medium text-center">
                    {t.qr_payment_instruction || 'Mở app ngân hàng → Quét QR → Kiểm tra số tiền → Xác nhận'}
                  </p>
                </div>

                {/* Bank info */}
                <div className="bg-gray-50 rounded-2xl p-3 space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400 text-xs font-bold uppercase">{t.qr_payment_bank || 'Ngân hàng'}</span>
                    <span className="font-bold text-gray-700">{BANK_CONFIG.bankName}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400 text-xs font-bold uppercase">{t.qr_payment_account || 'Số TK'}</span>
                    <span className="font-bold text-gray-700 font-mono">{BANK_CONFIG.accountNumber}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400 text-xs font-bold uppercase">{t.qr_payment_account_name || 'Chủ TK'}</span>
                    <span className="font-bold text-gray-700 text-right max-w-[60%]">{BANK_CONFIG.accountName}</span>
                  </div>
                  <div className="pt-1 border-t border-gray-200">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-gray-400 text-xs font-bold uppercase">{t.qr_payment_ref || 'Nội dung CK'}</p>
                        <p className="font-bold text-blue-700 text-sm font-mono">{paymentRef}</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopy}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                          copied
                            ? 'bg-green-100 text-green-700'
                            : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                        )}
                      >
                        {copied ? <CheckCircle size={13} /> : <Copy size={13} />}
                        {copied ? (t.qr_payment_copied || 'Đã sao chép!') : (t.qr_payment_copy_ref || 'Sao chép')}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2 text-xs text-gray-500">
                  <Info size={13} className="shrink-0 mt-0.5 text-blue-400" />
                  <span>
                    {language === 'vi'
                      ? 'Nhập đúng nội dung chuyển khoản để vé được xác nhận tự động.'
                      : language === 'ja'
                      ? '自動確認のため、振込内容を正確に入力してください。'
                      : 'Enter the exact payment reference for automatic ticket confirmation.'}
                  </span>
                </div>

                {/* QR action buttons */}
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={onCancel}
                    disabled={confirming}
                    className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t.qr_payment_cancel || 'Huỷ'}
                  </button>
                  <motion.button
                    type="button"
                    onClick={handleConfirm}
                    disabled={confirming || expired || autoDetected}
                    whileTap={{ scale: 0.97 }}
                    className={cn(
                      'flex-[2] py-3 rounded-xl font-bold text-sm text-white shadow-lg transition-all',
                      (confirming || autoDetected)
                        ? 'bg-green-400 shadow-green-200 cursor-not-allowed'
                        : 'bg-blue-600 shadow-blue-200 hover:bg-blue-700'
                    )}
                  >
                    {autoDetected
                      ? (language === 'vi' ? 'Đang xác nhận...' : 'Confirming...')
                      : confirming
                      ? (t.qr_payment_pending || 'Đang xử lý...')
                      : (t.qr_payment_confirm || 'Tôi đã thanh toán xong')}
                  </motion.button>
                </div>
              </>
            )}

            {/* ── ATM Nội địa Tab ── */}
            {activeTab === 'atm' && (
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 flex items-start gap-2">
                  <Info size={14} className="text-blue-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-blue-700 font-medium">
                    {language === 'vi'
                      ? 'Thanh toán bằng thẻ ATM nội địa (VCB, ABBank, BIDV, Techcombank...)'
                      : 'Pay with domestic ATM card (VCB, ABBank, BIDV, Techcombank...)'}
                  </p>
                </div>

                {/* Bank select */}
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">
                    {language === 'vi' ? 'Ngân hàng phát hành thẻ' : 'Issuing bank'}
                  </label>
                  <select
                    value={atmBank}
                    onChange={e => setAtmBank(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30"
                  >
                    <option value="">{language === 'vi' ? '-- Chọn ngân hàng --' : '-- Select bank --'}</option>
                    {DOMESTIC_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>

                {/* Card number */}
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">
                    {language === 'vi' ? 'Số thẻ ATM' : 'ATM card number'}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={atmCardNumber}
                    onChange={e => setAtmCardNumber(formatCardNumber(e.target.value))}
                    placeholder="0000 0000 0000 0000"
                    maxLength={19}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400/30"
                  />
                </div>

                {/* Expiry */}
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">
                    {language === 'vi' ? 'Ngày hết hạn' : 'Expiry date'} (MM/YY)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={atmExpiry}
                    onChange={e => setAtmExpiry(formatExpiry(e.target.value))}
                    placeholder="MM/YY"
                    maxLength={5}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400/30"
                  />
                </div>

                {atmError && (
                  <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                    <AlertTriangle size={12} /> {atmError}
                  </p>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={onCancel}
                    disabled={confirming}
                    className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {language === 'vi' ? 'Huỷ' : 'Cancel'}
                  </button>
                  <motion.button
                    type="button"
                    onClick={handleAtmPay}
                    disabled={confirming}
                    whileTap={{ scale: 0.97 }}
                    className={cn(
                      'flex-[2] py-3 rounded-xl font-bold text-sm text-white shadow-lg transition-all',
                      confirming
                        ? 'bg-green-400 shadow-green-200 cursor-not-allowed'
                        : 'bg-blue-600 shadow-blue-200 hover:bg-blue-700'
                    )}
                  >
                    {confirming
                      ? (language === 'vi' ? 'Đang xử lý...' : 'Processing...')
                      : (language === 'vi' ? '💳 Thanh toán ngay' : '💳 Pay Now')}
                  </motion.button>
                </div>
              </div>
            )}

            {/* ── Visa / Mastercard Tab ── */}
            {activeTab === 'card' && (
              <div className="space-y-3">
                <div className="bg-purple-50 border border-purple-100 rounded-2xl px-4 py-3 flex items-start gap-2">
                  <CreditCard size={14} className="text-purple-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-purple-700 font-medium">
                    {language === 'vi'
                      ? 'Thanh toán bằng thẻ quốc tế Visa hoặc Mastercard'
                      : 'Pay with international Visa or Mastercard'}
                  </p>
                </div>

                {/* Card number */}
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">
                    {language === 'vi' ? 'Số thẻ' : 'Card number'}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={intlCardNumber}
                    onChange={e => setIntlCardNumber(formatCardNumber(e.target.value))}
                    placeholder="0000 0000 0000 0000"
                    maxLength={19}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-400/30"
                  />
                </div>

                {/* Cardholder name */}
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">
                    {language === 'vi' ? 'Tên chủ thẻ' : 'Cardholder name'}
                  </label>
                  <input
                    type="text"
                    value={intlCardName}
                    onChange={e => setIntlCardName(e.target.value.toUpperCase())}
                    placeholder={language === 'vi' ? 'NGUYEN VAN A' : 'JOHN DOE'}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-purple-400/30"
                  />
                </div>

                {/* Expiry + CVV */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">
                      {language === 'vi' ? 'Hết hạn' : 'Expiry'} (MM/YY)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={intlExpiry}
                      onChange={e => setIntlExpiry(formatExpiry(e.target.value))}
                      placeholder="MM/YY"
                      maxLength={5}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-400/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">
                      CVV / CVC
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      value={intlCvv}
                      onChange={e => setIntlCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="•••"
                      maxLength={4}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-400/30"
                    />
                  </div>
                </div>

                {intlError && (
                  <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                    <AlertTriangle size={12} /> {intlError}
                  </p>
                )}

                <p className="text-[10px] text-gray-400 flex items-center gap-1">
                  <Info size={11} className="shrink-0" />
                  {language === 'vi'
                    ? 'Thông tin thẻ được mã hoá an toàn. Chúng tôi không lưu trữ dữ liệu thẻ của bạn.'
                    : 'Card details are securely encrypted. We do not store your card data.'}
                </p>

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={onCancel}
                    disabled={confirming}
                    className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {language === 'vi' ? 'Huỷ' : 'Cancel'}
                  </button>
                  <motion.button
                    type="button"
                    onClick={handleIntlPay}
                    disabled={confirming}
                    whileTap={{ scale: 0.97 }}
                    className={cn(
                      'flex-[2] py-3 rounded-xl font-bold text-sm text-white shadow-lg transition-all',
                      confirming
                        ? 'bg-green-400 shadow-green-200 cursor-not-allowed'
                        : 'bg-purple-600 shadow-purple-200 hover:bg-purple-700'
                    )}
                  >
                    {confirming
                      ? (language === 'vi' ? 'Đang xử lý...' : 'Processing...')
                      : (language === 'vi' ? '💳 Thanh toán ngay' : '💳 Pay Now')}
                  </motion.button>
                </div>
              </div>
            )}
          </div>
          )}
        </motion.div>
      </div>

      {/* Price breakdown detail modal */}
      {showBreakdown && priceBreakdown && priceBreakdown.length > 0 && (
        <div className="fixed inset-0 z-[350] flex items-center justify-center bg-black/60 p-4" onClick={() => setShowBreakdown(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
              <h3 className="font-bold text-gray-800 text-sm">
                {t.trip_confirm_price_title || 'Chi tiết giá vé'}
              </h3>
              <button
                type="button"
                onClick={() => setShowBreakdown(false)}
                className="w-7 h-7 flex items-center justify-center rounded-xl bg-gray-200 hover:bg-gray-300 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <div className="p-4 space-y-2">
              {priceBreakdown.map((item, idx) => (
                item.isTotal ? (
                  <div key={idx} className="flex items-center justify-between px-3 py-2.5 bg-blue-50 rounded-xl border border-blue-100 mt-2">
                    <span className="font-bold text-gray-800 text-sm">{item.label}</span>
                    <span className="text-lg font-extrabold text-blue-600">{item.amount.toLocaleString('vi-VN')}đ</span>
                  </div>
                ) : item.isSection ? (
                  <div key={idx} className="flex items-center justify-between py-1.5 border-b border-gray-100">
                    <span className="font-semibold text-gray-700 text-sm">{item.label}</span>
                    <span className="font-bold text-gray-800 text-sm">{item.amount.toLocaleString('vi-VN')}đ</span>
                  </div>
                ) : (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">{item.label}</span>
                    {item.isFree
                      ? <span className="text-green-600 font-semibold">{language === 'vi' ? 'Miễn phí' : 'Free'}</span>
                      : <span className="font-semibold text-gray-700">+{item.amount.toLocaleString('vi-VN')}đ</span>
                    }
                  </div>
                )
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// ─── Agent Top-Up QR Modal ────────────────────────────────────────────────────

const TOPUP_AUTO_CLOSE_MS = 2500;

interface AgentTopUpQRModalProps {
  agentName: string;
  agentCode: string;
  agentId: string;
  language: Language;
  onClose: () => void;
  onTopUpSuccess?: () => void;
}

export const AgentTopUpQRModal: React.FC<AgentTopUpQRModalProps> = ({
  agentName,
  agentCode,
  agentId,
  language,
  onClose,
  onTopUpSuccess,
}) => {
  const t = TRANSLATIONS[language];
  const [topUpAmount, setTopUpAmount] = useState<number>(0);
  const [paymentInitiated, setPaymentInitiated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [onepayQrString, setOnepayQrString] = useState<string | null>(null);
  const [onepayEnabled, setOnepayEnabled] = useState(false);
  const [onepayTabOpened, setOnepayTabOpened] = useState(false);
  const [autoDetected, setAutoDetected] = useState(false);
  const [topUpSuccess, setTopUpSuccess] = useState(false);
  const openedOnepayRef = useRef(false);
  const autoConfirmCalledRef = useRef(false);
  const onTopUpSuccessRef = useRef(onTopUpSuccess);
  onTopUpSuccessRef.current = onTopUpSuccess;

  const paymentRef = `TOPUP${agentCode}`;
  const description = `NAP TIEN DAI LY ${agentCode}`;

  // Load OnePay settings and build signed payment URL
  useEffect(() => {
    if (!paymentInitiated || topUpAmount <= 0) return;
    const unsubscribe = transportService.subscribeToPaymentSettings((saved) => {
      if (!saved || typeof saved !== 'object') return;
      const enabled = saved.onepayEnabled === true;
      const merchant = (saved.onepayMerchant as string) || '';
      const accessCode = (saved.onepayAccessCode as string) || '';
      const hashKey = (saved.onepayHashKey as string) || '';
      const environment = ((saved.onepayEnvironment as string) === 'production' ? 'production' : 'sandbox') as 'sandbox' | 'production';
      const gatewayType = ((saved.onepayGatewayType as string) === 'international' ? 'international' : 'domestic') as 'domestic' | 'international';
      const returnUrl = (saved.onepayReturnUrl as string) || window.location.origin;
      const ipnUrl = (saved.onepayIpnUrl as string) || '';

      setOnepayEnabled(enabled);

      if (enabled && merchant && accessCode && hashKey) {
        createOnepayPaymentUrl(
          { merchant, accessCode, hashKey, environment, gatewayType },
          {
            amount: topUpAmount,
            orderId: paymentRef,
            orderInfo: description,
            customerIp: '127.0.0.1',
            returnUrl,
            locale: 'vn',
            callbackUrl: ipnUrl || undefined,
          }
        )
          .then(url => {
            setOnepayQrString(url);
            if (!openedOnepayRef.current) {
              openedOnepayRef.current = true;
              window.open(url, '_blank', 'noopener,noreferrer');
              setOnepayTabOpened(true);
            }
          })
          .catch(err => console.error('[AgentTopUpQRModal] Failed to generate OnePay URL:', err));
      }
    });
    return unsubscribe;
  }, [paymentInitiated, topUpAmount, paymentRef, description]);

  // Subscribe to pending payment status – auto-complete when PAID
  useEffect(() => {
    if (!paymentInitiated) return;
    let autoCloseTimer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = transportService.subscribeToPendingPayment(paymentRef, (data) => {
      if (!data || autoConfirmCalledRef.current) return;
      if (data.status === 'PAID') {
        const paidAmt = data.paidAmount ?? 0;
        const paidContent = (data.paidContent ?? '').toUpperCase();
        const refUpper = paymentRef.toUpperCase();
        if (paidAmt === topUpAmount && paidContent.includes(refUpper)) {
          autoConfirmCalledRef.current = true;
          setAutoDetected(true);
          setTopUpSuccess(true);
          autoCloseTimer = setTimeout(() => {
            onTopUpSuccessRef.current?.();
            onClose();
          }, TOPUP_AUTO_CLOSE_MS);
        }
      }
    });
    return () => {
      unsubscribe();
      clearTimeout(autoCloseTimer);
    };
  }, [paymentInitiated, paymentRef, topUpAmount, onClose]);

  const handleInitiatePayment = async () => {
    if (topUpAmount <= 0) return;
    try {
      await transportService.createPendingPayment({
        paymentRef,
        expectedAmount: topUpAmount,
        customerName: agentName,
        routeInfo: `Nạp tiền đại lý ${agentCode}`,
      });
    } catch (err) {
      console.error('[AgentTopUpQRModal] createPendingPayment error:', err);
    }
    openedOnepayRef.current = false;
    autoConfirmCalledRef.current = false;
    setPaymentInitiated(true);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(paymentRef).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const qrImageUrl = generatePaymentQrUrl({ amount: topUpAmount, description });
  const qrString = onepayQrString ?? generatePaymentQrString({ amount: topUpAmount, description });
  const isDemo = !onepayEnabled || BANK_CONFIG.isDemoMode;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-5 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 transition-colors"
          >
            <X size={16} />
          </button>
          <p className="font-bold text-lg">{t.agent_topup_title || 'Nạp tiền vào tài khoản đại lý'}</p>
          <p className="text-orange-100 text-xs mt-0.5">"{agentName}" ({agentCode})</p>
        </div>

        {/* Demo mode banner */}
        {isDemo && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-start gap-2">
            <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 font-medium">
              {t.qr_payment_demo_banner || '🧪 CHẾ ĐỘ THỬ NGHIỆM — Thông tin là giả, KHÔNG thực hiện thanh toán thật'}
            </p>
          </div>
        )}

        <div className="p-5 space-y-4">
          {/* Success state */}
          {topUpSuccess ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle size={48} className="text-green-500" />
              <p className="text-lg font-bold text-green-700">
                {language === 'vi' ? 'Nạp tiền thành công!' : 'Top-up successful!'}
              </p>
              <p className="text-sm text-gray-500 text-center">
                {language === 'vi'
                  ? `+${topUpAmount.toLocaleString('vi-VN')}đ đã được cộng vào số dư.`
                  : `+${topUpAmount.toLocaleString('vi-VN')}đ added to balance.`}
              </p>
            </div>
          ) : !paymentInitiated ? (
            <>
              {/* Amount input */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                  {t.agent_topup_amount || 'Số tiền muốn nạp'}
                </label>
                <input
                  type="number"
                  min={0}
                  step={100000}
                  value={topUpAmount || ''}
                  onChange={e => setTopUpAmount(Number(e.target.value))}
                  placeholder="500000"
                  className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30 font-mono"
                />
              </div>

              {topUpAmount > 0 && (
                <p className="text-3xl font-extrabold text-orange-600 text-center">
                  {topUpAmount.toLocaleString('vi-VN')}đ
                </p>
              )}

              <button
                type="button"
                onClick={handleInitiatePayment}
                disabled={topUpAmount <= 0}
                className={cn(
                  'w-full py-3 rounded-xl font-bold text-sm transition-all',
                  topUpAmount > 0
                    ? 'bg-orange-500 text-white hover:bg-orange-600 shadow-lg shadow-orange-200'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                )}
              >
                {t.agent_topup_confirm || 'Thanh toán qua OnePay'}
              </button>
            </>
          ) : (
            <>
              <div className="text-center">
                <p className="text-3xl font-extrabold text-orange-600">
                  {topUpAmount.toLocaleString('vi-VN')}đ
                </p>
              </div>

              {/* OnePay tab opened banner */}
              {onepayTabOpened && onepayQrString && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 flex items-start gap-2">
                  <Smartphone size={16} className="text-blue-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-blue-700 font-semibold">
                      {language === 'vi' ? 'Đã mở trang thanh toán OnePay' : 'OnePay payment page opened'}
                    </p>
                    <button
                      type="button"
                      onClick={() => window.open(onepayQrString, '_blank', 'noopener,noreferrer')}
                      className="text-xs text-blue-600 underline mt-0.5"
                    >
                      {language === 'vi' ? 'Mở lại trang thanh toán' : 'Re-open payment page'}
                    </button>
                  </div>
                </div>
              )}

              {/* Auto-detected banner */}
              {autoDetected && (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-3 flex items-center gap-2">
                  <Zap size={16} className="text-green-500 shrink-0" />
                  <p className="text-xs text-green-700 font-semibold">
                    {language === 'vi' ? 'Phát hiện thanh toán thành công!' : 'Payment detected!'}
                  </p>
                </div>
              )}

              {/* QR code fallback */}
              <div className="flex flex-col items-center gap-2">
                <div className="p-4 bg-white border-2 border-orange-100 rounded-2xl shadow-sm">
                  <img
                    src={qrImageUrl}
                    alt="Agent top-up QR code"
                    className="w-48 h-48 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'block';
                    }}
                  />
                  <div style={{ display: 'none' }}>
                    <QRCodeSVG value={qrString} size={192} includeMargin={false} level="M" />
                  </div>
                </div>
              </div>

              {/* Payment info */}
              <div className="bg-gray-50 rounded-2xl p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400 text-xs font-bold uppercase">{language === 'vi' ? 'Cổng thanh toán' : 'Payment gateway'}</span>
                  <span className="font-bold text-gray-700">OnePay</span>
                </div>
                <div className="pt-1 border-t border-gray-200 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-gray-400 text-xs font-bold uppercase">{t.qr_payment_ref || 'Mã giao dịch'}</p>
                    <p className="font-bold text-orange-700 font-mono text-sm">{paymentRef}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                      copied ? 'bg-green-100 text-green-700' : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
                    )}
                  >
                    {copied ? <CheckCircle size={13} /> : <Copy size={13} />}
                    {copied ? (t.qr_payment_copied || 'Đã sao chép!') : (t.qr_payment_copy_ref || 'Sao chép mã giao dịch')}
                  </button>
                </div>
              </div>

              <p className="text-xs text-gray-500 text-center">
                {t.agent_topup_instruction || 'Sau khi thanh toán xong, số dư sẽ được cập nhật tự động.'}
              </p>
            </>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all"
          >
            {language === 'vi' ? 'Đóng' : language === 'ja' ? '閉じる' : 'Close'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
