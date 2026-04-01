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
  /** Minutes offset from the main departure time to the scheduled arrival at this stop. */
  offsetMinutes?: number;
  /** Optional description of services/amenities available at this stop. */
  description?: string;
}

/** A single child pricing rule: passengers aged [fromAge, toAge] pay `percent` % of the adult fare. */
export interface ChildPricingRule {
  id: string;
  /** Minimum age (inclusive), e.g. 1 */
  fromAge: number;
  /** Maximum age (inclusive), e.g. 5. Use 99 or a large number to mean "and above". */
  toAge: number;
  /** Percentage of adult fare, e.g. 50 means 50% of adult price */
  percent: number;
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
  disablePickupAddress?: boolean;  // when true, disables pickup address (điểm đón) input on booking page
  disablePickupAddressFrom?: string;  // YYYY-MM-DD, if set the disable only applies from this date
  disablePickupAddressTo?: string;    // YYYY-MM-DD, if set the disable only applies until this date
  /** Stop type scope for the pickup disable: 'ALL' (default) disables all; 'STOP' / 'FREE_STOP' disables only that type */
  disablePickupAddressStopType?: string;
  disableDropoffAddress?: boolean; // when true, disables dropoff address (điểm trả) input on booking page
  disableDropoffAddressFrom?: string; // YYYY-MM-DD, if set the disable only applies from this date
  disableDropoffAddressTo?: string;   // YYYY-MM-DD, if set the disable only applies until this date
  /** Stop type scope for the dropoff disable: 'ALL' (default) disables all; 'STOP' / 'FREE_STOP' disables only that type */
  disableDropoffAddressStopType?: string;
  /**
   * Stop categories that are disabled for pickup on this route.
   * Stops whose `category` is in this list will be excluded from the pickup stop suggestions.
   * e.g. ['TOLL', 'RESTAURANT'] to prevent passengers from being picked up at tolls / restaurants.
   */
  disabledPickupCategories?: string[];
  /** Optional YYYY-MM-DD date range start for pickup category disable. Empty = applies always. */
  disabledPickupCategoriesFromDate?: string;
  /** Optional YYYY-MM-DD date range end for pickup category disable. Empty = applies always. */
  disabledPickupCategoriesToDate?: string;
  /**
   * Stop categories that are disabled for dropoff on this route.
   * Stops whose `category` is in this list will be excluded from the dropoff stop suggestions.
   */
  disabledDropoffCategories?: string[];
  /** Optional YYYY-MM-DD date range start for dropoff category disable. Empty = applies always. */
  disabledDropoffCategoriesFromDate?: string;
  /** Optional YYYY-MM-DD date range end for dropoff category disable. Empty = applies always. */
  disabledDropoffCategoriesToDate?: string;
  duration?: string;        // travel time from departure to arrival (e.g. "3 giờ 30 phút")
  departureOffsetMinutes?: number; // minutes offset applied to the departure point (usually 0)
  arrivalOffsetMinutes?: number;   // minutes offset from departure time to arrival at the final stop
  imageUrl?: string;        // scenic / destination photo shown to passengers on the booking page
  images?: string[];        // additional destination photos (multi-upload); imageUrl = images[0]
  vehicleImageUrl?: string; // photo of the typical vehicle used on this route
  updatedAt?: string;       // ISO timestamp of last modification – used for conflict detection
  /** Age-based child pricing rules for this route. */
  childPricingRules?: ChildPricingRule[];
  /** Route service category – used to filter routes by the home-page category icons. */
  routeCategory?: 'BUS' | 'TOUR_SHORT' | 'CRUISE' | 'HOTEL';
  /** Default add-on services for this route – automatically applied to all trips on this route. */
  addons?: TripAddon[];
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
  sortOrder?: number; // display order in the fare table (0-based index)
}

