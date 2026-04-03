import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  deleteDoc,
  getDoc,
  setDoc,
  getDocs,
  writeBatch,
  runTransaction,
  query, 
  orderBy,
  limit,
  where,
  increment,
  Timestamp,
  getCountFromServer
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Trip, TripStatus, Booking, Consignment, SeatStatus, Seat, SegmentBooking, Agent, Route, Vehicle, Stop, Invoice, TripAddon, RouteFare, RouteSeatFare, Employee, UserGuide, CustomerProfile, DriverAssignment, StaffMessage, VehicleType, CustomerCategory, CategoryVerificationRequest, AuditLog, PendingPayment, Property, PropertyRoomType } from '../types';
import { getFareForStops as _getFareForStops, upsertFare as _upsertFare, buildSeatFareDocId, type GetFareParams } from './fareService';

interface TourRoomTypeData {
  id: string;
  name: string;
  capacity: number;
  pricingMode: 'PER_ROOM' | 'PER_PERSON';
  price: number;
  totalRooms: number;
  description: string;
  images: string[];
}

interface TourData {
  title: string;
  description: string;
  price: number;
  imageUrl: string;
  images?: string[];      // additional photos for the tour (shown in gallery)
  discountPercent?: number;
  priceAdult?: number;
  priceChild?: number;
  numAdults?: number;     // number of adults in the tour group
  numChildren?: number;   // number of children (>4 years old) in the tour group
  duration?: string;      // e.g., "3 ngày 2 đêm"
  nights?: number;        // number of overnight stays
  pricePerNight?: number; // overnight cost per person per night (legacy – replaced by roomTypes)
  breakfastCount?: number;    // number of breakfast meals per person
  pricePerBreakfast?: number; // price per breakfast per person
  surcharge?: number;         // additional surcharge amount (flat fee)
  surchargeNote?: string;     // description of the surcharge
  youtubeUrl?: string;        // optional YouTube video link for the tour
  startDate?: string;         // tour start date (YYYY-MM-DD)
  endDate?: string;           // tour end date (YYYY-MM-DD)
  departureTime?: string;     // departure time e.g. "07:00"
  departureLocation?: string; // meeting/boarding point
  returnTime?: string;        // expected return time
  returnLocation?: string;    // end-of-tour location
  roomTypes?: TourRoomTypeData[]; // overnight cabin/room options with per-room pricing
  itinerary?: { day: number; content: string }[];
  addons?: { id: string; name: string; price: number; description?: string }[]; // optional add-on services
  linkedPropertyId?: string;  // optional link to a Property asset (Quản lý tài sản)
}

export const DEFAULT_VEHICLE_TYPES = ['Ghế ngồi', 'Ghế ngồi limousine', 'Giường nằm', 'Phòng VIP (cabin)'];

