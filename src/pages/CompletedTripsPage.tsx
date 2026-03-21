import React from 'react';
import { Search, Filter, X, Download, FileText, Users, Copy, Edit3, Trash2, SlidersHorizontal } from 'lucide-react';
import { cn } from '../lib/utils';
import { getLocalDateString, getOffsetDayLabel } from '../lib/utils';
import { TRANSLATIONS, Language, TripStatus, SeatStatus } from '../constants/translations';
import { Trip, Route, TripAddon } from '../types';
import { ResizableTh } from '../components/ResizableTh';
import { NotePopover } from '../components/NotePopover';

interface CompletedTripsPageProps {
  trips: Trip[];
  bookings: any[];
  routes: Route[];
  language: Language;
  tripSearch: string;
  setTripSearch: (v: string) => void;
  completedTripDateQuickFilter: string;
  setCompletedTripDateQuickFilter: (v: string) => void;
  showCompletedTripAdvancedFilter: boolean;
  setShowCompletedTripAdvancedFilter: React.Dispatch<React.SetStateAction<boolean>>;
  completedTripFilterRoute: string;
  setCompletedTripFilterRoute: (v: string) => void;
  completedTripFilterDateFrom: string;
  setCompletedTripFilterDateFrom: (v: string) => void;
  completedTripFilterDateTo: string;
  setCompletedTripFilterDateTo: (v: string) => void;
  showTripPassengers: Trip | null;
  setShowTripPassengers: (v: Trip | null) => void;
  editingPassengerSeatId: string | null;
  setEditingPassengerSeatId: (v: string | null) => void;
  passengerEditForm: { customerName: string; customerPhone: string; pickupAddress: string; dropoffAddress: string; pickupAddressDetail: string; dropoffAddressDetail: string; pickupStopAddress: string; dropoffStopAddress: string; status: SeatStatus; bookingNote: string };
  setPassengerEditForm: React.Dispatch<React.SetStateAction<{ customerName: string; customerPhone: string; pickupAddress: string; dropoffAddress: string; pickupAddressDetail: string; dropoffAddressDetail: string; pickupStopAddress: string; dropoffStopAddress: string; status: SeatStatus; bookingNote: string }>>;
  passengerColVisibility: { ticketCode: boolean; seat: boolean; name: boolean; phone: boolean; pickup: boolean; dropoff: boolean; status: boolean; price: boolean; note: boolean };
  setPassengerColVisibility: React.Dispatch<React.SetStateAction<{ ticketCode: boolean; seat: boolean; name: boolean; phone: boolean; pickup: boolean; dropoff: boolean; status: boolean; price: boolean; note: boolean }>>;
  showPassengerColPanel: boolean;
  setShowPassengerColPanel: React.Dispatch<React.SetStateAction<boolean>>;
  showTripAddons: Trip | null;
  setShowTripAddons: React.Dispatch<React.SetStateAction<Trip | null>>;
  showAddTripAddon: boolean;
  setShowAddTripAddon: (v: boolean) => void;
  tripAddonForm: { name: string; price: number; description: string; type: 'SIGHTSEEING' | 'TRANSPORT' | 'FOOD' | 'OTHER' };
  setTripAddonForm: React.Dispatch<React.SetStateAction<{ name: string; price: number; description: string; type: 'SIGHTSEEING' | 'TRANSPORT' | 'FOOD' | 'OTHER' }>>;
  tripColVisibility: { time: boolean; licensePlate: boolean; route: boolean; driver: boolean; status: boolean; seats: boolean; passengers: boolean; addons: boolean };
  tripColWidths: { time: number; licensePlate: number; route: number; driver: number; status: number; options: number };
  setTripColWidths: React.Dispatch<React.SetStateAction<{ time: number; licensePlate: number; route: number; driver: number; status: number; options: number }>>;
  formatTripDisplayTime: (trip: { time: string; date?: string }) => string;
  compareTripDateTime: (a: { date?: string; time?: string }, b: { date?: string; time?: string }) => number;
  buildSeatTicketCodeMap: (tripId: string) => Map<string, string>;
  buildPassengerGroups: (tripId: string, bookedSeats: any[]) => { booking: any; seats: any[] }[];
  handleClosePassengerModal: () => void;
  handleSavePassengerEdit: () => void;
  handleDeletePassenger: (seatId: string) => void;
  exportTripToExcelHandler: (trip: any) => void;
  exportTripToPDFHandler: (trip: any) => void;
  handleCopyTrip: (trip: Trip) => void;
  handleStartEditTrip: (trip: Trip) => void;
  handleDeleteTrip: (id: string) => void;
  handleSaveTripNote: (id: string, note: string) => void;
  handleAddTripAddon: () => void;
  handleDeleteTripAddon: (addonId: string) => void;
  setSelectedTrip: (trip: Trip) => void;
  setPreviousTab: (tab: string) => void;
  setActiveTab: (tab: string) => void;
}

