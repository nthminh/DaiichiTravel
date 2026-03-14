export interface PricePeriod {
  id: string;
  name?: string;       // e.g. "Hè 2025", "Tết Nguyên Đán"
  price: number;       // retail price for this period
  agentPrice: number;  // agent price for this period
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD
}

export interface RouteSurcharge {
  id: string;
  name: string;
  type: 'HOLIDAY' | 'FUEL' | 'OTHER';
  amount: number;      // VND per person
  startDate?: string;  // YYYY-MM-DD, required for HOLIDAY type
  endDate?: string;    // YYYY-MM-DD, required for HOLIDAY type
  isActive: boolean;
}

// Ordered stop within a route, used for fare-table pricing (Option 2)
export interface RouteStop {
  stopId: string;
  stopName: string;
  order: number; // 1-based, determines boarding/alighting direction
}

export interface Route {
  id: string;
  stt: number;
  name: string;
  note?: string;
  departurePoint: string;
  arrivalPoint: string;
  price: number;           // default retail price
  agentPrice?: number;     // default agent price
  pricePeriods?: PricePeriod[]; // seasonal/holiday price overrides
  surcharges?: RouteSurcharge[]; // additional surcharges (fuel, holiday, etc.)
  details?: string;        // detailed trip information shown to customers on seat selection
  routeStops?: RouteStop[]; // ordered stops for fare-table pricing
}

// A single fare entry in the routeFares subcollection
// Path: routeFares/{routeId}/fares/{fromStopId_toStopId}
export interface RouteFare {
  id: string; // "${fromStopId}_${toStopId}"
  routeId: string;
  fromStopId: string;
  toStopId: string;
  price: number;
  agentPrice?: number; // agent/wholesaler price for this segment
  currency: string; // default "VND"
  active: boolean;
  updatedAt: string; // ISO string
  startDate?: string; // YYYY-MM-DD, if set fare is only valid from this date
  endDate?: string;   // YYYY-MM-DD, if set fare is only valid until this date
}

// Return type of getFareForStops()
export interface FareResult {
  price: number;
  agentPrice?: number; // agent price for this segment (if configured)
  currency: string;
  fareDocId: string;
  fromStopName?: string;
  toStopName?: string;
}

export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  AGENT = 'AGENT',
  MANAGER = 'MANAGER'
}

export interface User {
  id: string;
  username: string;
  role: UserRole;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  agentCode?: string;
  balance?: number;
}

export interface Agent {
  id: string;
  code: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  commissionRate: number;
  balance: number;
  status: 'ACTIVE' | 'INACTIVE';
  username?: string;
  password?: string;
  note?: string;
  // Payment type: POSTPAID = được thanh toán sau, PREPAID = phải trả trước
  paymentType?: 'POSTPAID' | 'PREPAID';
  // Credit limit for POSTPAID agents (max debt allowed)
  creditLimit?: number;
  // Options for PREPAID agents (optional, agent can choose)
  depositAmount?: number;          // tiền ký quỹ (escrow/deposit amount)
  allowedPaymentOptions?: AgentPaymentOption[]; // payment methods this agent may use
  holdTicketHours?: number;        // hours the agent may hold a ticket (using customer hold time)
}

export type AgentPaymentOption = 'DEPOSIT' | 'BANK_TRANSFER' | 'HOLD_WITH_CUSTOMER_TIME';

export interface Employee {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  role: string; // permission group ID from settings (e.g. SUPERVISOR, STAFF, DRIVER)
  position?: string; // free-text job title, separate from system role
  status: 'ACTIVE' | 'INACTIVE';
  username?: string;
  password?: string;
  note?: string;
}

export interface TourAddon {
  id: string;
  name: string;
  price: number;
  description?: string;
}

export interface Tour {
  id: string;
  title: string;
  description: string;
  priceAdult: number;
  priceChild: number;
  duration: string; // e.g., "3 ngày 2 đêm"
  image: string;
  addons: TourAddon[];
  itinerary: { day: number; content: string }[];
}

export interface Booking {
  id: string;
  type: 'TICKET' | 'TOUR';
  userId: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  createdAt: string;
  // For tickets
  tripId?: string;
  seats?: string[];
  // For tours
  tourId?: string;
  adults: number;
  children: number;
  selectedAddons?: string[];
}

