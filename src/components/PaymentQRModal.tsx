import React, { useState, useCallback, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Copy, CheckCircle, AlertTriangle, Info, Smartphone, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import { BANK_CONFIG, generateVietQrUrl, generateVietQrString } from '../constants/bankConfig';
import { Language, TRANSLATIONS } from '../App';

const PAYMENT_TIMEOUT_SECONDS = 30 * 60; // 30 minutes
const EXPIRED_AUTO_CLOSE_MS = 3000; // 3 seconds after expiry, auto-close

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
}

export const PaymentQRModal: React.FC<PaymentQRModalProps> = ({
  amount,
  paymentRef,
  language,
  onConfirm,
  onCancel,
  bookingLabel,
}) => {
  const t = TRANSLATIONS[language];
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(PAYMENT_TIMEOUT_SECONDS);
  const [expired, setExpired] = useState(false);

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
      const timer = setTimeout(onCancel, EXPIRED_AUTO_CLOSE_MS);
      return () => clearTimeout(timer);
    }
  }, [expired, onCancel]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timerIsUrgent = secondsLeft <= 300; // last 5 minutes

  const description = `${paymentRef}${bookingLabel ? ' ' + bookingLabel : ''}`;
  const qrImageUrl = generateVietQrUrl({ amount, description });
  const qrString = generateVietQrString({ amount, description });

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(paymentRef).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [paymentRef]);

  const handleConfirm = async () => {
    if (expired) return;
    setConfirming(true);
    // Small delay to simulate processing
    await new Promise(r => setTimeout(r, 600));
    onConfirm();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
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
                <Smartphone size={20} />
              </div>
              <div>
                <p className="font-bold text-lg leading-tight">
                  {expired
                    ? (t.qr_payment_expired_title || 'Hết thời gian thanh toán')
                    : (t.qr_payment_title || 'Thanh toán QR')}
                </p>
                <p className="text-blue-100 text-xs">
                  {t.qr_payment_subtitle || 'Quét mã QR để thanh toán'}
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
            {/* Demo mode banner */}
            {BANK_CONFIG.isDemoMode && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2.5 flex items-start gap-2">
                <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700 font-medium">
                  {t.qr_payment_demo_banner || '🧪 CHẾ ĐỘ THỬ — Thông tin ngân hàng là giả, KHÔNG chuyển tiền thật'}
                </p>
              </div>
            )}

            {/* Amount */}
            <div className="text-center">
              <p className="text-xs text-gray-400 uppercase font-bold tracking-widest mb-1">
                {t.qr_payment_amount || 'Số tiền'}
              </p>
              <p className="text-4xl font-extrabold text-blue-600">
                {amount.toLocaleString('vi-VN')}<span className="text-2xl ml-1">đ</span>
              </p>
            </div>

            {/* QR code */}
            <div className="flex flex-col items-center gap-2">
              <div className="p-4 bg-white border-2 border-blue-100 rounded-2xl shadow-sm relative">
                {/* Try VietQR image first, fallback to QRCodeSVG */}
                <img
                  src={qrImageUrl}
                  alt="VietQR payment code"
                  className="w-48 h-48 object-contain"
                  onError={(e) => {
                    // On error (network or API unavailable), hide the image
                    (e.target as HTMLImageElement).style.display = 'none';
                    const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'block';
                  }}
                />
                {/* SVG fallback — hidden by default, shown if img fails */}
                <div style={{ display: 'none' }}>
                  <QRCodeSVG
                    value={qrString}
                    size={192}
                    includeMargin={false}
                    level="M"
                  />
                </div>
              </div>
              <p className="text-[10px] text-gray-400 font-medium text-center">
                {t.qr_payment_instruction ||
                  'Mở app ngân hàng → Quét QR → Kiểm tra số tiền → Xác nhận'}
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
              {/* Payment reference */}
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
                    {copied
                      ? (t.qr_payment_copied || 'Đã sao chép!')
                      : (t.qr_payment_copy_ref || 'Sao chép')}
                  </button>
                </div>
              </div>
            </div>

            {/* Info note */}
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

            {/* Action buttons */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all"
              >
                {t.qr_payment_cancel || 'Huỷ'}
              </button>
              <motion.button
                type="button"
                onClick={handleConfirm}
                disabled={confirming || expired}
                whileTap={{ scale: 0.97 }}
                className={cn(
                  'flex-[2] py-3 rounded-xl font-bold text-sm text-white shadow-lg transition-all',
                  confirming
                    ? 'bg-green-400 shadow-green-200 cursor-not-allowed'
                    : 'bg-blue-600 shadow-blue-200 hover:bg-blue-700'
                )}
              >
                {confirming
                  ? (t.qr_payment_pending || 'Đang xử lý...')
                  : (t.qr_payment_confirm || 'Tôi đã thanh toán xong')}
              </motion.button>
            </div>
          </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

// ─── Agent Top-Up QR Modal ────────────────────────────────────────────────────

interface AgentTopUpQRModalProps {
  agentName: string;
  agentCode: string;
  language: Language;
  onClose: () => void;
}

export const AgentTopUpQRModal: React.FC<AgentTopUpQRModalProps> = ({
  agentName,
  agentCode,
  language,
  onClose,
}) => {
  const t = TRANSLATIONS[language];
  const [topUpAmount, setTopUpAmount] = useState<number>(0);
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);

  const paymentRef = `TOPUP${agentCode}`;
  const description = `NAP TIEN DAI LY ${agentCode}`;

  const qrImageUrl = showQr && topUpAmount > 0
    ? generateVietQrUrl({ amount: topUpAmount, description })
    : '';
  const qrString = showQr && topUpAmount > 0
    ? generateVietQrString({ amount: topUpAmount, description })
    : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(paymentRef).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-5 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 transition-colors"
          >
            <X size={16} />
          </button>
          <p className="font-bold text-lg">{t.agent_topup_title || 'Nạp tiền đại lý'}</p>
          <p className="text-orange-100 text-xs mt-0.5">{agentName} ({agentCode})</p>
        </div>

        {/* Demo mode banner */}
        {BANK_CONFIG.isDemoMode && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-start gap-2">
            <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 font-medium">
              {t.qr_payment_demo_banner || '🧪 CHẾ ĐỘ THỬ — Không chuyển tiền thật'}
            </p>
          </div>
        )}

        <div className="p-5 space-y-4">
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
              onChange={e => {
                setTopUpAmount(Number(e.target.value));
                setShowQr(false);
              }}
              placeholder="500000"
              className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30 font-mono"
            />
          </div>

          {/* Generate QR button */}
          {!showQr && (
            <button
              type="button"
              onClick={() => topUpAmount > 0 && setShowQr(true)}
              disabled={topUpAmount <= 0}
              className={cn(
                'w-full py-3 rounded-xl font-bold text-sm transition-all',
                topUpAmount > 0
                  ? 'bg-orange-500 text-white hover:bg-orange-600 shadow-lg shadow-orange-200'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              )}
            >
              {t.agent_topup_confirm || 'Tạo QR nạp tiền'}
            </button>
          )}

          {/* QR display */}
          {showQr && topUpAmount > 0 && (
            <>
              <div className="text-center">
                <p className="text-3xl font-extrabold text-orange-600">
                  {topUpAmount.toLocaleString('vi-VN')}đ
                </p>
              </div>
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

              {/* Bank info */}
              <div className="bg-gray-50 rounded-2xl p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400 text-xs font-bold uppercase">{t.qr_payment_bank || 'Ngân hàng'}</span>
                  <span className="font-bold text-gray-700">{BANK_CONFIG.bankName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-xs font-bold uppercase">{t.qr_payment_account || 'Số TK'}</span>
                  <span className="font-bold text-gray-700 font-mono">{BANK_CONFIG.accountNumber}</span>
                </div>
                <div className="pt-1 border-t border-gray-200 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-gray-400 text-xs font-bold uppercase">{t.qr_payment_ref || 'Nội dung CK'}</p>
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
                    {copied ? (t.qr_payment_copied || 'Đã sao chép!') : (t.qr_payment_copy_ref || 'Sao chép')}
                  </button>
                </div>
              </div>

              <p className="text-xs text-gray-500 text-center">
                {t.agent_topup_instruction || 'Sau khi chuyển khoản, số dư sẽ được cập nhật trong 5–15 phút làm việc.'}
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
