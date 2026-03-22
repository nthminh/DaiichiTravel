import React, { useEffect, useState } from 'react';
import { Ticket, MapPin, Calendar, Clock, User, Phone, QrCode, AlertCircle, Mail } from 'lucide-react';
import { motion } from 'motion/react';
import { Language, TRANSLATIONS, UserRole } from '../App';
import { Route } from '../types';
import { cn } from '../lib/utils';
import { getJourneyStops } from '../lib/routeUtils';

const MY_TICKETS_KEY = 'daiichi_my_tickets';

interface MyTicketsProps {
  language: Language;
  currentUser: any | null;
  bookings: any[]; // all bookings from Firestore
  routes?: Route[];
}

export const MyTickets: React.FC<MyTicketsProps> = ({ language, currentUser, bookings, routes = [] }) => {
  const t = TRANSLATIONS[language];
  const [localTickets, setLocalTickets] = useState<any[]>([]);

  // Load tickets from localStorage on mount
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(MY_TICKETS_KEY) || '[]');
      setLocalTickets(stored);
    } catch {
      setLocalTickets([]);
    }
  }, []);

  // For logged-in customers, also fetch tickets from Firestore by phone
  const customerPhone = currentUser?.role === UserRole.CUSTOMER
    ? currentUser?.phone
    : null;

  // Merge localStorage tickets and Firestore tickets (avoid duplicates by ticketCode/id)
  const firestoreTickets = customerPhone
    ? bookings.filter(b => b.type === 'TRIP' && b.phone === customerPhone)
    : [];

  const allTickets = React.useMemo(() => {
    const seen = new Set<string>();
    const merged: any[] = [];
    // Firestore tickets first (most authoritative)
    for (const t of firestoreTickets) {
      const key = t.ticketCode || t.id;
      if (!seen.has(key)) { seen.add(key); merged.push(t); }
    }
    // Local tickets (may contain offline or non-logged-in purchases)
    for (const t of localTickets) {
      const key = t.ticketCode || t.id;
      if (!seen.has(key)) { seen.add(key); merged.push(t); }
    }
    // Sort by createdAt desc
    return merged.sort((a, b) => {
      const ta = a.createdAt?.toDate?.() ?? new Date(a.createdAt ?? 0);
      const tb = b.createdAt?.toDate?.() ?? new Date(b.createdAt ?? 0);
      return tb.getTime() - ta.getTime();
    });
  }, [firestoreTickets, localTickets]);

  const isVi = language === 'vi';
  const isJa = language === 'ja';

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-daiichi-red/10 rounded-2xl flex items-center justify-center">
          <Ticket size={24} className="text-daiichi-red" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{t.my_tickets || 'Vé đã mua'}</h2>
          <p className="text-sm text-gray-400">
            {isVi ? `${allTickets.length} vé` : isJa ? `${allTickets.length} 枚のチケット` : `${allTickets.length} ticket(s)`}
          </p>
        </div>
      </div>

      {/* Empty state */}
      {allTickets.length === 0 && (
        <div className="bg-white rounded-3xl p-10 text-center shadow-sm border border-gray-100">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Ticket size={36} className="text-gray-300" />
          </div>
          <p className="text-gray-500 font-medium">{t.my_tickets_empty || 'Bạn chưa có vé nào. Đặt vé ngay để xem lại ở đây!'}</p>
        </div>
      )}

      {/* Ticket cards */}
      <div className="space-y-4">
        {allTickets.map((booking, idx) => (
          <TicketCard key={booking.id || booking.ticketCode || idx} booking={booking} language={language} routes={routes} />
        ))}
      </div>

      {/* Cancellation policy */}
      <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <AlertCircle size={18} className="text-amber-500" />
          <h3 className="font-bold text-amber-800">{t.my_tickets_cancel_policy_title || 'Chính sách hủy vé'}</h3>
        </div>
        <ul className="space-y-2 text-sm text-amber-800">
          <li className="flex items-start gap-2">
            <span className="text-amber-400 font-bold mt-0.5">•</span>
            <span>{t.my_tickets_cancel_normal || 'Ngày thường: hủy trước 24 giờ được hoàn tiền.'}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-400 font-bold mt-0.5">•</span>
            <span>{t.my_tickets_cancel_holiday || 'Lễ, Tết: hủy trước 48 giờ được hoàn tiền.'}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-400 font-bold mt-0.5">•</span>
            <span className="font-semibold text-red-600">{t.my_tickets_cancel_late || 'Hủy sát giờ xe chạy: không được hoàn tiền.'}</span>
          </li>
        </ul>
      </div>

      {/* Contact info */}
      <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-3">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <Phone size={16} className="text-daiichi-red" />
          {t.my_tickets_contact_title || 'Liên hệ hỗ trợ'}
        </h3>
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center gap-3">
            <Phone size={14} className="text-gray-400 shrink-0" />
            <a href="tel:+84961004709" className="font-medium hover:text-daiichi-red transition-colors">+84 96 100 47 09</a>
          </div>
          <div className="flex items-center gap-3">
            <Mail size={14} className="text-gray-400 shrink-0" />
            <a href="mailto:sale@daiichitravel.com" className="font-medium hover:text-daiichi-red transition-colors">sale@daiichitravel.com</a>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {isVi ? 'Hỗ trợ 24/7 – Daiichi Travel' : isJa ? '24時間年中無休サポート – Daiichi Travel' : '24/7 Support – Daiichi Travel'}
          </p>
        </div>
      </div>
    </div>
  );
};

// ── Individual ticket card ──────────────────────────────────────────────────

