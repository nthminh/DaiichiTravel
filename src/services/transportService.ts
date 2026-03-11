import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  query, 
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Trip, Consignment, SeatStatus, Seat } from '../types';

export const transportService = {
  // Listen to all trips for today
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
