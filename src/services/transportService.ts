/**
 * transportService – all data access operations, rewritten for Supabase.
 *
 * Replaces the former Firebase Firestore implementation.
 * All Firestore "collection" operations map to Supabase table operations.
 * Former Firestore subcollections are now flat tables with FK columns.
 *
 * camelCase ↔ snake_case conversion is done via toSnakeCaseObj / toCamelCaseObj
 * from src/lib/supabase.ts.  JSONB columns (seats, addons, layout, etc.) are
 * stored as camelCase JS objects and returned as-is.
 */

import { supabase, toSnakeCaseObj, toCamelCaseObj, isSupabaseConfigured } from '../lib/supabase';
import {
  Trip, Booking, Consignment, SeatStatus, Seat, SegmentBooking,
  Agent, Route, Vehicle, Stop, Invoice, TripAddon, RouteFare, RouteSeatFare,
  Employee, UserGuide, CustomerProfile, DriverAssignment, StaffMessage,
  VehicleType, CustomerCategory, CategoryVerificationRequest, AuditLog,
  PendingPayment, Property, PropertyRoomType,
} from '../types';
import {
  getFareForStops as _getFareForStops,
  upsertFare as _upsertFare,
  buildSeatFareDocId,
  type GetFareParams,
} from './fareService';

// ─── internal types ──────────────────────────────────────────────────────────

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
  images?: string[];
  discountPercent?: number;
  priceAdult?: number;
  priceChild?: number;
  numAdults?: number;
  numChildren?: number;
  duration?: string;
  nights?: number;
  pricePerNight?: number;
  breakfastCount?: number;
  pricePerBreakfast?: number;
  surcharge?: number;
  surchargeNote?: string;
  youtubeUrl?: string;
  startDate?: string;
  endDate?: string;
  departureTime?: string;
  departureLocation?: string;
  returnTime?: string;
  returnLocation?: string;
  roomTypes?: TourRoomTypeData[];
  itinerary?: { day: number; content: string }[];
  addons?: { id: string; name: string; price: number; description?: string }[];
  linkedPropertyId?: string;
  childPricingRules?: unknown[];
}

// ─── helpers ─────────────────────────────────────────────────────────────────

export const DEFAULT_VEHICLE_TYPES = ['Ghế ngồi', 'Ghế ngồi limousine', 'Giường nằm', 'Phòng VIP (cabin)'];

/**
 * Generic realtime subscription helper.
 * 1. Does an initial fetch and calls callback.
 * 2. Subscribes to Supabase Realtime for any changes on the table.
 * 3. On each change, re-fetches and calls callback again.
 * Returns an unsubscribe function.
 */
function createSubscription<T>(
  table: string,
  fetchFn: () => Promise<T[]>,
  callback: (data: T[]) => void,
  filter?: string,
): () => void {
  if (!isSupabaseConfigured || !supabase) return () => {};

  fetchFn()
    .then(callback)
    .catch((err) => {
      console.error(`[${table}] initial fetch error:`, err);
      callback([]);
    });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelConfig: any = { event: '*', schema: 'public', table };
  if (filter) channelConfig.filter = filter;

  const channel = supabase
    .channel(`${table}_${Date.now()}`)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .on('postgres_changes' as any, channelConfig, () => {
      fetchFn()
        .then(callback)
        .catch((err) => console.error(`[${table}] realtime fetch error:`, err));
    })
    .subscribe();

  return () => {
    supabase?.removeChannel(channel);
  };
}

function fromDb<T>(row: Record<string, unknown>): T {
  return toCamelCaseObj<T>(row);
}

function toDb(obj: Record<string, unknown>): Record<string, unknown> {
  return toSnakeCaseObj(obj);
}

// ─── service ─────────────────────────────────────────────────────────────────

