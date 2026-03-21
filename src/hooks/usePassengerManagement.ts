import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { SeatStatus } from '../constants/translations';
import { Trip } from '../types';
import { transportService } from '../services/transportService';
import { getBookingGroupSeatIds } from '../lib/bookingUtils';
import type { Language } from '../constants/translations';

interface UsePassengerManagementOptions {
  language: Language;
  bookings: any[];
  setTrips: Dispatch<SetStateAction<Trip[]>>;
}

/**
 * Manages the "passenger list" modal that appears on Operations and Completed-Trips pages.
 * Encapsulates all state and CRUD handlers for viewing / editing / deleting passengers.
 */
export function usePassengerManagement({ language, bookings, setTrips }: UsePassengerManagementOptions) {
  const [showTripPassengers, setShowTripPassengers] = useState<Trip | null>(null);
  const [editingPassengerSeatId, setEditingPassengerSeatId] = useState<string | null>(null);
  const [passengerEditForm, setPassengerEditForm] = useState({
    customerName: '',
    customerPhone: '',
    pickupAddress: '',
    dropoffAddress: '',
    pickupAddressDetail: '',
    dropoffAddressDetail: '',
    status: SeatStatus.BOOKED as SeatStatus,
    bookingNote: '',
  });
  const [passengerColVisibility, setPassengerColVisibility] = useState({
    ticketCode: true,
    seat: true,
    name: true,
    phone: true,
    pickup: true,
    dropoff: true,
    status: true,
    price: true,
    note: true,
  });
  const [showPassengerColPanel, setShowPassengerColPanel] = useState(false);

  const handleClosePassengerModal = () => {
    setShowTripPassengers(null);
    setEditingPassengerSeatId(null);
    setShowPassengerColPanel(false);
  };

  const handleSavePassengerEdit = async () => {
    if (!showTripPassengers || !editingPassengerSeatId) return;
    const updates = {
      customerName: passengerEditForm.customerName,
      customerPhone: passengerEditForm.customerPhone,
      pickupAddress: passengerEditForm.pickupAddress,
      dropoffAddress: passengerEditForm.dropoffAddress,
      pickupAddressDetail: passengerEditForm.pickupAddressDetail,
      dropoffAddressDetail: passengerEditForm.dropoffAddressDetail,
      status: passengerEditForm.status,
      bookingNote: passengerEditForm.bookingNote,
    };
    try {
      // Sync changes to the corresponding booking document
      const matchingBooking = bookings.find(b =>
        b.tripId === showTripPassengers.id &&
        (b.seatId === editingPassengerSeatId || (b.seatIds && b.seatIds.includes(editingPassengerSeatId)))
      );
      // All seat IDs in this booking group (for group bookings)
      const groupSeatIds = getBookingGroupSeatIds(matchingBooking, editingPassengerSeatId);

      // Update all seats in the group
      await Promise.all(groupSeatIds.map((sid: string) =>
        transportService.bookSeat(showTripPassengers.id, sid, updates)
      ));

      if (matchingBooking) {
        if (passengerEditForm.status === SeatStatus.EMPTY) {
          await transportService.deleteBooking(matchingBooking.id);
        } else {
          await transportService.updateBooking(matchingBooking.id, {
            customerName: passengerEditForm.customerName,
            phone: passengerEditForm.customerPhone,
            pickupAddress: passengerEditForm.pickupAddress,
            dropoffAddress: passengerEditForm.dropoffAddress,
            pickupAddressDetail: passengerEditForm.pickupAddressDetail,
            dropoffAddressDetail: passengerEditForm.dropoffAddressDetail,
            bookingNote: passengerEditForm.bookingNote,
            status: passengerEditForm.status === SeatStatus.PAID ? 'PAID' : 'BOOKED',
          });
        }
      }

      setTrips(prev => prev.map(trip => {
        if (trip.id !== showTripPassengers.id) return trip;
        const updatedSeats = trip.seats.map((s: any) =>
          groupSeatIds.includes(s.id) ? { ...s, ...updates } : s
        );
        const updatedTrip = { ...trip, seats: updatedSeats };
        setShowTripPassengers(updatedTrip);
        return updatedTrip;
      }));
      setEditingPassengerSeatId(null);
    } catch (err) {
      console.error('Failed to save passenger:', err);
    }
  };

  const handleDeletePassenger = async (seatId: string) => {
    if (!showTripPassengers) return;
    const confirmMsg = language === 'vi'
      ? 'Bạn có chắc muốn xóa hành khách này khỏi ghế không?'
      : 'Are you sure you want to remove this passenger from the seat?';
    if (!window.confirm(confirmMsg)) return;
    const emptyData = {
      status: SeatStatus.EMPTY,
      customerName: '',
      customerPhone: '',
      pickupPoint: '',
      dropoffPoint: '',
      pickupAddress: '',
      dropoffAddress: '',
      pickupAddressDetail: '',
      dropoffAddressDetail: '',
      bookingNote: '',
    };
    try {
      // Sync: delete the corresponding booking document
      const matchingBooking = bookings.find(b =>
        b.tripId === showTripPassengers.id &&
        (b.seatId === seatId || (b.seatIds && b.seatIds.includes(seatId)))
      );
      // All seat IDs in this booking group (clear all for group bookings)
      const groupSeatIds = getBookingGroupSeatIds(matchingBooking, seatId);

      await Promise.all(groupSeatIds.map((sid: string) =>
        transportService.bookSeat(showTripPassengers.id, sid, emptyData)
      ));

      if (matchingBooking) {
        await transportService.deleteBooking(matchingBooking.id);
      }

      setTrips(prev => prev.map(trip => {
        if (trip.id !== showTripPassengers.id) return trip;
        const updatedSeats = trip.seats.map((s: any) =>
          groupSeatIds.includes(s.id) ? { ...s, ...emptyData } : s
        );
        const updatedTrip = { ...trip, seats: updatedSeats };
        setShowTripPassengers(updatedTrip);
        return updatedTrip;
      }));
      if (editingPassengerSeatId && groupSeatIds.includes(editingPassengerSeatId)) setEditingPassengerSeatId(null);
    } catch (err) {
      console.error('Failed to delete passenger:', err);
    }
  };

  return {
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
    handleClosePassengerModal,
    handleSavePassengerEdit,
    handleDeletePassenger,
  };
}
