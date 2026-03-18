import { useState, useRef } from 'react';
import { DEFAULT_PAYMENT_METHOD, PaymentMethod } from '../constants/paymentMethods';
import { transportService } from '../services/transportService';
import { SeatStatus, TripAddon, UserRole, User, Route } from '../types';

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
  surchargeAmount: number;
  bookingDiscount: number;
  pickupPoint: string;
  dropoffPoint: string;
  pickupAddress: string;
  dropoffAddress: string;
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
  setPickupSurcharge: (n: number) => void;
  setDropoffSurcharge: (n: number) => void;
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

  // Keep a mutable ref to the latest context so the async handler always reads
  // up-to-date values without needing to be recreated every render.
  const ctxRef = useRef<BookingContext>(ctx);
  ctxRef.current = ctx;

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

    // Children over 4 years old are charged adult price and need their own seat
    const { childrenOver4, childrenUnder4 } = c.childrenAges.reduce(
      (acc, age) => {
        if ((age ?? 0) > 4) acc.childrenOver4++;
        else acc.childrenUnder4++;
        return acc;
      },
      { childrenOver4: 0, childrenUnder4: 0 }
    );
    const effectiveAdults = c.adults + childrenOver4;
    const effectiveChildren = childrenUnder4 + Math.max(0, c.children - c.childrenAges.length);

    // Calculate route-level surcharges (fuel, holiday, etc.)
    const tripRoute = c.routes.find((r: any) => r.name === c.selectedTrip.route);
    const tripDate = c.selectedTrip.date || '';
    const appliedRouteSurcharges = c.getApplicableRouteSurcharges(tripRoute, tripDate);
    const routeSurchargeTotal = appliedRouteSurcharges.reduce((sum: number, sc: any) => sum + sc.amount * (effectiveAdults + effectiveChildren), 0);

    const totalBase = (effectiveAdults * basePriceAdult) + (effectiveChildren * basePriceChild);
    const totalSurcharge = c.pickupSurcharge + c.dropoffSurcharge + c.surchargeAmount + routeSurchargeTotal;
    // Calculate selected addons total (price × quantity)
    const selectedAddons = (c.selectedTrip.addons || []).filter((a: TripAddon) => (c.addonQuantities[a.id] || 0) > 0);
    const addonsTotalPrice = selectedAddons.reduce((sum: number, a: TripAddon) => sum + a.price * (c.addonQuantities[a.id] || 1), 0);
    const totalAmount = Math.round((totalBase + totalSurcharge + addonsTotalPrice) * (1 - c.bookingDiscount / 100));

    // Extra seats for all passengers beyond first adult (adults - 1) and children over 4
    const isFreeSeating = c.selectedTrip.seatType === 'free';
    let allSeatIds: string[];
    let effectiveSeatId: string;
    if (isFreeSeating) {
      const seatsNeeded = c.adults + childrenOver4;
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
      const extraSeatsForBooking = c.extraSeatIds.slice(0, (c.adults - 1) + childrenOver4);
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
      date: new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
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
      ...(fromStopOrder !== undefined ? { fromStopOrder } : {}),
      ...(toStopOrder !== undefined ? { toStopOrder } : {}),
      ...(c.bookingNote.trim() ? { bookingNote: c.bookingNote.trim() } : {}),
    };

    // Core save function – shared by both QR and direct booking paths
    const saveBooking = async () => {
      const ctx2 = ctxRef.current; // re-read for potential async staleness
      try {
        const result = await transportService.createBooking(bookingData);
        await transportService.bookSeats(ctx2.selectedTrip.id, allSeatIds, seatUpdateData);
        ctx2.setLastBooking({ ...bookingData, id: result.id, ticketCode: result.ticketCode });
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
      const applyOptimisticSeatUpdate = (seat: any): any => {
        if (!allSeatIds.includes(seat.id)) return seat;
        if (fromStopOrder !== undefined && toStopOrder !== undefined) {
          const newEntry = {
            fromStopOrder,
            toStopOrder,
            customerName: seatUpdateData.customerName,
            ...(seatUpdateData.customerPhone ? { customerPhone: seatUpdateData.customerPhone } : {}),
            ...(seatUpdateData.pickupPoint ? { pickupPoint: seatUpdateData.pickupPoint } : {}),
            ...(seatUpdateData.dropoffPoint ? { dropoffPoint: seatUpdateData.dropoffPoint } : {}),
            ...(seatUpdateData.bookingNote ? { bookingNote: seatUpdateData.bookingNote } : {}),
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
          return { ...seat, ...seatUpdateData, segmentBookings: [newEntry] };
        }
        return { ...seat, status: SeatStatus.BOOKED };
      };

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

    // When payment method is QR bank transfer, show the QR modal first
    if (payMethod === 'Chuyển khoản QR') {
      const paymentReference = transportService.generateTicketCode();
      bookingData.paymentRef = paymentReference;
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
  };
}
