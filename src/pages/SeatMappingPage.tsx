import React, { useState, useRef, useEffect } from 'react'
import { X, CheckCircle2, Gift, ChevronDown, ChevronUp, Info, Lock } from 'lucide-react'
import { cn } from '../lib/utils'
import { Language, TRANSLATIONS, UserRole, SeatStatus } from '../constants/translations'
import { PAYMENT_METHODS, type PaymentMethod, PAYMENT_METHOD_TRANSLATION_KEYS } from '../constants/paymentMethods'
import { Trip, Route, Stop, Agent, Vehicle, TripAddon, RouteSurcharge, RouteSeatFare } from '../types'
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
  /** Segment fare from the fare table (independent of per-seat overrides). Used as fallback
   * price for seats without a RouteSeatFare when the primary seat has an override. */
  segmentBaseFare: number | null;
  segmentBaseAgentFare: number | null;
  /** Per-seat fare overrides for the current route – passed in from App.tsx */
  routeSeatFares: RouteSeatFare[];
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
  setFareAgentAmount: (v: number | null) => void;
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
  segmentBaseFare,
  segmentBaseAgentFare,
  routeSeatFares,
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
  setFareAgentAmount,
  setFareError,
  setActiveTab,
  handleConfirmBooking,
  lookupFare,
}: SeatMappingPageProps) {
  const t = TRANSLATIONS[language];

  /** Return the applicable seat fare for a given seatId and optional trip date. */
  const getActiveSeatFare = (seatId: string, dateStr?: string): RouteSeatFare | undefined => {
    const candidates = routeSeatFares.filter(f => f.seatId === seatId);
    if (candidates.length === 0) return undefined;
    if (dateStr) {
      const dated = candidates.find(f => {
        const afterStart = !f.startDate || f.startDate <= dateStr;
        const beforeEnd = !f.endDate || f.endDate >= dateStr;
        return afterStart && beforeEnd;
      });
      if (dated) return dated;
    }
    // Fallback: fare without date restriction (open-ended default price)
    return candidates.find(f => !f.startDate && !f.endDate);
    // If only date-specific fares exist and none match the trip date,
    // return undefined so the segment fare / route default is used instead.
  };

  /**
   * Called each time the primary seat changes.
   * Applies the seat-specific fare if one exists; otherwise re-fetches the
   * segment fare (or resets to null so the trip default price is used).
   */
  const applyFareForSeat = (seatId: string) => {
    const tripRouteObj = routes.find(r => r.name === selectedTrip?.route);
    const seatFare = getActiveSeatFare(seatId, selectedTrip?.date);
    if (seatFare) {
      setFareAmount(seatFare.price);
      setFareAgentAmount(seatFare.agentPrice ?? null);
    } else if (fromStopId && toStopId) {
      lookupFare(tripRouteObj, fromStopId, toStopId);
    } else {
      setFareAmount(null);
      setFareAgentAmount(null);
    }
  };

  // Internal state – only used by this page
  const [segmentConflictSeat, setSegmentConflictSeat] = useState<string | null>(null);
  const [takenSeatNotice, setTakenSeatNotice] = useState<string | null>(null);
  // Show route details expanded by default so customers can read the route info before selecting seats
  const [showRouteDetails, setShowRouteDetails] = useState(true);
  const [showPriceDetail, setShowPriceDetail] = useState(false);
  // Confirmation view: read-only review before proceeding to payment
  const [showBookingConfirmation, setShowBookingConfirmation] = useState(false);
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

  /** Returns true if tripDate (YYYY-MM-DD) falls within the optional [fromDate, toDate] range. Empty bounds are open-ended. */
  const isTripDateWithinRange = (tripDate: string, fromDate: string | undefined, toDate: string | undefined): boolean => {
    if (!fromDate && !toDate) return true;
    if (!tripDate) return false;
    if (fromDate && tripDate < fromDate) return false;
    if (toDate && tripDate > toDate) return false;
    return true;
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

  // Price breakdown variables used in the price detail modal
  const priceBaseFare = fareAmount !== null ? fareAmount : (selectedTrip.price || 0);
  const isAgentRole = currentUser?.role === UserRole.AGENT;
  const priceAgentFare = isAgentRole
    ? (fareAgentAmount !== null ? fareAgentAmount : (selectedTrip.agentPrice || null))
    : null;
  const priceEffectiveBase = priceAgentFare !== null ? priceAgentFare : priceBaseFare;
  const priceDiscountPct = selectedTrip.discountPercent || 0;
  const priceDiscounted = priceDiscountPct > 0
    ? Math.round(priceEffectiveBase * (1 - priceDiscountPct / 100))
    : priceEffectiveBase;
  const pricePickupSurchargeTotal = (pickupSurcharge || 0) + (pickupAddressSurcharge || 0);
  const priceDropoffSurchargeTotal = (dropoffSurcharge || 0) + (dropoffAddressSurcharge || 0);
  const priceRouteSurchargeTotal = applicableRouteSurcharges.reduce((sum, sc) => sum + sc.amount, 0);
  const priceTotalPerPerson = priceDiscounted + pricePickupSurchargeTotal + priceDropoffSurchargeTotal + priceRouteSurchargeTotal;
  const priceChildrenOver5 = childrenAges.filter(age => (age ?? 0) >= 5).length;
  const priceFreeChildren = children - priceChildrenOver5;
  const priceBillablePassengers = adults + priceChildrenOver5;
  const priceGrandTotal = priceTotalPerPerson * priceBillablePassengers;
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
  const isPickupCategoryDisableActive = disabledPickupCategories.length > 0 && isTripDateWithinRange(tripDate, tripRoute?.disabledPickupCategoriesFromDate, tripRoute?.disabledPickupCategoriesToDate);
  const pickupStops = isPickupCategoryDisableActive
    ? pickupStopsAfterType.filter(s => !disabledPickupCategories.includes(s.category ?? ''))
    : pickupStopsAfterType;

  const baseDropoffStops = arrivalTerminal
    ? stops.filter(s => s.terminalId === arrivalTerminal.id)
    : stops.filter(s => s.type !== 'TERMINAL');
  const dropoffStopsAfterType = isDropoffDisabledByDate && dropoffDisableStopType !== 'ALL'
    ? baseDropoffStops.filter(s => (s.type ?? 'STOP') !== dropoffDisableStopType)
    : baseDropoffStops;
  const disabledDropoffCategories = tripRoute?.disabledDropoffCategories ?? [];
  const isDropoffCategoryDisableActive = disabledDropoffCategories.length > 0 && isTripDateWithinRange(tripDate, tripRoute?.disabledDropoffCategoriesFromDate, tripRoute?.disabledDropoffCategoriesToDate);
  const dropoffStops = isDropoffCategoryDisableActive
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
    // LOCKED seats always stay locked regardless of segment selection
    if (rawStatus === SeatStatus.LOCKED) return SeatStatus.LOCKED;
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
    const isLocked = rawStatus === SeatStatus.LOCKED;

    return (
      <motion.button
        key={seatId}
        whileHover={{ scale: isLocked ? 1 : 1.05 }}
        whileTap={{ scale: isLocked ? 1 : 0.95 }}
        onClick={() => {
          // Locked seats cannot be selected
          if (isLocked) return;
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
                  setShowBookingConfirmation(false);
                  applyFareForSeat(seatId);
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
              setShowBookingConfirmation(false);
            } else if (isSelectingExtraSeats && extraSeatIds.length < extraSeatsNeeded) {
              setSeatSelectionHistory(prev => [...prev, { primarySeat: showBookingForm, extraSeats: extraSeatIds }]);
              setExtraSeatIds(prev => [...prev, seatId]);
            } else if (!isSelectingExtraSeats) {
              setSeatSelectionHistory(prev => [...prev, { primarySeat: showBookingForm, extraSeats: extraSeatIds }]);
              setExtraSeatIds([]);
              setShowBookingForm(seatId);
              setShowBookingConfirmation(false);
              applyFareForSeat(seatId);
            }
          } else {
            setSeatSelectionHistory(prev => [...prev, { primarySeat: null, extraSeats: [] }]);
            setShowBookingForm(seatId);
            setShowBookingConfirmation(false);
            applyFareForSeat(seatId);
            // Pre-fill name & phone for logged-in customers
            if (currentUser?.role === UserRole.CUSTOMER) {
              if (currentUser.name) setCustomerNameInput(currentUser.name);
              if (currentUser.phone) setPhoneInput(currentUser.phone);
            }
          }
        }}
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold border-2 transition-all flex-shrink-0 relative overflow-hidden",
          // Locked seat (disabled by admin)
          isLocked && "bg-gray-200 border-gray-400 text-gray-400 cursor-not-allowed",
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
          isLocked
            ? (language === 'vi' ? 'Ghế đang bị khóa' : language === 'ja' ? '座席がロックされています' : 'Seat is locked')
            : isPartiallyBooked
              ? (language === 'vi' ? 'Ghế đã đặt một phần chặng — chọn ghế này để chọn chặng khác' : 'Partially booked — click to book a different segment')
              : isSegmentFree
                ? (language === 'vi' ? 'Trống cho chặng này' : 'Free for this segment')
                : undefined
        }
      >
        {seatId}
        {isLocked && <Lock size={8} className="absolute top-0.5 right-0.5 text-gray-500" />}
        {rawStatus === SeatStatus.PAID && !isSegmentFree && !isPartiallyBooked && <CheckCircle2 size={10} className="absolute top-0.5 right-0.5" />}
        {isExtraSeat && <span className="absolute top-0 right-0.5 text-[7px] font-bold text-blue-600">+</span>}
        {isSegmentFree && <span className="absolute top-0 right-0 text-[7px] font-bold text-emerald-600">✓</span>}
        {isPartiallyBooked && <span className="absolute top-0 right-0 text-[7px] font-bold leading-none" style={{ color: rawStatus === SeatStatus.PAID ? '#E31B23' : '#FBBF24' }}>½</span>}
        {hasConflictWarning && <span className="absolute bottom-0 left-0 right-0 text-[7px] font-bold text-orange-600 text-center leading-tight bg-orange-50">!</span>}
      </motion.button>
    );
  };

  const shouldShowMobileBackdrop =
    showPreBookingInfo ||
    showBookingConfirmation ||
    (!!showBookingForm && !showBookingConfirmation && !(isSelectingExtraSeats && !canConfirmBooking));

  return (
  <>
  {/* Mobile backdrop dim when a bottom-sheet form is visible */}
  {shouldShowMobileBackdrop && (
    <div className="fixed inset-0 bg-black/20 z-[140] lg:hidden" />
  )}
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
    <div className="lg:col-span-2 bg-white p-4 sm:p-8 rounded-[40px] shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (showBookingConfirmation) {
                // Confirmation view is shown – go back to info entry (compact panel)
                setShowBookingConfirmation(false);
              } else if (showBookingForm) {
                // If booking form is open, close it (go back to seat selection)
                setShowBookingForm(null);
                setExtraSeatIds([]);
                setAddonQuantities({});
              } else if (showPreBookingInfo) {
                // Pre-booking info form is shown after seat selection – go back to seat map
                setShowPreBookingInfo(false);
              } else {
                // At seat map – go back to trip search
                setActiveTab(previousTab);
              }
            }}
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
          // Round-trip: 6-step flow — seat selection first, then info entry for each leg
          if (language === 'vi') {
            steps = ['Ghế đi', 'TT đi', 'Ghế về', 'TT về', 'Xác nhận', 'Thanh toán'];
            hints = [
              '👆 Chọn ghế phù hợp cho chiều đi (đọc thông tin tuyến đường bên dưới)',
              '📋 Khai báo thông tin hành khách và điểm đón/trả cho chiều đi',
              '👆 Chọn ghế phù hợp cho chiều về',
              '📋 Khai báo thông tin hành khách và điểm đón/trả cho chiều về',
              '✅ Xem lại toàn bộ thông tin trước khi thanh toán',
              '💳 Quét mã QR hoặc chọn phương thức thanh toán để hoàn tất cả hai chiều',
            ];
          } else if (language === 'ja') {
            steps = ['出発席', '出発情報', '帰路席', '帰路情報', '確認', 'お支払い'];
            hints = [
              '👆 出発便の空席（白色）をタップして座席を選んでください',
              '📋 出発便の乗客情報と乗降場所を入力してください',
              '👆 帰路便の空席をタップして座席を選んでください',
              '📋 帰路便の乗客情報と乗降場所を入力してください',
              '✅ お支払い前に全ての情報をご確認ください',
              '💳 QRコードをスキャンするか、支払い方法を選択して往復予約を確定してください',
            ];
          } else {
            steps = ['Out. Seat', 'Out. Info', 'Ret. Seat', 'Ret. Info', 'Confirm', 'Payment'];
            hints = [
              '👆 Tap an empty seat (white) for the outbound trip (review route info below)',
              '📋 Enter passenger info and pickup/dropoff for the outbound trip',
              '👆 Tap an empty seat for the return trip',
              '📋 Enter passenger info and pickup/dropoff for the return trip',
              '✅ Review all details before proceeding to payment',
              '💳 Scan the QR code or choose a payment method to complete both trips',
            ];
          }
          // Steps 1–2: outbound (seat then info); Steps 3–4: return (seat then info); Step 5: confirm; Step 6: payment
          if (roundTripPhase === 'outbound') {
            currentStep = showBookingForm ? 2 : 1;
          } else {
            currentStep = showBookingConfirmation ? 5 : showBookingForm ? 4 : 3;
          }
        } else {
          // ONE_WAY: seat selection first, then info entry, then confirmation
          if (language === 'vi') {
            steps = ['Chọn ghế', 'Nhập thông tin', 'Xác nhận', 'Thanh toán'];
            hints = [
              '👆 Chọn ghế trống (màu trắng) — đọc thông tin tuyến đường bên dưới trước khi chọn',
              '📋 Khai báo thông tin hành khách, chọn điểm đón/trả và dịch vụ thêm',
              '✅ Xem lại toàn bộ thông tin trước khi thanh toán',
              '💳 Quét mã QR hoặc chọn phương thức thanh toán để hoàn tất',
            ];
          } else if (language === 'ja') {
            steps = ['座席を選ぶ', '情報を入力', '確認', 'お支払い'];
            hints = [
              '👆 空席（白色）をタップして座席を選んでください — 下のルート情報を確認してから選んでください',
              '📋 乗客情報と乗降場所を入力してください',
              '✅ お支払い前に全ての情報をご確認ください',
              '💳 QRコードをスキャンするか、支払い方法を選択して完了してください',
            ];
          } else {
            steps = ['Select Seat', 'Enter Info', 'Confirm', 'Payment'];
            hints = [
              '👆 Tap an empty seat (white) to choose your seat — review route details below first',
              '📋 Enter passenger details, pickup/dropoff and any add-on services',
              '✅ Review all details before proceeding to payment',
              '💳 Scan the QR code or choose a payment method to complete',
            ];
          }
          currentStep = showBookingConfirmation ? 3 : showBookingForm ? 2 : 1;
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
                ? `Tổng: ${selectedTrip.seats.length} chỗ • Đã đặt: ${selectedTrip.seats.filter((s: any) => s.status !== SeatStatus.EMPTY && s.status !== SeatStatus.LOCKED).length} chỗ`
                : `Total: ${selectedTrip.seats.length} • Booked: ${selectedTrip.seats.filter((s: any) => s.status !== SeatStatus.EMPTY && s.status !== SeatStatus.LOCKED).length}`}
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
                setShowBookingConfirmation(false);
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
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-gray-200 border border-gray-400 rounded flex-shrink-0" /> {language === 'vi' ? 'Đã khóa' : language === 'ja' ? 'ロック済み' : 'Locked'}</div>
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
      {tripRoute && (tripRoute.departurePoint || tripRoute.arrivalPoint || tripRoute.details || tripRoute.note || (tripRoute.routeStops && tripRoute.routeStops.length > 0)) && (
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
              {/* Segment-by-segment stops (if route has intermediate stops) */}
              {tripRoute.routeStops && tripRoute.routeStops.length > 0 && (() => {
                const sortedStops = [...tripRoute.routeStops].sort((a, b) => a.order - b.order);
                return (
                  <div className="pt-3">
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-2">
                      {language === 'vi' ? 'Hành trình từng chặng' : language === 'ja' ? '各区間のルート' : 'Route Segments'}
                    </p>
                    <div className="space-y-1">
                      {sortedStops.map((stop, idx) => {
                        const isFirst = idx === 0;
                        const isLast = idx === sortedStops.length - 1;
                        const depTime = selectedTrip.time;
                        let stopTime: string | null = null;
                        if (depTime && stop.offsetMinutes) {
                          const [hStr, mStr] = depTime.split(':');
                          const h = parseInt(hStr, 10);
                          const m = parseInt(mStr, 10);
                          if (!isNaN(h) && !isNaN(m)) {
                            const total = h * 60 + m + stop.offsetMinutes;
                            stopTime = `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
                          }
                        }
                        return (
                          <div key={stop.stopId} className="flex items-start gap-2">
                            <div className="flex flex-col items-center flex-shrink-0 pt-1">
                              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isFirst ? 'bg-daiichi-red' : isLast ? 'bg-blue-500' : 'bg-gray-400'}`} />
                              {idx < sortedStops.length - 1 && <div className="w-px h-3 bg-gray-300 my-0.5" />}
                            </div>
                            <div className="flex-1 min-w-0 pb-1">
                              <div className="flex items-baseline gap-2">
                                {stopTime && <span className={`text-xs font-bold flex-shrink-0 ${isFirst ? 'text-daiichi-red' : isLast ? 'text-blue-500' : 'text-gray-500'}`}>{stopTime}</span>}
                                <span className={`text-xs font-semibold truncate ${isFirst || isLast ? 'text-gray-800' : 'text-gray-600'}`}>{stop.stopName}</span>
                              </div>
                              {stop.description && <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{stop.description}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              {(tripRoute.departurePoint || tripRoute.arrivalPoint) && !(tripRoute.routeStops && tripRoute.routeStops.length > 0) && (
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
              {language === 'vi' ? 'Nhập thông tin hành khách, chọn điểm đón/trả.' : language === 'ja' ? '乗客情報と乗降場所を入力してください。' : 'Enter passenger info and pickup/dropoff.'}
            </span>
            <span className="hidden sm:inline">
              {language === 'vi'
                ? 'Nhập thông tin hành khách, điểm đón/trả chi tiết và dịch vụ bổ sung.'
                : language === 'ja'
                  ? '乗客情報、乗降場所、および追加サービスを入力してください。'
                  : 'Enter passenger details, pickup/dropoff locations and any add-on services.'}
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

            {/* Fare info: price per person + total – shown right above the action button */}
            {fareLoading && (
              <p className="text-xs text-blue-500 animate-pulse">{t.fare_loading || 'Looking up fare...'}</p>
            )}
            {!fareLoading && fareAmount !== null && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs text-emerald-600 font-bold">
                    {t.fare_based_price || 'Fare table price'}: {fareAmount.toLocaleString()}đ/{t.per_person || 'person'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowPriceDetail(true)}
                    className="text-[10px] text-blue-600 font-bold px-2 py-0.5 rounded-full bg-blue-50 hover:bg-blue-100 transition-colors flex items-center gap-1"
                  >
                    <Info size={10} />
                    {t.view_details || 'Chi tiết'}
                  </button>
                </div>
                {fareAgentAmount !== null && currentUser?.role === UserRole.AGENT && fareAgentAmount !== fareAmount && (
                  <p className="text-xs text-orange-600 font-bold">
                    {language === 'vi' ? 'Giá đại lý' : language === 'ja' ? '代理店価格' : 'Agent price'}: {fareAgentAmount.toLocaleString()}đ/{t.per_person || 'person'}
                  </p>
                )}
                <div className="flex items-center justify-between px-3 py-2 bg-daiichi-red/5 rounded-xl border border-daiichi-red/20">
                  <span className="text-xs font-bold text-gray-700">
                    {t.total_payment || 'Tổng thanh toán'}
                    {' '}({priceBillablePassengers} {language === 'vi' ? 'khách' : language === 'ja' ? '名' : 'pax'})
                  </span>
                  <span className="text-sm font-bold text-daiichi-red">{priceGrandTotal.toLocaleString()}đ</span>
                </div>
              </div>
            )}

            {/* Continue to Confirmation button (or back to seat map if no seat selected yet) */}
            <button
              type="button"
              onClick={() => {
                setShowPreBookingInfo(false);
                if (showBookingForm) {
                  setShowBookingConfirmation(true);
                }
              }}
              disabled={hasFareBlocker || !childAgesComplete}
              className={cn(
                "w-full py-3 sm:py-4 text-white rounded-xl font-bold shadow-lg transition-all",
                (hasFareBlocker || !childAgesComplete)
                  ? "bg-gray-300 shadow-gray-200 cursor-not-allowed"
                  : "bg-daiichi-red shadow-daiichi-red/20"
              )}
            >
              {showBookingForm
                ? (language === 'vi' ? '✅ Tiếp theo: Xác nhận →' : language === 'ja' ? '✅ 次へ：確認する →' : '✅ Next: Confirm →')
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
          {showBookingForm && !showBookingConfirmation && (
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
                <button onClick={() => { setShowBookingForm(null); setExtraSeatIds([]); setAddonQuantities({}); setShowBookingConfirmation(false); }} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>
              <form className="space-y-2.5 sm:space-y-4">
                {/* ── Passenger info (name, phone, count) – entered after seat selection ── */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">{t.adults}</label>
                    <div className="flex items-center gap-2 mt-1 px-2 py-1.5 bg-gray-50 border border-gray-100 rounded-xl">
                      <button type="button" onClick={() => {
                        const newAdults = Math.max(1, adults - 1);
                        setAdults(newAdults);
                        const currentOver5Count = childrenAges.filter(age => age >= 5).length;
                        const newExtraSeatsNeeded = (newAdults - 1) + currentOver5Count;
                        setExtraSeatIds(prev => prev.slice(0, newExtraSeatsNeeded));
                      }} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 font-bold text-lg leading-none flex-shrink-0">−</button>
                      <span className="flex-1 text-center font-bold text-gray-800">{adults}</span>
                      <button type="button" onClick={() => setAdults(adults + 1)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-daiichi-red text-white font-bold text-lg leading-none flex-shrink-0">+</button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">{t.children}</label>
                    <div className="flex items-center gap-2 mt-1 px-2 py-1.5 bg-gray-50 border border-gray-100 rounded-xl">
                      <button type="button" onClick={() => {
                        const count = Math.max(0, children - 1);
                        setChildren(count);
                        setChildrenAges(prev => prev.slice(0, count));
                        const newAges = childrenAges.slice(0, count);
                        const newOver5Count = newAges.filter(age => age >= 5).length;
                        setExtraSeatIds(prev => prev.slice(0, newOver5Count));
                      }} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 font-bold text-lg leading-none flex-shrink-0">−</button>
                      <span className="flex-1 text-center font-bold text-gray-800">{children}</span>
                      <button type="button" onClick={() => {
                        const count = children + 1;
                        setChildren(count);
                        setChildrenAges(prev => {
                          const arr = [...prev];
                          while (arr.length < count) arr.push(undefined);
                          return arr.slice(0, count);
                        });
                      }} className="w-7 h-7 flex items-center justify-center rounded-lg bg-daiichi-red text-white font-bold text-lg leading-none flex-shrink-0">+</button>
                    </div>
                  </div>
                </div>
                {children > 0 && (
                  <div className="p-2 bg-blue-50 rounded-xl border border-blue-100 space-y-1.5">
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
                              const newOver5Count = ages.filter(age => (age ?? 0) >= 5).length;
                              setExtraSeatIds(prev => prev.slice(0, newOver5Count));
                            }}
                            className="w-full px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 text-center"
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
                <div className="relative">
                  <label className="absolute left-3 top-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider pointer-events-none z-10">{t.customer_name}</label>
                  <input type="text" value={customerNameInput} onChange={(e) => setCustomerNameInput(e.target.value)} className="w-full px-3 pt-5 pb-1 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20 text-sm" placeholder={t.enter_name} />
                </div>
                <div className="relative">
                  <label className="absolute left-3 top-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider pointer-events-none z-10">{t.phone_number}</label>
                  <input type="tel" value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} className="w-full px-3 pt-5 pb-1 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20 text-sm" placeholder={t.enter_phone} />
                </div>
                {/* Pickup address (sub-stop selection) */}
                {pickupStopNames.length > 0 && !pickupSectionDisabled && (
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">{t.pickup_address || 'Điểm đón'}</label>
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
                      className="mt-1"
                      inputClassName="!px-3 !py-1.5 !text-xs !rounded-lg"
                    />
                  </div>
                )}
                {/* Dropoff address (sub-stop selection) */}
                {dropoffStopNames.length > 0 && !dropoffSectionDisabled && (
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">{t.dropoff_address || 'Điểm trả'}</label>
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
                      className="mt-1"
                      inputClassName="!px-3 !py-1.5 !text-xs !rounded-lg"
                    />
                  </div>
                )}
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
                    // Default fare (for seats without a specific override)
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

                    // Build the list of all selected seat IDs (primary + extra)
                    const primarySeat = showBookingForm && showBookingForm !== 'FREE' ? showBookingForm : null;
                    const extraSeatsForDisplay = extraSeatIds.slice(0, Math.max(0, effectiveAdults - 1));
                    const allSelectedSeatIds = primarySeat ? [primarySeat, ...extraSeatsForDisplay] : [];

                    // Compute effective fare for each selected seat
                    const getSeatDisplayFare = (sid: string): number => {
                      // The primary seat's fare is already in basePriceAdult (via fareAmount)
                      if (sid === primarySeat || !routeSeatFares || routeSeatFares.length === 0) return basePriceAdult;
                      const candidates = routeSeatFares.filter(f => f.seatId === sid);
                      if (candidates.length === 0) {
                        // No specific fare override for this seat.
                        // If the primary seat has an override that set fareAmount, basePriceAdult reflects
                        // that override price. Extra seats without their own override should use the
                        // segment/route base fare instead, not the primary seat's discounted fare.
                        if (segmentBaseFare !== null) {
                          const segBase = isAgentBookingForm && segmentBaseAgentFare !== null
                            ? segmentBaseAgentFare
                            : segmentBaseFare;
                          return Math.round(segBase * tripDiscountMul);
                        }
                        // No segment fare available – check if primary seat itself has an override
                        if (primarySeat && routeSeatFares.some(f => f.seatId === primarySeat)) {
                          // Primary seat uses an override; fall back to trip default for this regular seat
                          if (isAgentBookingForm) {
                            return Math.round((selectedTrip.agentPrice || selectedTrip.price || 0) * tripDiscountMul);
                          }
                          return Math.round((selectedTrip.price || 0) * tripDiscountMul);
                        }
                        return basePriceAdult;
                      }
                      const dateStr = selectedTrip?.date;
                      let seatFare: RouteSeatFare | undefined;
                      if (dateStr) {
                        seatFare = candidates.find(f => {
                          const afterStart = !f.startDate || f.startDate <= dateStr;
                          const beforeEnd = !f.endDate || f.endDate >= dateStr;
                          return afterStart && beforeEnd;
                        });
                      }
                      if (!seatFare) seatFare = candidates.find(f => !f.startDate && !f.endDate);
                      if (!seatFare) return basePriceAdult;
                      const discounted = Math.round(seatFare.price * tripDiscountMul);
                      if (isAgentBookingForm) {
                        if (fareAgentAmount !== null && seatFare.agentPrice !== undefined) {
                          return Math.round(seatFare.agentPrice * tripDiscountMul);
                        }
                      }
                      return discounted;
                    };

                    // Sum per-seat fares instead of multiplying one fare by passenger count
                    const perSeatFares = allSelectedSeatIds.length > 0
                      ? allSelectedSeatIds.map(sid => getSeatDisplayFare(sid))
                      : Array(effectiveAdults).fill(basePriceAdult);
                    const baseTotal = perSeatFares.reduce((s, f) => s + f, 0);

                    // Check if all seat fares are the same (for compact display)
                    const allFaresSame = perSeatFares.every(f => f === perSeatFares[0]);

                    const routeSurchargeTotal = applicableRouteSurcharges.reduce((sum, sc) => sum + sc.amount * effectiveAdults, 0);
                    const pickupDropoffSurchargeDisplay = (pickupSurcharge + dropoffSurcharge + pickupAddressSurcharge + dropoffAddressSurcharge) * effectiveAdults;
                    const allSurcharges = pickupDropoffSurchargeDisplay + surchargeAmount + routeSurchargeTotal;
                    const selectedAddonsInForm = (selectedTrip.addons || [] as TripAddon[]).filter((a: TripAddon) => (addonQuantities[a.id] || 0) > 0);
                    const addonsTotalInForm = selectedAddonsInForm.reduce((sum, a) => sum + a.price * (addonQuantities[a.id] || 1), 0);
                    const finalTotal = Math.round(baseTotal + allSurcharges + addonsTotalInForm);
                    const perSeatSuffix = allFaresSame && effectiveAdults > 1 ? ` ×${effectiveAdults}` : '';
                    const fareLabel = effectiveFareAmount !== null
                      ? (t.fare_based_price || 'Fare table price')
                      : (language === 'vi' ? 'Vé cơ bản' : language === 'ja' ? '基本運賃' : 'Base fare');
                    const agentBadge = (isAgentBookingForm && (selectedTrip.agentPrice || 0) > 0 && effectiveFareAmount === null) ||
                      (isAgentBookingForm && effectiveFareAmount !== null && fareAgentAmount !== null);
                    return (
                      <>
                        {/* If all seat fares are the same, show compact ×N display */}
                        {allFaresSame ? (
                          <div className="flex justify-between items-center text-xs text-gray-500">
                            <span>
                              {fareLabel}{perSeatSuffix}
                              {agentBadge && (
                                <span className="ml-1 text-orange-500 font-bold">({language === 'vi' ? 'Giá ĐL' : 'Agent'})</span>
                              )}
                            </span>
                            <span>{baseTotal.toLocaleString()}đ</span>
                          </div>
                        ) : (
                          /* Different fares per seat: show each seat individually */
                          allSelectedSeatIds.map((sid, idx) => (
                            <div key={sid} className="flex justify-between items-center text-xs text-gray-500">
                              <span>
                                {fareLabel} ({language === 'vi' ? 'Ghế' : language === 'ja' ? '座席' : 'Seat'} {sid})
                                {agentBadge && idx === 0 && (
                                  <span className="ml-1 text-orange-500 font-bold">({language === 'vi' ? 'Giá ĐL' : 'Agent'})</span>
                                )}
                              </span>
                              <span>{perSeatFares[idx].toLocaleString()}đ</span>
                            </div>
                          ))
                        )}
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

                <button type="button" onClick={() => setShowBookingConfirmation(true)} disabled={!canConfirmBooking} className={cn("w-full py-4 text-white rounded-xl font-bold shadow-lg", canConfirmBooking ? "bg-daiichi-red shadow-daiichi-red/20" : "bg-gray-300 shadow-gray-200 cursor-not-allowed")}>
                  {language === 'vi' ? '✅ Tiếp theo: Xác nhận →' : language === 'ja' ? '✅ 次へ：確認する →' : '✅ Next: Confirm →'}
                </button>
              </form>
            </motion.div>
          )}

          {/* ── BOOKING CONFIRMATION VIEW (read-only review before payment) ── */}
          {showBookingConfirmation && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-3 sm:p-5 lg:p-6 fixed bottom-0 left-0 right-0 z-[160] rounded-t-3xl max-h-[90vh] overflow-y-auto lg:static lg:rounded-2xl lg:max-h-none lg:overflow-visible lg:shadow-sm border-2 border-emerald-500"
            >
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-2 lg:hidden" />
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base sm:text-lg font-bold text-emerald-700">
                  {language === 'vi' ? '✅ Xác nhận thông tin đặt vé' : language === 'ja' ? '✅ 予約内容の確認' : '✅ Booking Confirmation'}
                </h3>
                <button onClick={() => setShowBookingConfirmation(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>
              <p className="text-xs text-gray-400 mb-3">
                {language === 'vi' ? 'Kiểm tra lại toàn bộ thông tin. Nếu đúng, nhấn xác nhận để thanh toán.' : language === 'ja' ? '全ての情報をご確認ください。正しければ確認ボタンを押してお支払いへ進んでください。' : 'Review all details. If everything is correct, confirm to proceed to payment.'}
              </p>
              <div className="space-y-2 text-sm">
                {/* Trip info */}
                <div className="p-3 bg-gray-50 rounded-xl space-y-1">
                  <p className="font-bold text-gray-700 text-xs uppercase">{language === 'vi' ? '🚌 Chuyến xe' : language === 'ja' ? '🚌 乗車便' : '🚌 Trip'}</p>
                  <p className="text-gray-800">{selectedTrip.route}</p>
                  <p className="text-gray-500 text-xs">{selectedTrip.date} {selectedTrip.departureTime && `· ${selectedTrip.departureTime}`} {selectedTrip.licensePlate && `· ${selectedTrip.licensePlate}`}</p>
                </div>
                {/* Seats */}
                {!isFreeSeatingTrip && showBookingForm && (
                  <div className="p-3 bg-gray-50 rounded-xl space-y-1">
                    <p className="font-bold text-gray-700 text-xs uppercase">{language === 'vi' ? '🪑 Ghế đã chọn' : language === 'ja' ? '🪑 選択座席' : '🪑 Selected Seats'}</p>
                    <div className="flex gap-2 flex-wrap">
                      <span className="bg-daiichi-red/10 text-daiichi-red px-2 py-1 rounded-lg font-bold text-xs">{showBookingForm}</span>
                      {extraSeatIds.map(id => (
                        <span key={id} className="bg-blue-100 text-blue-700 px-2 py-1 rounded-lg font-bold text-xs">{id}</span>
                      ))}
                    </div>
                  </div>
                )}
                {/* Passenger info */}
                <div className="p-3 bg-gray-50 rounded-xl space-y-1">
                  <p className="font-bold text-gray-700 text-xs uppercase">{language === 'vi' ? '👥 Hành khách' : language === 'ja' ? '👥 乗客' : '👥 Passengers'}</p>
                  <p className="text-gray-800">{adults} {t.adults}{children > 0 ? ` + ${children} ${t.children}` : ''}</p>
                  {customerNameInput && <p className="text-gray-700 font-medium">{customerNameInput}{phoneInput ? ` · ${phoneInput}` : ''}</p>}
                </div>
                {/* Pickup / Dropoff */}
                {(pickupPoint || dropoffPoint) && (
                  <div className="p-3 bg-gray-50 rounded-xl space-y-1">
                    <p className="font-bold text-gray-700 text-xs uppercase">{language === 'vi' ? '📍 Điểm đón / trả' : language === 'ja' ? '📍 乗降場所' : '📍 Pickup / Dropoff'}</p>
                    {pickupPoint && <p className="text-gray-700">🔴 {pickupPoint}{pickupAddress ? ` → ${pickupAddress}` : ''}{pickupAddressDetail ? ` (${pickupAddressDetail})` : ''}</p>}
                    {dropoffPoint && <p className="text-gray-700">🟢 {dropoffPoint}{dropoffAddress ? ` → ${dropoffAddress}` : ''}{dropoffAddressDetail ? ` (${dropoffAddressDetail})` : ''}</p>}
                  </div>
                )}
                {/* Addons */}
                {(selectedTrip.addons || []).some((a: any) => (addonQuantities[a.id] || 0) > 0) && (
                  <div className="p-3 bg-emerald-50 rounded-xl space-y-1">
                    <p className="font-bold text-emerald-700 text-xs uppercase">{language === 'vi' ? '🎁 Dịch vụ bổ sung' : language === 'ja' ? '🎁 オプションサービス' : '🎁 Add-on Services'}</p>
                    {(selectedTrip.addons || []).filter((a: any) => (addonQuantities[a.id] || 0) > 0).map((a: any) => (
                      <p key={a.id} className="text-emerald-700 text-xs">{a.name} × {addonQuantities[a.id]} = +{(a.price * addonQuantities[a.id]).toLocaleString()}đ</p>
                    ))}
                  </div>
                )}
                {/* Total */}
                {(() => {
                  const isAgentConfirm = currentUser?.role === UserRole.AGENT;
                  const tripDiscountMul = 1 - ((selectedTrip.discountPercent || 0) / 100);
                  const effectiveFareConfirm = fareAmount !== null
                    ? (isAgentConfirm && fareAgentAmount !== null ? fareAgentAmount : fareAmount)
                    : null;
                  const basePriceConfirm = effectiveFareConfirm !== null
                    ? effectiveFareConfirm
                    : (isAgentConfirm
                        ? Math.round(((selectedTrip.agentPrice || selectedTrip.price || 0)) * tripDiscountMul)
                        : Math.round((selectedTrip.price || 0) * tripDiscountMul));
                  const childrenOver5Confirm = childrenAges.filter(age => (age ?? 0) >= 5).length;
                  const effectiveAdultsConfirm = adults + childrenOver5Confirm;
                  const routeSurchargeConfirm = applicableRouteSurcharges.reduce((sum, sc) => sum + sc.amount * effectiveAdultsConfirm, 0);
                  const pickupDropoffSurchargeConfirm = (pickupSurcharge + dropoffSurcharge + pickupAddressSurcharge + dropoffAddressSurcharge) * effectiveAdultsConfirm;
                  const addonsTotalConfirm = (selectedTrip.addons || []).filter((a: any) => (addonQuantities[a.id] || 0) > 0).reduce((sum: number, a: any) => sum + a.price * (addonQuantities[a.id] || 1), 0);
                  const finalTotalConfirm = Math.round(basePriceConfirm * effectiveAdultsConfirm + pickupDropoffSurchargeConfirm + surchargeAmount + routeSurchargeConfirm + addonsTotalConfirm);
                  return (
                    <div className="p-3 bg-daiichi-red/5 rounded-xl border border-daiichi-red/20 flex items-center justify-between">
                      <span className="font-bold text-gray-800 text-sm">{t.total_payment || 'Tổng thanh toán'}</span>
                      <span className="text-xl font-bold text-daiichi-red">{finalTotalConfirm.toLocaleString()}đ</span>
                    </div>
                  );
                })()}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowBookingConfirmation(false)}
                  className="flex-1 py-3 rounded-xl font-bold border-2 border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
                >
                  {language === 'vi' ? '✏️ Sửa thông tin' : language === 'ja' ? '✏️ 編集する' : '✏️ Edit'}
                </button>
                <button
                  type="button"
                  onClick={() => { if (showBookingForm) handleConfirmBooking(showBookingForm); }}
                  disabled={!showBookingForm}
                  className={cn("flex-2 flex-grow py-3 text-white rounded-xl font-bold shadow-lg", showBookingForm ? "bg-daiichi-red shadow-daiichi-red/20" : "bg-gray-300 cursor-not-allowed")}
                >
                  {language === 'vi' ? '💳 Xác nhận & Thanh toán →' : language === 'ja' ? '💳 確認してお支払い →' : '💳 Confirm & Pay →'}
                </button>
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  </div>
  {/* Price Detail Modal */}
  {showPriceDetail && (
    <div
      className="fixed inset-0 z-[350] flex items-center justify-center bg-black/50 p-4"
      onClick={() => setShowPriceDetail(false)}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Info size={16} className="text-blue-500" />
            <h3 className="font-bold text-gray-800">{t.trip_confirm_price_title || 'Chi tiết giá vé'}</h3>
          </div>
          <button
            type="button"
            onClick={() => setShowPriceDetail(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-4 space-y-2.5">
          {/* Base fare */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">{t.trip_confirm_base_fare || 'Giá vé cơ bản'}</span>
            <div className="flex items-center gap-2">
              {priceDiscountPct > 0 && (
                <span className="text-[10px] text-gray-400 line-through">{priceEffectiveBase.toLocaleString()}đ</span>
              )}
              <span className="font-bold text-gray-800">{priceDiscounted.toLocaleString()}đ</span>
              {priceDiscountPct > 0 && (
                <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 rounded-full">
                  -{priceDiscountPct}%
                </span>
              )}
            </div>
          </div>
          {/* Pickup surcharge */}
          {pricePickupSurchargeTotal > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">
                {t.trip_confirm_pickup_surcharge || 'Phụ phí điểm đón'}
                {pickupPoint ? ` (${pickupPoint})` : ''}
              </span>
              <span className="font-semibold text-orange-600">+{pricePickupSurchargeTotal.toLocaleString()}đ</span>
            </div>
          )}
          {/* Dropoff surcharge */}
          {priceDropoffSurchargeTotal > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">
                {t.trip_confirm_dropoff_surcharge || 'Phụ phí điểm trả'}
                {dropoffPoint ? ` (${dropoffPoint})` : ''}
              </span>
              <span className="font-semibold text-orange-600">+{priceDropoffSurchargeTotal.toLocaleString()}đ</span>
            </div>
          )}
          {/* Route surcharges */}
          {applicableRouteSurcharges.map(sc => (
            <div key={sc.id} className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{t.trip_confirm_surcharges || 'Phụ phí tuyến'}: {sc.name}</span>
              <span className="font-semibold text-orange-600">+{sc.amount.toLocaleString()}đ</span>
            </div>
          ))}
          {/* Total per person */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="text-sm font-bold text-gray-800">
              {t.trip_confirm_total || 'Tổng dự kiến / người'}
            </span>
            <span className="font-bold text-daiichi-red">{priceTotalPerPerson.toLocaleString()}đ</span>
          </div>
          {/* Passenger breakdown */}
          <div className="p-3 bg-gray-50 rounded-xl space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">
                {adults} {t.adults} × {priceTotalPerPerson.toLocaleString()}đ
              </span>
              <span className="font-semibold text-gray-800">{(adults * priceTotalPerPerson).toLocaleString()}đ</span>
            </div>
            {priceChildrenOver5 > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600">
                  {priceChildrenOver5}{' '}
                  {language === 'vi' ? 'trẻ em (≥5 tuổi)' : language === 'ja' ? '子ども（5歳以上）' : 'child(ren) (≥5 yrs)'}
                  {' '}× {priceTotalPerPerson.toLocaleString()}đ
                </span>
                <span className="font-semibold text-gray-800">{(priceChildrenOver5 * priceTotalPerPerson).toLocaleString()}đ</span>
              </div>
            )}
            {priceFreeChildren > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500">
                  {priceFreeChildren}{' '}
                  {language === 'vi' ? 'trẻ em (<5 tuổi, miễn phí)' : language === 'ja' ? '子ども（5歳未満、無料）' : 'child(ren) (<5 yrs, free)'}
                </span>
                <span className="text-gray-400">0đ</span>
              </div>
            )}
          </div>
          {/* Grand total — most important */}
          <div className="flex items-center justify-between px-4 py-3 bg-daiichi-red/5 rounded-xl border border-daiichi-red/20">
            <span className="font-bold text-gray-800">{t.total_payment || 'Tổng thanh toán'}</span>
            <span className="text-xl font-bold text-daiichi-red">{priceGrandTotal.toLocaleString()}đ</span>
          </div>
          {/* Warning if child ages incomplete */}
          {children > 0 && !childAgesComplete && (
            <p className="text-[10px] text-orange-500 text-center">
              {language === 'vi'
                ? '* Nhập tuổi trẻ em để tính tổng chính xác hơn'
                : language === 'ja'
                  ? '* 正確な合計のため子どもの年齢を入力してください'
                  : '* Enter child ages for a more accurate total'}
            </p>
          )}
        </div>
      </div>
    </div>
  )}
  </>
  );
}
