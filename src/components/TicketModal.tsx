import React, { useState } from 'react';
import { 
  X, Download, Share2, CheckCircle2, ArrowLeftRight,
  MapPin, Calendar, Clock, User, Users,
  CreditCard, QrCode, Copy, Palmtree, Moon, Coffee
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { TRANSLATIONS, Language } from '../App';

interface TicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: any;
  language: Language;
  onRegisterMember?: (data: { name: string; phone: string; email?: string; username?: string; password: string }) => Promise<boolean>;
}

export const TicketModal: React.FC<TicketModalProps> = ({ isOpen, onClose, booking, language }) => {
  const t = TRANSLATIONS[language];
  const [copied, setCopied] = useState(false);
  if (!booking) return null;

  const isTour = booking.type === 'TOUR';
  const isRoundTrip = !!booking.isRoundTrip;

  const handleDownload = () => {
    window.print();
  };

  const handleShare = async () => {
    let text: string;
    if (isTour) {
      text = [
        `🌴 ${language === 'vi' ? 'Xác nhận đặt tour - Daiichi Travel' : 'Tour Booking Confirmation - Daiichi Travel'}`,
        `📋 ${language === 'vi' ? 'Mã đặt tour' : 'Booking ID'}: ${booking.ticketCode || '#' + booking.id}`,
        `🗺️ ${booking.route}`,
        booking.duration ? `⏱️ ${language === 'vi' ? 'Thời gian' : 'Duration'}: ${booking.duration}` : '',
        `📅 ${language === 'vi' ? 'Ngày khởi hành' : 'Departure'}: ${booking.date}`,
        `👤 ${booking.customerName} - ${booking.phone}`,
        `👥 ${booking.adults} ${language === 'vi' ? 'người lớn' : 'adults'}${booking.children > 0 ? `, ${booking.children} ${language === 'vi' ? 'trẻ em' : 'children'}` : ''}`,
        `💰 ${(booking.amount || 0).toLocaleString()}đ`,
      ].filter(Boolean).join('\n');
    } else if (isRoundTrip) {
      const ob = booking.outboundLeg;
      text = [
        `🎫 ${language === 'vi' ? 'Vé khứ hồi Daiichi Travel' : 'Daiichi Travel Round-Trip Ticket'}`,
        `📋 ${language === 'vi' ? 'Mã vé' : 'Ticket'}: ${ob?.ticketCode || '#' + (ob?.id || '')} / ${booking.ticketCode || '#' + booking.id}`,
        `🚌 ${language === 'vi' ? 'Chiều đi' : 'Outbound'}: ${ob?.route} – ${ob?.date} ${ob?.time}`,
        `🚌 ${language === 'vi' ? 'Chiều về' : 'Return'}: ${booking.route} – ${booking.date} ${booking.time}`,
        `👤 ${booking.customerName} - ${booking.phone}`,
        `💰 ${(booking.amount || 0).toLocaleString()}đ`,
      ].join('\n');
    } else {
      text = [
        `🎫 ${language === 'vi' ? 'Vé xe Daiichi Travel' : 'Daiichi Travel Ticket'}`,
        `📋 ${language === 'vi' ? 'Mã vé' : 'Ticket'}: ${booking.ticketCode || '#' + booking.id}`,
        `🚌 ${booking.route}`,
        `📅 ${booking.date} ${booking.time}`,
        ...(!booking.freeSeating ? [`💺 ${language === 'vi' ? 'Ghế' : 'Seat'}: ${(booking.seatIds && booking.seatIds.length > 1) ? booking.seatIds.join(', ') : booking.seatId}`] : []),
        `👤 ${booking.customerName} - ${booking.phone}`,
        `💰 ${(booking.amount || 0).toLocaleString()}đ`,
      ].join('\n');
    }

    if (navigator.share) {
      try {
        await navigator.share({ title: language === 'vi' ? 'Daiichi Travel' : 'Daiichi Travel', text });
      } catch {
        // user cancelled or share failed, fall through to clipboard
      }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // clipboard not available
      }
    }
  };

  const accommodationLabel: Record<string, string> = {
    none: language === 'vi' ? 'Không có' : 'None',
    standard: language === 'vi' ? 'Phòng tiêu chuẩn' : 'Standard Room',
    deluxe: language === 'vi' ? 'Phòng Deluxe' : 'Deluxe Room',
    suite: language === 'vi' ? 'Phòng Suite' : 'Suite Room',
  };
  const mealLabel: Record<string, string> = {
    none: language === 'vi' ? 'Không có' : 'None',
    breakfast: language === 'vi' ? 'Bữa sáng' : 'Breakfast',
    half_board: language === 'vi' ? 'Nửa ngày ăn' : 'Half Board',
    full_board: language === 'vi' ? 'Cả ngày ăn' : 'Full Board',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="ticket-modal-root fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="ticket-card-print bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden relative flex flex-col max-h-[90vh]"
          >
            {/* Close button */}
            <button onClick={onClose} className="ticket-no-print absolute top-4 right-4 z-20 w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors">
              <X size={20} className="text-gray-600" />
            </button>

            {/* Ticket Body */}
            <div className="p-8 space-y-8 relative overflow-y-auto flex-1 ticket-print-area">

              {/* Company Logo */}
              <div className="flex items-center justify-center gap-3 pb-2 border-b border-gray-100">
                <img src="/icon-192.png" alt="Daiichi Travel" className="w-10 h-10 rounded-lg object-contain" />
                <div className="text-center">
                  <p className="text-lg font-bold text-daiichi-red tracking-wide">DAIICHI TRAVEL</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest">
                    {isTour
                      ? (language === 'vi' ? 'Xác nhận tour' : language === 'ja' ? 'ツアー確認' : 'Tour Confirmation')
                      : isRoundTrip
                        ? (t.round_trip_ticket_title || (language === 'vi' ? 'Vé khứ hồi' : language === 'ja' ? '往復チケット' : 'Round-Trip Ticket'))
                        : (language === 'vi' ? 'Vé xe khách' : language === 'ja' ? 'バスチケット' : 'Bus Ticket')}
                  </p>
                </div>
              </div>

              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    {isTour ? (language === 'vi' ? 'Mã đặt tour' : 'Booking ID') : t.ticket_code}
                  </p>
                  <p className="text-xl font-mono font-bold text-daiichi-red">
                    {booking.ticketCode || `#${booking.id}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.payment_method}</p>
                  <div className="flex items-center justify-end gap-2 text-green-600 font-bold">
                    <CreditCard size={14} />
                    <span className="text-sm uppercase">{booking.paymentMethod}</span>
                  </div>
                </div>
              </div>

              {isTour ? (
                /* ── TOUR TICKET BODY ── */
                <div className="space-y-6">
                  {/* Tour name & duration */}
                  <div>
                    <div className="flex items-center gap-2 text-gray-400 mb-1">
                      <Palmtree size={14} className="text-emerald-500" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">{language === 'vi' ? 'Tour' : 'Tour'}</span>
                    </div>
                    <p className="font-bold text-gray-800 text-lg">{booking.route}</p>
                    {booking.duration && (
                      <p className="text-xs text-emerald-600 font-medium mt-0.5">{booking.duration}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      {/* Passenger */}
                      <div>
                        <div className="flex items-center gap-2 text-gray-400 mb-1">
                          <User size={14} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">{t.passenger}</span>
                        </div>
                        <p className="font-bold text-gray-800">{booking.customerName}</p>
                        <p className="text-xs text-gray-500">{booking.phone}</p>
                      </div>
                      {/* Passengers count */}
                      <div>
                        <div className="flex items-center gap-2 text-gray-400 mb-1">
                          <Users size={14} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">{t.passengers}</span>
                        </div>
                        <p className="text-sm font-bold text-gray-700">
                          {booking.adults} {t.adults}
                          {(booking.children || 0) > 0 && `, ${booking.children} ${t.children}`}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {/* Departure date */}
                      <div>
                        <div className="flex items-center gap-2 text-gray-400 mb-1">
                          <Calendar size={14} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">{language === 'vi' ? 'Ngày khởi hành' : 'Departure'}</span>
                        </div>
                        <p className="font-bold text-gray-800">{booking.date}</p>
                      </div>
                      {/* Overnight stays */}
                      {(booking.nights ?? 0) > 0 && (
                        <div>
                          <div className="flex items-center gap-2 text-gray-400 mb-1">
                            <Moon size={14} className="text-indigo-500" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">{language === 'vi' ? 'Số đêm' : 'Nights'}</span>
                          </div>
                          <p className="font-bold text-gray-800">{booking.nights} {language === 'vi' ? 'đêm' : 'nights'}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Accommodation & Meals */}
                  <div className="grid grid-cols-2 gap-4">
                    {booking.accommodation && booking.accommodation !== 'none' && (
                      <div className="p-3 bg-blue-50 rounded-2xl">
                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">{language === 'vi' ? 'Phòng nghỉ' : 'Room'}</p>
                        <p className="text-sm font-bold text-blue-700">{accommodationLabel[booking.accommodation] || booking.accommodation}</p>
                      </div>
                    )}
                    {booking.mealPlan && booking.mealPlan !== 'none' && (
                      <div className="p-3 bg-amber-50 rounded-2xl">
                        <div className="flex items-center gap-1 mb-1">
                          <Coffee size={12} className="text-amber-400" />
                          <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">{language === 'vi' ? 'Bữa ăn' : 'Meals'}</p>
                        </div>
                        <p className="text-sm font-bold text-amber-700">{mealLabel[booking.mealPlan] || booking.mealPlan}</p>
                      </div>
                    )}
                  </div>

                  {/* Total */}
                  <div className="flex items-center justify-between p-6 bg-gray-50 rounded-3xl border border-gray-100">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Trạng thái' : 'Status'}</p>
                      <p className="text-lg font-bold text-emerald-600">{language === 'vi' ? 'Đã đặt' : 'Booked'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.total_payment}</p>
                      <p className="text-2xl font-bold text-gray-800">{(booking.amount || 0).toLocaleString()}đ</p>
                    </div>
                  </div>
                </div>
              ) : isRoundTrip ? (
                /* ── ROUND-TRIP BUS TICKET BODY ── */
                (() => {
                  const ob = booking.outboundLeg;
                  const renderLeg = (leg: any, label: string, colorClass: string) => (
                    <div className={`p-4 rounded-3xl border ${colorClass} space-y-3`}>
                      <div className="flex items-center gap-2">
                        <ArrowLeftRight size={14} className="text-daiichi-red shrink-0" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-daiichi-red">{label}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="flex items-center gap-1 text-gray-400 mb-0.5">
                            <MapPin size={12} />
                            <span className="text-[9px] font-bold uppercase tracking-widest">{t.trip}</span>
                          </div>
                          <p className="font-bold text-gray-800 text-sm">{leg?.route}</p>
                        </div>
                        <div>
                          <div className="flex items-center gap-1 text-gray-400 mb-0.5">
                            <Calendar size={12} />
                            <span className="text-[9px] font-bold uppercase tracking-widest">{t.departure}</span>
                          </div>
                          <p className="text-sm font-bold text-gray-800">{leg?.date}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Clock size={11} className="text-gray-400" />
                            <span className="text-[9px] text-gray-400 font-medium">{language === 'vi' ? 'Thời gian' : language === 'ja' ? '時刻' : 'Time'}:</span>
                            <span className="text-sm font-bold text-gray-800">{leg?.time}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          {leg?.freeSeating ? (
                            <p className="text-xs font-bold text-blue-500">🪑 {language === 'vi' ? 'Ghế tự do' : 'Free Seating'}</p>
                          ) : (
                            <>
                              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{t.seat}</p>
                              <p className="text-lg font-bold text-daiichi-red">
                                {(leg?.seatIds && leg.seatIds.length > 1) ? leg.seatIds.join(', ') : leg?.seatId}
                              </p>
                            </>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{t.ticket_code}</p>
                          <p className="text-sm font-mono font-bold text-gray-700">{leg?.ticketCode || `#${leg?.id}`}</p>
                        </div>
                      </div>
                    </div>
                  );

                  return (
                    <div className="space-y-4">
                      {/* Passenger info */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="flex items-center gap-2 text-gray-400 mb-1">
                            <User size={14} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">{t.passenger}</span>
                          </div>
                          <p className="font-bold text-gray-800">{booking.customerName}</p>
                          <p className="text-xs text-gray-500">{booking.phone}</p>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 text-gray-400 mb-1">
                            <Users size={14} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">{t.passengers}</span>
                          </div>
                          <p className="text-sm font-bold text-gray-700">{booking.adults} {t.adults}, {booking.children} {t.children}</p>
                        </div>
                      </div>

                      {/* Outbound leg */}
                      {renderLeg(ob, t.round_trip_ticket_outbound || (language === 'vi' ? 'Chiều đi' : 'Outbound'), 'bg-blue-50 border-blue-100')}

                      {/* Return leg */}
                      {renderLeg(booking, t.round_trip_ticket_return || (language === 'vi' ? 'Chiều về' : 'Return'), 'bg-green-50 border-green-100')}

                      {/* Combined total */}
                      <div className="flex items-center justify-between p-5 bg-gray-50 rounded-3xl border border-gray-100">
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Trạng thái' : 'Status'}</p>
                          <p className="text-base font-bold text-emerald-600">{language === 'vi' ? 'Đã đặt' : 'Booked'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.total_payment}</p>
                          <p className="text-2xl font-bold text-gray-800">{(booking.amount || 0).toLocaleString()}đ</p>
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                /* ── ONE-WAY BUS TICKET BODY ── */
                <>
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center gap-2 text-gray-400 mb-1">
                          <User size={14} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">{t.passenger}</span>
                        </div>
                        <p className="font-bold text-gray-800">{booking.customerName}</p>
                        <p className="text-xs text-gray-500">{booking.phone}</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-gray-400 mb-1">
                          <Users size={14} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">{t.passengers}</span>
                        </div>
                        <p className="text-sm font-bold text-gray-700">{booking.adults} {t.adults}, {booking.children} {t.children}</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center gap-2 text-gray-400 mb-1">
                          <MapPin size={14} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">{t.trip}</span>
                        </div>
                        <p className="font-bold text-gray-800">{booking.route}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                          <Calendar size={12} />
                          <span>{booking.date}</span>
                        </div>
                      </div>
                      {booking.pickupPoint && (
                        <div>
                          <div className="flex items-center gap-2 text-gray-400 mb-1">
                            <MapPin size={14} className="text-blue-500" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">{t.pickup_point}</span>
                          </div>
                          <p className="text-[10px] font-bold text-gray-700 leading-tight">{booking.pickupPoint}</p>
                        </div>
                      )}
                      {booking.dropoffPoint && (
                        <div>
                          <div className="flex items-center gap-2 text-gray-400 mb-1">
                            <MapPin size={14} className="text-green-500" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">{t.dropoff_point}</span>
                          </div>
                          <p className="text-[10px] font-bold text-gray-700 leading-tight">{booking.dropoffPoint}</p>
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2 text-gray-400 mb-1">
                          <Clock size={14} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">{t.departure}</span>
                        </div>
                        <p className="font-bold text-gray-800">
                          <span className="text-[10px] font-normal text-gray-400 mr-1">{language === 'vi' ? 'Thời gian' : language === 'ja' ? '時刻' : 'Time'}:</span>
                          {booking.time}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-6 bg-gray-50 rounded-3xl border border-gray-100">
                    {booking.freeSeating ? (
                      <div>
                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">🪑 {language === 'vi' ? 'Ghế tự do' : language === 'ja' ? '自由席' : 'Free Seating'}</p>
                        <p className="text-sm font-bold text-blue-600">{language === 'vi' ? 'Không có số ghế' : language === 'ja' ? '座席番号なし' : 'No seat number'}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.seat}</p>
                        <p className="text-2xl font-bold text-daiichi-red">
                          {(booking.seatIds && booking.seatIds.length > 1) ? booking.seatIds.join(', ') : booking.seatId}
                        </p>
                      </div>
                    )}
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.total_payment}</p>
                      <p className="text-2xl font-bold text-gray-800">{(booking.amount || 0).toLocaleString()}đ</p>
                    </div>
                  </div>

                  {/* Selected add-on services */}
                  {booking.selectedAddons && booking.selectedAddons.length > 0 && (
                    <div className="p-4 bg-emerald-50 rounded-3xl border border-emerald-100">
                      <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-2">{t.select_addons}</p>
                      <div className="space-y-1">
                        {booking.selectedAddons.map((a: { id: string; name: string; price: number; quantity?: number }) => (
                          <div key={a.id} className="flex justify-between items-center text-sm">
                            <span className="font-medium text-gray-700">
                              {a.name}{(a.quantity && a.quantity > 1) ? ` × ${a.quantity}` : ''}
                            </span>
                            <span className="font-bold text-emerald-700">+{((a.price || 0) * (a.quantity || 1)).toLocaleString()}đ</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}


              <div className="flex flex-col items-center gap-4 pt-4">
                <div className="p-4 bg-white border-2 border-gray-50 rounded-3xl shadow-sm">
                  <QrCode size={120} className="text-gray-800" />
                </div>
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">
                  {isTour
                    ? (language === 'vi' ? 'Quét mã để xác nhận tour' : 'Scan to confirm tour')
                    : (language === 'vi' ? 'Quét mã để lên xe' : 'Scan to board')}
                </p>
              </div>


            </div>
            <div className="ticket-actions-print p-6 bg-gray-50 flex gap-3 shrink-0">
              <button onClick={onClose} className="flex items-center justify-center gap-2 px-5 py-4 bg-white border border-gray-200 rounded-2xl font-bold text-gray-700 hover:bg-gray-100 transition-all">
                <X size={18} />
                {t.close_ticket}
              </button>
              <button onClick={handleDownload} className="flex-1 flex items-center justify-center gap-2 py-4 bg-white border border-gray-200 rounded-2xl font-bold text-gray-700 hover:bg-gray-100 transition-all">
                <Download size={20} />
                {language === 'vi' ? 'Tải xuống' : 'Download'}
              </button>
              <button onClick={handleShare} className={cn("flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold shadow-lg transition-all", copied ? "bg-green-500 text-white shadow-green-500/20" : "bg-daiichi-red text-white shadow-daiichi-red/20 hover:scale-[1.02]")}>
                {copied ? <Copy size={20} /> : <Share2 size={20} />}
                {copied ? (language === 'vi' ? 'Đã sao chép!' : 'Copied!') : (language === 'vi' ? 'Chia sẻ' : 'Share')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
