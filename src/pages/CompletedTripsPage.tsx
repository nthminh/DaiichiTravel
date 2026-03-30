import React from 'react';
import { Search, Filter, X, Download, FileText, Users, Copy, Edit3, Trash2, SlidersHorizontal, Check, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { buildStopNameByOrder, getSegmentInfo as getSegmentInfoUtil } from '../lib/segmentUtils';
import { getLocalDateString, getOffsetDayLabel } from '../lib/utils';
import { TRANSLATIONS, Language, TripStatus, SeatStatus } from '../constants/translations';
import { Trip, Route, TripAddon, User, UserRole } from '../types';
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
  passengerColVisibility: { ticketCode: boolean; seat: boolean; name: boolean; phone: boolean; segment: boolean; pickup: boolean; dropoff: boolean; status: boolean; price: boolean; note: boolean };
  setPassengerColVisibility: React.Dispatch<React.SetStateAction<{ ticketCode: boolean; seat: boolean; name: boolean; phone: boolean; segment: boolean; pickup: boolean; dropoff: boolean; status: boolean; price: boolean; note: boolean }>>;
  showPassengerColPanel: boolean;
  setShowPassengerColPanel: React.Dispatch<React.SetStateAction<boolean>>;
  showTripAddons: Trip | null;
  setShowTripAddons: React.Dispatch<React.SetStateAction<Trip | null>>;
  showAddTripAddon: boolean;
  setShowAddTripAddon: (v: boolean) => void;
  tripAddonForm: { name: string; price: number; description: string; type: 'SIGHTSEEING' | 'TRANSPORT' | 'FOOD' | 'OTHER'; images: string[] };
  setTripAddonForm: React.Dispatch<React.SetStateAction<{ name: string; price: number; description: string; type: 'SIGHTSEEING' | 'TRANSPORT' | 'FOOD' | 'OTHER'; images: string[] }>>;
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
  handleUpdateTripAddon: (addonId: string) => void;
  uploadAddonImage?: (file: File) => Promise<string>;
  setSelectedTrip: (trip: Trip) => void;
  setPreviousTab: (tab: string) => void;
  setActiveTab: (tab: string) => void;
  currentUser?: User | null;
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
  handleUpdateTripAddon,
  uploadAddonImage,
  setSelectedTrip,
  setPreviousTab,
  setActiveTab,
  currentUser,
}: CompletedTripsPageProps) {
  const t = TRANSLATIONS[language];
  const isAdmin = currentUser?.role === UserRole.MANAGER;
  const [addonImageUploading, setAddonImageUploading] = React.useState(false);
  const [editingAddonId, setEditingAddonId] = React.useState<string | null>(null);
  const [addonUploadError, setAddonUploadError] = React.useState<string | null>(null);

  const handleAddonImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, setForm: (updater: (p: any) => any) => void) => {
    const file = e.target.files?.[0];
    if (!file || !uploadAddonImage) return;
    setAddonImageUploading(true);
    setAddonUploadError(null);
    try {
      const url = await uploadAddonImage(file);
      setForm((p: any) => ({ ...p, images: [...(p.images || []), url] }));
    } catch (err) {
      console.error('Addon image upload failed:', err);
      setAddonUploadError(language === 'vi' ? 'Tải ảnh thất bại. Vui lòng thử lại.' : language === 'ja' ? '画像のアップロードに失敗しました。再試行してください。' : 'Image upload failed. Please try again.');
    } finally {
      setAddonImageUploading(false);
      e.target.value = '';
    }
  };

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
        // Segment detection: find matched route to get total stop count
        const matchedRoute = routes.find(r => r.name === showTripPassengers.route);
        const totalStops = matchedRoute?.routeStops?.length ?? 0;
        const stopNameByOrder = buildStopNameByOrder(matchedRoute?.routeStops);
        const getSegmentInfo = (seat: any) => getSegmentInfoUtil(seat, totalStops, stopNameByOrder, language);
        return (
        <>
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
                    { key: 'segment', label: language === 'vi' ? 'Loại chặng' : 'Segment' },
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
              const partialCount = booked.filter((s: any) => getSegmentInfo(s).type !== 'full').length;
              return (
                <div className="px-6 py-3 bg-gray-50 flex flex-wrap gap-3 items-center flex-shrink-0 border-b border-gray-100">
                  <span className="text-sm font-bold text-gray-700">{language === 'vi' ? 'Tổng' : 'Total'}: {allSeats.length}</span>
                  <span className="text-sm font-bold text-green-600">✓ {language === 'vi' ? 'Đã thanh toán' : 'Paid'}: {paid.length}</span>
                  <span className="text-sm font-bold text-blue-600">◉ {language === 'vi' ? 'Đã đặt' : 'Booked'}: {booked.length - paid.length}</span>
                  <span className="text-sm font-bold text-gray-400">○ {language === 'vi' ? 'Còn trống' : 'Empty'}: {empty.length}</span>
                  {partialCount > 0 && <span className="text-sm font-bold text-orange-500">◈ {language === 'vi' ? 'Nửa chặng' : 'Partial'}: {partialCount}</span>}
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
                    {passengerColVisibility.segment && <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">{language === 'vi' ? 'Loại chặng' : 'Segment'}</th>}
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
                    const segInfo = getSegmentInfo(primarySeat);
                    return (
                      <tr key={rowKey} className={cn('hover:bg-gray-50', isEditing && 'bg-blue-50/60', isGroup && 'bg-amber-50/40', segInfo.type === 'partial' && 'border-l-2 border-orange-300', segInfo.type === 'multi' && 'border-l-2 border-purple-300')}>
                        <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                        {passengerColVisibility.ticketCode && <td className="px-4 py-3 font-mono text-xs font-bold text-daiichi-red">{ticketCode}</td>}
                        {passengerColVisibility.seat && <td className="px-4 py-3 font-bold">{seatIds}{isGroup && <span className="ml-1 text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-bold">👥 {group.seats.length}</span>}</td>}
                        {passengerColVisibility.name && <td className="px-4 py-3 font-medium">{primarySeat.customerName || '—'}</td>}
                        {passengerColVisibility.phone && <td className="px-4 py-3 text-gray-600">{primarySeat.customerPhone || '—'}</td>}
                        {passengerColVisibility.segment && <td className="px-4 py-3"><span className={cn('px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap', segInfo.type === 'full' ? 'bg-green-100 text-green-700' : segInfo.type === 'multi' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700')} title={segInfo.label}>{segInfo.label}</span></td>}
                        {passengerColVisibility.pickup && <td className="px-4 py-3 text-gray-600">{[primarySeat.pickupAddressDetail, primarySeat.pickupAddress, primarySeat.pickupStopAddress].filter(Boolean).join(' & ') || '—'}</td>}
                        {passengerColVisibility.dropoff && <td className="px-4 py-3 text-gray-600">{[primarySeat.dropoffAddressDetail, primarySeat.dropoffAddress, primarySeat.dropoffStopAddress].filter(Boolean).join(' & ') || '—'}</td>}
                        {passengerColVisibility.status && <td className="px-4 py-3"><span className={cn('px-2 py-1 rounded-full text-xs font-bold', rowStatus === SeatStatus.PAID ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700')}>{rowStatus === SeatStatus.PAID ? (language === 'vi' ? 'Đã TT' : 'Paid') : (language === 'vi' ? 'Đã đặt' : 'Booked')}</span></td>}
                        {passengerColVisibility.price && <td className="px-4 py-3 font-bold text-daiichi-red">{totalAmount.toLocaleString()}đ</td>}
                        {passengerColVisibility.note && <td className="px-4 py-3 text-gray-500 text-xs max-w-[140px] truncate">{primarySeat.bookingNote || '—'}</td>}
                        <td className="px-4 py-3"><div className="flex gap-1"><button onClick={() => { setEditingPassengerSeatId(primarySeat.id); setPassengerEditForm({ customerName: primarySeat.customerName || '', customerPhone: primarySeat.customerPhone || '', pickupAddress: primarySeat.pickupAddress || '', dropoffAddress: primarySeat.dropoffAddress || '', pickupAddressDetail: primarySeat.pickupAddressDetail || '', dropoffAddressDetail: primarySeat.dropoffAddressDetail || '', pickupStopAddress: primarySeat.pickupStopAddress || '', dropoffStopAddress: primarySeat.dropoffStopAddress || '', status: rowStatus, bookingNote: primarySeat.bookingNote || '' }); }} className="text-gray-400 hover:text-daiichi-red p-1 rounded" title={language === 'vi' ? 'Chỉnh sửa' : 'Edit'}><Edit3 size={14} /></button>{isAdmin && <button onClick={() => handleDeletePassenger(primarySeat.id)} className="text-gray-400 hover:text-red-600 p-1 rounded" title={language === 'vi' ? 'Xóa hành khách' : 'Remove passenger'}><Trash2 size={14} /></button>}</div></td>
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
        {/* Edit Passenger Modal */}
        {editingPassengerSeatId && (() => {
          const editingGroup = passengerGroups.find(g => g.seats[0].id === editingPassengerSeatId);
          const editSeatIds = editingGroup?.seats.map((s: any) => s.id).join(', ') || editingPassengerSeatId;
          const editTicketCode = editingGroup?.booking?.ticketCode || seatTicketCodeMap.get(editingPassengerSeatId) || '—';
          return (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
              <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                <div className="p-8 overflow-y-auto flex-1">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-2xl font-bold text-gray-800">
                        {language === 'vi' ? 'Chỉnh sửa hành khách' : 'Edit Passenger'}
                      </h3>
                      <p className="text-xs text-gray-400 mt-1">
                        {language === 'vi' ? 'Ghế' : 'Seat'}: {editSeatIds} • #{editTicketCode}
                      </p>
                    </div>
                    <button onClick={() => setEditingPassengerSeatId(null)} className="text-gray-400 hover:text-gray-600">
                      <X size={24} />
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Tên khách hàng' : 'Customer Name'}</label>
                      <input type="text" value={passengerEditForm.customerName}
                        onChange={e => setPassengerEditForm(p => ({ ...p, customerName: e.target.value }))}
                        className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Số điện thoại' : 'Phone'}</label>
                      <input type="text" value={passengerEditForm.customerPhone}
                        onChange={e => setPassengerEditForm(p => ({ ...p, customerPhone: e.target.value }))}
                        className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Điểm đón (tên điểm)' : 'Pickup Stop Name'}</label>
                      <input type="text" value={passengerEditForm.pickupAddress}
                        onChange={e => setPassengerEditForm(p => ({ ...p, pickupAddress: e.target.value }))}
                        className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" />
                      <input type="text" value={passengerEditForm.pickupAddressDetail}
                        onChange={e => setPassengerEditForm(p => ({ ...p, pickupAddressDetail: e.target.value }))}
                        placeholder={language === 'vi' ? 'Chi tiết (số nhà, tầng...)' : 'Detail (house no., floor...)'}
                        className="w-full mt-1 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" />
                      <input type="text" value={passengerEditForm.pickupStopAddress}
                        onChange={e => setPassengerEditForm(p => ({ ...p, pickupStopAddress: e.target.value }))}
                        placeholder={language === 'vi' ? 'Địa chỉ điểm đón' : 'Stop address'}
                        className="w-full mt-1 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Điểm trả (tên điểm)' : 'Dropoff Stop Name'}</label>
                      <input type="text" value={passengerEditForm.dropoffAddress}
                        onChange={e => setPassengerEditForm(p => ({ ...p, dropoffAddress: e.target.value }))}
                        className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" />
                      <input type="text" value={passengerEditForm.dropoffAddressDetail}
                        onChange={e => setPassengerEditForm(p => ({ ...p, dropoffAddressDetail: e.target.value }))}
                        placeholder={language === 'vi' ? 'Chi tiết (số nhà, tầng...)' : 'Detail (house no., floor...)'}
                        className="w-full mt-1 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" />
                      <input type="text" value={passengerEditForm.dropoffStopAddress}
                        onChange={e => setPassengerEditForm(p => ({ ...p, dropoffStopAddress: e.target.value }))}
                        placeholder={language === 'vi' ? 'Địa chỉ điểm trả' : 'Stop address'}
                        className="w-full mt-1 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Trạng thái' : 'Status'}</label>
                      <select value={passengerEditForm.status}
                        onChange={e => setPassengerEditForm(p => ({ ...p, status: e.target.value as SeatStatus }))}
                        className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/10">
                        <option value={SeatStatus.BOOKED}>{language === 'vi' ? 'Đã đặt' : 'Booked'}</option>
                        <option value={SeatStatus.PAID}>{language === 'vi' ? 'Đã thanh toán' : 'Paid'}</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Ghi chú' : 'Notes'}</label>
                      <textarea value={passengerEditForm.bookingNote}
                        onChange={e => setPassengerEditForm(p => ({ ...p, bookingNote: e.target.value }))}
                        rows={2}
                        className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/10 resize-none" />
                    </div>
                  </div>
                  <div className="flex gap-4 mt-8">
                    <button onClick={() => setEditingPassengerSeatId(null)}
                      className="flex-1 py-4 bg-gray-50 text-gray-500 rounded-2xl font-bold hover:bg-gray-100 transition-all">
                      {t.cancel}
                    </button>
                    <button onClick={handleSavePassengerEdit}
                      className="flex-1 py-4 bg-daiichi-red text-white rounded-2xl font-bold shadow-lg shadow-daiichi-red/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2">
                      <Check size={20} />
                      {t.save}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
        </>
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
              <button onClick={() => { setShowTripAddons(null); setShowAddTripAddon(false); setEditingAddonId(null); setAddonUploadError(null); }} className="p-2 hover:bg-gray-50 rounded-xl"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              {(showTripAddons.addons || []).length === 0 && !showAddTripAddon && (
                <p className="text-sm text-gray-400 text-center py-4">{language === 'vi' ? 'Chưa có dịch vụ kèm theo' : 'No add-on services yet'}</p>
              )}
              {(showTripAddons.addons || []).map((addon: TripAddon) => (
                <div key={addon.id} className={`flex items-start justify-between bg-gray-50 rounded-xl p-4 ${isAdmin ? 'cursor-pointer hover:bg-gray-100 transition-colors' : ''}`}
                  role={isAdmin ? 'button' : undefined}
                  tabIndex={isAdmin ? 0 : undefined}
                  onClick={isAdmin ? () => {
                    setEditingAddonId(addon.id);
                    setTripAddonForm({ name: addon.name, price: addon.price, description: addon.description || '', type: addon.type, images: addon.images || [] });
                    setShowAddTripAddon(true);
                    setAddonUploadError(null);
                  } : undefined}
                  onKeyDown={isAdmin ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setEditingAddonId(addon.id);
                      setTripAddonForm({ name: addon.name, price: addon.price, description: addon.description || '', type: addon.type, images: addon.images || [] });
                      setShowAddTripAddon(true);
                      setAddonUploadError(null);
                    }
                  } : undefined}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{addon.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{addon.type === 'SIGHTSEEING' ? t.addon_type_sightseeing : addon.type === 'TRANSPORT' ? t.addon_type_transport : addon.type === 'FOOD' ? t.addon_type_food : t.addon_type_other}</span>
                    </div>
                    {addon.description && <p className="text-xs text-gray-500 mt-0.5">{addon.description}</p>}
                    <p className="text-sm font-bold text-daiichi-red mt-1">+{addon.price.toLocaleString()}đ</p>
                    {(addon.images || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(addon.images || []).map((img, i) => (
                          <img key={i} src={img} alt={`${addon.name} - ${i + 1}`} className="w-14 h-14 object-cover rounded-lg border border-gray-200" referrerPolicy="no-referrer" />
                        ))}
                      </div>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteTripAddon(addon.id); }} aria-label={language === 'vi' ? 'Xóa dịch vụ' : 'Delete service'} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                    </div>
                  )}
                </div>
              ))}
              {showAddTripAddon ? (
                <div className="border border-dashed border-gray-200 rounded-xl p-4 space-y-3">
                  {editingAddonId && (
                    <p className="text-xs font-bold text-daiichi-red uppercase tracking-widest">{language === 'vi' ? 'Chỉnh sửa dịch vụ' : language === 'ja' ? 'サービスを編集' : 'Edit Service'}</p>
                  )}
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
                    {/* Image upload */}
                    <div className="col-span-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Hình ảnh dịch vụ' : language === 'ja' ? 'サービス画像' : 'Service Images'}</label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {(tripAddonForm.images || []).map((img, i) => (
                          <div key={i} className="relative">
                            <img src={img} alt={`${i + 1}`} className="w-16 h-16 object-cover rounded-xl border border-gray-200" referrerPolicy="no-referrer" />
                            <button type="button" aria-label={language === 'vi' ? 'Xóa ảnh' : 'Remove image'} onClick={() => setTripAddonForm(p => ({ ...p, images: p.images.filter((_, idx) => idx !== i) }))} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold">✕</button>
                          </div>
                        ))}
                        {uploadAddonImage && (
                          <label aria-label={language === 'vi' ? 'Thêm ảnh' : 'Add image'} className={`w-16 h-16 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-daiichi-red transition-colors ${addonImageUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            {addonImageUploading ? <Loader2 size={16} className="animate-spin text-gray-400" /> : <span className="text-gray-400 text-xl leading-none">+</span>}
                            <input type="file" accept="image/*" aria-label={language === 'vi' ? 'Chọn ảnh dịch vụ' : 'Select service image'} className="hidden" disabled={addonImageUploading} onChange={e => handleAddonImageUpload(e, setTripAddonForm)} />
                          </label>
                        )}
                      </div>
                      {addonUploadError && <p className="text-xs text-red-500 mt-1">{addonUploadError}</p>}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => { setShowAddTripAddon(false); setEditingAddonId(null); setTripAddonForm({ name: '', price: 0, description: '', type: 'OTHER', images: [] }); setAddonUploadError(null); }} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-600">{t.cancel}</button>
                    <button onClick={async () => {
                      if (editingAddonId) {
                        await handleUpdateTripAddon(editingAddonId);
                        setEditingAddonId(null);
                        setAddonUploadError(null);
                      } else {
                        handleAddTripAddon();
                      }
                    }} disabled={!tripAddonForm.name || addonImageUploading} className="px-4 py-2 bg-daiichi-red text-white text-sm rounded-xl font-bold disabled:opacity-50">{editingAddonId ? t.update : t.save}</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { setShowAddTripAddon(true); setEditingAddonId(null); setTripAddonForm({ name: '', price: 0, description: '', type: 'OTHER', images: [] }); }} className="w-full py-3 border border-dashed border-gray-200 rounded-xl text-sm font-bold text-gray-400 hover:text-daiichi-red hover:border-daiichi-red transition-colors">+ {t.add_addon}</button>
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
                      <button onClick={() => { setShowTripAddons({ ...trip }); setShowAddTripAddon(false); setTripAddonForm({ name: '', price: 0, description: '', type: 'OTHER', images: [] }); }} className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg hover:bg-blue-100 transition-colors">
                        <span>{(trip.addons || []).length}</span>
                        <span>{t.manage_addons}</span>
                      </button>
                    </td>}
                    <td className="px-6 py-4"><div className="flex gap-3 items-center"><button onClick={() => exportTripToExcelHandler(trip)} title={language === 'vi' ? 'Xuất Excel' : 'Export Excel'} className="text-green-600 hover:text-green-700 hover:bg-green-50 p-1 rounded"><Download size={16} /></button><button onClick={() => exportTripToPDFHandler(trip)} title={language === 'vi' ? 'Xuất PDF' : 'Export PDF'} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-1 rounded"><FileText size={16} /></button><button onClick={() => handleCopyTrip(trip)} title={t.copy_trip} className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 p-1 rounded"><Copy size={16} /></button><button onClick={() => handleStartEditTrip(trip)} className="text-gray-600 hover:text-daiichi-red"><Edit3 size={18} /></button>{isAdmin && <button onClick={() => handleDeleteTrip(trip.id)} className="text-gray-600 hover:text-red-600"><Trash2 size={18} /></button>}<NotePopover note={trip.note} onSave={(note) => handleSaveTripNote(trip.id, note)} language={language} /><button onClick={() => { setSelectedTrip(trip); setPreviousTab('completed-trips'); setActiveTab('seat-mapping'); }} className="text-daiichi-red hover:underline font-bold text-sm">{t.view_seats}</button></div></td>
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
