import React, { useEffect, useState } from 'react';
import { Ticket, Calendar, Clock, User, Phone, QrCode, AlertCircle, Mail, Gift, X, Pencil, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Language, TRANSLATIONS, UserRole } from '../App';
import { Route, TripAddon } from '../types';
import { cn } from '../lib/utils';
import { getJourneyStops } from '../lib/routeUtils';
import { formatBookingDate } from '../lib/vnDate';
import { transportService } from '../services/transportService';

const MY_TICKETS_KEY = 'daiichi_my_tickets';

interface MyTicketsProps {
  language: Language;
  currentUser: any | null;
  bookings: any[]; // all bookings from Supabase
  routes?: Route[];
}

interface EditForm {
  customerName: string;
  phone: string;
  bookingNote: string;
}

function saveLocalTickets(tickets: any[]) {
  try {
    localStorage.setItem(MY_TICKETS_KEY, JSON.stringify(tickets));
  } catch (err) {
    console.error('[MyTickets] Failed to save tickets to localStorage:', err);
  }
}

function loadLocalTickets(): any[] {
  try {
    return JSON.parse(localStorage.getItem(MY_TICKETS_KEY) || '[]');
  } catch {
    return [];
  }
}

export const MyTickets: React.FC<MyTicketsProps> = ({ language, currentUser, bookings, routes = [] }) => {
  const t = TRANSLATIONS[language];
  const [localTickets, setLocalTickets] = useState<any[]>([]);
  const [editingBooking, setEditingBooking] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ customerName: '', phone: '', bookingNote: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<any | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Load tickets from localStorage on mount
  useEffect(() => {
    setLocalTickets(loadLocalTickets());
  }, []);

  // For logged-in customers, also fetch tickets from Supabase by phone
  const customerPhone = currentUser?.role === UserRole.CUSTOMER
    ? currentUser?.phone
    : null;

  // Merge localStorage tickets and Supabase tickets (avoid duplicates by ticketCode/id)
  const supabaseTickets = customerPhone
    ? bookings.filter(b => (b.type === 'TRIP' || b.type === 'TOUR') && b.phone === customerPhone)
    : [];

  const allTickets = React.useMemo(() => {
    const seen = new Set<string>();
    const merged: any[] = [];
    // Supabase tickets first (most authoritative)
    for (const t of supabaseTickets) {
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
  }, [supabaseTickets, localTickets]);

  const isVi = language === 'vi';
  const isJa = language === 'ja';

  // ── Edit handler ──────────────────────────────────────────────────────────
  const openEdit = (booking: any) => {
    setEditingBooking(booking);
    setEditForm({
      customerName: booking.customerName || '',
      phone: booking.phone || '',
      bookingNote: booking.bookingNote || '',
    });
  };

  const closeEdit = () => {
    setEditingBooking(null);
    setEditLoading(false);
  };

  const handleSaveEdit = async () => {
    if (!editingBooking) return;
    setEditLoading(true);
    try {
      const updates: any = {
        customerName: editForm.customerName.trim(),
        phone: editForm.phone.trim(),
        bookingNote: editForm.bookingNote.trim(),
      };
      // Update in Supabase if this is a cloud booking (has a real id)
      if (editingBooking.id && !editingBooking._localOnly) {
        await transportService.updateBooking(editingBooking.id, updates);
      }
      // Update in localStorage
      const stored: any[] = loadLocalTickets();
      const key = editingBooking.ticketCode || editingBooking.id;
      const updatedLocal = stored.map((item: any) => {
        const itemKey = item.ticketCode || item.id;
        return itemKey === key ? { ...item, ...updates } : item;
      });
      saveLocalTickets(updatedLocal);
      setLocalTickets(updatedLocal);
      closeEdit();
    } catch (err) {
      console.error('Failed to update booking:', err);
      alert(isVi ? 'Cập nhật thất bại. Vui lòng thử lại.' : 'Update failed. Please try again.');
    } finally {
      setEditLoading(false);
    }
  };

  // ── Delete handler ────────────────────────────────────────────────────────
  const handleDelete = async (booking: any) => {
    setDeleteLoading(true);
    try {
      // Delete from Supabase if cloud booking
      if (booking.id && !booking._localOnly) {
        await transportService.deleteBooking(booking.id);
      }
      // Remove from localStorage
      const stored: any[] = loadLocalTickets();
      const key = booking.ticketCode || booking.id;
      const filtered = stored.filter((item: any) => {
        const itemKey = item.ticketCode || item.id;
        return itemKey !== key;
      });
      saveLocalTickets(filtered);
      setLocalTickets(filtered);
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Failed to delete booking:', err);
      alert(isVi ? 'Xóa vé thất bại. Vui lòng thử lại.' : 'Delete failed. Please try again.');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Edit modal */}
      {editingBooking && (
        <div
          className="fixed inset-0 z-[500] bg-black/50 flex items-center justify-center p-4"
          onClick={closeEdit}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-[28px] p-6 max-w-md w-full space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pencil size={18} className="text-daiichi-red" />
                <h3 className="text-lg font-bold text-gray-800">
                  {isVi ? 'Chỉnh sửa vé' : isJa ? 'チケットを編集' : 'Edit Ticket'}
                </h3>
              </div>
              <button onClick={closeEdit} className="p-2 hover:bg-gray-50 rounded-xl" aria-label={isVi ? 'Đóng' : 'Close'}>
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {isVi ? 'Tên khách hàng' : isJa ? 'お客様名' : 'Customer Name'}
                </label>
                <input
                  type="text"
                  value={editForm.customerName}
                  onChange={e => setEditForm(prev => ({ ...prev, customerName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/30 focus:border-daiichi-red"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {isVi ? 'Số điện thoại' : isJa ? '電話番号' : 'Phone'}
                </label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={e => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/30 focus:border-daiichi-red"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {isVi ? 'Ghi chú' : isJa ? '備考' : 'Note'}
                </label>
                <textarea
                  value={editForm.bookingNote}
                  onChange={e => setEditForm(prev => ({ ...prev, bookingNote: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/30 focus:border-daiichi-red resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={closeEdit}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {isVi ? 'Hủy' : isJa ? 'キャンセル' : 'Cancel'}
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editLoading}
                className="flex-1 px-4 py-2 bg-daiichi-red text-white rounded-xl text-sm font-bold hover:bg-daiichi-red/90 disabled:opacity-60 transition-colors"
              >
                {editLoading ? (isVi ? 'Đang lưu...' : isJa ? '保存中...' : 'Saving...') : (isVi ? 'Lưu' : isJa ? '保存' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-[500] bg-black/50 flex items-center justify-center p-4"
          onClick={() => !deleteLoading && setDeleteConfirm(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-[28px] p-6 max-w-sm w-full space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">
                  {isVi ? 'Xóa vé?' : isJa ? 'チケットを削除しますか？' : 'Delete ticket?'}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {isVi ? 'Thao tác này không thể hoàn tác.' : isJa ? 'この操作は取り消せません。' : 'This action cannot be undone.'}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60 transition-colors"
              >
                {isVi ? 'Hủy' : isJa ? 'キャンセル' : 'Cancel'}
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 disabled:opacity-60 transition-colors"
              >
                {deleteLoading ? (isVi ? 'Đang xóa...' : isJa ? '削除中...' : 'Deleting...') : (isVi ? 'Xóa' : isJa ? '削除' : 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Ticket cards grid – compact on desktop like BookTicketPage */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {allTickets.map((booking, idx) => (
          <TicketCard
            key={booking.id || booking.ticketCode || idx}
            booking={booking}
            language={language}
            routes={routes}
            onEdit={openEdit}
            onDelete={b => setDeleteConfirm(b)}
          />
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

const TicketCard: React.FC<{ booking: any; language: Language; routes?: Route[]; onEdit: (b: any) => void; onDelete: (b: any) => void }> = ({ booking, language, routes = [], onEdit, onDelete }) => {
  const isVi = language === 'vi';
  const isJa = language === 'ja';
  const [addonDetail, setAddonDetail] = useState<{ trip: any; addons: TripAddon[] } | null>(null);

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
    <>
    {/* Addon detail modal */}
    {addonDetail && (
      <div
        className="fixed inset-0 z-[500] bg-black/50 flex items-center justify-center p-4"
        onClick={() => setAddonDetail(null)}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="bg-white rounded-[28px] p-6 max-w-md w-full space-y-4 max-h-[80vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Gift size={20} className="text-emerald-600" />
              <h3 className="text-lg font-bold text-emerald-700">
                {isVi ? 'Dịch vụ kèm theo' : isJa ? '付帯サービス' : 'Add-on Services'}
              </h3>
            </div>
            <button onClick={() => setAddonDetail(null)} className="p-2 hover:bg-gray-50 rounded-xl" aria-label={isVi ? 'Đóng' : 'Close'}>
              <X size={20} />
            </button>
          </div>
          <div className="space-y-3">
            {addonDetail.addons.map((addon) => (
              <div key={addon.id} className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <span className="font-bold text-sm text-gray-800">{addon.name}</span>
                    {addon.description && <p className="text-xs text-gray-500 mt-0.5">{addon.description}</p>}
                  </div>
                  <span className="text-sm font-bold text-daiichi-red whitespace-nowrap">+{addon.price.toLocaleString()}đ</span>
                </div>
                {(addon.images || []).length > 0 && (
                  <div className="mt-2 space-y-2">
                    {(addon.images || []).map((img, i) => (
                      <img key={i} src={img} alt={`${addon.name} - ${i + 1}`} className="w-full rounded-xl object-cover max-h-48" referrerPolicy="no-referrer" />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    )}

    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col"
    >
      {/* Route name header */}
      <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between gap-2 bg-gradient-to-r from-daiichi-red to-rose-500">
        <span className="text-white/90 font-bold text-xs truncate flex-1">{booking.route}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          <div className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${statusColor}`}>
            {statusLabel}
          </div>
          <button
            type="button"
            onClick={() => onEdit(booking)}
            className="p-1 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
            aria-label={isVi ? 'Chỉnh sửa' : 'Edit'}
          >
            <Pencil size={11} className="text-white" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(booking)}
            className="p-1 rounded-lg bg-white/20 hover:bg-red-400/60 transition-colors"
            aria-label={isVi ? 'Xóa' : 'Delete'}
          >
            <Trash2 size={11} className="text-white" />
          </button>
        </div>
      </div>

      {/* Card body: ticket info */}
      <div className="flex flex-1">
        {/* Ticket info */}
        <div className="flex-1 px-4 py-3 space-y-2 min-w-0">
          {/* Ticket code */}
          <div className="flex items-center gap-1">
            <QrCode size={12} className="text-gray-400 flex-shrink-0" />
            <span className="font-mono font-bold text-xs text-daiichi-red truncate">{booking.ticketCode || `#${booking.id}`}</span>
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <div className="flex items-center gap-1 min-w-0">
              <Calendar size={11} className="text-gray-400 flex-shrink-0" />
              <span className="text-xs font-medium text-gray-600 truncate">{formatBookingDate(booking.date)}</span>
            </div>
            <div className="flex items-center gap-1 min-w-0">
              <Clock size={11} className="text-gray-400 flex-shrink-0" />
              <span className="text-xs font-medium text-gray-600 truncate">{booking.time}</span>
            </div>
            {/* Seat */}
            <div className="flex items-center gap-1 min-w-0">
              <QrCode size={11} className="text-gray-400 flex-shrink-0" />
              <span className={`text-xs font-bold truncate ${isFreeSeating ? 'text-blue-500' : 'text-daiichi-red'}`}>{seatDisplay || '-'}</span>
            </div>
            {/* Passengers */}
            <div className="flex items-center gap-1 min-w-0">
              <User size={11} className="text-gray-400 flex-shrink-0" />
              <span className="text-xs font-medium text-gray-600 truncate">
                {booking.adults}{(booking.children || 0) > 0 ? `+${booking.children}` : ''} {isVi ? 'người' : isJa ? '名' : 'pax'}
              </span>
            </div>
          </div>

          {/* Customer name */}
          <div className="flex items-center gap-1 min-w-0 pt-0.5 border-t border-gray-50">
            <User size={11} className="text-gray-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-gray-700 truncate">{booking.customerName}</span>
          </div>

          {/* Price row */}
          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[10px] text-gray-400 font-medium">{booking.paymentMethod || '-'}</span>
            <span className="text-base font-bold text-daiichi-red">{(booking.amount || 0).toLocaleString()}đ</span>
          </div>

          {/* Add-ons – clickable tags */}
          {booking.selectedAddons && booking.selectedAddons.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {booking.selectedAddons.map((a: any) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAddonDetail({ trip: booking, addons: booking.selectedAddons })}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-lg text-[9px] font-bold border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
                >
                  <Gift size={8} className="flex-shrink-0" />
                  <span>{a.name}</span>
                  <span className="text-emerald-600">+{((a.price || 0) * (a.quantity || 1)).toLocaleString()}đ</span>
                </button>
              ))}
            </div>
          )}

          {/* Journey stops */}
          {journeyStops.length >= 2 && (
            <div className="pt-1 border-t border-gray-50">
              <div className="flex flex-wrap items-center gap-1">
                {journeyStops.map((stop, idx) => (
                  <React.Fragment key={idx}>
                    <span className={cn(
                      "text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                      idx === 0
                        ? "bg-daiichi-red text-white"
                        : idx === journeyStops.length - 1
                          ? "bg-blue-500 text-white"
                          : "bg-gray-100 text-gray-600"
                    )}>
                      {stop}
                    </span>
                    {idx < journeyStops.length - 1 && (
                      <span className="text-gray-300 text-[9px] font-bold">→</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
    </>
  );
};
