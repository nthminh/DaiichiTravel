import React, { useState } from 'react';
import { Ticket, Edit3, Trash2, AlertCircle, Clock, MapPin, Calendar, CheckCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { Language, TRANSLATIONS, UserRole } from '../App';
import { transportService } from '../services/transportService';
import { SeatStatus } from '../types';

interface AgentBookingsProps {
  language: Language;
  currentUser: any | null;
  bookings: any[];
  trips: any[];
  setTrips: React.Dispatch<React.SetStateAction<any[]>>;
  setBookings: React.Dispatch<React.SetStateAction<any[]>>;
}

export const AgentBookings: React.FC<AgentBookingsProps> = ({
  language,
  currentUser,
  bookings,
  trips,
  setTrips,
  setBookings,
}) => {
  const t = TRANSLATIONS[language];
  const isVi = language === 'vi';
  const isJa = language === 'ja';

  const [editingBooking, setEditingBooking] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const agentId = currentUser?.id;
  // All bookings by this agent
  const myBookings = bookings.filter(b => b.agentId === agentId && b.type === 'TRIP');

  // Split: held vs confirmed
  const heldTickets = myBookings.filter(b => b.paymentMethod === 'Giữ vé');
  const confirmedTickets = myBookings.filter(b => b.paymentMethod !== 'Giữ vé');

  /** Check whether the trip for this booking departs more than 24h from now */
  const canEditBooking = (booking: any): boolean => {
    const trip = trips.find(t => t.id === booking.tripId);
    if (!trip) return false;
    const tripDateStr = trip.date || booking.date;
    const tripTime = trip.time || booking.time || '00:00';
    if (!tripDateStr) return true; // if no date, allow edit
    // Parse date: may be DD/MM/YYYY or YYYY-MM-DD
    let departureDate: Date;
    const parts = tripDateStr.split(/[\/\-]/);
    if (parts.length === 3) {
      if (tripDateStr.includes('/')) {
        // DD/MM/YYYY
        departureDate = new Date(+parts[2], +parts[1] - 1, +parts[0]);
      } else {
        // YYYY-MM-DD
        departureDate = new Date(+parts[0], +parts[1] - 1, +parts[2]);
      }
      const [hh, mm] = tripTime.split(':');
      departureDate.setHours(+hh || 0, +mm || 0, 0, 0);
    } else {
      return true;
    }
    const diff = departureDate.getTime() - Date.now();
    return diff > 24 * 60 * 60 * 1000; // more than 24h
  };

  const handleStartEdit = (booking: any) => {
    setEditingBooking(booking);
    setEditForm({
      customerName: booking.customerName || '',
      phone: booking.phone || '',
      pickupPoint: booking.pickupPoint || '',
      dropoffPoint: booking.dropoffPoint || '',
      bookingNote: booking.bookingNote || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingBooking) return;
    setSaving(true);
    try {
      await transportService.updateBooking(editingBooking.id, editForm);
      // Also update seat data in trip
      if (editingBooking.seatIds) {
        const seatUpdate = {
          customerName: editForm.customerName,
          customerPhone: editForm.phone,
          pickupPoint: editForm.pickupPoint,
          dropoffPoint: editForm.dropoffPoint,
          bookingNote: editForm.bookingNote,
        };
        await transportService.bookSeats(editingBooking.tripId, editingBooking.seatIds, seatUpdate);
      }
      setEditingBooking(null);
    } catch (err) {
      console.error('Failed to update booking:', err);
      alert(isVi ? 'Lỗi khi lưu thay đổi. Vui lòng thử lại.' : 'Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (booking: any) => {
    setDeleteConfirmId(null);
    try {
      // Free the seats
      const emptyData = {
        status: SeatStatus.EMPTY,
        customerName: '',
        customerPhone: '',
        pickupPoint: '',
        dropoffPoint: '',
        pickupAddress: '',
        dropoffAddress: '',
        bookingNote: '',
      };
      const seatIds = booking.seatIds || (booking.seatId ? [booking.seatId] : []);
      if (seatIds.length > 0) {
        await transportService.bookSeats(booking.tripId, seatIds, emptyData);
      }
      await transportService.deleteBooking(booking.id);
      // Optimistic update
      setBookings(prev => prev.filter(b => b.id !== booking.id));
      setTrips(prev => prev.map(trip => {
        if (trip.id !== booking.tripId) return trip;
        return {
          ...trip,
          seats: trip.seats.map((s: any) =>
            seatIds.includes(s.id) ? { ...s, ...emptyData } : s
          ),
        };
      }));
    } catch (err) {
      console.error('Failed to delete booking:', err);
      alert(isVi ? 'Xóa vé thất bại. Vui lòng thử lại.' : 'Failed to delete ticket. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center">
          <Ticket size={24} className="text-purple-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{t.agent_bookings || 'Vé của tôi'}</h2>
          <p className="text-sm text-gray-400">{currentUser?.name}</p>
        </div>
      </div>

      {/* Info banner for POSTPAID agent */}
      <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 flex items-start gap-3">
        <AlertCircle size={16} className="text-purple-400 shrink-0 mt-0.5" />
        <p className="text-sm text-purple-700">{t.agent_postpaid_info || 'Là đại lý công nợ, bạn có thể chọn "Thanh toán sau" hoặc "Giữ vé".'}</p>
      </div>

      {/* Held Tickets Section */}
      <div className="space-y-3">
        <h3 className="font-bold text-gray-700 flex items-center gap-2">
          <Clock size={16} className="text-amber-500" />
          {t.agent_held_tickets || 'Vé giữ (có thể chỉnh sửa)'}
          <span className="ml-auto text-xs font-normal text-gray-400">
            {heldTickets.length} {isVi ? 'vé' : isJa ? '枚' : 'ticket(s)'}
          </span>
        </h3>
        <p className="text-xs text-gray-400">{t.agent_held_tickets_desc || 'Chỉ vé "Giữ vé" mới có thể chỉnh sửa hoặc xóa (trước 24h xe chạy).'}</p>

        {heldTickets.length === 0 && (
          <div className="bg-gray-50 rounded-2xl p-6 text-center text-gray-400 text-sm">
            {isVi ? 'Không có vé giữ nào.' : isJa ? '仮予約なし。' : 'No held tickets.'}
          </div>
        )}

        {heldTickets.map(booking => {
          const canEdit = canEditBooking(booking);
          return (
            <motion.div
              key={booking.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden"
            >
              <div className="bg-amber-50 px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">{t.ticket_code || 'Mã vé'} · {isVi ? 'Giữ vé' : 'Hold'}</p>
                  <p className="font-mono font-bold text-amber-800">{booking.ticketCode || `#${booking.id}`}</p>
                </div>
                <div className="flex gap-2">
                  {canEdit ? (
                    <>
                      <button
                        onClick={() => handleStartEdit(booking)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white rounded-xl text-xs font-bold hover:bg-blue-600 transition-all"
                      >
                        <Edit3 size={12} />
                        {t.agent_held_edit || 'Sửa'}
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(booking.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-xl text-xs font-bold hover:bg-red-600 transition-all"
                      >
                        <Trash2 size={12} />
                        {t.agent_held_delete || 'Xóa'}
                      </button>
                    </>
                  ) : (
                    <span className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-400 rounded-xl text-xs font-bold">
                      <Clock size={12} />
                      {t.agent_held_no_edit_time || 'Không thể sửa'}
                    </span>
                  )}
                </div>
              </div>
              <BookingCardBody booking={booking} language={language} />
            </motion.div>
          );
        })}
      </div>

      {/* Confirmed / Issued Tickets */}
      <div className="space-y-3">
        <h3 className="font-bold text-gray-700 flex items-center gap-2">
          <CheckCircle size={16} className="text-emerald-500" />
          {isVi ? 'Vé đã xuất / Thanh toán sau' : isJa ? '発行済みチケット' : 'Issued / Pay-Later Tickets'}
          <span className="ml-auto text-xs font-normal text-gray-400">
            {confirmedTickets.length} {isVi ? 'vé' : isJa ? '枚' : 'ticket(s)'}
          </span>
        </h3>
        <p className="text-xs text-gray-400">
          {isVi
            ? 'Các vé này đã xuất cho khách hàng và tính vào công nợ của bạn.'
            : isJa
            ? 'これらのチケットは顧客に発行され、負債として計上されます。'
            : 'These tickets have been issued to customers and count toward your account balance.'}
        </p>

        {confirmedTickets.length === 0 && (
          <div className="bg-gray-50 rounded-2xl p-6 text-center text-gray-400 text-sm">
            {isVi ? 'Chưa có vé nào.' : isJa ? 'チケットなし。' : 'No tickets.'}
          </div>
        )}

        {confirmedTickets.slice(0, 20).map(booking => (
          <motion.div
            key={booking.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
          >
            <div className="bg-emerald-50 px-5 py-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
                  {t.ticket_code || 'Mã vé'} · {booking.paymentMethod || ''}
                </p>
                <p className="font-mono font-bold text-emerald-800">{booking.ticketCode || `#${booking.id}`}</p>
              </div>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">
                {isVi ? 'Đã xác nhận' : isJa ? '確認済み' : 'Confirmed'}
              </span>
            </div>
            <BookingCardBody booking={booking} language={language} />
          </motion.div>
        ))}
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-bold text-gray-800 text-lg">{t.agent_held_delete || 'Xóa vé giữ'}</h3>
            <p className="text-sm text-gray-500">{t.agent_held_delete_confirm || 'Bạn có chắc muốn xóa vé giữ này không? Ghế sẽ được trả về trống.'}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all"
              >
                {isVi ? 'Hủy' : isJa ? 'キャンセル' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  const booking = heldTickets.find(b => b.id === deleteConfirmId);
                  if (booking) handleDelete(booking);
                }}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold text-sm hover:bg-red-600 transition-all"
              >
                {isVi ? 'Xóa vé' : isJa ? '削除' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingBooking && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-blue-600 px-6 py-4 text-white">
              <p className="font-bold text-lg">{t.agent_held_edit || 'Chỉnh sửa vé giữ'}</p>
              <p className="text-blue-100 text-xs">{editingBooking.ticketCode || `#${editingBooking.id}`}</p>
            </div>
            <div className="p-6 space-y-4">
              {[
                { key: 'customerName', label: isVi ? 'Tên khách hàng' : 'Customer Name' },
                { key: 'phone', label: isVi ? 'Số điện thoại' : 'Phone' },
                { key: 'pickupPoint', label: isVi ? 'Điểm đón' : 'Pickup Point' },
                { key: 'dropoffPoint', label: isVi ? 'Điểm trả' : 'Dropoff Point' },
                { key: 'bookingNote', label: isVi ? 'Ghi chú' : 'Note' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">{label}</label>
                  <input
                    type="text"
                    value={editForm[key] || ''}
                    onChange={e => setEditForm((prev: any) => ({ ...prev, [key]: e.target.value }))}
                    className="w-full mt-1 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30"
                  />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setEditingBooking(null)}
                  disabled={saving}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all"
                >
                  {isVi ? 'Hủy' : isJa ? 'キャンセル' : 'Cancel'}
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className={cn(
                    'flex-[2] py-3 rounded-xl font-bold text-sm text-white transition-all',
                    saving ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200'
                  )}
                >
                  {saving ? (isVi ? 'Đang lưu...' : 'Saving...') : (isVi ? 'Lưu thay đổi' : isJa ? '保存' : 'Save Changes')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Booking card body (shared) ─────────────────────────────────────────────

const BookingCardBody: React.FC<{ booking: any; language: Language }> = ({ booking, language }) => {
  const t = TRANSLATIONS[language];
  const isFreeSeating = booking.freeSeating;
  const seatDisplay = isFreeSeating
    ? (language === 'vi' ? 'Ghế tự do' : language === 'ja' ? '自由席' : 'Free Seating')
    : (booking.seatIds && booking.seatIds.length > 1 ? booking.seatIds.join(', ') : booking.seatId || '');

  return (
    <div className="px-5 py-4 space-y-3">
      <div className="flex items-center gap-2">
        <MapPin size={13} className="text-gray-400 shrink-0" />
        <span className="text-sm font-bold text-gray-700">{booking.route}</span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div>
          <p className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">{t.date || 'Ngày'}</p>
          <p className="font-bold text-gray-700">{booking.date}</p>
        </div>
        <div>
          <p className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">{t.departure || 'Giờ'}</p>
          <p className="font-bold text-gray-700">{booking.time}</p>
        </div>
        <div>
          <p className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">{t.seat || 'Ghế'}</p>
          <p className={`font-bold ${isFreeSeating ? 'text-blue-500' : 'text-daiichi-red'}`}>{seatDisplay}</p>
        </div>
      </div>
      <div className="flex items-center justify-between pt-1 border-t border-gray-50">
        <span className="text-sm font-medium text-gray-500">{booking.customerName}</span>
        <span className="text-lg font-bold text-daiichi-red">{(booking.amount || 0).toLocaleString()}đ</span>
      </div>
    </div>
  );
};
