import { useState, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { transportService } from '../services/transportService';
import { Trip, TripStatus, Booking, Vehicle, SeatStatus, TripAddon } from '../types';
import { generateVehicleLayout, serializeLayout, SerializedSeat } from '../lib/vehicleSeatUtils';

/** External dependencies that useTrips needs from App.tsx */
export interface TripContext {
  vehicles: Vehicle[];
  trips: Trip[];
  language: 'vi' | 'en' | 'ja';
}

export const DEFAULT_TRIP_FORM = {
  time: '',
  date: '',
  route: '',
  licensePlate: '',
  driverName: '',
  price: 0,
  agentPrice: 0,
  discountPercent: 0,
  seatCount: 11,
  status: TripStatus.WAITING,
};

export const DEFAULT_BATCH_TRIP_FORM = {
  dateFrom: '',
  dateTo: '',
  route: '',
  licensePlate: '',
  driverName: '',
  price: 0,
  agentPrice: 0,
  seatCount: 11,
};

export const DEFAULT_BATCH_ADDON_FORM = {
  name: '',
  price: 0,
  description: '',
  type: 'OTHER' as 'SIGHTSEEING' | 'TRANSPORT' | 'FOOD' | 'OTHER',
  images: [] as string[],
};

/**
 * useTrips – encapsulates all trip CRUD state and handlers.
 *
 * Usage:
 *   const tripsHook = useTrips(ctx);
 *   // ctx must contain up-to-date vehicles[] and language every render.
 */
export function useTrips(ctx: TripContext) {
  const [showAddTrip, setShowAddTrip] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [isCopyingTrip, setIsCopyingTrip] = useState(false);
  const [tripForm, setTripForm] = useState({ ...DEFAULT_TRIP_FORM });

  // Single trip addon services state
  const [tripAddonServices, setTripAddonServices] = useState<TripAddon[]>([]);
  const [tripAddonForm, setTripAddonForm] = useState({ ...DEFAULT_BATCH_ADDON_FORM });
  const [showTripAddonForm, setShowTripAddonForm] = useState(false);

  // Batch trip creation state
  const [showBatchAddTrip, setShowBatchAddTrip] = useState(false);
  const [batchTripForm, setBatchTripForm] = useState({ ...DEFAULT_BATCH_TRIP_FORM });
  const [batchTimeSlots, setBatchTimeSlots] = useState<string[]>(['']);
  const [batchTripLoading, setBatchTripLoading] = useState(false);
  const [batchAddonServices, setBatchAddonServices] = useState<TripAddon[]>([]);
  const [batchAddonForm, setBatchAddonForm] = useState({ ...DEFAULT_BATCH_ADDON_FORM });
  const [showBatchAddonForm, setShowBatchAddonForm] = useState(false);

  // Saving / error state for trip save operations
  const [isSavingTrip, setIsSavingTrip] = useState(false);
  const [tripSaveError, setTripSaveError] = useState<string | null>(null);
  // Conflict detection: tracks the updatedAt of the trip when editing was opened
  const editingTripUpdatedAtRef = useRef<string | null>(null);
  const [tripConflictWarning, setTripConflictWarning] = useState(false);

  // Merge trips state
  const [selectedTripIdsForMerge, setSelectedTripIdsForMerge] = useState<string[]>([]);
  const [mergeLoading, setMergeLoading] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);

  // Keep a stable ref so async handlers always read the latest context values.
  const ctxRef = useRef<TripContext>(ctx);
  ctxRef.current = ctx;

  const buildSeatsForVehicle = (licensePlate: string, seatCount: number) => {
    const { vehicles } = ctxRef.current;
    const vehicle = vehicles.find(v => v.licensePlate === licensePlate);
    if (vehicle?.seatType === 'free') {
      const FREE_SEATING_COLS = 4;
      return Array.from({ length: seatCount }, (_, i) => ({
        id: String(i + 1),
        row: Math.floor(i / FREE_SEATING_COLS),
        col: i % FREE_SEATING_COLS,
        deck: 0,
        status: SeatStatus.EMPTY,
      }));
    }
    const savedLayout = vehicle?.layout as SerializedSeat[] | null | undefined;
    if (savedLayout && savedLayout.length > 0) {
      // Filter out non-bookable room-header cells before creating trip seats
      return savedLayout
        .filter(s => !s.isRoomHeader)
        .map(s => ({ id: s.label, row: s.row, col: s.col, deck: s.deck, status: SeatStatus.EMPTY }));
    }
    const generatedLayout = generateVehicleLayout(vehicle?.type || 'Ghế ngồi', seatCount);
    return serializeLayout(generatedLayout).map(s => ({
      id: s.label,
      row: s.row,
      col: s.col,
      deck: s.deck,
      status: SeatStatus.EMPTY,
    }));
  };

  const handleSaveTrip = async (forceOverwrite = false) => {
    setIsSavingTrip(true);
    setTripSaveError(null);
    setTripConflictWarning(false);
    try {
      // Conflict detection: if editing an existing trip, compare the updatedAt we
      // recorded when editing started against the live version from context.
      if (editingTrip && !forceOverwrite && editingTripUpdatedAtRef.current !== null) {
        const liveTrip = ctxRef.current.trips.find(tr => tr.id === editingTrip.id);
        const liveUpdatedAt = liveTrip?.updatedAt ?? null;
        if (liveUpdatedAt && liveUpdatedAt !== editingTripUpdatedAtRef.current) {
          // Someone else saved this trip while we were editing – warn the user.
          setTripConflictWarning(true);
          setIsSavingTrip(false);
          return;
        }
      }
      const seats = buildSeatsForVehicle(tripForm.licensePlate, tripForm.seatCount);
      const tripVehicle = ctxRef.current.vehicles.find(v => v.licensePlate === tripForm.licensePlate);
      const seatType = tripVehicle?.seatType || 'assigned';
      if (editingTrip) {
        const newSeatCount = tripForm.seatCount;

        // Rebuild seats when the seat count changes.
        // Fetch the LATEST trip data from Firestore to avoid overwriting concurrent
        // booking changes that happened while the edit modal was open.
        let updatedSeats: any[] | undefined;
        const currentSeatCount = editingTrip.seats?.length ?? 0;
        if (newSeatCount !== currentSeatCount) {
          let liveSeats: any[] = editingTrip.seats || [];
          if (db) {
            try {
              const snap = await getDoc(doc(db, 'trips', editingTrip.id));
              if (snap.exists()) {
                liveSeats = (snap.data().seats as any[]) || [];
              }
            } catch (err) {
              // Fall back to the snapshot captured when the edit opened; log for debugging
              console.warn('Could not fetch fresh trip seats from Firestore, using cached snapshot:', err);
              liveSeats = editingTrip.seats || [];
            }
          }
          const liveSeatCount = liveSeats.length;
          const bookedSeats = liveSeats.filter((s: any) => s.status !== SeatStatus.EMPTY);
          if (newSeatCount > liveSeatCount) {
            // Add empty seats to make up the difference
            const extraSeats = buildSeatsForVehicle(tripForm.licensePlate, newSeatCount).slice(liveSeatCount);
            updatedSeats = [...liveSeats, ...extraSeats];
          } else if (newSeatCount >= bookedSeats.length) {
            // Reduce seat count: keep all booked seats + fill up to newSeatCount with existing empties
            const empties = liveSeats.filter((s: any) => s.status === SeatStatus.EMPTY);
            const emptiesNeeded = newSeatCount - bookedSeats.length;
            updatedSeats = [...bookedSeats, ...empties.slice(0, emptiesNeeded)];
          }
          // If newSeatCount < bookedSeats.length: cannot reduce, silently keep current count
        }

        await transportService.updateTrip(editingTrip.id, {
          time: tripForm.time,
          date: tripForm.date,
          route: tripForm.route,
          licensePlate: tripForm.licensePlate,
          driverName: tripForm.driverName,
          price: tripForm.price,
          agentPrice: tripForm.agentPrice,
          discountPercent: tripForm.discountPercent,
          status: tripForm.status,
          ...(updatedSeats ? { seats: updatedSeats } : {}),
        });
      } else {
        await transportService.addTrip({
          time: tripForm.time,
          date: tripForm.date,
          route: tripForm.route,
          licensePlate: tripForm.licensePlate,
          driverName: tripForm.driverName,
          price: tripForm.price,
          agentPrice: tripForm.agentPrice,
          discountPercent: tripForm.discountPercent,
          status: tripForm.status,
          seats,
          addons: [...tripAddonServices] as TripAddon[],
          seatType,
        });
      }
      setShowAddTrip(false);
      setEditingTrip(null);
      setIsCopyingTrip(false);
      setTripForm({ ...DEFAULT_TRIP_FORM });
      setTripAddonServices([]);
      setTripAddonForm({ ...DEFAULT_BATCH_ADDON_FORM });
      setShowTripAddonForm(false);
    } catch (err: any) {
      console.error('Failed to save trip:', err);
      const lang = ctxRef.current.language;
      setTripSaveError(
        lang === 'vi'
          ? `Lưu thất bại: ${err?.message || 'Vui lòng thử lại.'}`
          : `Save failed: ${err?.message || 'Please try again.'}`,
      );
    } finally {
      setIsSavingTrip(false);
    }
  };

  const handleStartEditTrip = (trip: Trip) => {
    setEditingTrip(trip);
    setIsCopyingTrip(false);
    setTripSaveError(null);
    setTripConflictWarning(false);
    editingTripUpdatedAtRef.current = trip.updatedAt ?? null;
    setTripForm({
      time: trip.time,
      date: trip.date || '',
      route: trip.route,
      licensePlate: trip.licensePlate,
      driverName: trip.driverName,
      price: trip.price,
      agentPrice: trip.agentPrice || 0,
      discountPercent: trip.discountPercent || 0,
      seatCount: trip.seats?.length || 11,
      status: trip.status,
    });
    setShowAddTrip(true);
  };

  const handleCopyTrip = (trip: Trip) => {
    setEditingTrip(null);
    setIsCopyingTrip(true);
    setTripForm({
      time: trip.time,
      date: '',
      route: trip.route,
      licensePlate: trip.licensePlate,
      driverName: trip.driverName,
      price: trip.price,
      agentPrice: trip.agentPrice || 0,
      discountPercent: trip.discountPercent || 0,
      seatCount: trip.seats?.length || 11,
      status: TripStatus.WAITING,
    });
    setShowAddTrip(true);
  };

  const handleCopyTripsToDate = (sourceTrips: Trip[]) => {
    const times = sourceTrips.map(t => t.time).filter(Boolean);
    const firstTrip = sourceTrips[0];
    setBatchTripForm({
      dateFrom: '',
      dateTo: '',
      route: firstTrip?.route || '',
      licensePlate: firstTrip?.licensePlate || '',
      driverName: firstTrip?.driverName || '',
      price: firstTrip?.price || 0,
      agentPrice: firstTrip?.agentPrice || 0,
      seatCount: firstTrip?.seats?.length || 11,
    });
    setBatchTimeSlots(times.length > 0 ? times : ['']);
    setShowBatchAddTrip(true);
  };

  const handleDeleteTrip = async (tripId: string) => {
    if (
      !window.confirm(
        ctxRef.current.language === 'vi'
          ? 'Bạn có chắc muốn xóa chuyến này?'
          : 'Delete this trip?',
      )
    )
      return;
    try {
      await transportService.deleteTrip(tripId);
    } catch (err) {
      console.error('Failed to delete trip:', err);
    }
  };

  const handleSaveTripNote = async (tripId: string, note: string) => {
    try {
      await transportService.updateTrip(tripId, { note } as Partial<Trip>);
    } catch (err) {
      console.error('Failed to save trip note:', err);
    }
  };

  const handleToggleTripForMerge = (tripId: string) => {
    setMergeError(null);
    setSelectedTripIdsForMerge(prev => {
      if (prev.includes(tripId)) return prev.filter(id => id !== tripId);
      if (prev.length >= 2) return prev; // max 2 selections
      return [...prev, tripId];
    });
  };

  const handleMergeTrips = async (allBookings: Booking[]): Promise<boolean> => {
    if (selectedTripIdsForMerge.length !== 2) return false;
    const [primaryId, secondaryId] = selectedTripIdsForMerge;
    setMergeLoading(true);
    setMergeError(null);
    try {
      await transportService.mergeTrips(primaryId, secondaryId, allBookings);
      setSelectedTripIdsForMerge([]);
      return true;
    } catch (err: any) {
      setMergeError(err?.message || 'Ghép chuyến thất bại.');
      return false;
    } finally {
      setMergeLoading(false);
    }
  };

  const handleTripVehicleSelect = (licensePlate: string) => {
    const vehicle = ctxRef.current.vehicles.find(v => v.licensePlate === licensePlate);
    const savedLayout = vehicle?.layout as SerializedSeat[] | null | undefined;
    const bookableSeats = savedLayout ? savedLayout.filter(s => !s.isRoomHeader) : null;
    const layoutSeatCount = bookableSeats && bookableSeats.length > 0 ? bookableSeats.length : null;
    setTripForm(p => ({
      ...p,
      licensePlate,
      seatCount: layoutSeatCount ?? vehicle?.seats ?? p.seatCount,
    }));
  };

  const handleBatchVehicleSelect = (licensePlate: string) => {
    const vehicle = ctxRef.current.vehicles.find(v => v.licensePlate === licensePlate);
    const savedLayout = vehicle?.layout as SerializedSeat[] | null | undefined;
    const bookableSeats = savedLayout ? savedLayout.filter(s => !s.isRoomHeader) : null;
    const layoutSeatCount = bookableSeats && bookableSeats.length > 0 ? bookableSeats.length : null;
    setBatchTripForm(p => ({
      ...p,
      licensePlate,
      seatCount: layoutSeatCount ?? vehicle?.seats ?? p.seatCount,
    }));
  };

  const handleBatchAddTrips = async () => {
    const validSlots = batchTimeSlots.filter(t => t.trim() !== '');
    if (!batchTripForm.dateFrom || !batchTripForm.dateTo || !batchTripForm.route || validSlots.length === 0) return;
    setBatchTripLoading(true);
    try {
      const seats = buildSeatsForVehicle(batchTripForm.licensePlate, batchTripForm.seatCount);
      const batchVehicle = ctxRef.current.vehicles.find(v => v.licensePlate === batchTripForm.licensePlate);
      const seatType = batchVehicle?.seatType || 'assigned';
      const dates: string[] = [];
      const cur = new Date(batchTripForm.dateFrom + 'T00:00:00');
      const end = new Date(batchTripForm.dateTo + 'T00:00:00');
      while (cur <= end) {
        dates.push(cur.toISOString().split('T')[0]);
        cur.setDate(cur.getDate() + 1);
      }
      const tripsToCreate = dates.flatMap(date =>
        validSlots.map(slot => ({
          time: slot,
          date,
          route: batchTripForm.route,
          licensePlate: batchTripForm.licensePlate,
          driverName: batchTripForm.driverName,
          price: batchTripForm.price,
          agentPrice: batchTripForm.agentPrice,
          status: TripStatus.WAITING,
          seats,
          addons: [...batchAddonServices] as TripAddon[],
          seatType,
        })),
      );
      await transportService.addTripsBatch(tripsToCreate);
      setShowBatchAddTrip(false);
      setBatchTripForm({ ...DEFAULT_BATCH_TRIP_FORM });
      setBatchTimeSlots(['']);
      setBatchAddonServices([]);
      setBatchAddonForm({ ...DEFAULT_BATCH_ADDON_FORM });
      setShowBatchAddonForm(false);
    } catch (err) {
      console.error('Failed to batch create trips:', err);
    } finally {
      setBatchTripLoading(false);
    }
  };

  return {
    showAddTrip,
    setShowAddTrip,
    editingTrip,
    setEditingTrip,
    isCopyingTrip,
    setIsCopyingTrip,
    tripForm,
    setTripForm,
    tripAddonServices,
    setTripAddonServices,
    tripAddonForm,
    setTripAddonForm,
    showTripAddonForm,
    setShowTripAddonForm,
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
    tripConflictWarning,
    setTripConflictWarning,
    buildSeatsForVehicle,
    handleSaveTrip,
    handleForceSaveTrip: () => handleSaveTrip(true),
    handleStartEditTrip,
    handleCopyTrip,
    handleCopyTripsToDate,
    handleDeleteTrip,
    handleSaveTripNote,
    handleTripVehicleSelect,
    handleBatchVehicleSelect,
    handleBatchAddTrips,
    // Merge trips
    selectedTripIdsForMerge,
    setSelectedTripIdsForMerge,
    mergeLoading,
    mergeError,
    setMergeError,
    handleToggleTripForMerge,
    handleMergeTrips,
  };
}
