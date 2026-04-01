import React from 'react';
import { X, Edit3, Trash2, Search, Filter, Copy, Download, FileText, Users, Columns, SlidersHorizontal, Loader2, Clock, CheckCircle2, Info, GitMerge, AlertTriangle, Check, Lock, Unlock } from 'lucide-react';
import { cn, getLocalDateString } from '../lib/utils';
import { buildStopNameByOrder, getSegmentInfo as getSegmentInfoUtil } from '../lib/segmentUtils';
import { TRANSLATIONS, Language, TripStatus, SeatStatus } from '../constants/translations';
import { Trip, Route, Vehicle, Employee, PricePeriod, User, UserRole, TripAddon } from '../types';
import type { SerializedSeat } from '../lib/vehicleSeatUtils';
import { NotePopover } from '../components/NotePopover';
import { SearchableSelect } from '../components/SearchableSelect';
import { ResizableTh } from '../components/ResizableTh';
import { StatusBadge } from '../components/StatusBadge';
import { formatBookingDate } from '../lib/vnDate';
import { transportService } from '../services/transportService';

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
  tripFilterDate: string;
  setTripFilterDate: (v: string) => void;
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
  tripFilterDaysOfWeek: number[];
  setTripFilterDaysOfWeek: React.Dispatch<React.SetStateAction<number[]>>;
  showAddTrip: boolean;
  setShowAddTrip: (v: boolean) => void;
  editingTrip: Trip | null;
  setEditingTrip: (v: Trip | null) => void;
  isCopyingTrip: boolean;
  setIsCopyingTrip: (v: boolean) => void;
  tripForm: { time: string; date: string; route: string; licensePlate: string; driverName: string; price: number; agentPrice: number; discountPercent: number; seatCount: number; status: TripStatus };
  setTripForm: React.Dispatch<React.SetStateAction<{ time: string; date: string; route: string; licensePlate: string; driverName: string; price: number; agentPrice: number; discountPercent: number; seatCount: number; status: TripStatus }>>;
  showBatchAddTrip: boolean;
  setShowBatchAddTrip: (v: boolean) => void;
  batchTripForm: { dateFrom: string; dateTo: string; route: string; licensePlate: string; driverName: string; price: number; agentPrice: number; seatCount: number };
  setBatchTripForm: React.Dispatch<React.SetStateAction<{ dateFrom: string; dateTo: string; route: string; licensePlate: string; driverName: string; price: number; agentPrice: number; seatCount: number }>>;
  batchTimeSlots: string[];
  setBatchTimeSlots: React.Dispatch<React.SetStateAction<string[]>>;
  batchTripLoading: boolean;
  batchAddonServices: import('../types').TripAddon[];
  setBatchAddonServices: React.Dispatch<React.SetStateAction<import('../types').TripAddon[]>>;
  batchAddonForm: { name: string; price: number; description: string; type: 'SIGHTSEEING' | 'TRANSPORT' | 'FOOD' | 'OTHER'; images: string[] };
  setBatchAddonForm: React.Dispatch<React.SetStateAction<{ name: string; price: number; description: string; type: 'SIGHTSEEING' | 'TRANSPORT' | 'FOOD' | 'OTHER'; images: string[] }>>;
  showBatchAddonForm: boolean;
  setShowBatchAddonForm: (v: boolean) => void;
  isSavingTrip: boolean;
  tripSaveError: string | null;
  setTripSaveError: (v: string | null) => void;
  showTripAddons: Trip | null;
  setShowTripAddons: React.Dispatch<React.SetStateAction<Trip | null>>;
  showAddTripAddon: boolean;
  setShowAddTripAddon: (v: boolean) => void;
  tripAddonForm: { name: string; price: number; description: string; type: 'SIGHTSEEING' | 'TRANSPORT' | 'FOOD' | 'OTHER'; images: string[] };
  setTripAddonForm: React.Dispatch<React.SetStateAction<{ name: string; price: number; description: string; type: 'SIGHTSEEING' | 'TRANSPORT' | 'FOOD' | 'OTHER'; images: string[] }>>;
  tripColWidths: { time: number; licensePlate: number; route: number; driver: number; status: number; options: number };
  setTripColWidths: React.Dispatch<React.SetStateAction<{ time: number; licensePlate: number; route: number; driver: number; status: number; options: number }>>;
  tripColVisibility: { time: boolean; licensePlate: boolean; route: boolean; driver: boolean; status: boolean; passengers: boolean; addons: boolean };
  setTripColVisibility: React.Dispatch<React.SetStateAction<{ time: boolean; licensePlate: boolean; route: boolean; driver: boolean; status: boolean; passengers: boolean; addons: boolean }>>;
  showTripColPanel: boolean;
  setShowTripColPanel: React.Dispatch<React.SetStateAction<boolean>>;
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
  handleUpdateTripAddon: (addonId: string) => void;
  uploadAddonImage?: (file: File) => Promise<string>;
  exportTripToExcelHandler: (trip: any) => void;
  exportAllTripsToExcelHandler: (trips: Trip[]) => void;
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
  currentUser?: User | null;
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
  tripFilterDate,
  setTripFilterDate,
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
  tripFilterDaysOfWeek,
  setTripFilterDaysOfWeek,
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
  batchAddonServices,
  setBatchAddonServices,
  batchAddonForm,
  setBatchAddonForm,
  showBatchAddonForm,
  setShowBatchAddonForm,
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
  handleUpdateTripAddon,
  uploadAddonImage,
  exportTripToExcelHandler,
  exportAllTripsToExcelHandler,
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
  currentUser,
}: OperationsPageProps) {
  const isAdmin = currentUser?.role === UserRole.MANAGER;
  const [showMergeConfirm, setShowMergeConfirm] = React.useState(false);
  const [currentTripPage, setCurrentTripPage] = React.useState(1);
  const TRIPS_PER_PAGE = 50;
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

  const handleEditAddon = (addon: TripAddon) => {
    setEditingAddonId(addon.id);
    setTripAddonForm({ name: addon.name, price: addon.price, description: addon.description || '', type: addon.type, images: addon.images || [] });
    setShowAddTripAddon(true);
    setAddonUploadError(null);
  };

  // Seat lock modal state
  const [lockSeatsTrip, setLockSeatsTrip] = React.useState<Trip | null>(null);
  const [lockSeatLoading, setLockSeatLoading] = React.useState(false);

  // Pre-compute active employee names (drivers first) for driver select
  const activeEmployeeNames = [
    ...employees.filter(e => e.role === 'DRIVER' && e.status === 'ACTIVE').map(e => e.name),
    ...employees.filter(e => e.role !== 'DRIVER' && e.status === 'ACTIVE').map(e => e.name),
  ];
  const availableSeatCounts = React.useMemo(
    () => Array.from(new Set(trips.filter(t => t.status !== TripStatus.COMPLETED).map(t => (t.seats || []).length))).filter(n => n > 0).sort((a, b) => a - b),
    [trips]
  );
  const filteredTrips = React.useMemo(() => trips.filter(trip => {
    if (trip.status === TripStatus.COMPLETED) return false;
    // Quick dropdown filters
    if (tripFilterStatus !== 'ALL' && trip.status !== tripFilterStatus) return false;
    if (tripFilterRoute && trip.route !== tripFilterRoute) return false;
    if (tripFilterDate && trip.date !== tripFilterDate) return false;
    if (tripFilterTime && trip.time !== tripFilterTime) return false;
    if (tripFilterVehicle && trip.licensePlate !== tripFilterVehicle) return false;
    if (tripFilterDriver && trip.driverName !== tripFilterDriver) return false;
    if (tripFilterSeatCount && (trip.seats || []).length !== parseInt(tripFilterSeatCount, 10)) return false;
    // Advanced date-range filters
    if (tripFilterDateFrom && trip.date && trip.date < tripFilterDateFrom) return false;
    if (tripFilterDateTo && trip.date && trip.date > tripFilterDateTo) return false;
    // Day-of-week filter
    if (tripFilterDaysOfWeek.length > 0 && trip.date) {
      const dow = new Date(trip.date + 'T00:00:00').getDay();
      if (!tripFilterDaysOfWeek.includes(dow)) return false;
    }
    if (!tripSearch) return true;
    const q = tripSearch.toLowerCase();
    return (
      (trip.time || '').toLowerCase().includes(q) ||
      (trip.route || '').toLowerCase().includes(q) ||
      (trip.licensePlate || '').toLowerCase().includes(q) ||
      (trip.driverName || '').toLowerCase().includes(q)
    );
  }).sort((a, b) => compareTripDateTime(a, b)),
  // compareTripDateTime is a stable prop reference (a pure comparison function with no
  // dependencies) defined without useCallback in App.tsx, so excluding it avoids
  // unnecessary memoization invalidations on every App render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [trips, tripFilterStatus, tripFilterRoute, tripFilterDate, tripFilterTime, tripFilterVehicle, tripFilterDriver, tripFilterSeatCount, tripFilterDateFrom, tripFilterDateTo, tripFilterDaysOfWeek, tripSearch]);

  // Reset to page 1 whenever active filters change
  React.useEffect(() => {
    setCurrentTripPage(1);
  }, [tripSearch, tripFilterStatus, tripFilterRoute, tripFilterDate, tripFilterDateFrom, tripFilterDateTo, tripFilterTime, tripFilterVehicle, tripFilterDriver, tripFilterSeatCount, tripFilterDaysOfWeek]);

  const totalTripPages = Math.max(1, Math.ceil(filteredTrips.length / TRIPS_PER_PAGE));
  const safeTripPage = Math.min(currentTripPage, totalTripPages);
  const paginatedTrips = filteredTrips.slice((safeTripPage - 1) * TRIPS_PER_PAGE, safeTripPage * TRIPS_PER_PAGE);

  return (
    <div className="space-y-6">
      {/* Seat Lock Modal */}
      {lockSeatsTrip && isAdmin && (() => {
        const trip = trips.find(t => t.id === lockSeatsTrip.id) ?? lockSeatsTrip;
        const handleToggle = async (seatId: string) => {
          const seat = trip.seats.find(s => s.id === seatId);
          if (!seat) return;
          if (seat.status !== SeatStatus.EMPTY && seat.status !== SeatStatus.LOCKED) return;
          setLockSeatLoading(true);
          try {
            await transportService.toggleSeatLock(trip.id, [seatId], seat.status === SeatStatus.EMPTY);
          } finally {
            setLockSeatLoading(false);
          }
        };
        const lockedCount = trip.seats.filter(s => s.status === SeatStatus.LOCKED).length;

        // Build seat status map for quick lookup
        const lockSeatStatusMap: Record<string, SeatStatus> = {};
        trip.seats.forEach(s => { lockSeatStatusMap[s.id] = s.status; });

        // Build 2-D layout grid from trip seat positions (row/col/deck) + vehicle saved layout
        const lockVehicle = vehicles.find(v => v.licensePlate === trip.licensePlate);
        const lockSavedLayout = lockVehicle?.layout as SerializedSeat[] | null | undefined;
        const lockTripSeatsWithLayout = trip.seats.filter(s => s.row !== undefined && s.row !== null);
        const lockRoomHeaders = lockSavedLayout ? lockSavedLayout.filter(s => s.isRoomHeader) : [];
        let lockLayoutGrid: (SerializedSeat | null)[][][] = [];
        if (lockTripSeatsWithLayout.length > 0) {
          const allPos = [
            ...trip.seats.map(s => ({ deck: s.deck || 0, row: s.row ?? 0, col: s.col ?? 0 })),
            ...lockRoomHeaders.map(s => ({ deck: s.deck, row: s.row, col: s.col })),
          ];
          const deckCount = Math.max(...allPos.map(p => p.deck)) + 1;
          const rowCount = Math.max(...allPos.map(p => p.row)) + 1;
          const colCount = Math.max(...allPos.map(p => p.col)) + 1;
          for (let d = 0; d < deckCount; d++) {
            const deckArr: (SerializedSeat | null)[][] = [];
            for (let r = 0; r < rowCount; r++) {
              const rowArr: (SerializedSeat | null)[] = [];
              for (let c = 0; c < colCount; c++) {
                const rh = lockRoomHeaders.find(h => h.deck === d && h.row === r && h.col === c);
                if (rh) { rowArr.push(rh); continue; }
                const seat = trip.seats.find(s => (s.deck || 0) === d && (s.row ?? -1) === r && (s.col ?? -1) === c);
                rowArr.push(seat ? { label: seat.id, row: r, col: c, deck: d, discounted: false, booked: false } : null);
              }
              deckArr.push(rowArr);
            }
            lockLayoutGrid.push(deckArr);
          }
        } else if (lockSavedLayout && lockSavedLayout.length > 0) {
          const nonHeaders = lockSavedLayout.filter(s => !s.isRoomHeader);
          if (nonHeaders.length > 0) {
            const deckCount = Math.max(...lockSavedLayout.map(s => s.deck)) + 1;
            const rowCount = Math.max(...lockSavedLayout.map(s => s.row)) + 1;
            const colCount = Math.max(...lockSavedLayout.map(s => s.col)) + 1;
            for (let d = 0; d < deckCount; d++) {
              const deckArr: (SerializedSeat | null)[][] = [];
              for (let r = 0; r < rowCount; r++) {
                const rowArr: (SerializedSeat | null)[] = [];
                for (let c = 0; c < colCount; c++) {
                  rowArr.push(lockSavedLayout.find(x => x.deck === d && x.row === r && x.col === c) ?? null);
                }
                deckArr.push(rowArr);
              }
              lockLayoutGrid.push(deckArr);
            }
          }
        }
        const hasLockGrid = lockLayoutGrid.length > 0;

        const renderLockSeat = (seatId: string) => {
          const status = lockSeatStatusMap[seatId] ?? SeatStatus.EMPTY;
          const isLocked = status === SeatStatus.LOCKED;
          const isBooked = status === SeatStatus.BOOKED;
          const isPaid = status === SeatStatus.PAID;
          const isEmpty = status === SeatStatus.EMPTY;
          return (
            <button
              key={seatId}
              disabled={lockSeatLoading || isBooked || isPaid}
              onClick={() => handleToggle(seatId)}
              title={
                isLocked
                  ? (language === 'vi' ? 'Nhấn để mở khóa' : 'Click to unlock')
                  : isBooked || isPaid
                    ? (language === 'vi' ? 'Ghế đã có khách, không thể khóa' : 'Seat occupied, cannot lock')
                    : (language === 'vi' ? 'Nhấn để khóa ghế' : 'Click to lock seat')
              }
              className={cn(
                'w-10 h-10 rounded-xl border-2 flex items-center justify-center text-[11px] font-bold transition-all relative flex-shrink-0',
                isEmpty && 'bg-white border-gray-200 text-gray-600 hover:border-gray-500 hover:bg-gray-100 cursor-pointer',
                isLocked && 'bg-gray-200 border-gray-400 text-gray-500 hover:bg-gray-300 cursor-pointer',
                isBooked && 'bg-yellow-400 border-yellow-400 text-white cursor-not-allowed',
                isPaid && 'bg-daiichi-red border-daiichi-red text-white cursor-not-allowed',
              )}
            >
              {seatId}
              {isLocked && <Lock size={8} className="absolute top-0.5 right-0.5 text-gray-500" />}
            </button>
          );
        };

        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
              <div className="p-6 pb-4 border-b border-gray-100">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                      <Lock size={20} className="text-gray-600" />
                      {language === 'vi' ? 'Khóa / Mở khóa ghế' : language === 'ja' ? '座席のロック/解除' : 'Lock / Unlock Seats'}
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">
                      {trip.route} • {trip.date && formatBookingDate(trip.date)} {trip.time}
                    </p>
                    {lockedCount > 0 && (
                      <p className="text-xs text-orange-600 font-bold mt-1">
                        {language === 'vi' ? `${lockedCount} ghế đang bị khóa` : `${lockedCount} seat(s) locked`}
                      </p>
                    )}
                  </div>
                  <button onClick={() => setLockSeatsTrip(null)} className="text-gray-400 hover:text-gray-600 p-1">
                    <X size={22} />
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-2">
                  {language === 'vi'
                    ? 'Nhấn vào ghế trắng để khóa, nhấn ghế xám để mở khóa. Ghế đã đặt/thanh toán không thể khóa.'
                    : 'Click an empty seat to lock it, click a locked seat to unlock. Booked/paid seats cannot be locked.'}
                </p>
              </div>
              <div className="p-6 overflow-y-auto flex-1">
                {lockSeatLoading && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 size={20} className="animate-spin text-gray-400" />
                  </div>
                )}
                {hasLockGrid ? (
                  <div className="overflow-x-auto">
                    <div className="text-[10px] text-gray-400 mb-2 text-center">
                      ← {language === 'vi' ? 'Đầu xe' : 'Front'}
                    </div>
                    <div className="space-y-1">
                      {(lockLayoutGrid[0] ?? []).map((row, rowIdx) => {
                        if (row[0]?.isRoomHeader) {
                          const headerPx = row.length * 40 + Math.max(0, row.length - 1) * 8;
                          return (
                            <div key={rowIdx} className="flex gap-2 justify-center">
                              <div
                                style={{ width: `${headerPx}px` }}
                                className="h-5 rounded bg-gray-100 border border-gray-300 text-[10px] font-bold text-gray-600 text-center flex items-center justify-center"
                              >
                                {row[0].label}
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div key={rowIdx} className="flex gap-2 justify-center">
                            {row.map((cell, colIdx) =>
                              !cell
                                ? <div key={colIdx} className="w-10 h-10 flex-shrink-0" />
                                : <div key={colIdx} className="flex-shrink-0">{renderLockSeat(cell.label)}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {lockLayoutGrid.length > 1 && (
                      <div className="mt-4 space-y-1">
                        <div className="text-[10px] font-bold text-gray-500 text-center uppercase tracking-widest">
                          {language === 'vi' ? 'Tầng trên' : 'Upper deck'}
                        </div>
                        {(lockLayoutGrid[1] ?? []).map((row, rowIdx) => {
                          if (row[0]?.isRoomHeader) {
                            const headerPx = row.length * 40 + Math.max(0, row.length - 1) * 8;
                            return (
                              <div key={rowIdx} className="flex gap-2 justify-center">
                                <div style={{ width: `${headerPx}px` }} className="h-5 rounded bg-gray-100 border border-gray-300 text-[10px] font-bold text-gray-600 text-center flex items-center justify-center">
                                  {row[0].label}
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div key={rowIdx} className="flex gap-2 justify-center">
                              {row.map((cell, colIdx) =>
                                !cell
                                  ? <div key={colIdx} className="w-10 h-10 flex-shrink-0" />
                                  : <div key={colIdx} className="flex-shrink-0">{renderLockSeat(cell.label)}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 justify-center">
                    {trip.seats.map(seat => renderLockSeat(seat.id))}
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-3 justify-center text-[10px] font-semibold">
                  <div className="flex items-center gap-1"><div className="w-3 h-3 bg-white border-2 border-gray-300 rounded" /> {language === 'vi' ? 'Trống' : 'Empty'}</div>
                  <div className="flex items-center gap-1"><div className="w-3 h-3 bg-gray-200 border-2 border-gray-400 rounded" /> {language === 'vi' ? 'Đã khóa' : 'Locked'}</div>
                  <div className="flex items-center gap-1"><div className="w-3 h-3 bg-yellow-400 rounded" /> {language === 'vi' ? 'Đã đặt' : 'Booked'}</div>
                  <div className="flex items-center gap-1"><div className="w-3 h-3 bg-daiichi-red rounded" /> {language === 'vi' ? 'Đã thanh toán' : 'Paid'}</div>
                </div>
              </div>
              <div className="p-4 border-t border-gray-100">
                <button
                  onClick={() => setLockSeatsTrip(null)}
                  className="w-full py-3 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                >
                  {language === 'vi' ? 'Đóng' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
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
          <button
            onClick={() => exportAllTripsToExcelHandler(filteredTrips)}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-green-700 transition-colors"
          >
            <Download size={16} />
            {language === 'vi' ? 'Xuất Excel tất cả' : 'Export All Excel'}
          </button>
          <button onClick={() => { setShowBatchAddTrip(true); setBatchTripForm({ dateFrom: '', dateTo: '', route: '', licensePlate: '', driverName: '', price: 0, agentPrice: 0, seatCount: 11 }); setBatchTimeSlots(['']); setBatchAddonServices([]); setBatchAddonForm({ name: '', price: 0, description: '', type: 'OTHER', images: [] }); setShowBatchAddonForm(false); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm">⚡ {t.batch_add_trips}</button>
          <button onClick={() => { setShowAddTrip(true); setEditingTrip(null); setTripForm({ time: '', date: '', route: '', licensePlate: '', driverName: '', price: 0, agentPrice: 0, discountPercent: 0, seatCount: 11, status: TripStatus.WAITING }); }} className="bg-daiichi-red text-white px-4 py-2 rounded-lg font-bold">+ {t.add_trip}</button>
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
                <p className="font-semibold text-orange-800">{language === 'vi' ? 'Chuyến phụ (sẽ trở thành rỗng):' : 'Secondary trip (will be emptied):'}</p>
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
                  ? 'Sau khi ghép, tất cả hành khách từ chuyến phụ sẽ được chuyển sang chuyến chính. Chuyến phụ sẽ trở thành rỗng (tất cả ghế trống).'
                  : 'After merging, all passengers from the secondary trip will be moved to the primary trip. The secondary trip will become empty (all seats vacant).'}</span>
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

            {/* Batch Addon Services */}
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Dịch vụ kèm theo (áp dụng cho tất cả chuyến)' : 'Add-on Services (applied to all trips)'}</label>
              </div>
              <div className="space-y-2">
                {batchAddonServices.map(addon => (
                  <div key={addon.id} className="flex items-start justify-between bg-gray-50 rounded-xl px-4 py-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{addon.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{addon.type === 'SIGHTSEEING' ? t.addon_type_sightseeing : addon.type === 'TRANSPORT' ? t.addon_type_transport : addon.type === 'FOOD' ? t.addon_type_food : t.addon_type_other}</span>
                      </div>
                      {addon.description && <p className="text-xs text-gray-500 mt-0.5">{addon.description}</p>}
                      <p className="text-sm font-bold text-daiichi-red mt-0.5">+{addon.price.toLocaleString()}đ</p>
                      {(addon.images || []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(addon.images || []).map((img, i) => (
                            <img key={i} src={img} alt={`${addon.name} - ${i + 1}`} className="w-12 h-12 object-cover rounded-lg border border-gray-200" referrerPolicy="no-referrer" />
                          ))}
                        </div>
                      )}
                    </div>
                    <button onClick={() => setBatchAddonServices(prev => prev.filter(a => a.id !== addon.id))} aria-label={language === 'vi' ? 'Xóa dịch vụ' : 'Delete service'} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg ml-2 flex-shrink-0"><Trash2 size={16} /></button>
                  </div>
                ))}
                {showBatchAddonForm ? (
                  <div className="border border-dashed border-gray-200 rounded-xl p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.addon_name}</label><input type="text" value={batchAddonForm.name} onChange={e => setBatchAddonForm(p => ({ ...p, name: e.target.value }))} className="w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                      <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.addon_price} (đ)</label><input type="number" min="0" value={batchAddonForm.price} onChange={e => setBatchAddonForm(p => ({ ...p, price: parseInt(e.target.value) || 0 }))} className="w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                      <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.addon_type}</label>
                        <select value={batchAddonForm.type} onChange={e => setBatchAddonForm(p => ({ ...p, type: e.target.value as any }))} className="w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none">
                          <option value="SIGHTSEEING">{t.addon_type_sightseeing}</option>
                          <option value="TRANSPORT">{t.addon_type_transport}</option>
                          <option value="FOOD">{t.addon_type_food}</option>
                          <option value="OTHER">{t.addon_type_other}</option>
                        </select>
                      </div>
                      <div className="col-span-2"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.addon_desc}</label><input type="text" value={batchAddonForm.description} onChange={e => setBatchAddonForm(p => ({ ...p, description: e.target.value }))} className="w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                      {/* Image upload */}
                      <div className="col-span-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Hình ảnh dịch vụ' : language === 'ja' ? 'サービス画像' : 'Service Images'}</label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {(batchAddonForm.images || []).map((img, i) => (
                            <div key={i} className="relative">
                              <img src={img} alt={`${i + 1}`} className="w-16 h-16 object-cover rounded-xl border border-gray-200" referrerPolicy="no-referrer" />
                              <button type="button" aria-label={language === 'vi' ? 'Xóa ảnh' : 'Remove image'} onClick={() => setBatchAddonForm(p => ({ ...p, images: p.images.filter((_, idx) => idx !== i) }))} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold">✕</button>
                            </div>
                          ))}
                          {uploadAddonImage && (
                            <label aria-label={language === 'vi' ? 'Thêm ảnh' : 'Add image'} className={`w-16 h-16 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-daiichi-red transition-colors ${addonImageUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                              {addonImageUploading ? <Loader2 size={16} className="animate-spin text-gray-400" /> : <span className="text-gray-400 text-xl leading-none">+</span>}
                              <input type="file" accept="image/*" aria-label={language === 'vi' ? 'Chọn ảnh dịch vụ' : 'Select service image'} className="hidden" disabled={addonImageUploading} onChange={e => handleAddonImageUpload(e, setBatchAddonForm)} />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setShowBatchAddonForm(false); setBatchAddonForm({ name: '', price: 0, description: '', type: 'OTHER', images: [] }); }} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-600">{t.cancel}</button>
                      <button
                        onClick={() => {
                          if (!batchAddonForm.name) return;
                          setBatchAddonServices(prev => [...prev, { id: crypto.randomUUID(), ...batchAddonForm }]);
                          setBatchAddonForm({ name: '', price: 0, description: '', type: 'OTHER', images: [] });
                          setShowBatchAddonForm(false);
                        }}
                        disabled={!batchAddonForm.name || addonImageUploading}
                        className="px-4 py-2 bg-daiichi-red text-white text-sm rounded-xl font-bold disabled:opacity-50"
                      >{t.save}</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowBatchAddonForm(true)} className="w-full py-3 border border-dashed border-gray-200 rounded-xl text-sm font-bold text-gray-400 hover:text-daiichi-red hover:border-daiichi-red transition-colors">+ {t.add_addon}</button>
                )}
              </div>
            </div>

            {(() => {
              const validSlots = batchTimeSlots.filter(s => s);
              let dayCount = 0;
              if (batchTripForm.dateFrom && batchTripForm.dateTo && batchTripForm.dateTo >= batchTripForm.dateFrom) {
                const cur = new Date(batchTripForm.dateFrom + 'T00:00:00');
                const end = new Date(batchTripForm.dateTo + 'T00:00:00');
                while (cur <= end) {
                  dayCount++;
                  cur.setDate(cur.getDate() + 1);
                }
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
                  {batchAddonServices.length > 0 && (
                    <p className="text-xs text-green-600 mt-1">✓ {batchAddonServices.length} {language === 'vi' ? 'dịch vụ kèm theo sẽ được áp dụng' : 'add-on service(s) will be applied'}</p>
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
                  const cur = new Date(batchTripForm.dateFrom + 'T00:00:00');
                  const end = new Date(batchTripForm.dateTo + 'T00:00:00');
                  while (cur <= end) {
                    dayCount++;
                    cur.setDate(cur.getDate() + 1);
                  }
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
              <button onClick={() => { setShowTripAddons(null); setShowAddTripAddon(false); setEditingAddonId(null); setAddonUploadError(null); }} className="p-2 hover:bg-gray-50 rounded-xl"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              {(showTripAddons.addons || []).length === 0 && !showAddTripAddon && (
                <p className="text-sm text-gray-400 text-center py-4">{language === 'vi' ? 'Chưa có dịch vụ kèm theo' : 'No add-on services yet'}</p>
              )}
              {(showTripAddons.addons || []).map(addon => (
                <div key={addon.id} className={`flex items-start justify-between bg-gray-50 rounded-xl p-4 ${isAdmin ? 'cursor-pointer hover:bg-gray-100 transition-colors' : ''}`}
                  role={isAdmin ? 'button' : undefined}
                  tabIndex={isAdmin ? 0 : undefined}
                  onClick={isAdmin ? () => handleEditAddon(addon) : undefined}
                  onKeyDown={isAdmin ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleEditAddon(addon);
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
                      <button onClick={(e) => { e.stopPropagation(); handleEditAddon(addon); }} aria-label={language === 'vi' ? 'Chỉnh sửa dịch vụ' : 'Edit service'} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit3 size={16} /></button>
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
        <input
          type="date"
          value={tripFilterDate}
          onChange={e => setTripFilterDate(e.target.value)}
          className={cn('px-3 py-2 rounded-xl text-xs font-bold border transition-all focus:outline-none', tripFilterDate ? 'bg-daiichi-red text-white border-daiichi-red [color-scheme:dark]' : 'bg-white text-gray-600 border-gray-200 hover:border-daiichi-red/40')}
        />
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
        {(tripFilterRoute || tripFilterDate || tripFilterTime || tripFilterVehicle || tripFilterDriver || tripFilterSeatCount) && (
          <button
            onClick={() => { setTripFilterRoute(''); setTripFilterDate(''); setTripFilterTime(''); setTripFilterVehicle(''); setTripFilterDriver(''); setTripFilterSeatCount(''); }}
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
              { key: 'passengers', label: language === 'vi' ? 'Hành khách/Ghế' : 'Passengers/Seats' },
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
          {/* Day-of-week filter */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.batch_days_of_week}</label>
              {tripFilterDaysOfWeek.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTripFilterDaysOfWeek([])}
                  className="text-[10px] font-bold text-blue-500 hover:text-blue-700"
                >
                  {language === 'vi' ? 'Bỏ chọn tất cả' : language === 'ja' ? '全解除' : 'Deselect All'}
                </button>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {([
                { day: 1, label: t.day_mon },
                { day: 2, label: t.day_tue },
                { day: 3, label: t.day_wed },
                { day: 4, label: t.day_thu },
                { day: 5, label: t.day_fri },
                { day: 6, label: t.day_sat },
                { day: 0, label: t.day_sun },
              ] as { day: number; label: string }[]).map(({ day, label }) => {
                const isSelected = tripFilterDaysOfWeek.includes(day);
                const isWeekend = day === 0 || day === 6;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setTripFilterDaysOfWeek(prev =>
                      isSelected ? prev.filter(d => d !== day) : [...prev, day]
                    )}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors',
                      isSelected
                        ? isWeekend
                          ? 'bg-red-500 text-white border-red-500'
                          : 'bg-blue-600 text-white border-blue-600'
                        : 'bg-gray-50 text-gray-400 border-gray-100 hover:border-blue-300',
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={() => { setTripFilterRoute(''); setTripFilterTime(''); setTripFilterVehicle(''); setTripFilterDriver(''); setTripFilterSeatCount(''); setTripFilterStatus('ALL'); setTripFilterDateFrom(''); setTripFilterDateTo(''); setTripFilterDaysOfWeek([]); }} className="px-4 py-2 text-sm font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl">
              {language === 'vi' ? 'Xóa bộ lọc' : 'Clear Filters'}
            </button>
          </div>
        </div>
      )}

      {/* Trip count notification */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-daiichi-red/10 text-daiichi-red rounded-xl text-sm font-bold">
          <span>{language === 'vi' ? 'Hiện có' : 'Showing'}</span>
          <span className="text-base font-extrabold">{filteredTrips.length}</span>
          <span>{language === 'vi' ? 'chuyến' : filteredTrips.length === 1 ? 'trip' : 'trips'}</span>
        </span>
      </div>

      {/* Passenger List Modal */}
      {showTripPassengers && (() => {
        // Pre-compute ticketCode map and group seats by booking
        const seatTicketCodeMap = buildSeatTicketCodeMap(showTripPassengers.id);
        const bookedSeats = (showTripPassengers.seats || []).filter((s: any) => s.status !== SeatStatus.EMPTY && s.status !== SeatStatus.LOCKED);
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
                    { key: 'segment', label: language === 'vi' ? 'Loại chặng' : 'Segment' },
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
              const booked = allSeats.filter((s: any) => s.status !== SeatStatus.EMPTY && s.status !== SeatStatus.LOCKED);
              const paid = allSeats.filter((s: any) => s.status === SeatStatus.PAID);
              const empty = allSeats.filter((s: any) => s.status === SeatStatus.EMPTY);
              const locked = allSeats.filter((s: any) => s.status === SeatStatus.LOCKED);
              const partialCount = booked.filter((s: any) => getSegmentInfo(s).type !== 'full').length;
              return (
                <div className="px-6 py-3 bg-gray-50 flex flex-wrap gap-3 items-center flex-shrink-0 border-b border-gray-100">
                  <span className="text-sm font-bold text-gray-700">{language === 'vi' ? 'Tổng' : 'Total'}: {allSeats.length}</span>
                  <span className="text-sm font-bold text-green-600">✓ {language === 'vi' ? 'Đã thanh toán' : 'Paid'}: {paid.length}</span>
                  <span className="text-sm font-bold text-blue-600">◉ {language === 'vi' ? 'Đã đặt' : 'Booked'}: {booked.length - paid.length}</span>
                  <span className="text-sm font-bold text-gray-400">○ {language === 'vi' ? 'Còn trống' : 'Empty'}: {empty.length}</span>
                  {locked.length > 0 && <span className="text-sm font-bold text-gray-500 flex items-center gap-1"><Lock size={12} /> {language === 'vi' ? 'Đã khóa' : 'Locked'}: {locked.length}</span>}
                  {partialCount > 0 && <span className="text-sm font-bold text-orange-500">◈ {language === 'vi' ? 'Nửa chặng' : 'Partial'}: {partialCount}</span>}
                  <div className="ml-auto flex gap-2">
                    <button onClick={() => exportTripToExcelHandler(showTripPassengers)} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700"><Download size={12} /> Excel</button>
                    <button onClick={() => exportTripToPDFHandler(showTripPassengers)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700"><FileText size={12} /> PDF</button>
                  </div>
                </div>
              );
            })()}
            {/* Passenger table – one row per booking group */}
            <div className="flex-1 overflow-y-auto overflow-x-auto">
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
                        {passengerColVisibility.seat && <td className="px-4 py-3 font-bold">
                          {seatIds}
                          {isGroup && <span className="ml-1 text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-bold">👥 {group.seats.length}</span>}
                        </td>}
                        {passengerColVisibility.name && <td className="px-4 py-3 font-medium">{primarySeat.customerName || '—'}</td>}
                        {passengerColVisibility.phone && <td className="px-4 py-3 text-gray-600">{primarySeat.customerPhone || '—'}</td>}
                        {passengerColVisibility.segment && <td className="px-4 py-3"><span className={cn('px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap', segInfo.type === 'full' ? 'bg-green-100 text-green-700' : segInfo.type === 'multi' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700')} title={segInfo.label}>{segInfo.label}</span></td>}
                        {passengerColVisibility.pickup && <td className="px-4 py-3 text-gray-600">{[primarySeat.pickupAddressDetail, primarySeat.pickupAddress, primarySeat.pickupStopAddress].filter(Boolean).join(' & ') || '—'}</td>}
                        {passengerColVisibility.dropoff && <td className="px-4 py-3 text-gray-600">{[primarySeat.dropoffAddressDetail, primarySeat.dropoffAddress, primarySeat.dropoffStopAddress].filter(Boolean).join(' & ') || '—'}</td>}
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
                                  pickupStopAddress: primarySeat.pickupStopAddress || '',
                                  dropoffStopAddress: primarySeat.dropoffStopAddress || '',
                                  status: rowStatus,
                                  bookingNote: primarySeat.bookingNote || '',
                                });
                              }}
                              className="text-gray-400 hover:text-daiichi-red p-1 rounded"
                              title={language === 'vi' ? 'Chỉnh sửa' : 'Edit'}
                            >
                              <Edit3 size={14} />
                            </button>
                            {isAdmin && (
                            <button
                              onClick={() => handleDeletePassenger(primarySeat.id)}
                              className="text-gray-400 hover:text-red-600 p-1 rounded"
                              title={language === 'vi' ? 'Xóa hành khách' : 'Remove passenger'}
                            >
                              <Trash2 size={14} />
                            </button>
                            )}
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
              {tripColVisibility.passengers && <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{language === 'vi' ? 'Hành khách/Ghế' : 'Passengers/Seats'}</th>}
              {tripColVisibility.addons && <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{t.trip_addons}</th>}
              <ResizableTh width={tripColWidths.options} onResize={(w) => setTripColWidths(p => ({ ...p, options: w }))} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{t.options}</ResizableTh>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedTrips.map((trip) => {
              const bookedCount = (trip.seats || []).filter((s: any) => s.status !== SeatStatus.EMPTY && s.status !== SeatStatus.LOCKED).length;
              const totalSeats = (trip.seats || []).length;
              const goToSeatMap = () => { setSelectedTrip(trip); setPreviousTab('operations'); setActiveTab('seat-mapping'); };
              const openPassengerList = () => { setShowTripPassengers(trip); setEditingPassengerSeatId(null); };
              // A trip is eligible for merge if it is free-seating (no status restriction).
              // Additional compatibility checks (same route/date/time) are enforced below when a
              // first trip is already selected.
              const isMergeable = trip.seatType === 'free';
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
                      <span>
                        {trip.date && <><span className="text-gray-900">{formatBookingDate(trip.date)}</span>{' '}</>}
                        <span className="text-red-600">{trip.time}</span>
                      </span>
                      {trip.isMerged && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-full text-[10px] font-bold w-fit">
                          <GitMerge size={10} />
                          {language === 'vi' ? 'Đã ghép' : 'Merged'}
                        </span>
                      )}
                      {(trip.discountPercent || 0) > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold w-fit">
                          🏷️ -{trip.discountPercent}%
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
                  {tripColVisibility.passengers && <td className="px-6 py-4">
                    <button
                      onClick={openPassengerList}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <Users size={12} />
                      <span>{bookedCount}/{totalSeats}</span>
                    </button>
                  </td>}
                  {tripColVisibility.addons && <td className="px-6 py-4">
                    <button onClick={() => { setShowTripAddons({ ...trip }); setShowAddTripAddon(false); setTripAddonForm({ name: '', price: 0, description: '', type: 'OTHER', images: [] }); }} className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg hover:bg-blue-100 transition-colors">
                      <span>{(trip.addons || []).length}</span>
                      <span>{t.manage_addons}</span>
                    </button>
                  </td>}
                  <td className="px-6 py-4"><div className="flex gap-3 items-center"><button onClick={() => exportTripToExcelHandler(trip)} title={language === 'vi' ? 'Xuất Excel' : 'Export Excel'} className="text-green-600 hover:text-green-700 hover:bg-green-50 p-1 rounded"><Download size={16} /></button><button onClick={() => exportTripToPDFHandler(trip)} title={language === 'vi' ? 'Xuất PDF' : 'Export PDF'} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-1 rounded"><FileText size={16} /></button><button onClick={() => handleCopyTrip(trip)} title={t.copy_trip} className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 p-1 rounded"><Copy size={16} /></button><button onClick={() => handleStartEditTrip(trip)} className="text-gray-600 hover:text-daiichi-red"><Edit3 size={18} /></button>{isAdmin && <button onClick={() => handleDeleteTrip(trip.id)} className="text-gray-600 hover:text-red-600"><Trash2 size={18} /></button>}{isAdmin && <button onClick={() => setLockSeatsTrip(trip)} title={language === 'vi' ? 'Khóa / Mở khóa ghế' : 'Lock / Unlock Seats'} className="text-gray-500 hover:text-gray-800 hover:bg-gray-100 p-1 rounded"><Lock size={16} /></button>}<NotePopover note={trip.note} onSave={(note) => handleSaveTripNote(trip.id, note)} language={language} /><button onClick={goToSeatMap} className="text-daiichi-red hover:underline font-bold text-sm">{t.view_seats}</button></div></td>
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
      {/* Pagination controls */}
      {totalTripPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm">
          <span className="text-sm text-gray-500">
            {language === 'vi'
              ? `Hiển thị ${(safeTripPage - 1) * TRIPS_PER_PAGE + 1}–${Math.min(safeTripPage * TRIPS_PER_PAGE, filteredTrips.length)} / ${filteredTrips.length} chuyến`
              : `Showing ${(safeTripPage - 1) * TRIPS_PER_PAGE + 1}–${Math.min(safeTripPage * TRIPS_PER_PAGE, filteredTrips.length)} of ${filteredTrips.length} trips`}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentTripPage(1)}
              disabled={safeTripPage === 1}
              className="px-2 py-1 rounded-lg text-sm font-bold text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
              title={language === 'vi' ? 'Trang đầu' : 'First page'}
            >«</button>
            <button
              onClick={() => setCurrentTripPage(p => Math.max(1, p - 1))}
              disabled={safeTripPage === 1}
              className="px-3 py-1 rounded-lg text-sm font-bold text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >‹</button>
            {Array.from({ length: Math.min(totalTripPages, 7) }, (_, i) => {
              let page: number;
              if (totalTripPages <= 7) {
                page = i + 1;
              } else if (safeTripPage <= 4) {
                page = i + 1;
              } else if (safeTripPage >= totalTripPages - 3) {
                page = totalTripPages - 6 + i;
              } else {
                page = safeTripPage - 3 + i;
              }
              return (
                <button
                  key={page}
                  onClick={() => setCurrentTripPage(page)}
                  className={cn(
                    'w-8 h-8 rounded-lg text-sm font-bold transition-colors',
                    page === safeTripPage
                      ? 'bg-daiichi-red text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                >{page}</button>
              );
            })}
            <button
              onClick={() => setCurrentTripPage(p => Math.min(totalTripPages, p + 1))}
              disabled={safeTripPage === totalTripPages}
              className="px-3 py-1 rounded-lg text-sm font-bold text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >›</button>
            <button
              onClick={() => setCurrentTripPage(totalTripPages)}
              disabled={safeTripPage === totalTripPages}
              className="px-2 py-1 rounded-lg text-sm font-bold text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
              title={language === 'vi' ? 'Trang cuối' : 'Last page'}
            >»</button>
          </div>
        </div>
      )}
    </div>
  );
}
