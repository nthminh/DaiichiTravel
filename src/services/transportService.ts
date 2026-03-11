import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  deleteDoc,
  getDoc,
  setDoc,
  query, 
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Trip, Consignment, SeatStatus, Seat, Agent, Route, Vehicle, Stop, Invoice } from '../types';

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
    const q = query(collection(db, 'consignments'), orderBy('id', 'desc'));
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
};
