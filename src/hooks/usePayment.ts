import { useState, useRef } from 'react';
import { DEFAULT_PAYMENT_METHOD, PaymentMethod } from '../constants/paymentMethods';
import { transportService } from '../services/transportService';
import { SeatStatus, TripAddon, UserRole, User, Route } from '../types';

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
  extraSeatIds: string[];
  customerNameInput: string;
  phoneInput: string;
  fromStopId: string;
  toStopId: string;
  bookingNote: string;
  fareAmount: number | null;
  fareAgentAmount: number | null;
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

export interface PendingQrBooking {
  amount: number;
  ref: string;
  label: string;
  execute: () => Promise<void>;
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
    const effectiveFareAmount = c.fareAmount !== null
      ? (isAgentBooking && c.fareAgentAmount !== null ? c.fareAgentAmount : c.fareAmount)
      : null;
    const basePriceAdult = effectiveFareAmount !== null
      ? effectiveFareAmount
      : (isAgentBooking
          ? (c.selectedTrip.agentPrice || c.selectedTrip.price || 0)
          : (c.selectedTrip.price || 0));
    const basePriceChild = effectiveFareAmount !== null
      ? effectiveFareAmount
      : (isAgentBooking
          ? (c.selectedTrip.agentPriceChild || c.selectedTrip.agentPrice || c.selectedTrip.priceChild || basePriceAdult)
          : (c.selectedTrip.priceChild || basePriceAdult));

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
    const tripRoute = c.routes.find((r: any) => r.name === c.selectedTrip.route);
    const tripDate = c.selectedTrip.date || '';
    const appliedRouteSurcharges = c.getApplicableRouteSurcharges(tripRoute, tripDate);
    const routeSurchargeTotal = appliedRouteSurcharges.reduce((sum: number, sc: any) => sum + sc.amount * effectiveAdults, 0);

    // Children under 5 are free; only charge adults (which includes children aged 5+)
    const totalBase = (effectiveAdults * basePriceAdult);
    const totalSurcharge = c.pickupSurcharge + c.dropoffSurcharge + c.pickupAddressSurcharge + c.dropoffAddressSurcharge + c.surchargeAmount + routeSurchargeTotal;
    // Calculate selected addons total (price × quantity)
    const selectedAddons = (c.selectedTrip.addons || []).filter((a: TripAddon) => (c.addonQuantities[a.id] || 0) > 0);
    const addonsTotalPrice = selectedAddons.reduce((sum: number, a: TripAddon) => sum + a.price * (c.addonQuantities[a.id] || 1), 0);
    const totalAmount = Math.round(totalBase + totalSurcharge + addonsTotalPrice);

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

    // Resolve stop orders for segment availability tracking
    const fromStopOrder = tripRoute?.routeStops?.find((s: any) => s.stopId === c.fromStopId)?.order;
    const toStopOrder = tripRoute?.routeStops?.find((s: any) => s.stopId === c.toStopId)?.order;

    // Guard: block booking when the selected seat already has an overlapping segment booking.
    if (fromStopOrder !== undefined && toStopOrder !== undefined && !isFreeSeating) {
      const conflictSeatIds = allSeatIds.filter(sid => {
        const seatData = c.selectedTrip.seats.find((s: any) => s.id === sid);
        if (!seatData) return false;
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

    const bookingData: any = {
      customerName: c.customerNameInput.trim() || (c.language === 'vi' ? 'Khách lẻ' : 'Walk-in'),
      phone: c.phoneInput.trim(),
      type: 'TRIP',
      route: c.selectedTrip.route,
      date: c.selectedTrip.date || new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
      time: c.selectedTrip.time,
      tripId: c.selectedTrip.id,
      seatId: effectiveSeatId,
      seatIds: allSeatIds,
      amount: totalAmount,
      agent: effectiveAgentName,
      ...(isAgentBooking ? { agentId: c.currentUser!.id } : {}),
      status: 'BOOKED',
      adults: c.adults,
      children: c.children,
      pickupPoint: c.pickupPoint,
      dropoffPoint: c.dropoffPoint,
      ...(c.pickupAddress ? { pickupAddress: c.pickupAddress } : {}),
      ...(c.dropoffAddress ? { dropoffAddress: c.dropoffAddress } : {}),
      ...(c.pickupAddressDetail ? { pickupAddressDetail: c.pickupAddressDetail } : {}),
      ...(c.dropoffAddressDetail ? { dropoffAddressDetail: c.dropoffAddressDetail } : {}),
      paymentMethod: payMethod,
      ...(c.bookingNote.trim() ? { bookingNote: c.bookingNote.trim() } : {}),
      selectedAddons: selectedAddons.map((a: TripAddon) => ({ id: a.id, name: a.name, price: a.price, quantity: c.addonQuantities[a.id] || 1 })),
      ...(isFreeSeating ? { freeSeating: true } : {}),
      // Fare-table fields – present only when a fare was resolved
      ...(effectiveFareAmount !== null && c.fromStopId && c.toStopId ? {
        fromStopId: c.fromStopId,
        toStopId: c.toStopId,
        fareDocId: `${c.fromStopId}_${c.toStopId}`,
        farePricePerPerson: effectiveFareAmount,
        ...(c.fareAmount !== null && isAgentBooking && c.fareAgentAmount !== null ? { fareRetailPricePerPerson: c.fareAmount } : {}),
      } : {}),
    };

    // Seat update payload includes pickup/dropoff for segment availability
    const seatUpdateData = {
      status: SeatStatus.BOOKED,
      customerName: bookingData.customerName,
      customerPhone: bookingData.phone,
      ...(c.pickupPoint ? { pickupPoint: c.pickupPoint } : {}),
      ...(c.dropoffPoint ? { dropoffPoint: c.dropoffPoint } : {}),
      ...(c.pickupAddress ? { pickupAddress: c.pickupAddress } : {}),
      ...(c.dropoffAddress ? { dropoffAddress: c.dropoffAddress } : {}),
      ...(c.pickupAddressDetail ? { pickupAddressDetail: c.pickupAddressDetail } : {}),
      ...(c.dropoffAddressDetail ? { dropoffAddressDetail: c.dropoffAddressDetail } : {}),
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

    // Core save function for a single booking – also applies optimistic UI update
    const saveSingleBooking = async (bd: any, sud2: typeof seatUpdateData, sids: string[], tripId: string, applyOpt: (seat: any) => any): Promise<any | null> => {
      const ctx2 = ctxRef.current;
      try {
        const result = await transportService.createBooking(bd);
        await transportService.bookSeats(tripId, sids, sud2);
        const savedBooking = { ...bd, id: result.id, ticketCode: result.ticketCode };
        // Optimistic local state update
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
          setPendingQrBooking({
            amount: combinedAmount,
            ref: paymentReference,
            label: bookingData.customerName,
            execute: saveBothBookings,
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
        const savedBooking = { ...bookingData, id: result.id, ticketCode: result.ticketCode };
        ctx2.setLastBooking(savedBooking);
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
      setPendingQrBooking({
        amount: totalAmount,
        ref: paymentReference,
        label: bookingData.customerName,
        execute: saveBooking,
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
