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
  query, 
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Trip, Consignment, SeatStatus, Seat, Agent, Route, Vehicle, Stop, Invoice, TripAddon, RouteFare } from '../types';
import { getFareForStops as _getFareForStops, upsertFare as _upsertFare, type GetFareParams } from './fareService';

interface TourData {
  title: string;
  description: string;
  price: number;
  imageUrl: string;
  discountPercent?: number;
  priceAdult?: number;
  priceChild?: number;
  duration?: string;      // e.g., "3 ngày 2 đêm"
  nights?: number;        // number of overnight stays
  pricePerNight?: number; // accommodation cost per person per night
  breakfastCount?: number;    // total breakfast meals included per person
  pricePerBreakfast?: number; // price per breakfast per person
  itinerary?: { day: number; content: string }[];
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

  // Update seat status
  bookSeat: async (tripId: string, seatId: string, bookingData: Partial<Seat>) => {
    if (!db) return;
    const tripRef = doc(db, 'trips', tripId);
    const tripSnap = await getDoc(tripRef);
    if (!tripSnap.exists()) return;
    const tripData = tripSnap.data();
    const seats = tripData.seats || [];
    const updatedSeats = seats.map((seat: Seat) =>
      seat.id === seatId ? { ...seat, ...bookingData } : seat
    );
    await updateDoc(tripRef, { seats: updatedSeats });
  },

  // Listen to consignments
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

  // Create a new booking
  createBooking: async (booking: any) => {
    if (!db) {
      // If Firebase is not configured or offline, save to local storage
      const offlineBookings = JSON.parse(localStorage.getItem('offline_bookings') || '[]');
      offlineBookings.push({ ...booking, id: `offline_${Date.now()}`, createdAt: new Date().toISOString() });
      localStorage.setItem('offline_bookings', JSON.stringify(offlineBookings));
      return { id: 'offline', status: 'saved_locally' };
    }

    try {
      const docRef = await addDoc(collection(db, 'bookings'), {
        ...booking,
        createdAt: Timestamp.now()
      });
      return { id: docRef.id, status: 'saved_cloud' };
    } catch (error) {
      console.error('Error saving to Firebase, falling back to local storage:', error);
      const offlineBookings = JSON.parse(localStorage.getItem('offline_bookings') || '[]');
      offlineBookings.push({ ...booking, id: `offline_${Date.now()}`, createdAt: new Date().toISOString() });
      localStorage.setItem('offline_bookings', JSON.stringify(offlineBookings));
      return { id: 'offline', status: 'saved_locally' };
    }
  },

  // Delete a booking
  deleteBooking: async (bookingId: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'bookings', bookingId));
  },

  // Update a booking
  updateBooking: async (bookingId: string, updates: any) => {
    if (!db) return;
    const { id, ...data } = updates;
    const bookingRef = doc(db, 'bookings', bookingId);
    await updateDoc(bookingRef, data as Record<string, unknown>);
  },

  // Sync offline bookings to cloud
  syncOfflineBookings: async () => {
    if (!db) return;
    const offlineBookings = JSON.parse(localStorage.getItem('offline_bookings') || '[]');
    if (offlineBookings.length === 0) return;

    console.log(`Syncing ${offlineBookings.length} offline bookings...`);
    const remainingBookings = [];

    for (const booking of offlineBookings) {
      try {
        const { id, ...bookingData } = booking;
        await addDoc(collection(db, 'bookings'), {
          ...bookingData,
          syncedAt: Timestamp.now()
        });
      } catch (error) {
        console.error('Failed to sync booking:', booking.id, error);
        remainingBookings.push(booking);
      }
    }

    localStorage.setItem('offline_bookings', JSON.stringify(remainingBookings));
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
    return await addDoc(collection(db, 'invoices'), {
      ...invoice,
      createdAt: Timestamp.now()
    });
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
    return await addDoc(collection(db, 'routes'), route);
  },

  // Update route
  updateRoute: async (routeId: string, updates: Partial<Route>) => {
    if (!db) return;
    const ref = doc(db, 'routes', routeId);
    await updateDoc(ref, updates as Record<string, unknown>);
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
    currency = 'VND',
  ) => _upsertFare(routeId, fromStopId, toStopId, price, currency),

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
      callback(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<RouteFare, 'id'>) })));
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
};
