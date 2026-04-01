import { useState, useRef } from 'react';
import { DEFAULT_PAYMENT_METHOD, PaymentMethod } from '../constants/paymentMethods';
import { transportService } from '../services/transportService';
import { SeatStatus, TripAddon, UserRole, User, Route, Agent, RouteSeatFare } from '../types';
import { todayVN } from '../lib/vnDate';

const MY_TICKETS_KEY = 'daiichi_my_tickets';

/** Persist a booking to localStorage (for CUSTOMER / GUEST) */
function saveTicketToLocalStorage(booking: any) {
  try {
    const existing: any[] = JSON.parse(localStorage.getItem(MY_TICKETS_KEY) || '[]');
    // Avoid duplicates by ticketCode / id
    const alreadyExists = existing.some(b => b.id === booking.id || (booking.ticketCode && b.ticketCode === booking.ticketCode));
    if (!alreadyExists) {
      existing.unshift(booking);
      localStorage.setItem(MY_TICKETS_KEY, JSON.stringify(existing.slice(0, 100)));
    }
  } catch {
    // ignore storage errors
  }
}

/** Internal type holding a captured (unsaved) outbound leg for round-trip bookings */
interface CapturedOutboundLeg {
  bookingData: any;
  seatUpdateData: any;
  allSeatIds: string[];
  tripId: string;
  amount: number;
  // Optimistic seat update function (per-seat)
  applyOptimisticSeatUpdate: (seat: any) => any;
}

/** All state values and setters that handleConfirmBooking reads/writes from App.tsx */
export interface BookingContext {
  currentUser: User | null;
  language: 'vi' | 'en' | 'ja';
  /** The trip being booked (may have extra Firestore-populated fields) */
  selectedTrip: any;
  routes: Route[];
  /** All agents – used to look up per-route commission rates for agent bookings */
  agents: Agent[];
  adults: number;
  children: number;
  childrenAges: (number | undefined)[];
  addonQuantities: Record<string, number>;
  pickupSurcharge: number;
  dropoffSurcharge: number;
  pickupAddressSurcharge: number;
  dropoffAddressSurcharge: number;
  surchargeAmount: number;
  bookingDiscount: number;
  pickupPoint: string;
  dropoffPoint: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupAddressDetail: string;
  dropoffAddressDetail: string;
  pickupStopAddress: string;
  dropoffStopAddress: string;
  extraSeatIds: string[];
  customerNameInput: string;
  phoneInput: string;
  fromStopId: string;
  toStopId: string;
  bookingNote: string;
  fareAmount: number | null;
  fareAgentAmount: number | null;
  /** Per-seat fare overrides for the current route – used to price each seat individually */
  routeSeatFares: RouteSeatFare[];
  ws: WebSocket | null;
  /** Helper to compute active route-level surcharges for the trip's date */
  getApplicableRouteSurcharges: (route: Route | undefined, date: string) => any[];
  /** Round-trip phase support */
  tripType: 'ONE_WAY' | 'ROUND_TRIP';
  roundTripPhase: 'outbound' | 'return';
  /** Called by the hook when the outbound leg has been captured; App.tsx should advance the phase */
  onRoundTripOutboundCaptured: (outboundSummary: { route: string; time: string; date: string; customerName: string; phone: string }) => void;
  // Setters
  setLastBooking: (booking: any) => void;
  setIsTicketOpen: (open: boolean) => void;
  setShowBookingForm: (id: string | null) => void;
  setCustomerNameInput: (name: string) => void;
  setPhoneInput: (phone: string) => void;
  setAdults: (n: number) => void;
  setChildren: (n: number) => void;
  setChildrenAges: (ages: (number | undefined)[]) => void;
  setExtraSeatIds: (ids: string[]) => void;
  setPickupPoint: (p: string) => void;
  setDropoffPoint: (p: string) => void;
  setPickupAddress: (a: string) => void;
  setDropoffAddress: (a: string) => void;
  setPickupAddressDetail: (a: string) => void;
  setDropoffAddressDetail: (a: string) => void;
  setPickupStopAddress: (a: string) => void;
  setDropoffStopAddress: (a: string) => void;
  setPickupSurcharge: (n: number) => void;
  setDropoffSurcharge: (n: number) => void;
  setPickupAddressSurcharge: (n: number) => void;
  setDropoffAddressSurcharge: (n: number) => void;
  setSurchargeAmount: (n: number) => void;
  setBookingDiscount: (n: number) => void;
  setAddonQuantities: (q: Record<string, number>) => void;
  setBookingNote: (note: string) => void;
  setFareAmount: (n: number | null) => void;
  setFareAgentAmount: (n: number | null) => void;
  setFareError: (e: string) => void;
  setFareLoading: (loading: boolean) => void;
  setFromStopId: (id: string) => void;
  setToStopId: (id: string) => void;
  setSeatSelectionHistory: (hist: any[]) => void;
  setTrips: React.Dispatch<React.SetStateAction<any[]>>;
  setSelectedTrip: React.Dispatch<React.SetStateAction<any>>;
}

/** A single line item in the price breakdown shown in PaymentQRModal */
export interface PriceBreakdownItem {
  label: string;
  amount: number;
  /** When true, amount is 0 and displayed as "Miễn phí" */
  isFree?: boolean;
  /** Marks this as the grand-total row (bold, highlighted) */
  isTotal?: boolean;
  /** Marks this as a section header row (e.g. "Chuyến đi", "Chuyến về") */
  isSection?: boolean;
}

export interface PendingQrBooking {
  amount: number;
  ref: string;
  label: string;
  execute: () => Promise<void>;
  /** Called when the user cancels or the 3-min timer expires – releases the reserved seats */
  cancel: () => Promise<void>;
  /** Detailed price breakdown items to display in PaymentQRModal */
  priceBreakdown?: PriceBreakdownItem[];
}

/**
 * usePayment – encapsulates all payment-processing logic for trip bookings.
 *
 * Owns the payment-method selector state, the pending-QR-booking state and the
 * agent top-up modal flag.  The heavyweight `handleConfirmBooking` handler lives
 * here so that App.tsx no longer needs to contain those ~250 lines of logic.
 *
 * Usage:
 *   const { paymentMethodInput, setPaymentMethodInput, handleConfirmBooking, ... } = usePayment(ctx);
 *
 * `ctx` must be updated every render (just pass the latest values inline).
 */
