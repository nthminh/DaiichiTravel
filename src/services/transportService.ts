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
import { Trip, Consignment, SeatStatus, Seat, Agent, Route, Vehicle, Stop } from '../types';

// ---------------------------------------------------------------------------
// Offline queue
// Every write that cannot reach Firebase immediately is queued here with a
// timestamp so that newer items are always synced first.
// ---------------------------------------------------------------------------

type OperationType = 'add' | 'update' | 'delete' | 'bookSeat';

interface PendingOperation {
  id: string;           // unique queue entry id
  type: OperationType;
  collection: string;
  docId?: string;       // for update / delete
  data?: Record<string, unknown>;
  /** ISO string – used to sort newest-first on sync */
  enqueuedAt: string;
}

const QUEUE_KEY = 'offline_operation_queue';
// Keep backward-compatibility with the old bookings-only key
const LEGACY_BOOKINGS_KEY = 'offline_bookings';

function loadQueue(): PendingOperation[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveQueue(queue: PendingOperation[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function enqueue(op: Omit<PendingOperation, 'id' | 'enqueuedAt'>): void {
  const queue = loadQueue();
  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `op_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  queue.push({ ...op, id, enqueuedAt: new Date().toISOString() });
  saveQueue(queue);
}

// ---------------------------------------------------------------------------
// Network online/offline listeners – auto-sync when back online
// ---------------------------------------------------------------------------

let _syncScheduled = false;

function scheduleSync(): void {
  if (_syncScheduled || !db) return;
  _syncScheduled = true;
  setTimeout(async () => {
    _syncScheduled = false;
    await transportService.syncPendingOperations();
  }, 500);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', scheduleSync);
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

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
    if (!db) {
      enqueue({ type: 'bookSeat', collection: 'trips', docId: tripId, data: { seatId, ...bookingData } });
      return;
    }
    try {
      const tripRef = doc(db, 'trips', tripId);
      const tripSnap = await getDoc(tripRef);
      if (!tripSnap.exists()) return;
      const tripData = tripSnap.data();
      const seats = tripData.seats || [];
      const updatedSeats = seats.map((seat: Seat) =>
        seat.id === seatId ? { ...seat, ...bookingData } : seat
      );
      await updateDoc(tripRef, { seats: updatedSeats });
    } catch (error) {
      console.error('bookSeat failed, queuing for later sync:', error);
      enqueue({ type: 'bookSeat', collection: 'trips', docId: tripId, data: { seatId, ...bookingData } });
    }
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
    if (!db) {
      enqueue({ type: 'add', collection: 'consignments', data: { ...consignment as unknown as Record<string, unknown>, createdAt: new Date().toISOString() } });
      throw new Error('Firebase not configured – consignment queued for sync');
    }
    try {
      return await addDoc(collection(db, 'consignments'), {
        ...consignment,
        createdAt: Timestamp.now()
      });
    } catch (error) {
      console.error('addConsignment failed, queuing for later sync:', error);
      enqueue({ type: 'add', collection: 'consignments', data: { ...consignment as unknown as Record<string, unknown>, createdAt: new Date().toISOString() } });
      throw error;
    }
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
    if (!db) {
      enqueue({ type: 'update', collection: 'agents', docId: agentId, data: updates as Record<string, unknown> });
      return;
    }
    try {
      const agentRef = doc(db, 'agents', agentId);
      await updateDoc(agentRef, updates as Record<string, unknown>);
    } catch (error) {
      console.error('updateAgent failed, queuing for later sync:', error);
      enqueue({ type: 'update', collection: 'agents', docId: agentId, data: updates as Record<string, unknown> });
    }
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
    if (!db) {
      enqueue({ type: 'add', collection: 'stops', data: stop as unknown as Record<string, unknown> });
      return;
    }
    try {
      return await addDoc(collection(db, 'stops'), stop);
    } catch (error) {
      console.error('addStop failed, queuing for later sync:', error);
      enqueue({ type: 'add', collection: 'stops', data: stop as unknown as Record<string, unknown> });
    }
  },

  // Update stop
  updateStop: async (stopId: string, updates: Partial<Stop>) => {
    if (!db) {
      enqueue({ type: 'update', collection: 'stops', docId: stopId, data: updates as Record<string, unknown> });
      return;
    }
    try {
      const stopRef = doc(db, 'stops', stopId);
      await updateDoc(stopRef, updates as Record<string, unknown>);
    } catch (error) {
      console.error('updateStop failed, queuing for later sync:', error);
      enqueue({ type: 'update', collection: 'stops', docId: stopId, data: updates as Record<string, unknown> });
    }
  },

  // Delete stop
  deleteStop: async (stopId: string) => {
    if (!db) {
      enqueue({ type: 'delete', collection: 'stops', docId: stopId });
      return;
    }
    try {
      await deleteDoc(doc(db, 'stops', stopId));
    } catch (error) {
      console.error('deleteStop failed, queuing for later sync:', error);
      enqueue({ type: 'delete', collection: 'stops', docId: stopId });
    }
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
      enqueue({ type: 'add', collection: 'bookings', data: { ...booking, createdAt: new Date().toISOString() } });
      return { id: 'offline', status: 'saved_locally' };
    }

    try {
      const docRef = await addDoc(collection(db, 'bookings'), {
        ...booking,
        createdAt: Timestamp.now()
      });
      return { id: docRef.id, status: 'saved_cloud' };
    } catch (error) {
      console.error('createBooking failed, queuing for later sync:', error);
      enqueue({ type: 'add', collection: 'bookings', data: { ...booking, createdAt: new Date().toISOString() } });
      return { id: 'offline', status: 'saved_locally' };
    }
  },

  // Delete a booking
  deleteBooking: async (bookingId: string) => {
    if (!db) {
      enqueue({ type: 'delete', collection: 'bookings', docId: bookingId });
      return;
    }
    try {
      await deleteDoc(doc(db, 'bookings', bookingId));
    } catch (error) {
      console.error('deleteBooking failed, queuing for later sync:', error);
      enqueue({ type: 'delete', collection: 'bookings', docId: bookingId });
    }
  },

  // Update a booking
  updateBooking: async (bookingId: string, updates: any) => {
    if (!db) {
      const { id, ...data } = updates;
      enqueue({ type: 'update', collection: 'bookings', docId: bookingId, data });
      return;
    }
    try {
      const { id, ...data } = updates;
      const bookingRef = doc(db, 'bookings', bookingId);
      await updateDoc(bookingRef, data as Record<string, unknown>);
    } catch (error) {
      console.error('updateBooking failed, queuing for later sync:', error);
      const { id, ...data } = updates;
      enqueue({ type: 'update', collection: 'bookings', docId: bookingId, data });
    }
  },

  // ---------------------------------------------------------------------------
  // Sync all pending operations to Firebase.
  // Items are processed newest-first so the most recent state always wins.
  // Also migrates any legacy offline_bookings entries from the old queue.
  // ---------------------------------------------------------------------------
  syncPendingOperations: async () => {
    if (!db) return;

    // Migrate legacy offline_bookings key
    const legacyRaw = localStorage.getItem(LEGACY_BOOKINGS_KEY);
    if (legacyRaw) {
      try {
        const legacy: any[] = JSON.parse(legacyRaw);
        legacy.forEach(b => {
          const { id, ...bookingData } = b;
          enqueue({ type: 'add', collection: 'bookings', data: { ...bookingData, migratedFromLegacy: true } });
        });
        localStorage.removeItem(LEGACY_BOOKINGS_KEY);
      } catch {
        localStorage.removeItem(LEGACY_BOOKINGS_KEY);
      }
    }

    let queue = loadQueue();
    if (queue.length === 0) return;

    // Sort oldest-first so the most recent operations are applied last and win
    // in case of conflicts on the same document (newest state always prevails).
    queue.sort((a, b) => new Date(a.enqueuedAt).getTime() - new Date(b.enqueuedAt).getTime());

    console.log(`Syncing ${queue.length} pending operation(s)...`);
    const failed: PendingOperation[] = [];

    for (const op of queue) {
      try {
        if (op.type === 'add') {
          await addDoc(collection(db, op.collection), {
            ...op.data,
            syncedAt: Timestamp.now()
          });
        } else if (op.type === 'update' && op.docId) {
          await updateDoc(doc(db, op.collection, op.docId), {
            ...(op.data || {}),
            syncedAt: Timestamp.now()
          });
        } else if (op.type === 'delete' && op.docId) {
          await deleteDoc(doc(db, op.collection, op.docId));
        } else if (op.type === 'bookSeat' && op.docId && op.data) {
          const { seatId, ...seatUpdates } = op.data as { seatId: string } & Partial<Seat>;
          const tripRef = doc(db, op.collection, op.docId);
          const tripSnap = await getDoc(tripRef);
          if (tripSnap.exists()) {
            const seats = (tripSnap.data().seats || []) as Seat[];
            const updatedSeats = seats.map((s: Seat) =>
              s.id === seatId ? { ...s, ...seatUpdates } : s
            );
            await updateDoc(tripRef, { seats: updatedSeats, syncedAt: Timestamp.now() });
          }
        }
        console.log(`Synced operation ${op.id} (${op.type} on ${op.collection})`);
      } catch (error) {
        console.error(`Failed to sync operation ${op.id}:`, error);
        failed.push(op);
      }
    }

    saveQueue(failed);
    if (failed.length === 0) {
      console.log('All pending operations synced successfully.');
    } else {
      console.warn(`${failed.length} operation(s) remain in the queue after sync.`);
    }
  },

  /** @deprecated Use syncPendingOperations instead. Will be removed in a future release. */
  syncOfflineBookings: async () => {
    console.warn('syncOfflineBookings is deprecated. Use syncPendingOperations instead.');
    return transportService.syncPendingOperations();
  },

  /** Returns the number of operations waiting to be synced */
  getPendingCount: (): number => loadQueue().length,
};