export const transportService = {
  // Listen to all trips
  subscribeToTrips: (callback: (trips: Trip[]) => void) => {
    if (!db) return () => {};
    const q = query(collection(db, 'trips'), orderBy('time', 'asc'), limit(500));
    return onSnapshot(q, (snapshot) => {
      const trips = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Trip[];
      callback(trips);
    }, (err) => { console.error('[trips] subscription error:', err); callback([]); });
  },

  // Update seat status (atomic transaction to avoid race conditions)
  bookSeat: async (tripId: string, seatId: string, bookingData: Partial<Seat>) => {
    if (!db) return;
    const tripRef = doc(db, 'trips', tripId);
    await runTransaction(db, async (transaction) => {
      const tripSnap = await transaction.get(tripRef);
      if (!tripSnap.exists()) return;
      const seats = (tripSnap.data().seats || []) as Seat[];
      const updatedSeats = seats.map((seat: Seat) => {
        if (seat.id !== seatId) return seat;
        // When resetting to EMPTY, clear all passenger/segment data so stale segment fields
        // don't cause false "seat already occupied" warnings on future bookings.
        if (bookingData.status === SeatStatus.EMPTY) {
          return {
            id: seat.id,
            status: SeatStatus.EMPTY,
            ...(seat.row !== undefined && { row: seat.row }),
            ...(seat.col !== undefined && { col: seat.col }),
            ...(seat.deck !== undefined && { deck: seat.deck }),
          };
        }
        return { ...seat, ...bookingData };
      });
      transaction.update(tripRef, { seats: updatedSeats });
    });
  },

  // Update multiple seats atomically in a single transaction
  bookSeats: async (tripId: string, seatIds: string[], bookingData: Partial<Seat>) => {
    if (!db) return;
    const tripRef = doc(db, 'trips', tripId);
    await runTransaction(db, async (transaction) => {
      const tripSnap = await transaction.get(tripRef);
      if (!tripSnap.exists()) return;
      const seats = (tripSnap.data().seats || []) as Seat[];
      const updatedSeats = seats.map((seat: Seat) => {
        if (!seatIds.includes(seat.id)) return seat;

        // When this booking is for a specific sub-segment (has stop orders), preserve
        // existing segment bookings instead of overwriting the primary customer fields.
        if (bookingData.fromStopOrder !== undefined && bookingData.toStopOrder !== undefined) {
          const newEntry: SegmentBooking = {
            fromStopOrder: bookingData.fromStopOrder,
            toStopOrder: bookingData.toStopOrder,
            ...(bookingData.customerName ? { customerName: bookingData.customerName } : {}),
            ...(bookingData.customerPhone ? { customerPhone: bookingData.customerPhone } : {}),
            ...(bookingData.pickupPoint ? { pickupPoint: bookingData.pickupPoint } : {}),
            ...(bookingData.dropoffPoint ? { dropoffPoint: bookingData.dropoffPoint } : {}),
            ...(bookingData.bookingNote ? { bookingNote: bookingData.bookingNote } : {}),
          };
          const existingSegments: SegmentBooking[] = seat.segmentBookings ?? [];
          // Determine if the seat already has any segment booking data
          const hasExistingSegmentBooking = existingSegments.length > 0 || (seat.fromStopOrder !== undefined && seat.toStopOrder !== undefined);
          if (hasExistingSegmentBooking) {
            // Build the initial array from the legacy single-booking fields if segmentBookings
            // wasn't initialised yet (backward-compat: first booking pre-dates this feature).
            let segments = existingSegments;
            if (existingSegments.length === 0 && seat.fromStopOrder !== undefined && seat.toStopOrder !== undefined) {
              segments = [{
                fromStopOrder: seat.fromStopOrder,
                toStopOrder: seat.toStopOrder,
                ...(seat.customerName ? { customerName: seat.customerName } : {}),
                ...(seat.customerPhone ? { customerPhone: seat.customerPhone } : {}),
                ...(seat.pickupPoint ? { pickupPoint: seat.pickupPoint } : {}),
                ...(seat.dropoffPoint ? { dropoffPoint: seat.dropoffPoint } : {}),
                ...(seat.bookingNote ? { bookingNote: seat.bookingNote } : {}),
              }];
            }
            // Append new segment, keeping the primary (first) booking's customer info on the seat
            return {
              ...seat,
              status: SeatStatus.BOOKED,
              segmentBookings: [...segments, newEntry],
            };
          }
          // First segment booking for this seat
          return {
            ...seat,
            ...bookingData,
            segmentBookings: [newEntry],
          };
        }

        // Non-segment booking: simple overwrite (existing behaviour)
        return { ...seat, ...bookingData };
      });
      transaction.update(tripRef, { seats: updatedSeats });
    });
  },

  // Release previously reserved seats (undo a bookSeats call when the user cancels payment)
  releaseSeats: async (tripId: string, seatIds: string[], segmentInfo?: { fromStopOrder: number; toStopOrder: number }) => {
    if (!db) return;
    const tripRef = doc(db, 'trips', tripId);
    await runTransaction(db, async (transaction) => {
      const tripSnap = await transaction.get(tripRef);
      if (!tripSnap.exists()) return;
      const seats = (tripSnap.data().seats || []) as Seat[];
      const updatedSeats = seats.map((seat: Seat) => {
        if (!seatIds.includes(seat.id)) return seat;
        if (segmentInfo) {
          // Remove only the specific segment entry we added during reservation
          const remaining = (seat.segmentBookings ?? []).filter(
            s => !(s.fromStopOrder === segmentInfo.fromStopOrder && s.toStopOrder === segmentInfo.toStopOrder),
          );
          if (remaining.length > 0) {
            // Other segment bookings still exist – keep the seat as BOOKED with remaining segments
            return { ...seat, segmentBookings: remaining };
          }
          // No more segment bookings – reset the whole seat to EMPTY
          return { id: seat.id, status: SeatStatus.EMPTY };
        }
        // Non-segment reservation: reset to EMPTY
        return { id: seat.id, status: SeatStatus.EMPTY };
      });
      transaction.update(tripRef, { seats: updatedSeats });
    });
  },

  /**
   * Admin utility: lock or unlock specific seats on a trip.
   * Lock: EMPTY → LOCKED (prevents customers from booking the seat).
   * Unlock: LOCKED → EMPTY (makes the seat available again).
   * Seats that are already BOOKED or PAID are not affected.
   */
  toggleSeatLock: async (tripId: string, seatIds: string[], lock: boolean) => {
    if (!db) return;
    const tripRef = doc(db, 'trips', tripId);
    await runTransaction(db, async (transaction) => {
      const tripSnap = await transaction.get(tripRef);
      if (!tripSnap.exists()) return;
      const seats = (tripSnap.data().seats || []) as Seat[];
      const updatedSeats = seats.map((seat: Seat) => {
        if (!seatIds.includes(seat.id)) return seat;
        if (lock) {
          if (seat.status !== SeatStatus.EMPTY) return seat;
          return { ...seat, status: SeatStatus.LOCKED };
        } else {
          if (seat.status !== SeatStatus.LOCKED) return seat;
          return { ...seat, status: SeatStatus.EMPTY };
        }
      });
      transaction.update(tripRef, { seats: updatedSeats });
    });
  },

  subscribeToConsignments: (callback: (consignments: Consignment[]) => void) => {
    if (!db) return () => {};
    const q = query(collection(db, 'consignments'), orderBy('createdAt', 'desc'), limit(500));
    return onSnapshot(q, (snapshot) => {
      const consignments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Consignment[];
      callback(consignments);
    }, (err) => { console.error('[consignments] subscription error:', err); callback([]); });
  },

  // Add new consignment
  addConsignment: async (consignment: Omit<Consignment, 'id'>) => {
    if (!db) throw new Error('Firebase not configured');
    return await addDoc(collection(db, 'consignments'), {
      ...consignment,
      createdAt: Timestamp.now()
    });
  },

  // Update consignment
  updateConsignment: async (consignmentId: string, updates: Omit<Partial<Consignment>, 'id'>) => {
    if (!db) throw new Error('Firebase not configured');
    const ref = doc(db, 'consignments', consignmentId);
    await updateDoc(ref, updates as Record<string, unknown>);
  },

  // Delete consignment
  deleteConsignment: async (consignmentId: string) => {
    if (!db) throw new Error('Firebase not configured');
    await deleteDoc(doc(db, 'consignments', consignmentId));
  },

  // Listen to agents
  subscribeToAgents: (callback: (agents: Agent[]) => void) => {
    if (!db) return () => {};
    const q = query(collection(db, 'agents'), orderBy('name', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const agents = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Agent[];
      callback(agents);
    }, (err) => { console.error('[agents] subscription error:', err); callback([]); });
  },

  // Update agent
  updateAgent: async (agentId: string, updates: Partial<Agent>) => {
    if (!db) return;
    const agentRef = doc(db, 'agents', agentId);
    await updateDoc(agentRef, { ...updates, updatedAt: new Date().toISOString() } as Record<string, unknown>);
  },

  // Listen to routes
  subscribeToRoutes: (callback: (routes: Route[]) => void) => {
    if (!db) return () => {};
    const q = query(collection(db, 'routes'), orderBy('stt', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const routes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Route[];
      callback(routes);
    }, (err) => { console.error('[routes] subscription error:', err); callback([]); });
  },

  // Listen to vehicles
  subscribeToVehicles: (callback: (vehicles: Vehicle[]) => void) => {
    if (!db) return () => {};
    const q = query(collection(db, 'vehicles'), orderBy('licensePlate', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const vehicles = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as (Vehicle & { id: string })[];
      callback(vehicles);
    }, (err) => { console.error('[vehicles] subscription error:', err); callback([]); });
  },

  // Listen to stops
  subscribeToStops: (callback: (stops: Stop[]) => void) => {
    if (!db) return () => {};
    const q = query(collection(db, 'stops'), orderBy('name', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const stops = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Stop[];
      callback(stops);
    }, (err) => { console.error('[stops] subscription error:', err); callback([]); });
  },

  // Add stop
  addStop: async (stop: Omit<Stop, 'id'>) => {
    if (!db) return;
    return await addDoc(collection(db, 'stops'), stop);
  },

  // Update stop
  updateStop: async (stopId: string, updates: Partial<Stop>) => {
    if (!db) return;
    const stopRef = doc(db, 'stops', stopId);
    await updateDoc(stopRef, updates as Record<string, unknown>);
  },

  // Delete stop
  deleteStop: async (stopId: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'stops', stopId));
  },

  // Listen to bookings
  subscribeToBookings: (callback: (bookings: any[]) => void) => {
    if (!db) return () => {};
    const q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'), limit(500));
    return onSnapshot(q, (snapshot) => {
      const bookings = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(bookings);
    }, (err) => { console.error('[bookings] subscription error:', err); callback([]); });
  },

  // Generate a short unique ticket code like DT-XXXXXXXX (6 random + 2 time-based chars)
  generateTicketCode: (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    // Use last 2 chars from timestamp (base-36) for time entropy + 6 random chars
    const timePart = Date.now().toString(36).toUpperCase().slice(-2);
    let randomPart = '';
    for (let i = 0; i < 6; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `DT-${randomPart}${timePart}`;
  },

  // Create a new booking – always persists to Firestore cloud (never localStorage)
  createBooking: async (booking: any) => {
    if (!db) {
      throw new Error('Không thể kết nối đến Firestore. Vui lòng kiểm tra cấu hình Firebase.');
    }

    const ticketCode = transportService.generateTicketCode();
    const docRef = await addDoc(collection(db, 'bookings'), {
      ...booking,
      ticketCode,
      createdAt: Timestamp.now()
    });
    return { id: docRef.id, ticketCode, status: 'saved_cloud' };
  },

  // Delete a booking
  deleteBooking: async (bookingId: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'bookings', bookingId));
  },

  // Create a customer inquiry (no trip available – sales team will follow up)
  createInquiry: async (inquiry: {
    name: string;
    phone: string;
    email?: string;
    from: string;
    to: string;
    date: string;
    returnDate?: string;
    adults: number;
    children: number;
    notes?: string;
    tripType: 'ONE_WAY' | 'ROUND_TRIP';
    phase?: 'outbound' | 'return' | 'both';
  }) => {
    if (!db) throw new Error('Firebase not configured');
    const docRef = await addDoc(collection(db, 'inquiries'), {
      ...inquiry,
      status: 'PENDING',
      createdAt: Timestamp.now(),
    });
    return { id: docRef.id };
  },

  // Update a booking
  updateBooking: async (bookingId: string, updates: any) => {
    if (!db) return;
    const { id, ...data } = updates;
    const bookingRef = doc(db, 'bookings', bookingId);
    await updateDoc(bookingRef, data as Record<string, unknown>);
  },

  // ===== INVOICE METHODS =====

  // Listen to invoices
  subscribeToInvoices: (callback: (invoices: Invoice[]) => void) => {
    if (!db) return () => {};
    const q = query(collection(db, 'invoices'), orderBy('createdAt', 'desc'), limit(500));
    return onSnapshot(q, (snapshot) => {
      const invoices = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Invoice[];
      callback(invoices);
    }, () => callback([]));
  },

  // Create invoice
  createInvoice: async (invoice: Omit<Invoice, 'id'>) => {
    if (!db) throw new Error('Firebase not configured');
    // Strip undefined values – Firestore rejects them
    const data = {
      ...Object.fromEntries(Object.entries(invoice).filter(([, v]) => v !== undefined)),
      createdAt: Timestamp.now(),
    };
    return await addDoc(collection(db, 'invoices'), data);
  },

  // Update invoice
  updateInvoice: async (invoiceId: string, updates: Partial<Invoice>) => {
    if (!db) return;
    const ref = doc(db, 'invoices', invoiceId);
    const { id: _id, ...data } = updates as any;
    await updateDoc(ref, data as Record<string, unknown>);
  },

  // Delete invoice
  deleteInvoice: async (invoiceId: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'invoices', invoiceId));
  },

  // ===== TOUR METHODS =====

  // Listen to tours
  subscribeToTours: (callback: (tours: (TourData & { id: string })[]) => void) => {
    if (!db) return () => {};
    const q = query(collection(db, 'tours'), orderBy('createdAt', 'desc'), limit(200));
    return onSnapshot(q, (snapshot) => {
      const tours = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as (TourData & { id: string })[];
      callback(tours);
    }, (error) => {
      console.error('Failed to subscribe to tours:', error);
      callback([]);
    });
  },

  // Add tour
  addTour: async (tour: TourData) => {
    if (!db) throw new Error('Firebase not configured');
    return await addDoc(collection(db, 'tours'), {
      ...tour,
      createdAt: Timestamp.now()
    });
  },

  // Delete tour
  deleteTour: async (tourId: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'tours', tourId));
  },

  // Update tour
  updateTour: async (tourId: string, updates: Partial<TourData & { discountPercent?: number }>) => {
    if (!db) return;
    const ref = doc(db, 'tours', tourId);
    await updateDoc(ref, updates as Record<string, unknown>);
  },

  // Batch create multiple tours at once (e.g. same template, different departure dates)
  addToursBatch: async (tours: TourData[]) => {
    if (!db) throw new Error('Firebase not configured');
    const batch = writeBatch(db);
    const refs = tours.map(() => doc(collection(db, 'tours')));
    refs.forEach((ref, i) => batch.set(ref, { ...tours[i], createdAt: Timestamp.now() }));
    await batch.commit();
    return refs;
  },

  /**
   * Get a one-time snapshot of room types from a property's room_types subcollection.
   * Used when linking a tour to a property to auto-populate room types.
   */
  getPropertyRoomTypes: async (propertyId: string): Promise<PropertyRoomType[]> => {
    if (!db) return [];
    const q = query(
      collection(db, 'properties', propertyId, 'room_types'),
      orderBy('name', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as PropertyRoomType[];
  },

  /**
   * Count non-cancelled tour bookings per room type for a given tour + departure date.
   * Returns a map of roomTypeId → booked count.
   */
  getTourRoomBookingCounts: async (
    tourId: string,
    date: string
  ): Promise<Record<string, number>> => {
    if (!db) return {};
    const q = query(
      collection(db, 'bookings'),
      where('tourId', '==', tourId),
      where('date', '==', date),
      where('status', '!=', 'CANCELLED')
    );
    const snapshot = await getDocs(q);
    const counts: Record<string, number> = {};
    snapshot.docs.forEach(d => {
      const data = d.data();
      const roomTypeId: string | undefined = data.selectedRoomTypeId;
      if (roomTypeId) {
        counts[roomTypeId] = (counts[roomTypeId] ?? 0) + 1;
      }
    });
    return counts;
  },

  /**
   * Real-time subscription for room booking counts (tourId + date).
   * Invokes callback whenever bookings change. Returns unsubscribe function.
   */
  subscribeTourRoomBookingCounts: (
    tourId: string,
    date: string,
    callback: (counts: Record<string, number>) => void
  ): (() => void) => {
    if (!db) { callback({}); return () => {}; }
    const q = query(
      collection(db, 'bookings'),
      where('tourId', '==', tourId),
      where('date', '==', date),
      where('status', '!=', 'CANCELLED')
    );
    return onSnapshot(q, (snapshot) => {
      const counts: Record<string, number> = {};
      snapshot.docs.forEach(d => {
        const data = d.data();
        const roomTypeId: string | undefined = data.selectedRoomTypeId;
        if (roomTypeId) {
          counts[roomTypeId] = (counts[roomTypeId] ?? 0) + 1;
        }
      });
      callback(counts);
    }, () => callback({}));
  },

  /**
   * Fetch room booking counts for multiple tours at once (for listing pages).
   * Returns a map of tourId → { roomTypeId → count }.
   * Only counts non-cancelled bookings; the status filter is applied server-side.
   */
  getMultipleTourRoomBookingCounts: async (
    tourIds: string[]
  ): Promise<Record<string, Record<string, number>>> => {
    if (!db || tourIds.length === 0) return {};
    const FIRESTORE_IN_QUERY_LIMIT = 30;
    const result: Record<string, Record<string, number>> = {};
    // Firestore 'in' supports up to FIRESTORE_IN_QUERY_LIMIT items; batch if needed
    const batches: string[][] = [];
    for (let i = 0; i < tourIds.length; i += FIRESTORE_IN_QUERY_LIMIT) {
      batches.push(tourIds.slice(i, i + FIRESTORE_IN_QUERY_LIMIT));
    }
    for (const batch of batches) {
      const q = query(
        collection(db, 'bookings'),
        where('tourId', 'in', batch),
        where('status', '!=', 'CANCELLED')
      );
      const snapshot = await getDocs(q);
      snapshot.docs.forEach(d => {
        const data = d.data();
        const tid: string | undefined = data.tourId;
        const roomTypeId: string | undefined = data.selectedRoomTypeId;
        if (!tid || !roomTypeId) return;
        if (!result[tid]) result[tid] = {};
        result[tid][roomTypeId] = (result[tid][roomTypeId] ?? 0) + 1;
      });
    }
    return result;
  },

  /**
   * Fetch all non-cancelled tour bookings for a given tour.
   * Used for generating passenger lists / PDF exports.
   */
  getTourBookings: async (tourId: string): Promise<Booking[]> => {
    if (!db) return [];
    const q = query(
      collection(db, 'bookings'),
      where('tourId', '==', tourId),
      limit(2000)
    );
    const snapshot = await getDocs(q);
    const bookings = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Booking[];
    return bookings.sort((a, b) => {
      const aTime = (a.createdAt as any)?.toMillis?.() ?? (a.createdAt as any)?.seconds * 1000 ?? 0;
      const bTime = (b.createdAt as any)?.toMillis?.() ?? (b.createdAt as any)?.seconds * 1000 ?? 0;
      return aTime - bTime;
    });
  },

  // ===== SETTINGS / PERMISSIONS METHODS =====

  // Get role permissions from Firestore
  getPermissions: async (): Promise<Record<string, Record<string, boolean>> | null> => {
    if (!db) return null;
    const ref = doc(db, 'settings', 'permissions');
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data() as Record<string, Record<string, boolean>>;
  },

  // Save role permissions to Firestore
  savePermissions: async (permissions: Record<string, Record<string, boolean>>) => {
    if (!db) return;
    const ref = doc(db, 'settings', 'permissions');
    await setDoc(ref, permissions);
  },

  // Subscribe to real-time permission changes from Firestore
  subscribeToPermissions: (callback: (perms: Record<string, Record<string, boolean>> | null) => void) => {
    if (!db) return () => {};
    const ref = doc(db, 'settings', 'permissions');
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        callback(snap.data() as Record<string, Record<string, boolean>>);
      } else {
        callback(null);
      }
    }, (error) => {
      console.error('Failed to subscribe to permissions:', error);
    });
  },

  // ===== AGENT METHODS =====

  // Add agent
  addAgent: async (agent: Omit<Agent, 'id'>) => {
    if (!db) throw new Error('Firebase not configured');
    return await addDoc(collection(db, 'agents'), { ...agent, updatedAt: new Date().toISOString() });
  },

  // Delete agent
  deleteAgent: async (agentId: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'agents', agentId));
  },

  // ===== ROUTE METHODS =====

  // Add route
  addRoute: async (route: Omit<Route, 'id'>) => {
    if (!db) throw new Error('Firebase not configured');
    return await addDoc(collection(db, 'routes'), { ...route, updatedAt: new Date().toISOString() });
  },

  // Update route
  updateRoute: async (routeId: string, updates: Partial<Route>) => {
    if (!db) return;
    const ref = doc(db, 'routes', routeId);
    await updateDoc(ref, { ...updates, updatedAt: new Date().toISOString() } as Record<string, unknown>);
  },

  // Delete route
  deleteRoute: async (routeId: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'routes', routeId));
  },

  // ===== FARE TABLE METHODS (Option 2: explicit fare between any two stops) =====

  /** Look up the fare for a (fromStop → toStop) pair on a given route. */
  getFare: (params: GetFareParams) => _getFareForStops(params),

  /**
   * Admin utility: create or overwrite a fare entry.
   * Returns the Firestore document ID used for the fare.
   */
  upsertFare: (
    routeId: string,
    fromStopId: string,
    toStopId: string,
    price: number,
    agentPrice?: number,
    currency = 'VND',
    startDate?: string,
    endDate?: string,
    sortOrder?: number,
    fareDocId?: string,
  ) => _upsertFare(routeId, fromStopId, toStopId, price, agentPrice, currency, startDate, endDate, sortOrder, fareDocId),

  /** Fetch all fares for a route (one-time read), sorted by sortOrder to preserve user-defined order. */
  getRouteFares: async (routeId: string): Promise<RouteFare[]> => {
    if (!db) return [];
    const snap = await getDocs(collection(db, 'routeFares', routeId, 'fares'));
    const fares = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<RouteFare, 'id'>) }));
    fares.sort((a, b) => {
      const aSortOrder = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
      const bSortOrder = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
      return aSortOrder - bSortOrder;
    });
    return fares;
  },

  /** Real-time listener for all fares on a route. */
  subscribeToRouteFares: (routeId: string, callback: (fares: RouteFare[]) => void) => {
    if (!db) return () => {};
    return onSnapshot(collection(db, 'routeFares', routeId, 'fares'), (snap) => {
      const fares = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<RouteFare, 'id'>) }));
      fares.sort((a, b) => {
        const aSortOrder = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
        const bSortOrder = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
        return aSortOrder - bSortOrder;
      });
      callback(fares);
    }, (err) => { console.error('[routeFares] subscription error:', err); callback([]); });
  },

  /** Delete a fare entry. */
  deleteFare: async (routeId: string, fareDocId: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'routeFares', routeId, 'fares', fareDocId));
  },

  // ===== SEAT FARE METHODS (per-seat price overrides) =====

  /** Fetch all seat-specific fares for a route (one-time read). */
  getRouteSeatFares: async (routeId: string): Promise<RouteSeatFare[]> => {
    if (!db) return [];
    const snap = await getDocs(collection(db, 'routeSeatFares', routeId, 'seats'));
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<RouteSeatFare, 'id'>) }));
  },

  /** Real-time listener for seat-specific fares on a route. */
  subscribeToRouteSeatFares: (routeId: string, callback: (fares: RouteSeatFare[]) => void) => {
    if (!db) return () => {};
    return onSnapshot(
      collection(db, 'routeSeatFares', routeId, 'seats'),
      (snap) => {
        callback(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<RouteSeatFare, 'id'>) })));
      },
      (err) => { console.error('[routeSeatFares] subscription error:', err); callback([]); },
    );
  },

  /**
   * Create or overwrite a seat-specific fare entry.
   * Returns the Firestore document ID used for the fare.
   * Document ID format: "{seatId}" (no dates) or "{seatId}|{startDate}|{endDate}" (with dates).
   */
  upsertRouteSeatFare: async (
    routeId: string,
    fare: Omit<RouteSeatFare, 'id' | 'updatedAt'>,
    fareDocId?: string,
  ): Promise<string> => {
    if (!db) throw new Error('Firebase not configured');
    const docId = fareDocId ?? buildSeatFareDocId(fare.seatId, fare.startDate, fare.endDate);
    const data = { ...fare, updatedAt: new Date().toISOString() };
    await setDoc(doc(db, 'routeSeatFares', routeId, 'seats', docId), data);
    return docId;
  },

  /** Delete a seat-specific fare entry. */
  deleteRouteSeatFare: async (routeId: string, fareDocId: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'routeSeatFares', routeId, 'seats', fareDocId));
  },

  // ===== VEHICLE METHODS =====

  // Add vehicle
  addVehicle: async (vehicle: Record<string, unknown>) => {
    if (!db) throw new Error('Firebase not configured');
    return await addDoc(collection(db, 'vehicles'), vehicle);
  },

  // Update vehicle
  updateVehicle: async (vehicleId: string, updates: Record<string, unknown>) => {
    if (!db) return;
    const ref = doc(db, 'vehicles', vehicleId);
    await updateDoc(ref, updates);
  },

  // Delete vehicle
  deleteVehicle: async (vehicleId: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'vehicles', vehicleId));
  },

  // ===== VEHICLE TYPE METHODS =====

  // Listen to all vehicle types
  subscribeToVehicleTypes: (callback: (types: VehicleType[]) => void) => {
    if (!db) return () => {};
    const q = query(collection(db, 'vehicleTypes'), orderBy('order', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const types = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as VehicleType[];
      callback(types);
    }, (err) => { console.error('[vehicleTypes] subscription error:', err); callback([]); });
  },

  // Add a new vehicle type
  addVehicleType: async (name: string, order?: number) => {
    if (!db) throw new Error('Firebase not configured');
    return await addDoc(collection(db, 'vehicleTypes'), { name, order: order ?? Date.now() });
  },

  // Update a vehicle type name
  updateVehicleType: async (id: string, name: string) => {
    if (!db) return;
    await updateDoc(doc(db, 'vehicleTypes', id), { name });
  },

  // Delete a vehicle type
  deleteVehicleType: async (id: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'vehicleTypes', id));
  },

  // Seed default vehicle types (safe: only adds if collection is empty)
  seedVehicleTypes: async () => {
    if (!db) throw new Error('Firebase not configured');
    const countSnap = await getCountFromServer(query(collection(db, 'vehicleTypes'), limit(1)));
    if (countSnap.data().count > 0) return 0;
    const batch = writeBatch(db);
    DEFAULT_VEHICLE_TYPES.forEach((name, i) => {
      batch.set(doc(collection(db, 'vehicleTypes')), { name, order: i });
    });
    await batch.commit();
    return DEFAULT_VEHICLE_TYPES.length;
  },

  // Seed the 53 company vehicles (safe: only adds missing ones by licensePlate)
  seedVehicles: async () => {
    if (!db) throw new Error('Firebase not configured');
    const VEHICLES: Omit<Vehicle, 'id' | 'stt' | 'ownerId' | 'layout'>[] = [
      { licensePlate: '15H-10271', type: 'Giường nằm', seats: 30, registrationExpiry: '2025-12-30' },
      { licensePlate: '15F-044.54', type: 'Ghế ngồi limousine', seats: 16, registrationExpiry: '2025-12-30' },
      { licensePlate: '29B-40313', type: 'Ghế ngồi', seats: 16, registrationExpiry: '2025-12-30' },
      { licensePlate: '30M-81034', type: 'Ghế ngồi', seats: 6, registrationExpiry: '2025-12-30' },
      { licensePlate: '30M-81024', type: 'Ghế ngồi', seats: 6, registrationExpiry: '2025-12-30' },
      { licensePlate: '29E-34918', type: 'Ghế ngồi', seats: 10, registrationExpiry: '2025-12-30' },
      { licensePlate: '30M-64157', type: 'Ghế ngồi', seats: 6, registrationExpiry: '2025-12-30' },
      { licensePlate: '38F-005.13', type: 'Giường nằm', seats: 40, registrationExpiry: '2025-12-30' },
      { licensePlate: '30M-81004', type: 'Ghế ngồi', seats: 6, registrationExpiry: '2025-12-30' },
      { licensePlate: '15H-04461', type: 'Ghế ngồi', seats: 47, registrationExpiry: '2025-12-30' },
      { licensePlate: '30M-64193', type: 'Ghế ngồi', seats: 6, registrationExpiry: '2025-12-30' },
      { licensePlate: '29E-37743', type: 'Ghế ngồi', seats: 10, registrationExpiry: '2025-12-30' },
      { licensePlate: '29B-40988', type: 'Ghế ngồi', seats: 45, registrationExpiry: '2025-12-30' },
      { licensePlate: '15F-01022', type: 'Ghế ngồi', seats: 37, registrationExpiry: '2025-12-30' },
      { licensePlate: '30M-81019', type: 'Ghế ngồi', seats: 6, registrationExpiry: '2025-12-30' },
      { licensePlate: '15F-00688', type: 'Ghế ngồi', seats: 47, registrationExpiry: '2025-12-30' },
      { licensePlate: '29E-37513', type: 'Ghế ngồi', seats: 10, registrationExpiry: '2025-12-30' },
      { licensePlate: '30M-64180', type: 'Ghế ngồi', seats: 6, registrationExpiry: '2025-12-30' },
      { licensePlate: '30M-64185', type: 'Ghế ngồi', seats: 6, registrationExpiry: '2025-12-30' },
      { licensePlate: '29E-35633', type: 'Ghế ngồi', seats: 10, registrationExpiry: '2025-12-30' },
      { licensePlate: 'Lan Hạ', type: 'Ghế ngồi', seats: 58, registrationExpiry: '2026-01-05' },
      { licensePlate: '15F-01043', type: 'Giường nằm', seats: 44, registrationExpiry: '2025-12-30' },
      { licensePlate: 'DAIICHI LUXURY CRUISE', type: 'Ghế ngồi', seats: 30, registrationExpiry: '2026-01-07' },
      { licensePlate: '15F-044.22', type: 'Ghế ngồi limousine', seats: 16, registrationExpiry: '2025-12-30' },
      { licensePlate: '29B-40861', type: 'Ghế ngồi', seats: 45, registrationExpiry: '2025-12-30' },
      { licensePlate: '30M-81007', type: 'Ghế ngồi', seats: 6, registrationExpiry: '2025-12-30' },
      { licensePlate: '29B-17305', type: 'Ghế ngồi', seats: 45, registrationExpiry: '2025-12-23' },
      { licensePlate: '29B-40277', type: 'Ghế ngồi', seats: 45, registrationExpiry: '2025-12-30' },
      { licensePlate: '29E-37643', type: 'Ghế ngồi', seats: 10, registrationExpiry: '2025-12-30' },
      { licensePlate: 'Bus Thường', type: 'Ghế ngồi', seats: 45, registrationExpiry: '2026-01-05' },
      { licensePlate: '67F-00655', type: 'Ghế ngồi', seats: 37, registrationExpiry: '2025-12-30' },
      { licensePlate: '29E-37480', type: 'Ghế ngồi', seats: 10, registrationExpiry: '2025-12-30' },
      { licensePlate: '30M-81022', type: 'Ghế ngồi', seats: 6, registrationExpiry: '2025-12-30' },
      { licensePlate: '30M-81027', type: 'Ghế ngồi', seats: 6, registrationExpiry: '2025-12-30' },
      { licensePlate: '15F-006.89', type: 'Ghế ngồi limousine', seats: 16, registrationExpiry: '2025-12-30' },
      { licensePlate: 'Daiichi Boutique Cruise', type: 'Giường nằm', seats: 25, registrationExpiry: '2026-01-06' },
      { licensePlate: '15F-01046', type: 'Giường nằm', seats: 30, registrationExpiry: '2025-12-30' },
      { licensePlate: '30M-64126', type: 'Ghế ngồi', seats: 6, registrationExpiry: '2025-12-30' },
      { licensePlate: '29B-17432', type: 'Ghế ngồi', seats: 45, registrationExpiry: '2025-12-30' },
      { licensePlate: '29B-40320', type: 'Ghế ngồi', seats: 45, registrationExpiry: '2025-12-30' },
      { licensePlate: '15F-006.79', type: 'Ghế ngồi limousine', seats: 16, registrationExpiry: '2025-12-30' },
      { licensePlate: '29B-40588', type: 'Ghế ngồi', seats: 45, registrationExpiry: '2025-12-30' },
      { licensePlate: '15F-00665', type: 'Ghế ngồi', seats: 47, registrationExpiry: '2025-12-30' },
      { licensePlate: '15H-10275', type: 'Giường nằm', seats: 38, registrationExpiry: '2025-12-30' },
      { licensePlate: '29B-40612', type: 'Ghế ngồi', seats: 45, registrationExpiry: '2025-12-30' },
      { licensePlate: '30M-81029', type: 'Ghế ngồi', seats: 6, registrationExpiry: '2025-12-30' },
      { licensePlate: '15F-006.78', type: 'Ghế ngồi limousine', seats: 16, registrationExpiry: '2025-12-30' },
      { licensePlate: '15F-010.14', type: 'Phòng VIP (cabin)', seats: 20, registrationExpiry: '2025-12-30' },
      { licensePlate: '30M-81041', type: 'Ghế ngồi', seats: 6, registrationExpiry: '2025-12-30' },
      { licensePlate: 'Limosine luxury 11C', type: 'Ghế ngồi limousine', seats: 10, registrationExpiry: '2026-01-05' },
      { licensePlate: '29E-37507', type: 'Ghế ngồi', seats: 10, registrationExpiry: '2025-12-30' },
      { licensePlate: 'Limo Green 7C', type: 'Ghế ngồi limousine', seats: 6, registrationExpiry: '2026-01-05' },
      { licensePlate: '30M-81044', type: 'Ghế ngồi', seats: 6, registrationExpiry: '2025-12-30' },
    ];

    // Fetch existing vehicles to avoid duplicates
    const existing = await getDocs(collection(db, 'vehicles'));
    const existingPlates = new Set(existing.docs.map(d => (d.data() as Vehicle).licensePlate));

    const toAdd = VEHICLES.filter(v => !existingPlates.has(v.licensePlate));
    if (toAdd.length === 0) return 0;

    const batch = writeBatch(db);
    toAdd.forEach(v => {
      const ref = doc(collection(db, 'vehicles'));
      batch.set(ref, { ...v, status: 'ACTIVE' });
    });
    await batch.commit();
    return toAdd.length;
  },

  // ===== ADMIN SETTINGS METHODS =====

  // Load admin credentials from Firestore
  getAdminSettings: async (): Promise<{ username: string; password: string } | null> => {
    if (!db) return null;
    try {
      const ref = doc(db, 'settings', 'adminConfig');
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        if (typeof data.username === 'string' && typeof data.password === 'string') {
          return { username: data.username, password: data.password };
        }
      }
      return null;
    } catch {
      return null;
    }
  },

  // Save admin credentials to Firestore
  saveAdminSettings: async (credentials: { username: string; password: string }) => {
    if (!db) return;
    const ref = doc(db, 'settings', 'adminConfig');
    await setDoc(ref, credentials, { merge: true });
  },

  // Subscribe to admin credentials changes in real-time
  subscribeToAdminSettings: (callback: (settings: { username: string; password: string } | null) => void) => {
    if (!db) return () => {};
    const ref = doc(db, 'settings', 'adminConfig');
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (typeof data.username === 'string' && typeof data.password === 'string') {
          callback({ username: data.username, password: data.password });
          return;
        }
      }
      callback(null);
    }, () => callback(null));
  },

  // ===== EMPLOYEE METHODS =====

  // Listen to employees
  subscribeToEmployees: (callback: (employees: Employee[]) => void) => {
    if (!db) return () => {};
    const q = query(collection(db, 'employees'), orderBy('name', 'asc'), limit(200));
    return onSnapshot(q, (snapshot) => {
      const employees = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Employee[];
      callback(employees);
    }, () => callback([]));
  },

  // Add employee
  addEmployee: async (employee: Omit<Employee, 'id'>) => {
    if (!db) throw new Error('Firebase not configured');
    return await addDoc(collection(db, 'employees'), { ...employee, updatedAt: new Date().toISOString() });
  },

  // Update employee
  updateEmployee: async (employeeId: string, updates: Partial<Employee>) => {
    if (!db) return;
    const ref = doc(db, 'employees', employeeId);
    await updateDoc(ref, { ...updates, updatedAt: new Date().toISOString() } as Record<string, unknown>);
  },

  // Delete employee
  deleteEmployee: async (employeeId: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'employees', employeeId));
  },

  // ===== PAYMENT SETTINGS METHODS =====

  // Get payment settings from Firestore
  getPaymentSettings: async (): Promise<Record<string, unknown> | null> => {
    if (!db) return null;
    try {
      const ref = doc(db, 'settings', 'paymentConfig');
      const snap = await getDoc(ref);
      if (snap.exists()) return snap.data() as Record<string, unknown>;
      return null;
    } catch { return null; }
  },

  // Save payment settings to Firestore
  savePaymentSettings: async (settings: Record<string, unknown>) => {
    if (!db) return;
    const ref = doc(db, 'settings', 'paymentConfig');
    await setDoc(ref, settings, { merge: true });
  },

  // Subscribe to payment settings changes in real-time
  subscribeToPaymentSettings: (callback: (settings: Record<string, unknown> | null) => void) => {
    if (!db) return () => {};
    const ref = doc(db, 'settings', 'paymentConfig');
    return onSnapshot(ref, (snap) => {
      callback(snap.exists() ? snap.data() as Record<string, unknown> : null);
    }, () => callback(null));
  },

  // Save security config to Firestore
  saveSecurityConfig: async (config: Record<string, unknown>) => {
    if (!db) return;
    const ref = doc(db, 'settings', 'securityConfig');
    await setDoc(ref, config, { merge: true });
  },

  // Subscribe to security config changes in real-time
  subscribeToSecurityConfig: (callback: (config: Record<string, unknown> | null) => void) => {
    if (!db) return () => {};
    const ref = doc(db, 'settings', 'securityConfig');
    return onSnapshot(ref, (snap) => {
      callback(snap.exists() ? snap.data() as Record<string, unknown> : null);
    }, () => callback(null));
  },

  // ===== TRIP METHODS =====

  // Add trip
  addTrip: async (trip: Omit<Trip, 'id'>) => {
    if (!db) throw new Error('Firebase not configured');
    return await addDoc(collection(db, 'trips'), { ...trip, updatedAt: new Date().toISOString() });
  },

  // Add multiple trips in batch
  addTripsBatch: async (trips: Omit<Trip, 'id'>[]) => {
    if (!db) throw new Error('Firebase not configured');
    const batch = writeBatch(db);
    const refs = trips.map(() => doc(collection(db, 'trips')));
    refs.forEach((ref, i) => batch.set(ref, trips[i]));
    await batch.commit();
    return refs;
  },

  // Update trip
  updateTrip: async (tripId: string, updates: Partial<Trip>) => {
    if (!db) return;
    const ref = doc(db, 'trips', tripId);
    await updateDoc(ref, { ...updates, updatedAt: new Date().toISOString() } as Record<string, unknown>);
  },

  // Delete trip
  deleteTrip: async (tripId: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'trips', tripId));
  },

  /**
   * Merge two free-seating trips on the same route into one.
   * - The primary trip (primaryTripId) absorbs all passengers/seats from the secondary.
   * - Every booking that references secondaryTripId is repointed to primaryTripId with
   *   updated seat IDs (secondary seats are renumbered starting after the primary's last seat).
   * - The secondary trip is NOT deleted; instead all its seats are reset to EMPTY so the
   *   vehicle becomes available for new bookings.
   * - The primary trip is flagged with isMerged=true and mergedFromTripIds=[...].
   *
   * Validation (throws on failure):
   *   - Both trips must exist and be free-seating, on the same route, date and time.
   *   - There is no status restriction – the operator may merge at any time.
   */
  mergeTrips: async (primaryTripId: string, secondaryTripId: string, allBookings: Booking[]) => {
    if (!db) throw new Error('Firebase not configured');

    const primaryRef = doc(db, 'trips', primaryTripId);
    const secondaryRef = doc(db, 'trips', secondaryTripId);

    await runTransaction(db, async (transaction) => {
      const [primarySnap, secondarySnap] = await Promise.all([
        transaction.get(primaryRef),
        transaction.get(secondaryRef),
      ]);

      if (!primarySnap.exists()) throw new Error('Chuyến chính không tồn tại.');
      if (!secondarySnap.exists()) throw new Error('Chuyến phụ không tồn tại.');

      const primary = { id: primaryTripId, ...primarySnap.data() } as Trip;
      const secondary = { id: secondaryTripId, ...secondarySnap.data() } as Trip;

      // Validate free-seating
      if (primary.seatType !== 'free' || secondary.seatType !== 'free') {
        throw new Error('Chỉ có thể ghép các chuyến xe ghế tự do.');
      }
      // Validate same route
      if (primary.route !== secondary.route) {
        throw new Error('Hai chuyến phải cùng tuyến để ghép.');
      }

      // Validate same date
      if (!primary.date || !secondary.date) {
        throw new Error('Không thể ghép chuyến vì thông tin ngày của một hoặc cả hai chuyến bị thiếu.');
      }
      if (primary.date !== secondary.date) {
        throw new Error('Hai chuyến phải cùng ngày để ghép.');
      }

      // Validate same time
      if (primary.time !== secondary.time) {
        throw new Error('Hai chuyến phải cùng giờ xuất phát để ghép.');
      }

      // Build combined seats: primary seats kept as-is; secondary seats renumbered
      const primarySeats: Seat[] = primary.seats || [];
      const secondarySeats: Seat[] = secondary.seats || [];
      const primarySeatCount = primarySeats.length;

      // Map old secondary seat ID → new seat ID
      const seatIdRemap = new Map<string, string>();
      const renumberedSecondarySeats: Seat[] = secondarySeats.map((seat, i) => {
        const newId = String(primarySeatCount + i + 1);
        seatIdRemap.set(seat.id, newId);
        return { ...seat, id: newId };
      });

      const mergedSeats: Seat[] = [...primarySeats, ...renumberedSecondarySeats];

      const existingMergedIds: string[] = primary.mergedFromTripIds || [];
      const mergedFromTripIds = [...new Set([...existingMergedIds, secondaryTripId])];

      // Update primary trip: absorb secondary's seats and mark as merged
      transaction.update(primaryRef, {
        seats: mergedSeats,
        isMerged: true,
        mergedFromTripIds,
      });

      // Clear all seats on the secondary trip so the vehicle becomes empty for new bookings.
      // A new object with only layout fields is constructed intentionally so that all
      // passenger data (customerName, customerPhone, addresses, etc.) is dropped.
      const clearedSecondarySeats = secondarySeats.map((seat) => ({
        id: seat.id,
        status: SeatStatus.EMPTY,
        row: seat.row,
        col: seat.col,
        deck: seat.deck,
      }));
      transaction.update(secondaryRef, { seats: clearedSecondarySeats });

      // Update bookings that reference the secondary trip
      const secondaryBookings = allBookings.filter(b => b.tripId === secondaryTripId);
      for (const booking of secondaryBookings) {
        const bookingRef = doc(db, 'bookings', booking.id);
        const updatedSeats = (booking.seats || []).map(
          (sid: string) => seatIdRemap.get(sid) ?? sid,
        );
        transaction.update(bookingRef, { tripId: primaryTripId, seats: updatedSeats });
      }
    });
  },



  subscribeToUserGuides: (callback: (guides: UserGuide[]) => void) => {
    if (!db) return () => {};
    const q = query(collection(db, 'userGuides'), orderBy('updatedAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const guides = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as UserGuide[];
      callback(guides);
    }, (err) => { console.error('[userGuides] subscription error:', err); callback([]); });
  },

  addUserGuide: async (guide: Omit<UserGuide, 'id'>) => {
    if (!db) throw new Error('Firebase not configured');
    return await addDoc(collection(db, 'userGuides'), guide);
  },

  updateUserGuide: async (guideId: string, updates: Partial<Omit<UserGuide, 'id'>>) => {
    if (!db) return;
    await updateDoc(doc(db, 'userGuides', guideId), updates as Record<string, unknown>);
  },

  deleteUserGuide: async (guideId: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'userGuides', guideId));
  },

  // ─── Customer Profiles ────────────────────────────────────────────────────

  subscribeToCustomers: (callback: (customers: CustomerProfile[]) => void) => {
    if (!db) return () => {};
    const q = query(collection(db, 'customers'), orderBy('registeredAt', 'desc'), limit(500));
    return onSnapshot(q, (snapshot) => {
      const customers = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as CustomerProfile[];
      callback(customers);
    }, () => callback([]));
  },

  addCustomer: async (customer: Omit<CustomerProfile, 'id'>) => {
    if (!db) throw new Error('Firebase not configured');
    return await addDoc(collection(db, 'customers'), customer);
  },

  updateCustomer: async (customerId: string, updates: Partial<Omit<CustomerProfile, 'id'>>) => {
    if (!db) throw new Error('Firebase not configured');
    await updateDoc(doc(db, 'customers', customerId), updates as Record<string, unknown>);
  },

  deleteCustomer: async (customerId: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'customers', customerId));
  },

  // Record a customer's activity (viewed routes/tours, bookings) for recommendations
  recordCustomerActivity: async (
    customerId: string,
    activity: {
      viewedRoute?: string;
      viewedTour?: string;
      bookedRoute?: string;
      vehicleType?: string;
      departurePoint?: string;
      arrivalPoint?: string;
    }
  ) => {
    if (!db) return;
    const MAX_TRACKED_ITEMS = 20;
    const ref = doc(db, 'customers', customerId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data() as CustomerProfile;
    const now = new Date().toISOString();
    const updates: Partial<CustomerProfile> = { lastActivityAt: now };

    if (activity.viewedRoute) {
      const routes = new Set(data.viewedRoutes || []);
      routes.add(activity.viewedRoute);
      updates.viewedRoutes = Array.from(routes).slice(-MAX_TRACKED_ITEMS);
    }
    if (activity.viewedTour) {
      const tours = new Set(data.viewedTours || []);
      tours.add(activity.viewedTour);
      updates.viewedTours = Array.from(tours).slice(-MAX_TRACKED_ITEMS);
    }
    if (activity.bookedRoute) {
      const booked = new Set(data.bookedRoutes || []);
      booked.add(activity.bookedRoute);
      updates.bookedRoutes = Array.from(booked).slice(-MAX_TRACKED_ITEMS);
    }
    const prefs = data.preferences || {};
    if (activity.vehicleType) {
      const types = new Set(prefs.vehicleTypes || []);
      types.add(activity.vehicleType);
      updates.preferences = { ...prefs, vehicleTypes: Array.from(types) };
    }
    if (activity.departurePoint) {
      const depts = new Set(prefs.departurePoints || []);
      depts.add(activity.departurePoint);
      updates.preferences = { ...(updates.preferences ?? prefs), departurePoints: Array.from(depts) };
    }
    if (activity.arrivalPoint) {
      const arrs = new Set(prefs.arrivalPoints || []);
      arrs.add(activity.arrivalPoint);
      updates.preferences = { ...(updates.preferences ?? prefs), arrivalPoints: Array.from(arrs) };
    }

    await updateDoc(ref, updates as Record<string, unknown>);
  },

  // Update customer activity and stats when a booking is confirmed.
  // Looks up the customer by phone number and atomically increments counters.
  updateCustomerOnBooking: async (
    phone: string,
    route: string,
    amount: number,
    departurePoint?: string,
    arrivalPoint?: string,
  ) => {
    if (!db || !phone?.trim()) return;
    const MAX_TRACKED_ITEMS = 20;
    const q = query(collection(db, 'customers'), where('phone', '==', phone.trim()), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return;

    const customerDoc = snap.docs[0];
    const data = customerDoc.data() as CustomerProfile;
    const now = new Date().toISOString();

    const booked = new Set(data.bookedRoutes || []);
    booked.add(route);

    const prefs = data.preferences || {};
    const prefUpdates: { vehicleTypes?: string[]; departurePoints?: string[]; arrivalPoints?: string[] } = { ...prefs };
    if (departurePoint) {
      const depts = new Set(prefs.departurePoints || []);
      depts.add(departurePoint);
      prefUpdates.departurePoints = Array.from(depts);
    }
    if (arrivalPoint) {
      const arrs = new Set(prefs.arrivalPoints || []);
      arrs.add(arrivalPoint);
      prefUpdates.arrivalPoints = Array.from(arrs);
    }

    await updateDoc(customerDoc.ref, {
      bookedRoutes: Array.from(booked).slice(-MAX_TRACKED_ITEMS),
      lastActivityAt: now,
      totalBookings: increment(1),
      totalSpent: increment(amount),
      preferences: prefUpdates,
    });
  },

  // ─── Driver Assignments ────────────────────────────────────────────────────

  subscribeToDriverAssignments: (callback: (assignments: DriverAssignment[]) => void) => {
    if (!db) return () => {};
    const q = query(collection(db, 'driverAssignments'), orderBy('assignedAt', 'desc'), limit(200));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })) as DriverAssignment[]);
    }, (err) => { console.error('[driverAssignments] subscription error:', err); callback([]); });
  },

  addDriverAssignment: async (assignment: Omit<DriverAssignment, 'id'>) => {
    if (!db) throw new Error('Firebase not configured');
    return await addDoc(collection(db, 'driverAssignments'), assignment);
  },

  updateDriverAssignment: async (id: string, updates: Partial<DriverAssignment>) => {
    if (!db) return;
    await updateDoc(doc(db, 'driverAssignments', id), updates as Record<string, unknown>);
  },

  deleteDriverAssignment: async (id: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'driverAssignments', id));
  },

  // ─── Staff Messages ────────────────────────────────────────────────────────

  subscribeToStaffMessages: (callback: (messages: StaffMessage[]) => void) => {
    if (!db) return () => {};
    const q = query(collection(db, 'staffMessages'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })) as StaffMessage[]);
    }, (err) => { console.error('[staffMessages] subscription error:', err); callback([]); });
  },

  addStaffMessage: async (message: Omit<StaffMessage, 'id'>) => {
    if (!db) throw new Error('Firebase not configured');
    return await addDoc(collection(db, 'staffMessages'), message);
  },

  // ─── Customer Categories ──────────────────────────────────────────────────

  subscribeToCustomerCategories: (callback: (categories: CustomerCategory[]) => void) => {
    if (!db) return () => {};
    const q = query(collection(db, 'customerCategories'), orderBy('sortOrder', 'asc'));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })) as CustomerCategory[]);
    }, (err) => { console.error('[customerCategories] subscription error:', err); callback([]); });
  },

  addCustomerCategory: async (category: Omit<CustomerCategory, 'id'>) => {
    if (!db) throw new Error('Firebase not configured');
    return await addDoc(collection(db, 'customerCategories'), category);
  },

  updateCustomerCategory: async (id: string, updates: Partial<Omit<CustomerCategory, 'id'>>) => {
    if (!db) return;
    await updateDoc(doc(db, 'customerCategories', id), updates as Record<string, unknown>);
  },

  deleteCustomerCategory: async (id: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'customerCategories', id));
  },

  // ─── Category Verification Requests ──────────────────────────────────────

  subscribeToCategoryRequests: (callback: (requests: CategoryVerificationRequest[]) => void) => {
    if (!db) return () => {};
    const q = query(collection(db, 'categoryRequests'), orderBy('submittedAt', 'desc'), limit(200));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })) as CategoryVerificationRequest[]);
    }, (err) => { console.error('[categoryRequests] subscription error:', err); callback([]); });
  },

  addCategoryRequest: async (request: Omit<CategoryVerificationRequest, 'id'>) => {
    if (!db) throw new Error('Firebase not configured');
    return await addDoc(collection(db, 'categoryRequests'), request);
  },

  updateCategoryRequest: async (id: string, updates: Partial<Omit<CategoryVerificationRequest, 'id'>>) => {
    if (!db) return;
    await updateDoc(doc(db, 'categoryRequests', id), updates as Record<string, unknown>);
  },

  // ─── Audit Logs ────────────────────────────────────────────────────────────

  logAudit: async (entry: Omit<AuditLog, 'id'>) => {
    if (!db) return;
    try {
      await addDoc(collection(db, 'auditLogs'), entry);
    } catch (err) {
      console.error('[auditLog] write error:', err);
    }
  },

  subscribeToAuditLogs: (callback: (logs: AuditLog[]) => void, limitCount = 200) => {
    if (!db) return () => {};
    const q = query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(limitCount));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })) as AuditLog[]);
    }, (err) => { console.error('[auditLogs] subscription error:', err); callback([]); });
  },

  // ─── Pending Payments (QR auto-verification) ───────────────────────────────

  /**
   * Create a pending payment document when a QR payment session starts.
   * The document ID equals the paymentRef (e.g. "DT-ABC123") for easy lookup.
   */
  createPendingPayment: async (payment: Omit<PendingPayment, 'id' | 'createdAt' | 'status'>) => {
    if (!db) throw new Error('Firebase not configured');
    await setDoc(doc(db, 'pendingPayments', payment.paymentRef), {
      ...payment,
      status: 'PENDING',
      createdAt: Timestamp.now(),
    });
  },

  /**
   * Subscribe to a specific pending payment document in real-time.
   * Used by PaymentQRModal to detect automatic payment confirmation.
   * Returns an unsubscribe function.
   */
  subscribeToPendingPayment: (
    paymentRef: string,
    callback: (data: PendingPayment | null) => void
  ): (() => void) => {
    if (!db) return () => {};
    return onSnapshot(doc(db, 'pendingPayments', paymentRef), (snap) => {
      callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as PendingPayment) : null);
    }, (err) => {
      console.error('[pendingPayment] subscription error:', err);
      callback(null);
    });
  },

  /**
   * Subscribe to all pending payments with status='PENDING'.
   * Used by the payment test simulator UI.
   */
  subscribeToPendingPayments: (callback: (payments: PendingPayment[]) => void): (() => void) => {
    if (!db) return () => {};
    const q = query(
      collection(db, 'pendingPayments'),
      where('status', '==', 'PENDING'),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })) as PendingPayment[]);
    }, (err) => {
      console.error('[pendingPayments] subscription error:', err);
      callback([]);
    });
  },

  /**
   * Mark a pending payment as PAID with the actual paid amount and content.
   * Called by the payment test simulator (or OnePay IPN handler).
   * The QR modal will pick this up via its real-time subscription.
   */
  confirmPendingPayment: async (paymentRef: string, paidAmount: number, paidContent: string) => {
    if (!db) throw new Error('Firebase not configured');
    await updateDoc(doc(db, 'pendingPayments', paymentRef), {
      status: 'PAID',
      paidAmount,
      paidContent,
      confirmedAt: Timestamp.now(),
    });
  },

  /**
   * Delete a pending payment document (cleanup on cancel, expiry, or completion).
   */
  deletePendingPayment: async (paymentRef: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, 'pendingPayments', paymentRef));
    } catch (err) {
      console.error('[pendingPayment] delete error:', err);
    }
  },

  // ─── Property Management (Quản lý tài sản) ─────────────────────────────────

  /** Subscribe to all properties in real-time (ordered by createdAt desc). */
  subscribeToProperties: (callback: (properties: Property[]) => void): (() => void) => {
    if (!db) return () => {};
    const q = query(collection(db, 'properties'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const properties = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Property[];
      callback(properties);
    }, (err) => {
      console.error('[properties] subscription error:', err);
      callback([]);
    });
  },

  /** Add a new property document. */
  addProperty: async (data: Omit<Property, 'id' | 'createdAt'>): Promise<string> => {
    if (!db) throw new Error('Firebase not configured');
    const ref = await addDoc(collection(db, 'properties'), {
      ...data,
      createdAt: Timestamp.now(),
    });
    return ref.id;
  },

  /** Update an existing property document. */
  updateProperty: async (propertyId: string, updates: Partial<Omit<Property, 'id' | 'createdAt'>>): Promise<void> => {
    if (!db) return;
    await updateDoc(doc(db, 'properties', propertyId), updates as Record<string, unknown>);
  },

  /** Delete a property document (does NOT delete its room_types subcollection). */
  deleteProperty: async (propertyId: string): Promise<void> => {
    if (!db) return;
    await deleteDoc(doc(db, 'properties', propertyId));
  },

  /** Subscribe to room_types subcollection of a property in real-time. */
  subscribeToPropertyRoomTypes: (
    propertyId: string,
    callback: (roomTypes: PropertyRoomType[]) => void
  ): (() => void) => {
    if (!db) return () => {};
    const q = query(
      collection(db, 'properties', propertyId, 'room_types'),
      orderBy('name', 'asc')
    );
    return onSnapshot(q, (snapshot) => {
      const roomTypes = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as PropertyRoomType[];
      callback(roomTypes);
    }, (err) => {
      console.error('[room_types] subscription error:', err);
      callback([]);
    });
  },

  /** Add a room type to a property's room_types subcollection. */
  addPropertyRoomType: async (
    propertyId: string,
    data: Omit<PropertyRoomType, 'id'>
  ): Promise<string> => {
    if (!db) throw new Error('Firebase not configured');
    const ref = await addDoc(
      collection(db, 'properties', propertyId, 'room_types'),
      data
    );
    return ref.id;
  },

  /** Update a room type document in the subcollection. */
  updatePropertyRoomType: async (
    propertyId: string,
    roomTypeId: string,
    updates: Partial<Omit<PropertyRoomType, 'id'>>
  ): Promise<void> => {
    if (!db) return;
    await updateDoc(
      doc(db, 'properties', propertyId, 'room_types', roomTypeId),
      updates as Record<string, unknown>
    );
  },

  /** Delete a room type document from the subcollection. */
  deletePropertyRoomType: async (propertyId: string, roomTypeId: string): Promise<void> => {
    if (!db) return;
    await deleteDoc(doc(db, 'properties', propertyId, 'room_types', roomTypeId));
  },
};