// A per-seat price override stored in the routeSeatFares subcollection.
// Path: routeSeatFares/{routeId}/seats/{fareDocId}
// Allows configuring discounted/premium prices for specific seats (e.g. bad-position seats)
// with optional seasonal date ranges. Two prices: retail (price) and agent (agentPrice).
export interface RouteSeatFare {
  id: string;           // Firestore document ID (seatId or seatId|startDate|endDate)
  routeId: string;
  seatId: string;       // The seat label, e.g. "1", "2A", "H1"
  price: number;        // Retail price override for this seat
  agentPrice?: number;  // Agent/wholesaler price override for this seat
  startDate?: string;   // YYYY-MM-DD, fare valid from (seasonal pricing)
  endDate?: string;     // YYYY-MM-DD, fare valid until (seasonal pricing)
  note?: string;        // Optional note, e.g. "Ghế cuối xe", "Ghế kém vị trí"
  active: boolean;
  updatedAt: string;    // ISO string
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
  role: UserRole | string; // UserRole for admin/agent/customer, string for staff roles (e.g. 'DRIVER', 'STAFF')
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  agentCode?: string;
  balance?: number;
  password?: string;
  // Customer category (populated when role === CUSTOMER)
  categoryId?: string;
  categoryName?: string;
  categoryVerificationStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NONE';
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
  // Per-route commission rates: routeId -> commission percentage (overrides global commissionRate for that route)
  routeCommissionRates?: Record<string, number>;
  updatedAt?: string; // ISO timestamp of last modification – used for conflict detection
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
  updatedAt?: string; // ISO timestamp of last modification – used for conflict detection
}

export interface TourAddon {
  id: string;
  name: string;
  price: number;
  description?: string;
}

/** A room type available on a multi-day overnight tour (cabin, suite, berth, etc.) */
export interface TourRoomType {
  id: string;
  name: string;              // e.g., "Phòng Standard", "Cabin Deluxe", "Phòng VIP"
  capacity: number;          // maximum number of guests per room/cabin
  pricingMode: 'PER_ROOM' | 'PER_PERSON'; // sell by room or per guest
  price: number;             // price per room (PER_ROOM) or per person (PER_PERSON)
  totalRooms: number;        // total number of rooms of this type
  description: string;       // amenities, features, equipment details
  images: string[];          // room/cabin photos
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
  roomTypes?: TourRoomType[];      // overnight room/cabin options
  departureTime?: string;          // e.g., "07:00"
  departureLocation?: string;      // meeting/boarding point
  returnTime?: string;             // expected return time
  returnLocation?: string;         // end-of-tour location
  linkedPropertyId?: string;       // optional link to a Property asset
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
  selectedRoomTypeId?: string;    // room type chosen by customer
  selectedRoomTypeName?: string;  // denormalised name for display
}

export enum SeatStatus {
  EMPTY = 'EMPTY',
  BOOKED = 'BOOKED',
  PAID = 'PAID',
  LOCKED = 'LOCKED'
}

/** One passenger's booking occupying a seat for a specific sub-segment of the route. */
export interface SegmentBooking {
  fromStopOrder: number;  // order of pickup stop
  toStopOrder: number;    // order of dropoff stop
  customerName?: string;
  customerPhone?: string;
  pickupPoint?: string;
  dropoffPoint?: string;
  bookingNote?: string;
}

export interface Seat {
  id: string;
  status: SeatStatus;
  row?: number;  // seat grid row (used in layout rendering)
  col?: number;  // seat grid column (used in layout rendering)
  customerName?: string;
  customerPhone?: string;
  pickupPoint?: string;      // departure stop name (điểm xuất phát) for fare segment
  dropoffPoint?: string;     // destination stop name (điểm đến) for fare segment
  pickupAddress?: string;       // physical pickup address / stop name (điểm đón)
  dropoffAddress?: string;      // physical dropoff address / stop name (điểm trả)
  pickupAddressDetail?: string; // extra detail entered by customer (e.g. house number)
  dropoffAddressDetail?: string; // extra detail entered by customer (e.g. house number)
  pickupStopAddress?: string;   // actual street address of the selected pickup stop
  dropoffStopAddress?: string;  // actual street address of the selected dropoff stop
  fromStopOrder?: number;    // order of pickup stop (used for segment availability)
  toStopOrder?: number;      // order of dropoff stop (used for segment availability)
  deck?: number; // 0 for lower, 1 for upper
  bookingNote?: string;      // note from agent or bus company (e.g. partial payment info)
  /** All sub-segment bookings for this seat (supports multiple passengers on different segments). */
  segmentBookings?: SegmentBooking[];
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
  images?: string[];
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
  discountPercent?: number; // % discount to incentivize purchase on under-booked trips (0-100)
  addons?: TripAddon[];
  note?: string;
  seatType?: 'assigned' | 'free'; // 'assigned' = ghế chỉ định (default), 'free' = ghế tự do
  isMerged?: boolean;             // true when this trip was created by merging two trips
  mergedFromTripIds?: string[];   // IDs of the source trips that were merged into this one
  updatedAt?: string;             // ISO timestamp of last modification – used for conflict detection
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
  id?: string;
  stt: number;
  licensePlate: string;
  phone?: string;
  type: string;
  seats: number;
  registrationExpiry: string;
  status?: string;
  ownerId?: string;
  layout?: VehicleSeat[];
  note?: string;
  seatType?: 'assigned' | 'free'; // 'assigned' = ghế chỉ định (default), 'free' = ghế tự do
}