export const transportService = {

  // ─── Trips ────────────────────────────────────────────────────────────────

  subscribeToTrips: (callback: (trips: Trip[]) => void) => {
    const fetch = async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .order('date', { ascending: false })
        .order('time', { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data || []).map((r) => fromDb<Trip>(r));
    };
    return createSubscription('trips', fetch, callback);
  },

  loadAllTripsBatched: async (
    onBatch: (trips: Trip[]) => void,
    batchSize = 500,
    signal?: { aborted: boolean },
    filters?: {
      route?: string;
      date?: string;
      dateFrom?: string;
      dateTo?: string;
      time?: string;
      licensePlate?: string;
      driverName?: string;
    },
  ): Promise<void> => {
    if (!isSupabaseConfigured || !supabase) return;
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      if (signal?.aborted) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase
        .from('trips')
        .select('*')
        .order('date', { ascending: false })
        .range(offset, offset + batchSize - 1);
      if (filters?.route) q = q.eq('route', filters.route);
      if (filters?.date) {
        q = q.eq('date', filters.date);
      } else {
        if (filters?.dateFrom) q = q.gte('date', filters.dateFrom);
        if (filters?.dateTo) q = q.lte('date', filters.dateTo);
      }
      if (filters?.time) q = q.eq('time', filters.time);
      if (filters?.licensePlate) q = q.eq('license_plate', filters.licensePlate);
      if (filters?.driverName) q = q.eq('driver_name', filters.driverName);
      const { data, error } = await q;
      if (error) { console.error('[loadAllTripsBatched]', error); break; }
      if (!data || data.length === 0) break;
      onBatch(data.map((r: Record<string, unknown>) => fromDb<Trip>(r)));
      hasMore = data.length === batchSize;
      offset += data.length;
    }
  },

  bookSeat: async (tripId: string, seatId: string, bookingData: Partial<Seat>) => {
    if (!isSupabaseConfigured || !supabase) return;
    const { data: row } = await supabase.from('trips').select('seats').eq('id', tripId).single();
    if (!row) return;
    const seats = (row.seats || []) as Seat[];
    const updatedSeats = seats.map((seat: Seat) => {
      if (seat.id !== seatId) return seat;
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
    await supabase
      .from('trips')
      .update({ seats: updatedSeats, updated_at: new Date().toISOString() })
      .eq('id', tripId);
  },

  bookSeats: async (tripId: string, seatIds: string[], bookingData: Partial<Seat>) => {
    if (!isSupabaseConfigured || !supabase) return;
    const { data: row } = await supabase.from('trips').select('seats').eq('id', tripId).single();
    if (!row) return;
    const seats = (row.seats || []) as Seat[];
    const updatedSeats = seats.map((seat: Seat) => {
      if (!seatIds.includes(seat.id)) return seat;
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
        const hasExistingSegmentBooking =
          existingSegments.length > 0 ||
          (seat.fromStopOrder !== undefined && seat.toStopOrder !== undefined);
        if (hasExistingSegmentBooking) {
          let segments = existingSegments;
          if (
            existingSegments.length === 0 &&
            seat.fromStopOrder !== undefined &&
            seat.toStopOrder !== undefined
          ) {
            segments = [
              {
                fromStopOrder: seat.fromStopOrder,
                toStopOrder: seat.toStopOrder,
                ...(seat.customerName ? { customerName: seat.customerName } : {}),
                ...(seat.customerPhone ? { customerPhone: seat.customerPhone } : {}),
                ...(seat.pickupPoint ? { pickupPoint: seat.pickupPoint } : {}),
                ...(seat.dropoffPoint ? { dropoffPoint: seat.dropoffPoint } : {}),
                ...(seat.bookingNote ? { bookingNote: seat.bookingNote } : {}),
              },
            ];
          }
          return { ...seat, status: SeatStatus.BOOKED, segmentBookings: [...segments, newEntry] };
        }
        return { ...seat, ...bookingData, segmentBookings: [newEntry] };
      }
      return { ...seat, ...bookingData };
    });
    await supabase
      .from('trips')
      .update({ seats: updatedSeats, updated_at: new Date().toISOString() })
      .eq('id', tripId);
  },

  releaseSeats: async (
    tripId: string,
    seatIds: string[],
    segmentInfo?: { fromStopOrder: number; toStopOrder: number },
  ) => {
    if (!isSupabaseConfigured || !supabase) return;
    const { data: row } = await supabase.from('trips').select('seats').eq('id', tripId).single();
    if (!row) return;
    const seats = (row.seats || []) as Seat[];
    const updatedSeats = seats.map((seat: Seat) => {
      if (!seatIds.includes(seat.id)) return seat;
      if (segmentInfo) {
        const remaining = (seat.segmentBookings ?? []).filter(
          (s) =>
            !(
              s.fromStopOrder === segmentInfo.fromStopOrder &&
              s.toStopOrder === segmentInfo.toStopOrder
            ),
        );
        if (remaining.length > 0) return { ...seat, segmentBookings: remaining };
        return { id: seat.id, status: SeatStatus.EMPTY };
      }
      return { id: seat.id, status: SeatStatus.EMPTY };
    });
    await supabase
      .from('trips')
      .update({ seats: updatedSeats, updated_at: new Date().toISOString() })
      .eq('id', tripId);
  },

  toggleSeatLock: async (tripId: string, seatIds: string[], lock: boolean) => {
    if (!isSupabaseConfigured || !supabase) return;
    const { data: row } = await supabase.from('trips').select('seats').eq('id', tripId).single();
    if (!row) return;
    const seats = (row.seats || []) as Seat[];
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
    await supabase
      .from('trips')
      .update({ seats: updatedSeats, updated_at: new Date().toISOString() })
      .eq('id', tripId);
  },

  // ─── Consignments ─────────────────────────────────────────────────────────

  subscribeToConsignments: (callback: (consignments: Consignment[]) => void) => {
    const fetch = async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('consignments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []).map((r) => fromDb<Consignment>(r));
    };
    return createSubscription('consignments', fetch, callback);
  },

  addConsignment: async (consignment: Omit<Consignment, 'id'>) => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('consignments')
      .insert(toDb({ ...consignment, createdAt: new Date().toISOString() } as Record<string, unknown>))
      .select()
      .single();
    if (error) throw error;
    return { id: data.id };
  },

  updateConsignment: async (
    consignmentId: string,
    updates: Omit<Partial<Consignment>, 'id'>,
  ) => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    await supabase
      .from('consignments')
      .update(toDb(updates as Record<string, unknown>))
      .eq('id', consignmentId);
  },

  deleteConsignment: async (consignmentId: string) => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    await supabase.from('consignments').delete().eq('id', consignmentId);
  },

  // ─── Agents ───────────────────────────────────────────────────────────────

  subscribeToAgents: (callback: (agents: Agent[]) => void) => {
    const fetch = async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []).map((r) => fromDb<Agent>(r));
    };
    return createSubscription('agents', fetch, callback);
  },

  updateAgent: async (agentId: string, updates: Partial<Agent>) => {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase
      .from('agents')
      .update(toDb({ ...updates, updatedAt: new Date().toISOString() } as Record<string, unknown>))
      .eq('id', agentId);
  },

  addAgent: async (agent: Omit<Agent, 'id'>) => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('agents')
      .insert(toDb({ ...agent, updatedAt: new Date().toISOString() } as Record<string, unknown>))
      .select()
      .single();
    if (error) throw error;
    return { id: data.id };
  },

  deleteAgent: async (agentId: string) => {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('agents').delete().eq('id', agentId);
  },

  // ─── Routes ───────────────────────────────────────────────────────────────

  subscribeToRoutes: (callback: (routes: Route[]) => void) => {
    const fetch = async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('routes')
        .select('*')
        .order('stt', { ascending: true });
      if (error) throw error;
      return (data || []).map((r) => fromDb<Route>(r));
    };
    return createSubscription('routes', fetch, callback);
  },

  addRoute: async (route: Omit<Route, 'id'>) => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('routes')
      .insert(toDb({ ...route, updatedAt: new Date().toISOString() } as Record<string, unknown>))
      .select()
      .single();
    if (error) throw error;
    return { id: data.id };
  },

  updateRoute: async (routeId: string, updates: Partial<Route>) => {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase
      .from('routes')
      .update(toDb({ ...updates, updatedAt: new Date().toISOString() } as Record<string, unknown>))
      .eq('id', routeId);
  },

  deleteRoute: async (routeId: string) => {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('route_fares').delete().eq('route_id', routeId);
    await supabase.from('route_seat_fares').delete().eq('route_id', routeId);
    await supabase.from('routes').delete().eq('id', routeId);
  },

  // ─── Vehicles ─────────────────────────────────────────────────────────────

  subscribeToVehicles: (callback: (vehicles: Vehicle[]) => void) => {
    const fetch = async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .order('license_plate', { ascending: true });
      if (error) throw error;
      return (data || []).map((r) => fromDb<Vehicle>(r));
    };
    return createSubscription('vehicles', fetch, callback);
  },

  addVehicle: async (vehicle: Record<string, unknown>) => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('vehicles')
      .insert(toDb(vehicle))
      .select()
      .single();
    if (error) throw error;
    return { id: data.id };
  },

  updateVehicle: async (vehicleId: string, updates: Record<string, unknown>) => {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('vehicles').update(toDb(updates)).eq('id', vehicleId);
  },

  deleteVehicle: async (vehicleId: string) => {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('vehicles').delete().eq('id', vehicleId);
  },

  // ─── Stops ────────────────────────────────────────────────────────────────

  subscribeToStops: (callback: (stops: Stop[]) => void) => {
    const fetch = async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('stops')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []).map((r) => fromDb<Stop>(r));
    };
    return createSubscription('stops', fetch, callback);
  },

  addStop: async (stop: Omit<Stop, 'id'>) => {
    if (!isSupabaseConfigured || !supabase) return;
    const { data, error } = await supabase
      .from('stops')
      .insert(toDb(stop as Record<string, unknown>))
      .select()
      .single();
    if (error) throw error;
    return { id: (data as { id: string }).id };
  },

  updateStop: async (stopId: string, updates: Partial<Stop>) => {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase
      .from('stops')
      .update(toDb(updates as Record<string, unknown>))
      .eq('id', stopId);
  },

  deleteStop: async (stopId: string) => {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('stops').delete().eq('id', stopId);
  },

  // ─── Bookings ─────────────────────────────────────────────────────────────

  subscribeToBookings: (callback: (bookings: Booking[]) => void) => {
    const fetch = async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []).map((r) => fromDb<Booking>(r));
    };
    return createSubscription('bookings', fetch, callback);
  },

  generateTicketCode: (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const timePart = Date.now().toString(36).toUpperCase().slice(-2);
    let randomPart = '';
    for (let i = 0; i < 6; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `DT-${randomPart}${timePart}`;
  },

  createBooking: async (booking: Record<string, unknown>) => {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Không thể kết nối đến Supabase. Vui lòng kiểm tra cấu hình.');
    }
    const ticketCode = transportService.generateTicketCode();
    const { data, error } = await supabase
      .from('bookings')
      .insert(toDb({ ...booking, ticketCode, createdAt: new Date().toISOString() }))
      .select()
      .single();
    if (error) throw error;
    return { id: data.id, ticketCode, status: 'saved_cloud' };
  },

  deleteBooking: async (bookingId: string) => {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('bookings').delete().eq('id', bookingId);
  },

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
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('inquiries')
      .insert(toDb({ ...inquiry, status: 'PENDING', createdAt: new Date().toISOString() }))
      .select()
      .single();
    if (error) throw error;
    return { id: data.id };
  },

  updateBooking: async (bookingId: string, updates: Record<string, unknown>) => {
    if (!isSupabaseConfigured || !supabase) return;
    const { id: _, ...data } = updates;
    await supabase.from('bookings').update(toDb(data as Record<string, unknown>)).eq('id', bookingId);
  },

  // ─── Invoices ─────────────────────────────────────────────────────────────

  subscribeToInvoices: (callback: (invoices: Invoice[]) => void) => {
    const fetch = async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []).map((r) => fromDb<Invoice>(r));
    };
    return createSubscription('invoices', fetch, callback);
  },

  createInvoice: async (invoice: Omit<Invoice, 'id'>) => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('invoices')
      .insert(toDb({ ...invoice, createdAt: new Date().toISOString() } as Record<string, unknown>))
      .select()
      .single();
    if (error) throw error;
    return { id: data.id };
  },

  updateInvoice: async (invoiceId: string, updates: Partial<Invoice>) => {
    if (!isSupabaseConfigured || !supabase) return;
    const { id: _, ...data } = updates as Record<string, unknown>;
    await supabase.from('invoices').update(toDb(data)).eq('id', invoiceId);
  },

  deleteInvoice: async (invoiceId: string) => {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('invoices').delete().eq('id', invoiceId);
  },

  // ─── Tours ────────────────────────────────────────────────────────────────

  subscribeToTours: (callback: (tours: (TourData & { id: string })[]) => void) => {
    const fetch = async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('tours')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []).map((r) => fromDb<TourData & { id: string }>(r));
    };
    return createSubscription('tours', fetch, callback);
  },

  addTour: async (tour: TourData) => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('tours')
      .insert(toDb({ ...tour, createdAt: new Date().toISOString() } as Record<string, unknown>))
      .select()
      .single();
    if (error) throw error;
    return { id: data.id };
  },

  deleteTour: async (tourId: string) => {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('tours').delete().eq('id', tourId);
  },

  updateTour: async (
    tourId: string,
    updates: Partial<TourData & { discountPercent?: number }>,
  ) => {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('tours').update(toDb(updates as Record<string, unknown>)).eq('id', tourId);
  },

  addToursBatch: async (tours: TourData[]) => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    const rows = tours.map((t) =>
      toDb({ ...t, createdAt: new Date().toISOString() } as Record<string, unknown>),
    );
    const { data, error } = await supabase.from('tours').insert(rows).select();
    if (error) throw error;
    return (data || []).map((r: { id: string }) => ({ id: r.id }));
  },

  // ─── Property Room Types ──────────────────────────────────────────────────

  getPropertyRoomTypes: async (propertyId: string): Promise<PropertyRoomType[]> => {
    if (!isSupabaseConfigured || !supabase) return [];
    const { data } = await supabase
      .from('property_room_types')
      .select('*')
      .eq('property_id', propertyId)
      .order('name', { ascending: true });
    return (data || []).map((r) => fromDb<PropertyRoomType>(r));
  },

  getTourRoomBookingCounts: async (
    tourId: string,
    date: string,
  ): Promise<Record<string, number>> => {
    if (!isSupabaseConfigured || !supabase) return {};
    const { data } = await supabase
      .from('bookings')
      .select('selected_room_type_id')
      .eq('tour_id', tourId)
      .eq('date', date)
      .neq('status', 'CANCELLED');
    const counts: Record<string, number> = {};
    (data || []).forEach((d: { selected_room_type_id?: string }) => {
      if (d.selected_room_type_id) {
        counts[d.selected_room_type_id] = (counts[d.selected_room_type_id] ?? 0) + 1;
      }
    });
    return counts;
  },

  subscribeTourRoomBookingCounts: (
    tourId: string,
    date: string,
    callback: (counts: Record<string, number>) => void,
  ) => {
    if (!isSupabaseConfigured || !supabase) return () => {};
    const fetchCounts = async () => {
      const { data } = await supabase!
        .from('bookings')
        .select('selected_room_type_id')
        .eq('tour_id', tourId)
        .eq('date', date)
        .neq('status', 'CANCELLED');
      const counts: Record<string, number> = {};
      (data || []).forEach((d: { selected_room_type_id?: string }) => {
        if (d.selected_room_type_id) {
          counts[d.selected_room_type_id] = (counts[d.selected_room_type_id] ?? 0) + 1;
        }
      });
      return counts;
    };
    fetchCounts().then(callback);
    const channel = supabase
      .channel(`tour_bookings_${tourId}_${date}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'bookings' }, () => {
        fetchCounts().then(callback);
      })
      .subscribe();
    return () => supabase?.removeChannel(channel);
  },

  getMultipleTourRoomBookingCounts: async (
    pairs: { tourId: string; date: string }[],
  ): Promise<Record<string, Record<string, number>>> => {
    if (!isSupabaseConfigured || !supabase || pairs.length === 0) return {};
    const results = await Promise.all(
      pairs.map(async ({ tourId, date }) => {
        const counts = await transportService.getTourRoomBookingCounts(tourId, date);
        return { tourId, date, counts };
      }),
    );
    const out: Record<string, Record<string, number>> = {};
    results.forEach(({ tourId, date, counts }) => {
      out[`${tourId}_${date}`] = counts;
    });
    return out;
  },

  getTourBookings: async (tourId: string): Promise<Booking[]> => {
    if (!isSupabaseConfigured || !supabase) return [];
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .eq('tour_id', tourId)
      .neq('status', 'CANCELLED')
      .order('created_at', { ascending: false });
    return (data || []).map((r) => fromDb<Booking>(r));
  },

  // ─── Settings ─────────────────────────────────────────────────────────────

  getPermissions: async (): Promise<Record<string, Record<string, boolean>> | null> => {
    if (!isSupabaseConfigured || !supabase) return null;
    try {
      const { data } = await supabase
        .from('settings').select('value').eq('id', 'permissions').single();
      return (data?.value as Record<string, Record<string, boolean>>) ?? null;
    } catch { return null; }
  },

  savePermissions: async (permissions: Record<string, Record<string, boolean>>) => {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('settings')
      .upsert({ id: 'permissions', value: permissions, updated_at: new Date().toISOString() });
  },

  subscribeToPermissions: (
    callback: (perms: Record<string, Record<string, boolean>> | null) => void,
  ) => {
    if (!isSupabaseConfigured || !supabase) return () => {};
    void Promise.resolve(supabase.from('settings').select('value').eq('id', 'permissions').single())
      .then(({ data }) => callback((data?.value as Record<string, Record<string, boolean>>) ?? null))
      .catch(() => callback(null));
    const channel = supabase.channel('settings_permissions')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('postgres_changes' as any, {
        event: '*', schema: 'public', table: 'settings', filter: 'id=eq.permissions',
      }, (payload: { new?: { value?: unknown } }) => {
        callback((payload.new?.value as Record<string, Record<string, boolean>>) ?? null);
      }).subscribe();
    return () => supabase?.removeChannel(channel);
  },

  getAdminSettings: async (): Promise<{ username: string; password: string } | null> => {
    if (!isSupabaseConfigured || !supabase) return null;
    try {
      const { data } = await supabase.from('settings').select('value').eq('id', 'adminConfig').single();
      const v = data?.value as { username?: string; password?: string } | null;
      return v && typeof v.username === 'string' && typeof v.password === 'string'
        ? { username: v.username, password: v.password } : null;
    } catch { return null; }
  },

  saveAdminSettings: async (credentials: { username: string; password: string }) => {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('settings')
      .upsert({ id: 'adminConfig', value: credentials, updated_at: new Date().toISOString() });
  },

  subscribeToAdminSettings: (
    callback: (settings: { username: string; password: string } | null) => void,
  ) => {
    if (!isSupabaseConfigured || !supabase) return () => {};
    void Promise.resolve(supabase.from('settings').select('value').eq('id', 'adminConfig').single())
      .then(({ data }) => {
        const v = data?.value as { username?: string; password?: string } | null;
        callback(v && typeof v.username === 'string' && typeof v.password === 'string'
          ? { username: v.username, password: v.password } : null);
      }).catch(() => callback(null));
    const channel = supabase.channel('settings_adminConfig')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('postgres_changes' as any, {
        event: '*', schema: 'public', table: 'settings', filter: 'id=eq.adminConfig',
      }, (payload: { new?: { value?: unknown } }) => {
        const v = payload.new?.value as { username?: string; password?: string } | null;
        callback(v && typeof v.username === 'string' && typeof v.password === 'string'
          ? { username: v.username, password: v.password } : null);
      }).subscribe();
    return () => supabase?.removeChannel(channel);
  },

  getPaymentSettings: async (): Promise<Record<string, unknown> | null> => {
    if (!isSupabaseConfigured || !supabase) return null;
    try {
      const { data } = await supabase.from('settings').select('value').eq('id', 'paymentConfig').single();
      return (data?.value as Record<string, unknown>) ?? null;
    } catch { return null; }
  },

  savePaymentSettings: async (settings: Record<string, unknown>) => {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('settings')
      .upsert({ id: 'paymentConfig', value: settings, updated_at: new Date().toISOString() });
  },

  subscribeToPaymentSettings: (callback: (settings: Record<string, unknown> | null) => void) => {
    if (!isSupabaseConfigured || !supabase) return () => {};
    void Promise.resolve(supabase.from('settings').select('value').eq('id', 'paymentConfig').single())
      .then(({ data }) => callback((data?.value as Record<string, unknown>) ?? null))
      .catch(() => callback(null));
    const channel = supabase.channel('settings_paymentConfig')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('postgres_changes' as any, {
        event: '*', schema: 'public', table: 'settings', filter: 'id=eq.paymentConfig',
      }, (payload: { new?: { value?: unknown } }) => {
        callback((payload.new?.value as Record<string, unknown>) ?? null);
      }).subscribe();
    return () => supabase?.removeChannel(channel);
  },

  saveSecurityConfig: async (config: Record<string, unknown>) => {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('settings')
      .upsert({ id: 'securityConfig', value: config, updated_at: new Date().toISOString() });
  },

  subscribeToSecurityConfig: (callback: (config: Record<string, unknown> | null) => void) => {
    if (!isSupabaseConfigured || !supabase) return () => {};
    void Promise.resolve(supabase.from('settings').select('value').eq('id', 'securityConfig').single())
      .then(({ data }) => callback((data?.value as Record<string, unknown>) ?? null))
      .catch(() => callback(null));
    const channel = supabase.channel('settings_securityConfig')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('postgres_changes' as any, {
        event: '*', schema: 'public', table: 'settings', filter: 'id=eq.securityConfig',
      }, (payload: { new?: { value?: unknown } }) => {
        callback((payload.new?.value as Record<string, unknown>) ?? null);
      }).subscribe();
    return () => supabase?.removeChannel(channel);
  },

  // ─── Employees ────────────────────────────────────────────────────────────

  subscribeToEmployees: (callback: (employees: Employee[]) => void) => {
    const fetch = async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('employees').select('*').order('name', { ascending: true }).limit(200);
      if (error) throw error;
      return (data || []).map((r) => fromDb<Employee>(r));
    };
    return createSubscription('employees', fetch, callback);
  },

  addEmployee: async (employee: Omit<Employee, 'id'>) => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('employees')
      .insert(toDb({ ...employee, updatedAt: new Date().toISOString() } as Record<string, unknown>))
      .select().single();
    if (error) throw error;
    return { id: data.id };
  },

  updateEmployee: async (employeeId: string, updates: Partial<Employee>) => {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('employees')
      .update(toDb({ ...updates, updatedAt: new Date().toISOString() } as Record<string, unknown>))
      .eq('id', employeeId);
  },

  deleteEmployee: async (employeeId: string) => {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('employees').delete().eq('id', employeeId);
  },

  // ─── Trips CRUD ───────────────────────────────────────────────────────────

  addTrip: async (trip: Omit<Trip, 'id'>) => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('trips')
      .insert(toDb({ ...trip, updatedAt: new Date().toISOString() } as Record<string, unknown>))
      .select().single();
    if (error) throw error;
    return { id: data.id };
  },

  addTripsBatch: async (trips: Omit<Trip, 'id'>[]) => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    const rows = trips.map((t) =>
      toDb({ ...t, updatedAt: new Date().toISOString() } as Record<string, unknown>));
    const { data, error } = await supabase.from('trips').insert(rows).select();
    if (error) throw error;
    return (data || []).map((r: { id: string }) => ({ id: r.id }));
  },

  updateTrip: async (tripId: string, updates: Partial<Trip>) => {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('trips')
      .update(toDb({ ...updates, updatedAt: new Date().toISOString() } as Record<string, unknown>))
      .eq('id', tripId);
  },

  deleteTrip: async (tripId: string) => {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('trips').delete().eq('id', tripId);
  },

  mergeTrips: async (
    primaryTripId: string,
    secondaryTripId: string,
    allBookings: Booking[],
  ) => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    const [pr, sr] = await Promise.all([
      supabase.from('trips').select('*').eq('id', primaryTripId).single(),
      supabase.from('trips').select('*').eq('id', secondaryTripId).single(),
    ]);
    if (!pr.data || !sr.data) throw new Error('Chuyến không tồn tại.');
    const primary = fromDb<Trip>(pr.data);
    const secondary = fromDb<Trip>(sr.data);
    if (primary.route !== secondary.route) throw new Error('Hai chuyến phải cùng tuyến đường để ghép.');
    if (primary.date !== secondary.date) throw new Error('Hai chuyến phải cùng ngày để ghép.');
    if (primary.time !== secondary.time) throw new Error('Hai chuyến phải cùng giờ xuất phát để ghép.');
    const primarySeats: Seat[] = primary.seats || [];
    const secondarySeats: Seat[] = secondary.seats || [];
    const seatIdRemap = new Map<string, string>();
    const renumbered: Seat[] = secondarySeats.map((seat, i) => {
      const newId = String(primarySeats.length + i + 1);
      seatIdRemap.set(seat.id, newId);
      return { ...seat, id: newId };
    });
    const mergedSeats: Seat[] = [...primarySeats, ...renumbered];
    const existingIds: string[] = primary.mergedFromTripIds || [];
    const mergedFromTripIds = [...new Set([...existingIds, secondaryTripId])];
    await supabase.from('trips')
      .update(toDb({ seats: mergedSeats, isMerged: true, mergedFromTripIds } as Record<string, unknown>))
      .eq('id', primaryTripId);
    const cleared = secondarySeats.map((s) => ({ id: s.id, status: SeatStatus.EMPTY, row: s.row, col: s.col, deck: s.deck }));
    await supabase.from('trips').update({ seats: cleared }).eq('id', secondaryTripId);
    const affected = allBookings.filter((b) => b.tripId === secondaryTripId);
    for (const booking of affected) {
      const updatedSeats = (booking.seats || []).map((sid: string) => seatIdRemap.get(sid) ?? sid);
      await supabase.from('bookings').update({ trip_id: primaryTripId, seats: updatedSeats }).eq('id', booking.id);
    }
  },

  // ─── Route Fares ──────────────────────────────────────────────────────────

  getFare: (params: GetFareParams) => _getFareForStops(params),

  upsertFare: (
    routeId: string, fromStopId: string, toStopId: string, price: number,
    agentPrice?: number, currency?: string, startDate?: string, endDate?: string,
    sortOrder?: number, fareDocId?: string,
  ) => _upsertFare(routeId, fromStopId, toStopId, price, agentPrice, currency, startDate, endDate, sortOrder, fareDocId),

  getRouteFares: async (routeId: string): Promise<RouteFare[]> => {
    if (!isSupabaseConfigured || !supabase) return [];
    const { data } = await supabase.from('route_fares').select('*').eq('route_id', routeId);
    const fares = (data || []).map((r) => fromDb<RouteFare>(r));
    fares.sort((a, b) => {
      const aS = (a as RouteFare & { sortOrder?: number }).sortOrder ?? Number.MAX_SAFE_INTEGER;
      const bS = (b as RouteFare & { sortOrder?: number }).sortOrder ?? Number.MAX_SAFE_INTEGER;
      return aS - bS;
    });
    return fares;
  },

  subscribeToRouteFares: (routeId: string, callback: (fares: RouteFare[]) => void) => {
    const fetch = async () => transportService.getRouteFares(routeId);
    return createSubscription('route_fares', fetch, callback, `route_id=eq.${routeId}`);
  },

  deleteFare: async (routeId: string, fareDocId: string) => {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('route_fares').delete().eq('route_id', routeId).eq('fare_doc_id', fareDocId);
  },

  // ─── Seat Fares ───────────────────────────────────────────────────────────

  getRouteSeatFares: async (routeId: string): Promise<RouteSeatFare[]> => {
    if (!isSupabaseConfigured || !supabase) return [];
    const { data } = await supabase.from('route_seat_fares').select('*').eq('route_id', routeId);
    return (data || []).map((r) => fromDb<RouteSeatFare>(r));
  },

  subscribeToRouteSeatFares: (routeId: string, callback: (fares: RouteSeatFare[]) => void) => {
    const fetch = async () => transportService.getRouteSeatFares(routeId);
    return createSubscription('route_seat_fares', fetch, callback, `route_id=eq.${routeId}`);
  },

  upsertRouteSeatFare: async (
    routeId: string,
    fare: Omit<RouteSeatFare, 'id' | 'updatedAt'>,
    fareDocId?: string,
  ): Promise<string> => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    const docId = fareDocId ?? buildSeatFareDocId(fare.seatId, fare.startDate, fare.endDate);
    await supabase.from('route_seat_fares')
      .upsert(toDb({ ...fare, routeId, fareDocId: docId, updatedAt: new Date().toISOString() } as Record<string, unknown>),
        { onConflict: 'fare_doc_id' });
    return docId;
  },

  deleteRouteSeatFare: async (routeId: string, fareDocId: string) => {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('route_seat_fares').delete().eq('route_id', routeId).eq('fare_doc_id', fareDocId);
  },

  // ─── Vehicle Types ────────────────────────────────────────────────────────

  subscribeToVehicleTypes: (callback: (types: VehicleType[]) => void) => {
    const fetch = async () => {
      if (!supabase) return [];
      const { data, error } = await supabase.from('vehicle_types').select('*').order('"order"', { ascending: true });
      if (error) throw error;
      return (data || []).map((r) => fromDb<VehicleType>(r));
    };
    return createSubscription('vehicle_types', fetch, callback);
  },

  addVehicleType: async (name: string, order?: number) => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.from('vehicle_types')
      .insert({ name, order: order ?? Date.now() }).select().single();
    if (error) throw error;
    return { id: data.id };
  },

  updateVehicleType: async (id: string, name: string) => {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('vehicle_types').update({ name }).eq('id', id);
  },

  deleteVehicleType: async (id: string) => {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('vehicle_types').delete().eq('id', id);
  },

  seedVehicleTypes: async () => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    const { count } = await supabase.from('vehicle_types').select('*', { count: 'exact', head: true });
    if ((count ?? 0) > 0) return 0;
    await supabase.from('vehicle_types').insert(DEFAULT_VEHICLE_TYPES.map((name, i) => ({ name, order: i })));
    return DEFAULT_VEHICLE_TYPES.length;
  },

  seedVehicles: async () => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
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
    const { data: existing } = await supabase.from('vehicles').select('license_plate');
    const plates = new Set((existing || []).map((v: { license_plate: string }) => v.license_plate));
    const toAdd = VEHICLES.filter((v) => !plates.has(v.licensePlate));
    if (toAdd.length === 0) return 0;
    await supabase.from('vehicles').insert(toAdd.map((v) => toDb({ ...v, status: 'ACTIVE' } as Record<string, unknown>)));
    return toAdd.length;
  },

  // ─── User Guides ──────────────────────────────────────────────────────────

  subscribeToUserGuides: (callback: (guides: UserGuide[]) => void) => {
    const fetch = async () => {
      if (!supabase) return [];
      const { data, error } = await supabase.from('user_guides').select('*').order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((r) => fromDb<UserGuide>(r));
    };
    return createSubscription('user_guides', fetch, callback);
  },

  addUserGuide: async (guide: Omit<UserGuide, 'id'>) => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.from('user_guides')
      .insert(toDb(guide as Record<string, unknown>)).select().single();
    if (error) throw error;
    return { id: data.id };
  },

  updateUserGuide: async (guideId: string, updates: Partial<Omit<UserGuide, 'id'>>) => {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('user_guides').update(toDb(updates as Record<string, unknown>)).eq('id', guideId);
  },

  deleteUserGuide: async (guideId: string) => {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('user_guides').delete().eq('id', guideId);
  },

  // ─── Customer Profiles ────────────────────────────────────────────────────

  subscribeToCustomers: (callback: (customers: CustomerProfile[]) => void) => {
    const fetch = async () => {
      if (!supabase) return [];
      const { data, error } = await supabase.from('customers').select('*')
        .order('registered_at', { ascending: false, nullsFirst: false }).limit(500);
      if (error) throw error;
      return (data || []).map((r) => fromDb<CustomerProfile>(r));
    };
    return createSubscription('customers', fetch, callback);
  },

  addCustomer: async (customer: Omit<CustomerProfile, 'id'>) => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.from('customers')
      .insert(toDb(customer as Record<string, unknown>)).select().single();
    if (error) throw error;
    return { id: data.id };
  },

  updateCustomer: async (customerId: string, updates: Partial<Omit<CustomerProfile, 'id'>>) => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    await supabase.from('customers').update(toDb(updates as Record<string, unknown>)).eq('id', customerId);
  },

  deleteCustomer: async (customerId: string) => {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('customers').delete().eq('id', customerId);
  },

  recordCustomerActivity: async (
    customerId: string,
    activity: {
      viewedRoute?: string; viewedTour?: string; bookedRoute?: string;
      vehicleType?: string; departurePoint?: string; arrivalPoint?: string;
    },
  ) => {
    if (!isSupabaseConfigured || !supabase) return;
    const MAX = 20;
    const { data: row } = await supabase.from('customers').select('*').eq('id', customerId).single();
    if (!row) return;
    const data = fromDb<CustomerProfile>(row);
    const now = new Date().toISOString();
    const updates: Partial<CustomerProfile> = { lastActivityAt: now };
    if (activity.viewedRoute) {
      const s = new Set(data.viewedRoutes || []);
      s.add(activity.viewedRoute);
      updates.viewedRoutes = Array.from(s).slice(-MAX);
    }
    if (activity.viewedTour) {
      const s = new Set(data.viewedTours || []);
      s.add(activity.viewedTour);
      updates.viewedTours = Array.from(s).slice(-MAX);
    }
    if (activity.bookedRoute) {
      const s = new Set(data.bookedRoutes || []);
      s.add(activity.bookedRoute);
      updates.bookedRoutes = Array.from(s).slice(-MAX);
    }
    const prefs = (data.preferences || {}) as Record<string, string[]>;
    if (activity.vehicleType) {
      const s = new Set(prefs.vehicleTypes || []);
      s.add(activity.vehicleType);
      updates.preferences = { ...prefs, vehicleTypes: Array.from(s) };
    }
    if (activity.departurePoint) {
      const s = new Set(prefs.departurePoints || []);
      s.add(activity.departurePoint);
      updates.preferences = { ...(updates.preferences ?? prefs), departurePoints: Array.from(s) };
    }
    if (activity.arrivalPoint) {
      const s = new Set(prefs.arrivalPoints || []);
      s.add(activity.arrivalPoint);
      updates.preferences = { ...(updates.preferences ?? prefs), arrivalPoints: Array.from(s) };
    }
    await supabase.from('customers').update(toDb(updates as Record<string, unknown>)).eq('id', customerId);
  },

  updateCustomerOnBooking: async (
    phone: string, route: string, amount: number, departurePoint?: string, arrivalPoint?: string,
  ) => {
    if (!isSupabaseConfigured || !supabase || !phone?.trim()) return;
    const MAX = 20;
    const { data: rows } = await supabase.from('customers').select('*').eq('phone', phone.trim()).limit(1);
    if (!rows || rows.length === 0) return;
    const customer = fromDb<CustomerProfile>(rows[0]);
    const now = new Date().toISOString();
    const booked = new Set(customer.bookedRoutes || []);
    booked.add(route);
    const prefs = (customer.preferences || {}) as Record<string, unknown[]>;
    const pUpd: Record<string, unknown> = { ...prefs };
    if (departurePoint) {
      const s = new Set(prefs.departurePoints || []);
      s.add(departurePoint);
      pUpd.departurePoints = Array.from(s);
    }
    if (arrivalPoint) {
      const s = new Set(prefs.arrivalPoints || []);
      s.add(arrivalPoint);
      pUpd.arrivalPoints = Array.from(s);
    }
    await supabase.from('customers').update({
      booked_routes: Array.from(booked).slice(-MAX),
      last_activity_at: now,
      total_bookings: (customer.totalBookings || 0) + 1,
      total_spent: (customer.totalSpent || 0) + amount,
      preferences: pUpd,
    }).eq('id', customer.id);
  },

  // ─── Driver Assignments ────────────────────────────────────────────────────

  subscribeToDriverAssignments: (callback: (assignments: DriverAssignment[]) => void) => {
    const fetch = async () => {
      if (!supabase) return [];
      const { data, error } = await supabase.from('driver_assignments').select('*')
        .order('assigned_at', { ascending: false }).limit(200);
      if (error) throw error;
      return (data || []).map((r) => fromDb<DriverAssignment>(r));
    };
    return createSubscription('driver_assignments', fetch, callback);
  },

  addDriverAssignment: async (assignment: Omit<DriverAssignment, 'id'>) => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.from('driver_assignments')
      .insert(toDb(assignment as Record<string, unknown>)).select().single();
    if (error) throw error;
    return { id: data.id };
  },

  updateDriverAssignment: async (id: string, updates: Partial<DriverAssignment>) => {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('driver_assignments').update(toDb(updates as Record<string, unknown>)).eq('id', id);
  },

  deleteDriverAssignment: async (id: string) => {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('driver_assignments').delete().eq('id', id);
  },

  // ─── Staff Messages ────────────────────────────────────────────────────────

  subscribeToStaffMessages: (callback: (messages: StaffMessage[]) => void) => {
    const fetch = async () => {
      if (!supabase) return [];
      const { data, error } = await supabase.from('staff_messages').select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []).map((r) => fromDb<StaffMessage>(r));
    };
    return createSubscription('staff_messages', fetch, callback);
  },

  addStaffMessage: async (message: Omit<StaffMessage, 'id'>) => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.from('staff_messages')
      .insert(toDb(message as Record<string, unknown>)).select().single();
    if (error) throw error;
    return { id: data.id };
  },

  // ─── Customer Categories ──────────────────────────────────────────────────

  subscribeToCustomerCategories: (callback: (categories: CustomerCategory[]) => void) => {
    const fetch = async () => {
      if (!supabase) return [];
      const { data, error } = await supabase.from('customer_categories').select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data || []).map((r) => fromDb<CustomerCategory>(r));
    };
    return createSubscription('customer_categories', fetch, callback);
  },

  addCustomerCategory: async (category: Omit<CustomerCategory, 'id'>) => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.from('customer_categories')
      .insert(toDb(category as Record<string, unknown>)).select().single();
    if (error) throw error;
    return { id: data.id };
  },

  updateCustomerCategory: async (id: string, updates: Partial<Omit<CustomerCategory, 'id'>>) => {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('customer_categories').update(toDb(updates as Record<string, unknown>)).eq('id', id);
  },

  deleteCustomerCategory: async (id: string) => {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('customer_categories').delete().eq('id', id);
  },

  // ─── Category Requests ────────────────────────────────────────────────────

  subscribeToCategoryRequests: (callback: (requests: CategoryVerificationRequest[]) => void) => {
    const fetch = async () => {
      if (!supabase) return [];
      const { data, error } = await supabase.from('category_requests').select('*')
        .order('submitted_at', { ascending: false }).limit(200);
      if (error) throw error;
      return (data || []).map((r) => fromDb<CategoryVerificationRequest>(r));
    };
    return createSubscription('category_requests', fetch, callback);
  },

  addCategoryRequest: async (request: Omit<CategoryVerificationRequest, 'id'>) => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.from('category_requests')
      .insert(toDb(request as Record<string, unknown>)).select().single();
    if (error) throw error;
    return { id: data.id };
  },

  updateCategoryRequest: async (id: string, updates: Partial<Omit<CategoryVerificationRequest, 'id'>>) => {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('category_requests').update(toDb(updates as Record<string, unknown>)).eq('id', id);
  },

  // ─── Audit Logs ───────────────────────────────────────────────────────────

  logAudit: async (entry: Omit<AuditLog, 'id'>) => {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      await supabase.from('audit_logs').insert(toDb(entry as Record<string, unknown>));
    } catch (err) {
      console.error('[auditLog] write error:', err);
    }
  },

  subscribeToAuditLogs: (callback: (logs: AuditLog[]) => void, limitCount = 200) => {
    const fetch = async () => {
      if (!supabase) return [];
      const { data, error } = await supabase.from('audit_logs').select('*')
        .order('created_at', { ascending: false }).limit(limitCount);
      if (error) throw error;
      return (data || []).map((r) => fromDb<AuditLog>(r));
    };
    return createSubscription('audit_logs', fetch, callback);
  },

  // ─── Pending Payments ─────────────────────────────────────────────────────

  createPendingPayment: async (payment: Omit<PendingPayment, 'id' | 'createdAt' | 'status'>) => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    await supabase.from('pending_payments').upsert({
      id: payment.paymentRef,
      payment_ref: payment.paymentRef,
      expected_amount: payment.expectedAmount,
      customer_name: payment.customerName,
      route_info: payment.routeInfo,
      trip_id: payment.tripId,
      status: 'PENDING',
      created_at: new Date().toISOString(),
    });
  },

  subscribeToPendingPayment: (
    paymentRef: string,
    callback: (data: PendingPayment | null) => void,
  ): (() => void) => {
    if (!isSupabaseConfigured || !supabase) return () => {};
    void Promise.resolve(supabase.from('pending_payments').select('*').eq('payment_ref', paymentRef).single())
      .then(({ data }) => callback(data ? fromDb<PendingPayment>(data) : null))
      .catch(() => callback(null));
    const channel = supabase.channel(`pp_${paymentRef}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('postgres_changes' as any, {
        event: '*', schema: 'public', table: 'pending_payments', filter: `payment_ref=eq.${paymentRef}`,
      }, (payload: { eventType: string; new?: Record<string, unknown> }) => {
        if (payload.eventType === 'DELETE') callback(null);
        else if (payload.new) callback(fromDb<PendingPayment>(payload.new));
      }).subscribe();
    return () => supabase?.removeChannel(channel);
  },

  subscribeToPendingPayments: (callback: (payments: PendingPayment[]) => void) => {
    const fetch = async () => {
      if (!supabase) return [];
      const { data } = await supabase.from('pending_payments').select('*')
        .eq('status', 'PENDING').order('created_at', { ascending: false });
      return (data || []).map((r) => fromDb<PendingPayment>(r));
    };
    return createSubscription('pending_payments', fetch, callback, 'status=eq.PENDING');
  },

  confirmPendingPayment: async (paymentRef: string, paidAmount: number, paidContent: string) => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    await supabase.from('pending_payments').update({
      status: 'PAID', paid_amount: paidAmount, paid_content: paidContent,
      confirmed_at: new Date().toISOString(),
    }).eq('payment_ref', paymentRef);
  },

  deletePendingPayment: async (paymentRef: string) => {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      await supabase.from('pending_payments').delete().eq('payment_ref', paymentRef);
    } catch (err) {
      console.error('[pendingPayment] delete error:', err);
    }
  },

  // ─── Property Management ──────────────────────────────────────────────────

  subscribeToProperties: (callback: (properties: Property[]) => void) => {
    const fetch = async () => {
      if (!supabase) return [];
      const { data, error } = await supabase.from('properties').select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((r) => fromDb<Property>(r));
    };
    return createSubscription('properties', fetch, callback);
  },

  addProperty: async (data: Omit<Property, 'id' | 'createdAt'>): Promise<string> => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    const { data: row, error } = await supabase.from('properties')
      .insert(toDb({ ...data, createdAt: new Date().toISOString() } as Record<string, unknown>))
      .select().single();
    if (error) throw error;
    return (row as { id: string }).id;
  },

  updateProperty: async (propertyId: string, updates: Partial<Omit<Property, 'id' | 'createdAt'>>) => {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('properties').update(toDb(updates as Record<string, unknown>)).eq('id', propertyId);
  },

  deleteProperty: async (propertyId: string) => {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('property_room_types').delete().eq('property_id', propertyId);
    await supabase.from('properties').delete().eq('id', propertyId);
  },

  subscribeToPropertyRoomTypes: (
    propertyId: string,
    callback: (roomTypes: PropertyRoomType[]) => void,
  ) => {
    const fetch = async () => {
      if (!supabase) return [];
      const { data, error } = await supabase.from('property_room_types').select('*')
        .eq('property_id', propertyId).order('name', { ascending: true });
      if (error) throw error;
      return (data || []).map((r) => fromDb<PropertyRoomType>(r));
    };
    return createSubscription('property_room_types', fetch, callback, `property_id=eq.${propertyId}`);
  },

  addPropertyRoomType: async (propertyId: string, data: Omit<PropertyRoomType, 'id'>): Promise<string> => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
    const { data: row, error } = await supabase.from('property_room_types')
      .insert(toDb({ ...data, propertyId } as Record<string, unknown>)).select().single();
    if (error) throw error;
    return (row as { id: string }).id;
  },

  updatePropertyRoomType: async (
    propertyId: string, roomTypeId: string, updates: Partial<Omit<PropertyRoomType, 'id'>>,
  ) => {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('property_room_types')
      .update(toDb(updates as Record<string, unknown>)).eq('id', roomTypeId).eq('property_id', propertyId);
  },

  deletePropertyRoomType: async (propertyId: string, roomTypeId: string) => {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('property_room_types').delete().eq('id', roomTypeId).eq('property_id', propertyId);
  },
};