export function usePayment(ctx: BookingContext) {
  const [paymentMethodInput, setPaymentMethodInput] = useState<PaymentMethod>(DEFAULT_PAYMENT_METHOD);
  const [pendingQrBooking, setPendingQrBooking] = useState<PendingQrBooking | null>(null);
  const [agentTopUpModal, setAgentTopUpModal] = useState(false);
  // Holds captured outbound leg data during round-trip two-phase booking
  const [capturedOutboundLeg, setCapturedOutboundLeg] = useState<CapturedOutboundLeg | null>(null);

  // Keep a mutable ref to the latest context so the async handler always reads
  // up-to-date values without needing to be recreated every render.
  const ctxRef = useRef<BookingContext>(ctx);
  ctxRef.current = ctx;

  // Ref for captured outbound leg to access inside async closures
  const capturedOutboundRef = useRef<CapturedOutboundLeg | null>(capturedOutboundLeg);
  capturedOutboundRef.current = capturedOutboundLeg;

  // Similarly track the latest paymentMethodInput via a ref for use inside the async closure.
  const paymentMethodRef = useRef<PaymentMethod>(paymentMethodInput);
  paymentMethodRef.current = paymentMethodInput;

  const handleConfirmBooking = async (seatId: string) => {
    const c = ctxRef.current;
    const payMethod = paymentMethodRef.current;

    // Use fare-table price when available; for agents prefer agentPrice from fare table
    const isAgentBooking = c.currentUser?.role === UserRole.AGENT;
    const effectiveAgentName = isAgentBooking
      ? (c.currentUser!.name || c.currentUser!.address || c.currentUser!.agentCode || (c.language === 'vi' ? 'Đại lý' : 'Agent'))
      : 'Trực tiếp';

    // Resolve the trip's route object (needed for route ID and surcharges)
    const tripRoute = c.routes.find((r: any) => r.name === c.selectedTrip.route);

    // Determine per-route commission rate for this agent booking
    // Priority: route-specific rate > global commissionRate > 0
    let effectiveCommissionRate = 0;
    if (isAgentBooking && c.currentUser) {
      const agentData = c.agents.find(a => a.id === c.currentUser!.id);
      if (agentData) {
        const routeId = tripRoute?.id;
        if (routeId && agentData.routeCommissionRates && agentData.routeCommissionRates[routeId] !== undefined) {
          effectiveCommissionRate = agentData.routeCommissionRates[routeId];
        } else {
          effectiveCommissionRate = agentData.commissionRate ?? 0;
        }
      }
    }

    // Apply trip-level discount if set
    const tripDiscountMultiplier = 1 - ((c.selectedTrip.discountPercent || 0) / 100);

    // When a commission rate is set, compute agent price as: retailPrice * (1 - rate/100)
    // This overrides the agentPrice field from route/trip for this agent.
    const retailPriceAdult = Math.round((c.selectedTrip.price || 0) * tripDiscountMultiplier);
    const retailPriceChild = Math.round((c.selectedTrip.priceChild || c.selectedTrip.price || 0) * tripDiscountMultiplier);

    const agentPriceFromCommissionAdult = isAgentBooking && effectiveCommissionRate > 0
      ? Math.round(retailPriceAdult * (1 - effectiveCommissionRate / 100))
      : null;
    const agentPriceFromCommissionChild = isAgentBooking && effectiveCommissionRate > 0
      ? Math.round(retailPriceChild * (1 - effectiveCommissionRate / 100))
      : null;

    // Fare-table price: apply commission rate if available, else use fareAgentAmount
    const effectiveFareAmount = c.fareAmount !== null
      ? (isAgentBooking
          ? (effectiveCommissionRate > 0
              ? Math.round(c.fareAmount * (1 - effectiveCommissionRate / 100))
              : (c.fareAgentAmount !== null ? c.fareAgentAmount : c.fareAmount))
          : c.fareAmount)
      : null;

    // Pre-compute discounted stored agent prices (applying trip discount to stored fields)
    const discountedAgentPriceAdult = c.selectedTrip.agentPrice
      ? Math.round(c.selectedTrip.agentPrice * tripDiscountMultiplier)
      : undefined;
    const discountedAgentPriceChild = c.selectedTrip.agentPriceChild
      ? Math.round(c.selectedTrip.agentPriceChild * tripDiscountMultiplier)
      : undefined;

    const basePriceAdult = effectiveFareAmount !== null
      ? effectiveFareAmount
      : (isAgentBooking
          ? (agentPriceFromCommissionAdult ?? discountedAgentPriceAdult ?? retailPriceAdult)
          : retailPriceAdult);
    const basePriceChild = effectiveFareAmount !== null
      ? effectiveFareAmount
      : (isAgentBooking
          ? (agentPriceFromCommissionChild ?? discountedAgentPriceChild ?? discountedAgentPriceAdult ?? retailPriceChild ?? basePriceAdult)
          : retailPriceChild);

    // Children aged 5 and above are charged adult price and need their own seat
    // Children aged 4 and below are free
    const { childrenOver5, childrenUnder5 } = c.childrenAges.reduce(
      (acc, age) => {
        if ((age ?? 0) >= 5) acc.childrenOver5++;
        else acc.childrenUnder5++;
        return acc;
      },
      { childrenOver5: 0, childrenUnder5: 0 }
    );
    const effectiveAdults = c.adults + childrenOver5;
    const effectiveChildren = childrenUnder5 + Math.max(0, c.children - c.childrenAges.length);

    // Calculate route-level surcharges (fuel, holiday, etc.)
    const tripDate = c.selectedTrip.date || '';
    const appliedRouteSurcharges = c.getApplicableRouteSurcharges(tripRoute, tripDate);
    const routeSurchargeTotal = appliedRouteSurcharges.reduce((sum: number, sc: any) => sum + sc.amount * effectiveAdults, 0);

    // Determine all seat IDs upfront so we can compute per-seat fares.
    // Extra seats for all passengers beyond first adult (adults - 1) and children over 5
    const isFreeSeating = c.selectedTrip.seatType === 'free';
    let allSeatIds: string[];
    let effectiveSeatId: string;
    if (isFreeSeating) {
      const seatsNeeded = c.adults + childrenOver5;
      const availableSeats = c.selectedTrip.seats
        .filter((s: any) => s.status === SeatStatus.EMPTY)
        .slice(0, seatsNeeded);
      if (availableSeats.length < seatsNeeded) {
        alert(c.language === 'vi' ? 'Không còn đủ chỗ trống cho số hành khách đã chọn!' : 'Not enough seats available for the selected number of passengers!');
        return;
      }
      allSeatIds = availableSeats.map((s: any) => s.id);
      effectiveSeatId = allSeatIds[0] || '1';
    } else {
      const extraSeatsForBooking = c.extraSeatIds.slice(0, (c.adults - 1) + childrenOver5);
      allSeatIds = [seatId, ...extraSeatsForBooking];
      effectiveSeatId = seatId;
    }

    /**
     * Resolve the raw (retail, discount-adjusted) fare for an extra seat.
     * Returns the seat-specific fare price if a RouteSeatFare override exists and matches
     * the trip date; otherwise returns `null` so the caller can use the default.
     * The primary seat is excluded – its fare is already encoded in basePriceAdult.
     */
    const resolveRawSeatFare = (sid: string): number | null => {
      if (sid === seatId || isFreeSeating || !c.routeSeatFares || c.routeSeatFares.length === 0) {
        return null;
      }
      const candidates = c.routeSeatFares.filter(f => f.seatId === sid);
      if (candidates.length === 0) return null;
      // Pick the fare that best matches the trip date
      let seatFare: RouteSeatFare | undefined;
      if (tripDate) {
        seatFare = candidates.find(f => {
          const afterStart = !f.startDate || f.startDate <= tripDate;
          const beforeEnd = !f.endDate || f.endDate >= tripDate;
          return afterStart && beforeEnd;
        });
      }
      if (!seatFare) seatFare = candidates.find(f => !f.startDate && !f.endDate);
      if (!seatFare) return null;
      return Math.round(seatFare.price * tripDiscountMultiplier);
    };

    /**
     * Look up the effective (agent/discount-adjusted) fare for a given seat.
     * - The primary seat already has its fare resolved in basePriceAdult (via fareAmount).
     * - For extra seats, check if there is a RouteSeatFare override for that specific seat.
     *   If found, apply the same discount/commission logic as the primary seat.
     *   If not found, fall back to basePriceAdult (the segment/route default fare).
     * Free-seating trips have no per-seat overrides, so all seats use basePriceAdult.
     */
    const getEffectiveFareForSeat = (sid: string): number => {
      const rawFare = resolveRawSeatFare(sid);
      if (rawFare === null) return basePriceAdult;
      // Look up the seat fare object to apply agent override
      const seatFareObj = c.routeSeatFares.find(f =>
        f.seatId === sid &&
        (!tripDate || ((!f.startDate || f.startDate <= tripDate) && (!f.endDate || f.endDate >= tripDate)))
      ) ?? c.routeSeatFares.find(f => f.seatId === sid && !f.startDate && !f.endDate);
      // Apply agent commission or agent price override
      if (isAgentBooking && seatFareObj) {
        if (effectiveCommissionRate > 0) {
          return Math.round(rawFare * (1 - effectiveCommissionRate / 100));
        }
        if (seatFareObj.agentPrice !== undefined) {
          return Math.round(seatFareObj.agentPrice * tripDiscountMultiplier);
        }
      }
      return rawFare;
    };

    // Sum individual seat fares instead of multiplying one seat's fare by passenger count.
    // Each seat may have a different price (e.g. seat 1 is cheaper, seat 3 is standard).
    const totalBase = allSeatIds.reduce((sum, sid) => sum + getEffectiveFareForSeat(sid), 0);
    // Pickup/dropoff surcharges are per-seat (multiplied by number of passengers)
    const pickupDropoffSurcharge = (c.pickupSurcharge + c.dropoffSurcharge + c.pickupAddressSurcharge + c.dropoffAddressSurcharge) * effectiveAdults;
    const totalSurcharge = pickupDropoffSurcharge + c.surchargeAmount + routeSurchargeTotal;
    // Calculate selected addons total (price × quantity)
    const selectedAddons = (c.selectedTrip.addons || []).filter((a: TripAddon) => (c.addonQuantities[a.id] || 0) > 0);
    const addonsTotalPrice = selectedAddons.reduce((sum: number, a: TripAddon) => sum + a.price * (c.addonQuantities[a.id] || 1), 0);
    const totalAmount = Math.round(totalBase + totalSurcharge + addonsTotalPrice);

    // Commission amount = difference between retail total and agent net total.
    // Retail base sums per-seat retail prices (before commission), reusing resolveRawSeatFare.
    const retailTotalBase = allSeatIds.reduce((sum, sid) => {
      const rawFare = resolveRawSeatFare(sid);
      return sum + (rawFare !== null ? rawFare : retailPriceAdult);
    }, 0);
    const retailTotalAmount = Math.round(retailTotalBase + totalSurcharge + addonsTotalPrice);
    const commissionAmount = isAgentBooking && effectiveCommissionRate > 0
      ? (retailTotalAmount - totalAmount)
      : 0;

    // Resolve stop orders for segment availability tracking
    const fromRouteStop = tripRoute?.routeStops?.find((s: any) => s.stopId === c.fromStopId);
    const fromStopOrder = fromRouteStop?.order;
    const toStopOrder = tripRoute?.routeStops?.find((s: any) => s.stopId === c.toStopId)?.order;

    // Compute adjusted departure time for the booking when the pickup stop has an offset
    const fromStopOffsetMinutes: number = fromRouteStop?.offsetMinutes ?? 0;
    const adjustedTripTime = fromStopOffsetMinutes > 0
      ? (() => {
          const [h, m] = c.selectedTrip.time.split(':').map(Number);
          if (isNaN(h) || isNaN(m)) return c.selectedTrip.time;
          const totalMinutes = h * 60 + m + fromStopOffsetMinutes;
          const newH = Math.floor(totalMinutes / 60) % 24;
          const newM = totalMinutes % 60;
          return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
        })()
      : c.selectedTrip.time;
    // If the offset pushes the time past midnight, advance the date by the number of overflow days
    const adjustedTripDate = (() => {
      const baseDate = c.selectedTrip.date || todayVN();
      if (fromStopOffsetMinutes <= 0) return baseDate;
      const [h, m] = c.selectedTrip.time.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) return baseDate;
      const overflowDays = Math.floor((h * 60 + m + fromStopOffsetMinutes) / (24 * 60));
      if (overflowDays <= 0) return baseDate;
      // Only adjust if baseDate is in YYYY-MM-DD format (Firestore date)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(baseDate)) return baseDate;
      const d = new Date(baseDate + 'T00:00:00');
      d.setDate(d.getDate() + overflowDays);
      return d.toISOString().slice(0, 10);
    })();

    // Guard: block booking when the selected seat already has an overlapping segment booking.
    if (fromStopOrder !== undefined && toStopOrder !== undefined && !isFreeSeating) {
      const conflictSeatIds = allSeatIds.filter(sid => {
        const seatData = c.selectedTrip.seats.find((s: any) => s.id === sid);
        // If the seat is EMPTY (no active booking), it is never a conflict even if stale
        // segment fields are present from a previously cancelled booking.
        if (!seatData || seatData.status === SeatStatus.EMPTY) return false;
        const segs: Array<{ fromStopOrder: number; toStopOrder: number }> =
          (seatData.segmentBookings ?? []).length > 0
            ? seatData.segmentBookings
            : (seatData.fromStopOrder !== undefined && seatData.toStopOrder !== undefined
                ? [{ fromStopOrder: seatData.fromStopOrder, toStopOrder: seatData.toStopOrder }]
                : []);
        return segs.some(seg => seg.fromStopOrder < toStopOrder && fromStopOrder < seg.toStopOrder);
      });
      if (conflictSeatIds.length > 0) {
        alert(c.language === 'vi'
          ? `Chặng này, ghế ${conflictSeatIds.join(', ')} đã có người ngồi rồi — vui lòng chọn chặng khác.`
          : `Segment already booked for seat(s) ${conflictSeatIds.join(', ')} — please choose a different segment.`);
        return;
      }
    }

    // Strip '&' from pickup/dropoff address fields before saving to database
    const stripAmp = (s: string | undefined) => s ? s.replace(/&/g, '') : s;
    const safePickupPoint = stripAmp(c.pickupPoint) || '';
    const safeDropoffPoint = stripAmp(c.dropoffPoint) || '';
    const safePickupAddress = stripAmp(c.pickupAddress) || '';
    const safeDropoffAddress = stripAmp(c.dropoffAddress) || '';
    const safePickupAddressDetail = stripAmp(c.pickupAddressDetail) || '';
    const safeDropoffAddressDetail = stripAmp(c.dropoffAddressDetail) || '';
    const safePickupStopAddress = stripAmp(c.pickupStopAddress) || '';
    const safeDropoffStopAddress = stripAmp(c.dropoffStopAddress) || '';

    const bookingData: any = {
      customerName: c.customerNameInput.trim() || (c.language === 'vi' ? 'Khách lẻ' : 'Walk-in'),
      phone: c.phoneInput.trim(),
      type: 'TRIP',
      route: c.selectedTrip.route,
      date: adjustedTripDate,
      time: adjustedTripTime,
      tripId: c.selectedTrip.id,
      seatId: effectiveSeatId,
      seatIds: allSeatIds,
      amount: totalAmount,
      agent: effectiveAgentName,
      ...(c.currentUser?.name || c.currentUser?.username ? { bookedByName: c.currentUser.name || c.currentUser.username, bookedByRole: c.currentUser.role } : {}),
      ...(isAgentBooking ? { agentId: c.currentUser!.id } : {}),
      // Commission tracking for agent bookings
      ...(isAgentBooking && effectiveCommissionRate > 0 ? {
        agentCommissionRate: effectiveCommissionRate,
        agentCommissionAmount: commissionAmount,
        agentRetailAmount: retailTotalAmount,
      } : {}),
      status: 'BOOKED',
      adults: c.adults,
      children: c.children,
      pickupPoint: safePickupPoint,
      dropoffPoint: safeDropoffPoint,
      ...(safePickupAddress ? { pickupAddress: safePickupAddress } : {}),
      ...(safeDropoffAddress ? { dropoffAddress: safeDropoffAddress } : {}),
      ...(safePickupAddressDetail ? { pickupAddressDetail: safePickupAddressDetail } : {}),
      ...(safeDropoffAddressDetail ? { dropoffAddressDetail: safeDropoffAddressDetail } : {}),
      ...(safePickupStopAddress ? { pickupStopAddress: safePickupStopAddress } : {}),
      ...(safeDropoffStopAddress ? { dropoffStopAddress: safeDropoffStopAddress } : {}),
      paymentMethod: payMethod,
      ...(c.bookingNote.trim() ? { bookingNote: c.bookingNote.trim() } : {}),
      selectedAddons: selectedAddons.map((a: TripAddon) => ({ id: a.id, name: a.name, price: a.price, quantity: c.addonQuantities[a.id] || 1 })),
      ...(isFreeSeating ? { freeSeating: true } : {}),
      // Surcharge breakdown for ticket display
      ...(appliedRouteSurcharges.length > 0 ? {
        routeSurcharges: appliedRouteSurcharges.map((sc: any) => ({ name: sc.name, amount: sc.amount })),
      } : {}),
      ...((c.pickupSurcharge > 0 || c.pickupAddressSurcharge > 0) ? { pickupSurchargeAmount: c.pickupSurcharge + c.pickupAddressSurcharge } : {}),
      ...((c.dropoffSurcharge > 0 || c.dropoffAddressSurcharge > 0) ? { dropoffSurchargeAmount: c.dropoffSurcharge + c.dropoffAddressSurcharge } : {}),
      // Fare-table fields – present only when a fare was resolved
      ...(effectiveFareAmount !== null && c.fromStopId && c.toStopId ? {
        fromStopId: c.fromStopId,
        toStopId: c.toStopId,
        fareDocId: `${c.fromStopId}_${c.toStopId}`,
        farePricePerPerson: effectiveFareAmount,
        // Store retail fare for reference when agent pays a discounted amount
        ...(c.fareAmount !== null && isAgentBooking && (effectiveCommissionRate > 0 || c.fareAgentAmount !== null) ? { fareRetailPricePerPerson: c.fareAmount } : {}),
      } : {}),
    };

    // Seat update payload includes pickup/dropoff for segment availability
    const seatUpdateData = {
      status: SeatStatus.BOOKED,
      customerName: bookingData.customerName,
      customerPhone: bookingData.phone,
      ...(safePickupPoint ? { pickupPoint: safePickupPoint } : {}),
      ...(safeDropoffPoint ? { dropoffPoint: safeDropoffPoint } : {}),
      ...(safePickupAddress ? { pickupAddress: safePickupAddress } : {}),
      ...(safeDropoffAddress ? { dropoffAddress: safeDropoffAddress } : {}),
      ...(safePickupAddressDetail ? { pickupAddressDetail: safePickupAddressDetail } : {}),
      ...(safeDropoffAddressDetail ? { dropoffAddressDetail: safeDropoffAddressDetail } : {}),
      ...(safePickupStopAddress ? { pickupStopAddress: safePickupStopAddress } : {}),
      ...(safeDropoffStopAddress ? { dropoffStopAddress: safeDropoffStopAddress } : {}),
      ...(fromStopOrder !== undefined ? { fromStopOrder } : {}),
      ...(toStopOrder !== undefined ? { toStopOrder } : {}),
      ...(c.bookingNote.trim() ? { bookingNote: c.bookingNote.trim() } : {}),
    };

    // Build optimistic seat updater for a given set of seatIds / stop orders
    const buildOptimisticUpdater = (targetSeatIds: string[], fromOrder: number | undefined, toOrder: number | undefined, sud: typeof seatUpdateData) => (seat: any): any => {
      if (!targetSeatIds.includes(seat.id)) return seat;
      if (fromOrder !== undefined && toOrder !== undefined) {
        const newEntry = {
          fromStopOrder: fromOrder,
          toStopOrder: toOrder,
          customerName: sud.customerName,
          ...(sud.customerPhone ? { customerPhone: sud.customerPhone } : {}),
          ...(sud.pickupPoint ? { pickupPoint: sud.pickupPoint } : {}),
          ...(sud.dropoffPoint ? { dropoffPoint: sud.dropoffPoint } : {}),
          ...(sud.bookingNote ? { bookingNote: sud.bookingNote } : {}),
        };
        const existingSegs = seat.segmentBookings ?? [];
        const hasExistingSegmentBooking = existingSegs.length > 0 || (seat.fromStopOrder !== undefined && seat.toStopOrder !== undefined);
        if (hasExistingSegmentBooking) {
          let segs = existingSegs;
          if (existingSegs.length === 0 && seat.fromStopOrder !== undefined && seat.toStopOrder !== undefined) {
            segs = [{
              fromStopOrder: seat.fromStopOrder,
              toStopOrder: seat.toStopOrder,
              customerName: seat.customerName,
              customerPhone: seat.customerPhone,
              pickupPoint: seat.pickupPoint,
              dropoffPoint: seat.dropoffPoint,
              bookingNote: seat.bookingNote,
            }];
          }
          return { ...seat, status: SeatStatus.BOOKED, segmentBookings: [...segs, newEntry] };
        }
        return { ...seat, ...sud, segmentBookings: [newEntry] };
      }
      return { ...seat, status: SeatStatus.BOOKED };
    };

    // Helper: update agent balance after a booking is confirmed
    // POSTPAID agents accumulate debt (balance increases)
    // PREPAID agents use their deposit (balance decreases)
    const updateAgentBalance = async (bookingAmount: number) => {
      if (!isAgentBooking || !c.currentUser) return;
      const agentData = c.agents.find(a => a.id === c.currentUser!.id);
      if (!agentData) return;
      const currentBalance = agentData.balance || 0;
      const isPostpaid = agentData.paymentType !== 'PREPAID';
      const newBalance = isPostpaid ? currentBalance + bookingAmount : currentBalance - bookingAmount;
      try {
        await transportService.updateAgent(c.currentUser.id, { balance: newBalance });
      } catch (err) {
        console.error('Failed to update agent balance:', err);
      }
    };

    // Core save function for a single booking – also applies optimistic UI update
    // Pass skipBookSeats=true when seats have already been pre-reserved (QR payment flow).
    const saveSingleBooking = async (bd: any, sud2: typeof seatUpdateData, sids: string[], tripId: string, applyOpt: (seat: any) => any, skipBookSeats = false): Promise<any | null> => {
      const ctx2 = ctxRef.current;
      try {
        const result = await transportService.createBooking(bd);
        if (!skipBookSeats) {
          await transportService.bookSeats(tripId, sids, sud2);
        }
        // Auto-update agent balance: amount is the net amount (after commission) the agent owes
        await updateAgentBalance(bd.amount);
        const savedBooking = { ...bd, id: result.id, ticketCode: result.ticketCode };
        // Fire-and-forget customer activity update (does not affect booking outcome on failure)
        transportService.updateCustomerOnBooking(bd.phone, bd.route, bd.amount, bd.pickupPoint, bd.dropoffPoint)
          .catch(err => console.error('Failed to update customer activity for', bd.phone, ':', err));
        // Optimistic local state update (only needed when seats weren't pre-reserved)
        if (!skipBookSeats) {
          ctx2.setTrips((prev: any[]) => prev.map((trip: any) => {
            if (trip.id === tripId) {
              return { ...trip, seats: trip.seats.map(applyOpt) };
            }
            return trip;
          }));
          ctx2.setSelectedTrip((prev: any) => {
            if (!prev || prev.id !== tripId) return prev;
            return { ...prev, seats: prev.seats.map(applyOpt) };
          });
        }
        return savedBooking;
      } catch (err) {
        console.error('Failed to save booking:', err);
        return null;
      }
    };

    // Helper: reset all booking form state after a booking is completed
    const resetFormState = () => {
      const ctx2 = ctxRef.current;
      ctx2.setShowBookingForm(null);
      ctx2.setCustomerNameInput('');
      ctx2.setPhoneInput('');
      ctx2.setAdults(1);
      ctx2.setChildren(0);
      ctx2.setChildrenAges([]);
      ctx2.setExtraSeatIds([]);
      ctx2.setPickupPoint('');
      ctx2.setDropoffPoint('');
      ctx2.setPickupAddress('');
      ctx2.setDropoffAddress('');
      ctx2.setPickupAddressDetail('');
      ctx2.setDropoffAddressDetail('');
      ctx2.setPickupStopAddress('');
      ctx2.setDropoffStopAddress('');
      ctx2.setPickupSurcharge(0);
      ctx2.setDropoffSurcharge(0);
      ctx2.setSurchargeAmount(0);
      ctx2.setBookingDiscount(0);
      setPaymentMethodInput(DEFAULT_PAYMENT_METHOD);
      ctx2.setAddonQuantities({});
      ctx2.setBookingNote('');
      ctx2.setFareAmount(null);
      ctx2.setFareAgentAmount(null);
      ctx2.setFareError('');
      ctx2.setFareLoading(false);
      ctx2.setFromStopId('');
      ctx2.setToStopId('');
      ctx2.setSeatSelectionHistory([]);
    };

    // ── ROUND-TRIP OUTBOUND PHASE ─────────────────────────────────────────────
    // Capture outbound data without saving or charging; signal App.tsx to advance to return phase.
    if (c.tripType === 'ROUND_TRIP' && c.roundTripPhase === 'outbound') {
      // Save name/phone before resetFormState clears them, so they carry over to the return phase
      const savedCustomerName = c.customerNameInput;
      const savedPhone = c.phoneInput;
      const outboundApplyOpt = buildOptimisticUpdater(allSeatIds, fromStopOrder, toStopOrder, seatUpdateData);
      setCapturedOutboundLeg({
        bookingData: { ...bookingData },
        seatUpdateData: { ...seatUpdateData },
        allSeatIds: [...allSeatIds],
        tripId: c.selectedTrip.id,
        amount: totalAmount,
        applyOptimisticSeatUpdate: outboundApplyOpt,
      });
      resetFormState();
      c.onRoundTripOutboundCaptured({
        route: c.selectedTrip.route,
        time: c.selectedTrip.time,
        date: c.selectedTrip.date || '',
        customerName: savedCustomerName,
        phone: savedPhone,
      });
      return;
    }

    // ── ROUND-TRIP RETURN PHASE ──────────────────────────────────────────────
    // Combine outbound + return totals, show QR for combined amount, then save both.
    if (c.tripType === 'ROUND_TRIP' && c.roundTripPhase === 'return') {
      const outboundLeg = capturedOutboundRef.current;
      if (!outboundLeg) {
        // Outbound data was lost (e.g. page refresh) – fall back to saving only the return leg.
        // Fall through to the standard single-leg path below.
      } else {
        const combinedAmount = outboundLeg.amount + totalAmount;
        const isCustomerOrGuest = c.currentUser?.role === UserRole.CUSTOMER || c.currentUser?.role === 'GUEST';
        const returnApplyOpt = buildOptimisticUpdater(allSeatIds, fromStopOrder, toStopOrder, seatUpdateData);

        const saveBothBookings = async () => {
          const ctx2 = ctxRef.current;
          const capturedLeg = capturedOutboundRef.current!;

          // Save outbound
          const savedOutbound = await saveSingleBooking(
            capturedLeg.bookingData,
            capturedLeg.seatUpdateData,
            capturedLeg.allSeatIds,
            capturedLeg.tripId,
            capturedLeg.applyOptimisticSeatUpdate,
          );
          if (!savedOutbound) {
            alert(ctx2.language === 'vi'
              ? 'Đặt vé chuyến đi thất bại. Vui lòng thử lại.'
              : 'Outbound booking failed. Please try again.');
            return;
          }

          // Save return
          const returnBookingData = {
            ...bookingData,
            // For combined round-trip, amount on each leg is its own price;
            // the combined total is for display/payment purposes only
          };
          const savedReturn = await saveSingleBooking(
            returnBookingData,
            seatUpdateData,
            allSeatIds,
            c.selectedTrip.id,
            returnApplyOpt,
          );
          if (!savedReturn) {
            alert(ctx2.language === 'vi'
              ? 'Đặt vé chuyến về thất bại. Vé chuyến đi đã được lưu. Vui lòng liên hệ nhân viên.'
              : 'Return booking failed. Outbound ticket was saved. Please contact staff.');
            // Still show outbound ticket
            ctx2.setLastBooking(savedOutbound);
            ctx2.setIsTicketOpen(true);
            setCapturedOutboundLeg(null);
            resetFormState();
            return;
          }

          // Combine into a single "round-trip ticket" for display
          const combinedTicket = {
            ...savedReturn,
            isRoundTrip: true,
            amount: combinedAmount,
            outboundLeg: savedOutbound,
          };
          ctx2.setLastBooking(combinedTicket);
          // Persist to localStorage for CUSTOMER / GUEST
          if (ctx2.currentUser?.role === UserRole.CUSTOMER || ctx2.currentUser?.role === 'GUEST') {
            saveTicketToLocalStorage(combinedTicket);
          }
          ctx2.setIsTicketOpen(true);

          // Send real-time notification
          if (ctx2.ws && ctx2.ws.readyState === WebSocket.OPEN) {
            ctx2.ws.send(JSON.stringify({
              type: 'NEW_BOOKING',
              customerName: combinedTicket.customerName,
              route: `${savedOutbound.route} ↔ ${savedReturn.route}`,
              time: savedOutbound.time,
              amount: combinedAmount,
            }));
          }

          setCapturedOutboundLeg(null);
          resetFormState();
        };

        if (payMethod === 'Chuyển khoản QR' || isCustomerOrGuest) {
          const paymentReference = transportService.generateTicketCode();
          outboundLeg.bookingData.paymentRef = paymentReference;
          outboundLeg.bookingData.paymentMethod = 'Chuyển khoản QR';
          bookingData.paymentRef = paymentReference;
          bookingData.paymentMethod = 'Chuyển khoản QR';

          // Pre-reserve outbound seats immediately so they show as yellow to other users
          try {
            await transportService.bookSeats(outboundLeg.tripId, outboundLeg.allSeatIds, outboundLeg.seatUpdateData);
          } catch (err) {
            console.error('Failed to reserve outbound seats:', err);
            alert(c.language === 'vi' ? 'Không thể giữ chỗ chuyến đi. Vui lòng thử lại.' : 'Unable to reserve outbound seats. Please try again.');
            return;
          }
          // Apply outbound optimistic UI update
          {
            const ctx2 = ctxRef.current;
            ctx2.setTrips((prev: any[]) => prev.map((trip: any) => {
              if (trip.id === outboundLeg.tripId) return { ...trip, seats: trip.seats.map(outboundLeg.applyOptimisticSeatUpdate) };
              return trip;
            }));
          }

          // Pre-reserve return seats immediately
          try {
            await transportService.bookSeats(c.selectedTrip.id, allSeatIds, seatUpdateData);
          } catch (err) {
            console.error('Failed to reserve return seats:', err);
            // Release outbound reservation on failure
            await transportService.releaseSeats(outboundLeg.tripId, outboundLeg.allSeatIds);
            alert(c.language === 'vi' ? 'Không thể giữ chỗ chuyến về. Vui lòng thử lại.' : 'Unable to reserve return seats. Please try again.');
            return;
          }
          // Apply return optimistic UI update
          {
            const ctx2 = ctxRef.current;
            ctx2.setTrips((prev: any[]) => prev.map((trip: any) => {
              if (trip.id === c.selectedTrip.id) return { ...trip, seats: trip.seats.map(returnApplyOpt) };
              return trip;
            }));
            ctx2.setSelectedTrip((prev: any) => {
              if (!prev || prev.id !== c.selectedTrip.id) return prev;
              return { ...prev, seats: prev.seats.map(returnApplyOpt) };
            });
          }

          // Capture IDs for potential release on cancel
          const capturedOutboundTripId = outboundLeg.tripId;
          const capturedOutboundSeatIds = [...outboundLeg.allSeatIds];
          const capturedReturnTripId = c.selectedTrip.id;
          const capturedReturnSeatIds = [...allSeatIds];

          // Create pending payment record in Firestore for round-trip booking
          transportService.createPendingPayment({
            paymentRef: paymentReference,
            expectedAmount: combinedAmount,
            customerName: bookingData.customerName,
            routeInfo: `${outboundLeg.bookingData.route ?? ''} ↔ ${bookingData.route ?? ''}`,
            tripId: c.selectedTrip.id,
          }).catch(err => console.error('[pendingPayment] create error:', err));

          const releaseAllReservations = async () => {
            const ctx2 = ctxRef.current;
            // Clean up the pending payment record
            transportService.deletePendingPayment(paymentReference)
              .catch(err => console.error('[pendingPayment] delete error:', err));
            await Promise.all([
              transportService.releaseSeats(capturedOutboundTripId, capturedOutboundSeatIds),
              transportService.releaseSeats(capturedReturnTripId, capturedReturnSeatIds),
            ]).catch(err => console.error('Failed to release reservations:', err));
            // Reverse optimistic UI updates
            const outboundSet = new Set(capturedOutboundSeatIds);
            const returnSet = new Set(capturedReturnSeatIds);
            ctx2.setTrips((prev: any[]) => prev.map((trip: any) => {
              if (trip.id === capturedOutboundTripId) {
                return { ...trip, seats: trip.seats.map((s: any) => outboundSet.has(s.id) ? { id: s.id, status: SeatStatus.EMPTY } : s) };
              }
              if (trip.id === capturedReturnTripId) {
                return { ...trip, seats: trip.seats.map((s: any) => returnSet.has(s.id) ? { id: s.id, status: SeatStatus.EMPTY } : s) };
              }
              return trip;
            }));
            ctx2.setSelectedTrip((prev: any) => {
              if (!prev || prev.id !== capturedReturnTripId) return prev;
              return { ...prev, seats: prev.seats.map((s: any) => returnSet.has(s.id) ? { id: s.id, status: SeatStatus.EMPTY } : s) };
            });
            setCapturedOutboundLeg(null);
          };

          // saveBothBookings with seats already pre-reserved (skip bookSeats calls)
          const saveBothBookingsAfterReservation = async () => {
            const ctx2 = ctxRef.current;
            const capturedLeg = capturedOutboundRef.current!;
            // Clean up the pending payment record
            transportService.deletePendingPayment(paymentReference)
              .catch(err => console.error('[pendingPayment] delete error:', err));

            const savedOutbound = await saveSingleBooking(
              { ...capturedLeg.bookingData, paymentStatus: 'PAID' },
              capturedLeg.seatUpdateData,
              capturedLeg.allSeatIds,
              capturedLeg.tripId,
              capturedLeg.applyOptimisticSeatUpdate,
              true, // skipBookSeats – already reserved
            );
            if (!savedOutbound) {
              alert(ctx2.language === 'vi'
                ? 'Đặt vé chuyến đi thất bại. Vui lòng thử lại.'
                : 'Outbound booking failed. Please try again.');
              return;
            }

            const returnBookingData = { ...bookingData, paymentStatus: 'PAID' };
            const savedReturn = await saveSingleBooking(
              returnBookingData,
              seatUpdateData,
              allSeatIds,
              c.selectedTrip.id,
              returnApplyOpt,
              true, // skipBookSeats – already reserved
            );
            if (!savedReturn) {
              alert(ctx2.language === 'vi'
                ? 'Đặt vé chuyến về thất bại. Vé chuyến đi đã được lưu. Vui lòng liên hệ nhân viên.'
                : 'Return booking failed. Outbound ticket was saved. Please contact staff.');
              ctx2.setLastBooking(savedOutbound);
              ctx2.setIsTicketOpen(true);
              setCapturedOutboundLeg(null);
              resetFormState();
              return;
            }

            // Update pre-reserved seats from BOOKED (held/yellow) to PAID (confirmed/green)
            await Promise.all([
              transportService.bookSeats(capturedOutboundTripId, capturedOutboundSeatIds, { status: SeatStatus.PAID }),
              transportService.bookSeats(capturedReturnTripId, capturedReturnSeatIds, { status: SeatStatus.PAID }),
            ]).catch(err => console.error('Failed to update seats to PAID:', err));
            // Optimistic UI updates for both legs
            const outboundSet = new Set(capturedOutboundSeatIds);
            const returnSet = new Set(capturedReturnSeatIds);
            ctx2.setTrips((prev: any[]) => prev.map((trip: any) => {
              if (trip.id === capturedOutboundTripId) {
                return { ...trip, seats: trip.seats.map((s: any) => outboundSet.has(s.id) ? { ...s, status: SeatStatus.PAID } : s) };
              }
              if (trip.id === capturedReturnTripId) {
                return { ...trip, seats: trip.seats.map((s: any) => returnSet.has(s.id) ? { ...s, status: SeatStatus.PAID } : s) };
              }
              return trip;
            }));
            ctx2.setSelectedTrip((prev: any) => {
              if (!prev || prev.id !== capturedReturnTripId) return prev;
              return { ...prev, seats: prev.seats.map((s: any) => returnSet.has(s.id) ? { ...s, status: SeatStatus.PAID } : s) };
            });

            const combinedTicket = {
              ...savedReturn,
              isRoundTrip: true,
              amount: combinedAmount,
              outboundLeg: savedOutbound,
            };
            ctx2.setLastBooking(combinedTicket);
            if (ctx2.currentUser?.role === UserRole.CUSTOMER || ctx2.currentUser?.role === 'GUEST') {
              saveTicketToLocalStorage(combinedTicket);
            }
            ctx2.setIsTicketOpen(true);

            if (ctx2.ws && ctx2.ws.readyState === WebSocket.OPEN) {
              ctx2.ws.send(JSON.stringify({
                type: 'NEW_BOOKING',
                customerName: combinedTicket.customerName,
                route: `${savedOutbound.route} ↔ ${savedReturn.route}`,
                time: savedOutbound.time,
                amount: combinedAmount,
              }));
            }

            setCapturedOutboundLeg(null);
            resetFormState();
          };

          const isVi2 = c.language === 'vi';
          const roundTripBreakdown: PriceBreakdownItem[] = [
            { label: isVi2 ? 'Chuyến đi' : 'Outbound trip', amount: outboundLeg.amount, isSection: true },
            { label: isVi2 ? 'Chuyến về' : 'Return trip', amount: totalAmount, isSection: true },
            { label: isVi2 ? 'Tổng thanh toán (khứ hồi)' : 'Total (round-trip)', amount: combinedAmount, isTotal: true },
          ];

          setPendingQrBooking({
            amount: combinedAmount,
            ref: paymentReference,
            label: bookingData.customerName,
            execute: saveBothBookingsAfterReservation,
            cancel: releaseAllReservations,
            priceBreakdown: roundTripBreakdown,
          });
          return;
        }

        // Non-QR payment – save directly
        await saveBothBookings();
        return;
      }
    }

    // ── SINGLE-LEG (ONE_WAY) OR FALLBACK ─────────────────────────────────────
    // Core save function – shared by both QR and direct booking paths
    const saveBooking = async () => {
      const ctx2 = ctxRef.current; // re-read for potential async staleness
      try {
        const result = await transportService.createBooking(bookingData);
        await transportService.bookSeats(ctx2.selectedTrip.id, allSeatIds, seatUpdateData);
        // Auto-update agent balance: amount is the net amount (after commission) the agent owes
        await updateAgentBalance(bookingData.amount);
        const savedBooking = { ...bookingData, id: result.id, ticketCode: result.ticketCode };
        ctx2.setLastBooking(savedBooking);
        // Fire-and-forget customer activity update (does not affect booking outcome on failure)
        transportService.updateCustomerOnBooking(bookingData.phone, bookingData.route, bookingData.amount, bookingData.pickupPoint, bookingData.dropoffPoint)
          .catch(err => console.error('Failed to update customer activity for', bookingData.phone, ':', err));
        // Persist ticket to localStorage for CUSTOMER and GUEST so they can view it later
        if (ctx2.currentUser?.role === UserRole.CUSTOMER || ctx2.currentUser?.role === 'GUEST') {
          saveTicketToLocalStorage(savedBooking);
        }
      } catch (err) {
        console.error('Failed to save booking:', err);
        alert(ctx2.language === 'vi'
          ? 'Đặt vé thất bại: Không thể kết nối đến máy chủ. Vui lòng thử lại.'
          : 'Booking failed: Unable to connect to server. Please try again.');
        return;
      }

      ctx2.setIsTicketOpen(true);
      ctx2.setShowBookingForm(null);

      // Reset form inputs
      ctx2.setCustomerNameInput('');
      ctx2.setPhoneInput('');
      ctx2.setAdults(1);
      ctx2.setChildren(0);
      ctx2.setChildrenAges([]);
      ctx2.setExtraSeatIds([]);
      ctx2.setPickupPoint('');
      ctx2.setDropoffPoint('');
      ctx2.setPickupAddress('');
      ctx2.setDropoffAddress('');
      ctx2.setPickupAddressDetail('');
      ctx2.setDropoffAddressDetail('');
      ctx2.setPickupStopAddress('');
      ctx2.setDropoffStopAddress('');
      ctx2.setPickupSurcharge(0);
      ctx2.setDropoffSurcharge(0);
      ctx2.setSurchargeAmount(0);
      ctx2.setBookingDiscount(0);
      setPaymentMethodInput(DEFAULT_PAYMENT_METHOD);
      ctx2.setAddonQuantities({});
      ctx2.setBookingNote('');
      // Reset fare-table state
      ctx2.setFareAmount(null);
      ctx2.setFareAgentAmount(null);
      ctx2.setFareError('');
      ctx2.setFareLoading(false);
      ctx2.setFromStopId('');
      ctx2.setToStopId('');
      ctx2.setSeatSelectionHistory([]);

      // Send real-time notification
      if (ctx2.ws && ctx2.ws.readyState === WebSocket.OPEN) {
        ctx2.ws.send(JSON.stringify({
          type: 'NEW_BOOKING',
          customerName: bookingData.customerName,
          route: bookingData.route,
          time: bookingData.time,
          amount: bookingData.amount,
        }));
      }

      // Optimistic local state update while Firebase listener syncs
      const applyOptimisticSeatUpdate = buildOptimisticUpdater(allSeatIds, fromStopOrder, toStopOrder, seatUpdateData);

      ctx2.setTrips((prev: any[]) => prev.map((trip: any) => {
        if (trip.id === ctx2.selectedTrip.id) {
          return { ...trip, seats: trip.seats.map(applyOptimisticSeatUpdate) };
        }
        return trip;
      }));
      ctx2.setSelectedTrip((prev: any) => {
        if (!prev) return prev;
        return { ...prev, seats: prev.seats.map(applyOptimisticSeatUpdate) };
      });
    };

    // When payment method is QR bank transfer (or for customer/guest who always use QR), show the QR modal first
    const isCustomerOrGuest = c.currentUser?.role === UserRole.CUSTOMER || c.currentUser?.role === 'GUEST';
    if (payMethod === 'Chuyển khoản QR' || isCustomerOrGuest) {
      const paymentReference = transportService.generateTicketCode();
      bookingData.paymentRef = paymentReference;
      bookingData.paymentMethod = 'Chuyển khoản QR'; // ensure correct method is stored

      // Pre-reserve seats immediately so they show as yellow (BOOKED) to other users
      // while this customer is on the payment screen.
      try {
        await transportService.bookSeats(c.selectedTrip.id, allSeatIds, seatUpdateData);
      } catch (err) {
        console.error('Failed to reserve seats:', err);
        alert(c.language === 'vi' ? 'Không thể giữ chỗ. Vui lòng thử lại.' : 'Unable to reserve seats. Please try again.');
        return;
      }

      // Apply optimistic UI update (seats appear yellow immediately)
      const applyOptimisticSeatUpdate = buildOptimisticUpdater(allSeatIds, fromStopOrder, toStopOrder, seatUpdateData);
      {
        const ctx2 = ctxRef.current;
        ctx2.setTrips((prev: any[]) => prev.map((trip: any) => {
          if (trip.id === ctx2.selectedTrip.id) return { ...trip, seats: trip.seats.map(applyOptimisticSeatUpdate) };
          return trip;
        }));
        ctx2.setSelectedTrip((prev: any) => {
          if (!prev) return prev;
          return { ...prev, seats: prev.seats.map(applyOptimisticSeatUpdate) };
        });
      }

      // Capture for release on cancel
      const capturedTripId = c.selectedTrip.id;
      const capturedSeatIds = [...allSeatIds];
      const capturedSegmentInfo = fromStopOrder !== undefined && toStopOrder !== undefined
        ? { fromStopOrder, toStopOrder }
        : undefined;

      // Create a pending payment record in Firestore so the QR modal can detect
      // payment confirmation in real-time (auto-verify amount & content).
      transportService.createPendingPayment({
        paymentRef: paymentReference,
        expectedAmount: totalAmount,
        customerName: bookingData.customerName,
        routeInfo: bookingData.route ?? '',
        tripId: c.selectedTrip.id,
      }).catch(err => console.error('[pendingPayment] create error:', err));

      // Release reserved seats when the user cancels or the 3-min timer expires
      const releaseReservation = async () => {
        const ctx2 = ctxRef.current;
        // Clean up the pending payment record
        transportService.deletePendingPayment(paymentReference)
          .catch(err => console.error('[pendingPayment] delete error:', err));
        await transportService.releaseSeats(capturedTripId, capturedSeatIds, capturedSegmentInfo)
          .catch(err => console.error('Failed to release reserved seats:', err));
        // Reverse the optimistic UI update
        const seatIdSet = new Set(capturedSeatIds);
        ctx2.setTrips((prev: any[]) => prev.map((trip: any) => {
          if (trip.id !== capturedTripId) return trip;
          return { ...trip, seats: trip.seats.map((s: any) => seatIdSet.has(s.id) ? { id: s.id, status: SeatStatus.EMPTY } : s) };
        }));
        ctx2.setSelectedTrip((prev: any) => {
          if (!prev || prev.id !== capturedTripId) return prev;
          return { ...prev, seats: prev.seats.map((s: any) => seatIdSet.has(s.id) ? { id: s.id, status: SeatStatus.EMPTY } : s) };
        });
      };

      // saveBookingAfterReservation only creates the booking doc; seats already reserved
      const saveBookingAfterReservation = async () => {
        const ctx2 = ctxRef.current;
        // Clean up the pending payment record now that it's been confirmed
        transportService.deletePendingPayment(paymentReference)
          .catch(err => console.error('[pendingPayment] delete error:', err));
        try {
          const result = await transportService.createBooking({ ...bookingData, paymentStatus: 'PAID' });
          const savedBooking = { ...bookingData, id: result.id, ticketCode: result.ticketCode };
          ctx2.setLastBooking(savedBooking);
          // Fire-and-forget customer activity update (does not affect booking outcome on failure)
          transportService.updateCustomerOnBooking(bookingData.phone, bookingData.route, bookingData.amount, bookingData.pickupPoint, bookingData.dropoffPoint)
            .catch(err => console.error('Failed to update customer activity for', bookingData.phone, ':', err));
          // Persist ticket to localStorage for CUSTOMER and GUEST so they can view it later
          if (ctx2.currentUser?.role === UserRole.CUSTOMER || ctx2.currentUser?.role === 'GUEST') {
            saveTicketToLocalStorage(savedBooking);
          }
        } catch (err) {
          console.error('Failed to save booking:', err);
          alert(ctx2.language === 'vi'
            ? 'Đặt vé thất bại: Không thể kết nối đến máy chủ. Vui lòng thử lại.'
            : 'Booking failed: Unable to connect to server. Please try again.');
          return;
        }

        // Update pre-reserved seats from BOOKED (held/yellow) to PAID (confirmed/green)
        await transportService.bookSeats(capturedTripId, capturedSeatIds, { status: SeatStatus.PAID })
          .catch(err => console.error('Failed to update seat status to PAID:', err));
        // Optimistic UI update: show seats as PAID immediately
        const seatIdSet = new Set(capturedSeatIds);
        ctx2.setTrips((prev: any[]) => prev.map((trip: any) => {
          if (trip.id !== capturedTripId) return trip;
          return { ...trip, seats: trip.seats.map((s: any) => seatIdSet.has(s.id) ? { ...s, status: SeatStatus.PAID } : s) };
        }));
        ctx2.setSelectedTrip((prev: any) => {
          if (!prev || prev.id !== capturedTripId) return prev;
          return { ...prev, seats: prev.seats.map((s: any) => seatIdSet.has(s.id) ? { ...s, status: SeatStatus.PAID } : s) };
        });

        ctx2.setIsTicketOpen(true);
        ctx2.setShowBookingForm(null);

        // Reset form inputs
        ctx2.setCustomerNameInput('');
        ctx2.setPhoneInput('');
        ctx2.setAdults(1);
        ctx2.setChildren(0);
        ctx2.setChildrenAges([]);
        ctx2.setExtraSeatIds([]);
        ctx2.setPickupPoint('');
        ctx2.setDropoffPoint('');
        ctx2.setPickupAddress('');
        ctx2.setDropoffAddress('');
        ctx2.setPickupAddressDetail('');
        ctx2.setDropoffAddressDetail('');
        ctx2.setPickupStopAddress('');
        ctx2.setDropoffStopAddress('');
        ctx2.setPickupSurcharge(0);
        ctx2.setDropoffSurcharge(0);
        ctx2.setSurchargeAmount(0);
        ctx2.setBookingDiscount(0);
        setPaymentMethodInput(DEFAULT_PAYMENT_METHOD);
        ctx2.setAddonQuantities({});
        ctx2.setBookingNote('');
        ctx2.setFareAmount(null);
        ctx2.setFareAgentAmount(null);
        ctx2.setFareError('');
        ctx2.setFareLoading(false);
        ctx2.setFromStopId('');
        ctx2.setToStopId('');
        ctx2.setSeatSelectionHistory([]);

        // Send real-time notification
        if (ctx2.ws && ctx2.ws.readyState === WebSocket.OPEN) {
          ctx2.ws.send(JSON.stringify({
            type: 'NEW_BOOKING',
            customerName: bookingData.customerName,
            route: bookingData.route,
            time: bookingData.time,
            amount: bookingData.amount,
          }));
        }
      };

      // Build price breakdown items for display in the payment modal
      const singleLegBreakdown: PriceBreakdownItem[] = [];
      const isVi = c.language === 'vi';
      const paxLabel = effectiveAdults === 1
        ? (isVi ? '1 hành khách' : '1 passenger')
        : (isVi ? `${effectiveAdults} hành khách` : `${effectiveAdults} passengers`);
      singleLegBreakdown.push({ label: isVi ? `Vé (${paxLabel})` : `Ticket (${paxLabel})`, amount: totalBase });
      if (effectiveChildren > 0) {
        singleLegBreakdown.push({ label: isVi ? `Trẻ em <5 tuổi (${effectiveChildren} bé)` : `Children <5 yrs (${effectiveChildren})`, amount: 0, isFree: true });
      }
      if (pickupDropoffSurcharge > 0) {
        singleLegBreakdown.push({ label: isVi ? 'Phụ phí điểm đón/trả' : 'Pickup/dropoff surcharge', amount: pickupDropoffSurcharge });
      }
      if (c.surchargeAmount > 0) {
        singleLegBreakdown.push({ label: isVi ? 'Phụ phí khác' : 'Other surcharge', amount: c.surchargeAmount });
      }
      appliedRouteSurcharges.forEach((sc: any) => {
        singleLegBreakdown.push({ label: (isVi ? 'Phụ phí tuyến: ' : 'Route surcharge: ') + sc.name, amount: sc.amount * effectiveAdults });
      });
      selectedAddons.forEach((a: TripAddon) => {
        const qty = c.addonQuantities[a.id] || 1;
        singleLegBreakdown.push({ label: `${a.name} × ${qty}`, amount: a.price * qty });
      });
      singleLegBreakdown.push({ label: isVi ? 'Tổng thanh toán' : 'Total', amount: totalAmount, isTotal: true });

      setPendingQrBooking({
        amount: totalAmount,
        ref: paymentReference,
        label: bookingData.customerName,
        execute: saveBookingAfterReservation,
        cancel: releaseReservation,
        priceBreakdown: singleLegBreakdown,
      });
      return;
    }

    // All other payment methods – save immediately
    await saveBooking();
  };

  return {
    paymentMethodInput,
    setPaymentMethodInput,
    pendingQrBooking,
    setPendingQrBooking,
    agentTopUpModal,
    setAgentTopUpModal,
    handleConfirmBooking,
    capturedOutboundLeg,
    setCapturedOutboundLeg,
  };
}