const TicketCard: React.FC<{ booking: any; language: Language; routes?: Route[] }> = ({ booking, language, routes = [] }) => {
  const t = TRANSLATIONS[language];
  const isVi = language === 'vi';
  const isJa = language === 'ja';

  const isFreeSeating = booking.freeSeating;
  const seatDisplay = isFreeSeating
    ? (isVi ? 'Ghế tự do' : isJa ? '自由席' : 'Free Seating')
    : (booking.seatIds && booking.seatIds.length > 1 ? booking.seatIds.join(', ') : booking.seatId || '');

  const statusColor = booking.status === 'CANCELLED' ? 'text-red-500 bg-red-50 border-red-100' : 'text-emerald-600 bg-emerald-50 border-emerald-100';
  const statusLabel = booking.status === 'CANCELLED'
    ? (isVi ? 'Đã hủy' : isJa ? 'キャンセル済み' : 'Cancelled')
    : (isVi ? 'Đã đặt' : isJa ? '予約済み' : 'Booked');

  const journeyStops = booking.route
    ? getJourneyStops(routes, booking.route, booking.pickupPoint || undefined, booking.dropoffPoint || undefined)
    : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden"
    >
      {/* Card header */}
      <div className="bg-gradient-to-r from-daiichi-red to-rose-500 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest">{t.ticket_code || 'Mã vé'}</p>
          <p className="text-white font-mono font-bold text-lg">{booking.ticketCode || `#${booking.id}`}</p>
        </div>
        <div className={`px-3 py-1 rounded-full border text-xs font-bold ${statusColor}`}>
          {statusLabel}
        </div>
      </div>

      {/* Card body */}
      <div className="px-6 py-5 space-y-4">
        {/* Route */}
        <div className="flex items-start gap-3">
          <MapPin size={16} className="text-daiichi-red mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.trip || 'Tuyến xe'}</p>
            <p className="font-bold text-gray-800">{booking.route}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Date */}
          <div className="flex items-start gap-2">
            <Calendar size={14} className="text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.date || 'Ngày đi'}</p>
              <p className="font-bold text-gray-700 text-sm">{booking.date}</p>
            </div>
          </div>

          {/* Time */}
          <div className="flex items-start gap-2">
            <Clock size={14} className="text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.departure || 'Giờ xuất phát'}</p>
              <p className="font-bold text-gray-700 text-sm">{booking.time}</p>
            </div>
          </div>

          {/* Seat */}
          <div className="flex items-start gap-2">
            <QrCode size={14} className="text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.seat || 'Ghế'}</p>
              <p className={`font-bold text-sm ${isFreeSeating ? 'text-blue-500' : 'text-daiichi-red'}`}>{seatDisplay}</p>
            </div>
          </div>

          {/* Passengers */}
          <div className="flex items-start gap-2">
            <User size={14} className="text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.passengers || 'Hành khách'}</p>
              <p className="font-bold text-gray-700 text-sm">
                {booking.adults} {t.adults || 'NL'}
                {(booking.children || 0) > 0 ? `, ${booking.children} ${t.children || 'TE'}` : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Pickup/dropoff */}
        {(booking.pickupPoint || booking.dropoffPoint) && (
          <div className="grid grid-cols-2 gap-4 pt-1">
            {booking.pickupPoint && (
              <div>
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{t.pickup_point || 'Điểm đón'}</p>
                <p className="text-xs font-medium text-gray-600 leading-snug">{booking.pickupPoint}</p>
              </div>
            )}
            {booking.dropoffPoint && (
              <div>
                <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest">{t.dropoff_point || 'Điểm trả'}</p>
                <p className="text-xs font-medium text-gray-600 leading-snug">{booking.dropoffPoint}</p>
              </div>
            )}
          </div>
        )}

        {/* Customer info */}
        <div className="flex items-center gap-3 pt-1 border-t border-gray-50">
          <User size={14} className="text-gray-400 shrink-0" />
          <div>
            <p className="font-bold text-gray-700 text-sm">{booking.customerName}</p>
            {booking.phone && <p className="text-xs text-gray-400">{booking.phone}</p>}
          </div>
        </div>

        {/* Price */}
        <div className="flex items-center justify-between p-4 bg-daiichi-accent/30 rounded-2xl">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.payment_method || 'Hình thức TT'}</p>
            <p className="text-sm font-bold text-gray-600">{booking.paymentMethod || '-'}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.total_payment || 'Tổng tiền'}</p>
            <p className="text-2xl font-bold text-daiichi-red">{(booking.amount || 0).toLocaleString()}đ</p>
          </div>
        </div>

        {/* Add-ons */}
        {booking.selectedAddons && booking.selectedAddons.length > 0 && (
          <div className="space-y-1">
            {booking.selectedAddons.map((a: any) => (
              <div key={a.id} className="flex justify-between text-xs text-gray-500">
                <span>{a.name}{a.quantity > 1 ? ` ×${a.quantity}` : ''}</span>
                <span className="font-medium text-emerald-600">+{((a.price || 0) * (a.quantity || 1)).toLocaleString()}đ</span>
              </div>
            ))}
          </div>
        )}

        {/* Journey stops row */}
        {journeyStops.length >= 2 && (
          <div className="pt-3 border-t border-gray-50">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">
              {t.all_stops_label || 'Hành trình'}
            </p>
            <div className="flex flex-wrap items-center gap-1">
              {journeyStops.map((stop, idx) => (
                <React.Fragment key={idx}>
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full",
                    idx === 0
                      ? "bg-daiichi-red text-white"
                      : idx === journeyStops.length - 1
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 text-gray-600"
                  )}>
                    {stop}
                  </span>
                  {idx < journeyStops.length - 1 && (
                    <span className="text-gray-300 text-[10px] font-bold">→</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
