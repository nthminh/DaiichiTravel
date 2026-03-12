export interface PricePeriod {
  id: string;
  name?: string;       // e.g. "Hè 2025", "Tết Nguyên Đán"
  price: number;       // retail price for this period
  agentPrice: number;  // agent price for this period
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD
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
  pickupPoint?: string;
  deck?: number; // 0 for lower, 1 for upper
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
}

export interface PickupPoint {
  id: string;
  region: string;
  name: string;
  additionalPrice: number;
  note?: string;
}
