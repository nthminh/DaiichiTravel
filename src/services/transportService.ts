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
  Timestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Trip, TripStatus, Booking, Consignment, SeatStatus, Seat, SegmentBooking, Agent, Route, Vehicle, Stop, Invoice, TripAddon, RouteFare, Employee, UserGuide, CustomerProfile, DriverAssignment, StaffMessage } from '../types';
import { getFareForStops as _getFareForStops, upsertFare as _upsertFare, type GetFareParams } from './fareService';

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
  pricePerNight?: number; // overnight cost per person per night
  breakfastCount?: number;    // number of breakfast meals per person
  pricePerBreakfast?: number; // price per breakfast per person
  surcharge?: number;         // additional surcharge amount (flat fee)
  surchargeNote?: string;     // description of the surcharge
  youtubeUrl?: string;        // optional YouTube video link for the tour
  startDate?: string;         // tour start date (YYYY-MM-DD)
  endDate?: string;           // tour end date (YYYY-MM-DD)
  itinerary?: { day: number; content: string }[];
  addons?: { id: string; name: string; price: number; description?: string }[]; // optional add-on services
}

export const transportService = {
  // Listen to all trips
  subscribeToTrips: (callback: (trips: Trip[]) => void) => {
    if (!db) return () => {};
    const q = query(collection(db, 'trips'), orderBy('time', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const trips = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Trip[];
      callback(trips);
    });
  },

  // Update seat status (atomic transaction to avoid race conditions)
  bookSeat: async (tripId: string, seatId: string, bookingData: Partial<Seat>) => {
    if (!db) return;
    const tripRef = doc(db, 'trips', tripId);
    await runTransaction(db, async (transaction) => {
      const tripSnap = await transaction.get(tripRef);
      if (!tripSnap.exists()) return;
      const seats = (tripSnap.data().seats || []) as Seat[];
      const updatedSeats = seats.map((seat: Seat) =>
        seat.id === seatId ? { ...seat, ...bookingData } : seat
      );
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

  subscribeToConsignments: (callback: (consignments: Consignment[]) => void) => {
    if (!db) return () => {};
    const q = query(collection(db, 'consignments'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const consignments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Consignment[];
      callback(consignments);
    });
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
    });
  },

  // Update agent
  updateAgent: async (agentId: string, updates: Partial<Agent>) => {
    if (!db) return;
    const agentRef = doc(db, 'agents', agentId);
    await updateDoc(agentRef, updates as Record<string, unknown>);
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
    });
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
    });
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
    });
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

  // Import stops from Excel data (skips duplicates by name)
  importStops: async (rows: Omit<Stop, 'id'>[]) => {
    if (!db) throw new Error('Firebase not configured');
    const existing = await getDocs(collection(db, 'stops'));
    const existingNames = new Set(existing.docs.map(d => (d.data() as Stop).name));
    const toAdd = rows.filter(r => r.name && !existingNames.has(r.name));
    if (toAdd.length === 0) return 0;
    const batch = writeBatch(db);
    toAdd.forEach(r => {
      const ref = doc(collection(db, 'stops'));
      batch.set(ref, r);
    });
    await batch.commit();
    return toAdd.length;
  },

  // Listen to bookings
  subscribeToBookings: (callback: (bookings: any[]) => void) => {
    if (!db) return () => {};
    const q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const bookings = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(bookings);
    });
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
    const q = query(collection(db, 'invoices'), orderBy('createdAt', 'desc'));
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
    const q = query(collection(db, 'tours'), orderBy('createdAt', 'desc'));
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
    return await addDoc(collection(db, 'agents'), agent);
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

  // Import routes from Excel data (skips duplicates by name)
  importRoutes: async (rows: Omit<Route, 'id'>[]) => {
    if (!db) throw new Error('Firebase not configured');
    const existing = await getDocs(collection(db, 'routes'));
    const existingNames = new Set(existing.docs.map(d => (d.data() as Route).name));
    const toAdd = rows.filter(r => r.name && !existingNames.has(r.name));
    if (toAdd.length === 0) return 0;
    const batch = writeBatch(db);
    toAdd.forEach(r => {
      const ref = doc(collection(db, 'routes'));
      batch.set(ref, r);
    });
    await batch.commit();
    return toAdd.length;
  },

  // ===== FARE TABLE METHODS (Option 2: explicit fare between any two stops) =====

  /** Look up the fare for a (fromStop → toStop) pair on a given route. */
  getFare: (params: GetFareParams) => _getFareForStops(params),

  /**
   * Admin utility: create or overwrite a fare entry.
   * Returns the Firestore document ID ("fromStopId_toStopId").
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
  ) => _upsertFare(routeId, fromStopId, toStopId, price, agentPrice, currency, startDate, endDate, sortOrder),

  /** Fetch all fares for a route (one-time read). */
  getRouteFares: async (routeId: string): Promise<RouteFare[]> => {
    if (!db) return [];
    const snap = await getDocs(collection(db, 'routeFares', routeId, 'fares'));
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<RouteFare, 'id'>) }));
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
    });
  },

  /** Delete a fare entry. */
  deleteFare: async (routeId: string, fareDocId: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'routeFares', routeId, 'fares', fareDocId));
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

  // Import vehicles from Excel data (skips duplicates by licensePlate)
  importVehicles: async (rows: Omit<Vehicle, 'id' | 'stt' | 'ownerId' | 'layout'>[]) => {
    if (!db) throw new Error('Firebase not configured');
    const existing = await getDocs(collection(db, 'vehicles'));
    const existingPlates = new Set(existing.docs.map(d => (d.data() as Vehicle).licensePlate));
    const toAdd = rows.filter(r => r.licensePlate && !existingPlates.has(r.licensePlate));
    if (toAdd.length === 0) return 0;
    const batch = writeBatch(db);
    toAdd.forEach(r => {
      const ref = doc(collection(db, 'vehicles'));
      batch.set(ref, { ...r, status: 'ACTIVE' });
    });
    await batch.commit();
    return toAdd.length;
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
    const q = query(collection(db, 'employees'), orderBy('name', 'asc'));
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
    return await addDoc(collection(db, 'employees'), employee);
  },

  // Update employee
  updateEmployee: async (employeeId: string, updates: Partial<Employee>) => {
    if (!db) return;
    const ref = doc(db, 'employees', employeeId);
    await updateDoc(ref, updates as Record<string, unknown>);
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
    return await addDoc(collection(db, 'trips'), trip);
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
    await updateDoc(ref, updates as Record<string, unknown>);
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
    });
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
    const q = query(collection(db, 'customers'), orderBy('registeredAt', 'desc'));
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
    if (!db) return;
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

  // ─── Driver Assignments ────────────────────────────────────────────────────

  subscribeToDriverAssignments: (callback: (assignments: DriverAssignment[]) => void) => {
    if (!db) return () => {};
    const q = query(collection(db, 'driverAssignments'), orderBy('assignedAt', 'desc'));
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
};
