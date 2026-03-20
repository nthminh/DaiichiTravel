/**
 * Booking utility helpers – pure functions shared between Operations, CompletedTrips, and App.
 *
 * Extracted from App.tsx so that page-level components can import them directly
 * without needing to receive them as props from the root.
 */

import type { SeatStatus } from '../constants/translations';

/** Raw booking document shape (Firestore) */
export interface BookingDoc {
  id: string;
  tripId: string;
  seatId?: string;
  seatIds?: string[];
  ticketCode?: string;
  customerName?: string;
  phone?: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  bookingNote?: string;
  status?: string;
  [key: string]: unknown;
}

/** Raw seat shape inside a Trip document */
export interface TripSeat {
  id: string;
  status: SeatStatus;
  customerName?: string;
  customerPhone?: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  bookingNote?: string;
  [key: string]: unknown;
}

/**
 * Returns all seat IDs that belong to the same booking group as `fallbackSeatId`.
 * For single-seat bookings this is just `[seatId]`.
 * For group bookings (`seatIds[]`) all IDs in the array are returned.
 */
export function getBookingGroupSeatIds(
  matchingBooking: BookingDoc | null | undefined,
  fallbackSeatId: string,
): string[] {
  if (!matchingBooking) return [fallbackSeatId];
  return (
    matchingBooking.seatIds ||
    (matchingBooking.seatId ? [matchingBooking.seatId] : [fallbackSeatId])
  );
}

/**
 * Builds a map of seatId → ticketCode for a given trip.
 * Uses the bookings collection as the source of truth.
 */
export function buildSeatTicketCodeMap(tripId: string, bookings: BookingDoc[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const bk of bookings) {
    if (bk.tripId !== tripId) continue;
    if (!bk.ticketCode) continue;
    if (bk.seatId) map.set(bk.seatId, bk.ticketCode);
    if (bk.seatIds) {
      for (const sid of bk.seatIds) map.set(sid, bk.ticketCode);
    }
  }
  return map;
}

/**
 * Groups booked seats by their booking document.
 * Returns an ordered array of `{ booking, seats }` objects.
 */
export function buildPassengerGroups(
  tripId: string,
  bookedSeats: TripSeat[],
  bookings: BookingDoc[],
): { booking: BookingDoc | undefined; seats: TripSeat[] }[] {
  const seatToBookingMap = new Map<string, BookingDoc>();
  for (const bk of bookings) {
    if (bk.tripId !== tripId) continue;
    if (bk.seatId) seatToBookingMap.set(bk.seatId, bk);
    if (bk.seatIds) {
      for (const sid of bk.seatIds) seatToBookingMap.set(sid, bk);
    }
  }
  const groupMap = new Map<string, { booking: BookingDoc | undefined; seats: TripSeat[] }>();
  for (const seat of bookedSeats) {
    const bk = seatToBookingMap.get(seat.id);
    const key = bk?.id || bk?.ticketCode || `__${seat.id}`;
    if (!groupMap.has(key)) groupMap.set(key, { booking: bk, seats: [] });
    groupMap.get(key)!.seats.push(seat);
  }
  return [...groupMap.values()];
}
