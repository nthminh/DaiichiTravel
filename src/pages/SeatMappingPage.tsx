import React, { useState, useRef } from 'react'
import { X, CheckCircle2, Gift, ChevronDown, ChevronUp } from 'lucide-react'
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
  showPreBookingInfo: boolean;
  customerNameInput: string;
  phoneInput: string;
  pickupPoint: string;
  dropoffPoint: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupAddressDetail: string;
  dropoffAddressDetail: string;
  pickupStopAddress: string;
  dropoffStopAddress: string;
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
  setShowPreBookingInfo: (v: boolean) => void;
  setCustomerNameInput: (v: string) => void;
  setPhoneInput: (v: string) => void;
  setPickupPoint: (v: string) => void;
  setDropoffPoint: (v: string) => void;
  setPickupAddress: (v: string) => void;
  setDropoffAddress: (v: string) => void;
  setPickupAddressDetail: (v: string) => void;
  setDropoffAddressDetail: (v: string) => void;
  setPickupStopAddress: (v: string) => void;
  setDropoffStopAddress: (v: string) => void;
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
  showPreBookingInfo,
  customerNameInput,
  phoneInput,
  pickupPoint,
  dropoffPoint,
  pickupAddress,
  dropoffAddress,
  pickupAddressDetail,
  dropoffAddressDetail,
  pickupStopAddress,
  dropoffStopAddress,
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
  setShowPreBookingInfo,
  setCustomerNameInput,
  setPhoneInput,
  setPickupPoint,
  setDropoffPoint,
  setPickupAddress,
  setDropoffAddress,
  setPickupAddressDetail,
  setDropoffAddressDetail,
  setPickupStopAddress,
  setDropoffStopAddress,
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
  const [takenSeatNotice, setTakenSeatNotice] = useState<string | null>(null);
  const [showRouteDetails, setShowRouteDetails] = useState(false);
  const segmentConflictTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const takenSeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const totalSeatsNeeded = adults + childrenOver5Count;
  // All children must have their age entered before proceeding to step 2
  const childAgesComplete = children === 0 || Array.from({ length: children }).every((_, i) => childrenAges[i] !== undefined);
  // Look up route once for this render block (used for surcharges, fare table, and blocker check)
  const tripRoute = routes.find(r => r.name === selectedTrip.route);
  // Also disable confirmation when a fare lookup error exists for a route with configured stops
  const hasFareBlocker = !!fareError && (tripRoute?.routeStops?.length ?? 0) > 0;
  const isFreeSeatingTrip = selectedTrip.seatType === 'free';
  const canConfirmBooking = isFreeSeatingTrip
    ? !hasFareBlocker
    : (extraSeatsNeeded === 0 || extraSeatIds.length >= extraSeatsNeeded) && !hasFareBlocker;
  const isSelectingExtraSeats = !isFreeSeatingTrip && !!showBookingForm && (adults > 1 || childrenOver5Count > 0);
  const shouldShowSeatCountBanner = !showPreBookingInfo && !isFreeSeatingTrip && !showBookingForm && totalSeatsNeeded > 1;

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
  const isPickupDisabledByDate = isAddressDisabled(tripRoute?.disablePickupAddress, tripRoute?.disablePickupAddressFrom, tripRoute?.disablePickupAddressTo, tripDate);
  const pickupDisableStopType = tripRoute?.disablePickupAddressStopType || 'ALL';
  const pickupSectionDisabled = isPickupDisabledByDate && pickupDisableStopType === 'ALL';

  const isDropoffDisabledByDate = isAddressDisabled(tripRoute?.disableDropoffAddress, tripRoute?.disableDropoffAddressFrom, tripRoute?.disableDropoffAddressTo, tripDate);
  const dropoffDisableStopType = tripRoute?.disableDropoffAddressStopType || 'ALL';
  const dropoffSectionDisabled = isDropoffDisabledByDate && dropoffDisableStopType === 'ALL';

  const basePickupStops = departureTerminal
    ? stops.filter(s => s.terminalId === departureTerminal.id)
    : stops.filter(s => s.type !== 'TERMINAL');
  const pickupStopsAfterType = isPickupDisabledByDate && pickupDisableStopType !== 'ALL'
    ? basePickupStops.filter(s => (s.type ?? 'STOP') !== pickupDisableStopType)
    : basePickupStops;
  const disabledPickupCategories = tripRoute?.disabledPickupCategories ?? [];
  const pickupStops = disabledPickupCategories.length > 0
    ? pickupStopsAfterType.filter(s => !disabledPickupCategories.includes(s.category ?? ''))
    : pickupStopsAfterType;

  const baseDropoffStops = arrivalTerminal
    ? stops.filter(s => s.terminalId === arrivalTerminal.id)
    : stops.filter(s => s.type !== 'TERMINAL');
  const dropoffStopsAfterType = isDropoffDisabledByDate && dropoffDisableStopType !== 'ALL'
    ? baseDropoffStops.filter(s => (s.type ?? 'STOP') !== dropoffDisableStopType)
    : baseDropoffStops;
  const disabledDropoffCategories = tripRoute?.disabledDropoffCategories ?? [];
  const dropoffStops = disabledDropoffCategories.length > 0
    ? dropoffStopsAfterType.filter(s => !disabledDropoffCategories.includes(s.category ?? ''))
    : dropoffStopsAfterType;
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
    // A single booking that spans the full route (first stop → last stop) is NOT partial.
    const totalStops = tripRoute?.routeStops?.length ?? 0;
    // Use actual min/max orders (robust against non-consecutive or non-1-based order values).
    const routeOrders = (tripRoute?.routeStops ?? []).map(rs => rs.order);
    const minRouteOrder = routeOrders.length > 0 ? Math.min(...routeOrders) : 1;
    const maxRouteOrder = routeOrders.length > 0 ? Math.max(...routeOrders) : totalStops;
    const segBookings = seatDataForBtn?.segmentBookings ?? [];
    const isFullRouteBooking =
      totalStops > 0 &&
      (
        // Legacy: stop orders stored directly on the seat, no segmentBookings array
        (segBookings.length === 0 &&
          seatDataForBtn?.fromStopOrder === minRouteOrder &&
          seatDataForBtn?.toStopOrder === maxRouteOrder) ||
        // Single segmentBooking that spans the entire route is also a full-route booking
        (segBookings.length === 1 &&
          segBookings[0].fromStopOrder === minRouteOrder &&
          segBookings[0].toStopOrder === maxRouteOrder)
      );
    const isPartiallyBooked =
      rawStatus !== SeatStatus.EMPTY &&
      !isSegmentFree &&
      !!(tripRoute?.routeStops?.length) &&
      hasSegmentInfo &&
      !isFullRouteBooking &&
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
            } else {
              // Fully-booked / paid seat → notify the user
              if (takenSeatTimerRef.current) clearTimeout(takenSeatTimerRef.current);
              setTakenSeatNotice(seatId);
              takenSeatTimerRef.current = setTimeout(() => setTakenSeatNotice(null), 4000);
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
          "w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold border-2 transition-all flex-shrink-0 relative overflow-hidden",
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
  <>
  {/* Mobile backdrop dim when a bottom-sheet form is visible */}
  {(showPreBookingInfo || (!!showBookingForm && !(isSelectingExtraSeats && !canConfirmBooking))) && (
    <div className="fixed inset-0 bg-black/20 z-[140] lg:hidden" />
  )}
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

      {shouldShowSeatCountBanner && (
        <div className="mb-4 p-3 bg-blue-50 rounded-2xl border border-blue-200 flex items-center gap-2">
          <span className="text-sm font-bold text-blue-700">
            👆 {language === 'vi'
              ? `Cần chọn ${totalSeatsNeeded} ghế cho ${totalSeatsNeeded} hành khách — chọn lần lượt từng ghế trên sơ đồ`
              : language === 'ja'
                ? `${totalSeatsNeeded}人の乗客のために${totalSeatsNeeded}席を選択してください — 座席表で1席ずつ選んでください`
                : `Please select ${totalSeatsNeeded} seats for ${totalSeatsNeeded} passengers — click each seat one by one`}
          </span>
        </div>
      )}

      {!showPreBookingInfo && isSelectingExtraSeats && extraSeatIds.length < extraSeatsNeeded && (
        <div className="mb-4 p-3 bg-orange-50 rounded-2xl border border-orange-200 flex items-center gap-2">
          <span className="text-orange-500 font-bold text-sm">
            {t.select_extra_seats_prompt} ({extraSeatIds.length}/{extraSeatsNeeded})
          </span>
        </div>
      )}

      {/* Step-by-step purchase guide */}
      {(() => {
        const isRoundTrip = tripType === 'ROUND_TRIP';

        let steps: string[];
        let hints: string[];
        let currentStep: number;

        if (isRoundTrip) {
          // Round-trip: 6-step flow — info declaration before seat selection for each leg
          if (language === 'vi') {
            steps = ['TT đi', 'Ghế đi', 'TT về', 'Ghế về', 'Thanh toán', 'Tải về'];
            hints = [
              '✍️ Khai báo thông tin hành khách và chặng chiều đi',
              '👆 Chọn ghế phù hợp theo số hành khách chiều đi',
              '✍️ Khai báo thông tin hành khách và chặng chiều về',
              '👆 Chọn ghế phù hợp theo số hành khách chiều về',
              '💳 Quét mã QR hoặc chọn phương thức thanh toán để hoàn tất cả hai chiều',
              '📥 Thanh toán thành công! Tải vé khứ hồi về máy để sử dụng khi lên xe',
            ];
          } else if (language === 'ja') {
            steps = ['出発情報', '出発席', '帰路情報', '帰路席', 'お支払い', 'ダウンロード'];
            hints = [
              '✍️ 出発便の乗客情報と区間を入力してください',
              '👆 出発便の空席（白色）をタップして乗客数に合わせて座席を選んでください',
              '✍️ 帰路便の乗客情報と区間を入力してください',
              '👆 帰路便の空席をタップして乗客数に合わせて座席を選んでください',
              '💳 QRコードをスキャンするか、支払い方法を選択して往復予約を確定してください',
              '📥 支払い完了！乗車時に使用する往復チケットをダウンロードしてください',
            ];
          } else {
            steps = ['Out. Info', 'Out. Seat', 'Ret. Info', 'Ret. Seat', 'Payment', 'Download'];
            hints = [
              '✍️ Declare passenger information and segment for the outbound trip',
              '👆 Tap an empty seat (white) to select seats for all outbound passengers',
              '✍️ Declare passenger information and segment for the return trip',
              '👆 Tap an empty seat to select seats for all return passengers',
              '💳 Scan the QR code or choose a payment method to complete both trips',
              '📥 Payment successful! Download your round-trip ticket to use when boarding',
            ];
          }
          // Steps 1–2: outbound (info then seat); Steps 3–4: return (info then seat)
          if (roundTripPhase === 'outbound') {
            currentStep = showPreBookingInfo ? 1 : 2;
          } else {
            currentStep = showPreBookingInfo ? 3 : 4;
          }
        } else {
          // ONE_WAY: info first, then seat selection
          if (language === 'vi') {
            steps = ['Nhập thông tin', 'Chọn ghế', 'Thanh toán', 'Tải về'];
            hints = [
              '✍️ Khai báo thông tin hành khách và chọn điểm xuất phát / điểm đến',
              '👆 Chọn ghế trống (màu trắng) theo số người đã khai báo',
              '💳 Quét mã QR hoặc chọn phương thức thanh toán để hoàn tất',
              '📥 Thanh toán thành công! Tải vé về máy để sử dụng khi lên xe',
            ];
          } else if (language === 'ja') {
            steps = ['情報を入力', '座席を選ぶ', 'お支払い', 'ダウンロード'];
            hints = [
              '✍️ 乗客情報と乗降区間を入力してください',
              '👆 空席（白色）をタップして、乗客数分の座席を選んでください',
              '💳 QRコードをスキャンするか、支払い方法を選択して完了してください',
              '📥 支払い完了！乗車時に使用するチケットをダウンロードしてください',
            ];
          } else {
            steps = ['Enter Info', 'Select Seat', 'Payment', 'Download'];
            hints = [
              '✍️ Declare passenger details and choose your departure / destination point',
              '👆 Tap an empty seat (white) to select seats for all passengers',
              '💳 Scan the QR code or choose a payment method to complete',
              '📥 Payment successful! Download your ticket to use when boarding',
            ];
          }
          currentStep = showPreBookingInfo ? 1 : 2;
        }

        return (
          <div className="mb-5 px-1">
            <div className="flex items-center justify-between">
              {steps.map((label, idx) => {
                const stepNum = idx + 1;
                const isActive = stepNum === currentStep;
                const isDone = stepNum < currentStep;
                return (
                  <React.Fragment key={stepNum}>
                    <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all shrink-0",
                        isActive ? "bg-daiichi-red border-daiichi-red text-white shadow-md shadow-daiichi-red/30" :
                        isDone ? "bg-emerald-500 border-emerald-500 text-white" :
                        "bg-white border-gray-200 text-gray-400"
                      )}>
                        {isDone ? '✓' : stepNum}
                      </div>
                      <span className={cn(
                        "text-[9px] font-bold text-center leading-tight truncate w-full text-center",
                        isActive ? "text-daiichi-red" : isDone ? "text-emerald-600" : "text-gray-400"
                      )}>
                        {label}
                      </span>
                    </div>
                    {idx < steps.length - 1 && (
                      <div className={cn(
                        "h-0.5 flex-1 mx-1 mb-4 transition-all",
                        isDone ? "bg-emerald-400" : "bg-gray-200"
                      )} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            {(() => {
              const hint = hints[currentStep - 1];
              return hint ? (
                <p className="mt-2 text-[10px] text-gray-400 text-center">
                  {hint}
                </p>
              ) : null;
            })()}
          </div>
        );
      })()}

      {!showPreBookingInfo && (isFreeSeatingTrip ? (
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

        <div className="overflow-x-auto">
          {hasLayoutGrid && currentGrid ? (
            // Render proper bus layout grid
            <div className="space-y-1">
              {currentGrid.map((row, rowIdx) => (
                <div key={rowIdx} className="flex gap-1 justify-center">
                  {row.map((cell, colIdx) => {
                    if (!cell) {
                      // Aisle / empty cell
                      return <div key={colIdx} className="w-8 h-8 flex-shrink-0" />;
                    }
                    return (
                      <div key={colIdx} className="w-8 flex-shrink-0">
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
        </div>

        <div className="mt-3 flex justify-center flex-wrap gap-2 text-[10px] font-semibold">
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-daiichi-red rounded flex-shrink-0" /> {t.paid}</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-daiichi-yellow rounded flex-shrink-0" /> {t.booked}</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-white border border-gray-200 rounded flex-shrink-0" /> {t.empty}</div>
          {!!(tripRoute?.routeStops?.length) && (
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded border-2 border-daiichi-yellow overflow-hidden flex-shrink-0" style={{ background: 'linear-gradient(135deg, #FBBF24 50%, #ffffff 50%)' }} />
              {language === 'vi' ? 'Đặt một phần chặng' : language === 'ja' ? '区間の一部予約' : 'Partial segment'}
            </div>
          )}
          {hasSegmentSelection && (
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-50 border-2 border-emerald-400 rounded flex-shrink-0" /> {language === 'vi' ? 'Trống chặng này' : language === 'ja' ? 'この区間は空き' : 'Free for segment'}</div>
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

        {/* Taken-seat warning banner */}
        {takenSeatNotice && (
          <div className="mt-3 mx-auto max-w-xs p-2 bg-red-50 border border-red-300 rounded-xl flex items-center gap-2 text-xs font-bold text-red-700">
            <span>🚫</span>
            <span className="flex-1">
              {language === 'vi'
                ? `Ghế ${takenSeatNotice} đã có người đặt rồi — vui lòng chọn ghế khác.`
                : language === 'ja'
                  ? `座席 ${takenSeatNotice} はすでに予約済みです — 別の座席を選んでください。`
                  : `Seat ${takenSeatNotice} is already booked — please choose another seat.`}
            </span>
            <button
              type="button"
              onClick={() => setTakenSeatNotice(null)}
              className="flex-shrink-0 text-red-400 hover:text-red-600 transition-colors"
              aria-label={language === 'vi' ? 'Đóng thông báo' : 'Dismiss'}
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
      ))}

      {/* Route details panel – collapsible */}
      {tripRoute && (tripRoute.departurePoint || tripRoute.arrivalPoint || tripRoute.details || tripRoute.note) && (
        <div className="mt-6 bg-blue-50 border border-blue-100 rounded-[24px] overflow-hidden">
          <button
            onClick={() => setShowRouteDetails(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm font-bold text-blue-800 hover:bg-blue-100 transition-colors"
          >
            <span>{t.route_details_title}</span>
            {showRouteDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showRouteDetails && (
            <div className="px-5 pb-5 space-y-3 border-t border-blue-100">
              {(tripRoute.departurePoint || tripRoute.arrivalPoint) && (
                <div className="flex items-stretch gap-2 pt-3">
                  <div className="flex flex-col items-center flex-shrink-0 mt-1" aria-hidden="true">
                    <div className="w-2 h-2 rounded-full bg-daiichi-red" />
                    <div className="w-px flex-1 bg-gray-300 my-1" />
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                  </div>
                  <div className="flex flex-col gap-2 min-w-0">
                    <span
                      className="font-semibold text-gray-700 text-sm leading-tight break-words"
                      aria-label={`${language === 'vi' ? 'Điểm đi' : language === 'ja' ? '出発地' : 'From'}: ${tripRoute.departurePoint}`}
                    >{tripRoute.departurePoint}</span>
                    <span
                      className="font-semibold text-gray-700 text-sm leading-tight break-words"
                      aria-label={`${language === 'vi' ? 'Điểm đến' : language === 'ja' ? '目的地' : 'To'}: ${tripRoute.arrivalPoint}`}
                    >{tripRoute.arrivalPoint}</span>
                  </div>
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
      )}
    </div>

    <div className="space-y-6">
      {showPreBookingInfo ? (
        /* ── STEP 1: PRE-BOOKING INFO FORM ── */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-2 sm:p-3 lg:p-3 fixed bottom-0 left-0 right-0 z-[150] rounded-t-3xl max-h-[90vh] overflow-y-auto lg:static lg:rounded-2xl lg:max-h-none lg:overflow-visible lg:shadow-sm border-2 border-daiichi-red"
        >
          {/* Drag handle visible on mobile */}
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-2 lg:hidden" />
          <h3 className="text-base sm:text-lg font-bold mb-0.5 sm:mb-1">
            {language === 'vi' ? '📋 Khai báo thông tin' : language === 'ja' ? '📋 乗客情報の入力' : '📋 Passenger Information'}
          </h3>
          <p className="text-xs text-gray-400 mb-1">
            <span className="sm:hidden">
              {language === 'vi' ? 'Nhập thông tin, chọn ghế trước khi đặt.' : language === 'ja' ? '情報入力後、座席を選んでください。' : 'Enter info, then select a seat.'}
            </span>
            <span className="hidden sm:inline">
              {language === 'vi'
                ? 'Nhập thông tin hành khách và điểm xuất phát / điểm đến trước khi chọn ghế.'
                : language === 'ja'
                  ? '座席を選ぶ前に乗客情報と乗降区間を入力してください。'
                  : 'Enter passenger details and departure / destination before selecting seats.'}
            </span>
          </p>
          <form className="space-y-1.5">
            {/* Adults / Children */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">{t.adults}</label>
                <div className="flex items-center gap-2 mt-1 px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-50 border border-gray-100 rounded-xl">
                  <button type="button" onClick={() => {
                    const newAdults = Math.max(1, adults - 1);
                    setAdults(newAdults);
                    const currentOver5Count = childrenAges.filter(age => age >= 5).length;
                    const newExtraSeatsNeeded = (newAdults - 1) + currentOver5Count;
                    setExtraSeatIds(prev => prev.slice(0, newExtraSeatsNeeded));
                  }} className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 font-bold text-lg leading-none flex-shrink-0">−</button>
                  <span className="flex-1 text-center font-bold text-gray-800">{adults}</span>
                  <button type="button" onClick={() => setAdults(adults + 1)} className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg bg-daiichi-red text-white font-bold text-lg leading-none flex-shrink-0">+</button>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">{t.children}</label>
                <div className="flex items-center gap-2 mt-1 px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-50 border border-gray-100 rounded-xl">
                  <button type="button" onClick={() => {
                    const count = Math.max(0, children - 1);
                    setChildren(count);
                    setChildrenAges(prev => prev.slice(0, count));
                    const newAges = childrenAges.slice(0, count);
                    const newOver5Count = newAges.filter(age => age >= 5).length;
                    setExtraSeatIds(prev => prev.slice(0, newOver5Count));
                  }} className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 font-bold text-lg leading-none flex-shrink-0">−</button>
                  <span className="flex-1 text-center font-bold text-gray-800">{children}</span>
                  <button type="button" onClick={() => {
                    const count = children + 1;
                    setChildren(count);
                    setChildrenAges(prev => {
                      const arr = [...prev];
                      while (arr.length < count) arr.push(undefined);
                      return arr.slice(0, count);
                    });
                  }} className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg bg-daiichi-red text-white font-bold text-lg leading-none flex-shrink-0">+</button>
                </div>
              </div>
            </div>

            {/* Children ages */}
            {children > 0 && (
              <div className="p-2 sm:p-3 bg-blue-50 rounded-xl border border-blue-100 space-y-1.5 sm:space-y-2">
                <p className="text-xs font-bold text-blue-600 uppercase">{t.enter_child_ages || "Enter each child's age"}</p>
                <p className="text-[10px] text-blue-400">
                  <span className="sm:hidden">
                    {language === 'vi' ? '≥5 tuổi: mua vé; <5 tuổi: miễn phí' : language === 'ja' ? '5歳以上：有料、4歳以下：無料' : '≥5 yrs: charged; <5 yrs: free'}
                  </span>
                  <span className="hidden sm:inline">{t.child_age_note || 'Children aged 5 and above are charged ticket price; aged 4 and below are free'}</span>
                </p>
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
                          const newOver5Count = ages.filter(age => (age ?? 0) >= 5).length;
                          setExtraSeatIds(prev => prev.slice(0, newOver5Count));
                        }}
                        className="w-full px-3 py-1.5 sm:py-2 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 text-center"
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

            {/* Name */}
            <div className="relative">
              <label className="absolute left-3 top-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider pointer-events-none z-10">{t.customer_name}</label>
              <input type="text" value={customerNameInput} onChange={(e) => setCustomerNameInput(e.target.value)} className="w-full px-3 pt-5 pb-1 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20 text-sm" placeholder={t.enter_name} />
            </div>
            {/* Phone */}
            <div className="relative">
              <label className="absolute left-3 top-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider pointer-events-none z-10">{t.phone_number}</label>
              <input type="tel" value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} className="w-full px-3 pt-5 pb-1 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20 text-sm" placeholder={t.enter_phone} />
            </div>

            {/* Departure Stop (Điểm xuất phát) + Pickup Address */}
            {(() => {
              const hasRouteFares = (tripRoute?.routeStops?.length ?? 0) > 0;
              const pickupOptions = hasRouteFares && tripRoute?.routeStops
                ? [...tripRoute.routeStops].sort((a, b) => a.order - b.order).map(rs => rs.stopName)
                : stops.map(s => s.name);
              const defaultDeparture = tripRoute?.departurePoint || '';
              return (
                <>
                  <div>
                    <SearchableSelect
                      options={pickupOptions}
                      value={pickupPoint}
                      inlineLabel={t.pickup_point}
                      onChange={(val) => {
                        setPickupPoint(val);
                        setPickupAddress('');
                        setPickupStopAddress('');
                        setPickupAddressSurcharge(0);
                        const routeStop = tripRoute?.routeStops?.find(rs => rs.stopName === val);
                        const globalStop = stops.find(s => s.name === val);
                        const newFromId = routeStop?.stopId || globalStop?.id || '';
                        setPickupSurcharge(globalStop?.surcharge || 0);
                        setFromStopId(newFromId);
                        setFareAmount(null);
                        setFareError('');
                        if (newFromId && toStopId && hasRouteFares) {
                          lookupFare(tripRoute, newFromId, toStopId);
                        }
                      }}
                      placeholder={pickupPoint ? t.select_pickup : (defaultDeparture || t.select_pickup)}
                    />
                    {!pickupPoint && defaultDeparture && (
                      <p className="mt-1 text-[10px] text-gray-400">{language === 'vi' ? `Mặc định: ${defaultDeparture}` : `Default: ${defaultDeparture}`}</p>
                    )}
                  </div>
                  <div className="pl-3 border-l-2 border-gray-200">
                    <label className="text-[10px] font-semibold text-gray-500 uppercase">{t.pickup_address || 'Điểm đón'}</label>
                    <SearchableSelect
                      options={pickupStopNames}
                      optionDetails={pickupStopAddresses}
                      value={pickupAddress}
                      onChange={(val) => {
                        setPickupAddress(val);
                        const matchedStop = stops.find(s => s.name === val && pickupStopNames.includes(val));
                        setPickupAddressSurcharge(matchedStop?.surcharge || 0);
                        setPickupStopAddress(matchedStop?.address || '');
                      }}
                      placeholder={t.pickup_address_ph || 'Chọn hoặc nhập điểm đón...'}
                      className="mt-0.5"
                      inputClassName="!px-3 !py-1.5 !text-xs !rounded-lg"
                      disabled={pickupSectionDisabled}
                    />
                    <input
                      type="text"
                      value={pickupAddressDetail}
                      onChange={e => setPickupAddressDetail(e.target.value)}
                      placeholder={language === 'vi' ? 'Chi tiết (số nhà, tầng...)' : language === 'ja' ? '詳細（番地など）' : 'Detail (house no., floor...)'}
                      className="mt-1 w-full px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
                      disabled={pickupSectionDisabled}
                    />
                    {pickupSectionDisabled && (
                      <p className="mt-1 text-[10px] text-orange-500">{language === 'vi' ? 'Điểm đón đã bị vô hiệu hóa cho tuyến này' : 'Pickup address input is disabled for this route'}</p>
                    )}
                  </div>
                </>
              );
            })()}

            {/* Destination Stop (Điểm đến) + Dropoff Address */}
            {(() => {
              const hasRouteFares = (tripRoute?.routeStops?.length ?? 0) > 0;
              const dropoffOptions = hasRouteFares && tripRoute?.routeStops
                ? [...tripRoute.routeStops].sort((a, b) => a.order - b.order).map(rs => rs.stopName)
                : stops.map(s => s.name);
              const defaultArrival = tripRoute?.arrivalPoint || '';
              return (
                <>
                  <div>
                    <SearchableSelect
                      options={dropoffOptions}
                      value={dropoffPoint}
                      inlineLabel={t.dropoff_point}
                      onChange={(val) => {
                        setDropoffPoint(val);
                        setDropoffAddress('');
                        setDropoffStopAddress('');
                        setDropoffAddressSurcharge(0);
                        const routeStop = tripRoute?.routeStops?.find(rs => rs.stopName === val);
                        const globalStop = stops.find(s => s.name === val);
                        const newToId = routeStop?.stopId || globalStop?.id || '';
                        setDropoffSurcharge(globalStop?.surcharge || 0);
                        setToStopId(newToId);
                        setFareAmount(null);
                        setFareError('');
                        if (fromStopId && newToId && hasRouteFares) {
                          lookupFare(tripRoute, fromStopId, newToId);
                        }
                      }}
                      placeholder={dropoffPoint ? t.select_dropoff : (defaultArrival || t.select_dropoff)}
                    />
                    {!dropoffPoint && defaultArrival && (
                      <p className="mt-1 text-[10px] text-gray-400">{language === 'vi' ? `Mặc định: ${defaultArrival}` : `Default: ${defaultArrival}`}</p>
                    )}
                    {/* Fare lookup feedback */}
                    {fareLoading && (
                      <p className="mt-1 text-xs text-blue-500 animate-pulse">{t.fare_loading || 'Looking up fare...'}</p>
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
                  </div>
                  <div className="pl-3 border-l-2 border-gray-200">
                    <label className="text-[10px] font-semibold text-gray-500 uppercase">{t.dropoff_address || 'Điểm trả'}</label>
                    <SearchableSelect
                      options={dropoffStopNames}
                      optionDetails={dropoffStopAddresses}
                      value={dropoffAddress}
                      onChange={(val) => {
                        setDropoffAddress(val);
                        const matchedStop = stops.find(s => s.name === val && dropoffStopNames.includes(val));
                        setDropoffAddressSurcharge(matchedStop?.surcharge || 0);
                        setDropoffStopAddress(matchedStop?.address || '');
                      }}
                      placeholder={t.dropoff_address_ph || 'Chọn hoặc nhập điểm trả...'}
                      className="mt-0.5"
                      inputClassName="!px-3 !py-1.5 !text-xs !rounded-lg"
                      disabled={dropoffSectionDisabled}
                    />
                    <input
                      type="text"
                      value={dropoffAddressDetail}
                      onChange={e => setDropoffAddressDetail(e.target.value)}
                      placeholder={language === 'vi' ? 'Chi tiết (số nhà, tầng...)' : language === 'ja' ? '詳細（番地など）' : 'Detail (house no., floor...)'}
                      className="mt-1 w-full px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
                      disabled={dropoffSectionDisabled}
                    />
                    {dropoffSectionDisabled && (
                      <p className="mt-1 text-[10px] text-orange-500">{language === 'vi' ? 'Điểm trả đã bị vô hiệu hóa cho tuyến này' : 'Dropoff address input is disabled for this route'}</p>
                    )}
                  </div>
                </>
              );
            })()}

            {/* Fare error blocker reminder */}
            {hasFareBlocker && (
              <p className="text-xs text-red-500 font-medium">{fareError}</p>
            )}

            {/* Child ages required warning */}
            {children > 0 && !childAgesComplete && (
              <p className="text-xs text-red-500 font-medium">{t.child_ages_required || 'Please enter the age for all children before proceeding.'}</p>
            )}

            {/* Next: Select Seat button */}
            <button
              type="button"
              onClick={() => setShowPreBookingInfo(false)}
              disabled={hasFareBlocker || !childAgesComplete}
              className={cn(
                "w-full py-3 sm:py-4 text-white rounded-xl font-bold shadow-lg transition-all",
                (hasFareBlocker || !childAgesComplete)
                  ? "bg-gray-300 shadow-gray-200 cursor-not-allowed"
                  : "bg-daiichi-red shadow-daiichi-red/20"
              )}
            >
              {isFreeSeatingTrip
                ? (language === 'vi' ? '✅ Tiếp theo: Đặt vé →' : language === 'ja' ? '✅ 次へ：予約する →' : '✅ Next: Book Ticket →')
                : (language === 'vi' ? '✅ Tiếp theo: Chọn ghế →' : language === 'ja' ? '✅ 次へ：座席を選ぶ →' : '✅ Next: Select Seat →')}
            </button>
          </form>
        </motion.div>
      ) : (
        /* ── STEP 2+: SEAT SELECTION AND CONFIRM ── */
        <>
          {/* Compact info summary with edit link */}
          <div className="bg-white px-4 py-3 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-700 truncate">
                {customerNameInput || (language === 'vi' ? 'Chưa nhập tên' : 'No name')}
                {phoneInput ? ` · ${phoneInput}` : ''}
              </p>
              <p className="text-[10px] text-gray-500 truncate mt-0.5">
                {adults} {t.adults}{children > 0 ? ` + ${children} ${t.children}` : ''}
                {(pickupPoint || tripRoute?.departurePoint) && (
                  <> · {pickupPoint || tripRoute?.departurePoint || '?'} → {dropoffPoint || tripRoute?.arrivalPoint || '?'}</>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPreBookingInfo(true)}
              className="flex-shrink-0 text-[10px] text-daiichi-red font-bold px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
            >
              ✏️ {language === 'vi' ? 'Sửa' : language === 'ja' ? '編集' : 'Edit'}
            </button>
          </div>

          {!showBookingForm && (selectedTrip.addons || []).length > 0 && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-emerald-200">
              <div className="flex items-center gap-2 mb-3">
                <Gift size={20} className="text-emerald-600" />
                <h3 className="text-lg font-bold text-emerald-700">{language === 'vi' ? 'Dịch vụ bổ sung' : language === 'ja' ? '付帯サービス' : 'Add-on Services'}</h3>
              </div>
              <p className="text-xs text-gray-500 mb-3">{isFreeSeatingTrip ? (language === 'vi' ? 'Thêm các dịch vụ bổ sung vào vé của bạn:' : 'Add optional services to your booking:') : (language === 'vi' ? 'Chọn ghế để thêm dịch vụ bổ sung:' : language === 'ja' ? '座席を選択してオプションサービスを追加できます:' : 'Select a seat to add these optional services:')}</p>
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

          {/* ── COMPACT CONFIRM PANEL (seat selected, show price summary + confirm) ── */}
          {showBookingForm && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "bg-white p-3 sm:p-5 lg:p-6 fixed bottom-0 left-0 right-0 z-[150] rounded-t-3xl max-h-[90vh] overflow-y-auto lg:static lg:rounded-2xl lg:max-h-none lg:overflow-visible lg:shadow-sm border-2 border-daiichi-red",
                isSelectingExtraSeats && !canConfirmBooking && "hidden lg:block"
              )}
            >
              {/* Drag handle visible on mobile */}
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-2 lg:hidden" />
              <div className="flex justify-between items-center mb-2 sm:mb-4">
                <h3 className="text-base sm:text-lg font-bold">
                  {isFreeSeatingTrip
                    ? (language === 'vi' ? '🪑 Xác nhận đặt vé' : language === 'ja' ? '🪑 予約確認' : '🪑 Confirm Booking')
                    : `${t.booking_title}: ${showBookingForm}`}
                </h3>
                <button onClick={() => { setShowBookingForm(null); setExtraSeatIds([]); setAddonQuantities({}); }} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>
              <form className="space-y-2.5 sm:space-y-4">
                {/* Segment conflict warning */}
                {(() => {
                  if (!hasSegmentSelection || !showBookingForm || showBookingForm === 'FREE') return null;
                  const bookedSeat = selectedTrip.seats.find((s: any) => s.id === showBookingForm);
                  // If the seat is actually EMPTY (no active booking), never show a conflict warning
                  // even if stale segment fields are present from a previously deleted booking.
                  if (!bookedSeat || bookedSeat.status === SeatStatus.EMPTY) return null;
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
                    <div className="p-2 bg-orange-50 border border-orange-300 rounded-xl flex items-start gap-2 text-xs font-bold text-orange-700">
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

                {/* Extra seats required notice */}
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
                              checked ? "bg-emerald-50 border-emerald-300" : "bg-gray-50 border-gray-100"
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

                {/* Payment Method */}
                {(() => {
                  const isManager = currentUser?.role === UserRole.MANAGER;
                  const isAgent = currentUser?.role === UserRole.AGENT;
                  const agentDataForBooking = isAgent ? agents.find(a => a.id === currentUser?.id) : null;
                  const isPostpaidAgent = isAgent && (agentDataForBooking?.paymentType === 'POSTPAID' || !agentDataForBooking?.paymentType);

                  if (isManager) {
                    return (
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">{t.payment_method}</label>
                        <select
                          value={paymentMethodInput}
                          onChange={(e) => setPaymentMethodInput(e.target.value as any)}
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
                    return (
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">{t.payment_method}</label>
                        <select
                          value={paymentMethodInput === 'Giữ vé' || paymentMethodInput === 'Thanh toán sau' ? paymentMethodInput : 'Giữ vé'}
                          onChange={(e) => setPaymentMethodInput(e.target.value as any)}
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

                  return (
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">{t.payment_method}</label>
                      <div className="w-full mt-1 px-4 py-2.5 bg-blue-50 border border-blue-100 rounded-xl text-sm font-bold text-blue-700 flex items-center gap-2">
                        <span>📱</span>
                        <span>{t.payment_qr || 'Chuyển khoản QR'}</span>
                      </div>
                      <p className="text-[10px] text-blue-400 mt-1 ml-1">
                        {language === 'vi'
                          ? 'Thanh toán QR bắt buộc. Thời gian chờ thanh toán: 3 phút.'
                          : language === 'ja'
                          ? 'QR支払い必須。支払い待機時間：3分。'
                          : 'QR payment required. Payment window: 3 minutes.'}
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

                {/* Price Summary */}
                <div className="p-4 bg-daiichi-accent/20 rounded-xl border border-daiichi-accent/30 space-y-2">
                  {(() => {
                    const isAgentBookingForm = currentUser?.role === UserRole.AGENT;
                    const tripDiscountMul = 1 - ((selectedTrip.discountPercent || 0) / 100);
                    const effectiveFareAmount = fareAmount !== null
                      ? (isAgentBookingForm && fareAgentAmount !== null ? fareAgentAmount : fareAmount)
                      : null;
                    const basePriceAdult = effectiveFareAmount !== null
                      ? effectiveFareAmount
                      : (isAgentBookingForm
                          ? Math.round(((selectedTrip.agentPrice || selectedTrip.price || 0)) * tripDiscountMul)
                          : Math.round((selectedTrip.price || 0) * tripDiscountMul));
                    const { childrenOver5 } = childrenAges.reduce(
                      (acc, age) => age >= 5 ? { ...acc, childrenOver5: acc.childrenOver5 + 1 } : { ...acc, childrenUnder5: acc.childrenUnder5 + 1 },
                      { childrenOver5: 0, childrenUnder5: 0 }
                    );
                    const effectiveAdults = adults + childrenOver5;
                    const baseTotal = (effectiveAdults * basePriceAdult);
                    const routeSurchargeTotal = applicableRouteSurcharges.reduce((sum, sc) => sum + sc.amount * effectiveAdults, 0);
                    const pickupDropoffSurchargeDisplay = (pickupSurcharge + dropoffSurcharge + pickupAddressSurcharge + dropoffAddressSurcharge) * effectiveAdults;
                    const allSurcharges = pickupDropoffSurchargeDisplay + surchargeAmount + routeSurchargeTotal;
                    const selectedAddonsInForm = (selectedTrip.addons || [] as TripAddon[]).filter((a: TripAddon) => (addonQuantities[a.id] || 0) > 0);
                    const addonsTotalInForm = selectedAddonsInForm.reduce((sum, a) => sum + a.price * (addonQuantities[a.id] || 1), 0);
                    const finalTotal = Math.round(baseTotal + allSurcharges + addonsTotalInForm);
                    const perSeatSuffix = effectiveAdults > 1 ? ` ×${effectiveAdults}` : '';
                    return (
                      <>
                        <div className="flex justify-between items-center text-xs text-gray-500">
                          <span>
                            {effectiveFareAmount !== null
                              ? (t.fare_based_price || 'Fare table price')
                              : (language === 'vi' ? 'Vé cơ bản' : language === 'ja' ? '基本運賃' : 'Base fare')}
                            {perSeatSuffix}
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
                            <span>+ {language === 'vi' ? 'Phụ thu đón khách' : 'Pickup surcharge'}{perSeatSuffix}</span>
                            <span>+{(pickupSurcharge * effectiveAdults).toLocaleString()}đ</span>
                          </div>
                        )}
                        {dropoffSurcharge > 0 && (
                          <div className="flex justify-between items-center text-xs text-gray-500">
                            <span>+ {language === 'vi' ? 'Phụ thu trả khách' : 'Dropoff surcharge'}{perSeatSuffix}</span>
                            <span>+{(dropoffSurcharge * effectiveAdults).toLocaleString()}đ</span>
                          </div>
                        )}
                        {pickupAddressSurcharge > 0 && (
                          <div className="flex justify-between items-center text-xs text-gray-500">
                            <span>+ {language === 'vi' ? 'Phụ thu điểm đón' : 'Pickup address surcharge'}{perSeatSuffix}</span>
                            <span>+{(pickupAddressSurcharge * effectiveAdults).toLocaleString()}đ</span>
                          </div>
                        )}
                        {dropoffAddressSurcharge > 0 && (
                          <div className="flex justify-between items-center text-xs text-gray-500">
                            <span>+ {language === 'vi' ? 'Phụ thu điểm trả' : 'Dropoff address surcharge'}{perSeatSuffix}</span>
                            <span>+{(dropoffAddressSurcharge * effectiveAdults).toLocaleString()}đ</span>
                          </div>
                        )}
                        {surchargeAmount > 0 && (
                          <div className="flex justify-between items-center text-xs text-gray-500">
                            <span>+ {language === 'vi' ? 'Phụ thu khác' : 'Other surcharge'}</span>
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
        </>
      )}
    </div>
  </div>
  </>
  );
}
