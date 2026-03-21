import React, { useState, useRef } from 'react'
import { X, CheckCircle2, Gift } from 'lucide-react'
import { cn } from '../lib/utils'
import { Language, TRANSLATIONS, UserRole, SeatStatus } from '../constants/translations'
import { PAYMENT_METHODS, type PaymentMethod, PAYMENT_METHOD_TRANSLATION_KEYS } from '../constants/paymentMethods'
import { Trip, Route, Stop, Agent, Vehicle, TripAddon, RouteSurcharge } from '../types'
import { SerializedSeat } from '../lib/vehicleSeatUtils'
import { SearchableSelect } from '../components/SearchableSelect'
import { motion } from 'motion/react'

interface SeatMappingPageProps {
  // Data
  selectedTrip: any;
  routes: Route[];
  stops: Stop[];
  vehicles: Vehicle[];
  agents: Agent[];
  currentUser: any | null;
  language: Language;
  tripType: 'ONE_WAY' | 'ROUND_TRIP';
  previousTab: string;
  roundTripPhase: 'outbound' | 'return';
  activeDeck: number;
  adults: number;
  children: number;
  childrenAges: (number | undefined)[];
  extraSeatIds: string[];
  showBookingForm: string | null;
  customerNameInput: string;
  phoneInput: string;
  pickupPoint: string;
  dropoffPoint: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupAddressDetail: string;
  dropoffAddressDetail: string;
  fromStopId: string;
  toStopId: string;
  pickupSurcharge: number;
  dropoffSurcharge: number;
  pickupAddressSurcharge: number;
  dropoffAddressSurcharge: number;
  surchargeAmount: number;
  addonQuantities: Record<string, number>;
  bookingNote: string;
  paymentMethodInput: PaymentMethod;
  fareAmount: number | null;
  fareAgentAmount: number | null;
  fareLoading: boolean;
  fareError: string;
  // Setters
  setActiveDeck: React.Dispatch<React.SetStateAction<number>>;
  setAdults: React.Dispatch<React.SetStateAction<number>>;
  setChildren: React.Dispatch<React.SetStateAction<number>>;
  setChildrenAges: React.Dispatch<React.SetStateAction<(number | undefined)[]>>;
  setExtraSeatIds: React.Dispatch<React.SetStateAction<string[]>>;
  setSeatSelectionHistory: React.Dispatch<React.SetStateAction<{ primarySeat: string | null; extraSeats: string[] }[]>>;
  setShowBookingForm: (v: string | null) => void;
  setCustomerNameInput: (v: string) => void;
  setPhoneInput: (v: string) => void;
  setPickupPoint: (v: string) => void;
  setDropoffPoint: (v: string) => void;
  setPickupAddress: (v: string) => void;
  setDropoffAddress: (v: string) => void;
  setPickupAddressDetail: (v: string) => void;
  setDropoffAddressDetail: (v: string) => void;
  setFromStopId: (v: string) => void;
  setToStopId: (v: string) => void;
  setPickupSurcharge: (v: number) => void;
  setDropoffSurcharge: (v: number) => void;
  setPickupAddressSurcharge: (v: number) => void;
  setDropoffAddressSurcharge: (v: number) => void;
  setSurchargeAmount: (v: number) => void;
  setAddonQuantities: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setBookingNote: (v: string) => void;
  setPaymentMethodInput: (v: PaymentMethod) => void;
  setFareAmount: (v: number | null) => void;
  setFareError: (v: string) => void;
  setActiveTab: (tab: string) => void;
  // Handlers
  handleConfirmBooking: (seatId: string) => void;
  lookupFare: (tripRoute: Route | undefined, fromStopId: string, toStopId: string) => Promise<void>;
}