export interface VehicleType {
  id: string;
  name: string;
  order?: number;
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
  category?: 'MAJOR' | 'MINOR' | 'TOLL' | 'RESTAURANT' | 'QUICK' | 'TRANSIT' | 'OFFICE' | 'FREE';
  surcharge: number;
  distanceKm?: number; // distance from the main route stop (km), used for pickup surcharge display
  note?: string;
  /** Hierarchy level.
   *  - 'TERMINAL' : top-level city / station (điểm xuất phát / điểm đến).
   *  - 'STOP'     : sub-stop belonging to a terminal (điểm đón / điểm trả).
   *  - 'FREE_STOP': free pickup/dropoff stop (đón trả miễn phí), belongs to a terminal.
   *  Undefined means legacy stop (treated as 'STOP' for backwards-compat).
   */
  type?: 'TERMINAL' | 'STOP' | 'FREE_STOP';
  /** For type='STOP': the `id` of the parent TERMINAL stop. */
  terminalId?: string;
  /**
   * Search suggestion priority. Lower number = higher priority in autocomplete results.
   * 1 = highest priority, undefined/0 = no priority (appears after all prioritised stops).
   */
  priority?: number;
  /**
   * For type='TERMINAL': route service category classification.
   * Used to filter stop suggestions to match the active search category.
   * Matches Route.routeCategory values: 'BUS' | 'TOUR_SHORT' | 'CRUISE' | 'HOTEL'.
   */
  vehicleTypes?: 'BUS' | 'TOUR_SHORT' | 'CRUISE' | 'HOTEL';
  /**
   * Serial / display order number (số thứ tự). Used to sort stops in the management table.
   * Lower number appears first.
   */
  stt?: number;
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

// ─── Driver Assignment ─────────────────────────────────────────────────────────
// Represents a task assigned to a driver for a passenger pickup/dropoff.
// Stored in Firestore collection: driverAssignments/{id}
export interface DriverAssignment {
  id: string;
  tripId: string;
  seatId: string;
  seatIds?: string[];   // all seat IDs belonging to this booking
  // Snapshot of trip/passenger data for display
  tripRoute?: string;
  tripDate?: string;
  tripTime?: string;
  licensePlate?: string;
  customerName?: string;
  customerPhone?: string;
  adults?: number;          // number of adult passengers
  children?: number;        // number of child passengers
  pickupAddress?: string;
  dropoffAddress?: string;
  pickupAddressDetail?: string;  // extra detail (e.g. house number) for pickup
  dropoffAddressDetail?: string; // extra detail (e.g. house number) for dropoff
  pickupStopAddress?: string;    // actual street address of the selected pickup stop
  dropoffStopAddress?: string;   // actual street address of the selected dropoff stop
  // Assignment
  taskType?: 'pickup' | 'dropoff';  // which task this assignment covers
  driverEmployeeId: string;
  driverName: string;
  assignedBy?: string;   // name of manager who made the assignment
  assignedAt: string;    // ISO timestamp
  status: 'pending' | 'accepted' | 'rejected' | 'completed';
  respondedAt?: string;  // ISO timestamp when driver responded
  completedAt?: string;  // ISO timestamp when driver marked task as completed
  rejectionReason?: string;
  note?: string;
}

// ─── Staff Message ─────────────────────────────────────────────────────────────
// Internal chat message between staff/drivers.
// Stored in Firestore collection: staffMessages/{id}
export interface StaffMessage {
  id: string;
  senderId: string;       // employee username or currentUser id
  senderName: string;
  content: string;
  mentions: string[];     // list of mentioned names (extracted from @name patterns)
  createdAt: string;      // ISO timestamp
  assignmentId?: string;  // optional – links message to a driver assignment thread
  voiceUrl?: string;      // optional – Firebase Storage URL for voice message audio
  messageType?: 'text' | 'voice';  // optional – defaults to 'text'
}

// Customer category – admin-managed list (e.g. "Khách bình thường", "Sinh viên", "Người địa phương")
export interface CustomerCategory {
  id: string;
  name: string;        // e.g. "Sinh viên"
  description?: string;
  color?: string;      // hex color for badge, e.g. "#3B82F6"
  sortOrder?: number;
}

// Category verification request submitted by a customer during registration
export interface CategoryVerificationRequest {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  categoryId: string;
  categoryName: string;
  proofImageUrl: string;      // Firebase Storage URL of uploaded proof image
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedAt: string;        // ISO timestamp
  reviewedAt?: string;        // ISO timestamp
  reviewedBy?: string;        // staff user id who reviewed
  reviewNote?: string;        // optional note from staff
}

// Audit log entry – records every significant user action for accountability
export interface AuditLog {
  id: string;
  actorId: string;            // user id (customer, agent, employee, manager)
  actorName: string;          // display name
  actorRole: string;          // role at time of action
  action: string;             // e.g. 'LOGIN', 'BOOK_TICKET', 'CANCEL_BOOKING', 'EDIT_TRIP', 'APPROVE_CATEGORY'
  targetType?: string;        // e.g. 'trip', 'booking', 'customer', 'route'
  targetId?: string;          // id of the affected entity
  targetLabel?: string;       // human-readable description of the target
  detail?: string;            // extra context (e.g. seat numbers, changes made)
  createdAt: string;          // ISO timestamp
  ipAddress?: string;         // optional
}

/** Pending QR payment waiting for confirmation – stored in Firestore 'pendingPayments' collection */
export interface PendingPayment {
  /** Document ID – same as paymentRef (e.g. DT-ABC123) */
  id: string;
  /** Unique payment reference code used in the transfer description */
  paymentRef: string;
  /** Expected amount in VND */
  expectedAmount: number;
  /** Customer name for display */
  customerName: string;
  /** Route info string for display (e.g. "HCM → HN") */
  routeInfo: string;
  /** Trip ID the seats belong to */
  tripId: string;
  /** Current status */
  status: 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED';
  /** Amount actually received (filled by simulator / payment gateway IPN) */
  paidAmount?: number;
  /** Transfer description content (must contain paymentRef for verification) */
  paidContent?: string;
  /** Firestore server timestamp when document was created */
  createdAt: any;
  /** Firestore server timestamp when payment was confirmed */
  confirmedAt?: any;
}

// ─── Property Management (Quản lý tài sản) ───────────────────────────────────

/** Time-based surcharge that applies during a specific date range for a room type */
export interface PropertyRoomSurcharge {
  id: string;
  label: string;       // e.g. "Lễ Tết", "Hè 2025"
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD
  amount: number;      // additional VND per unit (per room or per person)
  note?: string;
}

/** A room/cabin type that belongs to a property (stored as Firestore subcollection) */
export interface PropertyRoomType {
  id: string;
  name: string;                // e.g. "Phòng Suite VIP", "Cabin Double Ocean View"
  capacityAdults: number;      // maximum adults per unit
  capacityChildren: number;    // maximum children per unit
  areaSqm: number;             // area in m²
  basePrice: number;           // base price per night/unit (reference price)
  surcharges: PropertyRoomSurcharge[];  // time-period based surcharges
  checkinTime: string;         // e.g. "14:00"
  checkoutTime: string;        // e.g. "12:00"
  amenities: string[];         // e.g. ["Điều hòa", "Wifi", "Bồn tắm"]
  images: string[];            // Firebase Storage URLs
  totalUnits: number;          // total number of this room type available
}

/** A property (ship, resort, or homestay) managed in the system */
export interface Property {
  id: string;
  name: string;                // e.g. "Du thuyền Daiichi 01"
  ownerId: string;             // linked user/owner ID
  country: string;             // e.g. "Việt Nam", "Úc"
  type: 'cruise' | 'homestay' | 'resort';
  address: string;             // detailed address
  description: string;        // detailed property description
  images: string[];            // property main images
  createdAt: any;              // Firestore Timestamp
}

// Customer profile stored in Firestore customers collection
export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  email?: string;
  username?: string;
  password?: string;
  note?: string;
  loginMethod?: 'phone' | 'gmail' | 'facebook' | 'whatsapp';
  firebaseUid?: string;
  status: 'ACTIVE' | 'INACTIVE';
  registeredAt: string;      // ISO timestamp
  lastActivityAt?: string;   // ISO timestamp of last known activity
  // Customer classification
  categoryId?: string;                  // id of CustomerCategory
  categoryName?: string;                // denormalised name for fast display
  categoryVerificationStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NONE';
  categoryProofImageUrl?: string;       // uploaded proof image URL
  // Behavior tracking for personalised suggestions
  viewedRoutes?: string[];   // route names the customer has searched/viewed
  viewedTours?: string[];    // tour ids the customer has viewed
  bookedRoutes?: string[];   // routes they have actually booked
  preferences?: {            // inferred preference tags e.g. 'limousine', 'night-bus'
    vehicleTypes?: string[];
    departurePoints?: string[];
    arrivalPoints?: string[];
  };
  totalBookings?: number;
  totalSpent?: number;
}