export function CompletedTripsPage({
  trips,
  bookings,
  routes,
  language,
  tripSearch,
  setTripSearch,
  completedTripDateQuickFilter,
  setCompletedTripDateQuickFilter,
  showCompletedTripAdvancedFilter,
  setShowCompletedTripAdvancedFilter,
  completedTripFilterRoute,
  setCompletedTripFilterRoute,
  completedTripFilterDateFrom,
  setCompletedTripFilterDateFrom,
  completedTripFilterDateTo,
  setCompletedTripFilterDateTo,
  showTripPassengers,
  setShowTripPassengers,
  editingPassengerSeatId,
  setEditingPassengerSeatId,
  passengerEditForm,
  setPassengerEditForm,
  passengerColVisibility,
  setPassengerColVisibility,
  showPassengerColPanel,
  setShowPassengerColPanel,
  showTripAddons,
  setShowTripAddons,
  showAddTripAddon,
  setShowAddTripAddon,
  tripAddonForm,
  setTripAddonForm,
  tripColVisibility,
  tripColWidths,
  setTripColWidths,
  formatTripDisplayTime,
  compareTripDateTime,
  buildSeatTicketCodeMap,
  buildPassengerGroups,
  handleClosePassengerModal,
  handleSavePassengerEdit,
  handleDeletePassenger,
  exportTripToExcelHandler,
  exportTripToPDFHandler,
  handleCopyTrip,
  handleStartEditTrip,
  handleDeleteTrip,
  handleSaveTripNote,
  handleAddTripAddon,
  handleDeleteTripAddon,
  setSelectedTrip,
  setPreviousTab,
  setActiveTab,
}: CompletedTripsPageProps) {
  const t = TRANSLATIONS[language];

  const completedTrips = trips.filter(trip => {
    if (trip.status !== TripStatus.COMPLETED) return false;
    if (completedTripDateQuickFilter && trip.date !== completedTripDateQuickFilter) return false;
    if (completedTripFilterRoute && !(trip.route || '').toLowerCase().includes(completedTripFilterRoute.toLowerCase())) return false;
    if (completedTripFilterDateFrom && trip.date && trip.date < completedTripFilterDateFrom) return false;
    if (completedTripFilterDateTo && trip.date && trip.date > completedTripFilterDateTo) return false;
    if (!tripSearch) return true;
    const q = tripSearch.toLowerCase();
    return (
      (trip.time || '').toLowerCase().includes(q) ||
      (trip.route || '').toLowerCase().includes(q) ||
      (trip.licensePlate || '').toLowerCase().includes(q) ||
      (trip.driverName || '').toLowerCase().includes(q)
    );
  }).sort((a, b) => compareTripDateTime(b, a));

  return (
    <div className="space-y-6">
      {/* Passenger List Modal */}
      {showTripPassengers && (() => {
        const seatTicketCodeMap = buildSeatTicketCodeMap(showTripPassengers.id);
        const bookedSeats = (showTripPassengers.seats || []).filter((s: any) => s.status !== SeatStatus.EMPTY);
        const passengerGroups = buildPassengerGroups(showTripPassengers.id, bookedSeats);
        return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[32px] w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-start px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <h3 className="text-xl font-bold">{language === 'vi' ? 'Danh sách hành khách' : 'Passenger List'}</h3>
                <p className="text-sm text-gray-500 mt-1">{showTripPassengers.route} · {formatTripDisplayTime(showTripPassengers)}{showTripPassengers.licensePlate ? ` · ${showTripPassengers.licensePlate}` : ''}</p>
              </div>
              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                <button onClick={() => setShowPassengerColPanel(v => !v)} className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all', showPassengerColPanel ? 'bg-daiichi-red/10 text-daiichi-red border-daiichi-red/20' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100')} title={language === 'vi' ? 'Tùy chỉnh cột' : 'Customize columns'}><SlidersHorizontal size={13} />{language === 'vi' ? 'Cột' : 'Columns'}</button>
                <button onClick={handleClosePassengerModal} className="p-2 hover:bg-gray-50 rounded-xl"><X size={20} /></button>
              </div>
            </div>
            {showPassengerColPanel && (
              <div className="px-6 py-3 bg-white border-b border-gray-100 flex-shrink-0">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{language === 'vi' ? 'Hiển thị / ẩn cột' : 'Show / Hide Columns'}</p>
                <div className="flex flex-wrap gap-2">
                  {([
                    { key: 'ticketCode', label: language === 'vi' ? 'Mã vé' : 'Ticket Code' },
                    { key: 'seat', label: language === 'vi' ? 'Ghế' : 'Seat' },
                    { key: 'name', label: language === 'vi' ? 'Tên khách' : 'Name' },
                    { key: 'phone', label: language === 'vi' ? 'Số điện thoại' : 'Phone' },
                    { key: 'pickup', label: language === 'vi' ? 'Điểm đón' : 'Pickup' },
                    { key: 'dropoff', label: language === 'vi' ? 'Điểm trả' : 'Dropoff' },
                    { key: 'status', label: language === 'vi' ? 'Trạng thái' : 'Status' },
                    { key: 'price', label: language === 'vi' ? 'Giá vé' : 'Price' },
                    { key: 'note', label: language === 'vi' ? 'Ghi chú' : 'Note' },
                  ] as { key: keyof typeof passengerColVisibility; label: string }[]).map(({ key, label }) => (
                    <button key={key} onClick={() => setPassengerColVisibility(prev => ({ ...prev, [key]: !prev[key] }))} className={cn('px-3 py-1.5 rounded-xl text-xs font-bold border transition-all', passengerColVisibility[key] ? 'bg-daiichi-red/10 text-daiichi-red border-daiichi-red/20' : 'bg-gray-50 text-gray-400 border-gray-200')}>{passengerColVisibility[key] ? '✓ ' : ''}{label}</button>
                  ))}
                </div>
              </div>
            )}
            {(() => {
              const allSeats = showTripPassengers.seats || [];
              const booked = allSeats.filter((s: any) => s.status !== SeatStatus.EMPTY);
              const paid = allSeats.filter((s: any) => s.status === SeatStatus.PAID);
              const empty = allSeats.filter((s: any) => s.status === SeatStatus.EMPTY);
              return (
                <div className="px-6 py-3 bg-gray-50 flex flex-wrap gap-3 items-center flex-shrink-0 border-b border-gray-100">
                  <span className="text-sm font-bold text-gray-700">{language === 'vi' ? 'Tổng' : 'Total'}: {allSeats.length}</span>
                  <span className="text-sm font-bold text-green-600">✓ {language === 'vi' ? 'Đã thanh toán' : 'Paid'}: {paid.length}</span>
                  <span className="text-sm font-bold text-blue-600">◉ {language === 'vi' ? 'Đã đặt' : 'Booked'}: {booked.length - paid.length}</span>
                  <span className="text-sm font-bold text-gray-400">○ {language === 'vi' ? 'Còn trống' : 'Empty'}: {empty.length}</span>
                  <div className="ml-auto flex gap-2">
                    <button onClick={() => exportTripToExcelHandler(showTripPassengers)} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700"><Download size={12} /> Excel</button>
                    <button onClick={() => exportTripToPDFHandler(showTripPassengers)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700"><FileText size={12} /> PDF</button>
                  </div>
                </div>
              );
            })()}
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase w-10">STT</th>
                    {passengerColVisibility.ticketCode && <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">{language === 'vi' ? 'Mã vé' : 'Ticket Code'}</th>}
                    {passengerColVisibility.seat && <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">{language === 'vi' ? 'Ghế' : 'Seat'}</th>}
                    {passengerColVisibility.name && <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">{language === 'vi' ? 'Tên khách' : 'Name'}</th>}
                    {passengerColVisibility.phone && <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">{language === 'vi' ? 'Số điện thoại' : 'Phone'}</th>}
                    {passengerColVisibility.pickup && <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">{language === 'vi' ? 'Điểm đón' : 'Pickup'}</th>}
                    {passengerColVisibility.dropoff && <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">{language === 'vi' ? 'Điểm trả' : 'Dropoff'}</th>}
                    {passengerColVisibility.status && <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">{t.status}</th>}
                    {passengerColVisibility.price && <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">{language === 'vi' ? 'Giá vé' : 'Price'}</th>}
                    {passengerColVisibility.note && <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">{language === 'vi' ? 'Ghi chú' : 'Note'}</th>}
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase w-20">{t.options}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {passengerGroups.map((group, idx) => {
                    const primarySeat = group.seats[0];
                    const isGroup = group.seats.length > 1;
                    const seatIds = group.seats.map((s: any) => s.id).join(', ');
                    const ticketCode = group.booking?.ticketCode || seatTicketCodeMap.get(primarySeat.id) || '—';
                    const allPaid = group.seats.every((s: any) => s.status === SeatStatus.PAID);
                    const rowStatus = allPaid ? SeatStatus.PAID : SeatStatus.BOOKED;
                    const totalAmount = group.booking?.amount ?? (showTripPassengers.price || 0) * group.seats.length;
                    const isEditing = editingPassengerSeatId === primarySeat.id;
                    const rowKey = group.booking?.id || `${primarySeat.id}-${idx}`;
                    return isEditing ? (
                      <tr key={rowKey} className="bg-blue-50">
                        <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                        {passengerColVisibility.ticketCode && <td className="px-4 py-3 font-mono text-xs text-gray-500">{ticketCode}</td>}
                        {passengerColVisibility.seat && <td className="px-4 py-3 font-bold">{seatIds}</td>}
                        {passengerColVisibility.name && <td className="px-4 py-3"><input value={passengerEditForm.customerName} onChange={e => setPassengerEditForm(p => ({ ...p, customerName: e.target.value }))} className="w-full px-2 py-1.5 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" /></td>}
                        {passengerColVisibility.phone && <td className="px-4 py-3"><input value={passengerEditForm.customerPhone} onChange={e => setPassengerEditForm(p => ({ ...p, customerPhone: e.target.value }))} className="w-full px-2 py-1.5 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" /></td>}
                        {passengerColVisibility.pickup && <td className="px-4 py-3"><div className="space-y-1"><input value={passengerEditForm.pickupAddress} onChange={e => setPassengerEditForm(p => ({ ...p, pickupAddress: e.target.value }))} className="w-full px-2 py-1.5 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder={language === 'vi' ? 'Tên điểm đón' : 'Stop name'} /><input value={passengerEditForm.pickupAddressDetail} onChange={e => setPassengerEditForm(p => ({ ...p, pickupAddressDetail: e.target.value }))} className="w-full px-2 py-1 bg-white border border-blue-100 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-200" placeholder={language === 'vi' ? 'Chi tiết' : 'Detail'} /><input value={passengerEditForm.pickupStopAddress} onChange={e => setPassengerEditForm(p => ({ ...p, pickupStopAddress: e.target.value }))} className="w-full px-2 py-1 bg-white border border-blue-100 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-200" placeholder={language === 'vi' ? 'Địa chỉ điểm đón' : 'Stop address'} /></div></td>}
                        {passengerColVisibility.dropoff && <td className="px-4 py-3"><div className="space-y-1"><input value={passengerEditForm.dropoffAddress} onChange={e => setPassengerEditForm(p => ({ ...p, dropoffAddress: e.target.value }))} className="w-full px-2 py-1.5 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder={language === 'vi' ? 'Tên điểm trả' : 'Stop name'} /><input value={passengerEditForm.dropoffAddressDetail} onChange={e => setPassengerEditForm(p => ({ ...p, dropoffAddressDetail: e.target.value }))} className="w-full px-2 py-1 bg-white border border-blue-100 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-200" placeholder={language === 'vi' ? 'Chi tiết' : 'Detail'} /><input value={passengerEditForm.dropoffStopAddress} onChange={e => setPassengerEditForm(p => ({ ...p, dropoffStopAddress: e.target.value }))} className="w-full px-2 py-1 bg-white border border-blue-100 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-200" placeholder={language === 'vi' ? 'Địa chỉ điểm trả' : 'Stop address'} /></div></td>}
                        {passengerColVisibility.status && <td className="px-4 py-3"><select value={passengerEditForm.status} onChange={e => setPassengerEditForm(p => ({ ...p, status: e.target.value as SeatStatus }))} className="px-2 py-1.5 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none"><option value={SeatStatus.BOOKED}>{language === 'vi' ? 'Đã đặt' : 'Booked'}</option><option value={SeatStatus.PAID}>{language === 'vi' ? 'Đã thanh toán' : 'Paid'}</option></select></td>}
                        {passengerColVisibility.price && <td className="px-4 py-3 font-bold text-daiichi-red">{totalAmount.toLocaleString()}đ</td>}
                        {passengerColVisibility.note && <td className="px-4 py-3"><input value={passengerEditForm.bookingNote} onChange={e => setPassengerEditForm(p => ({ ...p, bookingNote: e.target.value }))} className="w-full px-2 py-1.5 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" /></td>}
                        <td className="px-4 py-3"><div className="flex gap-1"><button onClick={handleSavePassengerEdit} className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700">{t.save}</button><button onClick={() => setEditingPassengerSeatId(null)} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-200">{t.cancel}</button></div></td>
                      </tr>
                    ) : (
                      <tr key={rowKey} className={cn('hover:bg-gray-50', isGroup && 'bg-amber-50/40')}>
                        <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                        {passengerColVisibility.ticketCode && <td className="px-4 py-3 font-mono text-xs font-bold text-daiichi-red">{ticketCode}</td>}
                        {passengerColVisibility.seat && <td className="px-4 py-3 font-bold">{seatIds}{isGroup && <span className="ml-1 text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-bold">👥 {group.seats.length}</span>}</td>}
                        {passengerColVisibility.name && <td className="px-4 py-3 font-medium">{primarySeat.customerName || '—'}</td>}
                        {passengerColVisibility.phone && <td className="px-4 py-3 text-gray-600">{primarySeat.customerPhone || '—'}</td>}
                        {passengerColVisibility.pickup && <td className="px-4 py-3 text-gray-600">{[primarySeat.pickupAddressDetail, primarySeat.pickupAddress, primarySeat.pickupStopAddress].filter(Boolean).join(' & ') || '—'}</td>}
                        {passengerColVisibility.dropoff && <td className="px-4 py-3 text-gray-600">{[primarySeat.dropoffAddressDetail, primarySeat.dropoffAddress, primarySeat.dropoffStopAddress].filter(Boolean).join(' & ') || '—'}</td>}
                        {passengerColVisibility.status && <td className="px-4 py-3"><span className={cn('px-2 py-1 rounded-full text-xs font-bold', rowStatus === SeatStatus.PAID ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700')}>{rowStatus === SeatStatus.PAID ? (language === 'vi' ? 'Đã TT' : 'Paid') : (language === 'vi' ? 'Đã đặt' : 'Booked')}</span></td>}
                        {passengerColVisibility.price && <td className="px-4 py-3 font-bold text-daiichi-red">{totalAmount.toLocaleString()}đ</td>}
                        {passengerColVisibility.note && <td className="px-4 py-3 text-gray-500 text-xs max-w-[140px] truncate">{primarySeat.bookingNote || '—'}</td>}
                        <td className="px-4 py-3"><div className="flex gap-1"><button onClick={() => { setEditingPassengerSeatId(primarySeat.id); setPassengerEditForm({ customerName: primarySeat.customerName || '', customerPhone: primarySeat.customerPhone || '', pickupAddress: primarySeat.pickupAddress || '', dropoffAddress: primarySeat.dropoffAddress || '', pickupAddressDetail: primarySeat.pickupAddressDetail || '', dropoffAddressDetail: primarySeat.dropoffAddressDetail || '', pickupStopAddress: primarySeat.pickupStopAddress || '', dropoffStopAddress: primarySeat.dropoffStopAddress || '', status: rowStatus, bookingNote: primarySeat.bookingNote || '' }); }} className="text-gray-400 hover:text-daiichi-red p-1 rounded" title={language === 'vi' ? 'Chỉnh sửa' : 'Edit'}><Edit3 size={14} /></button><button onClick={() => handleDeletePassenger(primarySeat.id)} className="text-gray-400 hover:text-red-600 p-1 rounded" title={language === 'vi' ? 'Xóa hành khách' : 'Remove passenger'}><Trash2 size={14} /></button></div></td>
                      </tr>
                    );
                  })}
                  {passengerGroups.length === 0 && (
                    <tr><td colSpan={2 + Object.values(passengerColVisibility).filter(Boolean).length} className="px-4 py-10 text-center text-sm text-gray-400">{language === 'vi' ? 'Chưa có hành khách nào' : 'No passengers yet'}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Trip Add-ons Management Modal */}
      {showTripAddons && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[32px] p-8 max-w-lg w-full space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold">{t.manage_addons}</h3>
                <p className="text-sm text-gray-500 mt-1">{showTripAddons.time} · {showTripAddons.route}</p>
              </div>
              <button onClick={() => { setShowTripAddons(null); setShowAddTripAddon(false); }} className="p-2 hover:bg-gray-50 rounded-xl"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              {(showTripAddons.addons || []).length === 0 && !showAddTripAddon && (
                <p className="text-sm text-gray-400 text-center py-4">{language === 'vi' ? 'Chưa có dịch vụ kèm theo' : 'No add-on services yet'}</p>
              )}
              {(showTripAddons.addons || []).map((addon: TripAddon) => (
                <div key={addon.id} className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{addon.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{addon.type === 'SIGHTSEEING' ? t.addon_type_sightseeing : addon.type === 'TRANSPORT' ? t.addon_type_transport : addon.type === 'FOOD' ? t.addon_type_food : t.addon_type_other}</span>
                    </div>
                    {addon.description && <p className="text-xs text-gray-500 mt-0.5">{addon.description}</p>}
                    <p className="text-sm font-bold text-daiichi-red mt-1">+{addon.price.toLocaleString()}đ</p>
                  </div>
                  <button onClick={() => handleDeleteTripAddon(addon.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg ml-2"><Trash2 size={16} /></button>
                </div>
              ))}
              {showAddTripAddon ? (
                <div className="border border-dashed border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.addon_name}</label><input type="text" value={tripAddonForm.name} onChange={e => setTripAddonForm(p => ({ ...p, name: e.target.value }))} className="w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.addon_price} (đ)</label><input type="number" min="0" value={tripAddonForm.price} onChange={e => setTripAddonForm(p => ({ ...p, price: parseInt(e.target.value) || 0 }))} className="w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.addon_type}</label>
                      <select value={tripAddonForm.type} onChange={e => setTripAddonForm(p => ({ ...p, type: e.target.value as any }))} className="w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none">
                        <option value="SIGHTSEEING">{t.addon_type_sightseeing}</option>
                        <option value="TRANSPORT">{t.addon_type_transport}</option>
                        <option value="FOOD">{t.addon_type_food}</option>
                        <option value="OTHER">{t.addon_type_other}</option>
                      </select>
                    </div>
                    <div className="col-span-2"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.addon_desc}</label><input type="text" value={tripAddonForm.description} onChange={e => setTripAddonForm(p => ({ ...p, description: e.target.value }))} className="w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowAddTripAddon(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-600">{t.cancel}</button>
                    <button onClick={handleAddTripAddon} disabled={!tripAddonForm.name} className="px-4 py-2 bg-daiichi-red text-white text-sm rounded-xl font-bold disabled:opacity-50">{t.save}</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowAddTripAddon(true)} className="w-full py-3 border border-dashed border-gray-200 rounded-xl text-sm font-bold text-gray-400 hover:text-daiichi-red hover:border-daiichi-red transition-colors">+ {t.add_addon}</button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">{language === 'vi' ? 'Chuyến xe đã hoàn thành' : 'Completed Trips'}</h2>
          <p className="text-sm text-gray-500">{language === 'vi' ? 'Các chuyến đã kết thúc hoặc đã hoàn thành' : 'Trips that have ended or been completed'}</p>
        </div>
      </div>

      {/* Quick Date Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: language === 'vi' ? 'Tất cả' : 'All', value: '' },
          { label: language === 'vi' ? 'Hôm nay' : 'Today', value: getLocalDateString(0) },
          { label: language === 'vi' ? 'Hôm qua' : 'Yesterday', value: getLocalDateString(-1) },
          ...Array.from({ length: 5 }, (_, i) => ({
            label: getOffsetDayLabel(-i - 2),
            value: getLocalDateString(-i - 2),
          })),
        ].map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setCompletedTripDateQuickFilter(value)}
            className={cn('px-3 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap', completedTripDateQuickFilter === value ? 'bg-daiichi-red text-white border-daiichi-red' : 'bg-white text-gray-600 border-gray-200 hover:border-daiichi-red/40')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search bar + Advanced Filter Toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={tripSearch}
            onChange={e => setTripSearch(e.target.value)}
            placeholder={language === 'vi' ? 'Tìm kiếm chuyến xe, tuyến, biển số, tài xế...' : 'Search trips by route, plate, driver...'}
            className="w-full pl-11 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/20 shadow-sm"
          />
          {tripSearch && (
            <button onClick={() => setTripSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>
          )}
        </div>
        <button
          onClick={() => setShowCompletedTripAdvancedFilter(v => !v)}
          className={cn('flex items-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm transition-all border whitespace-nowrap', showCompletedTripAdvancedFilter ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50')}
        >
          <Filter size={16} />
          {language === 'vi' ? 'Lọc nâng cao' : 'Advanced'}
        </button>
      </div>

      {/* Advanced Filter Panel */}
      {showCompletedTripAdvancedFilter && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Lọc nâng cao' : 'Advanced Filters'}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">{language === 'vi' ? 'Tuyến đường' : 'Route'}</label>
              <input type="text" value={completedTripFilterRoute} onChange={e => setCompletedTripFilterRoute(e.target.value)} placeholder={language === 'vi' ? 'Lọc theo tuyến...' : 'Filter by route...'} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">{language === 'vi' ? 'Từ ngày' : 'From Date'}</label>
              <input type="date" value={completedTripFilterDateFrom} onChange={e => setCompletedTripFilterDateFrom(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">{language === 'vi' ? 'Đến ngày' : 'To Date'}</label>
              <input type="date" value={completedTripFilterDateTo} onChange={e => setCompletedTripFilterDateTo(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none" />
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={() => { setCompletedTripFilterRoute(''); setCompletedTripFilterDateFrom(''); setCompletedTripFilterDateTo(''); setCompletedTripDateQuickFilter(''); }} className="px-4 py-2 text-sm font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl">
              {language === 'vi' ? 'Xóa bộ lọc' : 'Clear Filters'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {tripColVisibility.time && <ResizableTh width={tripColWidths.time} onResize={(w) => setTripColWidths(p => ({ ...p, time: w }))} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{t.departure_time}</ResizableTh>}
                {tripColVisibility.licensePlate && <ResizableTh width={tripColWidths.licensePlate} onResize={(w) => setTripColWidths(p => ({ ...p, licensePlate: w }))} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{t.license_plate}</ResizableTh>}
                {tripColVisibility.route && <ResizableTh width={tripColWidths.route} onResize={(w) => setTripColWidths(p => ({ ...p, route: w }))} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{t.route_column}</ResizableTh>}
                {tripColVisibility.driver && <ResizableTh width={tripColWidths.driver} onResize={(w) => setTripColWidths(p => ({ ...p, driver: w }))} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{t.driver}</ResizableTh>}
                {tripColVisibility.seats && <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{language === 'vi' ? 'Ghế đã đặt' : 'Booked'}</th>}
                {tripColVisibility.passengers && <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{language === 'vi' ? 'Hành khách' : 'Passengers'}</th>}
                {tripColVisibility.addons && <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{t.trip_addons}</th>}
                <ResizableTh width={tripColWidths.options} onResize={(w) => setTripColWidths(p => ({ ...p, options: w }))} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{t.options}</ResizableTh>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {completedTrips.map((trip) => {
                const bookedSeats = (trip.seats || []).filter((s: any) => s.status !== SeatStatus.EMPTY);
                const bookedCount = bookedSeats.length;
                const totalSeats = (trip.seats || []).length;
                const openPassengerList = () => { setShowTripPassengers(trip); setEditingPassengerSeatId(null); };
                return (
                  <tr key={trip.id} className="hover:bg-gray-50 cursor-pointer">
                    {tripColVisibility.time && <td className="px-6 py-4 font-bold whitespace-nowrap" onClick={openPassengerList}>{formatTripDisplayTime(trip)}</td>}
                    {tripColVisibility.licensePlate && <td className="px-6 py-4 font-medium whitespace-nowrap" onClick={openPassengerList}>{trip.licensePlate}</td>}
                    {tripColVisibility.route && <td className="px-6 py-4 overflow-hidden" style={{ maxWidth: tripColWidths.route }} onClick={openPassengerList}>
                      {(() => {
                        const r = routes.find(rt => rt.name === trip.route);
                        return r ? (
                          <div>
                            <p className="font-semibold text-sm text-gray-800 truncate">{r.name}</p>
                            <p className="text-xs text-gray-500 truncate">{r.departurePoint} → {r.arrivalPoint}</p>
                          </div>
                        ) : <span className="text-sm text-gray-500 truncate block">{trip.route}</span>;
                      })()}
                    </td>}
                    {tripColVisibility.driver && <td className="px-6 py-4 text-gray-600 whitespace-nowrap" onClick={openPassengerList}>{trip.driverName}</td>}
                    {tripColVisibility.seats && <td className="px-6 py-4" onClick={openPassengerList}>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-bold text-gray-700">{bookedCount}</span>
                        <span className="text-[10px] text-gray-400">{language === 'vi' ? `/${totalSeats} ghế` : `/${totalSeats} seats`}</span>
                      </div>
                    </td>}
                    {tripColVisibility.passengers && <td className="px-6 py-4">
                      <button onClick={openPassengerList} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200 transition-colors">
                        <Users size={12} />
                        <span>{bookedCount}</span>
                      </button>
                    </td>}
                    {tripColVisibility.addons && <td className="px-6 py-4">
                      <button onClick={() => { setShowTripAddons({ ...trip }); setShowAddTripAddon(false); setTripAddonForm({ name: '', price: 0, description: '', type: 'OTHER' }); }} className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg hover:bg-blue-100 transition-colors">
                        <span>{(trip.addons || []).length}</span>
                        <span>{t.manage_addons}</span>
                      </button>
                    </td>}
                    <td className="px-6 py-4"><div className="flex gap-3 items-center"><button onClick={() => exportTripToExcelHandler(trip)} title={language === 'vi' ? 'Xuất Excel' : 'Export Excel'} className="text-green-600 hover:text-green-700 hover:bg-green-50 p-1 rounded"><Download size={16} /></button><button onClick={() => exportTripToPDFHandler(trip)} title={language === 'vi' ? 'Xuất PDF' : 'Export PDF'} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-1 rounded"><FileText size={16} /></button><button onClick={() => handleCopyTrip(trip)} title={t.copy_trip} className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 p-1 rounded"><Copy size={16} /></button><button onClick={() => handleStartEditTrip(trip)} className="text-gray-600 hover:text-daiichi-red"><Edit3 size={18} /></button><button onClick={() => handleDeleteTrip(trip.id)} className="text-gray-600 hover:text-red-600"><Trash2 size={18} /></button><NotePopover note={trip.note} onSave={(note) => handleSaveTripNote(trip.id, note)} language={language} /><button onClick={() => { setSelectedTrip(trip); setPreviousTab('completed-trips'); setActiveTab('seat-mapping'); }} className="text-daiichi-red hover:underline font-bold text-sm">{t.view_seats}</button></div></td>
                  </tr>
                );
              })}
              {completedTrips.length === 0 && (
                <tr><td colSpan={['time','licensePlate','route','driver','seats','passengers','addons'].filter(k => tripColVisibility[k as keyof typeof tripColVisibility]).length + 1} className="px-6 py-10 text-center text-sm text-gray-400">{language === 'vi' ? 'Chưa có chuyến nào hoàn thành' : 'No completed trips yet'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