export function SeatMappingPage({
  selectedTrip,
  routes,
  stops,
  vehicles,
  agents,
  currentUser,
  language,
  tripType,
  previousTab,
  roundTripPhase,
  activeDeck,
  adults,
  children,
  childrenAges,
  extraSeatIds,
  showBookingForm,
  customerNameInput,
  phoneInput,
  pickupPoint,
  dropoffPoint,
  pickupAddress,
  dropoffAddress,
  pickupAddressDetail,
  dropoffAddressDetail,
  fromStopId,
  toStopId,
  pickupSurcharge,
  dropoffSurcharge,
  pickupAddressSurcharge,
  dropoffAddressSurcharge,
  surchargeAmount,
  addonQuantities,
  bookingNote,
  paymentMethodInput,
  fareAmount,
  fareAgentAmount,
  fareLoading,
  fareError,
  setActiveDeck,
  setAdults,
  setChildren,
  setChildrenAges,
  setExtraSeatIds,
  setSeatSelectionHistory,
  setShowBookingForm,
  setCustomerNameInput,
  setPhoneInput,
  setPickupPoint,
  setDropoffPoint,
  setPickupAddress,
  setDropoffAddress,
  setPickupAddressDetail,
  setDropoffAddressDetail,
  setFromStopId,
  setToStopId,
  setPickupSurcharge,
  setDropoffSurcharge,
  setPickupAddressSurcharge,
  setDropoffAddressSurcharge,
  setSurchargeAmount,
  setAddonQuantities,
  setBookingNote,
  setPaymentMethodInput,
  setFareAmount,
  setFareError,
  setActiveTab,
  handleConfirmBooking,
  lookupFare,
}: SeatMappingPageProps) {
  const t = TRANSLATIONS[language];

  // Internal state – only used by this page
  const [segmentConflictSeat, setSegmentConflictSeat] = useState<string | null>(null);
  const segmentConflictTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Returns true if the address input should be disabled for the given trip date. */
  const isAddressDisabled = (disableFlag: boolean | undefined, fromDate: string | undefined, toDate: string | undefined, tripDate: string): boolean => {
    if (!disableFlag) return false;
    // No date range configured → always disabled
    if (!fromDate && !toDate) return true;
    // One- or two-sided range: check if tripDate is within [fromDate, toDate]
    const afterFrom = fromDate ? tripDate >= fromDate : true;
    const beforeTo = toDate ? tripDate <= toDate : true;
    return !!tripDate && afterFrom && beforeTo;
  };

  /** Route-level surcharges applicable for the given date. */
  const getApplicableRouteSurcharges = (route: Route | undefined, tripDate: string): RouteSurcharge[] => {
    if (!route?.surcharges) return [];
    return route.surcharges.filter(sc => {
      if (!sc.isActive) return false;
      if (sc.startDate && sc.endDate) {
        return !!tripDate && tripDate >= sc.startDate && tripDate <= sc.endDate;
      }
      return true;
    });
  };

  if (!selectedTrip) return null;

  const childrenOver5Count = childrenAges.filter(age => age >= 5).length;
  const extraSeatsNeeded = (adults - 1) + childrenOver5Count;
  // Look up route once for this render block (used for surcharges, fare table, and blocker check)
  const tripRoute = routes.find(r => r.name === selectedTrip.route);
  // Also disable confirmation when a fare lookup error exists for a route with configured stops
  const hasFareBlocker = !!fareError && (tripRoute?.routeStops?.length ?? 0) > 0;
  const isFreeSeatingTrip = selectedTrip.seatType === 'free';
  const canConfirmBooking = isFreeSeatingTrip
    ? !hasFareBlocker
    : (extraSeatsNeeded === 0 || extraSeatIds.length >= extraSeatsNeeded) && !hasFareBlocker;
  const isSelectingExtraSeats = !isFreeSeatingTrip && !!showBookingForm && (adults > 1 || childrenOver5Count > 0);

  // Route-level surcharges
  const tripDate = selectedTrip.date || '';
  const applicableRouteSurcharges = getApplicableRouteSurcharges(tripRoute, tripDate);
  // Pre-compute stop name lists for pickup/dropoff address selects.
  // Only show STOP-type (điểm dừng) entries – never major TERMINAL stations (ga lớn).
  // Use the user-selected departure/arrival (pickupPoint/dropoffPoint) as the effective
  // terminal name; fall back to the route's fixed departure/arrival point.
  // If the selected name is itself a STOP (not a TERMINAL), find its parent TERMINAL
  // so that all sibling stops under the same terminal are offered.
  const resolveTerminal = (selectedName: string | undefined, routeDefaultName: string | undefined) => {
    const name = selectedName || routeDefaultName;
    if (!name) return undefined;
    // Direct match: the name is a TERMINAL stop
    const direct = stops.find(s => s.type === 'TERMINAL' && s.name === name);
    if (direct) return direct;
    // Indirect match: the name is a STOP – find its parent TERMINAL
    const parentId = stops.find(s => s.name === name)?.terminalId;
    if (parentId) return stops.find(s => s.id === parentId);
    return undefined;
  };
  const departureTerminal = resolveTerminal(pickupPoint, tripRoute?.departurePoint);
  const arrivalTerminal = resolveTerminal(dropoffPoint, tripRoute?.arrivalPoint);
  // Only include child STOP entries; when no terminal is resolved, show all non-TERMINAL stops
  const pickupStops = departureTerminal
    ? stops.filter(s => s.terminalId === departureTerminal.id)
    : stops.filter(s => s.type !== 'TERMINAL');
  const dropoffStops = arrivalTerminal
    ? stops.filter(s => s.terminalId === arrivalTerminal.id)
    : stops.filter(s => s.type !== 'TERMINAL');
  const pickupStopNames = pickupStops.map(s => s.name);
  const dropoffStopNames = dropoffStops.map(s => s.name);
  // Secondary text (address) shown in the dropdown alongside the stop name
  const pickupStopAddresses = pickupStops.map(s => s.address || '');
  const dropoffStopAddresses = dropoffStops.map(s => s.address || '');

  // Build seat status lookup
  const seatStatusMap: Record<string, SeatStatus> = {};
  selectedTrip.seats.forEach((s: any) => { seatStatusMap[s.id] = s.status; });

  // Reconstruct visual layout grid from trip seats using row/col/deck
  // Try seats with row info first; fall back to vehicle saved layout or flat list
  const tripSeatsWithLayout = selectedTrip.seats.filter((s: any) => s.row !== undefined && s.row !== null);
  const selectedVehicle = vehicles.find(v => v.licensePlate === selectedTrip.licensePlate);
  const savedVehicleLayout = selectedVehicle?.layout as SerializedSeat[] | null | undefined;

  // Build the layout grid to render
  let layoutGrid: (SerializedSeat | null)[][][] = [];
  if (tripSeatsWithLayout.length > 0) {
    // Use trip seats' row/col/deck info
    const deckCount = Math.max(...selectedTrip.seats.map((s: any) => s.deck || 0)) + 1;
    const rowCount = Math.max(...selectedTrip.seats.map((s: any) => s.row ?? 0)) + 1;
    const colCount = Math.max(...selectedTrip.seats.map((s: any) => s.col ?? 0)) + 1;
    for (let d = 0; d < deckCount; d++) {
      const deck: (SerializedSeat | null)[][] = [];
      for (let r = 0; r < rowCount; r++) {
        const row: (SerializedSeat | null)[] = [];
        for (let c = 0; c < colCount; c++) {
          const seat = selectedTrip.seats.find((s: any) => (s.deck || 0) === d && (s.row ?? -1) === r && (s.col ?? -1) === c);
          row.push(seat ? { id: `${d}-${r}-${c}`, label: seat.id, row: r, col: c, deck: d, discounted: false, booked: false } : null);
        }
        deck.push(row);
      }
      layoutGrid.push(deck);
    }
  } else if (savedVehicleLayout && savedVehicleLayout.length > 0) {
    // Use vehicle's saved layout
    const deckCount = Math.max(...savedVehicleLayout.map(s => s.deck)) + 1;
    const rowCount = Math.max(...savedVehicleLayout.map(s => s.row)) + 1;
    const colCount = Math.max(...savedVehicleLayout.map(s => s.col)) + 1;
    for (let d = 0; d < deckCount; d++) {
      const deck: (SerializedSeat | null)[][] = [];
      for (let r = 0; r < rowCount; r++) {
        const row: (SerializedSeat | null)[] = [];
        for (let c = 0; c < colCount; c++) {
          const s = savedVehicleLayout.find(x => x.deck === d && x.row === r && x.col === c);
          row.push(s ?? null);
        }
        deck.push(row);
      }
      layoutGrid.push(deck);
    }
  }

  const hasLayoutGrid = layoutGrid.length > 0;
  const deckCount = hasLayoutGrid ? layoutGrid.length : 1;
  const hasDualDeck = deckCount > 1;
  const currentGrid = hasLayoutGrid ? (layoutGrid[activeDeck] ?? []) : null;

  // Segment-aware availability: when the route has stops and user has selected pickup/dropoff,
  // a seat booked for a non-overlapping segment appears as available (empty).
  const hasSegmentSelection = !!(tripRoute?.routeStops?.length && fromStopId && toStopId);
  const currentFromOrder = hasSegmentSelection
    ? (tripRoute!.routeStops!.find(s => s.stopId === fromStopId)?.order ?? -1)
    : -1;
  const currentToOrder = hasSegmentSelection
    ? (tripRoute!.routeStops!.find(s => s.stopId === toStopId)?.order ?? -1)
    : -1;

  const getEffectiveStatus = (seatId: string): SeatStatus => {
    const rawStatus = seatStatusMap[seatId] ?? SeatStatus.EMPTY;
    if (!hasSegmentSelection || rawStatus === SeatStatus.EMPTY) return rawStatus;
    if (currentFromOrder < 0 || currentToOrder < 0) return rawStatus;
    // Look up the seat's stop orders from the trip seat data
    const seatData = selectedTrip.seats.find((s: any) => s.id === seatId);
    // Collect all segment bookings: prefer the new segmentBookings array, fall back to legacy fields
    const segments: Array<{ fromStopOrder: number; toStopOrder: number }> =
      (seatData?.segmentBookings ?? []).length > 0
        ? seatData.segmentBookings
        : (seatData?.fromStopOrder !== undefined && seatData?.toStopOrder !== undefined
            ? [{ fromStopOrder: seatData.fromStopOrder, toStopOrder: seatData.toStopOrder }]
            : []);
    if (segments.length === 0) return rawStatus;
    // Two segments [sFrom, sTo) and [currentFromOrder, currentToOrder) overlap iff:
    //   sFrom < currentToOrder AND currentFromOrder < sTo
    const anyOverlap = segments.some(
      seg => seg.fromStopOrder < currentToOrder && currentFromOrder < seg.toStopOrder
    );
    if (!anyOverlap) return SeatStatus.EMPTY; // seat is free for our segment
    return rawStatus;
  };

  const renderSeatButton = (seatId: string) => {
    const status = getEffectiveStatus(seatId);
    const rawStatus = seatStatusMap[seatId] ?? SeatStatus.EMPTY;
    const isSegmentFree = hasSegmentSelection && status === SeatStatus.EMPTY && rawStatus !== SeatStatus.EMPTY;
    const isPrimarySeat = seatId === showBookingForm;
    const isExtraSeat = extraSeatIds.includes(seatId);

    // Detect a seat that is booked for a specific sub-segment on a multi-stop route.
    // Such a seat is only half-colored: it may still be free for other segments.
    const seatDataForBtn = selectedTrip.seats.find((s: any) => s.id === seatId);
    const hasSegmentInfo =
      (seatDataForBtn?.segmentBookings ?? []).length > 0 ||
      (seatDataForBtn?.fromStopOrder !== undefined && seatDataForBtn?.toStopOrder !== undefined);
    const isPartiallyBooked =
      rawStatus !== SeatStatus.EMPTY &&
      !isSegmentFree &&
      !!(tripRoute?.routeStops?.length) &&
      hasSegmentInfo &&
      !isPrimarySeat &&
      !isExtraSeat;

    // Segment-conflict tooltip/warning badge
    const hasConflictWarning = segmentConflictSeat === seatId;

    return (
      <motion.button
        key={seatId}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          if (status !== SeatStatus.EMPTY) {
            // Partially-booked seat on a multi-stop route
            if (isPartiallyBooked) {
              if (hasSegmentSelection) {
                // Segment conflict: the user's selected segment overlaps → warn
                if (segmentConflictTimerRef.current) clearTimeout(segmentConflictTimerRef.current);
                setSegmentConflictSeat(seatId);
                segmentConflictTimerRef.current = setTimeout(() => setSegmentConflictSeat(null), 3000);
              } else {
                // No segment selected yet → open the booking form so the user can
                // pick a non-overlapping segment
                if (!showBookingForm) {
                  setSeatSelectionHistory(prev => [...prev, { primarySeat: null, extraSeats: [] }]);
                  setShowBookingForm(seatId);
                  if (currentUser?.role === UserRole.CUSTOMER) {
                    if (currentUser.name) setCustomerNameInput(currentUser.name);
                    if (currentUser.phone) setPhoneInput(currentUser.phone);
                  }
                }
              }
            }
            return;
          }
          if (showBookingForm) {
            if (isPrimarySeat) return;
            if (isExtraSeat) {
              setSeatSelectionHistory(prev => [...prev, { primarySeat: showBookingForm, extraSeats: extraSeatIds }]);
              setExtraSeatIds(prev => prev.filter(id => id !== seatId));
            } else if (isSelectingExtraSeats && extraSeatIds.length < extraSeatsNeeded) {
              setSeatSelectionHistory(prev => [...prev, { primarySeat: showBookingForm, extraSeats: extraSeatIds }]);
              setExtraSeatIds(prev => [...prev, seatId]);
            } else if (!isSelectingExtraSeats) {
              setSeatSelectionHistory(prev => [...prev, { primarySeat: showBookingForm, extraSeats: extraSeatIds }]);
              setExtraSeatIds([]);
              setShowBookingForm(seatId);
            }
          } else {
            setSeatSelectionHistory(prev => [...prev, { primarySeat: null, extraSeats: [] }]);
            setShowBookingForm(seatId);
            // Pre-fill name & phone for logged-in customers
            if (currentUser?.role === UserRole.CUSTOMER) {
              if (currentUser.name) setCustomerNameInput(currentUser.name);
              if (currentUser.phone) setPhoneInput(currentUser.phone);
            }
          }
        }}
        className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center text-[10px] font-bold border-2 transition-all flex-shrink-0 relative overflow-hidden",
          // Fully-booked seats (no segment info on a multi-stop route, or non-multi-stop)
          rawStatus === SeatStatus.PAID && !isSegmentFree && !isPartiallyBooked && "bg-daiichi-red text-white border-daiichi-red shadow-lg shadow-daiichi-red/20",
          rawStatus === SeatStatus.BOOKED && !isSegmentFree && !isPartiallyBooked && "bg-daiichi-yellow text-white border-daiichi-yellow shadow-lg shadow-daiichi-yellow/20",
          // Partially-booked seat: half-colored via inline style below; apply border color only
          isPartiallyBooked && rawStatus === SeatStatus.PAID && "border-daiichi-red text-daiichi-red hover:border-daiichi-red cursor-pointer",
          isPartiallyBooked && rawStatus === SeatStatus.BOOKED && "border-daiichi-yellow text-daiichi-yellow hover:border-daiichi-red cursor-pointer",
          isSegmentFree && !isPrimarySeat && !isExtraSeat && "bg-emerald-50 border-emerald-400 text-emerald-600 hover:border-daiichi-red hover:text-daiichi-red",
          isPrimarySeat && "bg-daiichi-red/20 border-daiichi-red text-daiichi-red",
          isExtraSeat && "bg-blue-100 border-blue-500 text-blue-600",
          status === SeatStatus.EMPTY && !isSegmentFree && !isPrimarySeat && !isExtraSeat && "bg-white border-gray-200 text-gray-500 hover:border-daiichi-red hover:text-daiichi-red",
          hasConflictWarning && "ring-2 ring-offset-1 ring-orange-400"
        )}
        style={isPartiallyBooked ? {
          background: rawStatus === SeatStatus.PAID
            ? 'linear-gradient(135deg, #E31B23 50%, #ffffff 50%)'
            : 'linear-gradient(135deg, #FBBF24 50%, #ffffff 50%)',
        } : undefined}
        title={
          isPartiallyBooked
            ? (language === 'vi' ? 'Ghế đã đặt một phần chặng — chọn ghế này để chọn chặng khác' : 'Partially booked — click to book a different segment')
            : isSegmentFree
              ? (language === 'vi' ? 'Trống cho chặng này' : 'Free for this segment')
              : undefined
        }
      >
        {seatId}
        {rawStatus === SeatStatus.PAID && !isSegmentFree && !isPartiallyBooked && <CheckCircle2 size={10} className="absolute top-0.5 right-0.5" />}
        {isExtraSeat && <span className="absolute top-0 right-0.5 text-[7px] font-bold text-blue-600">+</span>}
        {isSegmentFree && <span className="absolute top-0 right-0 text-[7px] font-bold text-emerald-600">✓</span>}
        {isPartiallyBooked && <span className="absolute top-0 right-0 text-[7px] font-bold leading-none" style={{ color: rawStatus === SeatStatus.PAID ? '#E31B23' : '#FBBF24' }}>½</span>}
        {hasConflictWarning && <span className="absolute bottom-0 left-0 right-0 text-[7px] font-bold text-orange-600 text-center leading-tight bg-orange-50">!</span>}
      </motion.button>
    );
  };

  return (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
    <div className="lg:col-span-2 bg-white p-4 sm:p-8 rounded-[40px] shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setShowBookingForm(null); setExtraSeatIds([]); setAddonQuantities({}); setActiveTab(previousTab); }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-gray-500 hover:text-daiichi-red hover:bg-gray-50 rounded-xl transition-all"
            title={language === 'vi' ? 'Quay lại' : language === 'ja' ? '戻る' : 'Go back'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
            {language === 'vi' ? 'Quay lại' : language === 'ja' ? '戻る' : 'Back'}
          </button>
          <div>
            <h2 className="text-2xl font-bold">
              {tripType === 'ROUND_TRIP' && previousTab === 'book-ticket'
                ? (roundTripPhase === 'return' ? t.seat_map_return : t.seat_map_outbound)
                : t.seat_map_title}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">{selectedTrip.licensePlate}</p>
          </div>
        </div>
        {hasDualDeck && (
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button onClick={() => setActiveDeck(0)} className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all", activeDeck === 0 ? "bg-white text-daiichi-red shadow-sm" : "text-gray-500")}>{t.deck_lower}</button>
            <button onClick={() => setActiveDeck(1)} className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all", activeDeck === 1 ? "bg-white text-daiichi-red shadow-sm" : "text-gray-500")}>{t.deck_upper}</button>
          </div>
        )}
      </div>

      {isSelectingExtraSeats && extraSeatIds.length < extraSeatsNeeded && (
        <div className="mb-4 p-3 bg-orange-50 rounded-2xl border border-orange-200 flex items-center gap-2">
          <span className="text-orange-500 font-bold text-sm">
            {t.select_extra_seats_prompt} ({extraSeatIds.length}/{extraSeatsNeeded})
          </span>
        </div>
      )}

      {isFreeSeatingTrip ? (
        /* ── FREE SEATING: no seat diagram, show available count + book button ── */
        <div className="max-w-lg mx-auto bg-gray-50 p-6 sm:p-10 rounded-[32px] border border-gray-100 text-center space-y-6">
          <div className="flex flex-col items-center gap-2">
            <span className="text-5xl font-bold text-daiichi-red">
              {selectedTrip.seats.filter((s: any) => s.status === SeatStatus.EMPTY).length}
            </span>
            <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">
              {language === 'vi' ? 'chỗ trống còn lại' : language === 'ja' ? '空席残り' : 'seats available'}
            </span>
            <span className="text-xs text-gray-400">
              {language === 'vi'
                ? `Tổng: ${selectedTrip.seats.length} chỗ • Đã đặt: ${selectedTrip.seats.filter((s: any) => s.status !== SeatStatus.EMPTY).length} chỗ`
                : `Total: ${selectedTrip.seats.length} • Booked: ${selectedTrip.seats.filter((s: any) => s.status !== SeatStatus.EMPTY).length}`}
            </span>
          </div>
          <div className="px-4 py-2 bg-blue-50 rounded-2xl border border-blue-100 inline-block mx-auto">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">
              🪑 {language === 'vi' ? 'Xe ghế tự do – Không chọn ghế' : language === 'ja' ? '自由席 – 座席指定なし' : 'Free Seating – No seat selection'}
            </span>
          </div>
          {!showBookingForm && (
            <button
              onClick={() => {
                if (selectedTrip.seats.filter((s: any) => s.status === SeatStatus.EMPTY).length === 0) return;
                // Push a no-op history entry so Escape/undo can cancel the booking form
                setSeatSelectionHistory(prev => [...prev, { primarySeat: null, extraSeats: [] }]);
                setShowBookingForm('FREE');
                if (currentUser?.role === UserRole.CUSTOMER) {
                  if (currentUser.name) setCustomerNameInput(currentUser.name);
                  if (currentUser.phone) setPhoneInput(currentUser.phone);
                }
              }}
              disabled={selectedTrip.seats.filter((s: any) => s.status === SeatStatus.EMPTY).length === 0}
              className="px-8 py-4 bg-daiichi-red text-white rounded-2xl font-bold shadow-lg shadow-daiichi-red/20 disabled:opacity-50 disabled:cursor-not-allowed text-base"
            >
              {language === 'vi' ? '🎫 Đặt vé' : language === 'ja' ? '🎫 予約する' : '🎫 Book Ticket'}
            </button>
          )}
        </div>
      ) : (
      <div className="max-w-lg mx-auto bg-gray-50 p-4 sm:p-6 rounded-[32px] border border-gray-100">
        {/* Front of bus indicator */}
        <div className="flex items-center gap-2 mb-3 text-xs text-gray-400 font-semibold">
          <span>← {language === 'vi' ? 'Đầu xe (Tài xế bên trái)' : 'Front (Driver on left)'}</span>
        </div>

        {hasLayoutGrid && currentGrid ? (
          // Render proper bus layout grid
          <div className="space-y-1.5">
            {currentGrid.map((row, rowIdx) => (
              <div key={rowIdx} className="flex gap-1.5 justify-center">
                {row.map((cell, colIdx) => {
                  if (!cell) {
                    // Aisle / empty cell
                    return <div key={colIdx} className="w-10 h-10 flex-shrink-0" />;
                  }
                  return (
                    <div key={colIdx} className="w-10 flex-shrink-0">
                      {renderSeatButton(cell.label)}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          // Fallback: flat grid (old behaviour)
          <div className="grid grid-cols-3 gap-3">
            {selectedTrip.seats.filter((s: any) => (s.deck || 0) === activeDeck).map((seat: any) => (
              <div key={seat.id}>
                {renderSeatButton(seat.id)}
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-center flex-wrap gap-4 text-xs font-bold uppercase tracking-wider">
          <div className="flex items-center gap-2"><div className="w-4 h-4 bg-daiichi-red rounded" /> {t.paid}</div>
          <div className="flex items-center gap-2"><div className="w-4 h-4 bg-daiichi-yellow rounded" /> {t.booked}</div>
          <div className="flex items-center gap-2"><div className="w-4 h-4 bg-white border border-gray-200 rounded" /> {t.empty}</div>
          {!!(tripRoute?.routeStops?.length) && (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-2 border-daiichi-yellow overflow-hidden" style={{ background: 'linear-gradient(135deg, #FBBF24 50%, #ffffff 50%)' }} />
              {language === 'vi' ? 'Đặt một phần chặng' : language === 'ja' ? '区間の一部予約' : 'Partial segment'}
            </div>
          )}
          {hasSegmentSelection && (
            <div className="flex items-center gap-2"><div className="w-4 h-4 bg-emerald-50 border-2 border-emerald-400 rounded" /> {language === 'vi' ? 'Trống chặng này' : language === 'ja' ? 'この区間は空き' : 'Free for segment'}</div>
          )}
        </div>

        {/* Segment-conflict warning banner */}
        {segmentConflictSeat && (
          <div className="mt-3 mx-auto max-w-xs p-2 bg-orange-50 border border-orange-300 rounded-xl flex items-center gap-2 text-xs font-bold text-orange-700 animate-pulse">
            <span>⚠️</span>
            <span>
              {language === 'vi'
                ? `Ghế ${segmentConflictSeat}: Chặng này đã có người ngồi rồi — vui lòng chọn chặng khác.`
                : language === 'ja'
                  ? `座席 ${segmentConflictSeat}: この区間はすでに予約されています — 別の区間を選んでください。`
                  : `Seat ${segmentConflictSeat}: This segment is already booked — please choose a different segment.`}
            </span>
          </div>
        )}
      </div>
      )}

      {/* Route details panel */}
      {tripRoute && (tripRoute.departurePoint || tripRoute.arrivalPoint || tripRoute.details || tripRoute.note) && (
        <div className="mt-6 bg-blue-50 border border-blue-100 rounded-[24px] p-5 space-y-3">
          <h4 className="text-sm font-bold text-blue-800">{t.route_details_title}</h4>
          {(tripRoute.departurePoint || tripRoute.arrivalPoint) && (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-gray-700">{tripRoute.departurePoint}</span>
              <span className="text-blue-400 font-bold">→</span>
              <span className="font-semibold text-gray-700">{tripRoute.arrivalPoint}</span>
            </div>
          )}
          {tripRoute.details && (
            <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{tripRoute.details}</p>
          )}
          {tripRoute.note && (
            <div className="pt-2 border-t border-blue-100">
              <p className="text-xs font-bold text-blue-700 mb-1">
                {language === 'vi' ? 'Ghi chú' : language === 'ja' ? 'メモ' : 'Note'}
              </p>
              <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{tripRoute.note}</p>
            </div>
          )}
        </div>
      )}
    </div>

    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">{t.trip_info}</h3>
          {isFreeSeatingTrip && (
            <span className="px-2 py-1 text-[10px] font-bold rounded-lg bg-blue-100 text-blue-600 uppercase tracking-wide">
              🪑 {language === 'vi' ? 'Ghế tự do' : language === 'ja' ? '自由席' : 'Free Seating'}
            </span>
          )}
        </div>
        <div className="space-y-4 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">{t.total_seats}</span><span className="font-bold">{selectedTrip.seats.length}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">{t.paid_seats}</span><span className="font-bold text-green-600">{selectedTrip.seats.filter(s => s.status === SeatStatus.PAID).length}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">{t.booked_seats}</span><span className="font-bold text-daiichi-yellow">{selectedTrip.seats.filter(s => s.status === SeatStatus.BOOKED).length}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">{t.empty_seats}</span><span className="font-bold text-gray-400">{selectedTrip.seats.filter(s => s.status === SeatStatus.EMPTY).length}</span></div>
        </div>
      </div>

      {!showBookingForm && (selectedTrip.addons || []).length > 0 && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-emerald-200">
          <div className="flex items-center gap-2 mb-3">
            <Gift size={20} className="text-emerald-600" />
            <h3 className="text-lg font-bold text-emerald-700">{language === 'vi' ? 'Dịch vụ bổ sung' : language === 'ja' ? '付帯サービス' : 'Add-on Services'}</h3>
          </div>
          <p className="text-xs text-gray-500 mb-3">{isFreeSeatingTrip ? (language === 'vi' ? 'Thêm các dịch vụ bổ sung vào vé của bạn:' : 'Add optional services to your booking:') : (language === 'vi' ? 'Chọn ghế để thêm các dịch vụ bổ sung vào vé của bạn:' : language === 'ja' ? '座席を選択してオプションサービスを追加できます:' : 'Select a seat to add these optional services to your booking:')}</p>
          <div className="space-y-2">
            {(selectedTrip.addons || []).map((addon: TripAddon) => (
              <div key={addon.id} className="flex items-start gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-gray-800">{addon.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">
                      {addon.type === 'SIGHTSEEING' ? t.addon_type_sightseeing : addon.type === 'TRANSPORT' ? t.addon_type_transport : addon.type === 'FOOD' ? t.addon_type_food : t.addon_type_other}
                    </span>
                  </div>
                  {addon.description && <p className="text-xs text-gray-500 mt-0.5">{addon.description}</p>}
                </div>
                <span className="text-sm font-bold text-daiichi-red whitespace-nowrap">+{addon.price.toLocaleString()}đ</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showBookingForm && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-white p-6 rounded-2xl shadow-sm border-2 border-daiichi-red">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">
              {isFreeSeatingTrip
                ? (language === 'vi' ? '🪑 Đặt vé ghế tự do' : language === 'ja' ? '🪑 自由席予約' : '🪑 Free Seating Booking')
                : `${t.booking_title}: ${showBookingForm}`}
            </h3>
            <button onClick={() => { setShowBookingForm(null); setExtraSeatIds([]); setAddonQuantities({}); }} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <form className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">{t.adults}</label>
                <div className="flex items-center gap-2 mt-1 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl">
                  <button type="button" onClick={() => {
                    const newAdults = Math.max(1, adults - 1);
                    setAdults(newAdults);
                    const currentOver5Count = childrenAges.filter(age => age >= 5).length;
                    const newExtraSeatsNeeded = (newAdults - 1) + currentOver5Count;
                    setExtraSeatIds(prev => prev.slice(0, newExtraSeatsNeeded));
                  }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 font-bold text-lg leading-none flex-shrink-0">−</button>
                  <span className="flex-1 text-center font-bold text-gray-800">{adults}</span>
                  <button type="button" onClick={() => setAdults(adults + 1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-daiichi-red text-white font-bold text-lg leading-none flex-shrink-0">+</button>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">{t.children}</label>
                <div className="flex items-center gap-2 mt-1 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl">
                  <button type="button" onClick={() => {
                    const count = Math.max(0, children - 1);
                    setChildren(count);
                    setChildrenAges(prev => prev.slice(0, count));
                    const newAges = childrenAges.slice(0, count);
                    const newOver5Count = newAges.filter(age => age >= 5).length;
                    setExtraSeatIds(prev => prev.slice(0, newOver5Count));
                  }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 font-bold text-lg leading-none flex-shrink-0">−</button>
                  <span className="flex-1 text-center font-bold text-gray-800">{children}</span>
                  <button type="button" onClick={() => {
                    const count = children + 1;
                    setChildren(count);
                    setChildrenAges(prev => {
                      const arr = [...prev];
                      while (arr.length < count) arr.push(undefined);
                      return arr.slice(0, count);
                    });
                  }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-daiichi-red text-white font-bold text-lg leading-none flex-shrink-0">+</button>
                </div>
              </div>
            </div>

            {/* Children age inputs */}
            {children > 0 && (
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 space-y-2">
                <p className="text-xs font-bold text-blue-600 uppercase">{t.enter_child_ages || "Enter each child's age"}</p>
                <p className="text-[10px] text-blue-400">{t.child_age_note || 'Children aged 5 and above are charged ticket price; aged 4 and below are free'}</p>
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: children }).map((_, i) => (
                    <div key={i} className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={childrenAges[i] != null ? String(childrenAges[i]) : ''}
                        placeholder={`${t.child_age_placeholder || 'Age'} ${i + 1}`}
                        onChange={e => {
                          const ages = [...childrenAges];
                          const parsed = parseInt(e.target.value);
                          ages[i] = e.target.value === '' ? undefined : (isNaN(parsed) ? undefined : Math.min(17, Math.max(0, parsed)));
                          setChildrenAges(ages);
                          // Trim extra seats if children over 5 count decreased
                          const newOver5Count = ages.filter(age => (age ?? 0) >= 5).length;
                          setExtraSeatIds(prev => prev.slice(0, newOver5Count));
                        }}
                        className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 text-center"
                      />
                      {(childrenAges[i] ?? 0) >= 5 && (
                        <span className="absolute -top-2 -right-1 bg-daiichi-red text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                          {t.child_counted_as_adult || 'Adult'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Extra seats required notice for all passengers */}
            {extraSeatsNeeded > 0 && (
              <div className={cn("p-3 rounded-xl border space-y-2", canConfirmBooking ? "bg-green-50 border-green-200" : "bg-orange-50 border-orange-200")}>
                <p className={cn("text-xs font-bold uppercase", canConfirmBooking ? "text-green-600" : "text-orange-600")}>
                  {t.seats_needed_notice || 'All passengers need their own seat'}
                </p>
                {!canConfirmBooking && (
                  <p className="text-[10px] text-orange-500">
                    {t.select_extra_seats_prompt_all || 'Please select extra seat(s) on the map for all passengers'} ({extraSeatIds.length}/{extraSeatsNeeded})
                  </p>
                )}
                {extraSeatIds.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    <span className="text-[10px] text-gray-500 font-bold uppercase">{t.extra_seats_selected_label || 'Extra seats'}:</span>
                    {extraSeatIds.map(id => (
                      <span key={id} className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                        {id} ✓
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div><label className="text-xs font-bold text-gray-500 uppercase">{t.customer_name}</label><input type="text" value={customerNameInput} onChange={(e) => setCustomerNameInput(e.target.value)} className="w-full mt-1 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20" placeholder={t.enter_name} /></div>
            <div><label className="text-xs font-bold text-gray-500 uppercase">{t.phone_number}</label><input type="tel" value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} className="w-full mt-1 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20" placeholder={t.enter_phone} /></div>
            
            {/* Departure Stop (Điểm xuất phát) + Pickup Address (Điểm đón) */}
            {(() => {
              const hasRouteFares = (tripRoute?.routeStops?.length ?? 0) > 0;
              // When route has ordered stops, show them in order; otherwise show all stops
              const pickupOptions = hasRouteFares && tripRoute?.routeStops
                ? [...tripRoute.routeStops].sort((a, b) => a.order - b.order).map(rs => rs.stopName)
                : stops.map(s => s.name);
              // Default departure label from route if no stop selected
              const defaultDeparture = tripRoute?.departurePoint || '';
              return (
                <>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">{t.pickup_point}</label>
                    <SearchableSelect
                      options={pickupOptions}
                      value={pickupPoint}
                      onChange={(val) => {
                        setPickupPoint(val);
                        setPickupAddress(''); // clear sub-stop when departure changes
                        setPickupAddressSurcharge(0); // clear address-level surcharge
                        // Determine stop ID: prefer routeStops match, fall back to global stops
                        const routeStop = tripRoute?.routeStops?.find(rs => rs.stopName === val);
                        const globalStop = stops.find(s => s.name === val);
                        const newFromId = routeStop?.stopId || globalStop?.id || '';
                        setPickupSurcharge(globalStop?.surcharge || 0);
                        setFromStopId(newFromId);
                        // Reset fare and re-lookup if dropoff is already chosen
                        setFareAmount(null);
                        setFareError('');
                        if (newFromId && toStopId && hasRouteFares) {
                          lookupFare(tripRoute, newFromId, toStopId);
                        }
                      }}
                      placeholder={pickupPoint ? t.select_pickup : (defaultDeparture || t.select_pickup)}
                      className="mt-1"
                    />
                    {!pickupPoint && defaultDeparture && (
                      <p className="mt-1 text-[10px] text-gray-400">{language === 'vi' ? `Mặc định: ${defaultDeparture}` : `Default: ${defaultDeparture}`}</p>
                    )}
                  </div>
                  <div className="pl-3 border-l-2 border-gray-100">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase">{t.pickup_address || 'Điểm đón'}</label>
                    <SearchableSelect
                      options={pickupStopNames}
                      optionDetails={pickupStopAddresses}
                      value={pickupAddress}
                      onChange={(val) => {
                        setPickupAddress(val);
                        // If value matches a predefined stop, apply its surcharge; otherwise clear it
                        const matchedStop = stops.find(s => s.name === val && pickupStopNames.includes(val));
                        setPickupAddressSurcharge(matchedStop?.surcharge || 0);
                      }}
                      placeholder={t.pickup_address_ph || 'Chọn hoặc nhập điểm đón...'}
                      className="mt-0.5"
                      inputClassName="!px-3 !py-1.5 !text-xs !rounded-lg"
                      disabled={isAddressDisabled(tripRoute?.disablePickupAddress, tripRoute?.disablePickupAddressFrom, tripRoute?.disablePickupAddressTo, tripDate)}
                    />
                    {/* Detail input for extra info like house number */}
                    <input
                      type="text"
                      value={pickupAddressDetail}
                      onChange={e => setPickupAddressDetail(e.target.value)}
                      placeholder={language === 'vi' ? 'Chi tiết (số nhà, tầng...)' : language === 'ja' ? '詳細（番地など）' : 'Detail (house no., floor...)'}
                      className="mt-1 w-full px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
                      disabled={isAddressDisabled(tripRoute?.disablePickupAddress, tripRoute?.disablePickupAddressFrom, tripRoute?.disablePickupAddressTo, tripDate)}
                    />
                    {isAddressDisabled(tripRoute?.disablePickupAddress, tripRoute?.disablePickupAddressFrom, tripRoute?.disablePickupAddressTo, tripDate) && (
                      <p className="mt-1 text-[10px] text-orange-500">{language === 'vi' ? 'Điểm đón đã bị vô hiệu hóa cho tuyến này' : language === 'ja' ? 'この路線では乗車地点の入力が無効です' : 'Pickup address input is disabled for this route'}</p>
                    )}
                    {pickupAddress && pickupStopNames.length > 0 && !pickupStopNames.includes(pickupAddress) && (
                      <p className="mt-1 text-[10px] text-amber-600">
                        {language === 'vi'
                          ? '⚠️ Giá vé có thể điều chỉnh nếu điểm đón của bạn quá xa.'
                          : language === 'ja'
                            ? '⚠️ 乗車地点が遠い場合、料金が調整される場合があります。'
                            : '⚠️ Price may be adjusted if your pickup point is too far.'}
                      </p>
                    )}
                  </div>
                </>
              );
            })()}

            {/* Destination Stop (Điểm đến) + Dropoff Address (Điểm trả) */}
            {(() => {
              const hasRouteFares = (tripRoute?.routeStops?.length ?? 0) > 0;
              const dropoffOptions = hasRouteFares && tripRoute?.routeStops
                ? [...tripRoute.routeStops].sort((a, b) => a.order - b.order).map(rs => rs.stopName)
                : stops.map(s => s.name);
              // Default arrival label from route if no stop selected
              const defaultArrival = tripRoute?.arrivalPoint || '';
              return (
                <>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">{t.dropoff_point}</label>
                    <SearchableSelect
                      options={dropoffOptions}
                      value={dropoffPoint}
                      onChange={(val) => {
                        setDropoffPoint(val);
                        setDropoffAddress(''); // clear sub-stop when destination changes
                        setDropoffAddressSurcharge(0); // clear address-level surcharge
                        // Determine stop ID: prefer routeStops match, fall back to global stops
                        const routeStop = tripRoute?.routeStops?.find(rs => rs.stopName === val);
                        const globalStop = stops.find(s => s.name === val);
                        const newToId = routeStop?.stopId || globalStop?.id || '';
                        setDropoffSurcharge(globalStop?.surcharge || 0);
                        setToStopId(newToId);
                        // Reset fare and re-lookup if pickup is already chosen
                        setFareAmount(null);
                        setFareError('');
                        if (fromStopId && newToId && hasRouteFares) {
                          lookupFare(tripRoute, fromStopId, newToId);
                        }
                      }}
                      placeholder={dropoffPoint ? t.select_dropoff : (defaultArrival || t.select_dropoff)}
                      className="mt-1"
                    />
                    {!dropoffPoint && defaultArrival && (
                      <p className="mt-1 text-[10px] text-gray-400">{language === 'vi' ? `Mặc định: ${defaultArrival}` : `Default: ${defaultArrival}`}</p>
                    )}
                    {/* Fare lookup feedback */}
                    {fareLoading && (
                      <p className="mt-1 text-xs text-blue-500 animate-pulse">
                        {t.fare_loading || 'Looking up fare...'}
                      </p>
                    )}
                    {!fareLoading && fareError && (
                      <p className="mt-1 text-xs text-red-500 font-medium">{fareError}</p>
                    )}
                    {!fareLoading && fareAmount !== null && (
                      <div className="mt-1 space-y-0.5">
                        <p className="text-xs text-emerald-600 font-bold">
                          {t.fare_based_price || 'Fare table price'}: {fareAmount.toLocaleString()}đ/{t.per_person || 'person'}
                        </p>
                        {fareAgentAmount !== null && currentUser?.role === UserRole.AGENT && fareAgentAmount !== fareAmount && (
                          <p className="text-xs text-orange-600 font-bold">
                            {language === 'vi' ? 'Giá đại lý' : language === 'ja' ? '代理店価格' : 'Agent price'}: {fareAgentAmount.toLocaleString()}đ/{t.per_person || 'person'}
                          </p>
                        )}
                      </div>
                    )}
                    {/* Segment-conflict warning inside the booking form */}
                    {(() => {
                      if (!hasSegmentSelection || !showBookingForm || showBookingForm === 'FREE') return null;
                      const bookedSeat = selectedTrip.seats.find((s: any) => s.id === showBookingForm);
                      if (!bookedSeat) return null;
                      const segs: Array<{ fromStopOrder: number; toStopOrder: number }> =
                        (bookedSeat.segmentBookings ?? []).length > 0
                          ? bookedSeat.segmentBookings
                          : (bookedSeat.fromStopOrder !== undefined && bookedSeat.toStopOrder !== undefined
                              ? [{ fromStopOrder: bookedSeat.fromStopOrder, toStopOrder: bookedSeat.toStopOrder }]
                              : []);
                      if (segs.length === 0) return null;
                      const conflict = segs.some(
                        seg => seg.fromStopOrder < currentToOrder && currentFromOrder < seg.toStopOrder
                      );
                      if (!conflict) return null;
                      return (
                        <div className="mt-2 p-2 bg-orange-50 border border-orange-300 rounded-xl flex items-start gap-2 text-xs font-bold text-orange-700">
                          <span className="mt-0.5">⚠️</span>
                          <span>
                            {language === 'vi'
                              ? 'Chặng này, ghế này đã có người ngồi rồi — vui lòng chọn chặng khác.'
                              : language === 'ja'
                                ? 'この区間はすでに予約されています — 別の区間を選んでください。'
                                : 'This segment is already taken — please choose a different segment.'}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="pl-3 border-l-2 border-gray-100">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase">{t.dropoff_address || 'Điểm trả'}</label>
                    <SearchableSelect
                      options={dropoffStopNames}
                      optionDetails={dropoffStopAddresses}
                      value={dropoffAddress}
                      onChange={(val) => {
                        setDropoffAddress(val);
                        // If value matches a predefined stop, apply its surcharge; otherwise clear it
                        const matchedStop = stops.find(s => s.name === val && dropoffStopNames.includes(val));
                        setDropoffAddressSurcharge(matchedStop?.surcharge || 0);
                      }}
                      placeholder={t.dropoff_address_ph || 'Chọn hoặc nhập điểm trả...'}
                      className="mt-0.5"
                      inputClassName="!px-3 !py-1.5 !text-xs !rounded-lg"
                      disabled={isAddressDisabled(tripRoute?.disableDropoffAddress, tripRoute?.disableDropoffAddressFrom, tripRoute?.disableDropoffAddressTo, tripDate)}
                    />
                    {/* Detail input for extra info like house number */}
                    <input
                      type="text"
                      value={dropoffAddressDetail}
                      onChange={e => setDropoffAddressDetail(e.target.value)}
                      placeholder={language === 'vi' ? 'Chi tiết (số nhà, tầng...)' : language === 'ja' ? '詳細（番地など）' : 'Detail (house no., floor...)'}
                      className="mt-1 w-full px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
                      disabled={isAddressDisabled(tripRoute?.disableDropoffAddress, tripRoute?.disableDropoffAddressFrom, tripRoute?.disableDropoffAddressTo, tripDate)}
                    />
                    {isAddressDisabled(tripRoute?.disableDropoffAddress, tripRoute?.disableDropoffAddressFrom, tripRoute?.disableDropoffAddressTo, tripDate) && (
                      <p className="mt-1 text-[10px] text-orange-500">{language === 'vi' ? 'Điểm trả đã bị vô hiệu hóa cho tuyến này' : language === 'ja' ? 'この路線では降車地点の入力が無効です' : 'Dropoff address input is disabled for this route'}</p>
                    )}
                    {dropoffAddress && dropoffStopNames.length > 0 && !dropoffStopNames.includes(dropoffAddress) && (
                      <p className="mt-1 text-[10px] text-amber-600">
                        {language === 'vi'
                          ? '⚠️ Giá vé có thể điều chỉnh nếu điểm trả của bạn quá xa.'
                          : language === 'ja'
                            ? '⚠️ 降車地点が遠い場合、料金が調整される場合があります。'
                            : '⚠️ Price may be adjusted if your dropoff point is too far.'}
                      </p>
                    )}
                  </div>
                </>
              );
            })()}

            {/* Surcharge (custom amount) */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">{t.surcharge_label}</label>
              <input
                type="number"
                min="0"
                step="1000"
                value={surchargeAmount || ''}
                onChange={(e) => setSurchargeAmount(parseInt(e.target.value) || 0)}
                placeholder={t.surcharge_placeholder}
                className="w-full mt-1 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
              />
            </div>

            {/* Add-on Services selection */}
            {(selectedTrip.addons || []).length > 0 && (
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">{t.select_addons}</label>
                <p className="text-[10px] text-gray-400 mt-0.5 mb-2">{t.select_addons_hint}</p>
                <div className="space-y-2">
                  {(selectedTrip.addons as TripAddon[]).map((addon) => {
                    const qty = addonQuantities[addon.id] || 0;
                    const checked = qty > 0;
                    const totalPassengers = adults + children;
                    return (
                      <div
                        key={addon.id}
                        className={cn(
                          "p-3 rounded-xl border transition-colors",
                          checked
                            ? "bg-emerald-50 border-emerald-300"
                            : "bg-gray-50 border-gray-100"
                        )}
                      >
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            className="accent-daiichi-red w-4 h-4 flex-shrink-0"
                            checked={checked}
                            onChange={(e) => {
                              setAddonQuantities(prev => ({
                                ...prev,
                                [addon.id]: e.target.checked ? Math.max(1, totalPassengers) : 0,
                              }));
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-gray-800">{addon.name}</p>
                            {addon.description && <p className="text-[10px] text-gray-500">{addon.description}</p>}
                          </div>
                          <span className="text-sm font-bold text-daiichi-red whitespace-nowrap">
                            +{addon.price.toLocaleString()}đ/{language === 'vi' ? 'người' : language === 'ja' ? '人' : 'pax'}
                          </span>
                        </label>
                        {checked && (
                          <div className="flex items-center gap-2 mt-2 ml-7">
                            <label className="text-[10px] text-gray-500 font-medium">
                              {language === 'vi' ? 'Số lượng:' : language === 'ja' ? '数量:' : 'Qty:'}
                            </label>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setAddonQuantities(prev => ({ ...prev, [addon.id]: Math.max(1, qty - 1) }))}
                                className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-sm flex items-center justify-center"
                              >−</button>
                              <input
                                type="number"
                                min="1"
                                value={qty}
                                onChange={(e) => {
                                  const v = parseInt(e.target.value) || 1;
                                  setAddonQuantities(prev => ({ ...prev, [addon.id]: Math.max(1, v) }));
                                }}
                                className="w-12 text-center px-1 py-0.5 bg-white border border-gray-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-1 focus:ring-emerald-400"
                              />
                              <button
                                type="button"
                                onClick={() => setAddonQuantities(prev => ({ ...prev, [addon.id]: qty + 1 }))}
                                className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-sm flex items-center justify-center"
                              >+</button>
                            </div>
                            <span className="text-[10px] text-emerald-700 font-bold ml-auto">
                              = {(addon.price * qty).toLocaleString()}đ
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Payment Method – shown conditionally based on user role */}
            {(() => {
              const isManager = currentUser?.role === UserRole.MANAGER;
              const isAgent = currentUser?.role === UserRole.AGENT;
              const agentDataForBooking = isAgent ? agents.find(a => a.id === currentUser?.id) : null;
              const isPostpaidAgent = isAgent && (agentDataForBooking?.paymentType === 'POSTPAID' || !agentDataForBooking?.paymentType);

              if (isManager) {
                // Manager: show all payment methods
                return (
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">{t.payment_method}</label>
                    <select
                      value={paymentMethodInput}
                      onChange={(e) => setPaymentMethodInput(e.target.value as PaymentMethod)}
                      className="w-full mt-1 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                    >
                      {PAYMENT_METHODS.map(method => (
                        <option key={method} value={method}>
                          {t[PAYMENT_METHOD_TRANSLATION_KEYS[method]]}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }

              if (isPostpaidAgent) {
                // POSTPAID agent: only "Giữ vé" or "Thanh toán sau"
                return (
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">{t.payment_method}</label>
                    <select
                      value={paymentMethodInput === 'Giữ vé' || paymentMethodInput === 'Thanh toán sau' ? paymentMethodInput : 'Giữ vé'}
                      onChange={(e) => setPaymentMethodInput(e.target.value as PaymentMethod)}
                      className="w-full mt-1 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                    >
                      <option value="Giữ vé">{t.payment_hold || 'Giữ vé (có thể chỉnh sửa)'}</option>
                      <option value="Thanh toán sau">{t.payment_later || 'Thanh toán sau (công nợ)'}</option>
                    </select>
                    <p className="text-[10px] text-purple-500 mt-1 ml-1">
                      {language === 'vi'
                        ? '"Giữ vé" có thể chỉnh sửa/xóa trước 24h xe chạy. "Thanh toán sau" xuất vé ngay, tính vào công nợ.'
                        : '"Hold Ticket" can be edited/deleted up to 24h before departure. "Pay Later" issues immediately, billed to your account.'}
                    </p>
                  </div>
                );
              }

              // Customer / Guest / PREPAID agent: locked to QR payment
              return (
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">{t.payment_method}</label>
                  <div className="w-full mt-1 px-4 py-2.5 bg-blue-50 border border-blue-100 rounded-xl text-sm font-bold text-blue-700 flex items-center gap-2">
                    <span>📱</span>
                    <span>{t.payment_qr || 'Chuyển khoản QR'}</span>
                  </div>
                  <p className="text-[10px] text-blue-400 mt-1 ml-1">
                    {language === 'vi'
                      ? 'Thanh toán QR bắt buộc. Thời gian chờ thanh toán: 30 phút.'
                      : language === 'ja'
                      ? 'QR支払い必須。支払い待機時間：30分。'
                      : 'QR payment required. Payment window: 30 minutes.'}
                  </p>
                </div>
              );
            })()}

            {/* Booking Note */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">{t.booking_note || 'Ghi chú đặt vé'}</label>
              <textarea
                value={bookingNote}
                onChange={(e) => setBookingNote(e.target.value)}
                rows={2}
                placeholder={t.booking_note_placeholder || 'Ghi chú của đại lý / nhà xe (cọc, thanh toán tài xế...)'}
                className="w-full mt-1 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20 text-sm resize-none"
              />
            </div>

            <div className="p-4 bg-daiichi-accent/20 rounded-xl border border-daiichi-accent/30 space-y-2">
              {(() => {
                // For agents use agentPrice when available; otherwise fall back to trip price
                const isAgentBookingForm = currentUser?.role === UserRole.AGENT;
                // Use agent fare if available, else retail fare
                const effectiveFareAmount = fareAmount !== null
                  ? (isAgentBookingForm && fareAgentAmount !== null ? fareAgentAmount : fareAmount)
                  : null;
                const basePriceAdult = effectiveFareAmount !== null
                  ? effectiveFareAmount
                  : (isAgentBookingForm
                      ? (selectedTrip.agentPrice || selectedTrip.price || 0)
                      : (selectedTrip.price || 0));
                const basePriceChild = effectiveFareAmount !== null
                  ? effectiveFareAmount
                  : (isAgentBookingForm
                      ? (selectedTrip.agentPriceChild || selectedTrip.agentPrice || selectedTrip.priceChild || basePriceAdult)
                      : (selectedTrip.priceChild || basePriceAdult));
                const { childrenOver5, childrenUnder5 } = childrenAges.reduce(
                  (acc, age) => age >= 5 ? { ...acc, childrenOver5: acc.childrenOver5 + 1 } : { ...acc, childrenUnder5: acc.childrenUnder5 + 1 },
                  { childrenOver5: 0, childrenUnder5: 0 }
                );
                const effectiveAdults = adults + childrenOver5;
                const effectiveChildren = childrenUnder5 + Math.max(0, children - childrenAges.length);
                // Children under 5 are free; only charge adults (which includes children aged 5+)
                const baseTotal = (effectiveAdults * basePriceAdult);
                const routeSurchargeTotal = applicableRouteSurcharges.reduce((sum, sc) => sum + sc.amount * effectiveAdults, 0);
                const allSurcharges = pickupSurcharge + dropoffSurcharge + pickupAddressSurcharge + dropoffAddressSurcharge + surchargeAmount + routeSurchargeTotal;
                const selectedAddonsInForm = (selectedTrip.addons || [] as TripAddon[]).filter((a: TripAddon) => (addonQuantities[a.id] || 0) > 0);
                const addonsTotalInForm = selectedAddonsInForm.reduce((sum, a) => sum + a.price * (addonQuantities[a.id] || 1), 0);
                const finalTotal = Math.round(baseTotal + allSurcharges + addonsTotalInForm);
                return (
                  <>
                    <div className="flex justify-between items-center text-xs text-gray-500">
                      <span>
                        {effectiveFareAmount !== null
                          ? (t.fare_based_price || 'Fare table price')
                          : (language === 'vi' ? 'Vé cơ bản' : language === 'ja' ? '基本運賃' : 'Base fare')}
                        {isAgentBookingForm && (selectedTrip.agentPrice || 0) > 0 && effectiveFareAmount === null && (
                          <span className="ml-1 text-orange-500 font-bold">({language === 'vi' ? 'Giá ĐL' : 'Agent'})</span>
                        )}
                        {isAgentBookingForm && effectiveFareAmount !== null && fareAgentAmount !== null && (
                          <span className="ml-1 text-orange-500 font-bold">({language === 'vi' ? 'Giá ĐL' : 'Agent'})</span>
                        )}
                      </span>
                      <span>{baseTotal.toLocaleString()}đ</span>
                    </div>
                    {applicableRouteSurcharges.map(sc => (
                      <div key={sc.id} className="flex justify-between items-center text-xs text-amber-600">
                        <span>+ {sc.name}</span>
                        <span>+{(sc.amount * effectiveAdults).toLocaleString()}đ</span>
                      </div>
                    ))}
                    {pickupSurcharge > 0 && (
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <span>+ {language === 'vi' ? 'Phụ thu đón khách' : language === 'ja' ? '乗客ピックアップ料' : 'Pickup surcharge'}</span>
                        <span>+{pickupSurcharge.toLocaleString()}đ</span>
                      </div>
                    )}
                    {dropoffSurcharge > 0 && (
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <span>+ {language === 'vi' ? 'Phụ thu trả khách' : language === 'ja' ? '乗客降車料' : 'Dropoff surcharge'}</span>
                        <span>+{dropoffSurcharge.toLocaleString()}đ</span>
                      </div>
                    )}
                    {pickupAddressSurcharge > 0 && (
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <span>+ {language === 'vi' ? 'Phụ thu điểm đón' : language === 'ja' ? '乗車地点追加料金' : 'Pickup address surcharge'}</span>
                        <span>+{pickupAddressSurcharge.toLocaleString()}đ</span>
                      </div>
                    )}
                    {dropoffAddressSurcharge > 0 && (
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <span>+ {language === 'vi' ? 'Phụ thu điểm trả' : language === 'ja' ? '降車地点追加料金' : 'Dropoff address surcharge'}</span>
                        <span>+{dropoffAddressSurcharge.toLocaleString()}đ</span>
                      </div>
                    )}
                    {surchargeAmount > 0 && (
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <span>+ {language === 'vi' ? 'Phụ thu khác' : language === 'ja' ? 'その他追加料金' : 'Other surcharge'}</span>
                        <span>+{surchargeAmount.toLocaleString()}đ</span>
                      </div>
                    )}
                    {selectedAddonsInForm.map(a => (
                      <div key={a.id} className="flex justify-between items-center text-xs text-emerald-600">
                        <span>+ {a.name} × {addonQuantities[a.id] || 1}</span>
                        <span>+{(a.price * (addonQuantities[a.id] || 1)).toLocaleString()}đ</span>
                      </div>
                    ))}
                    {(allSurcharges > 0 || addonsTotalInForm > 0) && <div className="border-t border-daiichi-accent/40 pt-1" />}
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-gray-500 uppercase">{t.total_amount}</span>
                      <span className="text-xl font-bold text-daiichi-red">{finalTotal.toLocaleString()}đ</span>
                    </div>
                  </>
                );
              })()}
            </div>

            <button type="button" onClick={() => handleConfirmBooking(showBookingForm || '')} disabled={!canConfirmBooking} className={cn("w-full py-4 text-white rounded-xl font-bold shadow-lg", canConfirmBooking ? "bg-daiichi-red shadow-daiichi-red/20" : "bg-gray-300 shadow-gray-200 cursor-not-allowed")}>{t.confirm_booking}</button>
          </form>
        </motion.div>
      )}
    </div>
  </div>
  );
}
