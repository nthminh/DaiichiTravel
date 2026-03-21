import React from 'react';
import { X, Edit3, Trash2, Search, Filter, Copy, Download, FileText, Users, Columns, SlidersHorizontal, Loader2, Clock, CheckCircle2, Info, GitMerge, AlertTriangle } from 'lucide-react';
import { cn, getLocalDateString } from '../lib/utils';
import { TRANSLATIONS, Language, TripStatus, SeatStatus } from '../constants/translations';
import { Trip, Route, Vehicle, Employee, PricePeriod } from '../types';
import { NotePopover } from '../components/NotePopover';
import { SearchableSelect } from '../components/SearchableSelect';
import { ResizableTh } from '../components/ResizableTh';
import { StatusBadge } from '../components/StatusBadge';

type TranslationRecord = typeof TRANSLATIONS['vi'];

interface OperationsPageProps {
  trips: Trip[];
  routes: Route[];
  vehicles: Vehicle[];
  bookings: any[];
  employees: Employee[];
  language: Language;
  t: TranslationRecord;
  tripSearch: string;
  setTripSearch: (v: string) => void;
  showTripAdvancedFilter: boolean;
  setShowTripAdvancedFilter: React.Dispatch<React.SetStateAction<boolean>>;
  tripFilterRoute: string;
  setTripFilterRoute: (v: string) => void;
  tripFilterStatus: string;
  setTripFilterStatus: (v: string) => void;
  tripFilterDateFrom: string;
  setTripFilterDateFrom: (v: string) => void;
  tripFilterDateTo: string;
  setTripFilterDateTo: (v: string) => void;
  tripFilterTime: string;
  setTripFilterTime: (v: string) => void;
  tripFilterVehicle: string;
  setTripFilterVehicle: (v: string) => void;
  tripFilterDriver: string;
  setTripFilterDriver: (v: string) => void;
  tripFilterSeatCount: string;
  setTripFilterSeatCount: (v: string) => void;
  showAddTrip: boolean;
  setShowAddTrip: (v: boolean) => void;
  editingTrip: Trip | null;
  setEditingTrip: (v: Trip | null) => void;
  isCopyingTrip: boolean;
  setIsCopyingTrip: (v: boolean) => void;
  tripForm: { time: string; date: string; route: string; licensePlate: string; driverName: string; price: number; agentPrice: number; seatCount: number; status: TripStatus };
  setTripForm: React.Dispatch<React.SetStateAction<{ time: string; date: string; route: string; licensePlate: string; driverName: string; price: number; agentPrice: number; seatCount: number; status: TripStatus }>>;
  showBatchAddTrip: boolean;
  setShowBatchAddTrip: (v: boolean) => void;
  batchTripForm: { dateFrom: string; dateTo: string; route: string; licensePlate: string; driverName: string; price: number; agentPrice: number; seatCount: number };
  setBatchTripForm: React.Dispatch<React.SetStateAction<{ dateFrom: string; dateTo: string; route: string; licensePlate: string; driverName: string; price: number; agentPrice: number; seatCount: number }>>;
  batchTimeSlots: string[];
  setBatchTimeSlots: React.Dispatch<React.SetStateAction<string[]>>;
  batchTripLoading: boolean;
  isSavingTrip: boolean;
  tripSaveError: string | null;
  setTripSaveError: (v: string | null) => void;
  showTripAddons: Trip | null;
  setShowTripAddons: React.Dispatch<React.SetStateAction<Trip | null>>;
  showAddTripAddon: boolean;
  setShowAddTripAddon: (v: boolean) => void;
  tripAddonForm: { name: string; price: number; description: string; type: 'SIGHTSEEING' | 'TRANSPORT' | 'FOOD' | 'OTHER' };
  setTripAddonForm: React.Dispatch<React.SetStateAction<{ name: string; price: number; description: string; type: 'SIGHTSEEING' | 'TRANSPORT' | 'FOOD' | 'OTHER' }>>;
  tripColWidths: { time: number; licensePlate: number; route: number; driver: number; status: number; options: number };
  setTripColWidths: React.Dispatch<React.SetStateAction<{ time: number; licensePlate: number; route: number; driver: number; status: number; options: number }>>;
  tripColVisibility: { time: boolean; licensePlate: boolean; route: boolean; driver: boolean; status: boolean; seats: boolean; passengers: boolean; addons: boolean };
  setTripColVisibility: React.Dispatch<React.SetStateAction<{ time: boolean; licensePlate: boolean; route: boolean; driver: boolean; status: boolean; seats: boolean; passengers: boolean; addons: boolean }>>;
  showTripColPanel: boolean;
  setShowTripColPanel: React.Dispatch<React.SetStateAction<boolean>>;
  showTripPassengers: Trip | null;
  setShowTripPassengers: (v: Trip | null) => void;
  editingPassengerSeatId: string | null;
  setEditingPassengerSeatId: (v: string | null) => void;
  passengerEditForm: { customerName: string; customerPhone: string; pickupAddress: string; dropoffAddress: string; pickupAddressDetail: string; dropoffAddressDetail: string; status: SeatStatus; bookingNote: string };
  setPassengerEditForm: React.Dispatch<React.SetStateAction<{ customerName: string; customerPhone: string; pickupAddress: string; dropoffAddress: string; pickupAddressDetail: string; dropoffAddressDetail: string; status: SeatStatus; bookingNote: string }>>;
  passengerColVisibility: { ticketCode: boolean; seat: boolean; name: boolean; phone: boolean; pickup: boolean; dropoff: boolean; status: boolean; price: boolean; note: boolean };
  setPassengerColVisibility: React.Dispatch<React.SetStateAction<{ ticketCode: boolean; seat: boolean; name: boolean; phone: boolean; pickup: boolean; dropoff: boolean; status: boolean; price: boolean; note: boolean }>>;
  showPassengerColPanel: boolean;
  setShowPassengerColPanel: React.Dispatch<React.SetStateAction<boolean>>;
  showAddonDetailTrip: Trip | null;
  setShowAddonDetailTrip: (v: Trip | null) => void;
  setSelectedTrip: (trip: Trip | null) => void;
  setPreviousTab: (tab: string) => void;
  setActiveTab: (tab: string) => void;
  compareTripDateTime: (a: { date?: string; time?: string }, b: { date?: string; time?: string }) => number;
  formatTripDisplayTime: (trip: { time: string; date?: string }) => string;
  buildSeatTicketCodeMap: (tripId: string) => Map<string, string>;
  buildPassengerGroups: (tripId: string, bookedSeats: any[]) => { booking: any; seats: any[] }[];
  handleClosePassengerModal: () => void;
  handleSavePassengerEdit: () => void;
  handleDeletePassenger: (seatId: string) => void;
  handleAddTripAddon: () => void;
  handleDeleteTripAddon: (addonId: string) => void;
  exportTripToExcelHandler: (trip: any) => void;
  exportTripToPDFHandler: (trip: any) => void;
  handleSaveTrip: () => void;
  handleStartEditTrip: (trip: Trip) => void;
  handleCopyTrip: (trip: Trip) => void;
  handleCopyTripsToDate: (trips: Trip[], date: string) => void;
  handleDeleteTrip: (id: string) => void;
  handleSaveTripNote: (id: string, note: string) => void;
  handleTripVehicleSelect: (licensePlate: string) => void;
  handleBatchVehicleSelect: (licensePlate: string) => void;
  handleBatchAddTrips: () => void;
  selectedTripIdsForMerge: string[];
  setSelectedTripIdsForMerge: React.Dispatch<React.SetStateAction<string[]>>;
  mergeLoading: boolean;
  mergeError: string | null;
  setMergeError: (v: string | null) => void;
  handleToggleTripForMerge: (tripId: string) => void;
  handleMergeTrips: () => Promise<boolean>;
  getRouteActivePeriod: (route: Route, date: string) => PricePeriod | null;
  isRouteValidForDate: (route: Route, date: string) => boolean;
  formatRouteOption: (route: Route, period: PricePeriod | null, lang: Language) => string;
}

