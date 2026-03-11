import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  deleteDoc,
  setDoc,
  query, 
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Trip, Consignment, SeatStatus, Seat, Agent, Route, Vehicle, Stop } from '../types';

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
    // In a real app, you'd fetch the trip, update the seats array, and save it back
    // For simplicity in this demo, we assume the structure is manageable
    // Note: In production, consider a sub-collection for seats if there are many
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
  }
};
