import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, ScanQrCode, X, Loader2, AlertCircle, User, Phone, MapPin, Calendar, Clock, Bus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { transportService } from '../services/transportService';
import { TRANSLATIONS, Language } from '../App';
import { formatBookingDate } from '../lib/vnDate';

interface KioskPageProps {
  language: Language;
  trips: any[];
}

type KioskState = 'scanning' | 'loading' | 'found' | 'already_checked_in' | 'not_found' | 'success' | 'error';

const RESET_DELAY_MS = 5000; // auto-reset after check-in success/error

export const KioskPage: React.FC<KioskPageProps> = ({ language, trips }) => {
  const t = TRANSLATIONS[language];
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastScannedRef = useRef<string>('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detectorRef = useRef<any>(null);

  const [state, setState] = useState<KioskState>('scanning');
  const [booking, setBooking] = useState<any>(null);
  const [trip, setTrip] = useState<any>(null);
  const [manualCode, setManualCode] = useState('');
  const [cameraSupported, setCameraSupported] = useState(true);
  const [barcodeSupported, setBarcodeSupported] = useState(true);

  // Initialise BarcodeDetector and camera
  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      // Check BarcodeDetector support
      if (!('BarcodeDetector' in window)) {
        setBarcodeSupported(false);
      } else {
        try {
          detectorRef.current = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        } catch {
          setBarcodeSupported(false);
        }
      }

      // Start camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } catch {
        setCameraSupported(false);
      }
    };

    start();

    return () => {
      cancelled = true;
      stopCamera();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  // QR scan loop
  const scanFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !detectorRef.current) {
      animFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    const video = videoRef.current;
    if (video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);

    try {
      const barcodes = await detectorRef.current.detect(canvas);
      for (const barcode of barcodes) {
        const value = barcode.rawValue?.trim();
        if (value && value !== lastScannedRef.current) {
          lastScannedRef.current = value;
          handleCodeDetected(value);
          return; // pause loop while processing
        }
      }
    } catch {
      // ignore detection errors
    }
    animFrameRef.current = requestAnimationFrame(scanFrame);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start scan loop when in scanning state and barcodeDetector is ready
  useEffect(() => {
    if (state !== 'scanning' || !barcodeSupported) return;
    animFrameRef.current = requestAnimationFrame(scanFrame);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [state, barcodeSupported, scanFrame]);

  const handleCodeDetected = async (code: string) => {
    setState('loading');
    try {
      const found = await transportService.getBookingByTicketCode(code);
      if (!found) {
        setState('not_found');
        scheduleReset();
        return;
      }
      setBooking(found);
      // Find matching trip
      const matchedTrip = trips.find(t => t.id === (found.tripId || found.trip_id));
      setTrip(matchedTrip || null);
      if (found.isCheckedIn || found.is_checked_in) {
        setState('already_checked_in');
      } else {
        setState('found');
      }
    } catch {
      setState('error');
      scheduleReset();
    }
  };

  const scheduleReset = () => {
    setTimeout(() => {
      setBooking(null);
      setTrip(null);
      setManualCode('');
      lastScannedRef.current = '';
      setState('scanning');
    }, RESET_DELAY_MS);
  };

  const handleCheckIn = async () => {
    if (!booking) return;
    setState('loading');
    try {
      await transportService.checkInBooking(booking.id);
      setState('success');
      scheduleReset();
    } catch {
      setState('error');
      scheduleReset();
    }
  };

  const handleManualSearch = async () => {
    const code = manualCode.trim();
    if (!code) return;
    lastScannedRef.current = code;
    handleCodeDetected(code);
  };

  const handleReset = () => {
    setBooking(null);
    setTrip(null);
    setManualCode('');
    lastScannedRef.current = '';
    setState('scanning');
  };

  const isVi = language === 'vi';

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-daiichi-red/20 via-gray-950 to-gray-900" />

      <div className="relative z-10 w-full max-w-lg flex flex-col items-center gap-6">
        {/* Logo & Title */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <ScanQrCode size={36} className="text-daiichi-red" />
            <h1 className="text-2xl font-bold text-white tracking-wide">
              {t.kiosk_title || 'Kiosk Check-in'}
            </h1>
          </div>
          <p className="text-gray-400 text-sm">DAIICHI TRAVEL</p>
        </div>

        {/* Camera / Scanner area */}
        <AnimatePresence mode="wait">
          {state === 'scanning' && (
            <motion.div
              key="scanner"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full"
            >
              {cameraSupported ? (
                <div className="relative rounded-3xl overflow-hidden bg-black shadow-2xl aspect-video">
                  <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                  <canvas ref={canvasRef} className="hidden" />
                  {/* Scan overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-52 h-52 border-4 border-daiichi-red rounded-2xl opacity-80 animate-pulse" />
                  </div>
                  {/* Instruction */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-center">
                    <p className="text-white text-sm font-medium">
                      {t.kiosk_scan_prompt || 'Đưa mã QR vé vào camera để check-in'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="w-full rounded-3xl bg-gray-800 p-8 text-center">
                  <AlertCircle size={48} className="text-amber-400 mx-auto mb-3" />
                  <p className="text-white font-bold mb-1">
                    {isVi ? 'Camera không khả dụng' : 'Camera not available'}
                  </p>
                  <p className="text-gray-400 text-sm">
                    {isVi ? 'Vui lòng nhập mã vé thủ công bên dưới' : 'Please enter the ticket code manually below'}
                  </p>
                </div>
              )}

              {/* Manual code input */}
              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  value={manualCode}
                  onChange={e => setManualCode(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && handleManualSearch()}
                  placeholder={t.kiosk_manual_input || 'Nhập mã vé...'}
                  className="flex-1 px-4 py-3 rounded-2xl bg-gray-800 text-white placeholder-gray-500 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-daiichi-red/40 font-mono text-sm"
                />
                <button
                  onClick={handleManualSearch}
                  disabled={!manualCode.trim()}
                  className="px-5 py-3 bg-daiichi-red text-white rounded-2xl font-bold text-sm disabled:opacity-40 hover:bg-red-700 transition-colors"
                >
                  {isVi ? 'Tìm' : 'Search'}
                </button>
              </div>
            </motion.div>
          )}

          {state === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-4 py-16"
            >
              <Loader2 size={48} className="text-daiichi-red animate-spin" />
              <p className="text-white font-bold">{isVi ? 'Đang tìm kiếm...' : 'Searching...'}</p>
            </motion.div>
          )}

          {(state === 'found' || state === 'already_checked_in') && booking && (
            <motion.div
              key="found"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full bg-gray-800 rounded-3xl overflow-hidden shadow-2xl"
            >
              {/* Header */}
              <div className={`px-6 py-4 ${state === 'already_checked_in' ? 'bg-amber-600' : 'bg-emerald-600'}`}>
                <p className="text-white font-bold text-lg">
                  {state === 'already_checked_in'
                    ? (t.kiosk_already_checked_in || 'Đã check-in trước đó')
                    : (t.kiosk_booking_found || 'Đã tìm thấy vé')}
                </p>
                <p className="text-white/80 text-sm font-mono">{booking.ticketCode || booking.id}</p>
              </div>

              {/* Booking details */}
              <div className="p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <User size={18} className="text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-gray-400 text-xs uppercase font-bold tracking-wider">
                      {isVi ? 'Khách hàng' : 'Customer'}
                    </p>
                    <p className="text-white font-bold">{booking.customerName}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone size={18} className="text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-gray-400 text-xs uppercase font-bold tracking-wider">
                      {isVi ? 'Số điện thoại' : 'Phone'}
                    </p>
                    <p className="text-white font-bold">{booking.phone || booking.customerPhone || '—'}</p>
                  </div>
                </div>

                {(booking.route) && (
                  <div className="flex items-start gap-3">
                    <MapPin size={18} className="text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-gray-400 text-xs uppercase font-bold tracking-wider">
                        {isVi ? 'Tuyến đường' : 'Route'}
                      </p>
                      <p className="text-white font-bold">{booking.route}</p>
                    </div>
                  </div>
                )}

                {(booking.date || booking.tripDate) && (
                  <div className="flex items-center gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <Calendar size={18} className="text-gray-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-gray-400 text-xs uppercase font-bold tracking-wider">
                          {isVi ? 'Ngày' : 'Date'}
                        </p>
                        <p className="text-white font-bold">{formatBookingDate(booking.date || booking.tripDate)}</p>
                      </div>
                    </div>
                    {(booking.time || booking.tripTime) && (
                      <div className="flex items-start gap-3 flex-1">
                        <Clock size={18} className="text-gray-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-gray-400 text-xs uppercase font-bold tracking-wider">
                            {isVi ? 'Giờ' : 'Time'}
                          </p>
                          <p className="text-white font-bold">{booking.time || booking.tripTime}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {((booking.seatId || booking.seatIds) && !booking.freeSeating) && (
                  <div className="flex items-start gap-3">
                    <Bus size={18} className="text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-gray-400 text-xs uppercase font-bold tracking-wider">
                        {isVi ? 'Ghế' : 'Seat(s)'}
                      </p>
                      <p className="text-white font-bold">
                        {Array.isArray(booking.seatIds) && booking.seatIds.length > 1
                          ? booking.seatIds.join(', ')
                          : (booking.seatId || '—')}
                      </p>
                    </div>
                  </div>
                )}

                {trip && (
                  <div className="mt-2 px-4 py-3 bg-gray-700 rounded-2xl">
                    <p className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-1">
                      {isVi ? 'Thông tin chuyến xe' : 'Trip Info'}
                    </p>
                    <p className="text-white text-sm">
                      {[trip.vehicleName || trip.vehicle, trip.driverName].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                )}

                {state === 'already_checked_in' && booking.checkedInAt && (
                  <div className="px-4 py-3 bg-amber-900/30 border border-amber-700/40 rounded-2xl text-amber-300 text-sm">
                    {isVi ? 'Đã check-in lúc: ' : 'Checked in at: '}
                    {new Date(booking.checkedInAt).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="px-6 pb-6 flex gap-3">
                {state === 'found' ? (
                  <>
                    <button
                      onClick={handleCheckIn}
                      className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-colors text-lg"
                    >
                      <CheckCircle2 size={22} />
                      {t.check_in || 'Check-in'}
                    </button>
                    <button
                      onClick={handleReset}
                      className="px-5 py-4 bg-gray-700 hover:bg-gray-600 text-white rounded-2xl font-bold transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleReset}
                    className="flex-1 py-4 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-colors"
                  >
                    <X size={20} />
                    {isVi ? 'Đóng' : 'Close'}
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {state === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 py-12"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center"
              >
                <CheckCircle2 size={56} className="text-white" />
              </motion.div>
              <p className="text-white text-2xl font-bold">
                {t.kiosk_check_in_success || 'Check-in thành công!'}
              </p>
              {booking && (
                <p className="text-emerald-300 text-lg font-semibold">{booking.customerName}</p>
              )}
              <p className="text-gray-400 text-sm">
                {isVi ? `Tự động đóng sau ${RESET_DELAY_MS / 1000}s...` : `Auto-closing in ${RESET_DELAY_MS / 1000}s...`}
              </p>
            </motion.div>
          )}

          {state === 'not_found' && (
            <motion.div
              key="not_found"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-4 py-12"
            >
              <AlertCircle size={56} className="text-amber-400" />
              <p className="text-white text-xl font-bold text-center">
                {t.kiosk_not_found || 'Không tìm thấy vé với mã này'}
              </p>
              <p className="text-gray-400 text-sm">
                {isVi ? `Tự động đóng sau ${RESET_DELAY_MS / 1000}s...` : `Auto-closing in ${RESET_DELAY_MS / 1000}s...`}
              </p>
            </motion.div>
          )}

          {state === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-4 py-12"
            >
              <AlertCircle size={56} className="text-daiichi-red" />
              <p className="text-white text-xl font-bold">
                {isVi ? 'Có lỗi xảy ra. Vui lòng thử lại.' : 'An error occurred. Please try again.'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