export function OperationsPage({
  trips,
  routes,
  vehicles,
  bookings: _bookings,
  employees,
  language,
  t,
  tripSearch,
  setTripSearch,
  showTripAdvancedFilter,
  setShowTripAdvancedFilter,
  tripFilterRoute,
  setTripFilterRoute,
  tripFilterStatus,
  setTripFilterStatus,
  tripFilterDateFrom,
  setTripFilterDateFrom,
  tripFilterDateTo,
  setTripFilterDateTo,
  tripFilterTime,
  setTripFilterTime,
  tripFilterVehicle,
  setTripFilterVehicle,
  tripFilterDriver,
  setTripFilterDriver,
  tripFilterSeatCount,
  setTripFilterSeatCount,
  showAddTrip,
  setShowAddTrip,
  editingTrip,
  setEditingTrip,
  isCopyingTrip,
  setIsCopyingTrip,
  tripForm,
  setTripForm,
  showBatchAddTrip,
  setShowBatchAddTrip,
  batchTripForm,
  setBatchTripForm,
  batchTimeSlots,
  setBatchTimeSlots,
  batchTripLoading,
  isSavingTrip,
  tripSaveError,
  setTripSaveError,
  showTripAddons,
  setShowTripAddons,
  showAddTripAddon,
  setShowAddTripAddon,
  tripAddonForm,
  setTripAddonForm,
  tripColWidths,
  setTripColWidths,
  tripColVisibility,
  setTripColVisibility,
  showTripColPanel,
  setShowTripColPanel,
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
  showAddonDetailTrip: _showAddonDetailTrip,
  setShowAddonDetailTrip: _setShowAddonDetailTrip,
  setSelectedTrip,
  setPreviousTab,
  setActiveTab,
  compareTripDateTime,
  formatTripDisplayTime,
  buildSeatTicketCodeMap,
  buildPassengerGroups,
  handleClosePassengerModal,
  handleSavePassengerEdit,
  handleDeletePassenger,
  handleAddTripAddon,
  handleDeleteTripAddon,
  exportTripToExcelHandler,
  exportTripToPDFHandler,
  handleSaveTrip,
  handleStartEditTrip,
  handleCopyTrip,
  handleCopyTripsToDate: _handleCopyTripsToDate,
  handleDeleteTrip,
  handleSaveTripNote,
  handleTripVehicleSelect,
  handleBatchVehicleSelect,
  handleBatchAddTrips,
  selectedTripIdsForMerge,
  setSelectedTripIdsForMerge: _setSelectedTripIdsForMerge,
  mergeLoading,
  mergeError,
  setMergeError,
  handleToggleTripForMerge,
  handleMergeTrips,
  getRouteActivePeriod,
  isRouteValidForDate,
  formatRouteOption,
}: OperationsPageProps) {
  const [showMergeConfirm, setShowMergeConfirm] = React.useState(false);

  // Pre-compute active employee names (drivers first) for driver select
  const activeEmployeeNames = [
    ...employees.filter(e => e.role === 'DRIVER' && e.status === 'ACTIVE').map(e => e.name),
    ...employees.filter(e => e.role !== 'DRIVER' && e.status === 'ACTIVE').map(e => e.name),
  ];
  const availableSeatCounts = React.useMemo(
    () => Array.from(new Set(trips.filter(t => t.status !== TripStatus.COMPLETED).map(t => (t.seats || []).length))).filter(n => n > 0).sort((a, b) => a - b),
    [trips]
  );
  const filteredTrips = trips.filter(trip => {
    if (trip.status === TripStatus.COMPLETED) return false;
    // Quick dropdown filters
    if (tripFilterStatus !== 'ALL' && trip.status !== tripFilterStatus) return false;
    if (tripFilterRoute && trip.route !== tripFilterRoute) return false;
    if (tripFilterTime && trip.time !== tripFilterTime) return false;
    if (tripFilterVehicle && trip.licensePlate !== tripFilterVehicle) return false;
    if (tripFilterDriver && trip.driverName !== tripFilterDriver) return false;
    if (tripFilterSeatCount && (trip.seats || []).length !== parseInt(tripFilterSeatCount, 10)) return false;
    // Advanced date-range filters
    if (tripFilterDateFrom && trip.date && trip.date < tripFilterDateFrom) return false;
    if (tripFilterDateTo && trip.date && trip.date > tripFilterDateTo) return false;
    if (!tripSearch) return true;
    const q = tripSearch.toLowerCase();
    return (
      (trip.time || '').toLowerCase().includes(q) ||
      (trip.route || '').toLowerCase().includes(q) ||
      (trip.licensePlate || '').toLowerCase().includes(q) ||
      (trip.driverName || '').toLowerCase().includes(q)
    );
  }).sort((a, b) => compareTripDateTime(a, b));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">{t.operation_management}</h2>
        <div className="flex gap-2">
          {selectedTripIdsForMerge.length === 2 && (
            <button
              onClick={() => { setMergeError(null); setShowMergeConfirm(true); }}
              className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-orange-600 transition-colors"
            >
              <GitMerge size={16} />
              {language === 'vi' ? 'Ghép chuyến' : 'Merge Trips'}
            </button>
          )}
          {selectedTripIdsForMerge.length > 0 && (
            <button
              onClick={() => { _setSelectedTripIdsForMerge([]); setMergeError(null); }}
              className="flex items-center gap-1 border border-gray-300 text-gray-600 px-3 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              <X size={14} />
              {language === 'vi' ? 'Bỏ chọn' : 'Deselect'}
            </button>
          )}
          <button onClick={() => { setShowBatchAddTrip(true); setBatchTripForm({ dateFrom: '', dateTo: '', route: '', licensePlate: '', driverName: '', price: 0, agentPrice: 0, seatCount: 11 }); setBatchTimeSlots(['']); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm">⚡ {t.batch_add_trips}</button>
          <button onClick={() => { setShowAddTrip(true); setEditingTrip(null); setTripForm({ time: '', date: '', route: '', licensePlate: '', driverName: '', price: 0, agentPrice: 0, seatCount: 11, status: TripStatus.WAITING }); }} className="bg-daiichi-red text-white px-4 py-2 rounded-lg font-bold">+ {t.add_trip}</button>
        </div>
      </div>

      {/* Merge Trips Confirmation Modal */}
      {showMergeConfirm && (() => {
        const [primaryId, secondaryId] = selectedTripIdsForMerge;
        const primaryTrip = trips.find(t => t.id === primaryId);
        const secondaryTrip = trips.find(t => t.id === secondaryId);
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-[32px] p-8 max-w-md w-full space-y-5">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <GitMerge size={22} className="text-orange-500" />
                  {language === 'vi' ? 'Ghép chuyến xe' : 'Merge Trips'}
                </h3>
                <button onClick={() => { setShowMergeConfirm(false); setMergeError(null); }} className="p-2 hover:bg-gray-50 rounded-xl"><X size={20} /></button>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 space-y-3 text-sm">
                <p className="font-semibold text-orange-800">{language === 'vi' ? 'Chuyến chính (giữ lại):' : 'Primary trip (kept):'}</p>
                {primaryTrip && (
                  <div className="text-gray-700">
                    <span className="font-bold">{primaryTrip.time}</span> · {primaryTrip.route} · {primaryTrip.licensePlate}
                    <span className="ml-2 text-xs text-gray-500">({(primaryTrip.seats || []).filter(s => s.status !== SeatStatus.EMPTY).length} {language === 'vi' ? 'hành khách' : 'passengers'})</span>
                  </div>
                )}
                <p className="font-semibold text-orange-800">{language === 'vi' ? 'Chuyến phụ (sẽ bị xóa):' : 'Secondary trip (deleted):'}</p>
                {secondaryTrip && (
                  <div className="text-gray-700">
                    <span className="font-bold">{secondaryTrip.time}</span> · {secondaryTrip.route} · {secondaryTrip.licensePlate}
                    <span className="ml-2 text-xs text-gray-500">({(secondaryTrip.seats || []).filter(s => s.status !== SeatStatus.EMPTY).length} {language === 'vi' ? 'hành khách' : 'passengers'})</span>
                  </div>
                )}
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex gap-2 text-xs text-yellow-800">
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                <span>{language === 'vi'
                  ? 'Sau khi ghép, khách hàng không thể đặt vé online cho chuyến này. Họ chỉ có thể liên hệ nhà xe để đặt chỗ.'
                  : 'After merging, customers cannot book online for this trip. They must contact the bus company directly.'}</span>
              </div>
              {mergeError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 flex gap-2">
                  <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                  {mergeError}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setShowMergeConfirm(false); setMergeError(null); }} className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-2xl font-bold hover:bg-gray-50">{language === 'vi' ? 'Hủy' : 'Cancel'}</button>
                <button
                  onClick={async () => {
                    const success = await handleMergeTrips();
                    if (success) setShowMergeConfirm(false);
                  }}
                  disabled={mergeLoading}
                  className="flex-1 bg-orange-500 text-white py-3 rounded-2xl font-bold hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {mergeLoading ? <Loader2 size={16} className="animate-spin" /> : <GitMerge size={16} />}
                  {language === 'vi' ? 'Xác nhận ghép' : 'Confirm Merge'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Add/Edit Trip Modal */}
      {showAddTrip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[32px] p-8 max-w-lg w-full space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">
                {editingTrip
                  ? (language === 'vi' ? 'Chỉnh sửa chuyến' : 'Edit Trip')
                  : isCopyingTrip
                    ? `📋 ${t.copy_trip}`
                    : (language === 'vi' ? 'Thêm chuyến mới' : 'Add New Trip')}
              </h3>
              <button onClick={() => { setShowAddTrip(false); setEditingTrip(null); setIsCopyingTrip(false); }} className="p-2 hover:bg-gray-50 rounded-xl"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.departure_date}</label><input type="date" value={tripForm.date} min={editingTrip ? undefined : getLocalDateString(0)} onChange={e => {
                  const date = e.target.value;
                  const selectedRoute = routes.find(r => r.name === tripForm.route);
                  if (selectedRoute) {
                    const period = getRouteActivePeriod(selectedRoute, date);
                    const price = period ? period.price : selectedRoute.price;
                    const agentPrice = period ? period.agentPrice : (selectedRoute.agentPrice || 0);
                    setTripForm(p => ({ ...p, date, price, agentPrice }));
                  } else {
                    setTripForm(p => ({ ...p, date }));
                  }
                }} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.departure_time}</label><input type="time" value={tripForm.time} onChange={e => setTripForm(p => ({ ...p, time: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.ticket_price} (đ)</label><input type="number" min="0" value={tripForm.price} onChange={e => setTripForm(p => ({ ...p, price: parseInt(e.target.value) || 0 }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                <div><label className="text-[10px] font-bold text-orange-400 uppercase tracking-widest ml-1">{t.agent_price} (đ)</label><input type="number" min="0" value={tripForm.agentPrice} onChange={e => setTripForm(p => ({ ...p, agentPrice: parseInt(e.target.value) || 0 }))} className="w-full mt-1 px-4 py-3 bg-orange-50 border border-orange-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-200" /></div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.route_name}</label>
                {tripForm.date && (
                  <p className="text-[10px] text-blue-500 mt-0.5 ml-1">
                    {language === 'vi' ? '* Chỉ hiển thị tuyến có hiệu lực vào ngày đã chọn' : '* Only showing routes valid for selected date'}
                  </p>
                )}
                <select value={tripForm.route} onChange={e => {
                  const routeName = e.target.value;
                  const selectedRoute = routes.find(r => r.name === routeName);
                  if (selectedRoute) {
                    const period = getRouteActivePeriod(selectedRoute, tripForm.date);
                    const price = period ? period.price : selectedRoute.price;
                    const agentPrice = period ? period.agentPrice : (selectedRoute.agentPrice || 0);
                    setTripForm(p => ({ ...p, route: routeName, price, agentPrice }));
                  } else {
                    setTripForm(p => ({ ...p, route: routeName }));
                  }
                }} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none">
                  <option value="">{language === 'vi' ? '-- Chọn tuyến --' : '-- Select Route --'}</option>
                  {routes.filter(r => isRouteValidForDate(r, tripForm.date)).map(r => {
                    const period = getRouteActivePeriod(r, tripForm.date);
                    return <option key={r.id} value={r.name}>{formatRouteOption(r, period, language)}</option>;
                  })}
                </select>
              </div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.license_plate} <span className="normal-case font-normal text-gray-400">({language === 'vi' ? 'tùy chọn' : 'optional'})</span></label>
                <select value={tripForm.licensePlate} onChange={e => handleTripVehicleSelect(e.target.value)} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none">
                  <option value="">{language === 'vi' ? '-- Chọn xe (tùy chọn) --' : '-- Select Vehicle (optional) --'}</option>
                  {vehicles.map(v => <option key={v.id} value={v.licensePlate}>{v.licensePlate} - {v.type} ({v.seats} {t.seats})</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.driver}</label>
                <SearchableSelect
                  options={activeEmployeeNames}
                  value={tripForm.driverName}
                  onChange={(val) => setTripForm(p => ({ ...p, driverName: val }))}
                  placeholder={language === 'vi' ? 'Chọn hoặc nhập tên tài xế...' : 'Select or type driver name...'}
                  className="mt-1"
                />
              </div>
              {!editingTrip && (
                <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.seats}</label><input type="number" min="1" value={tripForm.seatCount} onChange={e => setTripForm(p => ({ ...p, seatCount: parseInt(e.target.value) || 11 }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
              )}
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.status}</label>
                <select value={tripForm.status} onChange={e => setTripForm(p => ({ ...p, status: e.target.value as TripStatus }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none">
                  <option value={TripStatus.WAITING}>{language === 'vi' ? 'Chờ khởi hành' : 'Waiting'}</option>
                  <option value={TripStatus.RUNNING}>{language === 'vi' ? 'Đang chạy' : 'Running'}</option>
                  <option value={TripStatus.COMPLETED}>{language === 'vi' ? 'Hoàn thành' : 'Completed'}</option>
                </select>
              </div>
            </div>
            {tripSaveError && (
              <div className="mx-1 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
                {tripSaveError}
              </div>
            )}
            <div className="flex justify-end gap-4 pt-2">
              <button onClick={() => { setShowAddTrip(false); setEditingTrip(null); setIsCopyingTrip(false); setTripSaveError(null); }} disabled={isSavingTrip} className="px-6 py-3 text-sm font-bold text-gray-400 hover:text-gray-600 disabled:opacity-50">{t.cancel}</button>
              <button onClick={handleSaveTrip} disabled={!tripForm.time || !tripForm.route || isSavingTrip} className="px-8 py-3 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/20 disabled:opacity-50 flex items-center gap-2">
                {isSavingTrip && <Loader2 size={16} className="animate-spin" />}
                {editingTrip ? t.save : isCopyingTrip ? t.create_copy : (language === 'vi' ? 'Thêm chuyến' : 'Add Trip')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Create Trips Modal */}
      {showBatchAddTrip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[32px] p-8 max-w-2xl w-full space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold">⚡ {t.batch_add_trips}</h3>
                <p className="text-sm text-gray-500 mt-1">{language === 'vi' ? 'Chọn khoảng ngày và nhiều khung giờ để tạo nhiều chuyến cùng lúc' : 'Select a date range and multiple time slots to create many trips at once'}</p>
              </div>
              <button onClick={() => setShowBatchAddTrip(false)} className="p-2 hover:bg-gray-50 rounded-xl"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.batch_date_from}</label>
                <input type="date" value={batchTripForm.dateFrom} min={getLocalDateString(0)} onChange={e => {
                  const dateFrom = e.target.value;
                  const selectedRoute = routes.find(r => r.name === batchTripForm.route);
                  if (selectedRoute) {
                    const period = getRouteActivePeriod(selectedRoute, dateFrom);
                    const price = period ? period.price : selectedRoute.price;
                    const agentPrice = period ? period.agentPrice : (selectedRoute.agentPrice || 0);
                    setBatchTripForm(p => ({ ...p, dateFrom, dateTo: p.dateTo && p.dateTo < dateFrom ? dateFrom : p.dateTo, price, agentPrice }));
                  } else {
                    setBatchTripForm(p => ({ ...p, dateFrom, dateTo: p.dateTo && p.dateTo < dateFrom ? dateFrom : p.dateTo }));
                  }
                }} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.batch_date_to}</label>
                <input type="date" value={batchTripForm.dateTo} min={batchTripForm.dateFrom || getLocalDateString(0)} onChange={e => {
                  setBatchTripForm(p => ({ ...p, dateTo: e.target.value }));
                }} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.select_times}</label>
                <div className="mt-2 space-y-2">
                  {batchTimeSlots.map((slot, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input type="time" value={slot} onChange={e => { const updated = [...batchTimeSlots]; updated[idx] = e.target.value; setBatchTimeSlots(updated); }} className="flex-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" />
                      {batchTimeSlots.length > 1 && (
                        <button onClick={() => setBatchTimeSlots(prev => prev.filter((_, i) => i !== idx))} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => setBatchTimeSlots(prev => [...prev, ''])} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-blue-600 hover:bg-blue-50 rounded-xl border border-dashed border-blue-200">
                    <span>+</span> {t.add_time_slot}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.route_name}</label>
                {batchTripForm.dateFrom && (
                  <p className="text-[10px] text-blue-500 mt-0.5 ml-1">
                    {language === 'vi' ? '* Giá hiển thị theo kỳ cao điểm (nếu có), ngày thường dùng giá mặc định' : '* Price shown by peak period (if any), regular dates use default price'}
                  </p>
                )}
                <select value={batchTripForm.route} onChange={e => {
                  const routeName = e.target.value;
                  const selectedRoute = routes.find(r => r.name === routeName);
                  if (selectedRoute) {
                    const period = getRouteActivePeriod(selectedRoute, batchTripForm.dateFrom);
                    const price = period ? period.price : selectedRoute.price;
                    const agentPrice = period ? period.agentPrice : (selectedRoute.agentPrice || 0);
                    setBatchTripForm(p => ({ ...p, route: routeName, price, agentPrice }));
                  } else {
                    setBatchTripForm(p => ({ ...p, route: routeName }));
                  }
                }} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none">
                  <option value="">{language === 'vi' ? '-- Chọn tuyến --' : '-- Select Route --'}</option>
                  {routes.filter(r => isRouteValidForDate(r, batchTripForm.dateFrom)).map(r => {
                    const period = getRouteActivePeriod(r, batchTripForm.dateFrom);
                    return <option key={r.id} value={r.name}>{formatRouteOption(r, period, language)}</option>;
                  })}
                </select>
              </div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.license_plate} <span className="normal-case font-normal text-gray-400">({language === 'vi' ? 'tùy chọn' : 'optional'})</span></label>
                <select value={batchTripForm.licensePlate} onChange={e => handleBatchVehicleSelect(e.target.value)} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none">
                  <option value="">{language === 'vi' ? '-- Chọn xe (tùy chọn) --' : '-- Select Vehicle (optional) --'}</option>
                  {vehicles.map(v => <option key={v.id} value={v.licensePlate}>{v.licensePlate} - {v.type} ({v.seats} {t.seats})</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.driver}</label>
                <SearchableSelect
                  options={activeEmployeeNames}
                  value={batchTripForm.driverName}
                  onChange={(val) => setBatchTripForm(p => ({ ...p, driverName: val }))}
                  placeholder={language === 'vi' ? 'Chọn hoặc nhập tên tài xế...' : 'Select or type driver name...'}
                  className="mt-1"
                />
              </div>
              <div className="col-span-2 grid grid-cols-2 gap-4">
                <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.ticket_price} (đ)</label><input type="number" min="0" value={batchTripForm.price} onChange={e => setBatchTripForm(p => ({ ...p, price: parseInt(e.target.value) || 0 }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                <div><label className="text-[10px] font-bold text-orange-400 uppercase tracking-widest ml-1">{t.agent_price} (đ)</label><input type="number" min="0" value={batchTripForm.agentPrice} onChange={e => setBatchTripForm(p => ({ ...p, agentPrice: parseInt(e.target.value) || 0 }))} className="w-full mt-1 px-4 py-3 bg-orange-50 border border-orange-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-200" /></div>
              </div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.seats}</label><input type="number" min="1" value={batchTripForm.seatCount} onChange={e => setBatchTripForm(p => ({ ...p, seatCount: parseInt(e.target.value) || 11 }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
            </div>
            {(() => {
              const validSlots = batchTimeSlots.filter(s => s);
              let dayCount = 0;
              if (batchTripForm.dateFrom && batchTripForm.dateTo && batchTripForm.dateTo >= batchTripForm.dateFrom) {
                const from = new Date(batchTripForm.dateFrom + 'T00:00:00');
                const to = new Date(batchTripForm.dateTo + 'T00:00:00');
                dayCount = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
              }
              const totalTrips = dayCount * validSlots.length;
              if (!batchTripForm.dateFrom || !batchTripForm.dateTo || validSlots.length === 0) return null;
              return (
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-sm font-bold text-blue-700 mb-2">
                    📋 {t.trips_to_create}: {dayCount} {language === 'vi' ? 'ngày' : 'days'} × {validSlots.length} {language === 'vi' ? 'khung giờ' : 'time slots'} = <span className="text-blue-900">{totalTrips} {language === 'vi' ? 'chuyến' : 'trips'}</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {validSlots.map((slot, i) => (
                      <span key={i} className="px-3 py-1 bg-white text-blue-700 text-xs font-bold rounded-full border border-blue-200">{slot}</span>
                    ))}
                  </div>
                  {dayCount > 0 && (
                    <p className="text-xs text-blue-500 mt-2">{batchTripForm.dateFrom} → {batchTripForm.dateTo}</p>
                  )}
                </div>
              );
            })()}
            <div className="flex justify-end gap-4 pt-2">
              <button onClick={() => setShowBatchAddTrip(false)} className="px-6 py-3 text-sm font-bold text-gray-400 hover:text-gray-600">{t.cancel}</button>
              {(() => {
                const validSlots = batchTimeSlots.filter(s => s).length;
                let dayCount = 0;
                if (batchTripForm.dateFrom && batchTripForm.dateTo && batchTripForm.dateTo >= batchTripForm.dateFrom) {
                  const from = new Date(batchTripForm.dateFrom + 'T00:00:00');
                  const to = new Date(batchTripForm.dateTo + 'T00:00:00');
                  dayCount = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
                }
                const totalTrips = dayCount * validSlots;
                const isDisabled = batchTripLoading || !batchTripForm.dateFrom || !batchTripForm.dateTo || batchTripForm.dateTo < batchTripForm.dateFrom || !batchTripForm.route || validSlots === 0;
                return (
                  <button onClick={handleBatchAddTrips} disabled={isDisabled} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center gap-2">
                    {batchTripLoading && <span className="animate-spin">⚡</span>}
                    {language === 'vi' ? `Tạo ${totalTrips} chuyến` : `Create ${totalTrips} Trips`}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

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
              {(showTripAddons.addons || []).map(addon => (
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

      {/* Quick Dropdown Filters: route, time, vehicle, driver */}
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={tripFilterRoute}
          onChange={e => setTripFilterRoute(e.target.value)}
          className={cn('px-3 py-2 rounded-xl text-xs font-bold border transition-all focus:outline-none', tripFilterRoute ? 'bg-daiichi-red text-white border-daiichi-red' : 'bg-white text-gray-600 border-gray-200 hover:border-daiichi-red/40')}
        >
          <option value="">{t.all_routes}</option>
          {routes.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
        </select>
        <select
          value={tripFilterTime}
          onChange={e => setTripFilterTime(e.target.value)}
          className={cn('px-3 py-2 rounded-xl text-xs font-bold border transition-all focus:outline-none', tripFilterTime ? 'bg-daiichi-red text-white border-daiichi-red' : 'bg-white text-gray-600 border-gray-200 hover:border-daiichi-red/40')}
        >
          <option value="">{language === 'vi' ? 'Tất cả giờ' : 'All Times'}</option>
          {Array.from(new Set(trips.filter(t => t.status !== TripStatus.COMPLETED && t.time).map(t => t.time))).sort().map(time => (
            <option key={time} value={time}>{time}</option>
          ))}
        </select>
        <select
          value={tripFilterVehicle}
          onChange={e => setTripFilterVehicle(e.target.value)}
          className={cn('px-3 py-2 rounded-xl text-xs font-bold border transition-all focus:outline-none', tripFilterVehicle ? 'bg-daiichi-red text-white border-daiichi-red' : 'bg-white text-gray-600 border-gray-200 hover:border-daiichi-red/40')}
        >
          <option value="">{t.all_vehicles}</option>
          {vehicles.map(v => <option key={v.id} value={v.licensePlate}>{v.licensePlate}</option>)}
        </select>
        <select
          value={tripFilterDriver}
          onChange={e => setTripFilterDriver(e.target.value)}
          className={cn('px-3 py-2 rounded-xl text-xs font-bold border transition-all focus:outline-none', tripFilterDriver ? 'bg-daiichi-red text-white border-daiichi-red' : 'bg-white text-gray-600 border-gray-200 hover:border-daiichi-red/40')}
        >
          <option value="">{t.all_drivers}</option>
          {activeEmployeeNames.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
        <select
          value={tripFilterSeatCount}
          onChange={e => setTripFilterSeatCount(e.target.value)}
          className={cn('px-3 py-2 rounded-xl text-xs font-bold border transition-all focus:outline-none', tripFilterSeatCount ? 'bg-daiichi-red text-white border-daiichi-red' : 'bg-white text-gray-600 border-gray-200 hover:border-daiichi-red/40')}
        >
          <option value="">{language === 'vi' ? 'Tất cả ghế' : 'All Seats'}</option>
          {availableSeatCounts.map(count => (
            <option key={count} value={count}>{count} {language === 'vi' ? 'ghế' : 'seats'}</option>
          ))}
        </select>
        {(tripFilterRoute || tripFilterTime || tripFilterVehicle || tripFilterDriver || tripFilterSeatCount) && (
          <button
            onClick={() => { setTripFilterRoute(''); setTripFilterTime(''); setTripFilterVehicle(''); setTripFilterDriver(''); setTripFilterSeatCount(''); }}
            className="px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 bg-white text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all flex items-center gap-1"
          >
            <X size={12} /> {language === 'vi' ? 'Xóa lọc' : 'Clear'}
          </button>
        )}
      </div>

      {/* Search bar + Column Toggle */}
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
            <button onClick={() => setTripSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowTripColPanel(v => !v)}
          className={cn('flex items-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm transition-all border whitespace-nowrap', showTripColPanel ? 'bg-daiichi-red text-white border-daiichi-red' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50')}
        >
          <Columns size={16} />
          {language === 'vi' ? 'Tùy chỉnh cột' : 'Columns'}
        </button>
        <button
          onClick={() => setShowTripAdvancedFilter(v => !v)}
          className={cn('flex items-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm transition-all border whitespace-nowrap', showTripAdvancedFilter ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50')}
        >
          <Filter size={16} />
          {language === 'vi' ? 'Lọc nâng cao' : 'Advanced'}
        </button>
      </div>

      {/* Column Visibility Panel */}
      {showTripColPanel && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{language === 'vi' ? 'Hiển thị / ẩn cột' : 'Show / Hide Columns'}</p>
          <div className="flex flex-wrap gap-2">
            {([
              { key: 'time', label: language === 'vi' ? 'Giờ khởi hành' : 'Departure Time' },
              { key: 'licensePlate', label: language === 'vi' ? 'Biển số xe' : 'License Plate' },
              { key: 'route', label: language === 'vi' ? 'Tuyến' : 'Route' },
              { key: 'driver', label: language === 'vi' ? 'Tài xế' : 'Driver' },
              { key: 'status', label: language === 'vi' ? 'Trạng thái' : 'Status' },
              { key: 'seats', label: language === 'vi' ? 'Ghế còn' : 'Avail. Seats' },
              { key: 'passengers', label: language === 'vi' ? 'Hành khách' : 'Passengers' },
              { key: 'addons', label: language === 'vi' ? 'Dịch vụ thêm' : 'Add-ons' },
            ] as { key: keyof typeof tripColVisibility; label: string }[]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTripColVisibility(prev => ({ ...prev, [key]: !prev[key] }))}
                className={cn('px-3 py-1.5 rounded-xl text-xs font-bold border transition-all', tripColVisibility[key] ? 'bg-daiichi-red/10 text-daiichi-red border-daiichi-red/20' : 'bg-gray-50 text-gray-400 border-gray-200')}
              >
                {tripColVisibility[key] ? '✓ ' : ''}{label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Advanced Filter Panel */}
      {showTripAdvancedFilter && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Lọc nâng cao' : 'Advanced Filters'}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">{language === 'vi' ? 'Trạng thái' : 'Status'}</label>
              <select value={tripFilterStatus} onChange={e => setTripFilterStatus(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none">
                <option value="ALL">{language === 'vi' ? 'Tất cả' : 'All'}</option>
                <option value={TripStatus.WAITING}>{language === 'vi' ? 'Chờ khởi hành' : 'Waiting'}</option>
                <option value={TripStatus.RUNNING}>{language === 'vi' ? 'Đang chạy' : 'Running'}</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">{language === 'vi' ? 'Từ ngày' : 'From Date'}</label>
              <input type="date" value={tripFilterDateFrom} onChange={e => setTripFilterDateFrom(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">{language === 'vi' ? 'Đến ngày' : 'To Date'}</label>
              <input type="date" value={tripFilterDateTo} onChange={e => setTripFilterDateTo(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none" />
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={() => { setTripFilterRoute(''); setTripFilterTime(''); setTripFilterVehicle(''); setTripFilterDriver(''); setTripFilterSeatCount(''); setTripFilterStatus('ALL'); setTripFilterDateFrom(''); setTripFilterDateTo(''); }} className="px-4 py-2 text-sm font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl">
              {language === 'vi' ? 'Xóa bộ lọc' : 'Clear Filters'}
            </button>
          </div>
        </div>
      )}

      {/* Passenger List Modal */}
      {showTripPassengers && (() => {
        // Pre-compute ticketCode map and group seats by booking
        const seatTicketCodeMap = buildSeatTicketCodeMap(showTripPassengers.id);
        const bookedSeats = (showTripPassengers.seats || []).filter((s: any) => s.status !== SeatStatus.EMPTY);
        const passengerGroups = buildPassengerGroups(showTripPassengers.id, bookedSeats);
        return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[32px] w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-start px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <h3 className="text-xl font-bold">{language === 'vi' ? 'Danh sách hành khách' : 'Passenger List'}</h3>
                <p className="text-sm text-gray-500 mt-1">{showTripPassengers.route} · {formatTripDisplayTime(showTripPassengers)}{showTripPassengers.licensePlate ? ` · ${showTripPassengers.licensePlate}` : ''}</p>
              </div>
              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                <button
                  onClick={() => setShowPassengerColPanel(v => !v)}
                  className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all', showPassengerColPanel ? 'bg-daiichi-red/10 text-daiichi-red border-daiichi-red/20' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100')}
                  title={language === 'vi' ? 'Tùy chỉnh cột' : 'Customize columns'}
                >
                  <SlidersHorizontal size={13} />{language === 'vi' ? 'Cột' : 'Columns'}
                </button>
                <button onClick={handleClosePassengerModal} className="p-2 hover:bg-gray-50 rounded-xl"><X size={20} /></button>
              </div>
            </div>
            {/* Column visibility panel */}
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
                    <button
                      key={key}
                      onClick={() => setPassengerColVisibility(prev => ({ ...prev, [key]: !prev[key] }))}
                      className={cn('px-3 py-1.5 rounded-xl text-xs font-bold border transition-all', passengerColVisibility[key] ? 'bg-daiichi-red/10 text-daiichi-red border-daiichi-red/20' : 'bg-gray-50 text-gray-400 border-gray-200')}
                    >
                      {passengerColVisibility[key] ? '✓ ' : ''}{label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* Seat stats + export buttons */}
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
            {/* Passenger table – one row per booking group */}
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
                        {passengerColVisibility.pickup && <td className="px-4 py-3">
                          <input value={passengerEditForm.pickupAddress} onChange={e => setPassengerEditForm(p => ({ ...p, pickupAddress: e.target.value }))} className="w-full px-2 py-1.5 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder={language === 'vi' ? 'Tên điểm đón' : 'Stop name'} />
                          <input value={passengerEditForm.pickupAddressDetail} onChange={e => setPassengerEditForm(p => ({ ...p, pickupAddressDetail: e.target.value }))} className="mt-1 w-full px-2 py-1 bg-white border border-blue-100 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-200" placeholder={language === 'vi' ? 'Chi tiết (số nhà...)' : 'Detail (house no.)'} />
                        </td>}
                        {passengerColVisibility.dropoff && <td className="px-4 py-3">
                          <input value={passengerEditForm.dropoffAddress} onChange={e => setPassengerEditForm(p => ({ ...p, dropoffAddress: e.target.value }))} className="w-full px-2 py-1.5 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder={language === 'vi' ? 'Tên điểm trả' : 'Stop name'} />
                          <input value={passengerEditForm.dropoffAddressDetail} onChange={e => setPassengerEditForm(p => ({ ...p, dropoffAddressDetail: e.target.value }))} className="mt-1 w-full px-2 py-1 bg-white border border-blue-100 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-200" placeholder={language === 'vi' ? 'Chi tiết (số nhà...)' : 'Detail (house no.)'} />
                        </td>}
                        {passengerColVisibility.status && <td className="px-4 py-3">
                          <select value={passengerEditForm.status} onChange={e => setPassengerEditForm(p => ({ ...p, status: e.target.value as SeatStatus }))} className="px-2 py-1.5 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none">
                            <option value={SeatStatus.BOOKED}>{language === 'vi' ? 'Đã đặt' : 'Booked'}</option>
                            <option value={SeatStatus.PAID}>{language === 'vi' ? 'Đã thanh toán' : 'Paid'}</option>
                          </select>
                        </td>}
                        {passengerColVisibility.price && <td className="px-4 py-3 font-bold text-daiichi-red">{totalAmount.toLocaleString()}đ</td>}
                        {passengerColVisibility.note && <td className="px-4 py-3"><input value={passengerEditForm.bookingNote} onChange={e => setPassengerEditForm(p => ({ ...p, bookingNote: e.target.value }))} className="w-full px-2 py-1.5 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" /></td>}
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button onClick={handleSavePassengerEdit} className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700">{t.save}</button>
                            <button onClick={() => setEditingPassengerSeatId(null)} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-200">{t.cancel}</button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={rowKey} className={cn('hover:bg-gray-50', isGroup && 'bg-amber-50/40')}>
                        <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                        {passengerColVisibility.ticketCode && <td className="px-4 py-3 font-mono text-xs font-bold text-daiichi-red">{ticketCode}</td>}
                        {passengerColVisibility.seat && <td className="px-4 py-3 font-bold">
                          {seatIds}
                          {isGroup && <span className="ml-1 text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-bold">👥 {group.seats.length}</span>}
                        </td>}
                        {passengerColVisibility.name && <td className="px-4 py-3 font-medium">{primarySeat.customerName || '—'}</td>}
                        {passengerColVisibility.phone && <td className="px-4 py-3 text-gray-600">{primarySeat.customerPhone || '—'}</td>}
                        {passengerColVisibility.pickup && <td className="px-4 py-3 text-gray-600"><div>{primarySeat.pickupAddress || '—'}</div>{primarySeat.pickupAddressDetail && <div className="text-xs text-gray-400">{primarySeat.pickupAddressDetail}</div>}</td>}
                        {passengerColVisibility.dropoff && <td className="px-4 py-3 text-gray-600"><div>{primarySeat.dropoffAddress || '—'}</div>{primarySeat.dropoffAddressDetail && <div className="text-xs text-gray-400">{primarySeat.dropoffAddressDetail}</div>}</td>}
                        {passengerColVisibility.status && <td className="px-4 py-3">
                          <span className={cn('px-2 py-1 rounded-full text-xs font-bold', rowStatus === SeatStatus.PAID ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700')}>
                            {rowStatus === SeatStatus.PAID ? (language === 'vi' ? 'Đã TT' : 'Paid') : (language === 'vi' ? 'Đã đặt' : 'Booked')}
                          </span>
                        </td>}
                        {passengerColVisibility.price && <td className="px-4 py-3 font-bold text-daiichi-red">{totalAmount.toLocaleString()}đ</td>}
                        {passengerColVisibility.note && <td className="px-4 py-3 text-gray-500 text-xs max-w-[140px] truncate">{primarySeat.bookingNote || '—'}</td>}
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                setEditingPassengerSeatId(primarySeat.id);
                                setPassengerEditForm({
                                  customerName: primarySeat.customerName || '',
                                  customerPhone: primarySeat.customerPhone || '',
                                  pickupAddress: primarySeat.pickupAddress || '',
                                  dropoffAddress: primarySeat.dropoffAddress || '',
                                  pickupAddressDetail: primarySeat.pickupAddressDetail || '',
                                  dropoffAddressDetail: primarySeat.dropoffAddressDetail || '',
                                  status: rowStatus,
                                  bookingNote: primarySeat.bookingNote || '',
                                });
                              }}
                              className="text-gray-400 hover:text-daiichi-red p-1 rounded"
                              title={language === 'vi' ? 'Chỉnh sửa' : 'Edit'}
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeletePassenger(primarySeat.id)}
                              className="text-gray-400 hover:text-red-600 p-1 rounded"
                              title={language === 'vi' ? 'Xóa hành khách' : 'Remove passenger'}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
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

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-3 py-4 w-8"></th>
              {tripColVisibility.time && <ResizableTh width={tripColWidths.time} onResize={(w) => setTripColWidths(p => ({ ...p, time: w }))} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{t.departure_time}</ResizableTh>}
              {tripColVisibility.licensePlate && <ResizableTh width={tripColWidths.licensePlate} onResize={(w) => setTripColWidths(p => ({ ...p, licensePlate: w }))} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{t.license_plate}</ResizableTh>}
              {tripColVisibility.route && <ResizableTh width={tripColWidths.route} onResize={(w) => setTripColWidths(p => ({ ...p, route: w }))} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{t.route_column}</ResizableTh>}
              {tripColVisibility.driver && <ResizableTh width={tripColWidths.driver} onResize={(w) => setTripColWidths(p => ({ ...p, driver: w }))} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{t.driver}</ResizableTh>}
              {tripColVisibility.status && <ResizableTh width={tripColWidths.status} onResize={(w) => setTripColWidths(p => ({ ...p, status: w }))} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{t.status}</ResizableTh>}
              {tripColVisibility.seats && <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{language === 'vi' ? 'Ghế còn' : 'Avail.'}</th>}
              {tripColVisibility.passengers && <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{language === 'vi' ? 'Hành khách' : 'Passengers'}</th>}
              {tripColVisibility.addons && <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{t.trip_addons}</th>}
              <ResizableTh width={tripColWidths.options} onResize={(w) => setTripColWidths(p => ({ ...p, options: w }))} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{t.options}</ResizableTh>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredTrips.map((trip) => {
              const emptySeats = (trip.seats || []).filter((s: any) => s.status === SeatStatus.EMPTY).length;
              const bookedCount = (trip.seats || []).filter((s: any) => s.status !== SeatStatus.EMPTY).length;
              const totalSeats = (trip.seats || []).length;
              const goToSeatMap = () => { setSelectedTrip(trip); setPreviousTab('operations'); setActiveTab('seat-mapping'); };
              const openPassengerList = () => { setShowTripPassengers(trip); setEditingPassengerSeatId(null); };
              // A trip can be selected for merge only if it's free-seating and WAITING
              const isMergeable = trip.seatType === 'free' && trip.status === TripStatus.WAITING && !trip.isMerged;
              const isSelectedForMerge = selectedTripIdsForMerge.includes(trip.id);
              // When one trip is already selected, only trips with the same route, date and time are compatible
              const firstSelectedTrip = selectedTripIdsForMerge.length === 1
                ? trips.find(t => t.id === selectedTripIdsForMerge[0])
                : null;
              const isCompatibleWithSelected = !firstSelectedTrip || (
                trip.route === firstSelectedTrip.route &&
                trip.date === firstSelectedTrip.date &&
                trip.time === firstSelectedTrip.time
              );
              const isDisabledForMerge = !isMergeable || !isCompatibleWithSelected || (selectedTripIdsForMerge.length >= 2 && !isSelectedForMerge);
              return (
                <tr key={trip.id} className={cn('hover:bg-gray-50 cursor-pointer', isSelectedForMerge && 'bg-orange-50 hover:bg-orange-50')}>
                  <td className="px-3 py-4" onClick={e => e.stopPropagation()}>
                    {isMergeable && (
                      <input
                        type="checkbox"
                        checked={isSelectedForMerge}
                        disabled={isDisabledForMerge}
                        onChange={() => handleToggleTripForMerge(trip.id)}
                        className="w-4 h-4 accent-orange-500 cursor-pointer disabled:cursor-not-allowed"
                        title={language === 'vi' ? 'Chọn để ghép chuyến' : 'Select to merge'}
                      />
                    )}
                  </td>
                  {tripColVisibility.time && <td className="px-6 py-4 font-bold whitespace-nowrap" onClick={openPassengerList}>
                    <div className="flex flex-col gap-0.5">
                      <span>{formatTripDisplayTime(trip)}</span>
                      {trip.isMerged && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-full text-[10px] font-bold w-fit">
                          <GitMerge size={10} />
                          {language === 'vi' ? 'Đã ghép' : 'Merged'}
                        </span>
                      )}
                    </div>
                  </td>}
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
                  {tripColVisibility.status && <td className="px-6 py-4" onClick={openPassengerList}><StatusBadge status={trip.status} language={language} /></td>}
                  {tripColVisibility.seats && <td className="px-6 py-4" onClick={openPassengerList}>
                    <div className="flex flex-col gap-0.5">
                      <span className={cn('text-sm font-bold', emptySeats === 0 ? 'text-red-500' : emptySeats <= 3 ? 'text-orange-500' : 'text-green-600')}>{emptySeats}</span>
                      <span className="text-[10px] text-gray-400">{language === 'vi' ? `/${totalSeats} ghế` : `/${totalSeats} seats`}</span>
                    </div>
                  </td>}
                  {tripColVisibility.passengers && <td className="px-6 py-4">
                    <button
                      onClick={openPassengerList}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200 transition-colors"
                    >
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
                  <td className="px-6 py-4"><div className="flex gap-3 items-center"><button onClick={() => exportTripToExcelHandler(trip)} title={language === 'vi' ? 'Xuất Excel' : 'Export Excel'} className="text-green-600 hover:text-green-700 hover:bg-green-50 p-1 rounded"><Download size={16} /></button><button onClick={() => exportTripToPDFHandler(trip)} title={language === 'vi' ? 'Xuất PDF' : 'Export PDF'} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-1 rounded"><FileText size={16} /></button><button onClick={() => handleCopyTrip(trip)} title={t.copy_trip} className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 p-1 rounded"><Copy size={16} /></button><button onClick={() => handleStartEditTrip(trip)} className="text-gray-600 hover:text-daiichi-red"><Edit3 size={18} /></button><button onClick={() => handleDeleteTrip(trip.id)} className="text-gray-600 hover:text-red-600"><Trash2 size={18} /></button><NotePopover note={trip.note} onSave={(note) => handleSaveTripNote(trip.id, note)} language={language} /><button onClick={goToSeatMap} className="text-daiichi-red hover:underline font-bold text-sm">{t.view_seats}</button></div></td>
                </tr>
              );
            })}
            {filteredTrips.length === 0 && (
              <tr><td colSpan={Object.values(tripColVisibility).filter(Boolean).length + 2} className="px-6 py-10 text-center text-sm text-gray-400">{t.no_trips_found}</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