export enum SeatStatus {
  EMPTY = 'EMPTY',
  BOOKED = 'BOOKED',
  PAID = 'PAID'
}

export interface Seat {
  id: string;
  status: SeatStatus;
  customerName?: string;
  customerPhone?: string;
  pickupPoint?: string;      // departure stop name (điểm xuất phát) for fare segment
  dropoffPoint?: string;     // destination stop name (điểm đến) for fare segment
  pickupAddress?: string;    // physical pickup address (điểm đón)
  dropoffAddress?: string;   // physical dropoff address (điểm trả)
  fromStopOrder?: number;    // order of pickup stop (used for segment availability)
  toStopOrder?: number;      // order of dropoff stop (used for segment availability)
  deck?: number; // 0 for lower, 1 for upper
  bookingNote?: string;      // note from agent or bus company (e.g. partial payment info)
}

export enum TripStatus {
  WAITING = 'WAITING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED'
}

export interface TripAddon {
  id: string;
  name: string;
  price: number;
  description?: string;
  type: 'SIGHTSEEING' | 'TRANSPORT' | 'FOOD' | 'OTHER';
}

export interface Trip {
  id: string;
  time: string;
  date?: string; // YYYY-MM-DD
  licensePlate: string;
  driverName: string;
  status: TripStatus;
  seats: Seat[];
  route: string;
  price: number;
  agentPrice?: number; // agent price for this trip
  addons?: TripAddon[];
  note?: string;
}

export interface ConsignmentItem {
  name: string;
  quantity: number;
  weight?: string;
  note?: string;
}

export interface Consignment {
  id: string;
  senderName: string;
  senderPhone: string;
  receiverName: string;
  receiverPhone: string;
  status: 'PENDING' | 'PICKED_UP' | 'DELIVERED';
  qrCode: string;
  photoUrl?: string;
  // Additional fields used in display
  sender?: string;
  receiver?: string;
  type?: string;
  weight?: string;
  cod?: number;
  items?: ConsignmentItem[];
  routeId?: string;
  tripId?: string;
  createdAt?: any;
  notes?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  type: 'RETAIL' | 'AGENT';
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  agentId?: string;
  agentName?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  debtAmount: number;
  status: 'UNPAID' | 'PARTIAL' | 'PAID';
  paymentMethod?: string;
  dueDate?: string;
  createdAt?: any;
  notes?: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  type: 'TICKET' | 'TOUR' | 'CONSIGNMENT' | 'OTHER';
  referenceId?: string;
}

export interface VehicleSeat {
  id: string;
  label?: string;
  row: number;
  col: number;
  deck?: number; // 0 for lower, 1 for upper
  discounted?: boolean; // true = discounted due to unfavourable position
  booked?: boolean;
}

export interface Vehicle {
  stt: number;
  licensePlate: string;
  phone?: string;
  type: string;
  seats: number;
  registrationExpiry: string;
  ownerId?: string;
  layout?: VehicleSeat[];
  note?: string;
}

export enum PaymentMethod {
  MOMO = 'MOMO',
  ZALOPAY = 'ZALOPAY',
  VNPAY = 'VNPAY',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CASH = 'CASH'
}

export interface Stop {
  id: string;
  name: string;
  address: string;
  category: 'MAJOR' | 'MINOR' | 'TOLL' | 'RESTAURANT' | 'QUICK' | 'TRANSIT' | 'OFFICE';
  surcharge: number;
  distanceKm?: number; // distance from the main route stop (km), used for pickup surcharge display
  note?: string;
}

export interface PickupPoint {
  id: string;
  region: string;
  name: string;
  additionalPrice: number;
  note?: string;
}

// User Guide (Hướng dẫn sử dụng)
export interface GuideBlock {
  type: 'text' | 'image';
  content: string; // text content or image URL
}

export interface UserGuide {
  id: string;
  role: string; // 'MANAGER' | 'AGENT' | 'DRIVER' | 'STAFF' | 'ACCOUNTANT' | 'CUSTOMER'
  title: string;
  blocks: GuideBlock[];
  updatedAt: number; // Unix timestamp ms
}
