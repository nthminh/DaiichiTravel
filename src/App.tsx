import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Bus, Users, Package, LayoutDashboard, ChevronRight, 
  MapPin, Calendar, Truck, Star, Phone, Search, 
  Clock, Edit3, Trash2, Wallet, X, CheckCircle2,
  Menu, Bell, Globe, LogOut, Eye, EyeOff, AlertTriangle, Info,
  Filter, Gift, Download, FileText, Copy, Columns, SlidersHorizontal, UserPlus, Loader2,
  Heart
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

// Import Constants & Types
import { 
  UserRole, TripStatus, SeatStatus, Language, TRANSLATIONS 
} from './constants/translations';
import { PAYMENT_METHODS, type PaymentMethod } from './constants/paymentMethods';
import { Stop, Trip, Consignment, Agent, Route, TripAddon, PricePeriod, RouteSurcharge, RouteStop, Employee, AgentPaymentOption, Invoice, UserGuide as UserGuideType, CustomerProfile } from './types';
import { transportService } from './services/transportService';
import { FareError } from './services/fareService';
import { auth, db, storage } from './lib/firebase';
import { signOut as firebaseSignOut, onAuthStateChanged, isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';

// Import Components
import { Dashboard } from './components/Dashboard';
import { Login } from './components/Login';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { UrgencyNotification } from './components/UrgencyNotification';
import { StatusBadge } from './components/StatusBadge';
import { Settings } from './components/Settings';
import { TicketModal } from './components/TicketModal';
import { SearchableSelect } from './components/SearchableSelect';
import { Footer } from './components/Footer';
import { TourManagement } from './components/TourManagement';
import { StopManagement } from './components/StopManagement';
import { FinancialReport } from './components/FinancialReport';
import { VehicleSeatDiagram, generateVehicleLayout, serializeLayout, SerializedSeat } from './components/VehicleSeatDiagram';
import { ResizableTh } from './components/ResizableTh';
import { matchesSearch } from './lib/searchUtils';
import { compressImage } from './lib/imageUtils';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { NotePopover } from './components/NotePopover';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { UserGuide } from './components/UserGuide';
import { CustomerManagement } from './components/CustomerManagement';
import { PaymentQRModal } from './components/PaymentQRModal';
import { PaymentManagement } from './components/PaymentManagement';

// Re-export types for components
export { UserRole, TripStatus, SeatStatus, TRANSLATIONS };
export type { Language };

const DEFAULT_PAYMENT_METHOD: PaymentMethod = 'Chuyển khoản QR';
const PAYMENT_METHOD_TRANSLATION_KEYS: Record<PaymentMethod, string> = {
  'Chuyển khoản QR': 'payment_qr',
  'Tiền mặt': 'payment_cash',
  'Chuyển khoản': 'payment_transfer',
  'Thẻ tín dụng': 'payment_card',
  'MoMo': 'payment_momo',
  'Giữ vé': 'payment_hold',
};

export interface User {
  id: string;
  username: string;
  role: UserRole | string; // UserRole for admin/agent/customer, employee role string for staff
  name: string;
  address?: string;
  agentCode?: string;
  balance?: number;
  password?: string;
}

export interface VehicleSeat {
  id: string;
  row: number;
  col: number;
  deck?: number;
  status?: SeatStatus;
}

export interface Vehicle {
  id: string;
  licensePlate: string;
  type: string;
  seats: number;
  registrationExpiry: string;
  status: string;
  layout?: VehicleSeat[];
  note?: string;
  seatType?: 'assigned' | 'free';
}

interface TourItem {
  id: string;
  title: string;
  description: string;
  price: number;
  imageUrl: string;
  images?: string[];
  discountPercent?: number;
  priceAdult?: number;
  priceChild?: number;
  duration?: string;
  nights?: number;
  pricePerNight?: number;
  breakfastCount?: number;
  pricePerBreakfast?: number;
  youtubeUrl?: string;
}

function getYoutubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&\n?#]+)/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

/** Small overlay shown when a magic-link email is opened on a different device than where it was requested */
function EmailLinkReenterForm({ language, onSubmit, onCancel }: { language: Language; onSubmit: (email: string) => void; onCancel: () => void }) {
  const [email, setEmail] = React.useState('');
  const isVi = language === 'vi';
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
        <p className="text-lg font-bold text-gray-800 text-center">
          {isVi ? '📧 Xác nhận email đăng nhập' : '📧 Confirm sign-in email'}
        </p>
        <p className="text-sm text-gray-500 text-center">
          {isVi
            ? 'Vui lòng nhập lại địa chỉ email bạn đã dùng để yêu cầu link đăng nhập.'
            : 'Please re-enter the email address you used to request the sign-in link.'}
        </p>
        <form
          onSubmit={(e) => { e.preventDefault(); if (email.trim()) onSubmit(email.trim()); }}
          className="space-y-3"
        >
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="email@example.com"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            autoFocus
            required
          />
          <button
            type="submit"
            className="w-full py-3 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-colors"
          >
            {isVi ? 'Xác nhận' : 'Confirm'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-2 text-gray-400 text-xs hover:text-gray-600 transition-colors"
          >
            {isVi ? 'Huỷ' : 'Cancel'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('currentUser');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [activeTab, setActiveTab] = useState('home');
  const [previousTab, setPreviousTab] = useState('book-ticket'); // Track tab before seat-mapping navigation
  const [language, setLanguage] = useState<Language>('vi');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>> | null>(() => {
    try {
      const saved = localStorage.getItem('daiichi_permissions');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [trips, setTrips] = useState<Trip[]>([]);
  const [consignments, setConsignments] = useState<Consignment[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [userGuides, setUserGuides] = useState<UserGuideType[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<any>(null);
  const [showBookingForm, setShowBookingForm] = useState<string | null>(null);
  const [activeDeck, setActiveDeck] = useState(0);
  const [tripType, setTripType] = useState<'ONE_WAY' | 'ROUND_TRIP'>('ONE_WAY');
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [pickupPoint, setPickupPoint] = useState('');
  const [dropoffPoint, setDropoffPoint] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [surchargeAmount, setSurchargeAmount] = useState(0);
  const [bookingDiscount, setBookingDiscount] = useState(0);
  const [pickupSurcharge, setPickupSurcharge] = useState(0);
  const [dropoffSurcharge, setDropoffSurcharge] = useState(0);
  // Fare-table state (Option 2: explicit fare lookup between stops)
  const [fareAmount, setFareAmount] = useState<number | null>(null);
  const [fareAgentAmount, setFareAgentAmount] = useState<number | null>(null); // agent-specific fare per segment
  const [fareError, setFareError] = useState<string>('');
  const [fareLoading, setFareLoading] = useState(false);
  const [fromStopId, setFromStopId] = useState('');
  const [toStopId, setToStopId] = useState('');
  // Ref to track the latest fare request and discard stale responses
  const fareRequestIdRef = useRef(0);
  // Tour booking states
  const [selectedTour, setSelectedTour] = useState<TourItem | null>(null);
  const [tourBookingName, setTourBookingName] = useState('');
  const [tourBookingPhone, setTourBookingPhone] = useState('');
  const [tourBookingEmail, setTourBookingEmail] = useState('');
  const [tourBookingDate, setTourBookingDate] = useState('');
  const [tourBookingAdults, setTourBookingAdults] = useState(1);
  const [tourBookingChildren, setTourBookingChildren] = useState(0);
  const [tourAccommodation, setTourAccommodation] = useState<'none' | 'standard' | 'deluxe' | 'suite'>('none');
  const [tourMealPlan, setTourMealPlan] = useState<'none' | 'breakfast' | 'half_board' | 'full_board'>('none');
  const [tourNotes, setTourNotes] = useState('');
  const [tourPaymentMethod, setTourPaymentMethod] = useState<PaymentMethod>(DEFAULT_PAYMENT_METHOD);
  const [tourBookingSuccess, setTourBookingSuccess] = useState(false);
  const [tourBookingError, setTourBookingError] = useState<string>('');
  const [tourBookingId, setTourBookingId] = useState<string>('');
  const [lastTourBooking, setLastTourBooking] = useState<any>(null);
  const [isTourBookingLoading, setIsTourBookingLoading] = useState(false);
  const [searchFrom, setSearchFrom] = useState('');
  const [searchTo, setSearchTo] = useState('');
  const [searchDate, setSearchDate] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
  const [searchReturnDate, setSearchReturnDate] = useState('');
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('');
  const [bookTicketSearch, setBookTicketSearch] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [clearedTripCards, setClearedTripCards] = useState<Set<string>>(new Set());
  // Tour advanced search
  const [tourHasSearched, setTourHasSearched] = useState(false);
  const [clearedTourCards, setClearedTourCards] = useState<Set<string>>(new Set());
  const [tourPriceMin, setTourPriceMin] = useState('');
  const [tourPriceMax, setTourPriceMax] = useState('');
  const [tourDurationFilter, setTourDurationFilter] = useState('');
  const [expandedVideoTourId, setExpandedVideoTourId] = useState<string | null>(null);
  const [likedTours, setLikedTours] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('likedTours');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [searchAdults, setSearchAdults] = useState(1);
  const [searchChildren, setSearchChildren] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  // Round-trip two-phase booking state
  const [roundTripPhase, setRoundTripPhase] = useState<'outbound' | 'return'>('outbound');
  const [outboundBookingData, setOutboundBookingData] = useState<any>(null);

  // Inquiry form state (for when no trip is found)
  const [showInquiryForm, setShowInquiryForm] = useState(false);
  const [inquiryName, setInquiryName] = useState('');
  const [inquiryPhone, setInquiryPhone] = useState('');
  const [inquiryEmail, setInquiryEmail] = useState('');
  const [inquiryNotes, setInquiryNotes] = useState('');
  const [inquiryLoading, setInquiryLoading] = useState(false);
  const [inquirySuccess, setInquirySuccess] = useState(false);
  const [inquiryError, setInquiryError] = useState('');

  // Memoized unique vehicle types derived from the vehicles list
  const uniqueVehicleTypes = useMemo(
    () => Array.from(new Set(vehicles.map(v => v.type).filter(Boolean))).sort(),
    [vehicles]
  );

  // Consignment search/filter state
  const [consignmentSearch, setConsignmentSearch] = useState('');
  const [consignmentStatusFilter, setConsignmentStatusFilter] = useState<'ALL' | 'PENDING' | 'PICKED_UP' | 'DELIVERED'>('ALL');
  const [consignmentDateFrom, setConsignmentDateFrom] = useState('');
  const [consignmentDateTo, setConsignmentDateTo] = useState('');
  const [showConsignmentFilters, setShowConsignmentFilters] = useState(false);

  // Consignment creation modal state
  const [showCreateConsignment, setShowCreateConsignment] = useState(false);

  // Consignment edit state
  const [editingConsignment, setEditingConsignment] = useState<Consignment | null>(null);
  const [showEditConsignment, setShowEditConsignment] = useState(false);
  const [editConsignmentForm, setEditConsignmentForm] = useState({
    senderName: '', senderPhone: '', receiverName: '', receiverPhone: '',
    type: '', weight: '', cod: 0, notes: '', status: 'PENDING' as 'PENDING' | 'PICKED_UP' | 'DELIVERED',
  });

  // Tours state (for customer-facing page)
  const [tours, setTours] = useState<TourItem[]>([]);

  // Customer profiles state
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);

  // Pending email-link sign-in data (set when the app is opened via a magic link)
  const [emailLinkPending, setEmailLinkPending] = useState<{ uid: string; email: string } | null>(null);
  const emailLinkProcessingRef = useRef(false);
  // State to prompt user to re-enter email when localStorage key is missing (cross-device scenario)
  const [emailLinkReenter, setEmailLinkReenter] = useState(false);

  // Agent CRUD state
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [agentForm, setAgentForm] = useState({ name: '', code: '', phone: '', email: '', address: '', commissionRate: 10, balance: 0, status: 'ACTIVE' as const, username: '', password: '', paymentType: 'POSTPAID' as 'POSTPAID' | 'PREPAID', creditLimit: 0, depositAmount: 0, holdTicketHours: 24, allowedPaymentOptions: [] as AgentPaymentOption[] });

  // Agent search / filter state
  const [agentSearch, setAgentSearch] = useState('');
  const [agentStatusFilter, setAgentStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [showAgentFilters, setShowAgentFilters] = useState(false);

  // Employee CRUD state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeForm, setEmployeeForm] = useState({ name: '', phone: '', email: '', address: '', role: 'STAFF', position: '', status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE', username: '', password: '', note: '' });
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeRoleFilter, setEmployeeRoleFilter] = useState<string>('ALL');
  const [showEmployeeFilters, setShowEmployeeFilters] = useState(false);

  // Route search state
  const [routeSearch, setRouteSearch] = useState('');
  const [showRouteFilters, setShowRouteFilters] = useState(false);
  const [routeFilterDeparture, setRouteFilterDeparture] = useState('');
  const [routeFilterArrival, setRouteFilterArrival] = useState('');

  // Vehicle search state
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [showVehicleFilters, setShowVehicleFilters] = useState(false);
  const [vehicleFilterType, setVehicleFilterType] = useState('');
  const [vehicleFilterStatus, setVehicleFilterStatus] = useState('ALL');

  // Trip / Operations search state
  const [tripSearch, setTripSearch] = useState('');
  const [tripDateQuickFilter, setTripDateQuickFilter] = useState<string>('');
  const [showTripAdvancedFilter, setShowTripAdvancedFilter] = useState(false);
  const [tripFilterRoute, setTripFilterRoute] = useState('');
  const [tripFilterStatus, setTripFilterStatus] = useState<string>('ALL');
  const [tripFilterDateFrom, setTripFilterDateFrom] = useState('');
  const [tripFilterDateTo, setTripFilterDateTo] = useState('');
  const [completedTripDateQuickFilter, setCompletedTripDateQuickFilter] = useState<string>('');
  const [showCompletedTripAdvancedFilter, setShowCompletedTripAdvancedFilter] = useState(false);
  const [completedTripFilterRoute, setCompletedTripFilterRoute] = useState('');
  const [completedTripFilterDateFrom, setCompletedTripFilterDateFrom] = useState('');
  const [completedTripFilterDateTo, setCompletedTripFilterDateTo] = useState('');

  // Route CRUD state
  const [showAddRoute, setShowAddRoute] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [isCopyingRoute, setIsCopyingRoute] = useState(false);
  const [routeForm, setRouteForm] = useState({ stt: 1, name: '', departurePoint: '', arrivalPoint: '', price: 0, agentPrice: 0, details: '', imageUrl: '', images: [] as string[], vehicleImageUrl: '', disablePickupAddress: false, disablePickupAddressFrom: '', disablePickupAddressTo: '', disableDropoffAddress: false, disableDropoffAddressFrom: '', disableDropoffAddressTo: '' });
  const [routePricePeriods, setRoutePricePeriods] = useState<PricePeriod[]>([]);
  const [showAddPricePeriod, setShowAddPricePeriod] = useState(false);
  const [pricePeriodForm, setPricePeriodForm] = useState({ name: '', price: 0, agentPrice: 0, startDate: '', endDate: '' });
  const [editingPricePeriodId, setEditingPricePeriodId] = useState<string | null>(null);
  const [routeSurcharges, setRouteSurcharges] = useState<RouteSurcharge[]>([]);
  const [showAddRouteSurcharge, setShowAddRouteSurcharge] = useState(false);
  const [routeSurchargeForm, setRouteSurchargeForm] = useState<Omit<RouteSurcharge, 'id'>>({ name: '', type: 'FUEL', amount: 0, isActive: true });
  const [editingRouteSurchargeId, setEditingRouteSurchargeId] = useState<string | null>(null);

  // Auto-generated stop IDs for departure and arrival (not real stops from the stops collection)
  const STOP_ID_DEPARTURE = '__departure__';
  const STOP_ID_ARRIVAL = '__arrival__';

  // Route stops (intermediate stops for a route)
  const [routeFormStops, setRouteFormStops] = useState<RouteStop[]>([]);
  const routeFormStopsRef = useRef<RouteStop[]>([]);
  useEffect(() => { routeFormStopsRef.current = routeFormStops; }, [routeFormStops]);
  // Ref to track current routeForm values (used in fare subscription to resolve stop names)
  const routeFormRef = useRef(routeForm);
  useEffect(() => { routeFormRef.current = routeForm; }, [routeForm]);
  // All route stops including auto-generated departure (__departure__) and arrival (__arrival__) entries.
  // Intermediate stops (routeFormStops) are re-numbered 1..N; departure is order 0, arrival is order N+1.
  const allRouteStops: RouteStop[] = useMemo(() => [
    ...(routeForm.departurePoint ? [{ stopId: STOP_ID_DEPARTURE, stopName: routeForm.departurePoint, order: 0 }] : []),
    ...routeFormStops.map((s, i) => ({ ...s, order: i + 1 })),
    ...(routeForm.arrivalPoint ? [{ stopId: STOP_ID_ARRIVAL, stopName: routeForm.arrivalPoint, order: routeFormStops.length + 1 }] : []),
  ], [routeForm.departurePoint, routeForm.arrivalPoint, routeFormStops]);
  const [showAddRouteStop, setShowAddRouteStop] = useState(false);
  const [editingRouteStop, setEditingRouteStop] = useState<RouteStop | null>(null);
  const [routeStopForm, setRouteStopForm] = useState({ stopId: '', stopName: '', order: 1 });
  // Undo history for route stop list and seat selection
  const [routeFormStopsHistory, setRouteFormStopsHistory] = useState<RouteStop[][]>([]);
  const [routeFormFaresHistory, setRouteFormFaresHistory] = useState<Array<Array<{ fromStopId: string; toStopId: string; fromName: string; toName: string; price: number; agentPrice: number; startDate: string; endDate: string }>>>([]);
  const [seatSelectionHistory, setSeatSelectionHistory] = useState<{primarySeat: string | null; extraSeats: string[]}[]>([]);

  // Fare table for route (retail + agent price per segment)
  const [routeFormFares, setRouteFormFares] = useState<Array<{ fromStopId: string; toStopId: string; fromName: string; toName: string; price: number; agentPrice: number; startDate: string; endDate: string }>>([]);
  // Tracks the fareDocIds (fromStopId_toStopId) that exist in Firestore for the route being edited.
  // Used in handleSaveRoute to delete fares the user removed from the local list.
  const originalFareDocIdsRef = useRef<Set<string>>(new Set());
  const [showAddRouteFare, setShowAddRouteFare] = useState(false);
  const [editingRouteFareIdx, setEditingRouteFareIdx] = useState<number | null>(null);
  const [routeFareForm, setRouteFareForm] = useState({ fromStopId: '', toStopId: '', price: 0, agentPrice: 0, startDate: '', endDate: '' });

  // Vehicle CRUD state
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [isCopyingVehicle, setIsCopyingVehicle] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({ licensePlate: '', type: 'Limousine 11 chỗ', seats: 11, registrationExpiry: '', status: 'ACTIVE', seatType: 'assigned' as 'assigned' | 'free' });

  // Vehicle seat diagram state
  const [diagramVehicle, setDiagramVehicle] = useState<Vehicle | null>(null);

  // Excel import refs removed

  // Trip CRUD state
  const [showAddTrip, setShowAddTrip] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [isCopyingTrip, setIsCopyingTrip] = useState(false);
  const [tripForm, setTripForm] = useState({ time: '', date: '', route: '', licensePlate: '', driverName: '', price: 0, agentPrice: 0, seatCount: 11, status: TripStatus.WAITING });

  // Batch trip creation state
  const [showBatchAddTrip, setShowBatchAddTrip] = useState(false);
  const [batchTripForm, setBatchTripForm] = useState({ date: '', route: '', licensePlate: '', driverName: '', price: 0, agentPrice: 0, seatCount: 11 });
  const [batchTimeSlots, setBatchTimeSlots] = useState<string[]>(['']);
  const [batchTripLoading, setBatchTripLoading] = useState(false);

  // Offline state (used only for UI connectivity indicator)
  const isOffline = !db;

  // Trip addon management state
  const [showTripAddons, setShowTripAddons] = useState<Trip | null>(null);
  const [showAddonDetailTrip, setShowAddonDetailTrip] = useState<Trip | null>(null);
  const [tripAddonForm, setTripAddonForm] = useState({ name: '', price: 0, description: '', type: 'OTHER' as 'SIGHTSEEING' | 'TRANSPORT' | 'FOOD' | 'OTHER' });
  const [showAddTripAddon, setShowAddTripAddon] = useState(false);
  // Addon quantities for the current booking: addonId -> quantity (0 means unselected)
  const [addonQuantities, setAddonQuantities] = useState<Record<string, number>>({});
  const [newConsignment, setNewConsignment] = useState({
    senderName: '', senderPhone: '', receiverName: '', receiverPhone: '',
    type: '', weight: '', cod: 0, notes: '',
  });

  // Column widths for each admin table
  const [agentColWidths, setAgentColWidths] = useState({ name: 200, username: 150, address: 200, phone: 150, commission: 130, balance: 150, status: 120, options: 120 });
  const [routeColWidths, setRouteColWidths] = useState({ stt: 80, name: 200, departure: 200, arrival: 200, price: 150, agentPrice: 150, options: 120 });
  const [vehicleColWidths, setVehicleColWidths] = useState({ stt: 80, licensePlate: 150, type: 150, seats: 100, expiry: 170, options: 160 });
  const [tripColWidths, setTripColWidths] = useState({ time: 180, licensePlate: 150, route: 220, driver: 180, status: 150, options: 180 });
  const [tripColVisibility, setTripColVisibility] = useState({ time: true, licensePlate: true, route: true, driver: true, status: true, seats: true, passengers: true, addons: true });
  const [showTripColPanel, setShowTripColPanel] = useState(false);
  const [showTripPassengers, setShowTripPassengers] = useState<Trip | null>(null);
  const [editingPassengerSeatId, setEditingPassengerSeatId] = useState<string | null>(null);
  const [passengerEditForm, setPassengerEditForm] = useState({ customerName: '', customerPhone: '', pickupAddress: '', dropoffAddress: '', status: SeatStatus.BOOKED as SeatStatus, bookingNote: '' });
  const [passengerColVisibility, setPassengerColVisibility] = useState({ ticketCode: true, seat: true, name: true, phone: true, pickup: true, dropoff: true, status: true, price: true, note: true });
  const [showPassengerColPanel, setShowPassengerColPanel] = useState(false);
  const [consignMgmtColWidths, setConsignMgmtColWidths] = useState({ code: 130, sender: 180, receiver: 180, goodsType: 130, weight: 100, cod: 130, notes: 160, status: 130, options: 100 });

  // Persist user session to localStorage so F5 doesn't log out
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('currentUser');
    }
  }, [currentUser]);

  // Subscribe to permissions from Firestore in real-time
  useEffect(() => {
    const unsubscribe = transportService.subscribeToPermissions((perms) => {
      if (perms) {
        setPermissions(perms);
        localStorage.setItem('daiichi_permissions', JSON.stringify(perms));
      }
    });
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  // Ensure agents and guests start on the home page
  useEffect(() => {
    if (currentUser && (currentUser.role === UserRole.AGENT || currentUser.role === UserRole.CUSTOMER || currentUser.role === UserRole.GUEST)) {
      setActiveTab('home');
    }
  }, [currentUser]);

  // WebSocket setup
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'NEW_BOOKING') {
          setNotifications(prev => [{ ...data, id: Date.now() }, ...prev].slice(0, 5));
          // Auto remove notification after 5 seconds
          setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== data.id));
          }, 5000);
        }
      } catch (e) {
        console.error("Failed to parse WS message", e);
      }
    };

    setWs(socket);
    return () => socket.close();
  }, []);

  // Credential states
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [adminCredentials, setAdminCredentials] = useState({ username: 'admin', password: 'admin' });
  const [securityConfig, setSecurityConfig] = useState<{ phoneVerificationEnabled: boolean; phoneNumbers: string[] }>({ phoneVerificationEnabled: false, phoneNumbers: [] });

  // Subscribe to admin credentials changes in real-time
  useEffect(() => {
    const unsubscribe = transportService.subscribeToAdminSettings((saved) => {
      if (saved) setAdminCredentials(saved);
    });
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  // Subscribe to security config changes in real-time
  useEffect(() => {
    const unsubscribe = transportService.subscribeToSecurityConfig((saved) => {
      if (saved && typeof saved === 'object') {
        setSecurityConfig({
          phoneVerificationEnabled: typeof saved.phoneVerificationEnabled === 'boolean' ? saved.phoneVerificationEnabled : false,
          phoneNumbers: Array.isArray(saved.phoneNumbers) ? (saved.phoneNumbers as string[]) : [],
        });
      }
    });
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  // Booking form inputs
  const [customerNameInput, setCustomerNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [childrenAges, setChildrenAges] = useState<(number | undefined)[]>([]);
  const [tripCardImgIdx, setTripCardImgIdx] = useState<Record<string, number>>({});
  const [paymentMethodInput, setPaymentMethodInput] = useState<PaymentMethod>(DEFAULT_PAYMENT_METHOD);
  const [extraSeatIds, setExtraSeatIds] = useState<string[]>([]);
  const [bookingNote, setBookingNote] = useState('');
  // QR Payment flow state – holds the callback to execute after user confirms QR payment
  const [pendingQrBooking, setPendingQrBooking] = useState<{ amount: number; ref: string; label: string; execute: () => Promise<void> } | null>(null);
  // Ticket Modal State
  const [isTicketOpen, setIsTicketOpen] = useState(false);
  const [lastBooking, setLastBooking] = useState<any>(null);

  const t = TRANSLATIONS[language];

  useEffect(() => {
    const unsubscribeTrips = transportService.subscribeToTrips(setTrips);
    const unsubscribeConsignments = transportService.subscribeToConsignments(setConsignments);
    const unsubscribeAgents = transportService.subscribeToAgents((data) => { setAgents(data); setAgentsLoading(false); });
    const unsubscribeStops = transportService.subscribeToStops(setStops);
    const unsubscribeRoutes = transportService.subscribeToRoutes(setRoutes);
    const unsubscribeVehicles = transportService.subscribeToVehicles(setVehicles);
    const unsubscribeTours = transportService.subscribeToTours(setTours);
    const unsubscribeEmployees = transportService.subscribeToEmployees(setEmployees);
    const unsubscribeBookings = transportService.subscribeToBookings(setBookings);
    const unsubscribeUserGuides = transportService.subscribeToUserGuides(setUserGuides);
    const unsubscribeCustomers = transportService.subscribeToCustomers(setCustomers);
    return () => {
      unsubscribeTrips();
      unsubscribeConsignments();
      unsubscribeAgents();
      unsubscribeStops();
      unsubscribeRoutes();
      unsubscribeVehicles();
      unsubscribeTours();
      unsubscribeEmployees();
      unsubscribeBookings();
      unsubscribeUserGuides();
      unsubscribeCustomers();
    };
  }, []);

  // Subscribe to invoices only when Firebase Auth is available (invoices require auth for Firestore reads/writes).
  // onAuthStateChanged re-subscribes automatically after login so the list is always up-to-date.
  useEffect(() => {
    if (!auth) {
      // No Firebase Auth configured – subscribe anyway (will work if rules are relaxed)
      return transportService.subscribeToInvoices(setInvoices);
    }
    let invoiceUnsub: (() => void) | null = null;
    const authUnsub = onAuthStateChanged(auth, (user) => {
      if (invoiceUnsub) { invoiceUnsub(); invoiceUnsub = null; }
      if (user) {
        invoiceUnsub = transportService.subscribeToInvoices(setInvoices);
      } else {
        setInvoices([]);
      }
    });
    return () => {
      authUnsub();
      if (invoiceUnsub) invoiceUnsub();
    };
  }, []);

  // Detect Firebase email link sign-in on page load (magic link redirect)
  useEffect(() => {
    if (!auth) return;
    if (!isSignInWithEmailLink(auth, window.location.href)) return;
    const email = window.localStorage.getItem('emailForSignIn');
    if (!email) {
      // Email not found in localStorage (e.g. opened on a different device) –
      // show the re-enter form instead of using a blocking window.prompt().
      setEmailLinkReenter(true);
      return;
    }
    signInWithEmailLink(auth, email, window.location.href)
      .then(result => {
        window.localStorage.removeItem('emailForSignIn');
        // Clean the URL so the oobCode doesn't persist
        window.history.replaceState(null, '', window.location.pathname);
        setEmailLinkPending({ uid: result.user.uid, email: result.user.email || email });
      })
      .catch(err => {
        console.error('[EmailLink] Sign-in failed:', err);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Complete the email-link login once customer data has loaded
  useEffect(() => {
    if (!emailLinkPending || emailLinkProcessingRef.current) return;
    emailLinkProcessingRef.current = true;
    handleOtpMemberLogin({
      uid: emailLinkPending.uid,
      email: emailLinkPending.email,
      loginMethod: 'email',
    }).then(user => {
      if (user) {
        setCurrentUser(user);
        setEmailLinkPending(null);
      }
      emailLinkProcessingRef.current = false;
    }).catch(err => {
      console.error('[EmailLink] Profile creation failed:', err);
      setEmailLinkPending(null);
      emailLinkProcessingRef.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailLinkPending, customers]);

  // Subscribe to route fares in real-time when the route edit modal is open
  const [routeModalEditingId, setRouteModalEditingId] = useState<string | null>(null);
  const [routeImageUploading, setRouteImageUploading] = useState(false);
  useEffect(() => {
    if (!routeModalEditingId) return;
    // Reset tracked original IDs for this editing session
    originalFareDocIdsRef.current = new Set();
    let initialLoadDone = false;
    const unsubFares = transportService.subscribeToRouteFares(routeModalEditingId, (fares) => {
      const currentStops = routeFormStopsRef.current;
      // On first callback, record which fareDocIds exist in Firestore
      if (!initialLoadDone) {
        originalFareDocIdsRef.current = new Set(fares.map(f => `${f.fromStopId}_${f.toStopId}`));
        initialLoadDone = true;
      }
      const resolveStopName = (stopId: string) => {
        if (stopId === '__departure__') return routeFormRef.current.departurePoint || stopId;
        if (stopId === '__arrival__') return routeFormRef.current.arrivalPoint || stopId;
        return currentStops.find(s => s.stopId === stopId)?.stopName || stopId;
      };
      setRouteFormFares(fares.filter(f => f.active !== false).map(f => ({
        fromStopId: f.fromStopId,
        toStopId: f.toStopId,
        fromName: resolveStopName(f.fromStopId),
        toName: resolveStopName(f.toStopId),
        price: f.price,
        agentPrice: f.agentPrice || 0,
        startDate: f.startDate || '',
        endDate: f.endDate || '',
      })));
    });
    return () => unsubFares();
  }, [routeModalEditingId]);

  // Reset inquiry form state when search parameters change
  useEffect(() => {
    setShowInquiryForm(false);
    setInquirySuccess(false);
    setInquiryError('');
  }, [searchFrom, searchTo, searchDate, searchReturnDate, tripType]);

  // Reset round-trip phase when switching back to ONE_WAY
  useEffect(() => {
    if (tripType === 'ONE_WAY') {
      setRoundTripPhase('outbound');
      setOutboundBookingData(null);
    }
  }, [tripType]);

  // Auto-fill name & phone for logged-in customers whenever the booking form opens or user logs in
  useEffect(() => {
    if (showBookingForm && currentUser?.role === UserRole.CUSTOMER) {
      const name = currentUser.name;
      const phone = currentUser.phone;
      if (name) setCustomerNameInput(prev => prev || name);
      if (phone) setPhoneInput(prev => prev || phone);
    }
  }, [showBookingForm, currentUser?.role, currentUser?.name, currentUser?.phone]);

  // Global Ctrl+Z / Cmd+Z undo handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key !== 'z') return;
      // Undo in route form (when adding or editing a route)
      if (showAddRoute) {
        e.preventDefault();
        if (routeFormStopsHistory.length > 0) {
          const lastStops = routeFormStopsHistory[routeFormStopsHistory.length - 1];
          const lastFares = routeFormFaresHistory[routeFormFaresHistory.length - 1] ?? [];
          setRouteFormStops(lastStops);
          setRouteFormFares(lastFares);
          setRouteFormStopsHistory(prev => prev.slice(0, -1));
          setRouteFormFaresHistory(prev => prev.slice(0, -1));
        }
        return;
      }
      // Undo in seat booking (when on seat-mapping tab with booking form open)
      if (activeTab === 'seat-mapping' && !isTicketOpen && seatSelectionHistory.length > 0) {
        e.preventDefault();
        const last = seatSelectionHistory[seatSelectionHistory.length - 1];
        setShowBookingForm(last.primarySeat);
        setExtraSeatIds(last.extraSeats);
        setSeatSelectionHistory(prev => prev.slice(0, -1));
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showAddRoute, activeTab, isTicketOpen, routeFormStopsHistory, routeFormFaresHistory, seatSelectionHistory]);

  // --- Tour like handler ---
  const toggleLike = (tourId: string) => {
    setLikedTours(prev => {
      const next = new Set(prev);
      if (next.has(tourId)) {
        next.delete(tourId);
      } else {
        next.add(tourId);
      }
      try { localStorage.setItem('likedTours', JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  // --- Agent CRUD handlers ---
  const handleSaveAgent = async () => {
    try {
      if (editingAgent) {
        await transportService.updateAgent(editingAgent.id, agentForm);
      } else {
        await transportService.addAgent(agentForm);
      }
      setShowAddAgent(false);
      setEditingAgent(null);
      setAgentForm({ name: '', code: '', phone: '', email: '', address: '', commissionRate: 10, balance: 0, status: 'ACTIVE', username: '', password: '', paymentType: 'POSTPAID', creditLimit: 0, depositAmount: 0, holdTicketHours: 24, allowedPaymentOptions: [] });
    } catch (err) {
      console.error('Failed to save agent:', err);
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (!window.confirm(language === 'vi' ? 'Bạn có chắc muốn xóa đại lý này?' : 'Delete this agent?')) return;
    try {
      await transportService.deleteAgent(agentId);
    } catch (err) {
      console.error('Failed to delete agent:', err);
    }
  };

  const handleStartEditAgent = (agent: Agent) => {
    setEditingAgent(agent);
    setAgentForm({ name: String(agent.name ?? ''), code: String(agent.code ?? ''), phone: String(agent.phone ?? ''), email: String(agent.email ?? ''), address: String(agent.address ?? ''), commissionRate: agent.commissionRate, balance: agent.balance, status: agent.status, username: String(agent.username ?? ''), password: String(agent.password ?? ''), paymentType: agent.paymentType ?? 'POSTPAID', creditLimit: agent.creditLimit ?? 0, depositAmount: agent.depositAmount ?? 0, holdTicketHours: agent.holdTicketHours ?? 24, allowedPaymentOptions: agent.allowedPaymentOptions ?? [] });
    setShowAddAgent(true);
  };

  const handleSaveAgentNote = async (agentId: string, note: string) => {
    try {
      await transportService.updateAgent(agentId, { note } as Partial<Agent>);
    } catch (err) {
      console.error('Failed to save agent note:', err);
    }
  };

  // --- Employee CRUD handlers ---
  const handleSaveEmployee = async () => {
    try {
      if (editingEmployee) {
        await transportService.updateEmployee(editingEmployee.id, employeeForm);
      } else {
        await transportService.addEmployee(employeeForm);
      }
      setShowAddEmployee(false);
      setEditingEmployee(null);
      setEmployeeForm({ name: '', phone: '', email: '', address: '', role: 'STAFF', position: '', status: 'ACTIVE', username: '', password: '', note: '' });
    } catch (err) {
      console.error('Failed to save employee:', err);
    }
  };

  const handleDeleteEmployee = async (employeeId: string) => {
    if (!window.confirm(language === 'vi' ? 'Bạn có chắc muốn xóa nhân viên này?' : 'Delete this employee?')) return;
    try {
      await transportService.deleteEmployee(employeeId);
    } catch (err) {
      console.error('Failed to delete employee:', err);
    }
  };

  const handleStartEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    setEmployeeForm({ name: String(employee.name ?? ''), phone: String(employee.phone ?? ''), email: String(employee.email ?? ''), address: String(employee.address ?? ''), role: employee.role, position: String(employee.position ?? ''), status: employee.status, username: String(employee.username ?? ''), password: String(employee.password ?? ''), note: String(employee.note ?? '') });
    setShowAddEmployee(true);
  };


  // --- Route CRUD handlers ---
  const handleSaveRoute = async () => {
    try {
      // Build full routeStops: auto-generated departure/arrival + user-defined intermediate stops
      const intermediateStops = routeFormStops.map((s, i) => ({ ...s, order: i + 1 }));
      const fullRouteStops: RouteStop[] = [
        ...(routeForm.departurePoint ? [{ stopId: '__departure__', stopName: routeForm.departurePoint, order: 0 }] : []),
        ...intermediateStops,
        ...(routeForm.arrivalPoint ? [{ stopId: '__arrival__', stopName: routeForm.arrivalPoint, order: intermediateStops.length + 1 }] : []),
      ];
      const routeData = { ...routeForm, pricePeriods: routePricePeriods, surcharges: routeSurcharges, routeStops: fullRouteStops };
      let routeId = editingRoute?.id;
      if (editingRoute) {
        await transportService.updateRoute(editingRoute.id, routeData);
      } else {
        const docRef = await transportService.addRoute(routeData);
        routeId = docRef?.id;
      }
      // Save fare table entries: upsert current fares and delete removed ones
      if (routeId) {
        // Upsert all current fares, saving their display index as sortOrder
        for (let fareIdx = 0; fareIdx < routeFormFares.length; fareIdx++) {
          const fare = routeFormFares[fareIdx];
          try {
            await transportService.upsertFare(routeId, fare.fromStopId, fare.toStopId, fare.price, fare.agentPrice > 0 ? fare.agentPrice : undefined, 'VND', fare.startDate || undefined, fare.endDate || undefined, fareIdx);
          } catch (err) {
            console.error('Failed to save fare:', fare, err);
          }
        }
        // Delete fares that existed in Firestore but were removed by the user
        const currentFareDocIds = new Set(routeFormFares.map(f => `${f.fromStopId}_${f.toStopId}`));
        for (const originalId of originalFareDocIdsRef.current) {
          if (!currentFareDocIds.has(originalId)) {
            try {
              await transportService.deleteFare(routeId, originalId);
            } catch (err) {
              console.error('Failed to delete fare:', originalId, err);
            }
          }
        }
        originalFareDocIdsRef.current = new Set();
      }
      setShowAddRoute(false);
      setEditingRoute(null);
      setIsCopyingRoute(false);
      setRouteForm({ stt: 1, name: '', departurePoint: '', arrivalPoint: '', price: 0, agentPrice: 0, details: '', imageUrl: '', images: [], vehicleImageUrl: '', disablePickupAddress: false, disablePickupAddressFrom: '', disablePickupAddressTo: '', disableDropoffAddress: false, disableDropoffAddressFrom: '', disableDropoffAddressTo: '' });
    } catch (err) {
      console.error('Failed to save route:', err);
    }
  };

  // Upload one or more route destination images and append their URLs to routeForm.images
  const handleRouteImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !storage) {
      if (!storage) alert('Firebase Storage is not configured.');
      return;
    }
    setRouteImageUploading(true);
    try {
      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const compressed = await compressImage(file, 0.75, 1280);
        const sRef = storageRef(storage, `routes/${Date.now()}_${compressed.name}`);
        const task = uploadBytesResumable(sRef, compressed, { contentType: 'image/jpeg' });
        await new Promise<void>((resolve, reject) => {
          task.on('state_changed', undefined,
            (err) => { console.error('Upload error:', err); reject(err); },
            async () => {
              const url = await getDownloadURL(task.snapshot.ref);
              urls.push(url);
              resolve();
            }
          );
        });
      }
      setRouteForm(prev => {
        const combined = [...(prev.images || []), ...urls];
        return { ...prev, images: combined, imageUrl: combined[0] || '' };
      });
    } catch (err) {
      console.error('Route image upload failed:', err);
      alert('Upload failed. Please check your Firebase configuration.');
    } finally {
      setRouteImageUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteRoute = async (routeId: string) => {
    if (!window.confirm(language === 'vi' ? 'Bạn có chắc muốn xóa tuyến này?' : 'Delete this route?')) return;
    try {
      await transportService.deleteRoute(routeId);
    } catch (err) {
      console.error('Failed to delete route:', err);
    }
  };

  const handleStartEditRoute = (route: Route) => {
    setEditingRoute(route);
    setIsCopyingRoute(false);
    setRouteForm({ stt: route.stt, name: route.name, departurePoint: route.departurePoint, arrivalPoint: route.arrivalPoint, price: route.price, agentPrice: route.agentPrice || 0, details: route.details || '', imageUrl: route.imageUrl || '', images: route.images || [], vehicleImageUrl: route.vehicleImageUrl || '', disablePickupAddress: route.disablePickupAddress || false, disablePickupAddressFrom: route.disablePickupAddressFrom || '', disablePickupAddressTo: route.disablePickupAddressTo || '', disableDropoffAddress: route.disableDropoffAddress || false, disableDropoffAddressFrom: route.disableDropoffAddressFrom || '', disableDropoffAddressTo: route.disableDropoffAddressTo || '' });
    setRoutePricePeriods(route.pricePeriods || []);
    setRouteSurcharges(route.surcharges || []);
    setShowAddPricePeriod(false);
    setEditingPricePeriodId(null);
    setShowAddRouteSurcharge(false);
    setEditingRouteSurchargeId(null);
    // Load route stops – filter out auto-generated departure/arrival stops so only intermediate stops are editable
    const loadedStops = (route.routeStops || [])
      .filter(s => s.stopId !== '__departure__' && s.stopId !== '__arrival__')
      .slice().sort((a, b) => a.order - b.order)
      .map((s, i) => ({ ...s, order: i + 1 }));
    setRouteFormStops(loadedStops);
    setShowAddRouteStop(false);
    // Clear fares and subscribe to real-time updates for this route
    setRouteFormFares([]);
    setShowAddRouteFare(false);
    setEditingRouteFareIdx(null);
    setRouteModalEditingId(route.id || null);
    setRouteFormStopsHistory([]);
    setRouteFormFaresHistory([]);
    setShowAddRoute(true);
  };

  const handleSaveRouteNote = async (routeId: string, note: string) => {
    try {
      await transportService.updateRoute(routeId, { note });
    } catch (err) {
      console.error('Failed to save route note:', err);
    }
  };

  // Open the add-route modal pre-filled from an existing route (copy mode – no ID)
  const handleCopyRoute = (route: Route) => {
    setEditingRoute(null);
    setIsCopyingRoute(true);
    const copySuffix = language === 'vi' ? ' (bản sao)' : language === 'ja' ? '（コピー）' : ' (copy)';
    const copiedName = `${route.name}${copySuffix}`;
    setRouteForm({ stt: routes.length + 1, name: copiedName, departurePoint: route.departurePoint, arrivalPoint: route.arrivalPoint, price: route.price, agentPrice: route.agentPrice || 0, details: route.details || '', imageUrl: route.imageUrl || '', images: route.images || [], vehicleImageUrl: route.vehicleImageUrl || '', disablePickupAddress: route.disablePickupAddress || false, disablePickupAddressFrom: route.disablePickupAddressFrom || '', disablePickupAddressTo: route.disablePickupAddressTo || '', disableDropoffAddress: route.disableDropoffAddress || false, disableDropoffAddressFrom: route.disableDropoffAddressFrom || '', disableDropoffAddressTo: route.disableDropoffAddressTo || '' });
    const now = Date.now();
    setRoutePricePeriods((route.pricePeriods || []).map((p, i) => ({ ...p, id: `pp_${now}_${i}` })));
    setRouteSurcharges((route.surcharges || []).map((s, i) => ({ ...s, id: `sc_${now}_${i}` })));
    const loadedStops = (route.routeStops || [])
      .filter(s => s.stopId !== '__departure__' && s.stopId !== '__arrival__')
      .slice().sort((a, b) => a.order - b.order)
      .map((s, i) => ({ ...s, order: i + 1 }));
    setRouteFormStops(loadedStops);
    setShowAddPricePeriod(false);
    setEditingPricePeriodId(null);
    setShowAddRouteSurcharge(false);
    setEditingRouteSurchargeId(null);
    setShowAddRouteStop(false);
    setRouteFormFares([]);
    setShowAddRouteFare(false);
    setEditingRouteFareIdx(null);
    // No real-time subscription for copy (no ID yet); load fares once as initial values
    setRouteModalEditingId(null);
    setRouteFormStopsHistory([]);
    setRouteFormFaresHistory([]);
    if (route.id) {
      transportService.getRouteFares(route.id).then((fares) => {
        const allStops = [
          ...(route.departurePoint ? [{ stopId: '__departure__', stopName: route.departurePoint }] : []),
          ...loadedStops,
          ...(route.arrivalPoint ? [{ stopId: '__arrival__', stopName: route.arrivalPoint }] : []),
        ];
        setRouteFormFares(fares.filter(f => f.active !== false).map(f => ({
          fromStopId: f.fromStopId,
          toStopId: f.toStopId,
          fromName: allStops.find(s => s.stopId === f.fromStopId)?.stopName || f.fromStopId,
          toName: allStops.find(s => s.stopId === f.toStopId)?.stopName || f.toStopId,
          price: f.price,
          agentPrice: f.agentPrice || 0,
          startDate: f.startDate || '',
          endDate: f.endDate || '',
        })));
      }).catch((err) => { console.error('Failed to load route fares for copy:', err); });
    }
    setShowAddRoute(true);
  };

  // --- Vehicle CRUD handlers ---
  const handleSaveVehicle = async () => {
    try {
      if (editingVehicle) {
        await transportService.updateVehicle(editingVehicle.id, vehicleForm as Record<string, unknown>);
      } else {
        await transportService.addVehicle(vehicleForm as Record<string, unknown>);
      }
      setShowAddVehicle(false);
      setEditingVehicle(null);
      setIsCopyingVehicle(false);
      setVehicleForm({ licensePlate: '', type: 'Limousine 11 chỗ', seats: 11, registrationExpiry: '', status: 'ACTIVE', seatType: 'assigned' });
    } catch (err) {
      console.error('Failed to save vehicle:', err);
    }
  };

  const handleStartEditVehicle = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setIsCopyingVehicle(false);
    setVehicleForm({ licensePlate: vehicle.licensePlate, type: vehicle.type, seats: vehicle.seats, registrationExpiry: vehicle.registrationExpiry, status: vehicle.status || 'ACTIVE', seatType: vehicle.seatType || 'assigned' });
    setShowAddVehicle(true);
  };

  const handleCopyVehicle = (vehicle: Vehicle) => {
    setEditingVehicle(null);
    setIsCopyingVehicle(true);
    setVehicleForm({ licensePlate: '', type: vehicle.type, seats: vehicle.seats, registrationExpiry: vehicle.registrationExpiry, status: vehicle.status || 'ACTIVE', seatType: vehicle.seatType || 'assigned' });
    setShowAddVehicle(true);
  };

  const handleSaveVehicleLayout = async (seats: SerializedSeat[]) => {
    if (!diagramVehicle) return;
    try {
      await transportService.updateVehicle(diagramVehicle.id, { layout: seats } as Record<string, unknown>);
      setVehicles(prev => prev.map(v => v.id === diagramVehicle.id ? { ...v, layout: seats as any } : v));
    } catch (err) {
      console.error('Failed to save vehicle layout:', err);
    }
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    if (!window.confirm(language === 'vi' ? 'Bạn có chắc muốn xóa phương tiện này?' : 'Delete this vehicle?')) return;
    try {
      await transportService.deleteVehicle(vehicleId);
    } catch (err) {
      console.error('Failed to delete vehicle:', err);
    }
  };

  const handleSaveVehicleNote = async (vehicleId: string, note: string) => {
    try {
      await transportService.updateVehicle(vehicleId, { note } as Record<string, unknown>);
    } catch (err) {
      console.error('Failed to save vehicle note:', err);
    }
  };

  // --- Trip CRUD handlers ---
  const formatTripDisplayTime = (trip: { time: string; date?: string }) =>
    trip.date ? `${trip.date} ${trip.time}` : trip.time;

  const getDayOfWeekStr = (dateStr: string): string => {
    const [y, m, day] = dateStr.split('-').map(Number);
    const d = new Date(y, m - 1, day);
    const days: Record<Language, string[]> = {
      vi: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'],
      en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      ja: ['日', '月', '火', '水', '木', '金', '土'],
    };
    return days[language][d.getDay()];
  };

  const formatTripDateDisplay = (dateStr: string): string => {
    const [y, m, day] = dateStr.split('-').map(Number);
    const d = new Date(y, m - 1, day);
    const dow = getDayOfWeekStr(dateStr);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dow}, ${dd}/${mm}`;
  };

  const getLocalDateString = (offsetDays: number = 0): string => {
    // Get today in Vietnam timezone as a YYYY-MM-DD string, then offset from that date
    const todayVN = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const d = new Date(todayVN + 'T00:00:00');
    d.setDate(d.getDate() + offsetDays);
    return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  };

  const getOffsetDayLabel = (offsetDays: number): string => {
    const todayVN = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const d = new Date(todayVN + 'T00:00:00');
    d.setDate(d.getDate() + offsetDays);
    return d.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
  };

  const compareTripDateTime = (a: { date?: string; time?: string }, b: { date?: string; time?: string }) => {
    const aDate = a.date || '9999-12-31';
    const aTime = a.time || '23:59';
    const bDate = b.date || '9999-12-31';
    const bTime = b.time || '23:59';
    const aKey = `${aDate}T${aTime}`;
    const bKey = `${bDate}T${bTime}`;
    return aKey.localeCompare(bKey);
  };

  const handleSaveTrip = async () => {
    try {
      const seats = buildSeatsForVehicle(tripForm.licensePlate, tripForm.seatCount);
      const tripVehicle = vehicles.find(v => v.licensePlate === tripForm.licensePlate);
      const seatType = tripVehicle?.seatType || 'assigned';
      if (editingTrip) {
        await transportService.updateTrip(editingTrip.id, { time: tripForm.time, date: tripForm.date, route: tripForm.route, licensePlate: tripForm.licensePlate, driverName: tripForm.driverName, price: tripForm.price, agentPrice: tripForm.agentPrice, status: tripForm.status });
      } else {
        await transportService.addTrip({ time: tripForm.time, date: tripForm.date, route: tripForm.route, licensePlate: tripForm.licensePlate, driverName: tripForm.driverName, price: tripForm.price, agentPrice: tripForm.agentPrice, status: tripForm.status, seats, addons: [], seatType });
      }
      setShowAddTrip(false);
      setEditingTrip(null);
      setIsCopyingTrip(false);
      setTripForm({ time: '', date: '', route: '', licensePlate: '', driverName: '', price: 0, agentPrice: 0, seatCount: 11, status: TripStatus.WAITING });
    } catch (err) {
      console.error('Failed to save trip:', err);
    }
  };

  const handleStartEditTrip = (trip: Trip) => {
    setEditingTrip(trip);
    setIsCopyingTrip(false);
    setTripForm({ time: trip.time, date: trip.date || '', route: trip.route, licensePlate: trip.licensePlate, driverName: trip.driverName, price: trip.price, agentPrice: trip.agentPrice || 0, seatCount: trip.seats?.length || 11, status: trip.status });
    setShowAddTrip(true);
  };

  // Open the add-trip modal pre-filled from an existing trip (copy mode – no ID, fresh seats)
  const handleCopyTrip = (trip: Trip) => {
    setEditingTrip(null);
    setIsCopyingTrip(true);
    setTripForm({ time: trip.time, date: '', route: trip.route, licensePlate: trip.licensePlate, driverName: trip.driverName, price: trip.price, agentPrice: trip.agentPrice || 0, seatCount: trip.seats?.length || 11, status: TripStatus.WAITING });
    setShowAddTrip(true);
  };

  // Open the batch-add modal pre-filled with time slots from selected trips
  const handleCopyTripsToDate = (sourceTrips: Trip[]) => {
    const times = sourceTrips.map(t => t.time).filter(Boolean);
    const firstTrip = sourceTrips[0];
    setBatchTripForm({ date: '', route: firstTrip?.route || '', licensePlate: firstTrip?.licensePlate || '', driverName: firstTrip?.driverName || '', price: firstTrip?.price || 0, agentPrice: firstTrip?.agentPrice || 0, seatCount: firstTrip?.seats?.length || 11 });
    setBatchTimeSlots(times.length > 0 ? times : ['']);
    setShowBatchAddTrip(true);
  };

  const handleDeleteTrip = async (tripId: string) => {
    if (!window.confirm(language === 'vi' ? 'Bạn có chắc muốn xóa chuyến này?' : 'Delete this trip?')) return;
    try {
      await transportService.deleteTrip(tripId);
    } catch (err) {
      console.error('Failed to delete trip:', err);
    }
  };

  const handleSaveTripNote = async (tripId: string, note: string) => {
    try {
      await transportService.updateTrip(tripId, { note } as Partial<Trip>);
    } catch (err) {
      console.error('Failed to save trip note:', err);
    }
  };

  const handleClosePassengerModal = () => {
    setShowTripPassengers(null);
    setEditingPassengerSeatId(null);
    setShowPassengerColPanel(false);
  };

  const handleSavePassengerEdit = async () => {
    if (!showTripPassengers || !editingPassengerSeatId) return;
    const updates = {
      customerName: passengerEditForm.customerName,
      customerPhone: passengerEditForm.customerPhone,
      pickupAddress: passengerEditForm.pickupAddress,
      dropoffAddress: passengerEditForm.dropoffAddress,
      status: passengerEditForm.status,
      bookingNote: passengerEditForm.bookingNote,
    };
    try {
      // Sync changes to the corresponding booking document
      const matchingBooking = bookings.find(b =>
        b.tripId === showTripPassengers.id &&
        (b.seatId === editingPassengerSeatId || (b.seatIds && b.seatIds.includes(editingPassengerSeatId)))
      );
      // All seat IDs in this booking group (for group bookings)
      const groupSeatIds = getBookingGroupSeatIds(matchingBooking, editingPassengerSeatId);

      // Update all seats in the group
      await Promise.all(groupSeatIds.map((sid: string) =>
        transportService.bookSeat(showTripPassengers.id, sid, updates)
      ));

      if (matchingBooking) {
        if (passengerEditForm.status === SeatStatus.EMPTY) {
          await transportService.deleteBooking(matchingBooking.id);
        } else {
          await transportService.updateBooking(matchingBooking.id, {
            customerName: passengerEditForm.customerName,
            phone: passengerEditForm.customerPhone,
            pickupAddress: passengerEditForm.pickupAddress,
            dropoffAddress: passengerEditForm.dropoffAddress,
            bookingNote: passengerEditForm.bookingNote,
            status: passengerEditForm.status === SeatStatus.PAID ? 'PAID' : 'BOOKED',
          });
        }
      }

      setTrips(prev => prev.map(trip => {
        if (trip.id !== showTripPassengers.id) return trip;
        const updatedSeats = trip.seats.map((s: any) =>
          groupSeatIds.includes(s.id) ? { ...s, ...updates } : s
        );
        const updatedTrip = { ...trip, seats: updatedSeats };
        setShowTripPassengers(updatedTrip);
        return updatedTrip;
      }));
      setEditingPassengerSeatId(null);
    } catch (err) {
      console.error('Failed to save passenger:', err);
    }
  };

  const handleDeletePassenger = async (seatId: string) => {
    if (!showTripPassengers) return;
    const confirmMsg = language === 'vi'
      ? 'Bạn có chắc muốn xóa hành khách này khỏi ghế không?'
      : 'Are you sure you want to remove this passenger from the seat?';
    if (!window.confirm(confirmMsg)) return;
    const emptyData = {
      status: SeatStatus.EMPTY,
      customerName: '',
      customerPhone: '',
      pickupPoint: '',
      dropoffPoint: '',
      pickupAddress: '',
      dropoffAddress: '',
      bookingNote: '',
    };
    try {
      // Sync: delete the corresponding booking document
      const matchingBooking = bookings.find(b =>
        b.tripId === showTripPassengers.id &&
        (b.seatId === seatId || (b.seatIds && b.seatIds.includes(seatId)))
      );
      // All seat IDs in this booking group (clear all for group bookings)
      const groupSeatIds = getBookingGroupSeatIds(matchingBooking, seatId);

      await Promise.all(groupSeatIds.map((sid: string) =>
        transportService.bookSeat(showTripPassengers.id, sid, emptyData)
      ));

      if (matchingBooking) {
        await transportService.deleteBooking(matchingBooking.id);
      }

      setTrips(prev => prev.map(trip => {
        if (trip.id !== showTripPassengers.id) return trip;
        const updatedSeats = trip.seats.map((s: any) =>
          groupSeatIds.includes(s.id) ? { ...s, ...emptyData } : s
        );
        const updatedTrip = { ...trip, seats: updatedSeats };
        setShowTripPassengers(updatedTrip);
        return updatedTrip;
      }));
      if (editingPassengerSeatId && groupSeatIds.includes(editingPassengerSeatId)) setEditingPassengerSeatId(null);
    } catch (err) {
      console.error('Failed to delete passenger:', err);
    }
  };

  const buildSeatTicketCodeMap = (tripId: string): Map<string, string> => {
    const map = new Map<string, string>();
    for (const bk of bookings) {
      if (bk.tripId !== tripId) continue;
      if (bk.ticketCode) {
        if (bk.seatId) map.set(bk.seatId, bk.ticketCode);
        if (bk.seatIds) {
          for (const sid of bk.seatIds) map.set(sid, bk.ticketCode);
        }
      }
    }
    return map;
  };

  // Helper: get all seat IDs in the same booking group as the given seatId
  const getBookingGroupSeatIds = (matchingBooking: any, fallbackSeatId: string): string[] => {
    if (!matchingBooking) return [fallbackSeatId];
    return matchingBooking.seatIds || (matchingBooking.seatId ? [matchingBooking.seatId] : [fallbackSeatId]);
  };

  // Helper: group booked seats by booking for a trip – returns ordered list of booking groups
  const buildPassengerGroups = (tripId: string, bookedSeats: any[]): { booking: any; seats: any[] }[] => {
    const seatToBookingMap = new Map<string, any>();
    for (const bk of bookings) {
      if (bk.tripId !== tripId) continue;
      if (bk.seatId) seatToBookingMap.set(bk.seatId, bk);
      if (bk.seatIds) { for (const sid of bk.seatIds) seatToBookingMap.set(sid, bk); }
    }
    const groupMap = new Map<string, { booking: any; seats: any[] }>();
    for (const seat of bookedSeats) {
      const bk = seatToBookingMap.get(seat.id);
      const key = bk?.id || bk?.ticketCode || `__${seat.id}`;
      if (!groupMap.has(key)) groupMap.set(key, { booking: bk, seats: [] });
      groupMap.get(key)!.seats.push(seat);
    }
    return [...groupMap.values()];
  };

  const COMPANY_LOGO_URL = 'https://firebasestorage.googleapis.com/v0/b/daiichitravel-f49fd.firebasestorage.app/o/daiichilogo.png?alt=media&token=bcc9d130-5370-42e2-b0f6-d0b4a3b32724';

  const exportTripToExcel = (trip: any) => {
    const bookedSeats = (trip.seats || []).filter((s: any) => s.status !== SeatStatus.EMPTY);
    const routeData = routes.find(r => r.name === trip.route);
    const seatTicketCodeMap = buildSeatTicketCodeMap(trip.id);
    const passengerGroups = buildPassengerGroups(trip.id, bookedSeats);
    const headerRows = [
      ['DANH SÁCH HÀNH KHÁCH - TRIP DETAIL'],
      [`Số xe: ${trip.licensePlate || '—'}`],
      [`Tài xế: ${trip.driverName || '—'}`],
      [`Tuyến: ${trip.route || '—'}${routeData ? ` (${routeData.departurePoint} → ${routeData.arrivalPoint})` : ''}`],
      [`Ngày giờ chạy: ${formatTripDisplayTime(trip)}`],
      [`Trạng thái: ${trip.status}`],
      [],
      ['STT', 'Mã vé', 'Số ghế', 'Tên khách hàng', 'Số điện thoại', 'Điểm đón', 'Điểm trả', 'Trạng thái', 'Giá vé (đ)', 'Ghi chú'],
    ];
    const dataRows = passengerGroups.map((g, idx) => {
      const primarySeat = g.seats[0];
      const seatIds = g.seats.map((s: any) => s.id).join(', ');
      const ticketCode = g.booking?.ticketCode || seatTicketCodeMap.get(primarySeat.id) || '—';
      const allPaid = g.seats.every((s: any) => s.status === SeatStatus.PAID);
      const totalAmount = g.booking?.amount ?? (trip.price || 0) * g.seats.length;
      return [
        idx + 1,
        ticketCode,
        seatIds,
        primarySeat.customerName || '—',
        primarySeat.customerPhone || '—',
        primarySeat.pickupAddress || '—',
        primarySeat.dropoffAddress || '—',
        allPaid ? 'Đã thanh toán' : 'Đã đặt',
        totalAmount.toLocaleString(),
        primarySeat.bookingNote || '',
      ];
    });
    const totalRevenue = passengerGroups.reduce((sum, g) => sum + (g.booking?.amount ?? (trip.price || 0) * g.seats.length), 0);
    const summaryRows = [
      [],
      [`Tổng số đặt chỗ: ${passengerGroups.length} (${bookedSeats.length} ghế)`],
      [`Tổng doanh thu dự kiến: ${totalRevenue.toLocaleString()}đ`],
    ];
    const allRows = [...headerRows, ...dataRows, ...summaryRows];
    const worksheet = XLSX.utils.aoa_to_sheet(allRows);
    worksheet['!cols'] = [
      { wch: 5 }, { wch: 14 }, { wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 30 }
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh sách khách');

    // Build addon → users map for the "Dịch vụ" sheet
    const addonUsersMap = buildAddonUsersMap(trip, passengerGroups);
    const addonHeaderRows = [
      ['DANH SÁCH DỊCH VỤ BỔ SUNG'],
      [`Số xe: ${trip.licensePlate || '—'}`],
      [`Tuyến: ${trip.route || '—'}`],
      [`Ngày giờ chạy: ${formatTripDisplayTime(trip)}`],
      [],
      ['STT', 'Tên dịch vụ', 'Loại', 'Giá/người (đ)', 'Số khách', 'Tên khách hàng', 'Số điện thoại', 'Số ghế', 'Số lượng'],
    ];
    const addonDataRows: (string | number)[][] = [];
    let addonStt = 1;
    for (const [, info] of addonUsersMap) {
      if (info.users.length === 0) {
        addonDataRows.push([addonStt++, info.name, addonTypeLabel(info.type), info.price.toLocaleString(), 0, '—', '—', '—', '—']);
      } else {
        info.users.forEach((u, i) => {
          addonDataRows.push([
            i === 0 ? addonStt : '',
            i === 0 ? info.name : '',
            i === 0 ? addonTypeLabel(info.type) : '',
            i === 0 ? info.price.toLocaleString() : '',
            i === 0 ? info.users.length : '',
            u.name, u.phone, u.seats, u.quantity,
          ]);
        });
        addonStt++;
      }
    }
    const addonWorksheet = XLSX.utils.aoa_to_sheet([...addonHeaderRows, ...addonDataRows]);
    addonWorksheet['!cols'] = [
      { wch: 5 }, { wch: 25 }, { wch: 15 }, { wch: 14 }, { wch: 10 }, { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 10 }
    ];
    XLSX.utils.book_append_sheet(workbook, addonWorksheet, 'Dịch vụ');

    const sanitizedPlate = (trip.licensePlate || 'xe').replace(/[^a-zA-Z0-9]/g, '_');
    const formattedDate = (trip.date || 'nodate').replace(/-/g, '');
    const formattedTime = (trip.time || 'notime').replace(/:/g, '');
    const filename = `Chuyen_${sanitizedPlate}_${formattedDate}_${formattedTime}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  const escapeHtml = (str: unknown): string => {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  };

  const addonTypeLabel = (type: string) =>
    type === 'SIGHTSEEING' ? 'Tham quan' : type === 'TRANSPORT' ? 'Di chuyển' : type === 'FOOD' ? 'Ăn uống' : 'Khác';

  const buildAddonUsersMap = (trip: any, passengerGroups: { booking: any; seats: any[] }[]) => {
    const map = new Map<string, { name: string; price: number; type: string; description?: string; users: { name: string; phone: string; seats: string; quantity: number }[] }>();
    for (const addon of (trip.addons || [])) {
      map.set(addon.id, { name: addon.name, price: addon.price, type: addon.type, description: addon.description, users: [] });
    }
    for (const g of passengerGroups) {
      const selectedAddons: { id: string; name: string; price: number; quantity?: number }[] = g.booking?.selectedAddons || [];
      const primarySeat = g.seats[0];
      const seatIds = g.seats.map((s: any) => s.id).join(', ');
      for (const sa of selectedAddons) {
        if (!map.has(sa.id)) {
          map.set(sa.id, { name: sa.name, price: sa.price, type: '—', users: [] });
        }
        map.get(sa.id)!.users.push({
          name: primarySeat.customerName || '—',
          phone: primarySeat.customerPhone || '—',
          seats: seatIds,
          quantity: sa.quantity || 1,
        });
      }
    }
    return map;
  };

  const exportTripToPDF = (trip: any) => {
    const bookedSeats = (trip.seats || []).filter((s: any) => s.status !== SeatStatus.EMPTY);
    const routeData = routes.find(r => r.name === trip.route);
    const seatTicketCodeMap = buildSeatTicketCodeMap(trip.id);
    const passengerGroups = buildPassengerGroups(trip.id, bookedSeats);
    const totalRevenue = passengerGroups.reduce((sum, g) => sum + (g.booking?.amount ?? (trip.price || 0) * g.seats.length), 0);

    // Build addon → users map for the services section
    const pdfAddonMap = buildAddonUsersMap(trip, passengerGroups);
    const addonsSection = pdfAddonMap.size > 0 ? `
  <h2 style="color:#cc2222;font-size:14px;margin:20px 0 6px;border-bottom:1px solid #eee;padding-bottom:4px;">Dịch vụ bổ sung (${pdfAddonMap.size} dịch vụ)</h2>
  <table>
    <thead>
      <tr><th>STT</th><th>Tên dịch vụ</th><th>Loại</th><th>Giá/người</th><th>Tổng khách</th><th>Danh sách khách sử dụng</th></tr>
    </thead>
    <tbody>
      ${Array.from(pdfAddonMap.values()).map((info, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><b>${escapeHtml(info.name)}</b>${info.description ? `<br><span style="color:#888;font-size:11px;">${escapeHtml(info.description)}</span>` : ''}</td>
        <td>${escapeHtml(addonTypeLabel(info.type))}</td>
        <td>${info.price.toLocaleString()}đ</td>
        <td>${info.users.length > 0 ? info.users.length : '<span style="color:#999">—</span>'}</td>
        <td>${info.users.length > 0 ? info.users.map(u => `${escapeHtml(u.name)} (${escapeHtml(u.phone)}) – Ghế ${escapeHtml(u.seats)} × ${u.quantity}`).join('<br>') : '<span style="color:#999;font-style:italic;">Chưa có khách</span>'}</td>
      </tr>`).join('')}
    </tbody>
  </table>` : '';

    const htmlContent = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https://firebasestorage.googleapis.com;">
  <title>Chuyến xe ${escapeHtml(trip.licensePlate)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; font-size: 13px; }
    .page-header { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; border-bottom: 2px solid #cc2222; padding-bottom: 12px; margin-bottom: 16px; }
    .page-header img { height: 56px; width: auto; justify-self: start; }
    .page-header h1 { color: #cc2222; font-size: 18px; margin: 0; text-align: center; }
    .info { margin-bottom: 16px; color: #444; }
    .info p { margin: 2px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th { background: #cc2222; color: white; padding: 8px 10px; text-align: left; font-size: 12px; }
    td { padding: 7px 10px; border-bottom: 1px solid #eee; font-size: 12px; }
    tr:nth-child(even) { background: #f9f9f9; }
    .group-row { background: #fff8e1 !important; }
    .summary { margin-top: 16px; font-weight: bold; color: #cc2222; }
    @media print { button { display: none; } }
  </style>
</head>
<body>
  <div class="page-header">
    <img src="${COMPANY_LOGO_URL}" alt="Daiichi Travel">
    <h1>DANH SÁCH HÀNH KHÁCH</h1>
    <div aria-hidden="true"></div>
  </div>
  <div class="info">
    <p><b>Số xe:</b> ${escapeHtml(trip.licensePlate) || '—'}</p>
    <p><b>Tài xế:</b> ${escapeHtml(trip.driverName) || '—'}</p>
    <p><b>Tuyến:</b> ${escapeHtml(trip.route) || '—'}${routeData ? ` (${escapeHtml(routeData.departurePoint)} → ${escapeHtml(routeData.arrivalPoint)})` : ''}</p>
    <p><b>Ngày giờ:</b> ${escapeHtml(formatTripDisplayTime(trip))}</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>STT</th><th>Mã vé</th><th>Số ghế</th><th>Tên khách</th><th>Số điện thoại</th><th>Điểm đón</th><th>Điểm trả</th><th>Trạng thái</th><th>Giá vé</th><th>Ghi chú</th>
      </tr>
    </thead>
    <tbody>
      ${passengerGroups.map((g, i) => {
        const primarySeat = g.seats[0];
        const seatIds = g.seats.map((s: any) => s.id).join(', ');
        const ticketCode = g.booking?.ticketCode || seatTicketCodeMap.get(primarySeat.id) || '—';
        const allPaid = g.seats.every((s: any) => s.status === 'PAID');
        const totalAmount = g.booking?.amount ?? (trip.price || 0) * g.seats.length;
        const isGroup = g.seats.length > 1;
        return `
        <tr${isGroup ? ' class="group-row"' : ''}>
          <td>${i + 1}</td>
          <td>${escapeHtml(ticketCode)}</td>
          <td>${escapeHtml(seatIds)}${isGroup ? ' 👥' : ''}</td>
          <td>${escapeHtml(primarySeat.customerName) || '—'}</td>
          <td>${escapeHtml(primarySeat.customerPhone) || '—'}</td>
          <td>${escapeHtml(primarySeat.pickupAddress) || '—'}</td>
          <td>${escapeHtml(primarySeat.dropoffAddress) || '—'}</td>
          <td>${allPaid ? 'Đã TT' : 'Đã đặt'}</td>
          <td>${totalAmount.toLocaleString()}đ</td>
          <td>${escapeHtml(primarySeat.bookingNote) || ''}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
  <div class="summary">
    <p>Tổng đặt chỗ: ${passengerGroups.length} (${bookedSeats.length} ghế) | Doanh thu dự kiến: ${totalRevenue.toLocaleString()}đ</p>
  </div>
  ${addonsSection}
</body>
</html>`;
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      // Small delay to ensure the document is fully rendered before triggering print
      setTimeout(() => { printWindow.print(); }, 500);
    }
  };

  const exportRouteToPDF = (route: Route) => {
    const periodsRows = (route.pricePeriods || []).map((p, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(p.name || '')}</td>
        <td>${p.price > 0 ? `${p.price.toLocaleString()}đ` : '—'}</td>
        <td>${(p.agentPrice || 0) > 0 ? `${(p.agentPrice || 0).toLocaleString()}đ` : '—'}</td>
        <td>${escapeHtml(p.startDate || '')}</td>
        <td>${escapeHtml(p.endDate || '')}</td>
      </tr>`).join('');

    const surchargeTypeLabel = (type: string) =>
      type === 'HOLIDAY' ? 'Lễ/Tết' : type === 'FUEL' ? 'Xăng dầu' : 'Khác';

    const surchargesRows = (route.surcharges || []).map((s, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(s.name)}</td>
        <td>${surchargeTypeLabel(s.type)}</td>
        <td>${s.amount.toLocaleString()}đ</td>
        <td>${s.isActive ? 'Đang áp dụng' : 'Tắt'}</td>
        <td>${escapeHtml(s.startDate || '')}${s.endDate ? ` → ${escapeHtml(s.endDate)}` : ''}</td>
      </tr>`).join('');

    const stopsRows = (route.routeStops || [])
      .slice().sort((a, b) => a.order - b.order)
      .map((s, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${s.order}</td>
          <td>${escapeHtml(s.stopName)}</td>
        </tr>`).join('');

    const htmlContent = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https://firebasestorage.googleapis.com;">
  <title>Tuyến đường: ${escapeHtml(route.name)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; font-size: 13px; color: #222; }
    .page-header { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; border-bottom: 2px solid #cc2222; padding-bottom: 12px; margin-bottom: 16px; }
    .page-header img { height: 56px; width: auto; justify-self: start; }
    .page-header h1 { color: #cc2222; font-size: 20px; margin: 0; text-align: center; }
    h2 { color: #cc2222; font-size: 14px; margin: 20px 0 6px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
    .info { margin-bottom: 16px; color: #444; }
    .info p { margin: 3px 0; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: bold; }
    .badge-red { background: #fee2e2; color: #cc2222; }
    .badge-orange { background: #fff7ed; color: #d97706; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #cc2222; color: white; padding: 7px 10px; text-align: left; font-size: 12px; }
    td { padding: 6px 10px; border-bottom: 1px solid #eee; font-size: 12px; }
    tr:nth-child(even) { background: #f9f9f9; }
    .details-box { background: #f8f8f8; border: 1px solid #eee; border-radius: 8px; padding: 12px; margin-top: 8px; white-space: pre-wrap; font-size: 12px; line-height: 1.6; }
    .no-data { color: #999; font-style: italic; font-size: 12px; }
    @media print { button { display: none; } }
  </style>
</head>
<body>
  <div class="page-header">
    <img src="${COMPANY_LOGO_URL}" alt="Daiichi Travel">
    <h1>THÔNG TIN TUYẾN ĐƯỜNG</h1>
    <div aria-hidden="true"></div>
  </div>
  <div class="info">
    <p><b>STT:</b> ${route.stt}</p>
    <p><b>Tên tuyến:</b> ${escapeHtml(route.name)}</p>
    <p><b>Điểm đi:</b> ${escapeHtml(route.departurePoint || '—')}</p>
    <p><b>Điểm đến:</b> ${escapeHtml(route.arrivalPoint || '—')}</p>
    <p><b>Giá vé lẻ:</b> <span class="badge badge-red">${route.price > 0 ? `${route.price.toLocaleString()}đ` : 'Liên hệ'}</span></p>
    <p><b>Giá đại lý:</b> <span class="badge badge-orange">${(route.agentPrice || 0) > 0 ? `${(route.agentPrice || 0).toLocaleString()}đ` : '—'}</span></p>
  </div>

  ${route.details ? `
  <h2>Chi tiết tuyến đường</h2>
  <div class="details-box">${escapeHtml(route.details)}</div>` : ''}

  <h2>Kỳ giá theo mùa (${(route.pricePeriods || []).length} kỳ)</h2>
  ${(route.pricePeriods || []).length > 0 ? `
  <table>
    <thead><tr><th>STT</th><th>Tên kỳ giá</th><th>Giá lẻ</th><th>Giá đại lý</th><th>Từ ngày</th><th>Đến ngày</th></tr></thead>
    <tbody>${periodsRows}</tbody>
  </table>` : '<p class="no-data">Không có kỳ giá đặc biệt.</p>'}

  <h2>Phụ thu tuyến đường (${(route.surcharges || []).length} khoản)</h2>
  ${(route.surcharges || []).length > 0 ? `
  <table>
    <thead><tr><th>STT</th><th>Tên phụ thu</th><th>Loại</th><th>Mức phụ thu</th><th>Trạng thái</th><th>Thời gian áp dụng</th></tr></thead>
    <tbody>${surchargesRows}</tbody>
  </table>` : '<p class="no-data">Không có phụ thu.</p>'}

  <h2>Điểm dừng trên tuyến (${(route.routeStops || []).length} điểm)</h2>
  ${(route.routeStops || []).length > 0 ? `
  <table>
    <thead><tr><th>STT</th><th>Thứ tự</th><th>Tên điểm dừng</th></tr></thead>
    <tbody>${stopsRows}</tbody>
  </table>` : '<p class="no-data">Không có điểm dừng trung gian.</p>'}

  ${route.note ? `
  <h2>Ghi chú</h2>
  <div class="details-box">${escapeHtml(route.note)}</div>` : ''}
</body>
</html>`;
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => { printWindow.print(); }, 500);
    }
  };

  const buildSeatsForVehicle = (licensePlate: string, seatCount: number) => {
    const vehicle = vehicles.find(v => v.licensePlate === licensePlate);
    // For free seating vehicles, generate simple numbered seats (used only for capacity tracking)
    if (vehicle?.seatType === 'free') {
      const FREE_SEATING_COLS = 4; // seats per row for internal grid layout (not displayed to user)
      return Array.from({ length: seatCount }, (_, i) => ({
        id: String(i + 1),
        row: Math.floor(i / FREE_SEATING_COLS),
        col: i % FREE_SEATING_COLS,
        deck: 0,
        status: SeatStatus.EMPTY,
      }));
    }
    const savedLayout = vehicle?.layout as SerializedSeat[] | null | undefined;
    if (savedLayout && savedLayout.length > 0) {
      return savedLayout.map(s => ({ id: s.label, row: s.row, col: s.col, deck: s.deck, status: SeatStatus.EMPTY }));
    }
    const generatedLayout = generateVehicleLayout(vehicle?.type || 'Ghế ngồi', seatCount);
    return serializeLayout(generatedLayout).map(s => ({ id: s.label, row: s.row, col: s.col, deck: s.deck, status: SeatStatus.EMPTY }));
  };

  const handleTripVehicleSelect = (licensePlate: string) => {
    const vehicle = vehicles.find(v => v.licensePlate === licensePlate);
    const savedLayout = vehicle?.layout as SerializedSeat[] | null | undefined;
    const layoutSeatCount = savedLayout && savedLayout.length > 0 ? savedLayout.length : null;
    setTripForm(p => ({ ...p, licensePlate, seatCount: layoutSeatCount ?? vehicle?.seats ?? p.seatCount }));
  };

  const handleBatchVehicleSelect = (licensePlate: string) => {
    const vehicle = vehicles.find(v => v.licensePlate === licensePlate);
    const savedLayout = vehicle?.layout as SerializedSeat[] | null | undefined;
    const layoutSeatCount = savedLayout && savedLayout.length > 0 ? savedLayout.length : null;
    setBatchTripForm(p => ({ ...p, licensePlate, seatCount: layoutSeatCount ?? vehicle?.seats ?? p.seatCount }));
  };

  // --- Batch trip creation ---
  const handleBatchAddTrips = async () => {
    const validSlots = batchTimeSlots.filter(t => t.trim() !== '');
    if (!batchTripForm.date || !batchTripForm.route || validSlots.length === 0) return;
    setBatchTripLoading(true);
    try {
      const seats = buildSeatsForVehicle(batchTripForm.licensePlate, batchTripForm.seatCount);
      const batchVehicle = vehicles.find(v => v.licensePlate === batchTripForm.licensePlate);
      const seatType = batchVehicle?.seatType || 'assigned';
      const tripsToCreate = validSlots.map(slot => ({
        time: slot,
        date: batchTripForm.date,
        route: batchTripForm.route,
        licensePlate: batchTripForm.licensePlate,
        driverName: batchTripForm.driverName,
        price: batchTripForm.price,
        agentPrice: batchTripForm.agentPrice,
        status: TripStatus.WAITING,
        seats,
        addons: [] as TripAddon[],
        seatType,
      }));
      await transportService.addTripsBatch(tripsToCreate);
      setShowBatchAddTrip(false);
      setBatchTripForm({ date: '', route: '', licensePlate: '', driverName: '', price: 0, agentPrice: 0, seatCount: 11 });
      setBatchTimeSlots(['']);
    } catch (err) {
      console.error('Failed to batch create trips:', err);
    } finally {
      setBatchTripLoading(false);
    }
  };

  // --- Trip addon handlers ---
  const handleAddTripAddon = async () => {
    if (!showTripAddons || !tripAddonForm.name) return;
    const newAddon: TripAddon = {
      id: `addon_${crypto.randomUUID()}`,
      name: tripAddonForm.name,
      price: tripAddonForm.price,
      description: tripAddonForm.description,
      type: tripAddonForm.type,
    };
    const updatedAddons = [...(showTripAddons.addons || []), newAddon];
    try {
      await transportService.updateTrip(showTripAddons.id, { addons: updatedAddons });
      setShowTripAddons(prev => prev ? { ...prev, addons: updatedAddons } : null);
      setTripAddonForm({ name: '', price: 0, description: '', type: 'OTHER' });
      setShowAddTripAddon(false);
    } catch (err) {
      console.error('Failed to add trip addon:', err);
    }
  };

  const handleDeleteTripAddon = async (addonId: string) => {
    if (!showTripAddons) return;
    const updatedAddons = (showTripAddons.addons || []).filter(a => a.id !== addonId);
    try {
      await transportService.updateTrip(showTripAddons.id, { addons: updatedAddons });
      setShowTripAddons(prev => prev ? { ...prev, addons: updatedAddons } : null);
    } catch (err) {
      console.error('Failed to delete trip addon:', err);
    }
  };

  const handleUpdateAgent = async (agentId: string, updates: any) => {
    try {
      await transportService.updateAgent(agentId, updates);
    } catch {
      // Fallback to local state update if Firebase is unavailable
      setAgents(prev => prev.map(a => a.id === agentId ? { ...a, ...updates } : a));
    }
  };

  const handleUpdateAdmin = (updates: any) => {
    setAdminCredentials(prev => {
      const next = { ...prev, ...updates };
      transportService.saveAdminSettings(next).catch(err =>
        console.error('Failed to save admin settings:', err)
      );
      return next;
    });
    if (currentUser?.role === UserRole.MANAGER) {
      setCurrentUser(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const handleRegisterMember = async (data: { name: string; phone: string; email?: string; username?: string; password: string }): Promise<boolean> => {
    // Check if phone already registered
    const exists = customers.some(c => c.phone === data.phone);
    if (exists) return false;
    // Normalize phone for default username: strip leading + and country code prefix if needed
    const normalizedPhone = data.phone.replace(/^\+84/, '0').replace(/[^0-9]/g, '');
    // Store username in lowercase so login is case-insensitive
    const storedUsername = (data.username || normalizedPhone || data.phone).toLowerCase();
    await transportService.addCustomer({
      name: data.name || (language === 'vi' ? 'Khách hàng' : 'Customer'),
      phone: data.phone,
      email: data.email,
      username: storedUsername,
      password: data.password,
      status: 'ACTIVE',
      registeredAt: new Date().toISOString(),
      totalBookings: 1,
    });
    return true;
  };

  /**
   * OTP / OAuth-based member login and auto-registration.
   * Called after Firebase phone-OTP or social sign-in succeeds.
   * Finds an existing customer by phone / email / firebaseUid or creates a new one.
   */
  const handleOtpMemberLogin = async (data: {
    name?: string;
    phone?: string;
    email?: string;
    uid?: string;
    loginMethod: string;
  }): Promise<{ id: string; username: string; role: UserRole; name: string; phone?: string; email?: string } | null> => {
    // Normalise phone for storage/lookup:
    // - Vietnamese E.164 (+84xxx) → local 0xxx format (consistent with traditional registration)
    // - International E.164 (+CCxxx) → kept as-is (e.g. +61412345678 for Australia)
    // - Already local (0xxx): no change
    const normalizedPhone = data.phone
      ? data.phone.replace(/^\+84/, '0')
      : undefined;

    // For phone-auth users who have no email, derive a default email from the
    // phone number so that email-dependent features (e.g. OTP confirmation,
    // welcome emails) are never blocked by an empty email field.
    const phoneDigits = (normalizedPhone || data.phone || '').replace(/[^0-9]/g, '');
    const effectiveEmail = data.email || (phoneDigits ? `${phoneDigits}@gmail.com` : undefined);

    const defaultName = language === 'vi' ? 'Khách hàng' : 'Customer';

    // 1. Find existing customer by uid, phone, or email
    // Compare phone digits only to handle format variations (+61..., 61..., 0...).
    let customer = customers.find(c => {
      if (data.uid && c.firebaseUid === data.uid) return true;
      if (normalizedPhone && c.phone) {
        const normDigits = normalizedPhone.replace(/[^0-9]/g, '');
        const cDigits = c.phone.replace(/[^0-9]/g, '');
        if (normDigits && normDigits === cDigits) return true;
      }
      if (data.phone && c.phone === data.phone) return true;
      if (data.email && c.email && c.email.toLowerCase() === data.email.toLowerCase()) return true;
      return false;
    });

    if (customer) {
      // Update profile fields that may have changed
      const updates: Partial<Omit<CustomerProfile, 'id'>> = {
        loginMethod: data.loginMethod as CustomerProfile['loginMethod'],
      };
      if (data.uid && !customer.firebaseUid) updates.firebaseUid = data.uid;
      if (data.name && data.name !== customer.name) updates.name = data.name;
      if (effectiveEmail && !customer.email) updates.email = effectiveEmail;
      if (normalizedPhone && !customer.phone) updates.phone = normalizedPhone;
      await transportService.updateCustomer(customer.id, updates);

      return {
        id: customer.id,
        username: customer.username || customer.phone || effectiveEmail || 'member',
        role: UserRole.CUSTOMER,
        name: customer.name || data.name || defaultName,
        phone: customer.phone || normalizedPhone,
        email: customer.email || effectiveEmail,
      };
    }

    // 2. Create new customer profile
    const newCustomer: Omit<CustomerProfile, 'id'> = {
      name: data.name || defaultName,
      phone: normalizedPhone || data.phone || '',
      username: normalizedPhone || effectiveEmail || data.uid || '',
      loginMethod: data.loginMethod as CustomerProfile['loginMethod'],
      status: 'ACTIVE',
      registeredAt: new Date().toISOString(),
      totalBookings: 0,
    };
    if (effectiveEmail) newCustomer.email = effectiveEmail;
    if (data.uid) newCustomer.firebaseUid = data.uid;
    const docRef = await transportService.addCustomer(newCustomer);

    return {
      id: docRef.id,
      username: normalizedPhone || effectiveEmail || data.uid || 'member',
      role: UserRole.CUSTOMER,
      name: data.name || defaultName,
      phone: normalizedPhone || data.phone,
      email: effectiveEmail,
    };
  };

  const handleCreateConsignment = async () => {
    if (!newConsignment.senderName || !newConsignment.receiverName) return;
    // Derive the display name for the current agent
    const effectiveAgentName = currentUser?.role === UserRole.AGENT
      ? (currentUser.name || currentUser.address || currentUser.agentCode || (language === 'vi' ? 'Đại lý' : 'Agent'))
      : undefined;
    try {
      await transportService.addConsignment({
        senderName: newConsignment.senderName,
        sender: newConsignment.senderName,
        senderPhone: newConsignment.senderPhone,
        receiverName: newConsignment.receiverName,
        receiver: newConsignment.receiverName,
        receiverPhone: newConsignment.receiverPhone,
        status: 'PENDING',
        qrCode: `QR-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        type: newConsignment.type,
        weight: newConsignment.weight,
        cod: newConsignment.cod,
        notes: newConsignment.notes,
        agentId: currentUser?.role === UserRole.AGENT ? currentUser.id : undefined,
        agentName: effectiveAgentName,
      } as any);
      setShowCreateConsignment(false);
      setNewConsignment({ senderName: '', senderPhone: '', receiverName: '', receiverPhone: '', type: '', weight: '', cod: 0, notes: '' });
    } catch (err) {
      console.error('Failed to create consignment:', err);
    }
  };

  const handleStartEditConsignment = (c: Consignment) => {
    setEditingConsignment(c);
    setEditConsignmentForm({
      senderName: c.senderName || c.sender || '',
      senderPhone: c.senderPhone || '',
      receiverName: c.receiverName || c.receiver || '',
      receiverPhone: c.receiverPhone || '',
      type: c.type || '',
      weight: c.weight || '',
      cod: c.cod || 0,
      notes: c.notes || '',
      status: c.status,
    });
    setShowEditConsignment(true);
  };

  const handleUpdateConsignment = async () => {
    if (!editingConsignment) return;
    try {
      await transportService.updateConsignment(editingConsignment.id, {
        senderName: editConsignmentForm.senderName,
        sender: editConsignmentForm.senderName,
        senderPhone: editConsignmentForm.senderPhone,
        receiverName: editConsignmentForm.receiverName,
        receiver: editConsignmentForm.receiverName,
        receiverPhone: editConsignmentForm.receiverPhone,
        type: editConsignmentForm.type,
        weight: editConsignmentForm.weight,
        cod: editConsignmentForm.cod,
        notes: editConsignmentForm.notes,
        status: editConsignmentForm.status,
      });
      setShowEditConsignment(false);
      setEditingConsignment(null);
    } catch (err) {
      console.error('Failed to update consignment:', err);
    }
  };

  const handleDeleteConsignment = async (id: string) => {
    if (!window.confirm(language === 'vi' ? 'Bạn có chắc muốn xóa vận đơn này?' : 'Delete this consignment?')) return;
    try {
      await transportService.deleteConsignment(id);
    } catch (err) {
      console.error('Failed to delete consignment:', err);
    }
  };

  const handleConfirmBooking = async (seatId: string) => {
    // Use fare-table price when available; for agents prefer agentPrice from fare table
    const isAgentBooking = currentUser?.role === UserRole.AGENT;
    const effectiveAgentName = isAgentBooking
      ? (currentUser!.name || currentUser!.address || currentUser!.agentCode || (language === 'vi' ? 'Đại lý' : 'Agent'))
      : 'Trực tiếp';
    // When a fare is resolved: use agent fare price for agents (if set), otherwise retail fare
    const effectiveFareAmount = fareAmount !== null
      ? (isAgentBooking && fareAgentAmount !== null ? fareAgentAmount : fareAmount)
      : null;
    const basePriceAdult = effectiveFareAmount !== null
      ? effectiveFareAmount
      : (isAgentBooking
          ? (selectedTrip.agentPrice || selectedTrip.price || 0)
          : (selectedTrip.price || 0));
    const basePriceChild = effectiveFareAmount !== null
      ? effectiveFareAmount
      : (isAgentBooking
          ? (selectedTrip.agentPriceChild || selectedTrip.agentPrice || selectedTrip.priceChild || basePriceAdult)
          : (selectedTrip.priceChild || basePriceAdult));
    
    // Children over 4 years old are charged adult price and need their own seat
    const { childrenOver4, childrenUnder4 } = childrenAges.reduce(
      (acc, age) => age > 4 ? { ...acc, childrenOver4: acc.childrenOver4 + 1 } : { ...acc, childrenUnder4: acc.childrenUnder4 + 1 },
      { childrenOver4: 0, childrenUnder4: 0 }
    );
    const effectiveAdults = adults + childrenOver4;
    const effectiveChildren = childrenUnder4 + Math.max(0, children - childrenAges.length);
    
    // Calculate route-level surcharges (fuel, holiday, etc.)
    const tripRoute = routes.find(r => r.name === selectedTrip.route);
    const tripDate = selectedTrip.date || '';
    const appliedRouteSurcharges = getApplicableRouteSurcharges(tripRoute, tripDate);
    const routeSurchargeTotal = appliedRouteSurcharges.reduce((sum, sc) => sum + sc.amount * (effectiveAdults + effectiveChildren), 0);

    const totalBase = (effectiveAdults * basePriceAdult) + (effectiveChildren * basePriceChild);
    const totalSurcharge = pickupSurcharge + dropoffSurcharge + surchargeAmount + routeSurchargeTotal;
    // Calculate selected addons total (price × quantity)
    const selectedAddons = (selectedTrip.addons || []).filter((a: TripAddon) => (addonQuantities[a.id] || 0) > 0);
    const addonsTotalPrice = selectedAddons.reduce((sum: number, a: TripAddon) => sum + a.price * (addonQuantities[a.id] || 1), 0);
    const totalAmount = Math.round((totalBase + totalSurcharge + addonsTotalPrice) * (1 - bookingDiscount / 100));

    // Extra seats for all passengers beyond first adult (adults - 1) and children over 4
    const isFreeSeating = selectedTrip.seatType === 'free';
    let allSeatIds: string[];
    let effectiveSeatId: string;
    if (isFreeSeating) {
      // Auto-assign the required number of seats from available ones
      const seatsNeeded = adults + childrenOver4;
      const availableSeats = selectedTrip.seats
        .filter((s: any) => s.status === SeatStatus.EMPTY)
        .slice(0, seatsNeeded);
      if (availableSeats.length < seatsNeeded) {
        alert(language === 'vi' ? 'Không còn đủ chỗ trống cho số hành khách đã chọn!' : 'Not enough seats available for the selected number of passengers!');
        return;
      }
      allSeatIds = availableSeats.map((s: any) => s.id);
      effectiveSeatId = allSeatIds[0] || '1';
    } else {
      const extraSeatsForBooking = extraSeatIds.slice(0, (adults - 1) + childrenOver4);
      allSeatIds = [seatId, ...extraSeatsForBooking];
      effectiveSeatId = seatId;
    }

    // Resolve stop orders for segment availability tracking
    const fromStopOrder = tripRoute?.routeStops?.find(s => s.stopId === fromStopId)?.order;
    const toStopOrder = tripRoute?.routeStops?.find(s => s.stopId === toStopId)?.order;

    const bookingData = {
      customerName: customerNameInput.trim() || (language === 'vi' ? 'Khách lẻ' : 'Walk-in'),
      phone: phoneInput.trim(),
      type: 'TRIP',
      route: selectedTrip.route,
      date: new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
      time: selectedTrip.time,
      tripId: selectedTrip.id,
      seatId: effectiveSeatId,
      seatIds: allSeatIds,
      amount: totalAmount,
      agent: effectiveAgentName,
      ...(isAgentBooking ? { agentId: currentUser!.id } : {}),
      status: 'BOOKED',
      adults,
      children,
      pickupPoint,
      dropoffPoint,
      ...(pickupAddress ? { pickupAddress } : {}),
      ...(dropoffAddress ? { dropoffAddress } : {}),
      paymentMethod: paymentMethodInput,
      ...(bookingNote.trim() ? { bookingNote: bookingNote.trim() } : {}),
      selectedAddons: selectedAddons.map((a: TripAddon) => ({ id: a.id, name: a.name, price: a.price, quantity: addonQuantities[a.id] || 1 })),
      ...(isFreeSeating ? { freeSeating: true } : {}),
      // Fare-table fields (Option 2) – present only when a fare was resolved
      ...(effectiveFareAmount !== null && fromStopId && toStopId ? {
        fromStopId,
        toStopId,
        fareDocId: `${fromStopId}_${toStopId}`,
        farePricePerPerson: effectiveFareAmount,
        ...(fareAmount !== null && isAgentBooking && fareAgentAmount !== null ? { fareRetailPricePerPerson: fareAmount } : {}),
      } : {}),
    };

    // Seat update payload includes pickup/dropoff for segment availability
    const seatUpdateData = {
      status: SeatStatus.BOOKED,
      customerName: bookingData.customerName,
      customerPhone: bookingData.phone,
      ...(pickupPoint ? { pickupPoint } : {}),
      ...(dropoffPoint ? { dropoffPoint } : {}),
      ...(pickupAddress ? { pickupAddress } : {}),
      ...(dropoffAddress ? { dropoffAddress } : {}),
      ...(fromStopOrder !== undefined ? { fromStopOrder } : {}),
      ...(toStopOrder !== undefined ? { toStopOrder } : {}),
      ...(bookingNote.trim() ? { bookingNote: bookingNote.trim() } : {}),
    };

    // Core save function – shared by both QR and direct booking paths
    const saveBooking = async () => {
      try {
        const result = await transportService.createBooking(bookingData);
        await transportService.bookSeats(selectedTrip.id, allSeatIds, seatUpdateData);
        setLastBooking({ ...bookingData, id: result.id, ticketCode: result.ticketCode });
      } catch (err) {
        console.error('Failed to save booking:', err);
        alert(language === 'vi'
          ? 'Đặt vé thất bại: Không thể kết nối đến máy chủ. Vui lòng thử lại.'
          : 'Booking failed: Unable to connect to server. Please try again.');
        return;
      }

      setIsTicketOpen(true);
      setShowBookingForm(null);

      // Reset form inputs
      setCustomerNameInput('');
      setPhoneInput('');
      setAdults(1);
      setChildren(0);
      setChildrenAges([]);
      setExtraSeatIds([]);
      setPickupPoint('');
      setDropoffPoint('');
      setPickupAddress('');
      setDropoffAddress('');
      setPickupSurcharge(0);
      setDropoffSurcharge(0);
      setSurchargeAmount(0);
      setBookingDiscount(0);
      setPaymentMethodInput(DEFAULT_PAYMENT_METHOD);
      setAddonQuantities({});
      setBookingNote('');
      // Reset fare-table state
      setFareAmount(null);
      setFareAgentAmount(null);
      setFareError('');
      setFareLoading(false);
      setFromStopId('');
      setToStopId('');
      setSeatSelectionHistory([]);

      // Send real-time notification
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'NEW_BOOKING',
          customerName: bookingData.customerName,
          route: bookingData.route,
          time: bookingData.time,
          amount: bookingData.amount
        }));
      }

      // Optimistic local state update while Firebase listener syncs
      setTrips(prev => prev.map(trip => {
        if (trip.id === selectedTrip.id) {
          return {
            ...trip,
            seats: trip.seats.map((s: any) => allSeatIds.includes(s.id) ? { ...s, status: SeatStatus.BOOKED } : s)
          };
        }
        return trip;
      }));
      // Also update selectedTrip immediately so the seat diagram reflects the new status
      setSelectedTrip((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          seats: prev.seats.map((s: any) => allSeatIds.includes(s.id) ? { ...s, status: SeatStatus.BOOKED } : s)
        };
      });
    };

    // When payment method is QR bank transfer, show the QR modal first
    if (paymentMethodInput === 'Chuyển khoản QR') {
      const preRef = `${transportService.generateTicketCode()}`;
      // Store the ref so it shows in the QR modal and will be attached to the saved booking
      (bookingData as any).paymentRef = preRef;
      setPendingQrBooking({
        amount: totalAmount,
        ref: preRef,
        label: bookingData.customerName,
        execute: saveBooking,
      });
      return;
    }

    // All other payment methods – save immediately
    await saveBooking();
  };

  // --- Route price period helpers ---
  const getRouteActivePeriod = (route: Route, date: string): PricePeriod | null => {
    if (!date || !route.pricePeriods || route.pricePeriods.length === 0) return null;
    return route.pricePeriods.find(p => p.startDate <= date && p.endDate >= date) || null;
  };

  /** Submit an inquiry when no matching trip is found – saves to Firestore and
   * triggers the notifyInquiry Cloud Function which emails sale@daiichitravel.com. */
  const handleInquirySubmit = async () => {
    if (!inquiryName.trim() || !inquiryPhone.trim()) return;
    const isReturnPhase = tripType === 'ROUND_TRIP' && roundTripPhase === 'return';
    setInquiryLoading(true);
    setInquiryError('');
    try {
      await transportService.createInquiry({
        name: inquiryName.trim(),
        phone: inquiryPhone.trim(),
        ...(inquiryEmail.trim() ? { email: inquiryEmail.trim() } : {}),
        from: isReturnPhase ? searchTo : searchFrom,
        to: isReturnPhase ? searchFrom : searchTo,
        date: isReturnPhase ? searchReturnDate : searchDate,
        ...(tripType === 'ROUND_TRIP' && searchReturnDate ? { returnDate: searchReturnDate } : {}),
        adults,
        children,
        ...(inquiryNotes.trim() ? { notes: inquiryNotes.trim() } : {}),
        tripType,
        phase: tripType === 'ROUND_TRIP' ? roundTripPhase : 'outbound',
      });
      setInquirySuccess(true);
      setInquiryName('');
      setInquiryPhone('');
      setInquiryEmail('');
      setInquiryNotes('');
    } catch (err) {
      console.error('Failed to save inquiry:', err);
      setInquiryError(language === 'vi' ? 'Đã xảy ra lỗi khi gửi yêu cầu. Vui lòng thử lại.' : 'An error occurred. Please try again.');
    } finally {
      setInquiryLoading(false);
    }
  };

  const getApplicableRouteSurcharges = (route: Route | undefined, tripDate: string): RouteSurcharge[] => {
    if (!route?.surcharges) return [];
    return route.surcharges.filter(sc => {
      if (!sc.isActive) return false;
      // If a date range is configured, only apply within that range
      if (sc.startDate && sc.endDate) {
        return !!tripDate && tripDate >= sc.startDate && tripDate <= sc.endDate;
      }
      // No date range means the surcharge applies all the time
      return true;
    });
  };

  /** Returns true if the address input (pickup or dropoff) should be disabled for the given trip date. */
  const isAddressDisabled = (disableFlag: boolean | undefined, fromDate: string | undefined, toDate: string | undefined, tripDate: string): boolean => {
    if (!disableFlag) return false;
    // No date range configured → always disabled
    if (!fromDate && !toDate) return true;
    // One- or two-sided range: check if tripDate is within [fromDate, toDate]
    const afterFrom = fromDate ? tripDate >= fromDate : true;
    const beforeTo = toDate ? tripDate <= toDate : true;
    return !!tripDate && afterFrom && beforeTo;
  };

  /**
   * Fare-table lookup (Option 2).
   * Called when both fromStopId and toStopId are known and the trip's route
   * has routeStops configured.  Updates fareAmount / fareError state.
   * Uses a request-ID guard to discard stale responses from rapid selections.
   */
  const lookupFare = async (
    tripRoute: Route | undefined,
    fFromStopId: string,
    fToStopId: string,
  ) => {
    if (!tripRoute || !fFromStopId || !fToStopId) return;
    if (!tripRoute.routeStops || tripRoute.routeStops.length === 0) return;

    const requestId = ++fareRequestIdRef.current;
    setFareLoading(true);
    setFareError('');
    setFareAmount(null);
    setFareAgentAmount(null);

    try {
      const result = await transportService.getFare({
        routeId: tripRoute.id,
        fromStopId: fFromStopId,
        toStopId: fToStopId,
        routeStops: tripRoute.routeStops,
        stops,
      });
      // Discard if a newer request has been initiated
      if (requestId !== fareRequestIdRef.current) return;
      setFareAmount(result.price);
      setFareAgentAmount(result.agentPrice ?? null);
    } catch (err) {
      if (requestId !== fareRequestIdRef.current) return;
      if (err instanceof FareError) {
        setFareError(err.message);
      } else {
        setFareError(language === 'vi' ? 'Lỗi tra cứu giá vé.' : 'Fare lookup error.');
      }
    } finally {
      if (requestId === fareRequestIdRef.current) {
        setFareLoading(false);
      }
    }
  };

  const isRouteValidForDate = (_route: Route, _date: string): boolean => {
    // Routes are always available regardless of date.
    // The base price (set outside pricePeriods) applies year-round except during
    // peak periods, which override it via getRouteActivePeriod.
    return true;
  };

  const formatRouteOption = (r: Route, period: PricePeriod | null, lang: string): string => {
    const displayPrice = period ? period.price : r.price;
    const periodLabel = period ? (period.name || (lang === 'vi' ? 'Kỳ giá' : 'Season')) : '';
    const priceStr = displayPrice > 0 ? ` – ${displayPrice.toLocaleString()}đ` : '';
    const seasonStr = periodLabel ? ` (${periodLabel})` : '';
    return `${r.name}${priceStr}${seasonStr}`;
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard language={language} trips={trips} consignments={consignments} bookings={bookings} currentUser={currentUser} setActiveTab={setActiveTab} />;
      
      case 'settings':
        return (
          <Settings 
            language={language} 
            currentUser={currentUser} 
            agents={agents} 
            onUpdateAgent={handleUpdateAgent} 
            onUpdateAdmin={handleUpdateAdmin} 
          />
        );

      case 'customers':
        return <CustomerManagement language={language} customers={customers} />;
      
      case 'home':
        return (
          <div className="space-y-12">
            <div className="relative h-48 sm:h-72 md:h-[400px] rounded-[40px] overflow-hidden">
              <img 
                src="https://firebasestorage.googleapis.com/v0/b/daiichitravel-f49fd.firebasestorage.app/o/hinhnenhome.png?alt=media&token=4be06677-5484-4225-a48f-2a7f92dc99f4" 
                alt="Travel Hero" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent flex items-center px-6 sm:px-12">
                <div className="max-w-xl text-white">
                  <motion.h2 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-2xl sm:text-4xl md:text-5xl font-bold mb-4 leading-tight"
                  >
                    {t.hero_title}
                  </motion.h2>
                  <p className="text-sm sm:text-base text-white/80 mb-4 sm:mb-8">{t.hero_subtitle}</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button onClick={() => setActiveTab('book-ticket')} className="px-4 py-2 sm:px-8 sm:py-4 bg-daiichi-red text-white rounded-2xl font-bold shadow-lg shadow-daiichi-red/20 hover:scale-105 transition-all text-sm sm:text-base">{t.book_now}</button>
                    <button onClick={() => setActiveTab('tours')} className="px-4 py-2 sm:px-8 sm:py-4 bg-white text-daiichi-red rounded-2xl font-bold hover:scale-105 transition-all text-sm sm:text-base">{t.view_hot_tours}</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { title: t.feature_limo_title, desc: t.feature_limo_desc, icon: Bus },
                { title: t.feature_tour_title, desc: t.feature_tour_desc, icon: Star },
                { title: t.feature_support_title, desc: '+84 96 100 47 09', icon: Phone },
              ].map((f, i) => (
                <div key={i} className="bg-white p-5 sm:p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                  <div className="w-14 h-14 bg-daiichi-accent rounded-2xl flex items-center justify-center text-daiichi-red mb-6">
                    <f.icon size={28} />
                  </div>
                  <h4 className="text-xl font-bold mb-2">{f.title}</h4>
                  <p className="text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>

            {/* Membership invitation banner – shown only to unregistered guests */}
            {currentUser?.id === 'guest' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden bg-gradient-to-r from-daiichi-red to-rose-500 rounded-[32px] p-7 sm:p-12 text-white"
              >
                <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                      <UserPlus size={28} />
                    </div>
                    <div>
                      <h3 className="text-xl sm:text-2xl font-bold mb-1">{t.member_banner_title || 'Trở Thành Thành Viên Daiichi Travel!'}</h3>
                      <p className="text-white/80 text-sm max-w-lg leading-relaxed">{t.member_banner_subtitle || 'Đặt vé ngay để đăng ký thành viên miễn phí – tích lũy điểm thưởng, nhận ưu đãi độc quyền và được gợi ý chuyến xe cá nhân hóa.'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('book-ticket')}
                    className="shrink-0 px-6 py-3 sm:px-8 sm:py-4 bg-white text-daiichi-red rounded-2xl font-bold shadow-lg hover:scale-105 transition-all text-sm sm:text-base whitespace-nowrap"
                  >
                    {t.member_banner_cta || 'Đặt vé & Đăng ký'}
                  </button>
                </div>
                <div className="absolute -right-10 -top-10 w-52 h-52 bg-white/5 rounded-full pointer-events-none" />
                <div className="absolute -right-4 -bottom-6 w-36 h-36 bg-white/10 rounded-full pointer-events-none" />
              </motion.div>
            )}

            <Footer language={language} />
          </div>
        );

      case 'book-ticket':
        return (
          <div className="space-y-8">
            <div className="bg-white p-4 sm:p-8 rounded-[40px] shadow-sm border border-gray-100">
              <div className="flex items-center gap-6 mb-6">
                <h2 className="text-2xl font-bold">{t.search_title}</h2>
                <div className="flex bg-gray-100 p-1 rounded-xl">
                  {(['ONE_WAY', 'ROUND_TRIP'] as const).map((type) => (
                    <button 
                      key={type}
                      onClick={() => setTripType(type)}
                      className={cn(
                        "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                        tripType === type ? "bg-white text-daiichi-red shadow-sm" : "text-gray-500"
                      )}
                    >
                      {type === 'ONE_WAY' ? t.trip_one_way : t.trip_round_trip}
                    </button>
                  ))}
                </div>
              </div>
              <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-4", tripType === 'ROUND_TRIP' ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.from}</label>
                  <div className="relative mt-1">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 z-10" size={18} />
                    <SearchableSelect
                      options={['Hà Nội', 'Cát Bà', 'Ninh Bình', 'Hải Phòng']}
                      value={searchFrom}
                      onChange={setSearchFrom}
                      placeholder={t.from}
                      className="w-full"
                      inputClassName="pl-12 py-4"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.to}</label>
                  <div className="relative mt-1">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 z-10" size={18} />
                    <SearchableSelect
                      options={['Cát Bà', 'Ninh Bình', 'Hải Phòng', 'Hà Nội']}
                      value={searchTo}
                      onChange={setSearchTo}
                      placeholder={t.to}
                      className="w-full"
                      inputClassName="pl-12 py-4"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.departure_date}</label>
                  <div className="relative mt-1">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input type="date" value={searchDate} min={getLocalDateString(0)} onChange={e => setSearchDate(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-daiichi-red/10" />
                  </div>
                </div>
                {tripType === 'ROUND_TRIP' && (
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.return_date}</label>
                    <div className="relative mt-1">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input type="date" value={searchReturnDate} min={searchDate || getLocalDateString(0)} onChange={e => setSearchReturnDate(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-daiichi-red/10" />
                    </div>
                  </div>
                )}
              </div>
              {/* Passenger count row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.num_adults}</label>
                  <div className="relative mt-1 flex items-center">
                    <button
                      type="button"
                      onClick={() => setSearchAdults(v => Math.max(1, v - 1))}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 hover:bg-daiichi-red hover:text-white text-gray-600 font-bold text-sm transition-colors z-10"
                    >−</button>
                    <input
                      type="number"
                      min="1"
                      value={searchAdults}
                      onChange={e => setSearchAdults(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full text-center px-10 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-daiichi-red/10 font-bold text-gray-700"
                    />
                    <button
                      type="button"
                      onClick={() => setSearchAdults(v => v + 1)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 hover:bg-daiichi-red hover:text-white text-gray-600 font-bold text-sm transition-colors z-10"
                    >+</button>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.num_children}</label>
                  <div className="relative mt-1 flex items-center">
                    <button
                      type="button"
                      onClick={() => setSearchChildren(v => Math.max(0, v - 1))}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 hover:bg-daiichi-red hover:text-white text-gray-600 font-bold text-sm transition-colors z-10"
                    >−</button>
                    <input
                      type="number"
                      min="0"
                      value={searchChildren}
                      onChange={e => setSearchChildren(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full text-center px-10 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-daiichi-red/10 font-bold text-gray-700"
                    />
                    <button
                      type="button"
                      onClick={() => setSearchChildren(v => v + 1)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 hover:bg-daiichi-red hover:text-white text-gray-600 font-bold text-sm transition-colors z-10"
                    >+</button>
                  </div>
                </div>
              </div>
              {/* Search button row */}
              <div className="flex justify-end mt-4">
                <button onClick={() => setHasSearched(true)} className="px-8 py-4 bg-daiichi-red text-white rounded-2xl font-bold shadow-lg shadow-daiichi-red/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2">
                  <Search size={18} />
                  {t.search_btn}
                </button>
              </div>
            </div>

            {/* Search & Price Filter Bar */}
            <div className="bg-white p-4 sm:p-6 rounded-[32px] shadow-sm border border-gray-100">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Keyword Search */}
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.keyword_search}</label>
                  <div className="relative mt-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      value={bookTicketSearch}
                      onChange={e => setBookTicketSearch(e.target.value)}
                      placeholder={t.keyword_search_placeholder}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
                    />
                  </div>
                </div>
                {/* Price Range Filter */}
                <div className="flex items-end gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.price_range}</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="number"
                        min="0"
                        value={priceMin}
                        onChange={e => setPriceMin(e.target.value)}
                        placeholder={t.price_min_placeholder}
                        className="w-36 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
                      />
                      <span className="text-gray-400 font-bold">—</span>
                      <input
                        type="number"
                        min="0"
                        value={priceMax}
                        onChange={e => setPriceMax(e.target.value)}
                        placeholder={t.price_max_placeholder}
                        className="w-36 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
                      />
                    </div>
                  </div>
                  {(bookTicketSearch || priceMin || priceMax) && (
                    <button
                      onClick={() => { setBookTicketSearch(''); setPriceMin(''); setPriceMax(''); }}
                      className="px-4 py-3 text-sm font-bold text-gray-400 hover:text-daiichi-red hover:bg-red-50 rounded-2xl transition-colors"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* Round-trip phase indicator */}
              {tripType === 'ROUND_TRIP' && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <h3 className="text-xl font-bold px-2">
                    {roundTripPhase === 'outbound' ? t.round_trip_step_1 : t.round_trip_step_2}
                  </h3>
                  {roundTripPhase === 'return' && (
                    <div className="flex items-center gap-3 flex-wrap">
                      {outboundBookingData && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-bold border border-green-200">
                          <CheckCircle2 size={12} />
                          {t.round_trip_outbound_done}: {outboundBookingData.route} · {outboundBookingData.time}
                        </span>
                      )}
                      <button
                        onClick={() => { setRoundTripPhase('outbound'); setShowInquiryForm(false); setInquirySuccess(false); }}
                        className="text-xs font-bold text-gray-500 hover:text-daiichi-red transition-colors"
                      >
                        {t.back_to_outbound}
                      </button>
                    </div>
                  )}
                </div>
              )}
              {tripType === 'ONE_WAY' && <h3 className="text-xl font-bold px-2">{t.available_trips}</h3>}

              {(() => {
                // For round-trip return phase, swap from/to and use return date
                const isReturnPhase = tripType === 'ROUND_TRIP' && roundTripPhase === 'return';
                const effectiveFrom = isReturnPhase ? searchTo : searchFrom;
                const effectiveTo = isReturnPhase ? searchFrom : searchTo;
                const effectiveDate = isReturnPhase ? searchReturnDate : searchDate;

                const filterTrip = (trip: typeof trips[0], includeDate: boolean) => {
                  if (trip.status !== TripStatus.WAITING) return false;
                  const tripVehicle = (bookTicketSearch || vehicleTypeFilter)
                    ? vehicles.find(v => v.licensePlate === trip.licensePlate)
                    : undefined;
                  if (bookTicketSearch) {
                    const searchable = [
                      trip.route || '',
                      trip.driverName || '',
                      trip.licensePlate || '',
                      trip.time || '',
                      trip.date || '',
                      String(trip.price || ''),
                      tripVehicle?.type || '',
                    ].join(' ');
                    if (!matchesSearch(searchable, bookTicketSearch)) return false;
                  }
                  if (effectiveFrom && !matchesSearch(trip.route || '', effectiveFrom)) return false;
                  if (effectiveTo && !matchesSearch(trip.route || '', effectiveTo)) return false;
                  if (includeDate && effectiveDate && trip.date && trip.date !== effectiveDate) return false;
                  if (vehicleTypeFilter && (!tripVehicle || tripVehicle.type !== vehicleTypeFilter)) return false;
                  if (priceMin) {
                    const minVal = parseInt(priceMin);
                    if (!isNaN(minVal) && trip.price < minVal) return false;
                  }
                  if (priceMax) {
                    const maxVal = parseInt(priceMax);
                    if (!isNaN(maxVal) && trip.price > maxVal) return false;
                  }
                  const totalPassengers = searchAdults + searchChildren;
                  const emptySeats = (trip.seats || []).filter(s => s.status === SeatStatus.EMPTY).length;
                  if (emptySeats < totalPassengers) return false;
                  return true;
                };

                const filteredBookingTrips = trips.filter(t => filterTrip(t, true)).sort((a, b) => compareTripDateTime(a, b));

                // Nearest trips: same route/direction but without date restriction, sorted by date proximity
                const nearestTrips = filteredBookingTrips.length === 0 && (effectiveFrom || effectiveTo)
                  ? trips
                      .filter(t => filterTrip(t, false))
                      .sort((a, b) => {
                        if (!effectiveDate) return compareTripDateTime(a, b);
                        const target = new Date(effectiveDate).getTime();
                        const aDate = new Date(a.date || '9999-12-31').getTime();
                        const bDate = new Date(b.date || '9999-12-31').getTime();
                        return Math.abs(aDate - target) - Math.abs(bDate - target);
                      })
                      .slice(0, 5)
                  : [];

                const renderTripCard = (trip: typeof trips[0], isSuggestion = false) => {
                  const tripRoute = routes.find(r => r.name === trip.route);
                  const routeImages = (tripRoute?.images && tripRoute.images.length > 0) ? tripRoute.images : (tripRoute?.imageUrl ? [tripRoute.imageUrl] : []);
                  const vehicleImg = tripRoute?.vehicleImageUrl;
                  const carouselIdx = tripCardImgIdx[trip.id] ?? 0;
                  const currentImg = routeImages[carouselIdx] ?? null;
                  const isTripRevealed = hasSearched || clearedTripCards.has(trip.id);
                  const tripVehicle = vehicles.find(v => v.licensePlate === trip.licensePlate);
                  const emptySeats = (trip.seats || []).filter(s => s.status === SeatStatus.EMPTY).length;
                  return (
                  <div key={trip.id} className={cn("bg-white rounded-3xl border shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col", isSuggestion ? "border-amber-200 opacity-95" : "border-gray-100")}>
                    {/* Route name – full-width header row */}
                    <div className="px-3 pt-2.5 pb-1">
                      <span aria-label={`Tuyến: ${trip.route}`} className="px-2 py-0.5 bg-daiichi-accent text-daiichi-red rounded-full text-[11px] font-bold uppercase block text-center w-full">{trip.route}</span>
                    </div>
                    {/* 3-column body: [image | schedule info | seats+price+CTA] */}
                    {/* Mobile: image full-width on top row, info columns side by side below */}
                    {/* Desktop (md+): all 3 columns side by side */}
                    <div className="grid grid-cols-2 md:grid-cols-[2fr_1.5fr_1.5fr] gap-2 px-2 pb-2">
                      {/* Column 1: Large route image – full width on mobile, proportional column on desktop */}
                      <div className="col-span-2 md:col-span-1 relative overflow-hidden rounded-2xl aspect-video md:aspect-auto md:min-h-[110px]">
                        {(currentImg || vehicleImg) ? (
                          <>
                            {currentImg && (
                              <img
                                src={currentImg}
                                alt={trip.route}
                                className="absolute inset-0 w-full h-full object-cover transition-all duration-700"
                                style={{ filter: isTripRevealed ? 'none' : 'blur(12px)', transform: isTripRevealed ? 'scale(1)' : 'scale(1.1)' }}
                                referrerPolicy="no-referrer"
                              />
                            )}
                            {vehicleImg && (
                              <img
                                src={vehicleImg}
                                alt={trip.licensePlate}
                                className="absolute bottom-1 right-1 w-12 h-8 object-cover rounded-lg border-2 border-white shadow-md transition-all duration-700"
                                style={{ filter: isTripRevealed ? 'none' : 'blur(8px)' }}
                                referrerPolicy="no-referrer"
                              />
                            )}
                            {/* Carousel prev/next buttons */}
                            {isTripRevealed && routeImages.length > 1 && (
                              <>
                                <button
                                  type="button"
                                  onClick={e => { e.stopPropagation(); setTripCardImgIdx(prev => ({ ...prev, [trip.id]: (carouselIdx - 1 + routeImages.length) % routeImages.length })); }}
                                  className="absolute left-0.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-black/40 text-white text-xs hover:bg-black/60 transition-all z-10"
                                  aria-label="Previous image"
                                >‹</button>
                                <button
                                  type="button"
                                  onClick={e => { e.stopPropagation(); setTripCardImgIdx(prev => ({ ...prev, [trip.id]: (carouselIdx + 1) % routeImages.length })); }}
                                  className="absolute right-0.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-black/40 text-white text-xs hover:bg-black/60 transition-all z-10"
                                  aria-label="Next image"
                                >›</button>
                                {/* Dot indicators */}
                                <div className="absolute bottom-0.5 left-0 right-0 flex justify-center gap-0.5 z-10">
                                  {routeImages.map((_, idx) => (
                                    <button
                                      key={idx}
                                      type="button"
                                      aria-label={`Ảnh ${idx + 1}`}
                                      onClick={e => { e.stopPropagation(); setTripCardImgIdx(prev => ({ ...prev, [trip.id]: idx })); }}
                                      className="w-4 h-4 flex items-center justify-center rounded-full transition-all hover:bg-black/20"
                                    >
                                      <span className={cn("w-1 h-1 rounded-full block transition-all", idx === carouselIdx ? "bg-white" : "bg-white/50")} />
                                    </button>
                                  ))}
                                </div>
                              </>
                            )}
                            {!isTripRevealed && (
                              <div
                                className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer"
                                onClick={() => setClearedTripCards(prev => new Set([...prev, trip.id]))}
                              >
                                <span className="text-white text-[9px] font-bold bg-black/40 px-1.5 py-0.5 rounded-full text-center leading-tight">
                                  {language === 'vi' ? '👆 Chạm xem ảnh' : '👆 Tap to reveal'}
                                </span>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
                            <Bus size={28} className="text-gray-300" />
                          </div>
                        )}
                      </div>
                      {/* Column 2: Vehicle type + departure time + date/schedule */}
                      <div className="col-span-1 flex flex-col justify-center gap-1.5 py-1 min-w-0">
                        {/* Vehicle type */}
                        {tripVehicle?.type && (
                          <div className="flex items-center gap-1">
                            <Bus size={10} className="flex-shrink-0 text-gray-400" />
                            <span className="text-[10px] text-gray-500 truncate">{tripVehicle.type}</span>
                          </div>
                        )}
                        {/* License plate */}
                        <span className="text-[9px] text-gray-400 truncate">{trip.licensePlate}</span>
                        {/* Departure time */}
                        <div>
                          <p className="text-lg font-bold text-gray-800 leading-tight">{trip.time}</p>
                          <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide">{t.departure}</p>
                        </div>
                        {/* Date */}
                        {trip.date && (
                          <span className={cn("inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold self-start", isSuggestion ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500")}>
                            {formatTripDateDisplay(trip.date)}
                          </span>
                        )}
                      </div>
                      {/* Column 3: Driver name + Seats left + price + CTA button */}
                      <div className="col-span-1 flex flex-col justify-between gap-1.5 py-1 pr-1 min-w-0">
                        {/* Driver name */}
                        <div className="flex items-center gap-1 text-[10px] text-gray-500">
                          <Users size={10} className="flex-shrink-0" />
                          <span className="truncate">{trip.driverName}</span>
                        </div>
                        {/* Seats left */}
                        <div className="flex items-center gap-1 text-[10px] text-gray-500">
                          <Bus size={10} className="flex-shrink-0" />
                          <span className="truncate">{emptySeats} {t.seats_left}</span>
                        </div>
                        {/* Add-ons badge – clickable to show service details */}
                        {(trip.addons || []).length > 0 && (
                          <button
                            onClick={() => setShowAddonDetailTrip(trip)}
                            aria-label={language === 'vi' ? 'Xem chi tiết dịch vụ kèm theo' : language === 'ja' ? '付帯サービスの詳細を見る' : 'View add-on services details'}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[9px] font-bold border border-emerald-200 self-start hover:bg-emerald-100 transition-colors cursor-pointer"
                          >
                            <Gift size={9} />
                            {(trip.addons || []).length} {language === 'vi' ? 'dịch vụ' : language === 'ja' ? '付帯' : 'add-ons'}
                          </button>
                        )}
                        {/* Price */}
                        <div className="mt-auto">
                          {currentUser?.role === UserRole.AGENT && (trip.agentPrice || 0) > 0 ? (
                            <div>
                              <p className="text-sm font-bold text-daiichi-red leading-tight">{(trip.agentPrice || 0).toLocaleString()}đ</p>
                              <p className="text-[9px] text-gray-400 line-through">{trip.price.toLocaleString()}đ</p>
                              <span className="text-[9px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-100">
                                💰 {(trip.price - (trip.agentPrice || 0)).toLocaleString()}đ
                              </span>
                            </div>
                          ) : (
                            <p className="text-sm font-bold text-daiichi-red leading-tight">{trip.price.toLocaleString()}đ</p>
                          )}
                        </div>
                        {/* Select seat CTA */}
                        <button
                          onClick={() => { setSelectedTrip(trip); setPreviousTab('book-ticket'); setActiveTab('seat-mapping'); }}
                          className="w-full px-2 py-1.5 bg-daiichi-red text-white rounded-xl text-xs font-bold shadow-lg shadow-daiichi-red/10"
                        >
                          {t.select_seat}
                        </button>
                      </div>
                    </div>
                  </div>
                  );
                };

                if (filteredBookingTrips.length > 0) {
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {filteredBookingTrips.map(trip => renderTripCard(trip, false))}
                    </div>
                  );
                }

                // Inquiry form (shared for both "nearest trips available" and "no trips at all" cases)
                const inquiryFormEl = !inquirySuccess ? (
                  <div className="bg-white p-6 rounded-3xl border border-daiichi-red/20 shadow-sm">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-10 h-10 bg-daiichi-red/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <Phone size={20} className="text-daiichi-red" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-800">{t.inquiry_title}</h4>
                        <p className="text-xs text-gray-500 mt-0.5">{t.inquiry_subtitle}</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-bold text-gray-500 uppercase">{t.customer_name} *</label>
                          <input type="text" value={inquiryName} onChange={e => setInquiryName(e.target.value)}
                            className="w-full mt-1 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                            placeholder={t.enter_name} />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-500 uppercase">{t.phone_number} *</label>
                          <input type="tel" value={inquiryPhone} onChange={e => setInquiryPhone(e.target.value)}
                            className="w-full mt-1 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                            placeholder={t.enter_phone} />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">{t.inquiry_email_label}</label>
                        <input type="email" value={inquiryEmail} onChange={e => setInquiryEmail(e.target.value)}
                          className="w-full mt-1 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                          placeholder={t.inquiry_email_ph} />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">{t.inquiry_notes_label}</label>
                        <textarea value={inquiryNotes} onChange={e => setInquiryNotes(e.target.value)} rows={3}
                          className="w-full mt-1 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20 resize-none text-sm"
                          placeholder={t.inquiry_notes_ph} />
                      </div>
                      {inquiryError && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                          <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
                          <p className="text-sm text-red-600">{inquiryError}</p>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={handleInquirySubmit}
                        disabled={inquiryLoading || !inquiryName.trim() || !inquiryPhone.trim()}
                        className={cn("w-full py-3 text-white rounded-xl font-bold shadow-lg transition-all", inquiryLoading || !inquiryName.trim() || !inquiryPhone.trim() ? "bg-gray-300 shadow-gray-200 cursor-not-allowed" : "bg-daiichi-red shadow-daiichi-red/20 hover:scale-[1.02]")}
                      >
                        {inquiryLoading ? t.inquiry_sending : t.inquiry_submit}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-3xl p-8 text-center">
                    <CheckCircle2 size={48} className="text-green-500 mx-auto mb-3" />
                    <h4 className="text-xl font-bold text-gray-800 mb-2">{t.inquiry_success_title}</h4>
                    <p className="text-sm text-gray-600 max-w-md mx-auto">{t.inquiry_success_desc}</p>
                    <button
                      onClick={() => { setInquirySuccess(false); setShowInquiryForm(false); }}
                      className="mt-5 px-6 py-2.5 bg-white border border-green-200 rounded-xl font-bold text-gray-600 hover:bg-green-50 transition-colors"
                    >
                      {t.inquiry_search_again}
                    </button>
                  </div>
                );

                if (nearestTrips.length > 0) {
                  return (
                    <>
                      <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                        <AlertTriangle size={20} className="text-amber-500 flex-shrink-0" />
                        <p className="text-sm font-medium text-amber-700">{t.no_exact_trips}</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {nearestTrips.map(trip => renderTripCard(trip, true))}
                      </div>
                      {!showInquiryForm && !inquirySuccess && (
                        <div className="text-center pt-2 pb-2">
                          <p className="text-sm text-gray-500 mb-3">{t.inquiry_not_satisfied}</p>
                          <button
                            onClick={() => setShowInquiryForm(true)}
                            className="px-6 py-3 border-2 border-daiichi-red text-daiichi-red rounded-2xl font-bold hover:bg-daiichi-accent transition-colors"
                          >
                            {t.inquiry_request_btn}
                          </button>
                        </div>
                      )}
                      {showInquiryForm && inquiryFormEl}
                    </>
                  );
                }

                // No trips at all
                return (
                  <>
                    {!showInquiryForm && !inquirySuccess && (
                      <div className="text-center py-10 text-gray-400">
                        <Search size={40} className="mx-auto mb-3 opacity-30" />
                        <p className="font-medium mb-4">{t.no_trips_found}</p>
                        <p className="text-sm text-gray-500 mb-3">{t.no_trips_at_all_prompt}</p>
                        <button
                          onClick={() => setShowInquiryForm(true)}
                          className="px-6 py-3 border-2 border-daiichi-red text-daiichi-red rounded-2xl font-bold hover:bg-daiichi-accent transition-colors"
                        >
                          {t.inquiry_request_btn}
                        </button>
                      </div>
                    )}
                    {(showInquiryForm || inquirySuccess) && inquiryFormEl}
                  </>
                );
              })()}
            </div>
            {/* Addon detail modal – shown when user clicks gift badge on a trip card */}
            {showAddonDetailTrip && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddonDetailTrip(null)}>
                <div role="dialog" aria-modal="true" aria-labelledby="addon-detail-title" className="bg-white rounded-[32px] p-6 max-w-md w-full space-y-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Gift size={20} className="text-emerald-600" />
                      <h3 id="addon-detail-title" className="text-lg font-bold text-emerald-700">
                        {language === 'vi' ? 'Dịch vụ kèm theo' : language === 'ja' ? '付帯サービス' : 'Add-on Services'}
                      </h3>
                    </div>
                    <button onClick={() => setShowAddonDetailTrip(null)} aria-label={language === 'vi' ? 'Đóng' : language === 'ja' ? '閉じる' : 'Close'} className="p-2 hover:bg-gray-50 rounded-xl"><X size={20} /></button>
                  </div>
                  <p className="text-sm text-gray-500">{showAddonDetailTrip.time} · {showAddonDetailTrip.route}</p>
                  <div className="space-y-3">
                    {(showAddonDetailTrip.addons || []).map((addon: TripAddon) => (
                      <div key={addon.id} className="flex items-start gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-gray-800">{addon.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">
                              {addon.type === 'SIGHTSEEING' ? t.addon_type_sightseeing : addon.type === 'TRANSPORT' ? t.addon_type_transport : addon.type === 'FOOD' ? t.addon_type_food : t.addon_type_other}
                            </span>
                          </div>
                          {addon.description && <p className="text-xs text-gray-500 mt-1">{addon.description}</p>}
                        </div>
                        <span className="text-sm font-bold text-daiichi-red whitespace-nowrap">+{addon.price.toLocaleString()}đ</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'seat-mapping':
        if (!selectedTrip) return null;
        {
          const childrenOver4Count = childrenAges.filter(age => age > 4).length;
          const extraSeatsNeeded = (adults - 1) + childrenOver4Count;
          // Look up route once for this render block (used for surcharges, fare table, and blocker check)
          const tripRoute = routes.find(r => r.name === selectedTrip.route);
          // Also disable confirmation when a fare lookup error exists for a route with configured stops
          const hasFareBlocker = !!fareError && (tripRoute?.routeStops?.length ?? 0) > 0;
          const isFreeSeatingTrip = selectedTrip.seatType === 'free';
          const canConfirmBooking = isFreeSeatingTrip
            ? !hasFareBlocker
            : (extraSeatsNeeded === 0 || extraSeatIds.length >= extraSeatsNeeded) && !hasFareBlocker;
          const isSelectingExtraSeats = !isFreeSeatingTrip && !!showBookingForm && (adults > 1 || childrenOver4Count > 0);

          // Route-level surcharges
          const tripDate = selectedTrip.date || '';
          const applicableRouteSurcharges = getApplicableRouteSurcharges(tripRoute, tripDate);
          // Pre-compute all stop names for pickup/dropoff address selects
          const allStopNames = stops.map(s => s.name);

          // Build seat status lookup
          const seatStatusMap: Record<string, SeatStatus> = {};
          selectedTrip.seats.forEach((s: any) => { seatStatusMap[s.id] = s.status; });

          // Reconstruct visual layout grid from trip seats using row/col/deck
          // Try seats with row info first; fall back to vehicle saved layout or flat list
          const tripSeatsWithLayout = selectedTrip.seats.filter((s: any) => s.row !== undefined && s.row !== null);
          const selectedVehicle = vehicles.find(v => v.licensePlate === selectedTrip.licensePlate);
          const savedVehicleLayout = selectedVehicle?.layout as SerializedSeat[] | null | undefined;

          // Build the layout grid to render
          let layoutGrid: (SerializedSeat | null)[][][] = [];
          if (tripSeatsWithLayout.length > 0) {
            // Use trip seats' row/col/deck info
            const deckCount = Math.max(...selectedTrip.seats.map((s: any) => s.deck || 0)) + 1;
            const rowCount = Math.max(...selectedTrip.seats.map((s: any) => s.row ?? 0)) + 1;
            const colCount = Math.max(...selectedTrip.seats.map((s: any) => s.col ?? 0)) + 1;
            for (let d = 0; d < deckCount; d++) {
              const deck: (SerializedSeat | null)[][] = [];
              for (let r = 0; r < rowCount; r++) {
                const row: (SerializedSeat | null)[] = [];
                for (let c = 0; c < colCount; c++) {
                  const seat = selectedTrip.seats.find((s: any) => (s.deck || 0) === d && (s.row ?? -1) === r && (s.col ?? -1) === c);
                  row.push(seat ? { id: `${d}-${r}-${c}`, label: seat.id, row: r, col: c, deck: d, discounted: false, booked: false } : null);
                }
                deck.push(row);
              }
              layoutGrid.push(deck);
            }
          } else if (savedVehicleLayout && savedVehicleLayout.length > 0) {
            // Use vehicle's saved layout
            const deckCount = Math.max(...savedVehicleLayout.map(s => s.deck)) + 1;
            const rowCount = Math.max(...savedVehicleLayout.map(s => s.row)) + 1;
            const colCount = Math.max(...savedVehicleLayout.map(s => s.col)) + 1;
            for (let d = 0; d < deckCount; d++) {
              const deck: (SerializedSeat | null)[][] = [];
              for (let r = 0; r < rowCount; r++) {
                const row: (SerializedSeat | null)[] = [];
                for (let c = 0; c < colCount; c++) {
                  const s = savedVehicleLayout.find(x => x.deck === d && x.row === r && x.col === c);
                  row.push(s ?? null);
                }
                deck.push(row);
              }
              layoutGrid.push(deck);
            }
          }

          const hasLayoutGrid = layoutGrid.length > 0;
          const deckCount = hasLayoutGrid ? layoutGrid.length : 1;
          const hasDualDeck = deckCount > 1;
          const currentGrid = hasLayoutGrid ? (layoutGrid[activeDeck] ?? []) : null;

          // Segment-aware availability: when the route has stops and user has selected pickup/dropoff,
          // a seat booked for a non-overlapping segment appears as available (empty).
          const hasSegmentSelection = !!(tripRoute?.routeStops?.length && fromStopId && toStopId);
          const currentFromOrder = hasSegmentSelection
            ? (tripRoute!.routeStops!.find(s => s.stopId === fromStopId)?.order ?? -1)
            : -1;
          const currentToOrder = hasSegmentSelection
            ? (tripRoute!.routeStops!.find(s => s.stopId === toStopId)?.order ?? -1)
            : -1;

          const getEffectiveStatus = (seatId: string): SeatStatus => {
            const rawStatus = seatStatusMap[seatId] ?? SeatStatus.EMPTY;
            if (!hasSegmentSelection || rawStatus === SeatStatus.EMPTY) return rawStatus;
            if (currentFromOrder < 0 || currentToOrder < 0) return rawStatus;
            // Look up the seat's stop orders from the trip seat data
            const seatData = selectedTrip.seats.find((s: any) => s.id === seatId);
            const sFrom = seatData?.fromStopOrder;
            const sTo = seatData?.toStopOrder;
            if (sFrom === undefined || sTo === undefined) return rawStatus;
            // Two segments [sFrom, sTo) and [currentFromOrder, currentToOrder) overlap iff:
            //   sFrom < currentToOrder AND currentFromOrder < sTo
            const overlaps = sFrom < currentToOrder && currentFromOrder < sTo;
            if (!overlaps) return SeatStatus.EMPTY; // seat is free for our segment
            return rawStatus;
          };

          const renderSeatButton = (seatId: string) => {
            const status = getEffectiveStatus(seatId);
            const rawStatus = seatStatusMap[seatId] ?? SeatStatus.EMPTY;
            const isSegmentFree = hasSegmentSelection && status === SeatStatus.EMPTY && rawStatus !== SeatStatus.EMPTY;
            const isPrimarySeat = seatId === showBookingForm;
            const isExtraSeat = extraSeatIds.includes(seatId);
            return (
              <motion.button
                key={seatId}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  if (status !== SeatStatus.EMPTY) return;
                  if (showBookingForm) {
                    if (isPrimarySeat) return;
                    if (isExtraSeat) {
                      setSeatSelectionHistory(prev => [...prev, { primarySeat: showBookingForm, extraSeats: extraSeatIds }]);
                      setExtraSeatIds(prev => prev.filter(id => id !== seatId));
                    } else if (isSelectingExtraSeats && extraSeatIds.length < extraSeatsNeeded) {
                      setSeatSelectionHistory(prev => [...prev, { primarySeat: showBookingForm, extraSeats: extraSeatIds }]);
                      setExtraSeatIds(prev => [...prev, seatId]);
                    } else if (!isSelectingExtraSeats) {
                      setSeatSelectionHistory(prev => [...prev, { primarySeat: showBookingForm, extraSeats: extraSeatIds }]);
                      setExtraSeatIds([]);
                      setShowBookingForm(seatId);
                    }
                  } else {
                    setSeatSelectionHistory(prev => [...prev, { primarySeat: null, extraSeats: [] }]);
                    setShowBookingForm(seatId);
                    // Pre-fill name & phone for logged-in customers
                    if (currentUser?.role === UserRole.CUSTOMER) {
                      if (currentUser.name) setCustomerNameInput(currentUser.name);
                      if (currentUser.phone) setPhoneInput(currentUser.phone);
                    }
                  }
                }}
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center text-[10px] font-bold border-2 transition-all flex-shrink-0 relative",
                  rawStatus === SeatStatus.PAID && !isSegmentFree && "bg-daiichi-red text-white border-daiichi-red shadow-lg shadow-daiichi-red/20",
                  rawStatus === SeatStatus.BOOKED && !isSegmentFree && "bg-daiichi-yellow text-white border-daiichi-yellow shadow-lg shadow-daiichi-yellow/20",
                  isSegmentFree && !isPrimarySeat && !isExtraSeat && "bg-emerald-50 border-emerald-400 text-emerald-600 hover:border-daiichi-red hover:text-daiichi-red",
                  isPrimarySeat && "bg-daiichi-red/20 border-daiichi-red text-daiichi-red",
                  isExtraSeat && "bg-blue-100 border-blue-500 text-blue-600",
                  status === SeatStatus.EMPTY && !isSegmentFree && !isPrimarySeat && !isExtraSeat && "bg-white border-gray-200 text-gray-500 hover:border-daiichi-red hover:text-daiichi-red"
                )}
                title={isSegmentFree ? (language === 'vi' ? 'Trống cho chặng này' : 'Free for this segment') : undefined}
              >
                {seatId}
                {rawStatus === SeatStatus.PAID && !isSegmentFree && <CheckCircle2 size={10} className="absolute top-0.5 right-0.5" />}
                {isExtraSeat && <span className="absolute top-0 right-0.5 text-[7px] font-bold text-blue-600">+</span>}
                {isSegmentFree && <span className="absolute top-0 right-0 text-[7px] font-bold text-emerald-600">✓</span>}
              </motion.button>
            );
          };

          return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-4 sm:p-8 rounded-[40px] shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setShowBookingForm(null); setExtraSeatIds([]); setAddonQuantities({}); setActiveTab(previousTab); }}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-gray-500 hover:text-daiichi-red hover:bg-gray-50 rounded-xl transition-all"
                    title={language === 'vi' ? 'Quay lại' : language === 'ja' ? '戻る' : 'Go back'}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
                    {language === 'vi' ? 'Quay lại' : language === 'ja' ? '戻る' : 'Back'}
                  </button>
                  <div>
                    <h2 className="text-2xl font-bold">
                      {tripType === 'ROUND_TRIP' && previousTab === 'book-ticket'
                        ? (roundTripPhase === 'return' ? t.seat_map_return : t.seat_map_outbound)
                        : t.seat_map_title}
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">{selectedTrip.licensePlate}</p>
                  </div>
                </div>
                {hasDualDeck && (
                  <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button onClick={() => setActiveDeck(0)} className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all", activeDeck === 0 ? "bg-white text-daiichi-red shadow-sm" : "text-gray-500")}>{t.deck_lower}</button>
                    <button onClick={() => setActiveDeck(1)} className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all", activeDeck === 1 ? "bg-white text-daiichi-red shadow-sm" : "text-gray-500")}>{t.deck_upper}</button>
                  </div>
                )}
              </div>

              {isSelectingExtraSeats && extraSeatIds.length < extraSeatsNeeded && (
                <div className="mb-4 p-3 bg-orange-50 rounded-2xl border border-orange-200 flex items-center gap-2">
                  <span className="text-orange-500 font-bold text-sm">
                    {t.select_extra_seats_prompt} ({extraSeatIds.length}/{extraSeatsNeeded})
                  </span>
                </div>
              )}

              {isFreeSeatingTrip ? (
                /* ── FREE SEATING: no seat diagram, show available count + book button ── */
                <div className="max-w-lg mx-auto bg-gray-50 p-6 sm:p-10 rounded-[32px] border border-gray-100 text-center space-y-6">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-5xl font-bold text-daiichi-red">
                      {selectedTrip.seats.filter((s: any) => s.status === SeatStatus.EMPTY).length}
                    </span>
                    <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">
                      {language === 'vi' ? 'chỗ trống còn lại' : language === 'ja' ? '空席残り' : 'seats available'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {language === 'vi'
                        ? `Tổng: ${selectedTrip.seats.length} chỗ • Đã đặt: ${selectedTrip.seats.filter((s: any) => s.status !== SeatStatus.EMPTY).length} chỗ`
                        : `Total: ${selectedTrip.seats.length} • Booked: ${selectedTrip.seats.filter((s: any) => s.status !== SeatStatus.EMPTY).length}`}
                    </span>
                  </div>
                  <div className="px-4 py-2 bg-blue-50 rounded-2xl border border-blue-100 inline-block mx-auto">
                    <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">
                      🪑 {language === 'vi' ? 'Xe ghế tự do – Không chọn ghế' : language === 'ja' ? '自由席 – 座席指定なし' : 'Free Seating – No seat selection'}
                    </span>
                  </div>
                  {!showBookingForm && (
                    <button
                      onClick={() => {
                        if (selectedTrip.seats.filter((s: any) => s.status === SeatStatus.EMPTY).length === 0) return;
                        // Push a no-op history entry so Escape/undo can cancel the booking form
                        setSeatSelectionHistory(prev => [...prev, { primarySeat: null, extraSeats: [] }]);
                        setShowBookingForm('FREE');
                        if (currentUser?.role === UserRole.CUSTOMER) {
                          if (currentUser.name) setCustomerNameInput(currentUser.name);
                          if (currentUser.phone) setPhoneInput(currentUser.phone);
                        }
                      }}
                      disabled={selectedTrip.seats.filter((s: any) => s.status === SeatStatus.EMPTY).length === 0}
                      className="px-8 py-4 bg-daiichi-red text-white rounded-2xl font-bold shadow-lg shadow-daiichi-red/20 disabled:opacity-50 disabled:cursor-not-allowed text-base"
                    >
                      {language === 'vi' ? '🎫 Đặt vé' : language === 'ja' ? '🎫 予約する' : '🎫 Book Ticket'}
                    </button>
                  )}
                </div>
              ) : (
              <div className="max-w-lg mx-auto bg-gray-50 p-4 sm:p-6 rounded-[32px] border border-gray-100">
                {/* Front of bus indicator */}
                <div className="flex items-center gap-2 mb-3 text-xs text-gray-400 font-semibold">
                  <span>← {language === 'vi' ? 'Đầu xe (Tài xế bên trái)' : 'Front (Driver on left)'}</span>
                </div>

                {hasLayoutGrid && currentGrid ? (
                  // Render proper bus layout grid
                  <div className="space-y-1.5">
                    {currentGrid.map((row, rowIdx) => (
                      <div key={rowIdx} className="flex gap-1.5 justify-center">
                        {row.map((cell, colIdx) => {
                          if (!cell) {
                            // Aisle / empty cell
                            return <div key={colIdx} className="w-10 h-10 flex-shrink-0" />;
                          }
                          return (
                            <div key={colIdx} className="w-10 flex-shrink-0">
                              {renderSeatButton(cell.label)}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ) : (
                  // Fallback: flat grid (old behaviour)
                  <div className="grid grid-cols-3 gap-3">
                    {selectedTrip.seats.filter((s: any) => (s.deck || 0) === activeDeck).map((seat: any) => (
                      <div key={seat.id}>
                        {renderSeatButton(seat.id)}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-6 flex justify-center flex-wrap gap-4 text-xs font-bold uppercase tracking-wider">
                  <div className="flex items-center gap-2"><div className="w-4 h-4 bg-daiichi-red rounded" /> {t.paid}</div>
                  <div className="flex items-center gap-2"><div className="w-4 h-4 bg-daiichi-yellow rounded" /> {t.booked}</div>
                  <div className="flex items-center gap-2"><div className="w-4 h-4 bg-white border border-gray-200 rounded" /> {t.empty}</div>
                  {hasSegmentSelection && (
                    <div className="flex items-center gap-2"><div className="w-4 h-4 bg-emerald-50 border-2 border-emerald-400 rounded" /> {language === 'vi' ? 'Trống chặng này' : language === 'ja' ? 'この区間は空き' : 'Free for segment'}</div>
                  )}
                </div>
              </div>
              )}

              {/* Route details panel */}
              {tripRoute && (tripRoute.departurePoint || tripRoute.arrivalPoint || tripRoute.details || tripRoute.note) && (
                <div className="mt-6 bg-blue-50 border border-blue-100 rounded-[24px] p-5 space-y-3">
                  <h4 className="text-sm font-bold text-blue-800">{t.route_details_title}</h4>
                  {(tripRoute.departurePoint || tripRoute.arrivalPoint) && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold text-gray-700">{tripRoute.departurePoint}</span>
                      <span className="text-blue-400 font-bold">→</span>
                      <span className="font-semibold text-gray-700">{tripRoute.arrivalPoint}</span>
                    </div>
                  )}
                  {tripRoute.details && (
                    <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{tripRoute.details}</p>
                  )}
                  {tripRoute.note && (
                    <div className="pt-2 border-t border-blue-100">
                      <p className="text-xs font-bold text-blue-700 mb-1">
                        {language === 'vi' ? 'Ghi chú' : language === 'ja' ? 'メモ' : 'Note'}
                      </p>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{tripRoute.note}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold">{t.trip_info}</h3>
                  {isFreeSeatingTrip && (
                    <span className="px-2 py-1 text-[10px] font-bold rounded-lg bg-blue-100 text-blue-600 uppercase tracking-wide">
                      🪑 {language === 'vi' ? 'Ghế tự do' : language === 'ja' ? '自由席' : 'Free Seating'}
                    </span>
                  )}
                </div>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">{t.total_seats}</span><span className="font-bold">{selectedTrip.seats.length}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">{t.paid_seats}</span><span className="font-bold text-green-600">{selectedTrip.seats.filter(s => s.status === SeatStatus.PAID).length}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">{t.booked_seats}</span><span className="font-bold text-daiichi-yellow">{selectedTrip.seats.filter(s => s.status === SeatStatus.BOOKED).length}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">{t.empty_seats}</span><span className="font-bold text-gray-400">{selectedTrip.seats.filter(s => s.status === SeatStatus.EMPTY).length}</span></div>
                </div>
              </div>

              {!showBookingForm && (selectedTrip.addons || []).length > 0 && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-emerald-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Gift size={20} className="text-emerald-600" />
                    <h3 className="text-lg font-bold text-emerald-700">{language === 'vi' ? 'Dịch vụ bổ sung' : language === 'ja' ? '付帯サービス' : 'Add-on Services'}</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">{isFreeSeatingTrip ? (language === 'vi' ? 'Thêm các dịch vụ bổ sung vào vé của bạn:' : 'Add optional services to your booking:') : (language === 'vi' ? 'Chọn ghế để thêm các dịch vụ bổ sung vào vé của bạn:' : language === 'ja' ? '座席を選択してオプションサービスを追加できます:' : 'Select a seat to add these optional services to your booking:')}</p>
                  <div className="space-y-2">
                    {(selectedTrip.addons || []).map((addon: TripAddon) => (
                      <div key={addon.id} className="flex items-start gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-gray-800">{addon.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">
                              {addon.type === 'SIGHTSEEING' ? t.addon_type_sightseeing : addon.type === 'TRANSPORT' ? t.addon_type_transport : addon.type === 'FOOD' ? t.addon_type_food : t.addon_type_other}
                            </span>
                          </div>
                          {addon.description && <p className="text-xs text-gray-500 mt-0.5">{addon.description}</p>}
                        </div>
                        <span className="text-sm font-bold text-daiichi-red whitespace-nowrap">+{addon.price.toLocaleString()}đ</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {showBookingForm && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-white p-6 rounded-2xl shadow-sm border-2 border-daiichi-red">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">
                      {isFreeSeatingTrip
                        ? (language === 'vi' ? '🪑 Đặt vé ghế tự do' : language === 'ja' ? '🪑 自由席予約' : '🪑 Free Seating Booking')
                        : `${t.booking_title}: ${showBookingForm}`}
                    </h3>
                    <button onClick={() => { setShowBookingForm(null); setExtraSeatIds([]); setAddonQuantities({}); }} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                  </div>
                  <form className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">{t.adults}</label>
                        <div className="flex items-center gap-2 mt-1 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl">
                          <button type="button" onClick={() => {
                            const newAdults = Math.max(1, adults - 1);
                            setAdults(newAdults);
                            const currentOver4Count = childrenAges.filter(age => age > 4).length;
                            const newExtraSeatsNeeded = (newAdults - 1) + currentOver4Count;
                            setExtraSeatIds(prev => prev.slice(0, newExtraSeatsNeeded));
                          }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 font-bold text-lg leading-none flex-shrink-0">−</button>
                          <span className="flex-1 text-center font-bold text-gray-800">{adults}</span>
                          <button type="button" onClick={() => setAdults(adults + 1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-daiichi-red text-white font-bold text-lg leading-none flex-shrink-0">+</button>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">{t.children}</label>
                        <div className="flex items-center gap-2 mt-1 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl">
                          <button type="button" onClick={() => {
                            const count = Math.max(0, children - 1);
                            setChildren(count);
                            setChildrenAges(prev => prev.slice(0, count));
                            const newAges = childrenAges.slice(0, count);
                            const newOver4Count = newAges.filter(age => age > 4).length;
                            setExtraSeatIds(prev => prev.slice(0, newOver4Count));
                          }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 font-bold text-lg leading-none flex-shrink-0">−</button>
                          <span className="flex-1 text-center font-bold text-gray-800">{children}</span>
                          <button type="button" onClick={() => {
                            const count = children + 1;
                            setChildren(count);
                            setChildrenAges(prev => {
                              const arr = [...prev];
                              while (arr.length < count) arr.push(undefined);
                              return arr.slice(0, count);
                            });
                          }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-daiichi-red text-white font-bold text-lg leading-none flex-shrink-0">+</button>
                        </div>
                      </div>
                    </div>

                    {/* Children age inputs */}
                    {children > 0 && (
                      <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 space-y-2">
                        <p className="text-xs font-bold text-blue-600 uppercase">{t.enter_child_ages || "Enter each child's age"}</p>
                        <p className="text-[10px] text-blue-400">{t.child_age_note || 'Children over 4 are charged adult price and need their own seat'}</p>
                        <div className="grid grid-cols-3 gap-2">
                          {Array.from({ length: children }).map((_, i) => (
                            <div key={i} className="relative">
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={childrenAges[i] != null ? String(childrenAges[i]) : ''}
                                placeholder={`${t.child_age_placeholder || 'Age'} ${i + 1}`}
                                onChange={e => {
                                  const ages = [...childrenAges];
                                  const parsed = parseInt(e.target.value);
                                  ages[i] = e.target.value === '' ? undefined : (isNaN(parsed) ? undefined : Math.min(17, Math.max(0, parsed)));
                                  setChildrenAges(ages);
                                  // Trim extra seats if children over 4 count decreased
                                  const newOver4Count = ages.filter(age => (age ?? 0) > 4).length;
                                  setExtraSeatIds(prev => prev.slice(0, newOver4Count));
                                }}
                                className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 text-center"
                              />
                              {(childrenAges[i] ?? 0) > 4 && (
                                <span className="absolute -top-2 -right-1 bg-daiichi-red text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                                  {t.child_counted_as_adult || 'Adult'}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Extra seats required notice for all passengers */}
                    {extraSeatsNeeded > 0 && (
                      <div className={cn("p-3 rounded-xl border space-y-2", canConfirmBooking ? "bg-green-50 border-green-200" : "bg-orange-50 border-orange-200")}>
                        <p className={cn("text-xs font-bold uppercase", canConfirmBooking ? "text-green-600" : "text-orange-600")}>
                          {t.seats_needed_notice || 'All passengers need their own seat'}
                        </p>
                        {!canConfirmBooking && (
                          <p className="text-[10px] text-orange-500">
                            {t.select_extra_seats_prompt_all || 'Please select extra seat(s) on the map for all passengers'} ({extraSeatIds.length}/{extraSeatsNeeded})
                          </p>
                        )}
                        {extraSeatIds.length > 0 && (
                          <div className="flex gap-2 flex-wrap">
                            <span className="text-[10px] text-gray-500 font-bold uppercase">{t.extra_seats_selected_label || 'Extra seats'}:</span>
                            {extraSeatIds.map(id => (
                              <span key={id} className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                {id} ✓
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div><label className="text-xs font-bold text-gray-500 uppercase">{t.customer_name}</label><input type="text" value={customerNameInput} onChange={(e) => setCustomerNameInput(e.target.value)} className="w-full mt-1 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20" placeholder={t.enter_name} /></div>
                    <div><label className="text-xs font-bold text-gray-500 uppercase">{t.phone_number}</label><input type="tel" value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} className="w-full mt-1 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20" placeholder={t.enter_phone} /></div>
                    
                    {/* Departure Stop (Điểm xuất phát) + Pickup Address (Điểm đón) */}
                    {(() => {
                      const hasRouteFares = (tripRoute?.routeStops?.length ?? 0) > 0;
                      // When route has ordered stops, show them in order; otherwise show all stops
                      const pickupOptions = hasRouteFares && tripRoute?.routeStops
                        ? [...tripRoute.routeStops].sort((a, b) => a.order - b.order).map(rs => rs.stopName)
                        : stops.map(s => s.name);
                      // Default departure label from route if no stop selected
                      const defaultDeparture = tripRoute?.departurePoint || '';
                      return (
                        <>
                          <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">{t.pickup_point}</label>
                            <SearchableSelect
                              options={pickupOptions}
                              value={pickupPoint}
                              onChange={(val) => {
                                setPickupPoint(val);
                                // Determine stop ID: prefer routeStops match, fall back to global stops
                                const routeStop = tripRoute?.routeStops?.find(rs => rs.stopName === val);
                                const globalStop = stops.find(s => s.name === val);
                                const newFromId = routeStop?.stopId || globalStop?.id || '';
                                setPickupSurcharge(globalStop?.surcharge || 0);
                                setFromStopId(newFromId);
                                // Reset fare and re-lookup if dropoff is already chosen
                                setFareAmount(null);
                                setFareError('');
                                if (newFromId && toStopId && hasRouteFares) {
                                  lookupFare(tripRoute, newFromId, toStopId);
                                }
                              }}
                              placeholder={pickupPoint ? t.select_pickup : (defaultDeparture || t.select_pickup)}
                              className="mt-1"
                            />
                            {!pickupPoint && defaultDeparture && (
                              <p className="mt-1 text-[10px] text-gray-400">{language === 'vi' ? `Mặc định: ${defaultDeparture}` : `Default: ${defaultDeparture}`}</p>
                            )}
                          </div>
                          <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">{t.pickup_address || 'Điểm đón'}</label>
                            <SearchableSelect
                              options={allStopNames}
                              value={pickupAddress}
                              onChange={setPickupAddress}
                              placeholder={t.pickup_address_ph || 'Chọn hoặc nhập điểm đón...'}
                              className="mt-1"
                              disabled={isAddressDisabled(tripRoute?.disablePickupAddress, tripRoute?.disablePickupAddressFrom, tripRoute?.disablePickupAddressTo, tripDate)}
                            />
                            {isAddressDisabled(tripRoute?.disablePickupAddress, tripRoute?.disablePickupAddressFrom, tripRoute?.disablePickupAddressTo, tripDate) && (
                              <p className="mt-1 text-[10px] text-orange-500">{language === 'vi' ? 'Điểm đón đã bị vô hiệu hóa cho tuyến này' : language === 'ja' ? 'この路線では乗車地点の入力が無効です' : 'Pickup address input is disabled for this route'}</p>
                            )}
                          </div>
                        </>
                      );
                    })()}

                    {/* Destination Stop (Điểm đến) + Dropoff Address (Điểm trả) */}
                    {(() => {
                      const hasRouteFares = (tripRoute?.routeStops?.length ?? 0) > 0;
                      const dropoffOptions = hasRouteFares && tripRoute?.routeStops
                        ? [...tripRoute.routeStops].sort((a, b) => a.order - b.order).map(rs => rs.stopName)
                        : stops.map(s => s.name);
                      // Default arrival label from route if no stop selected
                      const defaultArrival = tripRoute?.arrivalPoint || '';
                      return (
                        <>
                          <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">{t.dropoff_point}</label>
                            <SearchableSelect
                              options={dropoffOptions}
                              value={dropoffPoint}
                              onChange={(val) => {
                                setDropoffPoint(val);
                                // Determine stop ID: prefer routeStops match, fall back to global stops
                                const routeStop = tripRoute?.routeStops?.find(rs => rs.stopName === val);
                                const globalStop = stops.find(s => s.name === val);
                                const newToId = routeStop?.stopId || globalStop?.id || '';
                                setDropoffSurcharge(globalStop?.surcharge || 0);
                                setToStopId(newToId);
                                // Reset fare and re-lookup if pickup is already chosen
                                setFareAmount(null);
                                setFareError('');
                                if (fromStopId && newToId && hasRouteFares) {
                                  lookupFare(tripRoute, fromStopId, newToId);
                                }
                              }}
                              placeholder={dropoffPoint ? t.select_dropoff : (defaultArrival || t.select_dropoff)}
                              className="mt-1"
                            />
                            {!dropoffPoint && defaultArrival && (
                              <p className="mt-1 text-[10px] text-gray-400">{language === 'vi' ? `Mặc định: ${defaultArrival}` : `Default: ${defaultArrival}`}</p>
                            )}
                            {/* Fare lookup feedback */}
                            {fareLoading && (
                              <p className="mt-1 text-xs text-blue-500 animate-pulse">
                                {t.fare_loading || 'Looking up fare...'}
                              </p>
                            )}
                            {!fareLoading && fareError && (
                              <p className="mt-1 text-xs text-red-500 font-medium">{fareError}</p>
                            )}
                            {!fareLoading && fareAmount !== null && (
                              <div className="mt-1 space-y-0.5">
                                <p className="text-xs text-emerald-600 font-bold">
                                  {t.fare_based_price || 'Fare table price'}: {fareAmount.toLocaleString()}đ/{t.per_person || 'person'}
                                </p>
                                {fareAgentAmount !== null && currentUser?.role === UserRole.AGENT && fareAgentAmount !== fareAmount && (
                                  <p className="text-xs text-orange-600 font-bold">
                                    {language === 'vi' ? 'Giá đại lý' : language === 'ja' ? '代理店価格' : 'Agent price'}: {fareAgentAmount.toLocaleString()}đ/{t.per_person || 'person'}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                          <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">{t.dropoff_address || 'Điểm trả'}</label>
                            <SearchableSelect
                              options={allStopNames}
                              value={dropoffAddress}
                              onChange={setDropoffAddress}
                              placeholder={t.dropoff_address_ph || 'Chọn hoặc nhập điểm trả...'}
                              className="mt-1"
                              disabled={isAddressDisabled(tripRoute?.disableDropoffAddress, tripRoute?.disableDropoffAddressFrom, tripRoute?.disableDropoffAddressTo, tripDate)}
                            />
                            {isAddressDisabled(tripRoute?.disableDropoffAddress, tripRoute?.disableDropoffAddressFrom, tripRoute?.disableDropoffAddressTo, tripDate) && (
                              <p className="mt-1 text-[10px] text-orange-500">{language === 'vi' ? 'Điểm trả đã bị vô hiệu hóa cho tuyến này' : language === 'ja' ? 'この路線では降車地点の入力が無効です' : 'Dropoff address input is disabled for this route'}</p>
                            )}
                          </div>
                        </>
                      );
                    })()}

                    {/* Surcharge (custom amount) */}
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">{t.surcharge_label}</label>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={surchargeAmount || ''}
                        onChange={(e) => setSurchargeAmount(parseInt(e.target.value) || 0)}
                        placeholder={t.surcharge_placeholder}
                        className="w-full mt-1 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                      />
                    </div>

                    {/* Add-on Services selection */}
                    {(selectedTrip.addons || []).length > 0 && (
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">{t.select_addons}</label>
                        <p className="text-[10px] text-gray-400 mt-0.5 mb-2">{t.select_addons_hint}</p>
                        <div className="space-y-2">
                          {(selectedTrip.addons as TripAddon[]).map((addon) => {
                            const qty = addonQuantities[addon.id] || 0;
                            const checked = qty > 0;
                            const totalPassengers = adults + children;
                            return (
                              <div
                                key={addon.id}
                                className={cn(
                                  "p-3 rounded-xl border transition-colors",
                                  checked
                                    ? "bg-emerald-50 border-emerald-300"
                                    : "bg-gray-50 border-gray-100"
                                )}
                              >
                                <label className="flex items-center gap-3 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    className="accent-daiichi-red w-4 h-4 flex-shrink-0"
                                    checked={checked}
                                    onChange={(e) => {
                                      setAddonQuantities(prev => ({
                                        ...prev,
                                        [addon.id]: e.target.checked ? Math.max(1, totalPassengers) : 0,
                                      }));
                                    }}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm text-gray-800">{addon.name}</p>
                                    {addon.description && <p className="text-[10px] text-gray-500">{addon.description}</p>}
                                  </div>
                                  <span className="text-sm font-bold text-daiichi-red whitespace-nowrap">
                                    +{addon.price.toLocaleString()}đ/{language === 'vi' ? 'người' : language === 'ja' ? '人' : 'pax'}
                                  </span>
                                </label>
                                {checked && (
                                  <div className="flex items-center gap-2 mt-2 ml-7">
                                    <label className="text-[10px] text-gray-500 font-medium">
                                      {language === 'vi' ? 'Số lượng:' : language === 'ja' ? '数量:' : 'Qty:'}
                                    </label>
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => setAddonQuantities(prev => ({ ...prev, [addon.id]: Math.max(1, qty - 1) }))}
                                        className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-sm flex items-center justify-center"
                                      >−</button>
                                      <input
                                        type="number"
                                        min="1"
                                        value={qty}
                                        onChange={(e) => {
                                          const v = parseInt(e.target.value) || 1;
                                          setAddonQuantities(prev => ({ ...prev, [addon.id]: Math.max(1, v) }));
                                        }}
                                        className="w-12 text-center px-1 py-0.5 bg-white border border-gray-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-1 focus:ring-emerald-400"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setAddonQuantities(prev => ({ ...prev, [addon.id]: qty + 1 }))}
                                        className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-sm flex items-center justify-center"
                                      >+</button>
                                    </div>
                                    <span className="text-[10px] text-emerald-700 font-bold ml-auto">
                                      = {(addon.price * qty).toLocaleString()}đ
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Discount selector */}
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">{t.booking_discount}</label>
                      <select
                        value={bookingDiscount}
                        onChange={(e) => setBookingDiscount(parseInt(e.target.value))}
                        className="w-full mt-1 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                      >
                        <option value={0}>{t.no_discount}</option>
                        {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map(pct => (
                          <option key={pct} value={pct}>-{pct}%</option>
                        ))}
                      </select>
                    </div>

                    {/* Payment Method */}
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">{t.payment_method}</label>
                      <select
                        value={paymentMethodInput}
                        onChange={(e) => setPaymentMethodInput(e.target.value as PaymentMethod)}
                        className="w-full mt-1 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                      >
                        {PAYMENT_METHODS.map(method => (
                          <option key={method} value={method}>
                            {t[PAYMENT_METHOD_TRANSLATION_KEYS[method]]}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Booking Note */}
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">{t.booking_note || 'Ghi chú đặt vé'}</label>
                      <textarea
                        value={bookingNote}
                        onChange={(e) => setBookingNote(e.target.value)}
                        rows={2}
                        placeholder={t.booking_note_placeholder || 'Ghi chú của đại lý / nhà xe (cọc, thanh toán tài xế...)'}
                        className="w-full mt-1 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20 text-sm resize-none"
                      />
                    </div>

                    <div className="p-4 bg-daiichi-accent/20 rounded-xl border border-daiichi-accent/30 space-y-2">
                      {(() => {
                        // For agents use agentPrice when available; otherwise fall back to trip price
                        const isAgentBookingForm = currentUser?.role === UserRole.AGENT;
                        // Use agent fare if available, else retail fare
                        const effectiveFareAmount = fareAmount !== null
                          ? (isAgentBookingForm && fareAgentAmount !== null ? fareAgentAmount : fareAmount)
                          : null;
                        const basePriceAdult = effectiveFareAmount !== null
                          ? effectiveFareAmount
                          : (isAgentBookingForm
                              ? (selectedTrip.agentPrice || selectedTrip.price || 0)
                              : (selectedTrip.price || 0));
                        const basePriceChild = effectiveFareAmount !== null
                          ? effectiveFareAmount
                          : (isAgentBookingForm
                              ? (selectedTrip.agentPriceChild || selectedTrip.agentPrice || selectedTrip.priceChild || basePriceAdult)
                              : (selectedTrip.priceChild || basePriceAdult));
                        const { childrenOver4, childrenUnder4 } = childrenAges.reduce(
                          (acc, age) => age > 4 ? { ...acc, childrenOver4: acc.childrenOver4 + 1 } : { ...acc, childrenUnder4: acc.childrenUnder4 + 1 },
                          { childrenOver4: 0, childrenUnder4: 0 }
                        );
                        const effectiveAdults = adults + childrenOver4;
                        const effectiveChildren = childrenUnder4 + Math.max(0, children - childrenAges.length);
                        const baseTotal = (effectiveAdults * basePriceAdult) + (effectiveChildren * basePriceChild);
                        const routeSurchargeTotal = applicableRouteSurcharges.reduce((sum, sc) => sum + sc.amount * (effectiveAdults + effectiveChildren), 0);
                        const allSurcharges = pickupSurcharge + dropoffSurcharge + surchargeAmount + routeSurchargeTotal;
                        const selectedAddonsInForm = (selectedTrip.addons || [] as TripAddon[]).filter((a: TripAddon) => (addonQuantities[a.id] || 0) > 0);
                        const addonsTotalInForm = selectedAddonsInForm.reduce((sum, a) => sum + a.price * (addonQuantities[a.id] || 1), 0);
                        const finalTotal = Math.round((baseTotal + allSurcharges + addonsTotalInForm) * (1 - bookingDiscount / 100));
                        return (
                          <>
                            <div className="flex justify-between items-center text-xs text-gray-500">
                              <span>
                                {effectiveFareAmount !== null
                                  ? (t.fare_based_price || 'Fare table price')
                                  : (language === 'vi' ? 'Vé cơ bản' : language === 'ja' ? '基本運賃' : 'Base fare')}
                                {isAgentBookingForm && (selectedTrip.agentPrice || 0) > 0 && effectiveFareAmount === null && (
                                  <span className="ml-1 text-orange-500 font-bold">({language === 'vi' ? 'Giá ĐL' : 'Agent'})</span>
                                )}
                                {isAgentBookingForm && effectiveFareAmount !== null && fareAgentAmount !== null && (
                                  <span className="ml-1 text-orange-500 font-bold">({language === 'vi' ? 'Giá ĐL' : 'Agent'})</span>
                                )}
                              </span>
                              <span>{baseTotal.toLocaleString()}đ</span>
                            </div>
                            {applicableRouteSurcharges.map(sc => (
                              <div key={sc.id} className="flex justify-between items-center text-xs text-amber-600">
                                <span>+ {sc.name}</span>
                                <span>+{(sc.amount * (effectiveAdults + effectiveChildren)).toLocaleString()}đ</span>
                              </div>
                            ))}
                            {pickupSurcharge > 0 && (
                              <div className="flex justify-between items-center text-xs text-gray-500">
                                <span>+ {language === 'vi' ? 'Phụ thu đón khách' : language === 'ja' ? '乗客ピックアップ料' : 'Pickup surcharge'}</span>
                                <span>+{pickupSurcharge.toLocaleString()}đ</span>
                              </div>
                            )}
                            {dropoffSurcharge > 0 && (
                              <div className="flex justify-between items-center text-xs text-gray-500">
                                <span>+ {language === 'vi' ? 'Phụ thu trả khách' : language === 'ja' ? '乗客降車料' : 'Dropoff surcharge'}</span>
                                <span>+{dropoffSurcharge.toLocaleString()}đ</span>
                              </div>
                            )}
                            {surchargeAmount > 0 && (
                              <div className="flex justify-between items-center text-xs text-gray-500">
                                <span>+ {language === 'vi' ? 'Phụ thu khác' : language === 'ja' ? 'その他追加料金' : 'Other surcharge'}</span>
                                <span>+{surchargeAmount.toLocaleString()}đ</span>
                              </div>
                            )}
                            {selectedAddonsInForm.map(a => (
                              <div key={a.id} className="flex justify-between items-center text-xs text-emerald-600">
                                <span>+ {a.name} × {addonQuantities[a.id] || 1}</span>
                                <span>+{(a.price * (addonQuantities[a.id] || 1)).toLocaleString()}đ</span>
                              </div>
                            ))}
                            {(allSurcharges > 0 || addonsTotalInForm > 0) && <div className="border-t border-daiichi-accent/40 pt-1" />}
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-gray-500 uppercase">{t.total_amount}</span>
                              <span className="text-xl font-bold text-daiichi-red">{finalTotal.toLocaleString()}đ</span>
                            </div>
                            {bookingDiscount > 0 && (
                              <p className="text-xs text-green-600 font-bold text-right">-{bookingDiscount}% {t.booking_discount}</p>
                            )}
                          </>
                        );
                      })()}
                    </div>

                    <button type="button" onClick={() => handleConfirmBooking(showBookingForm || '')} disabled={!canConfirmBooking} className={cn("w-full py-4 text-white rounded-xl font-bold shadow-lg", canConfirmBooking ? "bg-daiichi-red shadow-daiichi-red/20" : "bg-gray-300 shadow-gray-200 cursor-not-allowed")}>{t.confirm_booking}</button>
                  </form>
                </motion.div>
              )}
            </div>
          </div>
          );
        }

      case 'tours': {
        // Apply advanced filters
        const filteredPublicTours = tours.filter(tour => {
          const effectivePrice = tour.priceAdult || tour.price;
          if (tourDurationFilter) {
            const q = tourDurationFilter.toLowerCase();
            const matchesTitle = tour.title.toLowerCase().includes(q);
            const matchesDescription = (tour.description || '').toLowerCase().includes(q);
            const matchesDuration = (tour.duration || '').toLowerCase().includes(q);
            if (!matchesTitle && !matchesDescription && !matchesDuration) return false;
          }
          if (tourPriceMin) {
            const min = parseInt(tourPriceMin);
            if (!isNaN(min) && effectivePrice < min) return false;
          }
          if (tourPriceMax) {
            const max = parseInt(tourPriceMax);
            if (!isNaN(max) && effectivePrice > max) return false;
          }
          return true;
        });

        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold">{t.tours}</h2>
              <p className="text-sm text-gray-500">{language === 'vi' ? 'Khám phá các tour du lịch hấp dẫn' : 'Explore our amazing tour packages'}</p>
            </div>

            {/* Advanced search bar */}
            <div className="bg-white p-4 sm:p-6 rounded-[32px] shadow-sm border border-gray-100">
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Tìm kiếm tour' : 'Search tours'}</label>
                  <div className="relative mt-1">
                     <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                     <input
                       type="text"
                       value={tourDurationFilter}
                       onChange={e => setTourDurationFilter(e.target.value)}
                       placeholder={language === 'vi' ? 'Tìm theo tên, nội dung, thời gian...' : 'Search by name, content, duration...'}
                       className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
                     />
                  </div>
                </div>
                <div className="flex items-end gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Giá từ (đ)' : 'Price from'}</label>
                    <input
                      type="number"
                      min="0"
                      value={tourPriceMin}
                      onChange={e => setTourPriceMin(e.target.value)}
                      placeholder="0"
                      className="mt-1 w-32 px-3 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'đến (đ)' : 'to'}</label>
                    <input
                      type="number"
                      min="0"
                      value={tourPriceMax}
                      onChange={e => setTourPriceMax(e.target.value)}
                      placeholder="∞"
                      className="mt-1 w-32 px-3 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
                    />
                  </div>
                  <button
                    onClick={() => setTourHasSearched(true)}
                    className="px-6 py-3 bg-daiichi-red text-white rounded-2xl font-bold shadow-lg shadow-daiichi-red/20 hover:scale-[1.02] transition-all flex items-center gap-2"
                  >
                    <Search size={16} />
                    {language === 'vi' ? 'Tìm' : 'Search'}
                  </button>
                  {(tourDurationFilter || tourPriceMin || tourPriceMax) && (
                    <button
                      onClick={() => { setTourDurationFilter(''); setTourPriceMin(''); setTourPriceMax(''); setTourHasSearched(false); }}
                      className="px-4 py-3 text-gray-400 hover:text-gray-600 text-sm"
                    >
                      {language === 'vi' ? 'Xóa bộ lọc' : 'Clear'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {tours.length === 0 ? (
              <div className="text-center py-20">
                <Star className="mx-auto text-gray-300 mb-4" size={48} />
                <p className="text-gray-400">{language === 'vi' ? 'Chưa có tour nào. Liên hệ để biết thêm!' : 'No tours available yet. Contact us for more info!'}</p>
              </div>
            ) : filteredPublicTours.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Search size={40} className="mx-auto mb-3 opacity-40" />
                <p className="font-medium">{language === 'vi' ? 'Không tìm thấy tour phù hợp' : 'No tours match your search'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredPublicTours.map((tour) => {
                  const allTourImages = tour.images && tour.images.length > 0
                    ? tour.images
                    : (tour.imageUrl ? [tour.imageUrl] : []);
                  const effectiveAdultPrice = tour.priceAdult || tour.price;
                  const discountedPrice = tour.discountPercent && tour.discountPercent > 0
                    ? Math.round(effectiveAdultPrice * (1 - tour.discountPercent / 100))
                    : null;
                  const displayImg = allTourImages[0] || '';
                  const isLiked = likedTours.has(tour.id);
                  const embedUrl = tour.youtubeUrl ? getYoutubeEmbedUrl(tour.youtubeUrl) : null;
                  const isTourRevealed = tourHasSearched || clearedTourCards.has(tour.id);
                  return (
                    <div key={tour.id} className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md transition-all">
                      <div className="relative h-48 overflow-hidden">
                        {displayImg && (
                          <img
                            src={displayImg}
                            alt={tour.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-all duration-700"
                            style={{ filter: isTourRevealed ? 'none' : 'blur(10px)', transform: isTourRevealed ? 'scale(1)' : 'scale(1.1)' }}
                            referrerPolicy="no-referrer"
                          />
                        )}
                        {!isTourRevealed && displayImg && (
                          <div
                            className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer"
                            onClick={() => setClearedTourCards(prev => new Set([...prev, tour.id]))}
                          >
                            <span className="text-white text-xs font-bold bg-black/40 px-3 py-1 rounded-full">
                              {language === 'vi' ? '👆 Chạm để xem ảnh' : '👆 Tap to reveal'}
                            </span>
                          </div>
                        )}
                        {allTourImages.length > 1 && isTourRevealed && (
                          <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                            +{allTourImages.length - 1} {language === 'vi' ? 'ảnh' : 'photos'}
                          </div>
                        )}
                        {tour.discountPercent && tour.discountPercent > 0 ? (
                          <div className="absolute top-4 left-4 bg-daiichi-red text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">
                            -{tour.discountPercent}% {language === 'vi' ? 'GIẢM' : 'OFF'}
                          </div>
                        ) : null}
                        {tour.duration && (
                          <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-bold">
                            {tour.duration}
                          </div>
                        )}
                      </div>
                      {/* YouTube video embed */}
                      {embedUrl && (
                        <div className="border-t border-gray-100">
                          {expandedVideoTourId === tour.id ? (
                            <div>
                              <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                                <iframe
                                  src={embedUrl}
                                  title={tour.title}
                                  className="absolute inset-0 w-full h-full"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                />
                              </div>
                              <button
                                onClick={() => setExpandedVideoTourId(null)}
                                className="w-full py-2 text-xs font-bold text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1"
                              >
                                <span>▲</span> {language === 'vi' ? 'Ẩn video' : 'Hide video'}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setExpandedVideoTourId(tour.id)}
                              className="w-full py-3 flex items-center justify-center gap-2 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <span className="w-7 h-7 bg-daiichi-red text-white rounded-full flex items-center justify-center text-xs">▶</span>
                              {language === 'vi' ? 'Xem video tour' : 'Watch tour video'}
                            </button>
                          )}
                        </div>
                      )}
                      <div className="p-6">
                        <h4 className="text-lg font-bold mb-1">{tour.title}</h4>
                        <p className="text-sm text-gray-500 line-clamp-2 mb-3">{tour.description}</p>
                        {/* Overnight & Breakfast badges */}
                        {((tour.nights ?? 0) > 0 || (tour.breakfastCount ?? 0) > 0) && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {(tour.nights ?? 0) > 0 && (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                                🌙 {tour.nights} {language === 'vi' ? 'đêm' : 'nights'}
                              </span>
                            )}
                            {(tour.breakfastCount ?? 0) > 0 && (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                                ☕ {tour.breakfastCount} {language === 'vi' ? 'bữa sáng' : 'breakfasts'}
                              </span>
                            )}
                          </div>
                        )}
                        <div className="flex justify-between items-end">
                          <div>
                            <p className="text-[10px] text-gray-400">{language === 'vi' ? 'Người lớn từ' : 'Adults from'}</p>
                            {discountedPrice ? (
                              <>
                                <p className="text-xl font-bold text-daiichi-red">{discountedPrice.toLocaleString()}đ</p>
                                <p className="text-xs text-gray-400 line-through">{effectiveAdultPrice.toLocaleString()}đ</p>
                              </>
                            ) : (
                              <p className="text-xl font-bold text-daiichi-red">{effectiveAdultPrice.toLocaleString()}đ</p>
                            )}
                            {tour.priceChild && (
                              <p className="text-xs text-gray-500">{language === 'vi' ? 'Trẻ em' : 'Child'}: {tour.priceChild.toLocaleString()}đ</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => { setSelectedTour(tour); setActiveTab('book-tour'); }}
                              className="px-5 py-2.5 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/20 hover:scale-105 transition-all text-sm"
                            >
                              {t.book_tour || (language === 'vi' ? 'Đặt tour' : 'Book Tour')}
                            </button>
                            <button
                              onClick={() => toggleLike(tour.id)}
                              className={`p-2.5 rounded-xl border transition-all hover:scale-110 ${isLiked ? 'bg-pink-50 border-pink-200 text-pink-500' : 'bg-gray-50 border-gray-100 text-gray-400 hover:text-pink-400'}`}
                              title={isLiked ? (language === 'vi' ? 'Bỏ thích' : 'Unlike') : (language === 'vi' ? 'Thích tour này' : 'Like this tour')}
                            >
                              <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      }

      case 'book-tour': {
        const totalPersons = tourBookingAdults + tourBookingChildren;
        // Use tour-specific priceAdult if defined, else fall back to discounted/base price
        const baseAdultPrice = selectedTour
          ? (selectedTour.priceAdult ?? (selectedTour.discountPercent
              ? Math.round(selectedTour.price * (1 - selectedTour.discountPercent / 100))
              : selectedTour.price))
          : 0;
        const pricePerAdult = selectedTour?.discountPercent && !selectedTour.priceAdult
          ? Math.round(baseAdultPrice)
          : baseAdultPrice;
        // Use tour-specific priceChild if defined, else 50% of adult
        const pricePerChild = selectedTour?.priceChild ?? Math.round(pricePerAdult * 0.5);
        const baseTourPrice = tourBookingAdults * pricePerAdult + tourBookingChildren * pricePerChild;
        // Accommodation: use tour's pricePerNight × nights × persons if defined, else fixed costs
        const tourNights = selectedTour?.nights ?? 1;
        const accommodationCosts: Record<string, number> = {
          none: 0,
          standard: (selectedTour?.pricePerNight ?? 300000) * tourNights * totalPersons,
          deluxe: Math.round((selectedTour?.pricePerNight ?? 300000) * 1.5) * tourNights * totalPersons,
          suite: Math.round((selectedTour?.pricePerNight ?? 300000) * 2.5) * tourNights * totalPersons,
        };
        // Meals: use tour's pricePerBreakfast × breakfastCount × persons if defined, else fixed costs
        const breakfastCount = selectedTour?.breakfastCount ?? 1;
        const pricePerBreakfast = selectedTour?.pricePerBreakfast ?? 100000;
        const mealCosts: Record<string, number> = {
          none: 0,
          breakfast: pricePerBreakfast * breakfastCount * totalPersons,
          half_board: pricePerBreakfast * breakfastCount * totalPersons + 150000 * totalPersons,
          full_board: pricePerBreakfast * breakfastCount * totalPersons + 300000 * totalPersons,
        };
        const accomCost = accommodationCosts[tourAccommodation];
        const mealCost = mealCosts[tourMealPlan];
        const tourTotal = baseTourPrice + accomCost + mealCost;

        const handleTourBooking = async () => {
          if (!selectedTour || !tourBookingName.trim() || !tourBookingPhone.trim() || !tourBookingDate) return;
          setIsTourBookingLoading(true);
          setTourBookingError('');
          const isTourAgentBooking = currentUser?.role === UserRole.AGENT;
          const tourAgentName = isTourAgentBooking
            ? (currentUser!.name || currentUser!.address || currentUser!.agentCode || (language === 'vi' ? 'Đại lý' : 'Agent'))
            : 'Trực tiếp';
          const bookingData = {
            type: 'TOUR',
            customerName: tourBookingName.trim(),
            phone: tourBookingPhone.trim(),
            email: tourBookingEmail.trim(),
            tourId: selectedTour.id,
            route: selectedTour.title,
            date: tourBookingDate,
            adults: tourBookingAdults,
            children: tourBookingChildren,
            accommodation: tourAccommodation,
            mealPlan: tourMealPlan,
            duration: selectedTour.duration || '',
            nights: selectedTour.nights || 0,
            notes: tourNotes,
            amount: tourTotal,
            paymentMethod: tourPaymentMethod,
            agent: tourAgentName,
            agentId: isTourAgentBooking ? currentUser!.id : undefined,
            status: 'BOOKED',
          };
          try {
            const result = await transportService.createBooking(bookingData);
            const savedBooking = { ...bookingData, id: result.id || '', ticketCode: result.ticketCode || '' };
            setTourBookingId(result.ticketCode || result.id || '');
            setLastTourBooking(savedBooking);
            setTourBookingSuccess(true);
          } catch (err) {
            console.error('Failed to save tour booking:', err);
            setTourBookingError(language === 'vi'
              ? 'Đã xảy ra lỗi khi đặt tour. Vui lòng thử lại.'
              : 'An error occurred while booking. Please try again.');
          } finally {
            setIsTourBookingLoading(false);
          }
        };

        if (tourBookingSuccess) {
          return (
            <div className="flex flex-col items-center justify-center py-20 space-y-6">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="text-green-500" size={40} />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">{t.tour_booking_success}</h2>
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 w-full max-w-sm space-y-3">
                {tourBookingId && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400 font-medium">{language === 'vi' ? 'Mã đặt tour' : 'Booking ID'}</span>
                    <span className="font-bold text-daiichi-red">{tourBookingId}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400 font-medium">{language === 'vi' ? 'Tour' : 'Tour'}</span>
                  <span className="font-bold text-gray-700 text-right max-w-[180px] truncate">{selectedTour?.title}</span>
                </div>
                {selectedTour?.duration && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400 font-medium">{language === 'vi' ? 'Thời gian' : 'Duration'}</span>
                    <span className="font-bold text-gray-700">{selectedTour.duration}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400 font-medium">{language === 'vi' ? 'Ngày khởi hành' : 'Departure'}</span>
                  <span className="font-bold text-gray-700">{tourBookingDate}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400 font-medium">{language === 'vi' ? 'Khách hàng' : 'Customer'}</span>
                  <span className="font-bold text-gray-700">{tourBookingName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400 font-medium">{language === 'vi' ? 'Số điện thoại' : 'Phone'}</span>
                  <span className="font-bold text-gray-700">{tourBookingPhone}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400 font-medium">{language === 'vi' ? 'Số người' : 'Persons'}</span>
                  <span className="font-bold text-gray-700">
                    {tourBookingAdults} {language === 'vi' ? 'người lớn' : 'adults'}
                    {tourBookingChildren > 0 && `, ${tourBookingChildren} ${language === 'vi' ? 'trẻ em' : 'children'}`}
                  </span>
                </div>
                <div className="border-t border-gray-100 pt-3 flex justify-between">
                  <span className="text-sm font-bold text-gray-500 uppercase">{t.total_amount}</span>
                  <span className="text-lg font-bold text-daiichi-red">{tourTotal.toLocaleString()}đ</span>
                </div>
              </div>
              <p className="text-gray-500 text-center max-w-md text-sm">
                {language === 'vi'
                  ? `Chúng tôi sẽ liên hệ qua SĐT ${tourBookingPhone} để xác nhận tour.`
                  : `We will contact you at ${tourBookingPhone} to confirm your tour.`}
              </p>
              <div className="flex gap-4 flex-wrap justify-center">
                <button
                  onClick={() => { if (lastTourBooking) { setLastBooking(lastTourBooking); setIsTicketOpen(true); } }}
                  className="px-6 py-3 bg-green-600 text-white rounded-xl font-bold shadow-lg shadow-green-600/20 flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  {language === 'vi' ? 'Tải vé xác nhận' : 'Download Ticket'}
                </button>
                <button
                  onClick={() => { setTourBookingSuccess(false); setTourBookingId(''); setLastTourBooking(null); setActiveTab('tours'); }}
                  className="px-6 py-3 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50"
                >
                  {language === 'vi' ? 'Xem thêm tour' : 'Browse more tours'}
                </button>
                <button
                  onClick={() => { setTourBookingSuccess(false); setTourBookingId(''); setLastTourBooking(null); setActiveTab('home'); }}
                  className="px-6 py-3 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/20"
                >
                  {t.home}
                </button>
              </div>
            </div>
          );
        }

        return (
          <div className="space-y-6 max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4">
              <button onClick={() => setActiveTab('tours')} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500">
                <ChevronRight className="rotate-180" size={22} />
              </button>
              <div>
                <h2 className="text-2xl font-bold">{t.tour_booking_title}</h2>
                <p className="text-sm text-gray-500">{language === 'vi' ? 'Điền thông tin để đặt tour' : 'Fill in details to book your tour'}</p>
              </div>
            </div>

            {/* Selected Tour Card */}
            {selectedTour && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex gap-4 p-4">
                <img src={selectedTour.imageUrl} alt={selectedTour.title} className="w-24 h-24 object-cover rounded-xl flex-shrink-0" referrerPolicy="no-referrer" />
                <div className="flex-1">
                  <h3 className="font-bold text-gray-800">{selectedTour.title}</h3>
                  {selectedTour.duration && (
                    <p className="text-xs text-indigo-600 font-medium mt-0.5">{selectedTour.duration}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {(selectedTour.nights ?? 0) > 0 && (
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">🌙 {selectedTour.nights} {language === 'vi' ? 'đêm' : 'nights'}</span>
                    )}
                    {(selectedTour.breakfastCount ?? 0) > 0 && (
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">☕ {selectedTour.breakfastCount} {language === 'vi' ? 'bữa sáng' : 'breakfasts'}</span>
                    )}
                  </div>
                  <p className="text-daiichi-red font-bold mt-1.5">
                    {pricePerAdult < (selectedTour.priceAdult || selectedTour.price)
                      ? <>{pricePerAdult.toLocaleString()}đ <span className="text-xs text-gray-400 line-through">{(selectedTour.priceAdult || selectedTour.price).toLocaleString()}đ</span></>
                      : <>{pricePerAdult.toLocaleString()}đ</>
                    }
                    <span className="text-xs font-normal text-gray-500 ml-1">/{language === 'vi' ? 'người lớn' : 'adult'}</span>
                  </p>
                  {pricePerChild > 0 && (
                    <p className="text-xs text-gray-500">{language === 'vi' ? 'Trẻ em' : 'Child'}: {pricePerChild.toLocaleString()}đ</p>
                  )}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
              {/* Departure date */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">{t.tour_departure_date}</label>
                <div className="relative mt-1">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="date"
                    value={tourBookingDate}
                    min={getLocalDateString(0)}
                    onChange={(e) => setTourBookingDate(e.target.value)}
                    className="w-full pl-12 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                  />
                </div>
              </div>

              {/* Adults & children steppers */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">{t.adults}</label>
                  <div className="flex items-center gap-2 mt-1 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl">
                    <button type="button" onClick={() => setTourBookingAdults(Math.max(1, tourBookingAdults - 1))} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 font-bold text-lg leading-none">−</button>
                    <span className="flex-1 text-center font-bold text-gray-800">{tourBookingAdults}</span>
                    <button type="button" onClick={() => setTourBookingAdults(tourBookingAdults + 1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-daiichi-red text-white font-bold text-lg leading-none">+</button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">{t.children} <span className="text-gray-400 font-normal normal-case">{language === 'vi' ? '(50% giá)' : '(50% price)'}</span></label>
                  <div className="flex items-center gap-2 mt-1 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl">
                    <button type="button" onClick={() => setTourBookingChildren(Math.max(0, tourBookingChildren - 1))} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 font-bold text-lg leading-none">−</button>
                    <span className="flex-1 text-center font-bold text-gray-800">{tourBookingChildren}</span>
                    <button type="button" onClick={() => setTourBookingChildren(tourBookingChildren + 1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-daiichi-red text-white font-bold text-lg leading-none">+</button>
                  </div>
                </div>
              </div>

              {/* Accommodation */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">{t.accommodation}</label>
                <select
                  value={tourAccommodation}
                  onChange={(e) => setTourAccommodation(e.target.value as typeof tourAccommodation)}
                  className="w-full mt-1 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                >
                  <option value="none">{t.no_accommodation}</option>
                  <option value="standard">{t.room_standard}</option>
                  <option value="deluxe">{t.room_deluxe}</option>
                  <option value="suite">{t.room_suite}</option>
                </select>
              </div>

              {/* Meal plan */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">{t.meal_plan}</label>
                <select
                  value={tourMealPlan}
                  onChange={(e) => setTourMealPlan(e.target.value as typeof tourMealPlan)}
                  className="w-full mt-1 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                >
                  <option value="none">{t.meal_none}</option>
                  <option value="breakfast">{t.meal_breakfast}</option>
                  <option value="half_board">{t.meal_half_board}</option>
                  <option value="full_board">{t.meal_full_board}</option>
                </select>
              </div>

              {/* Customer info */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">{t.customer_name}</label>
                <input
                  type="text"
                  value={tourBookingName}
                  onChange={(e) => setTourBookingName(e.target.value)}
                  placeholder={t.enter_name}
                  className="w-full mt-1 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">{t.phone_number}</label>
                <input
                  type="tel"
                  value={tourBookingPhone}
                  onChange={(e) => setTourBookingPhone(e.target.value)}
                  placeholder={t.enter_phone}
                  className="w-full mt-1 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">{t.customer_email || 'Email'}</label>
                <input
                  type="email"
                  value={tourBookingEmail}
                  onChange={(e) => setTourBookingEmail(e.target.value)}
                  placeholder={t.enter_email || 'Email...'}
                  className="w-full mt-1 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                />
              </div>

              {/* Payment method */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">{t.payment_method}</label>
                <select
                  value={tourPaymentMethod}
                  onChange={(e) => setTourPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full mt-1 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                >
                  {PAYMENT_METHODS.map(m => (
                    <option key={m} value={m}>{t[PAYMENT_METHOD_TRANSLATION_KEYS[m]]}</option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">{t.tour_notes}</label>
                <textarea
                  value={tourNotes}
                  onChange={(e) => setTourNotes(e.target.value)}
                  rows={3}
                  placeholder={language === 'vi' ? 'Nhập yêu cầu đặc biệt...' : 'Enter special requests...'}
                  className="w-full mt-1 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20 resize-none"
                />
              </div>

              {/* Price breakdown */}
              <div className="p-4 bg-daiichi-accent/20 rounded-xl border border-daiichi-accent/30 space-y-2">
                <p className="text-xs font-bold text-gray-500 uppercase mb-2">{language === 'vi' ? 'Chi tiết giá' : 'Price breakdown'}</p>
                <div className="flex justify-between text-sm"><span className="text-gray-500">{t.tour_price_per_adult} × {tourBookingAdults}</span><span className="font-bold">{(pricePerAdult * tourBookingAdults).toLocaleString()}đ</span></div>
                {tourBookingChildren > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">{t.tour_price_per_child} × {tourBookingChildren}</span><span className="font-bold">{(pricePerChild * tourBookingChildren).toLocaleString()}đ</span></div>}
                {tourAccommodation !== 'none' && <div className="flex justify-between text-sm"><span className="text-gray-500">{t.tour_accommodation_cost}</span><span className="font-bold">{accomCost.toLocaleString()}đ</span></div>}
                {tourMealPlan !== 'none' && <div className="flex justify-between text-sm"><span className="text-gray-500">{t.tour_meal_cost}</span><span className="font-bold">{mealCost.toLocaleString()}đ</span></div>}
                <div className="border-t border-daiichi-accent/40 pt-2 flex justify-between">
                  <span className="text-xs font-bold text-gray-500 uppercase">{t.total_amount}</span>
                  <span className="text-xl font-bold text-daiichi-red">{tourTotal.toLocaleString()}đ</span>
                </div>
              </div>

              {tourBookingError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-medium">
                  {tourBookingError}
                </div>
              )}

              <button
                type="button"
                disabled={isTourBookingLoading || !tourBookingName.trim() || !tourBookingPhone.trim() || !tourBookingDate || !selectedTour}
                onClick={handleTourBooking}
                className={cn(
                  "w-full py-4 text-white rounded-xl font-bold shadow-lg",
                  !isTourBookingLoading && tourBookingName.trim() && tourBookingPhone.trim() && tourBookingDate && selectedTour
                    ? "bg-daiichi-red shadow-daiichi-red/20"
                    : "bg-gray-300 shadow-gray-200 cursor-not-allowed"
                )}
              >
                {isTourBookingLoading ? (language === 'vi' ? 'Đang xử lý...' : 'Processing...') : t.confirm_tour_booking}
              </button>
            </div>
          </div>
        );
      }

      case 'agents': {
        // Computed filtered list
        const filteredAgents = agents.filter(agent => {
          const q = agentSearch.toLowerCase();
          const matchSearch = !q ||
            String(agent.name ?? '').toLowerCase().includes(q) ||
            String(agent.code ?? '').toLowerCase().includes(q) ||
            String(agent.phone ?? '').toLowerCase().includes(q) ||
            String(agent.email ?? '').toLowerCase().includes(q) ||
            String(agent.address ?? '').toLowerCase().includes(q);
          const matchStatus = agentStatusFilter === 'ALL' || agent.status === agentStatusFilter;
          return matchSearch && matchStatus;
        });

        // Computed stats from filtered list
        const totalBalance = filteredAgents.reduce((sum, a) => sum + (a.balance || 0), 0);
        const totalCommission = filteredAgents.reduce((sum, a) => sum + ((a.balance || 0) * (a.commissionRate || 0) / 100), 0);

        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div><h2 className="text-2xl font-bold">{t.agents}</h2><p className="text-sm text-gray-500">{t.agent_desc}</p></div>
              <button onClick={() => { setShowAddAgent(true); setEditingAgent(null); setAgentForm({ name: '', code: '', phone: '', email: '', address: '', commissionRate: 10, balance: 0, status: 'ACTIVE', username: '', password: '' }); }} className="bg-daiichi-red text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-daiichi-red/20">+ {t.add_agent}</button>
            </div>

            {/* Add/Edit Agent Modal */}
            {showAddAgent && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-[32px] p-8 max-w-2xl w-full space-y-6 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold">{editingAgent ? (language === 'vi' ? 'Chỉnh sửa đại lý' : 'Edit Agent') : (language === 'vi' ? 'Thêm đại lý mới' : 'Add New Agent')}</h3>
                    <button onClick={() => { setShowAddAgent(false); setEditingAgent(null); }} className="p-2 hover:bg-gray-50 rounded-xl"><X size={20} /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Tên đại lý' : 'Agent Name'}</label><input type="text" value={agentForm.name} onChange={e => setAgentForm(p => ({ ...p, name: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Mã đại lý' : 'Agent Code'}</label><input type="text" value={agentForm.code} onChange={e => setAgentForm(p => ({ ...p, code: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.phone_number}</label><input type="text" value={agentForm.phone} onChange={e => setAgentForm(p => ({ ...p, phone: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Email</label><input type="email" value={agentForm.email} onChange={e => setAgentForm(p => ({ ...p, email: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                    <div className="col-span-2"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Địa chỉ' : 'Address'}</label><input type="text" value={agentForm.address} onChange={e => setAgentForm(p => ({ ...p, address: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.commission} (%)</label><input type="number" min="0" max="100" value={agentForm.commissionRate} onChange={e => setAgentForm(p => ({ ...p, commissionRate: parseFloat(e.target.value) || 0 }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.status}</label><select value={agentForm.status} onChange={e => setAgentForm(p => ({ ...p, status: e.target.value as 'ACTIVE' | 'INACTIVE' }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none"><option value="ACTIVE">{t.status_active}</option><option value="INACTIVE">{t.status_locked}</option></select></div>
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.username}</label><input type="text" value={agentForm.username} onChange={e => setAgentForm(p => ({ ...p, username: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Mật khẩu' : 'Password'}</label><input type="text" value={agentForm.password} onChange={e => setAgentForm(p => ({ ...p, password: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                    {/* Payment Type section */}
                    <div className="col-span-2 border-t border-gray-100 pt-4 mt-2">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">{t.agent_payment_type || 'Hình thức thanh toán'}</p>
                      <div className="flex gap-3">
                        <button type="button" onClick={() => setAgentForm(p => ({ ...p, paymentType: 'POSTPAID' }))} className={cn('flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all', agentForm.paymentType === 'POSTPAID' ? 'border-green-400 bg-green-50 text-green-700' : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200')}>
                          ✓ {t.agent_postpaid || 'Được thanh toán sau'}
                        </button>
                        <button type="button" onClick={() => setAgentForm(p => ({ ...p, paymentType: 'PREPAID' }))} className={cn('flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all', agentForm.paymentType === 'PREPAID' ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200')}>
                          ⚠ {t.agent_prepaid || 'Phải thanh toán trước'}
                        </button>
                      </div>
                    </div>
                    {agentForm.paymentType === 'POSTPAID' && (
                      <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.agent_credit_limit || 'Hạn mức công nợ (đ)'}</label><input type="text" inputMode="numeric" pattern="[0-9]*" value={agentForm.creditLimit || ''} placeholder="0" onChange={e => setAgentForm(p => ({ ...p, creditLimit: parseFloat(e.target.value) || 0 }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                    )}
                    {agentForm.paymentType === 'PREPAID' && (
                      <>
                        <div className="col-span-2">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">{t.agent_payment_options || 'Phương thức thanh toán cho phép'} <span className="text-gray-300 font-normal normal-case">({t.agent_payment_options_note || 'tùy chọn'})</span></p>
                          <div className="flex flex-wrap gap-2">
                            {(['DEPOSIT', 'BANK_TRANSFER', 'HOLD_WITH_CUSTOMER_TIME'] as const).map(opt => {
                              const label = opt === 'DEPOSIT' ? (t.agent_payment_deposit || 'Nộp tiền ký quỹ') : opt === 'BANK_TRANSFER' ? (t.agent_payment_bank_transfer || 'Chuyển khoản') : (t.agent_payment_hold_customer_time || 'Giữ vé theo thời gian khách');
                              const isSelected = agentForm.allowedPaymentOptions.includes(opt);
                              return (
                                <button key={opt} type="button"
                                  onClick={() => setAgentForm(p => ({ ...p, allowedPaymentOptions: isSelected ? p.allowedPaymentOptions.filter(x => x !== opt) : [...p.allowedPaymentOptions, opt] }))}
                                  className={cn('px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all', isSelected ? 'border-daiichi-red bg-daiichi-accent text-daiichi-red' : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200')}
                                >
                                  {isSelected ? '✓ ' : ''}{label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        {agentForm.allowedPaymentOptions.includes('DEPOSIT') && (
                          <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.agent_deposit || 'Tiền ký quỹ (đ)'}</label><input type="number" min="0" value={agentForm.depositAmount} onChange={e => setAgentForm(p => ({ ...p, depositAmount: parseFloat(e.target.value) || 0 }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                        )}
                        {agentForm.allowedPaymentOptions.includes('HOLD_WITH_CUSTOMER_TIME') && (
                          <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.agent_hold_ticket_hours || 'Thời gian giữ vé (giờ)'}</label><input type="number" min="1" max="72" value={agentForm.holdTicketHours} onChange={e => setAgentForm(p => ({ ...p, holdTicketHours: parseInt(e.target.value) || 24 }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex justify-end gap-4 pt-2">
                    <button onClick={() => { setShowAddAgent(false); setEditingAgent(null); }} className="px-6 py-3 text-sm font-bold text-gray-400 hover:text-gray-600">{t.cancel}</button>
                    <button onClick={handleSaveAgent} disabled={!agentForm.name || !agentForm.code} className="px-8 py-3 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/20 disabled:opacity-50">{editingAgent ? t.save : t.add_agent}</button>
                  </div>
                </div>
              </div>
            )}

            {/* Search & Filter bar */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4 space-y-3">
              <div className="flex gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px] relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder={language === 'vi' ? 'Tìm theo tên, mã, SĐT, email...' : 'Search by name, code, phone, email...'}
                    value={agentSearch}
                    onChange={e => setAgentSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
                  />
                </div>
                <button
                  onClick={() => setShowAgentFilters(p => !p)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all',
                    showAgentFilters ? 'bg-daiichi-red text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  <Filter size={15} />
                  {language === 'vi' ? 'Lọc nâng cao' : 'Advanced Filter'}
                  {agentStatusFilter !== 'ALL' && (
                    <span className="ml-1 px-1.5 py-0.5 bg-white/30 rounded text-[10px] font-bold">1</span>
                  )}
                </button>
                {(agentSearch || agentStatusFilter !== 'ALL') && (
                  <button
                    onClick={() => { setAgentSearch(''); setAgentStatusFilter('ALL'); }}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-50 text-red-500 hover:bg-red-100 transition-all"
                  >
                    <X size={14} />
                    {language === 'vi' ? 'Xóa bộ lọc' : 'Clear Filters'}
                  </button>
                )}
              </div>
              {showAgentFilters && (
                <div className="flex gap-4 flex-wrap pt-1 border-t border-gray-100">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">
                      {t.status}
                    </label>
                    <div className="flex gap-2">
                      {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => setAgentStatusFilter(s)}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                            agentStatusFilter === s
                              ? s === 'ACTIVE' ? 'bg-green-100 text-green-700 ring-2 ring-green-400'
                                : s === 'INACTIVE' ? 'bg-red-100 text-red-600 ring-2 ring-red-400'
                                : 'bg-daiichi-red text-white'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          )}
                        >
                          {s === 'ALL' ? (language === 'vi' ? 'Tất cả' : 'All')
                            : s === 'ACTIVE' ? t.status_active
                            : t.status_locked}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {(agentSearch || agentStatusFilter !== 'ALL') && (
                <p className="text-xs text-gray-500">
                  {language === 'vi'
                    ? `Hiển thị ${filteredAgents.length} / ${agents.length} đại lý`
                    : `Showing ${filteredAgents.length} / ${agents.length} agents`}
                </p>
              )}
            </div>

            {/* Stats – computed from filtered results */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: t.total_agents, value: filteredAgents.length, icon: Users, color: 'text-blue-600', raw: true },
                { label: t.agent_revenue, value: totalBalance.toLocaleString() + 'đ', icon: Wallet, color: 'text-green-600', raw: false },
                { label: t.commission_paid, value: Math.round(totalCommission).toLocaleString() + 'đ', icon: Star, color: 'text-daiichi-red', raw: false },
              ].map((s, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{s.label}</p>
                      <h3 className="text-2xl font-bold mt-2">{s.value}</h3>
                      {(agentSearch || agentStatusFilter !== 'ALL') && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {language === 'vi' ? 'Kết quả tìm kiếm' : 'Filtered result'}
                        </p>
                      )}
                    </div>
                    <div className={cn("p-3 rounded-xl bg-gray-50", s.color)}><s.icon size={20} /></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <ResizableTh width={agentColWidths.name} onResize={(w) => setAgentColWidths(p => ({ ...p, name: w }))} className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.agent_id_name}</ResizableTh>
                    <ResizableTh width={agentColWidths.username} onResize={(w) => setAgentColWidths(p => ({ ...p, username: w }))} className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.username}</ResizableTh>
                    <ResizableTh width={agentColWidths.address} onResize={(w) => setAgentColWidths(p => ({ ...p, address: w }))} className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Địa chỉ' : 'Address'}</ResizableTh>
                    <ResizableTh width={agentColWidths.phone} onResize={(w) => setAgentColWidths(p => ({ ...p, phone: w }))} className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.phone_number}</ResizableTh>
                    <ResizableTh width={agentColWidths.commission} onResize={(w) => setAgentColWidths(p => ({ ...p, commission: w }))} className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.commission}</ResizableTh>
                    <ResizableTh width={agentColWidths.balance} onResize={(w) => setAgentColWidths(p => ({ ...p, balance: w }))} className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.balance}</ResizableTh>
                    <ResizableTh width={agentColWidths.status} onResize={(w) => setAgentColWidths(p => ({ ...p, status: w }))} className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.status}</ResizableTh>
                    <ResizableTh width={agentColWidths.options} onResize={(w) => setAgentColWidths(p => ({ ...p, options: w }))} className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.options}</ResizableTh>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAgents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-8 py-12 text-center text-gray-400 text-sm">
                        {language === 'vi' ? 'Không tìm thấy đại lý nào phù hợp.' : 'No agents found matching your search.'}
                      </td>
                    </tr>
                  ) : filteredAgents.map((agent) => (
                    <tr key={agent.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-8 py-6"><p className="font-bold text-gray-800">{agent.name}</p><p className="text-xs text-gray-400 font-mono">{agent.code}</p></td>
                      <td className="px-8 py-6"><p className="text-xs font-bold text-gray-700">User: <span className="text-daiichi-red">{agent.username}</span></p><p className="text-[10px] text-gray-400">Pass: {agent.password ? '••••••' : <span className="text-gray-300">—</span>}</p></td>
                      <td className="px-8 py-6"><p className="text-sm text-gray-700">{agent.address ? agent.address : <span className="text-gray-300">—</span>}</p></td>
                      <td className="px-8 py-6"><p className="text-sm font-medium">{agent.phone}</p><p className="text-xs text-gray-400">{agent.email}</p></td>
                      <td className="px-8 py-6">
                        <span className="px-3 py-1 bg-daiichi-accent text-daiichi-red rounded-full text-xs font-bold">{agent.commissionRate}%</span>
                        <div className="mt-1.5">
                          {(agent.paymentType === 'POSTPAID' || !agent.paymentType) ? (
                            <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded-full text-[10px] font-bold">{t.agent_postpaid || 'Thanh toán sau'}</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-orange-50 text-orange-600 rounded-full text-[10px] font-bold">{t.agent_prepaid || 'Trả trước'}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6 font-bold text-gray-700">{(agent.balance || 0).toLocaleString()}đ</td>
                      <td className="px-8 py-6"><span className={cn("px-3 py-1 rounded-full text-[10px] font-bold uppercase", agent.status === 'ACTIVE' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600')}>{agent.status === 'ACTIVE' ? t.status_active : t.status_locked}</span></td>
                      <td className="px-8 py-6"><div className="flex gap-3 items-center"><button onClick={() => handleStartEditAgent(agent)} className="text-gray-600 hover:text-daiichi-red"><Edit3 size={18} /></button><button onClick={() => handleDeleteAgent(agent.id)} className="text-gray-600 hover:text-red-600"><Trash2 size={18} /></button><NotePopover note={agent.note} onSave={(note) => handleSaveAgentNote(agent.id, note)} language={language} /></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        );
      }

      case 'employees': {
        const filteredEmployees = employees.filter(emp => {
          const q = employeeSearch.toLowerCase();
          const matchSearch = !q ||
            String(emp.name ?? '').toLowerCase().includes(q) ||
            String(emp.phone ?? '').toLowerCase().includes(q) ||
            String(emp.email ?? '').toLowerCase().includes(q) ||
            String(emp.username ?? '').toLowerCase().includes(q);
          const matchRole = employeeRoleFilter === 'ALL' || emp.role === employeeRoleFilter;
          return matchSearch && matchRole;
        });

        const EMPLOYEE_ROLE_LABELS: Record<string, string> = {
          SUPERVISOR: language === 'vi' ? 'Quản lý' : 'Supervisor',
          STAFF: t.role_staff || 'Nhân viên',
          DRIVER: t.role_driver || 'Tài xế',
          ACCOUNTANT: t.role_accountant || 'Kế toán',
          OTHER: t.role_other || 'Khác',
          AGENT: language === 'vi' ? 'Đại lý' : 'Agent',
        };
        const EMPLOYEE_ROLE_COLORS: Record<string, string> = {
          SUPERVISOR: 'bg-indigo-50 text-indigo-600',
          STAFF: 'bg-blue-50 text-blue-600',
          DRIVER: 'bg-green-50 text-green-600',
          ACCOUNTANT: 'bg-purple-50 text-purple-600',
          OTHER: 'bg-gray-100 text-gray-500',
          AGENT: 'bg-orange-50 text-orange-600',
        };

        // Derive available permission groups from the permissions config (exclude MANAGER, CUSTOMER and GUEST)
        const availableRoles = permissions
          ? Object.keys(permissions).filter(r => r !== 'MANAGER' && r !== 'CUSTOMER' && r !== 'GUEST')
          : [];

        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">{t.employee_management || 'Quản lý Nhân viên'}</h2>
                <p className="text-sm text-gray-500">{t.employee_desc || 'Quản lý nhân viên, tài xế và tài khoản đăng nhập'}</p>
              </div>
              <button onClick={() => { setShowAddEmployee(true); setEditingEmployee(null); setEmployeeForm({ name: '', phone: '', email: '', address: '', role: availableRoles[0] || 'STAFF', position: '', status: 'ACTIVE', username: '', password: '', note: '' }); }} className="bg-daiichi-red text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-daiichi-red/20">+ {t.add_employee || 'Thêm nhân viên'}</button>
            </div>

            {/* Add/Edit Employee Modal */}
            {showAddEmployee && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-[32px] p-8 max-w-2xl w-full space-y-6 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold">{editingEmployee ? (language === 'vi' ? 'Chỉnh sửa nhân viên' : 'Edit Employee') : (language === 'vi' ? 'Thêm nhân viên mới' : 'Add New Employee')}</h3>
                    <button onClick={() => { setShowAddEmployee(false); setEditingEmployee(null); }} className="p-2 hover:bg-gray-50 rounded-xl"><X size={20} /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.employee_name || 'Họ tên'}</label><input type="text" value={employeeForm.name} onChange={e => setEmployeeForm(p => ({ ...p, name: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.phone_number}</label><input type="text" value={employeeForm.phone} onChange={e => setEmployeeForm(p => ({ ...p, phone: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Email</label><input type="email" value={employeeForm.email} onChange={e => setEmployeeForm(p => ({ ...p, email: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                    <div className="col-span-2"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Địa chỉ' : 'Address'}</label><input type="text" value={employeeForm.address} onChange={e => setEmployeeForm(p => ({ ...p, address: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.employee_role || 'Chức vụ'}</label>
                      <input
                        list="position-suggestions"
                        type="text"
                        value={employeeForm.position}
                        onChange={e => setEmployeeForm(p => ({ ...p, position: e.target.value }))}
                        placeholder={language === 'vi' ? 'Nhập hoặc chọn chức vụ...' : 'Type or select position...'}
                        className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
                      />
                      <datalist id="position-suggestions">
                        <option value={t.role_staff || 'Nhân viên'} />
                        <option value={t.role_driver || 'Tài xế'} />
                        <option value={t.role_accountant || 'Kế toán'} />
                        <option value={language === 'vi' ? 'Trợ lý' : 'Assistant'} />
                        <option value={language === 'vi' ? 'Trưởng nhóm' : 'Team Lead'} />
                      </datalist>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.employee_permissions || 'Nhóm phân quyền'}</label>
                      <select value={employeeForm.role} onChange={e => setEmployeeForm(p => ({ ...p, role: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none">
                        {availableRoles.map(roleId => (
                          <option key={roleId} value={roleId}>{EMPLOYEE_ROLE_LABELS[roleId] || roleId}</option>
                        ))}
                      </select>
                      <p className="text-[9px] text-gray-400 mt-1 ml-1">{language === 'vi' ? '* Xác định trang được phép truy cập (cấu hình tại Cài đặt → Phân quyền)' : '* Determines accessible pages (configure in Settings → Permissions)'}</p>
                    </div>
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.status}</label>
                      <select value={employeeForm.status} onChange={e => setEmployeeForm(p => ({ ...p, status: e.target.value as 'ACTIVE' | 'INACTIVE' }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none">
                        <option value="ACTIVE">{t.status_active}</option>
                        <option value="INACTIVE">{t.status_locked}</option>
                      </select>
                    </div>
                    <div className="col-span-2 border-t border-gray-100 pt-4">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">{language === 'vi' ? 'Tài khoản đăng nhập hệ thống' : 'System Login Credentials'}</p>
                    </div>
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.username}</label><input type="text" value={employeeForm.username} onChange={e => setEmployeeForm(p => ({ ...p, username: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Mật khẩu' : 'Password'}</label><input type="text" value={employeeForm.password} onChange={e => setEmployeeForm(p => ({ ...p, password: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                  </div>
                  <div className="flex justify-end gap-4 pt-2">
                    <button onClick={() => { setShowAddEmployee(false); setEditingEmployee(null); }} className="px-6 py-3 text-sm font-bold text-gray-400 hover:text-gray-600">{t.cancel}</button>
                    <button onClick={handleSaveEmployee} disabled={!employeeForm.name} className="px-8 py-3 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/20 disabled:opacity-50">{editingEmployee ? t.save : (t.add_employee || 'Thêm nhân viên')}</button>
                  </div>
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: t.total_employees || 'Tổng nhân viên', value: filteredEmployees.length, icon: Users, color: 'text-blue-600' },
                { label: t.active_employees || 'Đang làm việc', value: filteredEmployees.filter(e => e.status === 'ACTIVE').length, icon: Users, color: 'text-green-600' },
                { label: t.role_driver || 'Tài xế', value: filteredEmployees.filter(e => e.role === 'DRIVER').length, icon: Truck, color: 'text-orange-500' },
              ].map((s, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{s.label}</p>
                      <h3 className="text-2xl font-bold mt-2">{s.value}</h3>
                    </div>
                    <div className={cn("p-3 rounded-xl bg-gray-50", s.color)}><s.icon size={20} /></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Search & Filter */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4 space-y-3">
              <div className="flex gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px] relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder={language === 'vi' ? 'Tìm theo tên, SĐT, tài khoản...' : 'Search by name, phone, username...'} value={employeeSearch} onChange={e => setEmployeeSearch(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" />
                </div>
                <button onClick={() => setShowEmployeeFilters(p => !p)} className={cn('flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all', showEmployeeFilters ? 'bg-daiichi-red text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                  <Filter size={15} />
                  {language === 'vi' ? 'Lọc theo chức vụ' : 'Filter by Role'}
                </button>
                {(employeeSearch || employeeRoleFilter !== 'ALL') && (
                  <button onClick={() => { setEmployeeSearch(''); setEmployeeRoleFilter('ALL'); }} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-50 text-red-500 hover:bg-red-100 transition-all">
                    <X size={14} />{language === 'vi' ? 'Xóa bộ lọc' : 'Clear Filters'}
                  </button>
                )}
              </div>
              {showEmployeeFilters && (
                <div className="flex gap-2 flex-wrap pt-1 border-t border-gray-100">
                  {(['ALL', ...availableRoles]).map(r => (
                    <button key={r} onClick={() => setEmployeeRoleFilter(r)} className={cn('px-3 py-1.5 rounded-lg text-xs font-bold transition-all', employeeRoleFilter === r ? 'bg-daiichi-red text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}>
                      {r === 'ALL' ? (language === 'vi' ? 'Tất cả' : 'All') : (EMPLOYEE_ROLE_LABELS[r] || r)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Table */}
            <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.employee_name || 'Nhân viên'}</th>
                      <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.employee_role || 'Chức vụ'}</th>
                      <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.employee_permissions || 'Phân quyền'}</th>
                      <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.phone_number}</th>
                      <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.username}</th>
                      <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.status}</th>
                      <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.options}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-8 py-12 text-center text-gray-400 text-sm">
                          {language === 'vi' ? 'Chưa có nhân viên nào. Nhấn "+ Thêm nhân viên" để bắt đầu.' : 'No employees yet. Click "+ Add Employee" to get started.'}
                        </td>
                      </tr>
                    ) : filteredEmployees.map((emp) => {
                      return (
                      <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-8 py-5">
                          <p className="font-bold text-gray-800">{emp.name}</p>
                          {emp.email && <p className="text-xs text-gray-400">{emp.email}</p>}
                        </td>
                        <td className="px-8 py-5">
                          <span className={cn("px-3 py-1 rounded-full text-xs font-bold", EMPLOYEE_ROLE_COLORS[emp.role] || 'bg-gray-100 text-gray-500')}>
                            {emp.position || EMPLOYEE_ROLE_LABELS[emp.role] || emp.role}
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          {emp.role ? (
                            <span className={cn("px-3 py-1 rounded-full text-xs font-bold", EMPLOYEE_ROLE_COLORS[emp.role] || 'bg-gray-100 text-gray-500')}>
                              {EMPLOYEE_ROLE_LABELS[emp.role] || emp.role}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-8 py-5 text-sm text-gray-700">{emp.phone || <span className="text-gray-300">—</span>}</td>
                        <td className="px-8 py-5">
                          {emp.username ? (
                            <div>
                              <p className="text-xs font-bold text-gray-700">User: <span className="text-daiichi-red">{emp.username}</span></p>
                              <p className="text-[10px] text-gray-400">Pass: {emp.password ? '••••••' : <span className="text-gray-300">—</span>}</p>
                            </div>
                          ) : <span className="text-gray-300 text-sm">—</span>}
                        </td>
                        <td className="px-8 py-5">
                          <span className={cn("px-3 py-1 rounded-full text-[10px] font-bold uppercase", emp.status === 'ACTIVE' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600')}>
                            {emp.status === 'ACTIVE' ? t.status_active : t.status_locked}
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex gap-3 items-center">
                            <button onClick={() => handleStartEditEmployee(emp)} className="text-gray-600 hover:text-daiichi-red"><Edit3 size={18} /></button>
                            <button onClick={() => handleDeleteEmployee(emp.id)} className="text-gray-600 hover:text-red-600"><Trash2 size={18} /></button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      }

      case 'routes': {
        const filteredRoutes = routes.filter(route => {
          if (routeFilterDeparture && !(route.departurePoint || '').toLowerCase().includes(routeFilterDeparture.toLowerCase())) return false;
          if (routeFilterArrival && !(route.arrivalPoint || '').toLowerCase().includes(routeFilterArrival.toLowerCase())) return false;
          if (!routeSearch) return true;
          const q = routeSearch.toLowerCase();
          return (
            (route.name || '').toLowerCase().includes(q) ||
            (route.departurePoint || '').toLowerCase().includes(q) ||
            (route.arrivalPoint || '').toLowerCase().includes(q)
          );
        });
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-3">
              <div><h2 className="text-2xl font-bold">{t.route_management}</h2><p className="text-sm text-gray-500">{t.route_list}</p></div>
              <div className="flex gap-3">
                <button onClick={() => { setShowAddRoute(true); setEditingRoute(null); setIsCopyingRoute(false); setRouteForm({ stt: routes.length + 1, name: '', departurePoint: '', arrivalPoint: '', price: 0, agentPrice: 0, details: '', imageUrl: '', images: [], vehicleImageUrl: '', disablePickupAddress: false, disablePickupAddressFrom: '', disablePickupAddressTo: '', disableDropoffAddress: false, disableDropoffAddressFrom: '', disableDropoffAddressTo: '' }); setRoutePricePeriods([]); setShowAddPricePeriod(false); setEditingPricePeriodId(null); setRouteSurcharges([]); setShowAddRouteSurcharge(false); setEditingRouteSurchargeId(null); setRouteFormStops([]); setShowAddRouteStop(false); setRouteFormFares([]); setShowAddRouteFare(false); setEditingRouteFareIdx(null); }} className="bg-daiichi-red text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-daiichi-red/20">+ {t.add_route}</button>
              </div>
            </div>

            {/* Add/Edit Route Modal */}
            {showAddRoute && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-[32px] p-8 max-w-2xl w-full space-y-6 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold">
                      {editingRoute
                        ? (language === 'vi' ? 'Chỉnh sửa tuyến' : 'Edit Route')
                        : isCopyingRoute
                          ? `📋 ${t.copy_route_title}`
                          : (language === 'vi' ? 'Thêm tuyến mới' : 'Add New Route')}
                    </h3>
                    <button onClick={() => { setShowAddRoute(false); setEditingRoute(null); setIsCopyingRoute(false); setRouteModalEditingId(null); }} className="p-2 hover:bg-gray-50 rounded-xl"><X size={20} /></button>
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">STT</label><input type="number" value={routeForm.stt} onChange={e => setRouteForm(p => ({ ...p, stt: parseInt(e.target.value) || 1 }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                      <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.route_name}</label><input type="text" value={routeForm.name} onChange={e => setRouteForm(p => ({ ...p, name: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" placeholder={language === 'vi' ? 'VD: Hà Nội - Cát Bà' : 'e.g. Hanoi - Cat Ba'} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.ticket_price} (đ)</label><input type="number" min="0" value={routeForm.price} onChange={e => setRouteForm(p => ({ ...p, price: parseInt(e.target.value) || 0 }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.agent_price} (đ)</label>
                        <input type="number" min="0" value={routeForm.agentPrice} onChange={e => setRouteForm(p => ({ ...p, agentPrice: parseInt(e.target.value) || 0 }))} className="w-full mt-1 px-4 py-3 bg-orange-50 border border-orange-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-200" />
                        <p className="text-[10px] text-orange-500 mt-1 ml-1">{language === 'vi' ? '* Chỉ hiển thị cho đại lý' : '* Visible to agents only'}</p>
                      </div>
                    </div>
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.departure_point}</label><input type="text" value={routeForm.departurePoint} onChange={e => setRouteForm(p => ({ ...p, departurePoint: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.arrival_point}</label><input type="text" value={routeForm.arrivalPoint} onChange={e => setRouteForm(p => ({ ...p, arrivalPoint: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.route_details}</label>
                      <textarea value={routeForm.details} onChange={e => setRouteForm(p => ({ ...p, details: e.target.value }))} rows={4} placeholder={t.route_details_placeholder} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10 resize-none" />
                    </div>

                    {/* Route images (location photos) */}
                    <div className="space-y-3">
                      {/* Destination images – multiple allowed */}
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Ảnh điểm đến (có thể tải nhiều ảnh)' : 'Destination Photos (multiple allowed)'}</label>
                        {/* Uploaded images gallery */}
                        {(routeForm.images && routeForm.images.length > 0) && (
                          <div className="mt-1 flex flex-wrap gap-2">
                            {routeForm.images.map((url, idx) => (
                              <div key={idx} className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-100">
                                <img src={url} alt={`Route ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                <button
                                  onClick={() => {
                                    const newImages = routeForm.images.filter((_, i) => i !== idx);
                                    setRouteForm(p => ({ ...p, images: newImages, imageUrl: newImages[0] || '' }));
                                  }}
                                  className="absolute top-1 right-1 p-0.5 bg-black/60 text-white rounded-lg"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Upload area */}
                        <div className="relative mt-1 h-20 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl overflow-hidden flex flex-col items-center justify-center gap-1">
                          {routeImageUploading ? (
                            <Loader2 className="animate-spin text-daiichi-red" size={24} />
                          ) : (
                            <>
                              <span className="text-xs text-gray-400">{language === 'vi' ? 'Chọn ảnh (nhiều ảnh)' : 'Select photos (multiple)'}</span>
                              <input type="file" accept="image/*" multiple onChange={handleRouteImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Price Periods (Seasonal Pricing) */}
                    <div className="border border-gray-100 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-gray-700">{t.price_periods}</p>
                          <p className="text-[10px] text-gray-400">{language === 'vi' ? 'Giá thay đổi theo mùa / dịp lễ tết' : 'Prices that vary by season or holiday'}</p>
                        </div>
                        {!showAddPricePeriod && (
                          <button onClick={() => { setShowAddPricePeriod(true); setPricePeriodForm({ name: '', price: routeForm.price, agentPrice: routeForm.agentPrice, startDate: '', endDate: '' }); }} className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100">
                            + {t.add_price_period}
                          </button>
                        )}
                      </div>

                      {routePricePeriods.length === 0 && !showAddPricePeriod && (
                        <p className="text-xs text-gray-400 text-center py-2">{t.no_price_periods}</p>
                      )}

                      {routePricePeriods.map((period) => (
                        <div key={period.id} className="flex items-center gap-3 bg-blue-50 rounded-xl p-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-gray-800 truncate">{period.name || (language === 'vi' ? 'Kỳ giá' : 'Period')}</p>
                            <p className="text-xs text-gray-500">{period.startDate} → {period.endDate}</p>
                            <div className="flex gap-3 mt-1">
                              <span className="text-xs font-bold text-daiichi-red">{period.price.toLocaleString()}đ</span>
                              <span className="text-xs font-bold text-orange-600">{language === 'vi' ? 'ĐL' : 'Agt'}: {period.agentPrice.toLocaleString()}đ</span>
                            </div>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => { setEditingPricePeriodId(period.id); setPricePeriodForm({ name: period.name || '', price: period.price, agentPrice: period.agentPrice, startDate: period.startDate, endDate: period.endDate }); setShowAddPricePeriod(true); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg flex-shrink-0">
                              <Edit3 size={14} />
                            </button>
                            <button onClick={() => setRoutePricePeriods(prev => prev.filter(p => p.id !== period.id))} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg flex-shrink-0">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}

                      {showAddPricePeriod && (
                        <div className="border border-dashed border-blue-200 rounded-xl p-4 space-y-3 bg-blue-50/50">
                          <p className="text-xs font-bold text-blue-700">{editingPricePeriodId ? (language === 'vi' ? 'Hiệu chỉnh kỳ giá' : language === 'ja' ? '価格期間を編集' : 'Edit price period') : (language === 'vi' ? 'Thêm kỳ giá mới' : language === 'ja' ? '価格期間を追加' : 'Add price period')}</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.price_period_name}</label>
                              <input type="text" value={pricePeriodForm.name} onChange={e => setPricePeriodForm(p => ({ ...p, name: e.target.value }))} placeholder={language === 'vi' ? 'VD: Tết 2026, Hè 2025...' : 'e.g. Tet 2026, Summer 2025...'} className="w-full mt-1 px-3 py-2 bg-white border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.price_period_start}</label>
                              <input type="date" value={pricePeriodForm.startDate} onChange={e => setPricePeriodForm(p => ({ ...p, startDate: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-white border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.price_period_end}</label>
                              <input type="date" value={pricePeriodForm.endDate} onChange={e => setPricePeriodForm(p => ({ ...p, endDate: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-white border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.price_period_retail} (đ)</label>
                              <input type="number" min="0" value={pricePeriodForm.price} onChange={e => setPricePeriodForm(p => ({ ...p, price: parseInt(e.target.value) || 0 }))} className="w-full mt-1 px-3 py-2 bg-white border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">{t.price_period_agent} (đ)</label>
                              <input type="number" min="0" value={pricePeriodForm.agentPrice} onChange={e => setPricePeriodForm(p => ({ ...p, agentPrice: parseInt(e.target.value) || 0 }))} className="w-full mt-1 px-3 py-2 bg-orange-50 border border-orange-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-200" />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button onClick={() => { setShowAddPricePeriod(false); setEditingPricePeriodId(null); setPricePeriodForm({ name: '', price: 0, agentPrice: 0, startDate: '', endDate: '' }); }} className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600">{t.cancel}</button>
                            <button
                              disabled={!pricePeriodForm.startDate || !pricePeriodForm.endDate}
                              onClick={() => {
                                if (editingPricePeriodId) {
                                  setRoutePricePeriods(prev => prev.map(p => p.id === editingPricePeriodId ? { ...p, name: pricePeriodForm.name, price: pricePeriodForm.price, agentPrice: pricePeriodForm.agentPrice, startDate: pricePeriodForm.startDate, endDate: pricePeriodForm.endDate } : p));
                                  setEditingPricePeriodId(null);
                                } else {
                                  const newPeriod: PricePeriod = {
                                    id: crypto.randomUUID(),
                                    name: pricePeriodForm.name,
                                    price: pricePeriodForm.price,
                                    agentPrice: pricePeriodForm.agentPrice,
                                    startDate: pricePeriodForm.startDate,
                                    endDate: pricePeriodForm.endDate,
                                  };
                                  setRoutePricePeriods(prev => [...prev, newPeriod]);
                                }
                                setShowAddPricePeriod(false);
                                setPricePeriodForm({ name: '', price: 0, agentPrice: 0, startDate: '', endDate: '' });
                              }}
                              className="px-4 py-1.5 bg-blue-600 text-white text-xs rounded-lg font-bold disabled:opacity-50"
                            >
                              {t.save}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Route Surcharges */}
                    <div className="border border-gray-100 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-gray-700">{language === 'vi' ? 'Phụ thu tuyến đường' : language === 'ja' ? 'ルート追加料金' : 'Route Surcharges'}</p>
                          <p className="text-[10px] text-gray-400">{language === 'vi' ? 'Phụ thu xăng dầu, lễ tết, và các khoản phụ thu khác' : language === 'ja' ? '燃料、祝日、その他の追加料金' : 'Fuel, holiday, and other surcharges'}</p>
                        </div>
                        {!showAddRouteSurcharge && (
                          <button onClick={() => { setShowAddRouteSurcharge(true); setRouteSurchargeForm({ name: '', type: 'FUEL', amount: 0, isActive: true }); }} className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg text-xs font-bold hover:bg-amber-100">
                            + {language === 'vi' ? 'Thêm phụ thu' : language === 'ja' ? '追加料金を追加' : 'Add Surcharge'}
                          </button>
                        )}
                      </div>

                      {routeSurcharges.length === 0 && !showAddRouteSurcharge && (
                        <p className="text-xs text-gray-400 text-center py-2">{language === 'vi' ? 'Chưa có phụ thu nào' : language === 'ja' ? '追加料金なし' : 'No surcharges defined'}</p>
                      )}

                      {routeSurcharges.map((sc) => (
                        <div key={sc.id} className={`flex items-center gap-3 rounded-xl p-3 ${sc.isActive ? 'bg-amber-50' : 'bg-gray-50 opacity-60'}`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-sm text-gray-800 truncate">{sc.name}</p>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.type === 'FUEL' ? 'bg-orange-100 text-orange-600' : sc.type === 'HOLIDAY' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                                {sc.type === 'FUEL' ? (language === 'vi' ? 'Xăng dầu' : language === 'ja' ? '燃料' : 'Fuel') : sc.type === 'HOLIDAY' ? (language === 'vi' ? 'Lễ tết' : language === 'ja' ? '祝日' : 'Holiday') : (language === 'vi' ? 'Khác' : language === 'ja' ? 'その他' : 'Other')}
                              </span>
                              {!sc.isActive && <span className="text-[10px] text-gray-400 font-bold">{language === 'vi' ? '(Tạm dừng)' : '(Paused)'}</span>}
                            </div>
                            {sc.startDate && sc.endDate && <p className="text-xs text-gray-500">{sc.startDate} → {sc.endDate}</p>}
                            <p className="text-xs font-bold text-amber-600">+{sc.amount.toLocaleString()}đ/{language === 'vi' ? 'người' : language === 'ja' ? '人' : 'person'}</p>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => setRouteSurcharges(prev => prev.map(s => s.id === sc.id ? { ...s, isActive: !s.isActive } : s))} className={`p-1.5 rounded-lg text-xs font-bold transition-all ${sc.isActive ? 'text-amber-600 hover:bg-amber-100' : 'text-gray-400 hover:bg-gray-100'}`} title={sc.isActive ? (language === 'vi' ? 'Tạm dừng' : 'Pause') : (language === 'vi' ? 'Kích hoạt' : 'Activate')}>
                              {sc.isActive ? '✓' : '○'}
                            </button>
                            <button onClick={() => { setEditingRouteSurchargeId(sc.id); setRouteSurchargeForm({ name: sc.name, type: sc.type, amount: sc.amount, isActive: sc.isActive, startDate: sc.startDate, endDate: sc.endDate }); setShowAddRouteSurcharge(true); }} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-100 rounded-lg flex-shrink-0">
                              <Edit3 size={14} />
                            </button>
                            <button onClick={() => setRouteSurcharges(prev => prev.filter(s => s.id !== sc.id))} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg flex-shrink-0">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}

                      {showAddRouteSurcharge && (
                        <div className="border border-dashed border-amber-200 rounded-xl p-4 space-y-3 bg-amber-50/50">
                          <p className="text-xs font-bold text-amber-700">{editingRouteSurchargeId ? (language === 'vi' ? 'Hiệu chỉnh phụ thu' : language === 'ja' ? '追加料金を編集' : 'Edit surcharge') : (language === 'vi' ? 'Thêm phụ thu mới' : language === 'ja' ? '追加料金を追加' : 'Add surcharge')}</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Tên phụ thu' : language === 'ja' ? '追加料金名' : 'Surcharge Name'}</label>
                              <input type="text" value={routeSurchargeForm.name} onChange={e => setRouteSurchargeForm(p => ({ ...p, name: e.target.value }))} placeholder={language === 'vi' ? 'VD: Phụ thu Tết 2026, Phụ thu xăng...' : 'e.g. Tet 2026, Fuel Q1...'} className="w-full mt-1 px-3 py-2 bg-white border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Loại phụ thu' : language === 'ja' ? '追加料金タイプ' : 'Type'}</label>
                              <select value={routeSurchargeForm.type} onChange={e => setRouteSurchargeForm(p => ({ ...p, type: e.target.value as RouteSurcharge['type'] }))} className="w-full mt-1 px-3 py-2 bg-white border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200">
                                <option value="FUEL">{language === 'vi' ? 'Xăng dầu' : language === 'ja' ? '燃料' : 'Fuel'}</option>
                                <option value="HOLIDAY">{language === 'vi' ? 'Lễ tết / Mùa cao điểm' : language === 'ja' ? '祝日/ピーク' : 'Holiday / Peak Season'}</option>
                                <option value="OTHER">{language === 'vi' ? 'Khác' : language === 'ja' ? 'その他' : 'Other'}</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">{language === 'vi' ? 'Số tiền/người (đ)' : language === 'ja' ? '金額/人 (đ)' : 'Amount/person (đ)'}</label>
                              <input type="number" min="0" value={routeSurchargeForm.amount} onChange={e => setRouteSurchargeForm(p => ({ ...p, amount: parseInt(e.target.value) || 0 }))} className="w-full mt-1 px-3 py-2 bg-white border border-amber-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Từ ngày (tuỳ chọn)' : language === 'ja' ? '開始日（任意）' : 'From date (optional)'}</label>
                              <input type="date" value={routeSurchargeForm.startDate || ''} onChange={e => setRouteSurchargeForm(p => ({ ...p, startDate: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-white border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Đến ngày (tuỳ chọn)' : language === 'ja' ? '終了日（任意）' : 'To date (optional)'}</label>
                              <input type="date" value={routeSurchargeForm.endDate || ''} onChange={e => setRouteSurchargeForm(p => ({ ...p, endDate: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-white border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
                            </div>
                          </div>
                          <p className="text-[10px] text-gray-400 italic">{language === 'vi' ? 'Để trống cả hai ngày nếu phụ thu áp dụng toàn thời gian. Phải điền cả hai ngày để giới hạn khoảng thời gian áp dụng.' : language === 'ja' ? '常時適用する場合は両方の日付を空白にしてください。期間を設定する場合は両方の日付が必要です。' : 'Leave both dates empty if the surcharge applies at all times. Both dates must be set to limit the applied period.'}</p>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                              <input type="checkbox" checked={routeSurchargeForm.isActive} onChange={e => setRouteSurchargeForm(p => ({ ...p, isActive: e.target.checked }))} className="rounded" />
                              {language === 'vi' ? 'Đang áp dụng' : language === 'ja' ? '有効' : 'Active now'}
                            </label>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button onClick={() => { setShowAddRouteSurcharge(false); setEditingRouteSurchargeId(null); setRouteSurchargeForm({ name: '', type: 'FUEL', amount: 0, isActive: true }); }} className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600">{t.cancel}</button>
                            <button
                              disabled={!routeSurchargeForm.name || (!!routeSurchargeForm.startDate !== !!routeSurchargeForm.endDate)}
                              onClick={() => {
                                if (editingRouteSurchargeId) {
                                  setRouteSurcharges(prev => prev.map(s => s.id === editingRouteSurchargeId ? { ...s, ...routeSurchargeForm } : s));
                                  setEditingRouteSurchargeId(null);
                                } else {
                                  const newSurcharge: RouteSurcharge = { id: crypto.randomUUID(), ...routeSurchargeForm };
                                  setRouteSurcharges(prev => [...prev, newSurcharge]);
                                }
                                setShowAddRouteSurcharge(false);
                                setRouteSurchargeForm({ name: '', type: 'FUEL', amount: 0, isActive: true });
                              }}
                              className="px-4 py-1.5 bg-amber-500 text-white text-xs rounded-lg font-bold disabled:opacity-50"
                            >
                              {t.save}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Route Stops (Intermediate Stops / Sub-route) */}
                    <div className="border border-gray-100 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-gray-700">{language === 'vi' ? 'Điểm dừng / Tuyến phụ' : language === 'ja' ? '経由地 / サブルート' : 'Stops / Sub-routes'}</p>
                          <p className="text-[10px] text-gray-400">{language === 'vi' ? 'Điểm xuất phát và điểm đến được tạo tự động. Thêm điểm dừng trung gian nếu cần.' : 'Departure and arrival are auto-generated. Add intermediate stops as needed.'}</p>
                        </div>
                        {!showAddRouteStop && (
                          <button onClick={() => { setShowAddRouteStop(true); setEditingRouteStop(null); setRouteStopForm({ stopId: '', stopName: '', order: routeFormStops.length + 1 }); }} className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg text-xs font-bold hover:bg-purple-100">
                            + {language === 'vi' ? 'Thêm điểm dừng' : 'Add stop'}
                          </button>
                        )}
                      </div>

                      {/* Auto-generated departure stop */}
                      {routeForm.departurePoint && (
                        <div className="flex items-center gap-3 bg-green-50 rounded-xl p-3">
                          <span className="w-6 h-6 flex-shrink-0 bg-green-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">A</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-gray-800 truncate">{routeForm.departurePoint}</p>
                            <p className="text-[10px] text-green-600">{language === 'vi' ? 'Điểm xuất phát (tự động)' : 'Departure (auto-generated)'}</p>
                          </div>
                        </div>
                      )}

                      {routeFormStops.length === 0 && !showAddRouteStop && (
                        <p className="text-xs text-gray-400 text-center py-1">{language === 'vi' ? 'Không có điểm dừng trung gian – nhấn "Thêm điểm dừng" để thêm' : 'No intermediate stops – click "Add stop" to add one'}</p>
                      )}

                      {[...routeFormStops].sort((a, b) => a.order - b.order).map((stop, idx, sortedArr) => (
                        <div key={stop.stopId || idx} className="flex items-center gap-3 bg-purple-50 rounded-xl p-3">
                          <span className="w-6 h-6 flex-shrink-0 bg-purple-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">{idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-gray-800 truncate">{stop.stopName}</p>
                            <p className="text-[10px] text-gray-400">{stop.stopId}</p>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button
                              onClick={() => {
                                if (idx === 0) return;
                                const prevStop = sortedArr[idx - 1];
                                setRouteFormStopsHistory(prev => [...prev, routeFormStops]);
                                setRouteFormFaresHistory(prev => [...prev, routeFormFares]);
                                setRouteFormStops(prev => prev.map(s => {
                                  if (s.stopId === stop.stopId) return { ...s, order: prevStop.order };
                                  if (s.stopId === prevStop.stopId) return { ...s, order: stop.order };
                                  return s;
                                }));
                              }}
                              disabled={idx === 0}
                              className="p-1 text-gray-400 hover:text-purple-600 disabled:opacity-30 text-xs font-bold"
                            >↑</button>
                            <button
                              onClick={() => {
                                if (idx === sortedArr.length - 1) return;
                                const nextStop = sortedArr[idx + 1];
                                setRouteFormStopsHistory(prev => [...prev, routeFormStops]);
                                setRouteFormFaresHistory(prev => [...prev, routeFormFares]);
                                setRouteFormStops(prev => prev.map(s => {
                                  if (s.stopId === stop.stopId) return { ...s, order: nextStop.order };
                                  if (s.stopId === nextStop.stopId) return { ...s, order: stop.order };
                                  return s;
                                }));
                              }}
                              disabled={idx === sortedArr.length - 1}
                              className="p-1 text-gray-400 hover:text-purple-600 disabled:opacity-30 text-xs font-bold"
                            >↓</button>
                            <button
                              onClick={() => {
                                setEditingRouteStop(stop);
                                setRouteStopForm({ stopId: stop.stopId, stopName: stop.stopName, order: stop.order });
                                setShowAddRouteStop(true);
                              }}
                              className="p-1 text-gray-400 hover:text-blue-600 rounded"
                            ><Edit3 size={12} /></button>
                            <button onClick={() => { setRouteFormStopsHistory(prev => [...prev, routeFormStops]); setRouteFormFaresHistory(prev => [...prev, routeFormFares]); setRouteFormStops(prev => prev.filter(s => s.stopId !== stop.stopId).map((s, i) => ({ ...s, order: i + 1 }))); setRouteFormFares(prev => prev.filter(f => f.fromStopId !== stop.stopId && f.toStopId !== stop.stopId)); }} className="p-1 text-gray-400 hover:text-red-600 rounded"><Trash2 size={12} /></button>
                          </div>
                        </div>
                      ))}

                      {/* Auto-generated arrival stop */}
                      {routeForm.arrivalPoint && (
                        <div className="flex items-center gap-3 bg-blue-50 rounded-xl p-3">
                          <span className="w-6 h-6 flex-shrink-0 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">B</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-gray-800 truncate">{routeForm.arrivalPoint}</p>
                            <p className="text-[10px] text-blue-600">{language === 'vi' ? 'Điểm đến (tự động)' : 'Destination (auto-generated)'}</p>
                          </div>
                        </div>
                      )}

                      {showAddRouteStop && (
                        <div className="border border-dashed border-purple-200 rounded-xl p-4 space-y-3 bg-purple-50/50">
                          <p className="text-xs font-bold text-purple-600">{editingRouteStop ? (language === 'vi' ? 'Chỉnh sửa điểm dừng' : 'Edit Stop') : (language === 'vi' ? 'Thêm điểm dừng' : 'Add Stop')}</p>
                          <div className="grid grid-cols-1 gap-3">
                            <div>
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Chọn điểm dừng' : 'Select stop'}</label>
                              <select
                                value={routeStopForm.stopId}
                                onChange={e => {
                                  const stop = stops.find(s => s.id === e.target.value);
                                  setRouteStopForm(p => ({ ...p, stopId: e.target.value, stopName: stop?.name || '' }));
                                }}
                                className="w-full mt-1 px-3 py-2 bg-white border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
                              >
                                <option value="">{language === 'vi' ? '-- Chọn điểm dừng --' : '-- Select stop --'}</option>
                                {stops.filter(s => !routeFormStops.find(rs => rs.stopId === s.id) || s.id === editingRouteStop?.stopId).map(s => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button onClick={() => { setShowAddRouteStop(false); setEditingRouteStop(null); setRouteStopForm({ stopId: '', stopName: '', order: routeFormStops.length + 1 }); }} className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600">{t.cancel}</button>
                            <button
                              disabled={!routeStopForm.stopId}
                              onClick={() => {
                                const newStop: RouteStop = { stopId: routeStopForm.stopId, stopName: routeStopForm.stopName || stops.find(s => s.id === routeStopForm.stopId)?.name || '', order: routeStopForm.order };
                                setRouteFormStopsHistory(prev => [...prev, routeFormStops]);
                                setRouteFormFaresHistory(prev => [...prev, routeFormFares]);
                                if (editingRouteStop) {
                                  setRouteFormStops(prev => {
                                    const updated = prev.map(s => s.stopId === editingRouteStop.stopId ? newStop : s);
                                    return [...updated].sort((a, b) => a.order - b.order).map((s, i) => ({ ...s, order: i + 1 }));
                                  });
                                  // If the stop ID changed, remove fares referencing the old stopId
                                  // because the old fare's Firestore docId encodes the original stopIds
                                  // and cannot be remapped without creating new Firestore documents.
                                  if (editingRouteStop.stopId !== newStop.stopId) {
                                    setRouteFormFares(prev => prev.filter(f => f.fromStopId !== editingRouteStop.stopId && f.toStopId !== editingRouteStop.stopId));
                                  }
                                } else {
                                  setRouteFormStops(prev => {
                                    const updated = [...prev, newStop].sort((a, b) => a.order - b.order).map((s, i) => ({ ...s, order: i + 1 }));
                                    return updated;
                                  });
                                }
                                setShowAddRouteStop(false);
                                setEditingRouteStop(null);
                                setRouteStopForm({ stopId: '', stopName: '', order: routeFormStops.length + 2 });
                              }}
                              className="px-4 py-1.5 bg-purple-600 text-white text-xs rounded-lg font-bold disabled:opacity-50"
                            >
                              {t.save}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Fare Table (per-segment pricing) */}
                    {(routeForm.departurePoint && routeForm.arrivalPoint) && (
                      <div className="border border-gray-100 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold text-gray-700">{language === 'vi' ? 'Bảng giá theo chặng' : language === 'ja' ? '区間別運賃表' : 'Segment Fare Table'}</p>
                            <p className="text-[10px] text-gray-400">{language === 'vi' ? 'Giá vé lẻ và đại lý cho từng cặp điểm đón/trả (có thể đặt thời hạn áp dụng)' : 'Retail and agent prices for each from→to stop pair (optional date range)'}</p>
                          </div>
                          {!showAddRouteFare && (
                            <button onClick={() => { setShowAddRouteFare(true); setEditingRouteFareIdx(null); setRouteFareForm({ fromStopId: '', toStopId: '', price: routeForm.price, agentPrice: routeForm.agentPrice, startDate: '', endDate: '' }); }} className="flex items-center gap-1 px-3 py-1.5 bg-teal-50 text-teal-600 rounded-lg text-xs font-bold hover:bg-teal-100">
                              + {language === 'vi' ? 'Thêm giá chặng' : 'Add fare'}
                            </button>
                          )}
                        </div>

                        {routeFormFares.length === 0 && !showAddRouteFare && (
                          <p className="text-xs text-gray-400 text-center py-2">{language === 'vi' ? 'Chưa có giá chặng – nhấn nút để thêm' : 'No segment fares yet – click to add'}</p>
                        )}

                        {routeFormFares.map((fare, idx) => (
                          <div key={idx} className="flex items-center gap-3 bg-teal-50 rounded-xl p-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm text-gray-800 truncate">{fare.fromName} → {fare.toName}</p>
                              <div className="flex gap-3 mt-1 flex-wrap">
                                <span className="text-xs font-bold text-daiichi-red">{fare.price.toLocaleString()}đ</span>
                                {fare.agentPrice > 0 && <span className="text-xs font-bold text-orange-600">{language === 'vi' ? 'ĐL' : 'Agt'}: {fare.agentPrice.toLocaleString()}đ</span>}
                                {(fare.startDate || fare.endDate) && (
                                  <span className="text-xs text-gray-400">
                                    {fare.startDate && fare.endDate ? `${fare.startDate} → ${fare.endDate}` : fare.startDate ? `${language === 'vi' ? 'Từ' : 'From'} ${fare.startDate}` : `${language === 'vi' ? 'Đến' : 'To'} ${fare.endDate}`}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col gap-0.5 flex-shrink-0">
                              <button
                                onClick={() => {
                                  if (idx === 0) return;
                                  setRouteFormFaresHistory(prev => [...prev, routeFormFares]);
                                  setRouteFormFares(prev => {
                                    const next = [...prev];
                                    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                                    return next;
                                  });
                                }}
                                disabled={idx === 0}
                                className="p-0.5 text-gray-400 hover:text-teal-600 disabled:opacity-30 text-xs font-bold leading-none"
                              >↑</button>
                              <button
                                onClick={() => {
                                  if (idx === routeFormFares.length - 1) return;
                                  setRouteFormFaresHistory(prev => [...prev, routeFormFares]);
                                  setRouteFormFares(prev => {
                                    const next = [...prev];
                                    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                                    return next;
                                  });
                                }}
                                disabled={idx === routeFormFares.length - 1}
                                className="p-0.5 text-gray-400 hover:text-teal-600 disabled:opacity-30 text-xs font-bold leading-none"
                              >↓</button>
                            </div>
                            <button onClick={() => { setEditingRouteFareIdx(idx); setRouteFareForm({ fromStopId: fare.fromStopId, toStopId: fare.toStopId, price: fare.price, agentPrice: fare.agentPrice, startDate: fare.startDate, endDate: fare.endDate }); setShowAddRouteFare(true); }} className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-100 rounded-lg flex-shrink-0">
                              <Edit3 size={14} />
                            </button>
                            <button onClick={() => setRouteFormFares(prev => prev.filter((_, i) => i !== idx))} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg flex-shrink-0">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}

                        {showAddRouteFare && (
                          <div className="border border-dashed border-teal-200 rounded-xl p-4 space-y-3 bg-teal-50/50">
                            <p className="text-xs font-bold text-teal-700">{editingRouteFareIdx !== null ? (language === 'vi' ? 'Hiệu chỉnh giá chặng' : language === 'ja' ? '区間運賃を編集' : 'Edit segment fare') : (language === 'vi' ? 'Thêm giá chặng mới' : language === 'ja' ? '区間運賃を追加' : 'Add segment fare')}</p>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Từ điểm' : 'From stop'}</label>
                                <select value={routeFareForm.fromStopId} onChange={e => setRouteFareForm(p => ({ ...p, fromStopId: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-white border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-200">
                                  <option value="">{language === 'vi' ? '-- Chọn --' : '-- Select --'}</option>
                                  {allRouteStops.map(s => (
                                    <option key={s.stopId} value={s.stopId}>{s.stopName}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Đến điểm' : 'To stop'}</label>
                                <select value={routeFareForm.toStopId} onChange={e => setRouteFareForm(p => ({ ...p, toStopId: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-white border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-200">
                                  <option value="">{language === 'vi' ? '-- Chọn --' : '-- Select --'}</option>
                                  {allRouteStops.filter(s => s.stopId !== routeFareForm.fromStopId).map(s => (
                                    <option key={s.stopId} value={s.stopId}>{s.stopName}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.ticket_price} (đ)</label>
                                <input type="number" min="0" value={routeFareForm.price} onChange={e => setRouteFareForm(p => ({ ...p, price: parseInt(e.target.value) || 0 }))} className="w-full mt-1 px-3 py-2 bg-white border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-200" />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">{t.agent_price} (đ)</label>
                                <input type="number" min="0" value={routeFareForm.agentPrice} onChange={e => setRouteFareForm(p => ({ ...p, agentPrice: parseInt(e.target.value) || 0 }))} className="w-full mt-1 px-3 py-2 bg-orange-50 border border-orange-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-200" />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Áp dụng từ ngày' : 'Valid from'}</label>
                                <input type="date" value={routeFareForm.startDate} onChange={e => setRouteFareForm(p => ({ ...p, startDate: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-white border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-200" />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Đến ngày' : 'Valid until'}</label>
                                <input type="date" value={routeFareForm.endDate} onChange={e => setRouteFareForm(p => ({ ...p, endDate: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-white border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-200" />
                              </div>
                            </div>
                            <div className="flex justify-end gap-2">
                              <button onClick={() => { setShowAddRouteFare(false); setEditingRouteFareIdx(null); }} className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600">{t.cancel}</button>
                              <button
                                disabled={!routeFareForm.fromStopId || !routeFareForm.toStopId || routeFareForm.fromStopId === routeFareForm.toStopId}
                                onClick={() => {
                                  const fromStop = allRouteStops.find(s => s.stopId === routeFareForm.fromStopId);
                                  const toStop = allRouteStops.find(s => s.stopId === routeFareForm.toStopId);
                                  if (!fromStop || !toStop) return;
                                  // Validate order: from must come before to
                                  if (fromStop.order >= toStop.order) {
                                    alert(language === 'vi' ? 'Điểm đón phải nằm trước điểm trả trong hành trình' : 'From stop must come before to stop in route order');
                                    return;
                                  }
                                  const newFare = { fromStopId: routeFareForm.fromStopId, toStopId: routeFareForm.toStopId, fromName: fromStop.stopName, toName: toStop.stopName, price: routeFareForm.price, agentPrice: routeFareForm.agentPrice, startDate: routeFareForm.startDate, endDate: routeFareForm.endDate };
                                  if (editingRouteFareIdx !== null) {
                                    // Check for duplicate pair (excluding the current editing index)
                                    const duplicate = routeFormFares.findIndex((f, i) => i !== editingRouteFareIdx && f.fromStopId === routeFareForm.fromStopId && f.toStopId === routeFareForm.toStopId);
                                    if (duplicate >= 0) {
                                      alert(language === 'vi' ? 'Giá chặng cho cặp điểm này đã tồn tại' : 'A fare for this stop pair already exists');
                                      return;
                                    }
                                    // Update the fare at the editing index
                                    setRouteFormFares(prev => prev.map((f, i) => i === editingRouteFareIdx ? newFare : f));
                                  } else {
                                    setRouteFormFares(prev => {
                                      const existing = prev.findIndex(f => f.fromStopId === routeFareForm.fromStopId && f.toStopId === routeFareForm.toStopId);
                                      if (existing >= 0) {
                                        return prev.map((f, i) => i === existing ? newFare : f);
                                      }
                                      return [...prev, newFare];
                                    });
                                  }
                                  setShowAddRouteFare(false);
                                  setEditingRouteFareIdx(null);
                                  setRouteFareForm({ fromStopId: '', toStopId: '', price: routeForm.price, agentPrice: routeForm.agentPrice, startDate: '', endDate: '' });
                                }}
                                className="px-4 py-1.5 bg-teal-600 text-white text-xs rounded-lg font-bold disabled:opacity-50"
                              >
                                {t.save}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Pickup / Dropoff Address Settings (Cấu hình điểm đón / điểm trả) */}
                    <div className="border border-gray-100 rounded-2xl p-4 space-y-3">
                      <div>
                        <p className="text-sm font-bold text-gray-700">{language === 'vi' ? 'Cấu hình điểm đón / điểm trả' : language === 'ja' ? '乗降地点の設定' : 'Pickup / Dropoff Settings'}</p>
                        <p className="text-[10px] text-gray-400">{language === 'vi' ? 'Bật vô hiệu hóa để ẩn ô nhập điểm đón hoặc điểm trả trên trang đặt vé' : 'Enable to hide pickup or dropoff address input on the booking page'}</p>
                      </div>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={routeForm.disablePickupAddress}
                              onChange={e => setRouteForm(f => ({ ...f, disablePickupAddress: e.target.checked }))}
                              className="w-4 h-4 accent-daiichi-red rounded"
                            />
                            <span className="text-sm text-gray-700">{language === 'vi' ? 'Vô hiệu hóa ô nhập điểm đón' : language === 'ja' ? '乗車地点の入力を無効化' : 'Disable pickup address input'}</span>
                          </label>
                          {routeForm.disablePickupAddress && (
                            <div className="ml-7 flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-gray-500">{language === 'vi' ? 'Từ ngày' : language === 'ja' ? '開始日' : 'From'}</span>
                              <input
                                type="date"
                                value={routeForm.disablePickupAddressFrom}
                                onChange={e => setRouteForm(f => ({ ...f, disablePickupAddressFrom: e.target.value }))}
                                className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                              />
                              <span className="text-xs text-gray-500">{language === 'vi' ? 'đến ngày' : language === 'ja' ? '終了日' : 'to'}</span>
                              <input
                                type="date"
                                value={routeForm.disablePickupAddressTo}
                                onChange={e => setRouteForm(f => ({ ...f, disablePickupAddressTo: e.target.value }))}
                                className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                              />
                              <span className="text-[10px] text-gray-400">{language === 'vi' ? '(để trống = luôn vô hiệu)' : '(leave empty = always disabled)'}</span>
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={routeForm.disableDropoffAddress}
                              onChange={e => setRouteForm(f => ({ ...f, disableDropoffAddress: e.target.checked }))}
                              className="w-4 h-4 accent-daiichi-red rounded"
                            />
                            <span className="text-sm text-gray-700">{language === 'vi' ? 'Vô hiệu hóa ô nhập điểm trả' : language === 'ja' ? '降車地点の入力を無効化' : 'Disable dropoff address input'}</span>
                          </label>
                          {routeForm.disableDropoffAddress && (
                            <div className="ml-7 flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-gray-500">{language === 'vi' ? 'Từ ngày' : language === 'ja' ? '開始日' : 'From'}</span>
                              <input
                                type="date"
                                value={routeForm.disableDropoffAddressFrom}
                                onChange={e => setRouteForm(f => ({ ...f, disableDropoffAddressFrom: e.target.value }))}
                                className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                              />
                              <span className="text-xs text-gray-500">{language === 'vi' ? 'đến ngày' : language === 'ja' ? '終了日' : 'to'}</span>
                              <input
                                type="date"
                                value={routeForm.disableDropoffAddressTo}
                                onChange={e => setRouteForm(f => ({ ...f, disableDropoffAddressTo: e.target.value }))}
                                className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                              />
                              <span className="text-[10px] text-gray-400">{language === 'vi' ? '(để trống = luôn vô hiệu)' : '(leave empty = always disabled)'}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                  </div>
                  <div className="flex justify-end gap-4 pt-2">
                    <button onClick={() => { setShowAddRoute(false); setEditingRoute(null); setIsCopyingRoute(false); setRouteModalEditingId(null); }} className="px-6 py-3 text-sm font-bold text-gray-400 hover:text-gray-600">{t.cancel}</button>
                    <button onClick={handleSaveRoute} disabled={!routeForm.name} className="px-8 py-3 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/20 disabled:opacity-50">{editingRoute ? t.save : isCopyingRoute ? t.create_copy : t.add_route}</button>
                  </div>
                </div>
              </div>
            )}

            {/* Search bar + Advanced Filter Toggle */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 space-y-3">
              <div className="flex gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    value={routeSearch}
                    onChange={e => setRouteSearch(e.target.value)}
                    placeholder={language === 'vi' ? 'Tìm kiếm tuyến đường...' : 'Search routes...'}
                    className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                  />
                  {routeSearch && (
                    <button onClick={() => setRouteSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X size={14} />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowRouteFilters(p => !p)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all',
                    showRouteFilters ? 'bg-daiichi-red text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  <Filter size={15} />
                  {language === 'vi' ? 'Lọc nâng cao' : 'Advanced Filter'}
                  {(routeFilterDeparture || routeFilterArrival) && (
                    <span className="ml-1 px-1.5 py-0.5 bg-white/30 rounded text-[10px] font-bold">
                      {[routeFilterDeparture, routeFilterArrival].filter(Boolean).length}
                    </span>
                  )}
                </button>
                {(routeSearch || routeFilterDeparture || routeFilterArrival) && (
                  <button
                    onClick={() => { setRouteSearch(''); setRouteFilterDeparture(''); setRouteFilterArrival(''); }}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-50 text-red-500 hover:bg-red-100 transition-all"
                  >
                    <X size={14} />
                    {language === 'vi' ? 'Xóa bộ lọc' : 'Clear Filters'}
                  </button>
                )}
              </div>
              {showRouteFilters && (
                <div className="flex gap-4 flex-wrap pt-1 border-t border-gray-100">
                  <div className="flex-1 min-w-[180px]">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">{t.departure_point}</label>
                    <input
                      type="text"
                      value={routeFilterDeparture}
                      onChange={e => setRouteFilterDeparture(e.target.value)}
                      placeholder={language === 'vi' ? 'Lọc theo điểm đi...' : 'Filter by departure...'}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
                    />
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">{t.arrival_point}</label>
                    <input
                      type="text"
                      value={routeFilterArrival}
                      onChange={e => setRouteFilterArrival(e.target.value)}
                      placeholder={language === 'vi' ? 'Lọc theo điểm đến...' : 'Filter by arrival...'}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <ResizableTh width={routeColWidths.stt} onResize={(w) => setRouteColWidths(p => ({ ...p, stt: w }))} className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">STT</ResizableTh>
                    <ResizableTh width={routeColWidths.name} onResize={(w) => setRouteColWidths(p => ({ ...p, name: w }))} className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.route_name}</ResizableTh>
                    <ResizableTh width={routeColWidths.departure} onResize={(w) => setRouteColWidths(p => ({ ...p, departure: w }))} className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.departure_point}</ResizableTh>
                    <ResizableTh width={routeColWidths.arrival} onResize={(w) => setRouteColWidths(p => ({ ...p, arrival: w }))} className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.arrival_point}</ResizableTh>
                    <ResizableTh width={routeColWidths.price} onResize={(w) => setRouteColWidths(p => ({ ...p, price: w }))} className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.ticket_price}</ResizableTh>
                    <ResizableTh width={routeColWidths.agentPrice} onResize={(w) => setRouteColWidths(p => ({ ...p, agentPrice: w }))} className="px-6 py-5 text-[10px] font-bold text-orange-400 uppercase tracking-widest">{t.agent_price}</ResizableTh>
                    <ResizableTh width={routeColWidths.options} onResize={(w) => setRouteColWidths(p => ({ ...p, options: w }))} className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.options}</ResizableTh>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRoutes.map((route) => (
                    <tr key={route.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-6 text-sm text-gray-500">{route.stt}</td>
                      <td className="px-6 py-6">
                        <p className="font-bold text-gray-800">{route.name}</p>
                        {(route.pricePeriods || []).length > 0 && (
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold">
                            <Calendar size={10} /> {(route.pricePeriods || []).length} {language === 'vi' ? 'kỳ giá' : 'periods'}
                          </span>
                        )}
                        {(() => {
                          const intermediateStops = (route.routeStops || []).filter(s => s.stopId !== STOP_ID_DEPARTURE && s.stopId !== STOP_ID_ARRIVAL);
                          return intermediateStops.length > 0 ? (
                            <span className="inline-flex items-center gap-1 mt-1 ml-1 px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full text-[10px] font-bold">
                              {intermediateStops.length} {language === 'vi' ? 'điểm dừng' : 'stops'}
                            </span>
                          ) : null;
                        })()}
                      </td>
                      <td className="px-6 py-6"><p className="text-xs text-gray-500 max-w-[200px]">{route.departurePoint}</p></td>
                      <td className="px-6 py-6"><p className="text-xs text-gray-500 max-w-[200px]">{route.arrivalPoint}</p></td>
                      <td className="px-6 py-6"><p className="font-bold text-daiichi-red">{route.price > 0 ? `${route.price.toLocaleString()}đ` : t.contact}</p></td>
                      <td className="px-6 py-6"><p className="font-bold text-orange-600">{(route.agentPrice || 0) > 0 ? `${(route.agentPrice || 0).toLocaleString()}đ` : '—'}</p></td>
                      <td className="px-6 py-6"><div className="flex gap-3 items-center"><button onClick={() => exportRouteToPDF(route)} title={language === 'vi' ? 'Xuất PDF' : language === 'ja' ? 'PDFを出力' : 'Export PDF'} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-1 rounded"><FileText size={18} /></button><button onClick={() => handleCopyRoute(route)} title={t.copy_route} className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 p-1 rounded"><Copy size={18} /></button><button onClick={() => handleStartEditRoute(route)} className="text-gray-600 hover:text-daiichi-red"><Edit3 size={18} /></button><button onClick={() => handleDeleteRoute(route.id)} className="text-gray-600 hover:text-red-600"><Trash2 size={18} /></button><NotePopover note={route.note} onSave={(note) => handleSaveRouteNote(route.id, note)} language={language} /></div></td>
                    </tr>
                  ))}
                  {filteredRoutes.length === 0 && (
                    <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-gray-400">{language === 'vi' ? 'Không tìm thấy tuyến đường nào.' : 'No routes found.'}</td></tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        );
      }

      case 'vehicles': {
        const filteredVehicles = vehicles.filter(v => {
          if (vehicleFilterType && (v.type || '') !== vehicleFilterType) return false;
          if (vehicleFilterStatus !== 'ALL' && (v.status || 'ACTIVE') !== vehicleFilterStatus) return false;
          if (!vehicleSearch) return true;
          const q = vehicleSearch.toLowerCase();
          return (
            (v.licensePlate || '').toLowerCase().includes(q) ||
            (v.type || '').toLowerCase().includes(q)
          );
        });
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-3">
              <div><h2 className="text-2xl font-bold">{t.vehicle_management}</h2><p className="text-sm text-gray-500">{t.vehicle_list}</p></div>
              <div className="flex gap-3 flex-wrap">
                {vehicles.length === 0 && (
                  <button
                    onClick={async () => {
                      try {
                        const added = await transportService.seedVehicles();
                        if (added === 0) alert(language === 'vi' ? 'Tất cả xe đã tồn tại.' : 'All vehicles already exist.');
                        else alert(language === 'vi' ? `Đã thêm ${added} xe.` : `Added ${added} vehicles.`);
                      } catch (e) {
                        console.error(e);
                        alert(language === 'vi' ? 'Lỗi khi thêm dữ liệu xe.' : 'Error seeding vehicles.');
                      }
                    }}
                    className="bg-blue-600 text-white px-5 py-3 rounded-xl font-bold shadow-lg shadow-blue-600/20 text-sm"
                  >
                    {language === 'vi' ? '📋 Nạp danh sách xe' : '📋 Seed Vehicles'}
                  </button>
                )}
                <button onClick={() => { setShowAddVehicle(true); setEditingVehicle(null); setIsCopyingVehicle(false); setVehicleForm({ licensePlate: '', type: 'Ghế ngồi', seats: 16, registrationExpiry: '', status: 'ACTIVE', seatType: 'assigned' }); }} className="bg-daiichi-red text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-daiichi-red/20">+ {t.add_vehicle}</button>
              </div>
            </div>

            {/* Add/Edit Vehicle Modal */}
            {showAddVehicle && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-[32px] p-8 max-w-lg w-full space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold">
                      {editingVehicle
                        ? (language === 'vi' ? 'Chỉnh sửa phương tiện' : language === 'en' ? 'Edit Vehicle' : '車両を編集')
                        : isCopyingVehicle
                          ? `📋 ${t.copy_vehicle_title}`
                          : (language === 'vi' ? 'Thêm phương tiện mới' : language === 'en' ? 'Add New Vehicle' : '新しい車両を追加')}
                    </h3>
                    <button onClick={() => { setShowAddVehicle(false); setEditingVehicle(null); setIsCopyingVehicle(false); }} className="p-2 hover:bg-gray-50 rounded-xl"><X size={20} /></button>
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.license_plate}</label><input type="text" value={vehicleForm.licensePlate} onChange={e => setVehicleForm(p => ({ ...p, licensePlate: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" placeholder="29B-123.45" /></div>
                      <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.seats}</label><input type="number" min="1" value={vehicleForm.seats} onChange={e => setVehicleForm(p => ({ ...p, seats: parseInt(e.target.value) || 6 }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                    </div>
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.vehicle_type}</label>
                      <select value={vehicleForm.type} onChange={e => setVehicleForm(p => ({ ...p, type: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none">
                        <option value="Ghế ngồi">Ghế ngồi</option>
                        <option value="Ghế ngồi limousine">Ghế ngồi limousine</option>
                        <option value="Giường nằm">Giường nằm</option>
                        <option value="Phòng VIP (cabin)">Phòng VIP (cabin)</option>
                      </select>
                    </div>
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.registration_expiry}</label><input type="date" value={vehicleForm.registrationExpiry} onChange={e => setVehicleForm(p => ({ ...p, registrationExpiry: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Loại ghế' : language === 'en' ? 'Seat Type' : '座席タイプ'}</label>
                      <select value={vehicleForm.seatType} onChange={e => setVehicleForm(p => ({ ...p, seatType: e.target.value as 'assigned' | 'free' }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none">
                        <option value="assigned">{language === 'vi' ? 'Ghế chỉ định' : language === 'en' ? 'Assigned Seats' : '指定席'}</option>
                        <option value="free">{language === 'vi' ? 'Ghế tự do' : language === 'en' ? 'Free Seating' : '自由席'}</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-4 pt-2">
                    <button onClick={() => { setShowAddVehicle(false); setEditingVehicle(null); setIsCopyingVehicle(false); }} className="px-6 py-3 text-sm font-bold text-gray-400 hover:text-gray-600">{t.cancel}</button>
                    <button onClick={handleSaveVehicle} disabled={!vehicleForm.licensePlate} className="px-8 py-3 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/20 disabled:opacity-50">{editingVehicle ? t.save : isCopyingVehicle ? t.create_copy : (language === 'vi' ? 'Thêm xe' : language === 'en' ? 'Add Vehicle' : '車両を追加')}</button>
                  </div>
                </div>
              </div>
            )}

            {/* Vehicle seat diagram modal */}
            {diagramVehicle && (
              <VehicleSeatDiagram
                licensePlate={diagramVehicle.licensePlate}
                vehicleType={diagramVehicle.type}
                seatCount={diagramVehicle.seats}
                savedSeats={(diagramVehicle.layout as any) || null}
                editable={true}
                onSave={handleSaveVehicleLayout}
                onClose={() => setDiagramVehicle(null)}
                language={language}
              />
            )}

            {/* Search bar + Advanced Filter Toggle */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 space-y-3">
              <div className="flex gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    value={vehicleSearch}
                    onChange={e => setVehicleSearch(e.target.value)}
                    placeholder={language === 'vi' ? 'Tìm kiếm theo biển số, loại xe...' : 'Search by plate, type...'}
                    className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                  />
                  {vehicleSearch && (
                    <button onClick={() => setVehicleSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X size={14} />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowVehicleFilters(p => !p)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all',
                    showVehicleFilters ? 'bg-daiichi-red text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  <Filter size={15} />
                  {language === 'vi' ? 'Lọc nâng cao' : 'Advanced Filter'}
                  {(vehicleFilterType || vehicleFilterStatus !== 'ALL') && (
                    <span className="ml-1 px-1.5 py-0.5 bg-white/30 rounded text-[10px] font-bold">
                      {[vehicleFilterType, vehicleFilterStatus !== 'ALL'].filter(Boolean).length}
                    </span>
                  )}
                </button>
                {(vehicleSearch || vehicleFilterType || vehicleFilterStatus !== 'ALL') && (
                  <button
                    onClick={() => { setVehicleSearch(''); setVehicleFilterType(''); setVehicleFilterStatus('ALL'); }}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-50 text-red-500 hover:bg-red-100 transition-all"
                  >
                    <X size={14} />
                    {language === 'vi' ? 'Xóa bộ lọc' : 'Clear Filters'}
                  </button>
                )}
              </div>
              {showVehicleFilters && (
                <div className="flex gap-4 flex-wrap pt-1 border-t border-gray-100">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">{t.vehicle_type}</label>
                    <div className="flex gap-2 flex-wrap">
                      {(['', ...uniqueVehicleTypes] as string[]).map(type => (
                        <button
                          key={type}
                          onClick={() => setVehicleFilterType(type)}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                            vehicleFilterType === type
                              ? 'bg-daiichi-red text-white ring-2 ring-daiichi-red'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          )}
                        >
                          {type === '' ? (language === 'vi' ? 'Tất cả' : 'All') : type}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">{t.status}</label>
                    <div className="flex gap-2">
                      {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => setVehicleFilterStatus(s)}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                            vehicleFilterStatus === s
                              ? s === 'ACTIVE' ? 'bg-green-100 text-green-700 ring-2 ring-green-400'
                                : s === 'INACTIVE' ? 'bg-gray-200 text-gray-700 ring-2 ring-gray-400'
                                : 'bg-daiichi-red/10 text-daiichi-red ring-2 ring-daiichi-red/30'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          )}
                        >
                          {s === 'ALL' ? (language === 'vi' ? 'Tất cả' : 'All')
                            : s === 'ACTIVE' ? (language === 'vi' ? 'Hoạt động' : 'Active')
                            : (language === 'vi' ? 'Ngừng' : 'Inactive')}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <ResizableTh width={vehicleColWidths.stt} onResize={(w) => setVehicleColWidths(p => ({ ...p, stt: w }))} className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">STT</ResizableTh>
                    <ResizableTh width={vehicleColWidths.licensePlate} onResize={(w) => setVehicleColWidths(p => ({ ...p, licensePlate: w }))} className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.license_plate}</ResizableTh>
                    <ResizableTh width={vehicleColWidths.type} onResize={(w) => setVehicleColWidths(p => ({ ...p, type: w }))} className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.vehicle_type}</ResizableTh>
                    <ResizableTh width={vehicleColWidths.seats} onResize={(w) => setVehicleColWidths(p => ({ ...p, seats: w }))} className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.seats}</ResizableTh>
                    <ResizableTh width={vehicleColWidths.expiry} onResize={(w) => setVehicleColWidths(p => ({ ...p, expiry: w }))} className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.registration_expiry}</ResizableTh>
                    <ResizableTh width={vehicleColWidths.options} onResize={(w) => setVehicleColWidths(p => ({ ...p, options: w }))} className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.options}</ResizableTh>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredVehicles.map((v, idx) => (
                    <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-6 text-sm text-gray-500">{idx + 1}</td>
                      <td className="px-6 py-6 font-bold text-gray-800">{v.licensePlate}</td>
                      <td className="px-6 py-6 text-sm">{v.type}{v.seatType === 'free' && <span className="ml-2 px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-100 text-blue-600 uppercase">{language === 'vi' ? 'Tự do' : 'Free'}</span>}</td>
                      <td className="px-6 py-6 text-sm">{v.seats}</td>
                      <td className="px-6 py-6 text-sm">{v.registrationExpiry}</td>
                      <td className="px-6 py-6">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setDiagramVehicle(v)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all"
                            title={language === 'vi' ? 'Xem / sửa sơ đồ xe' : 'View / edit seat diagram'}
                          >
                            <Bus size={13} />
                            {language === 'vi' ? 'Sơ đồ' : 'Diagram'}
                          </button>
                          <button onClick={() => handleStartEditVehicle(v)} className="text-gray-600 hover:text-daiichi-red p-1.5"><Edit3 size={16} /></button>
                          <button onClick={() => handleCopyVehicle(v)} title={t.copy_vehicle} className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 p-1.5 rounded"><Copy size={16} /></button>
                          <button onClick={() => handleDeleteVehicle(v.id)} className="text-gray-600 hover:text-red-600 p-1.5"><Trash2 size={16} /></button>
                          <NotePopover note={v.note} onSave={(note) => handleSaveVehicleNote(v.id, note)} language={language} />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredVehicles.length === 0 && (
                    <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-400">{language === 'vi' ? 'Không tìm thấy phương tiện nào.' : 'No vehicles found.'}</td></tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        );
      }

      case 'operations': {
        // Pre-compute active employee names (drivers first) for driver select
        const activeEmployeeNames = [
          ...employees.filter(e => e.role === 'DRIVER' && e.status === 'ACTIVE').map(e => e.name),
          ...employees.filter(e => e.role !== 'DRIVER' && e.status === 'ACTIVE').map(e => e.name),
        ];
        const filteredTrips = trips.filter(trip => {
          if (trip.status === TripStatus.COMPLETED) return false;
          // Quick date filter
          if (tripDateQuickFilter && trip.date !== tripDateQuickFilter) return false;
          // Advanced filters
          if (tripFilterStatus !== 'ALL' && trip.status !== tripFilterStatus) return false;
          if (tripFilterRoute && !(trip.route || '').toLowerCase().includes(tripFilterRoute.toLowerCase())) return false;
          if (tripFilterDateFrom && trip.date && trip.date < tripFilterDateFrom) return false;
          if (tripFilterDateTo && trip.date && trip.date > tripFilterDateTo) return false;
          if (!tripSearch) return true;
          const q = tripSearch.toLowerCase();
          return (
            (trip.time || '').toLowerCase().includes(q) ||
            (trip.route || '').toLowerCase().includes(q) ||
            (trip.licensePlate || '').toLowerCase().includes(q) ||
            (trip.driverName || '').toLowerCase().includes(q)
          );
        }).sort((a, b) => compareTripDateTime(a, b));
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">{t.operation_management}</h2>
              <div className="flex gap-2">
                <button onClick={() => { setShowBatchAddTrip(true); setBatchTripForm({ date: '', route: '', licensePlate: '', driverName: '', price: 0, agentPrice: 0, seatCount: 11 }); setBatchTimeSlots(['']); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm">⚡ {t.batch_add_trips}</button>
                <button onClick={() => { setShowAddTrip(true); setEditingTrip(null); setTripForm({ time: '', date: '', route: '', licensePlate: '', driverName: '', price: 0, agentPrice: 0, seatCount: 11, status: TripStatus.WAITING }); }} className="bg-daiichi-red text-white px-4 py-2 rounded-lg font-bold">+ {t.add_trip}</button>
              </div>
            </div>

            {/* Add/Edit Trip Modal */}
            {showAddTrip && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-[32px] p-8 max-w-lg w-full space-y-6 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold">
                      {editingTrip
                        ? (language === 'vi' ? 'Chỉnh sửa chuyến' : 'Edit Trip')
                        : isCopyingTrip
                          ? `📋 ${t.copy_trip}`
                          : (language === 'vi' ? 'Thêm chuyến mới' : 'Add New Trip')}
                    </h3>
                    <button onClick={() => { setShowAddTrip(false); setEditingTrip(null); setIsCopyingTrip(false); }} className="p-2 hover:bg-gray-50 rounded-xl"><X size={20} /></button>
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.departure_date}</label><input type="date" value={tripForm.date} min={editingTrip ? undefined : getLocalDateString(0)} onChange={e => {
                        const date = e.target.value;
                        const selectedRoute = routes.find(r => r.name === tripForm.route);
                        if (selectedRoute) {
                          const period = getRouteActivePeriod(selectedRoute, date);
                          const price = period ? period.price : selectedRoute.price;
                          const agentPrice = period ? period.agentPrice : (selectedRoute.agentPrice || 0);
                          setTripForm(p => ({ ...p, date, price, agentPrice }));
                        } else {
                          setTripForm(p => ({ ...p, date }));
                        }
                      }} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                      <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.departure_time}</label><input type="time" value={tripForm.time} onChange={e => setTripForm(p => ({ ...p, time: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.ticket_price} (đ)</label><input type="number" min="0" value={tripForm.price} onChange={e => setTripForm(p => ({ ...p, price: parseInt(e.target.value) || 0 }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                      <div><label className="text-[10px] font-bold text-orange-400 uppercase tracking-widest ml-1">{t.agent_price} (đ)</label><input type="number" min="0" value={tripForm.agentPrice} onChange={e => setTripForm(p => ({ ...p, agentPrice: parseInt(e.target.value) || 0 }))} className="w-full mt-1 px-4 py-3 bg-orange-50 border border-orange-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-200" /></div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.route_name}</label>
                      {tripForm.date && (
                        <p className="text-[10px] text-blue-500 mt-0.5 ml-1">
                          {language === 'vi' ? '* Chỉ hiển thị tuyến có hiệu lực vào ngày đã chọn' : '* Only showing routes valid for selected date'}
                        </p>
                      )}
                      <select value={tripForm.route} onChange={e => {
                        const routeName = e.target.value;
                        const selectedRoute = routes.find(r => r.name === routeName);
                        if (selectedRoute) {
                          const period = getRouteActivePeriod(selectedRoute, tripForm.date);
                          const price = period ? period.price : selectedRoute.price;
                          const agentPrice = period ? period.agentPrice : (selectedRoute.agentPrice || 0);
                          setTripForm(p => ({ ...p, route: routeName, price, agentPrice }));
                        } else {
                          setTripForm(p => ({ ...p, route: routeName }));
                        }
                      }} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none">
                        <option value="">{language === 'vi' ? '-- Chọn tuyến --' : '-- Select Route --'}</option>
                        {routes.filter(r => isRouteValidForDate(r, tripForm.date)).map(r => {
                          const period = getRouteActivePeriod(r, tripForm.date);
                          return <option key={r.id} value={r.name}>{formatRouteOption(r, period, language)}</option>;
                        })}
                      </select>
                    </div>
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.license_plate} <span className="normal-case font-normal text-gray-400">({language === 'vi' ? 'tùy chọn' : 'optional'})</span></label>
                      <select value={tripForm.licensePlate} onChange={e => handleTripVehicleSelect(e.target.value)} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none">
                        <option value="">{language === 'vi' ? '-- Chọn xe (tùy chọn) --' : '-- Select Vehicle (optional) --'}</option>
                        {vehicles.map(v => <option key={v.id} value={v.licensePlate}>{v.licensePlate} - {v.type} ({v.seats} {t.seats})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.driver}</label>
                      <SearchableSelect
                        options={activeEmployeeNames}
                        value={tripForm.driverName}
                        onChange={(val) => setTripForm(p => ({ ...p, driverName: val }))}
                        placeholder={language === 'vi' ? 'Chọn hoặc nhập tên tài xế...' : 'Select or type driver name...'}
                        className="mt-1"
                      />
                    </div>
                    {!editingTrip && (
                      <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.seats}</label><input type="number" min="1" value={tripForm.seatCount} onChange={e => setTripForm(p => ({ ...p, seatCount: parseInt(e.target.value) || 11 }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                    )}
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.status}</label>
                      <select value={tripForm.status} onChange={e => setTripForm(p => ({ ...p, status: e.target.value as TripStatus }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none">
                        <option value={TripStatus.WAITING}>{language === 'vi' ? 'Chờ khởi hành' : 'Waiting'}</option>
                        <option value={TripStatus.RUNNING}>{language === 'vi' ? 'Đang chạy' : 'Running'}</option>
                        <option value={TripStatus.COMPLETED}>{language === 'vi' ? 'Hoàn thành' : 'Completed'}</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-4 pt-2">
                    <button onClick={() => { setShowAddTrip(false); setEditingTrip(null); setIsCopyingTrip(false); }} className="px-6 py-3 text-sm font-bold text-gray-400 hover:text-gray-600">{t.cancel}</button>
                    <button onClick={handleSaveTrip} disabled={!tripForm.time || !tripForm.route} className="px-8 py-3 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/20 disabled:opacity-50">{editingTrip ? t.save : isCopyingTrip ? t.create_copy : (language === 'vi' ? 'Thêm chuyến' : 'Add Trip')}</button>
                  </div>
                </div>
              </div>
            )}

            {/* Batch Create Trips Modal */}
            {showBatchAddTrip && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-[32px] p-8 max-w-2xl w-full space-y-6 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-bold">⚡ {t.batch_add_trips}</h3>
                      <p className="text-sm text-gray-500 mt-1">{language === 'vi' ? 'Chọn ngày và nhiều giờ để tạo nhiều chuyến cùng lúc' : 'Select a date and multiple times to create many trips at once'}</p>
                    </div>
                    <button onClick={() => setShowBatchAddTrip(false)} className="p-2 hover:bg-gray-50 rounded-xl"><X size={20} /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.departure_date}</label><input type="date" value={batchTripForm.date} min={getLocalDateString(0)} onChange={e => {
                      const date = e.target.value;
                      const selectedRoute = routes.find(r => r.name === batchTripForm.route);
                      if (selectedRoute) {
                        const period = getRouteActivePeriod(selectedRoute, date);
                        const price = period ? period.price : selectedRoute.price;
                        const agentPrice = period ? period.agentPrice : (selectedRoute.agentPrice || 0);
                        setBatchTripForm(p => ({ ...p, date, price, agentPrice }));
                      } else {
                        setBatchTripForm(p => ({ ...p, date }));
                      }
                    }} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                    <div className="col-span-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.select_times}</label>
                      <div className="mt-2 space-y-2">
                        {batchTimeSlots.map((slot, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input type="time" value={slot} onChange={e => { const updated = [...batchTimeSlots]; updated[idx] = e.target.value; setBatchTimeSlots(updated); }} className="flex-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" />
                            {batchTimeSlots.length > 1 && (
                              <button onClick={() => setBatchTimeSlots(prev => prev.filter((_, i) => i !== idx))} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                            )}
                          </div>
                        ))}
                        <button onClick={() => setBatchTimeSlots(prev => [...prev, ''])} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-blue-600 hover:bg-blue-50 rounded-xl border border-dashed border-blue-200">
                          <span>+</span> {t.add_time_slot}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.route_name}</label>
                      {batchTripForm.date && (
                        <p className="text-[10px] text-blue-500 mt-0.5 ml-1">
                          {language === 'vi' ? '* Giá hiển thị theo kỳ cao điểm (nếu có), ngày thường dùng giá mặc định' : '* Price shown by peak period (if any), regular dates use default price'}
                        </p>
                      )}
                      <select value={batchTripForm.route} onChange={e => {
                        const routeName = e.target.value;
                        const selectedRoute = routes.find(r => r.name === routeName);
                        if (selectedRoute) {
                          const period = getRouteActivePeriod(selectedRoute, batchTripForm.date);
                          const price = period ? period.price : selectedRoute.price;
                          const agentPrice = period ? period.agentPrice : (selectedRoute.agentPrice || 0);
                          setBatchTripForm(p => ({ ...p, route: routeName, price, agentPrice }));
                        } else {
                          setBatchTripForm(p => ({ ...p, route: routeName }));
                        }
                      }} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none">
                        <option value="">{language === 'vi' ? '-- Chọn tuyến --' : '-- Select Route --'}</option>
                        {routes.filter(r => isRouteValidForDate(r, batchTripForm.date)).map(r => {
                          const period = getRouteActivePeriod(r, batchTripForm.date);
                          return <option key={r.id} value={r.name}>{formatRouteOption(r, period, language)}</option>;
                        })}
                      </select>
                    </div>
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.license_plate} <span className="normal-case font-normal text-gray-400">({language === 'vi' ? 'tùy chọn' : 'optional'})</span></label>
                      <select value={batchTripForm.licensePlate} onChange={e => handleBatchVehicleSelect(e.target.value)} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none">
                        <option value="">{language === 'vi' ? '-- Chọn xe (tùy chọn) --' : '-- Select Vehicle (optional) --'}</option>
                        {vehicles.map(v => <option key={v.id} value={v.licensePlate}>{v.licensePlate} - {v.type} ({v.seats} {t.seats})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.driver}</label>
                      <SearchableSelect
                        options={activeEmployeeNames}
                        value={batchTripForm.driverName}
                        onChange={(val) => setBatchTripForm(p => ({ ...p, driverName: val }))}
                        placeholder={language === 'vi' ? 'Chọn hoặc nhập tên tài xế...' : 'Select or type driver name...'}
                        className="mt-1"
                      />
                    </div>
                    <div className="col-span-2 grid grid-cols-2 gap-4">
                      <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.ticket_price} (đ)</label><input type="number" min="0" value={batchTripForm.price} onChange={e => setBatchTripForm(p => ({ ...p, price: parseInt(e.target.value) || 0 }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                      <div><label className="text-[10px] font-bold text-orange-400 uppercase tracking-widest ml-1">{t.agent_price} (đ)</label><input type="number" min="0" value={batchTripForm.agentPrice} onChange={e => setBatchTripForm(p => ({ ...p, agentPrice: parseInt(e.target.value) || 0 }))} className="w-full mt-1 px-4 py-3 bg-orange-50 border border-orange-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-200" /></div>
                    </div>
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.seats}</label><input type="number" min="1" value={batchTripForm.seatCount} onChange={e => setBatchTripForm(p => ({ ...p, seatCount: parseInt(e.target.value) || 11 }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                  </div>
                  {batchTripForm.date && batchTimeSlots.filter(s => s).length > 0 && (
                    <div className="bg-blue-50 rounded-xl p-4">
                      <p className="text-sm font-bold text-blue-700 mb-2">📋 {t.trips_to_create}: {batchTimeSlots.filter(s => s).length} {language === 'vi' ? 'chuyến' : 'trips'} vào ngày {batchTripForm.date}</p>
                      <div className="flex flex-wrap gap-2">
                        {batchTimeSlots.filter(s => s).map((slot, i) => (
                          <span key={i} className="px-3 py-1 bg-white text-blue-700 text-xs font-bold rounded-full border border-blue-200">{slot}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex justify-end gap-4 pt-2">
                    <button onClick={() => setShowBatchAddTrip(false)} className="px-6 py-3 text-sm font-bold text-gray-400 hover:text-gray-600">{t.cancel}</button>
                    <button onClick={handleBatchAddTrips} disabled={batchTripLoading || !batchTripForm.date || !batchTripForm.route || batchTimeSlots.filter(s => s).length === 0} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center gap-2">
                      {batchTripLoading && <span className="animate-spin">⚡</span>}
                      {language === 'vi' ? `Tạo ${batchTimeSlots.filter(s => s).length} chuyến` : `Create ${batchTimeSlots.filter(s => s).length} Trips`}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Trip Add-ons Management Modal */}
            {showTripAddons && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-[32px] p-8 max-w-lg w-full space-y-6 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-bold">{t.manage_addons}</h3>
                      <p className="text-sm text-gray-500 mt-1">{showTripAddons.time} · {showTripAddons.route}</p>
                    </div>
                    <button onClick={() => { setShowTripAddons(null); setShowAddTripAddon(false); }} className="p-2 hover:bg-gray-50 rounded-xl"><X size={20} /></button>
                  </div>
                  <div className="space-y-3">
                    {(showTripAddons.addons || []).length === 0 && !showAddTripAddon && (
                      <p className="text-sm text-gray-400 text-center py-4">{language === 'vi' ? 'Chưa có dịch vụ kèm theo' : 'No add-on services yet'}</p>
                    )}
                    {(showTripAddons.addons || []).map(addon => (
                      <div key={addon.id} className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm">{addon.name}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{addon.type === 'SIGHTSEEING' ? t.addon_type_sightseeing : addon.type === 'TRANSPORT' ? t.addon_type_transport : addon.type === 'FOOD' ? t.addon_type_food : t.addon_type_other}</span>
                          </div>
                          {addon.description && <p className="text-xs text-gray-500 mt-0.5">{addon.description}</p>}
                          <p className="text-sm font-bold text-daiichi-red mt-1">+{addon.price.toLocaleString()}đ</p>
                        </div>
                        <button onClick={() => handleDeleteTripAddon(addon.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg ml-2"><Trash2 size={16} /></button>
                      </div>
                    ))}
                    {showAddTripAddon ? (
                      <div className="border border-dashed border-gray-200 rounded-xl p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.addon_name}</label><input type="text" value={tripAddonForm.name} onChange={e => setTripAddonForm(p => ({ ...p, name: e.target.value }))} className="w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                          <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.addon_price} (đ)</label><input type="number" min="0" value={tripAddonForm.price} onChange={e => setTripAddonForm(p => ({ ...p, price: parseInt(e.target.value) || 0 }))} className="w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                          <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.addon_type}</label>
                            <select value={tripAddonForm.type} onChange={e => setTripAddonForm(p => ({ ...p, type: e.target.value as any }))} className="w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none">
                              <option value="SIGHTSEEING">{t.addon_type_sightseeing}</option>
                              <option value="TRANSPORT">{t.addon_type_transport}</option>
                              <option value="FOOD">{t.addon_type_food}</option>
                              <option value="OTHER">{t.addon_type_other}</option>
                            </select>
                          </div>
                          <div className="col-span-2"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.addon_desc}</label><input type="text" value={tripAddonForm.description} onChange={e => setTripAddonForm(p => ({ ...p, description: e.target.value }))} className="w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setShowAddTripAddon(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-600">{t.cancel}</button>
                          <button onClick={handleAddTripAddon} disabled={!tripAddonForm.name} className="px-4 py-2 bg-daiichi-red text-white text-sm rounded-xl font-bold disabled:opacity-50">{t.save}</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setShowAddTripAddon(true)} className="w-full py-3 border border-dashed border-gray-200 rounded-xl text-sm font-bold text-gray-400 hover:text-daiichi-red hover:border-daiichi-red transition-colors">+ {t.add_addon}</button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Quick Date Filter Buttons */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: language === 'vi' ? 'Tất cả' : 'All', value: '' },
                { label: language === 'vi' ? 'Hôm nay' : 'Today', value: getLocalDateString(0) },
                { label: language === 'vi' ? 'Ngày mai' : 'Tomorrow', value: getLocalDateString(1) },
                ...Array.from({ length: 5 }, (_, i) => ({
                  label: getOffsetDayLabel(i + 2),
                  value: getLocalDateString(i + 2),
                })),
              ].map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => setTripDateQuickFilter(value)}
                  className={cn('px-3 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap', tripDateQuickFilter === value ? 'bg-daiichi-red text-white border-daiichi-red' : 'bg-white text-gray-600 border-gray-200 hover:border-daiichi-red/40')}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Search bar + Column Toggle */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  value={tripSearch}
                  onChange={e => setTripSearch(e.target.value)}
                  placeholder={language === 'vi' ? 'Tìm kiếm chuyến xe, tuyến, biển số, tài xế...' : 'Search trips by route, plate, driver...'}
                  className="w-full pl-11 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/20 shadow-sm"
                />
                {tripSearch && (
                  <button onClick={() => setTripSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowTripColPanel(v => !v)}
                className={cn('flex items-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm transition-all border whitespace-nowrap', showTripColPanel ? 'bg-daiichi-red text-white border-daiichi-red' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50')}
              >
                <Columns size={16} />
                {language === 'vi' ? 'Tùy chỉnh cột' : 'Columns'}
              </button>
              <button
                onClick={() => setShowTripAdvancedFilter(v => !v)}
                className={cn('flex items-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm transition-all border whitespace-nowrap', showTripAdvancedFilter ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50')}
              >
                <Filter size={16} />
                {language === 'vi' ? 'Lọc nâng cao' : 'Advanced'}
              </button>
            </div>

            {/* Column Visibility Panel */}
            {showTripColPanel && (
              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{language === 'vi' ? 'Hiển thị / ẩn cột' : 'Show / Hide Columns'}</p>
                <div className="flex flex-wrap gap-2">
                  {([
                    { key: 'time', label: language === 'vi' ? 'Giờ khởi hành' : 'Departure Time' },
                    { key: 'licensePlate', label: language === 'vi' ? 'Biển số xe' : 'License Plate' },
                    { key: 'route', label: language === 'vi' ? 'Tuyến' : 'Route' },
                    { key: 'driver', label: language === 'vi' ? 'Tài xế' : 'Driver' },
                    { key: 'status', label: language === 'vi' ? 'Trạng thái' : 'Status' },
                    { key: 'seats', label: language === 'vi' ? 'Ghế còn' : 'Avail. Seats' },
                    { key: 'passengers', label: language === 'vi' ? 'Hành khách' : 'Passengers' },
                    { key: 'addons', label: language === 'vi' ? 'Dịch vụ thêm' : 'Add-ons' },
                  ] as { key: keyof typeof tripColVisibility; label: string }[]).map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setTripColVisibility(prev => ({ ...prev, [key]: !prev[key] }))}
                      className={cn('px-3 py-1.5 rounded-xl text-xs font-bold border transition-all', tripColVisibility[key] ? 'bg-daiichi-red/10 text-daiichi-red border-daiichi-red/20' : 'bg-gray-50 text-gray-400 border-gray-200')}
                    >
                      {tripColVisibility[key] ? '✓ ' : ''}{label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Advanced Filter Panel */}
            {showTripAdvancedFilter && (
              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Lọc nâng cao' : 'Advanced Filters'}</p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">{language === 'vi' ? 'Tuyến đường' : 'Route'}</label>
                    <input type="text" value={tripFilterRoute} onChange={e => setTripFilterRoute(e.target.value)} placeholder={language === 'vi' ? 'Lọc theo tuyến...' : 'Filter by route...'} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">{language === 'vi' ? 'Trạng thái' : 'Status'}</label>
                    <select value={tripFilterStatus} onChange={e => setTripFilterStatus(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none">
                      <option value="ALL">{language === 'vi' ? 'Tất cả' : 'All'}</option>
                      <option value={TripStatus.WAITING}>{language === 'vi' ? 'Chờ khởi hành' : 'Waiting'}</option>
                      <option value={TripStatus.RUNNING}>{language === 'vi' ? 'Đang chạy' : 'Running'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">{language === 'vi' ? 'Từ ngày' : 'From Date'}</label>
                    <input type="date" value={tripFilterDateFrom} onChange={e => setTripFilterDateFrom(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">{language === 'vi' ? 'Đến ngày' : 'To Date'}</label>
                    <input type="date" value={tripFilterDateTo} onChange={e => setTripFilterDateTo(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button onClick={() => { setTripFilterRoute(''); setTripFilterStatus('ALL'); setTripFilterDateFrom(''); setTripFilterDateTo(''); setTripDateQuickFilter(''); }} className="px-4 py-2 text-sm font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl">
                    {language === 'vi' ? 'Xóa bộ lọc' : 'Clear Filters'}
                  </button>
                </div>
              </div>
            )}

            {/* Passenger List Modal */}
            {showTripPassengers && (() => {
              // Pre-compute ticketCode map and group seats by booking
              const seatTicketCodeMap = buildSeatTicketCodeMap(showTripPassengers.id);
              const bookedSeats = (showTripPassengers.seats || []).filter((s: any) => s.status !== SeatStatus.EMPTY);
              const passengerGroups = buildPassengerGroups(showTripPassengers.id, bookedSeats);
              return (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-[32px] w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
                  {/* Header */}
                  <div className="flex justify-between items-start px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
                    <div>
                      <h3 className="text-xl font-bold">{language === 'vi' ? 'Danh sách hành khách' : 'Passenger List'}</h3>
                      <p className="text-sm text-gray-500 mt-1">{showTripPassengers.route} · {formatTripDisplayTime(showTripPassengers)}{showTripPassengers.licensePlate ? ` · ${showTripPassengers.licensePlate}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                      <button
                        onClick={() => setShowPassengerColPanel(v => !v)}
                        className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all', showPassengerColPanel ? 'bg-daiichi-red/10 text-daiichi-red border-daiichi-red/20' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100')}
                        title={language === 'vi' ? 'Tùy chỉnh cột' : 'Customize columns'}
                      >
                        <SlidersHorizontal size={13} />{language === 'vi' ? 'Cột' : 'Columns'}
                      </button>
                      <button onClick={handleClosePassengerModal} className="p-2 hover:bg-gray-50 rounded-xl"><X size={20} /></button>
                    </div>
                  </div>
                  {/* Column visibility panel */}
                  {showPassengerColPanel && (
                    <div className="px-6 py-3 bg-white border-b border-gray-100 flex-shrink-0">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{language === 'vi' ? 'Hiển thị / ẩn cột' : 'Show / Hide Columns'}</p>
                      <div className="flex flex-wrap gap-2">
                        {([
                          { key: 'ticketCode', label: language === 'vi' ? 'Mã vé' : 'Ticket Code' },
                          { key: 'seat', label: language === 'vi' ? 'Ghế' : 'Seat' },
                          { key: 'name', label: language === 'vi' ? 'Tên khách' : 'Name' },
                          { key: 'phone', label: language === 'vi' ? 'Số điện thoại' : 'Phone' },
                          { key: 'pickup', label: language === 'vi' ? 'Điểm đón' : 'Pickup' },
                          { key: 'dropoff', label: language === 'vi' ? 'Điểm trả' : 'Dropoff' },
                          { key: 'status', label: language === 'vi' ? 'Trạng thái' : 'Status' },
                          { key: 'price', label: language === 'vi' ? 'Giá vé' : 'Price' },
                          { key: 'note', label: language === 'vi' ? 'Ghi chú' : 'Note' },
                        ] as { key: keyof typeof passengerColVisibility; label: string }[]).map(({ key, label }) => (
                          <button
                            key={key}
                            onClick={() => setPassengerColVisibility(prev => ({ ...prev, [key]: !prev[key] }))}
                            className={cn('px-3 py-1.5 rounded-xl text-xs font-bold border transition-all', passengerColVisibility[key] ? 'bg-daiichi-red/10 text-daiichi-red border-daiichi-red/20' : 'bg-gray-50 text-gray-400 border-gray-200')}
                          >
                            {passengerColVisibility[key] ? '✓ ' : ''}{label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Seat stats + export buttons */}
                  {(() => {
                    const allSeats = showTripPassengers.seats || [];
                    const booked = allSeats.filter((s: any) => s.status !== SeatStatus.EMPTY);
                    const paid = allSeats.filter((s: any) => s.status === SeatStatus.PAID);
                    const empty = allSeats.filter((s: any) => s.status === SeatStatus.EMPTY);
                    return (
                      <div className="px-6 py-3 bg-gray-50 flex flex-wrap gap-3 items-center flex-shrink-0 border-b border-gray-100">
                        <span className="text-sm font-bold text-gray-700">{language === 'vi' ? 'Tổng' : 'Total'}: {allSeats.length}</span>
                        <span className="text-sm font-bold text-green-600">✓ {language === 'vi' ? 'Đã thanh toán' : 'Paid'}: {paid.length}</span>
                        <span className="text-sm font-bold text-blue-600">◉ {language === 'vi' ? 'Đã đặt' : 'Booked'}: {booked.length - paid.length}</span>
                        <span className="text-sm font-bold text-gray-400">○ {language === 'vi' ? 'Còn trống' : 'Empty'}: {empty.length}</span>
                        <div className="ml-auto flex gap-2">
                          <button onClick={() => exportTripToExcel(showTripPassengers)} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700"><Download size={12} /> Excel</button>
                          <button onClick={() => exportTripToPDF(showTripPassengers)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700"><FileText size={12} /> PDF</button>
                        </div>
                      </div>
                    );
                  })()}
                  {/* Passenger table – one row per booking group */}
                  <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase w-10">STT</th>
                          {passengerColVisibility.ticketCode && <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">{language === 'vi' ? 'Mã vé' : 'Ticket Code'}</th>}
                          {passengerColVisibility.seat && <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">{language === 'vi' ? 'Ghế' : 'Seat'}</th>}
                          {passengerColVisibility.name && <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">{language === 'vi' ? 'Tên khách' : 'Name'}</th>}
                          {passengerColVisibility.phone && <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">{language === 'vi' ? 'Số điện thoại' : 'Phone'}</th>}
                          {passengerColVisibility.pickup && <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">{language === 'vi' ? 'Điểm đón' : 'Pickup'}</th>}
                          {passengerColVisibility.dropoff && <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">{language === 'vi' ? 'Điểm trả' : 'Dropoff'}</th>}
                          {passengerColVisibility.status && <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">{t.status}</th>}
                          {passengerColVisibility.price && <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">{language === 'vi' ? 'Giá vé' : 'Price'}</th>}
                          {passengerColVisibility.note && <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">{language === 'vi' ? 'Ghi chú' : 'Note'}</th>}
                          <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase w-20">{t.options}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {passengerGroups.map((group, idx) => {
                          const primarySeat = group.seats[0];
                          const isGroup = group.seats.length > 1;
                          const seatIds = group.seats.map((s: any) => s.id).join(', ');
                          const ticketCode = group.booking?.ticketCode || seatTicketCodeMap.get(primarySeat.id) || '—';
                          const allPaid = group.seats.every((s: any) => s.status === SeatStatus.PAID);
                          const rowStatus = allPaid ? SeatStatus.PAID : SeatStatus.BOOKED;
                          const totalAmount = group.booking?.amount ?? (showTripPassengers.price || 0) * group.seats.length;
                          const isEditing = editingPassengerSeatId === primarySeat.id;
                          const rowKey = group.booking?.id || `${primarySeat.id}-${idx}`;
                          return isEditing ? (
                            <tr key={rowKey} className="bg-blue-50">
                              <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                              {passengerColVisibility.ticketCode && <td className="px-4 py-3 font-mono text-xs text-gray-500">{ticketCode}</td>}
                              {passengerColVisibility.seat && <td className="px-4 py-3 font-bold">{seatIds}</td>}
                              {passengerColVisibility.name && <td className="px-4 py-3"><input value={passengerEditForm.customerName} onChange={e => setPassengerEditForm(p => ({ ...p, customerName: e.target.value }))} className="w-full px-2 py-1.5 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" /></td>}
                              {passengerColVisibility.phone && <td className="px-4 py-3"><input value={passengerEditForm.customerPhone} onChange={e => setPassengerEditForm(p => ({ ...p, customerPhone: e.target.value }))} className="w-full px-2 py-1.5 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" /></td>}
                              {passengerColVisibility.pickup && <td className="px-4 py-3"><input value={passengerEditForm.pickupAddress} onChange={e => setPassengerEditForm(p => ({ ...p, pickupAddress: e.target.value }))} className="w-full px-2 py-1.5 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" /></td>}
                              {passengerColVisibility.dropoff && <td className="px-4 py-3"><input value={passengerEditForm.dropoffAddress} onChange={e => setPassengerEditForm(p => ({ ...p, dropoffAddress: e.target.value }))} className="w-full px-2 py-1.5 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" /></td>}
                              {passengerColVisibility.status && <td className="px-4 py-3">
                                <select value={passengerEditForm.status} onChange={e => setPassengerEditForm(p => ({ ...p, status: e.target.value as SeatStatus }))} className="px-2 py-1.5 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none">
                                  <option value={SeatStatus.BOOKED}>{language === 'vi' ? 'Đã đặt' : 'Booked'}</option>
                                  <option value={SeatStatus.PAID}>{language === 'vi' ? 'Đã thanh toán' : 'Paid'}</option>
                                </select>
                              </td>}
                              {passengerColVisibility.price && <td className="px-4 py-3 font-bold text-daiichi-red">{totalAmount.toLocaleString()}đ</td>}
                              {passengerColVisibility.note && <td className="px-4 py-3"><input value={passengerEditForm.bookingNote} onChange={e => setPassengerEditForm(p => ({ ...p, bookingNote: e.target.value }))} className="w-full px-2 py-1.5 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" /></td>}
                              <td className="px-4 py-3">
                                <div className="flex gap-1">
                                  <button onClick={handleSavePassengerEdit} className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700">{t.save}</button>
                                  <button onClick={() => setEditingPassengerSeatId(null)} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-200">{t.cancel}</button>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            <tr key={rowKey} className={cn('hover:bg-gray-50', isGroup && 'bg-amber-50/40')}>
                              <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                              {passengerColVisibility.ticketCode && <td className="px-4 py-3 font-mono text-xs font-bold text-daiichi-red">{ticketCode}</td>}
                              {passengerColVisibility.seat && <td className="px-4 py-3 font-bold">
                                {seatIds}
                                {isGroup && <span className="ml-1 text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-bold">👥 {group.seats.length}</span>}
                              </td>}
                              {passengerColVisibility.name && <td className="px-4 py-3 font-medium">{primarySeat.customerName || '—'}</td>}
                              {passengerColVisibility.phone && <td className="px-4 py-3 text-gray-600">{primarySeat.customerPhone || '—'}</td>}
                              {passengerColVisibility.pickup && <td className="px-4 py-3 text-gray-600">{primarySeat.pickupAddress || '—'}</td>}
                              {passengerColVisibility.dropoff && <td className="px-4 py-3 text-gray-600">{primarySeat.dropoffAddress || '—'}</td>}
                              {passengerColVisibility.status && <td className="px-4 py-3">
                                <span className={cn('px-2 py-1 rounded-full text-xs font-bold', rowStatus === SeatStatus.PAID ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700')}>
                                  {rowStatus === SeatStatus.PAID ? (language === 'vi' ? 'Đã TT' : 'Paid') : (language === 'vi' ? 'Đã đặt' : 'Booked')}
                                </span>
                              </td>}
                              {passengerColVisibility.price && <td className="px-4 py-3 font-bold text-daiichi-red">{totalAmount.toLocaleString()}đ</td>}
                              {passengerColVisibility.note && <td className="px-4 py-3 text-gray-500 text-xs max-w-[140px] truncate">{primarySeat.bookingNote || '—'}</td>}
                              <td className="px-4 py-3">
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => {
                                      setEditingPassengerSeatId(primarySeat.id);
                                      setPassengerEditForm({
                                        customerName: primarySeat.customerName || '',
                                        customerPhone: primarySeat.customerPhone || '',
                                        pickupAddress: primarySeat.pickupAddress || '',
                                        dropoffAddress: primarySeat.dropoffAddress || '',
                                        status: rowStatus,
                                        bookingNote: primarySeat.bookingNote || '',
                                      });
                                    }}
                                    className="text-gray-400 hover:text-daiichi-red p-1 rounded"
                                    title={language === 'vi' ? 'Chỉnh sửa' : 'Edit'}
                                  >
                                    <Edit3 size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDeletePassenger(primarySeat.id)}
                                    className="text-gray-400 hover:text-red-600 p-1 rounded"
                                    title={language === 'vi' ? 'Xóa hành khách' : 'Remove passenger'}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {passengerGroups.length === 0 && (
                          <tr><td colSpan={2 + Object.values(passengerColVisibility).filter(Boolean).length} className="px-4 py-10 text-center text-sm text-gray-400">{language === 'vi' ? 'Chưa có hành khách nào' : 'No passengers yet'}</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              );
            })()}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {tripColVisibility.time && <ResizableTh width={tripColWidths.time} onResize={(w) => setTripColWidths(p => ({ ...p, time: w }))} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{t.departure_time}</ResizableTh>}
                    {tripColVisibility.licensePlate && <ResizableTh width={tripColWidths.licensePlate} onResize={(w) => setTripColWidths(p => ({ ...p, licensePlate: w }))} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{t.license_plate}</ResizableTh>}
                    {tripColVisibility.route && <ResizableTh width={tripColWidths.route} onResize={(w) => setTripColWidths(p => ({ ...p, route: w }))} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{t.route_column}</ResizableTh>}
                    {tripColVisibility.driver && <ResizableTh width={tripColWidths.driver} onResize={(w) => setTripColWidths(p => ({ ...p, driver: w }))} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{t.driver}</ResizableTh>}
                    {tripColVisibility.status && <ResizableTh width={tripColWidths.status} onResize={(w) => setTripColWidths(p => ({ ...p, status: w }))} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{t.status}</ResizableTh>}
                    {tripColVisibility.seats && <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{language === 'vi' ? 'Ghế còn' : 'Avail.'}</th>}
                    {tripColVisibility.passengers && <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{language === 'vi' ? 'Hành khách' : 'Passengers'}</th>}
                    {tripColVisibility.addons && <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{t.trip_addons}</th>}
                    <ResizableTh width={tripColWidths.options} onResize={(w) => setTripColWidths(p => ({ ...p, options: w }))} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{t.options}</ResizableTh>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredTrips.map((trip) => {
                    const emptySeats = (trip.seats || []).filter((s: any) => s.status === SeatStatus.EMPTY).length;
                    const bookedCount = (trip.seats || []).filter((s: any) => s.status !== SeatStatus.EMPTY).length;
                    const totalSeats = (trip.seats || []).length;
                    const goToSeatMap = () => { setSelectedTrip(trip); setPreviousTab('operations'); setActiveTab('seat-mapping'); };
                    const openPassengerList = () => { setShowTripPassengers(trip); setEditingPassengerSeatId(null); };
                    return (
                      <tr key={trip.id} className="hover:bg-gray-50 cursor-pointer">
                        {tripColVisibility.time && <td className="px-6 py-4 font-bold whitespace-nowrap" onClick={openPassengerList}>{formatTripDisplayTime(trip)}</td>}
                        {tripColVisibility.licensePlate && <td className="px-6 py-4 font-medium whitespace-nowrap" onClick={openPassengerList}>{trip.licensePlate}</td>}
                        {tripColVisibility.route && <td className="px-6 py-4 overflow-hidden" style={{ maxWidth: tripColWidths.route }} onClick={openPassengerList}>
                          {(() => {
                            const r = routes.find(rt => rt.name === trip.route);
                            return r ? (
                              <div>
                                <p className="font-semibold text-sm text-gray-800 truncate">{r.name}</p>
                                <p className="text-xs text-gray-500 truncate">{r.departurePoint} → {r.arrivalPoint}</p>
                              </div>
                            ) : <span className="text-sm text-gray-500 truncate block">{trip.route}</span>;
                          })()}
                        </td>}
                        {tripColVisibility.driver && <td className="px-6 py-4 text-gray-600 whitespace-nowrap" onClick={openPassengerList}>{trip.driverName}</td>}
                        {tripColVisibility.status && <td className="px-6 py-4" onClick={openPassengerList}><StatusBadge status={trip.status} language={language} /></td>}
                        {tripColVisibility.seats && <td className="px-6 py-4" onClick={openPassengerList}>
                          <div className="flex flex-col gap-0.5">
                            <span className={cn('text-sm font-bold', emptySeats === 0 ? 'text-red-500' : emptySeats <= 3 ? 'text-orange-500' : 'text-green-600')}>{emptySeats}</span>
                            <span className="text-[10px] text-gray-400">{language === 'vi' ? `/${totalSeats} ghế` : `/${totalSeats} seats`}</span>
                          </div>
                        </td>}
                        {tripColVisibility.passengers && <td className="px-6 py-4">
                          <button
                            onClick={openPassengerList}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            <Users size={12} />
                            <span>{bookedCount}</span>
                          </button>
                        </td>}
                        {tripColVisibility.addons && <td className="px-6 py-4">
                          <button onClick={() => { setShowTripAddons({ ...trip }); setShowAddTripAddon(false); setTripAddonForm({ name: '', price: 0, description: '', type: 'OTHER' }); }} className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg hover:bg-blue-100 transition-colors">
                            <span>{(trip.addons || []).length}</span>
                            <span>{t.manage_addons}</span>
                          </button>
                        </td>}
                        <td className="px-6 py-4"><div className="flex gap-3 items-center"><button onClick={() => exportTripToExcel(trip)} title={language === 'vi' ? 'Xuất Excel' : 'Export Excel'} className="text-green-600 hover:text-green-700 hover:bg-green-50 p-1 rounded"><Download size={16} /></button><button onClick={() => exportTripToPDF(trip)} title={language === 'vi' ? 'Xuất PDF' : 'Export PDF'} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-1 rounded"><FileText size={16} /></button><button onClick={() => handleCopyTrip(trip)} title={t.copy_trip} className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 p-1 rounded"><Copy size={16} /></button><button onClick={() => handleStartEditTrip(trip)} className="text-gray-600 hover:text-daiichi-red"><Edit3 size={18} /></button><button onClick={() => handleDeleteTrip(trip.id)} className="text-gray-600 hover:text-red-600"><Trash2 size={18} /></button><NotePopover note={trip.note} onSave={(note) => handleSaveTripNote(trip.id, note)} language={language} /><button onClick={goToSeatMap} className="text-daiichi-red hover:underline font-bold text-sm">{t.view_seats}</button></div></td>
                      </tr>
                    );
                  })}
                  {filteredTrips.length === 0 && (
                    <tr><td colSpan={Object.values(tripColVisibility).filter(Boolean).length + 1} className="px-6 py-10 text-center text-sm text-gray-400">{t.no_trips_found}</td></tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        );
      }

      case 'tour-management':
        return <TourManagement language={language} />;

      case 'completed-trips': {
        const completedTrips = trips.filter(trip => {
          if (trip.status !== TripStatus.COMPLETED) return false;
          if (completedTripDateQuickFilter && trip.date !== completedTripDateQuickFilter) return false;
          if (completedTripFilterRoute && !(trip.route || '').toLowerCase().includes(completedTripFilterRoute.toLowerCase())) return false;
          if (completedTripFilterDateFrom && trip.date && trip.date < completedTripFilterDateFrom) return false;
          if (completedTripFilterDateTo && trip.date && trip.date > completedTripFilterDateTo) return false;
          if (!tripSearch) return true;
          const q = tripSearch.toLowerCase();
          return (
            (trip.time || '').toLowerCase().includes(q) ||
            (trip.route || '').toLowerCase().includes(q) ||
            (trip.licensePlate || '').toLowerCase().includes(q) ||
            (trip.driverName || '').toLowerCase().includes(q)
          );
        }).sort((a, b) => compareTripDateTime(b, a));
        return (
          <div className="space-y-6">
            {/* Passenger List Modal */}
            {showTripPassengers && (() => {
              const seatTicketCodeMap = buildSeatTicketCodeMap(showTripPassengers.id);
              const bookedSeats = (showTripPassengers.seats || []).filter((s: any) => s.status !== SeatStatus.EMPTY);
              const passengerGroups = buildPassengerGroups(showTripPassengers.id, bookedSeats);
              return (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-[32px] w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
                  <div className="flex justify-between items-start px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
                    <div>
                      <h3 className="text-xl font-bold">{language === 'vi' ? 'Danh sách hành khách' : 'Passenger List'}</h3>
                      <p className="text-sm text-gray-500 mt-1">{showTripPassengers.route} · {formatTripDisplayTime(showTripPassengers)}{showTripPassengers.licensePlate ? ` · ${showTripPassengers.licensePlate}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                      <button onClick={() => setShowPassengerColPanel(v => !v)} className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all', showPassengerColPanel ? 'bg-daiichi-red/10 text-daiichi-red border-daiichi-red/20' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100')} title={language === 'vi' ? 'Tùy chỉnh cột' : 'Customize columns'}><SlidersHorizontal size={13} />{language === 'vi' ? 'Cột' : 'Columns'}</button>
                      <button onClick={handleClosePassengerModal} className="p-2 hover:bg-gray-50 rounded-xl"><X size={20} /></button>
                    </div>
                  </div>
                  {showPassengerColPanel && (
                    <div className="px-6 py-3 bg-white border-b border-gray-100 flex-shrink-0">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{language === 'vi' ? 'Hiển thị / ẩn cột' : 'Show / Hide Columns'}</p>
                      <div className="flex flex-wrap gap-2">
                        {([
                          { key: 'ticketCode', label: language === 'vi' ? 'Mã vé' : 'Ticket Code' },
                          { key: 'seat', label: language === 'vi' ? 'Ghế' : 'Seat' },
                          { key: 'name', label: language === 'vi' ? 'Tên khách' : 'Name' },
                          { key: 'phone', label: language === 'vi' ? 'Số điện thoại' : 'Phone' },
                          { key: 'pickup', label: language === 'vi' ? 'Điểm đón' : 'Pickup' },
                          { key: 'dropoff', label: language === 'vi' ? 'Điểm trả' : 'Dropoff' },
                          { key: 'status', label: language === 'vi' ? 'Trạng thái' : 'Status' },
                          { key: 'price', label: language === 'vi' ? 'Giá vé' : 'Price' },
                          { key: 'note', label: language === 'vi' ? 'Ghi chú' : 'Note' },
                        ] as { key: keyof typeof passengerColVisibility; label: string }[]).map(({ key, label }) => (
                          <button key={key} onClick={() => setPassengerColVisibility(prev => ({ ...prev, [key]: !prev[key] }))} className={cn('px-3 py-1.5 rounded-xl text-xs font-bold border transition-all', passengerColVisibility[key] ? 'bg-daiichi-red/10 text-daiichi-red border-daiichi-red/20' : 'bg-gray-50 text-gray-400 border-gray-200')}>{passengerColVisibility[key] ? '✓ ' : ''}{label}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  {(() => {
                    const allSeats = showTripPassengers.seats || [];
                    const booked = allSeats.filter((s: any) => s.status !== SeatStatus.EMPTY);
                    const paid = allSeats.filter((s: any) => s.status === SeatStatus.PAID);
                    const empty = allSeats.filter((s: any) => s.status === SeatStatus.EMPTY);
                    return (
                      <div className="px-6 py-3 bg-gray-50 flex flex-wrap gap-3 items-center flex-shrink-0 border-b border-gray-100">
                        <span className="text-sm font-bold text-gray-700">{language === 'vi' ? 'Tổng' : 'Total'}: {allSeats.length}</span>
                        <span className="text-sm font-bold text-green-600">✓ {language === 'vi' ? 'Đã thanh toán' : 'Paid'}: {paid.length}</span>
                        <span className="text-sm font-bold text-blue-600">◉ {language === 'vi' ? 'Đã đặt' : 'Booked'}: {booked.length - paid.length}</span>
                        <span className="text-sm font-bold text-gray-400">○ {language === 'vi' ? 'Còn trống' : 'Empty'}: {empty.length}</span>
                        <div className="ml-auto flex gap-2">
                          <button onClick={() => exportTripToExcel(showTripPassengers)} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700"><Download size={12} /> Excel</button>
                          <button onClick={() => exportTripToPDF(showTripPassengers)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700"><FileText size={12} /> PDF</button>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase w-10">STT</th>
                          {passengerColVisibility.ticketCode && <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">{language === 'vi' ? 'Mã vé' : 'Ticket Code'}</th>}
                          {passengerColVisibility.seat && <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">{language === 'vi' ? 'Ghế' : 'Seat'}</th>}
                          {passengerColVisibility.name && <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">{language === 'vi' ? 'Tên khách' : 'Name'}</th>}
                          {passengerColVisibility.phone && <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">{language === 'vi' ? 'Số điện thoại' : 'Phone'}</th>}
                          {passengerColVisibility.pickup && <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">{language === 'vi' ? 'Điểm đón' : 'Pickup'}</th>}
                          {passengerColVisibility.dropoff && <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">{language === 'vi' ? 'Điểm trả' : 'Dropoff'}</th>}
                          {passengerColVisibility.status && <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">{t.status}</th>}
                          {passengerColVisibility.price && <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">{language === 'vi' ? 'Giá vé' : 'Price'}</th>}
                          {passengerColVisibility.note && <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">{language === 'vi' ? 'Ghi chú' : 'Note'}</th>}
                          <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase w-20">{t.options}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {passengerGroups.map((group, idx) => {
                          const primarySeat = group.seats[0];
                          const isGroup = group.seats.length > 1;
                          const seatIds = group.seats.map((s: any) => s.id).join(', ');
                          const ticketCode = group.booking?.ticketCode || seatTicketCodeMap.get(primarySeat.id) || '—';
                          const allPaid = group.seats.every((s: any) => s.status === SeatStatus.PAID);
                          const rowStatus = allPaid ? SeatStatus.PAID : SeatStatus.BOOKED;
                          const totalAmount = group.booking?.amount ?? (showTripPassengers.price || 0) * group.seats.length;
                          const isEditing = editingPassengerSeatId === primarySeat.id;
                          const rowKey = group.booking?.id || `${primarySeat.id}-${idx}`;
                          return isEditing ? (
                            <tr key={rowKey} className="bg-blue-50">
                              <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                              {passengerColVisibility.ticketCode && <td className="px-4 py-3 font-mono text-xs text-gray-500">{ticketCode}</td>}
                              {passengerColVisibility.seat && <td className="px-4 py-3 font-bold">{seatIds}</td>}
                              {passengerColVisibility.name && <td className="px-4 py-3"><input value={passengerEditForm.customerName} onChange={e => setPassengerEditForm(p => ({ ...p, customerName: e.target.value }))} className="w-full px-2 py-1.5 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" /></td>}
                              {passengerColVisibility.phone && <td className="px-4 py-3"><input value={passengerEditForm.customerPhone} onChange={e => setPassengerEditForm(p => ({ ...p, customerPhone: e.target.value }))} className="w-full px-2 py-1.5 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" /></td>}
                              {passengerColVisibility.pickup && <td className="px-4 py-3"><input value={passengerEditForm.pickupAddress} onChange={e => setPassengerEditForm(p => ({ ...p, pickupAddress: e.target.value }))} className="w-full px-2 py-1.5 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" /></td>}
                              {passengerColVisibility.dropoff && <td className="px-4 py-3"><input value={passengerEditForm.dropoffAddress} onChange={e => setPassengerEditForm(p => ({ ...p, dropoffAddress: e.target.value }))} className="w-full px-2 py-1.5 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" /></td>}
                              {passengerColVisibility.status && <td className="px-4 py-3"><select value={passengerEditForm.status} onChange={e => setPassengerEditForm(p => ({ ...p, status: e.target.value as SeatStatus }))} className="px-2 py-1.5 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none"><option value={SeatStatus.BOOKED}>{language === 'vi' ? 'Đã đặt' : 'Booked'}</option><option value={SeatStatus.PAID}>{language === 'vi' ? 'Đã thanh toán' : 'Paid'}</option></select></td>}
                              {passengerColVisibility.price && <td className="px-4 py-3 font-bold text-daiichi-red">{totalAmount.toLocaleString()}đ</td>}
                              {passengerColVisibility.note && <td className="px-4 py-3"><input value={passengerEditForm.bookingNote} onChange={e => setPassengerEditForm(p => ({ ...p, bookingNote: e.target.value }))} className="w-full px-2 py-1.5 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" /></td>}
                              <td className="px-4 py-3"><div className="flex gap-1"><button onClick={handleSavePassengerEdit} className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700">{t.save}</button><button onClick={() => setEditingPassengerSeatId(null)} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-200">{t.cancel}</button></div></td>
                            </tr>
                          ) : (
                            <tr key={rowKey} className={cn('hover:bg-gray-50', isGroup && 'bg-amber-50/40')}>
                              <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                              {passengerColVisibility.ticketCode && <td className="px-4 py-3 font-mono text-xs font-bold text-daiichi-red">{ticketCode}</td>}
                              {passengerColVisibility.seat && <td className="px-4 py-3 font-bold">{seatIds}{isGroup && <span className="ml-1 text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-bold">👥 {group.seats.length}</span>}</td>}
                              {passengerColVisibility.name && <td className="px-4 py-3 font-medium">{primarySeat.customerName || '—'}</td>}
                              {passengerColVisibility.phone && <td className="px-4 py-3 text-gray-600">{primarySeat.customerPhone || '—'}</td>}
                              {passengerColVisibility.pickup && <td className="px-4 py-3 text-gray-600">{primarySeat.pickupAddress || '—'}</td>}
                              {passengerColVisibility.dropoff && <td className="px-4 py-3 text-gray-600">{primarySeat.dropoffAddress || '—'}</td>}
                              {passengerColVisibility.status && <td className="px-4 py-3"><span className={cn('px-2 py-1 rounded-full text-xs font-bold', rowStatus === SeatStatus.PAID ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700')}>{rowStatus === SeatStatus.PAID ? (language === 'vi' ? 'Đã TT' : 'Paid') : (language === 'vi' ? 'Đã đặt' : 'Booked')}</span></td>}
                              {passengerColVisibility.price && <td className="px-4 py-3 font-bold text-daiichi-red">{totalAmount.toLocaleString()}đ</td>}
                              {passengerColVisibility.note && <td className="px-4 py-3 text-gray-500 text-xs max-w-[140px] truncate">{primarySeat.bookingNote || '—'}</td>}
                              <td className="px-4 py-3"><div className="flex gap-1"><button onClick={() => { setEditingPassengerSeatId(primarySeat.id); setPassengerEditForm({ customerName: primarySeat.customerName || '', customerPhone: primarySeat.customerPhone || '', pickupAddress: primarySeat.pickupAddress || '', dropoffAddress: primarySeat.dropoffAddress || '', status: rowStatus, bookingNote: primarySeat.bookingNote || '' }); }} className="text-gray-400 hover:text-daiichi-red p-1 rounded" title={language === 'vi' ? 'Chỉnh sửa' : 'Edit'}><Edit3 size={14} /></button><button onClick={() => handleDeletePassenger(primarySeat.id)} className="text-gray-400 hover:text-red-600 p-1 rounded" title={language === 'vi' ? 'Xóa hành khách' : 'Remove passenger'}><Trash2 size={14} /></button></div></td>
                            </tr>
                          );
                        })}
                        {passengerGroups.length === 0 && (
                          <tr><td colSpan={2 + Object.values(passengerColVisibility).filter(Boolean).length} className="px-4 py-10 text-center text-sm text-gray-400">{language === 'vi' ? 'Chưa có hành khách nào' : 'No passengers yet'}</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              );
            })()}

            {/* Trip Add-ons Management Modal */}
            {showTripAddons && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-[32px] p-8 max-w-lg w-full space-y-6 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-bold">{t.manage_addons}</h3>
                      <p className="text-sm text-gray-500 mt-1">{showTripAddons.time} · {showTripAddons.route}</p>
                    </div>
                    <button onClick={() => { setShowTripAddons(null); setShowAddTripAddon(false); }} className="p-2 hover:bg-gray-50 rounded-xl"><X size={20} /></button>
                  </div>
                  <div className="space-y-3">
                    {(showTripAddons.addons || []).length === 0 && !showAddTripAddon && (
                      <p className="text-sm text-gray-400 text-center py-4">{language === 'vi' ? 'Chưa có dịch vụ kèm theo' : 'No add-on services yet'}</p>
                    )}
                    {(showTripAddons.addons || []).map(addon => (
                      <div key={addon.id} className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm">{addon.name}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{addon.type === 'SIGHTSEEING' ? t.addon_type_sightseeing : addon.type === 'TRANSPORT' ? t.addon_type_transport : addon.type === 'FOOD' ? t.addon_type_food : t.addon_type_other}</span>
                          </div>
                          {addon.description && <p className="text-xs text-gray-500 mt-0.5">{addon.description}</p>}
                          <p className="text-sm font-bold text-daiichi-red mt-1">+{addon.price.toLocaleString()}đ</p>
                        </div>
                        <button onClick={() => handleDeleteTripAddon(addon.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg ml-2"><Trash2 size={16} /></button>
                      </div>
                    ))}
                    {showAddTripAddon ? (
                      <div className="border border-dashed border-gray-200 rounded-xl p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.addon_name}</label><input type="text" value={tripAddonForm.name} onChange={e => setTripAddonForm(p => ({ ...p, name: e.target.value }))} className="w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                          <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.addon_price} (đ)</label><input type="number" min="0" value={tripAddonForm.price} onChange={e => setTripAddonForm(p => ({ ...p, price: parseInt(e.target.value) || 0 }))} className="w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                          <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.addon_type}</label>
                            <select value={tripAddonForm.type} onChange={e => setTripAddonForm(p => ({ ...p, type: e.target.value as any }))} className="w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none">
                              <option value="SIGHTSEEING">{t.addon_type_sightseeing}</option>
                              <option value="TRANSPORT">{t.addon_type_transport}</option>
                              <option value="FOOD">{t.addon_type_food}</option>
                              <option value="OTHER">{t.addon_type_other}</option>
                            </select>
                          </div>
                          <div className="col-span-2"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.addon_desc}</label><input type="text" value={tripAddonForm.description} onChange={e => setTripAddonForm(p => ({ ...p, description: e.target.value }))} className="w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setShowAddTripAddon(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-600">{t.cancel}</button>
                          <button onClick={handleAddTripAddon} disabled={!tripAddonForm.name} className="px-4 py-2 bg-daiichi-red text-white text-sm rounded-xl font-bold disabled:opacity-50">{t.save}</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setShowAddTripAddon(true)} className="w-full py-3 border border-dashed border-gray-200 rounded-xl text-sm font-bold text-gray-400 hover:text-daiichi-red hover:border-daiichi-red transition-colors">+ {t.add_addon}</button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">{language === 'vi' ? 'Chuyến xe đã hoàn thành' : 'Completed Trips'}</h2>
                <p className="text-sm text-gray-500">{language === 'vi' ? 'Các chuyến đã kết thúc hoặc đã hoàn thành' : 'Trips that have ended or been completed'}</p>
              </div>
            </div>

            {/* Quick Date Filter Buttons */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: language === 'vi' ? 'Tất cả' : 'All', value: '' },
                { label: language === 'vi' ? 'Hôm nay' : 'Today', value: getLocalDateString(0) },
                { label: language === 'vi' ? 'Hôm qua' : 'Yesterday', value: getLocalDateString(-1) },
                ...Array.from({ length: 5 }, (_, i) => ({
                  label: getOffsetDayLabel(-i - 2),
                  value: getLocalDateString(-i - 2),
                })),
              ].map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => setCompletedTripDateQuickFilter(value)}
                  className={cn('px-3 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap', completedTripDateQuickFilter === value ? 'bg-daiichi-red text-white border-daiichi-red' : 'bg-white text-gray-600 border-gray-200 hover:border-daiichi-red/40')}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Search bar + Advanced Filter Toggle */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  value={tripSearch}
                  onChange={e => setTripSearch(e.target.value)}
                  placeholder={language === 'vi' ? 'Tìm kiếm chuyến xe, tuyến, biển số, tài xế...' : 'Search trips by route, plate, driver...'}
                  className="w-full pl-11 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/20 shadow-sm"
                />
                {tripSearch && (
                  <button onClick={() => setTripSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>
                )}
              </div>
              <button
                onClick={() => setShowCompletedTripAdvancedFilter(v => !v)}
                className={cn('flex items-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm transition-all border whitespace-nowrap', showCompletedTripAdvancedFilter ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50')}
              >
                <Filter size={16} />
                {language === 'vi' ? 'Lọc nâng cao' : 'Advanced'}
              </button>
            </div>

            {/* Advanced Filter Panel */}
            {showCompletedTripAdvancedFilter && (
              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Lọc nâng cao' : 'Advanced Filters'}</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">{language === 'vi' ? 'Tuyến đường' : 'Route'}</label>
                    <input type="text" value={completedTripFilterRoute} onChange={e => setCompletedTripFilterRoute(e.target.value)} placeholder={language === 'vi' ? 'Lọc theo tuyến...' : 'Filter by route...'} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">{language === 'vi' ? 'Từ ngày' : 'From Date'}</label>
                    <input type="date" value={completedTripFilterDateFrom} onChange={e => setCompletedTripFilterDateFrom(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">{language === 'vi' ? 'Đến ngày' : 'To Date'}</label>
                    <input type="date" value={completedTripFilterDateTo} onChange={e => setCompletedTripFilterDateTo(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button onClick={() => { setCompletedTripFilterRoute(''); setCompletedTripFilterDateFrom(''); setCompletedTripFilterDateTo(''); setCompletedTripDateQuickFilter(''); }} className="px-4 py-2 text-sm font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl">
                    {language === 'vi' ? 'Xóa bộ lọc' : 'Clear Filters'}
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {tripColVisibility.time && <ResizableTh width={tripColWidths.time} onResize={(w) => setTripColWidths(p => ({ ...p, time: w }))} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{t.departure_time}</ResizableTh>}
                      {tripColVisibility.licensePlate && <ResizableTh width={tripColWidths.licensePlate} onResize={(w) => setTripColWidths(p => ({ ...p, licensePlate: w }))} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{t.license_plate}</ResizableTh>}
                      {tripColVisibility.route && <ResizableTh width={tripColWidths.route} onResize={(w) => setTripColWidths(p => ({ ...p, route: w }))} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{t.route_column}</ResizableTh>}
                      {tripColVisibility.driver && <ResizableTh width={tripColWidths.driver} onResize={(w) => setTripColWidths(p => ({ ...p, driver: w }))} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{t.driver}</ResizableTh>}
                      {tripColVisibility.seats && <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{language === 'vi' ? 'Ghế đã đặt' : 'Booked'}</th>}
                      {tripColVisibility.passengers && <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{language === 'vi' ? 'Hành khách' : 'Passengers'}</th>}
                      {tripColVisibility.addons && <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{t.trip_addons}</th>}
                      <ResizableTh width={tripColWidths.options} onResize={(w) => setTripColWidths(p => ({ ...p, options: w }))} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{t.options}</ResizableTh>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {completedTrips.map((trip) => {
                      const bookedSeats = (trip.seats || []).filter((s: any) => s.status !== SeatStatus.EMPTY);
                      const bookedCount = bookedSeats.length;
                      const totalSeats = (trip.seats || []).length;
                      const openPassengerList = () => { setShowTripPassengers(trip); setEditingPassengerSeatId(null); };
                      return (
                        <tr key={trip.id} className="hover:bg-gray-50 cursor-pointer">
                          {tripColVisibility.time && <td className="px-6 py-4 font-bold whitespace-nowrap" onClick={openPassengerList}>{formatTripDisplayTime(trip)}</td>}
                          {tripColVisibility.licensePlate && <td className="px-6 py-4 font-medium whitespace-nowrap" onClick={openPassengerList}>{trip.licensePlate}</td>}
                          {tripColVisibility.route && <td className="px-6 py-4 overflow-hidden" style={{ maxWidth: tripColWidths.route }} onClick={openPassengerList}>
                            {(() => {
                              const r = routes.find(rt => rt.name === trip.route);
                              return r ? (
                                <div>
                                  <p className="font-semibold text-sm text-gray-800 truncate">{r.name}</p>
                                  <p className="text-xs text-gray-500 truncate">{r.departurePoint} → {r.arrivalPoint}</p>
                                </div>
                              ) : <span className="text-sm text-gray-500 truncate block">{trip.route}</span>;
                            })()}
                          </td>}
                          {tripColVisibility.driver && <td className="px-6 py-4 text-gray-600 whitespace-nowrap" onClick={openPassengerList}>{trip.driverName}</td>}
                          {tripColVisibility.seats && <td className="px-6 py-4" onClick={openPassengerList}>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-sm font-bold text-gray-700">{bookedCount}</span>
                              <span className="text-[10px] text-gray-400">{language === 'vi' ? `/${totalSeats} ghế` : `/${totalSeats} seats`}</span>
                            </div>
                          </td>}
                          {tripColVisibility.passengers && <td className="px-6 py-4">
                            <button onClick={openPassengerList} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200 transition-colors">
                              <Users size={12} />
                              <span>{bookedCount}</span>
                            </button>
                          </td>}
                          {tripColVisibility.addons && <td className="px-6 py-4">
                            <button onClick={() => { setShowTripAddons({ ...trip }); setShowAddTripAddon(false); setTripAddonForm({ name: '', price: 0, description: '', type: 'OTHER' }); }} className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg hover:bg-blue-100 transition-colors">
                              <span>{(trip.addons || []).length}</span>
                              <span>{t.manage_addons}</span>
                            </button>
                          </td>}
                          <td className="px-6 py-4"><div className="flex gap-3 items-center"><button onClick={() => exportTripToExcel(trip)} title={language === 'vi' ? 'Xuất Excel' : 'Export Excel'} className="text-green-600 hover:text-green-700 hover:bg-green-50 p-1 rounded"><Download size={16} /></button><button onClick={() => exportTripToPDF(trip)} title={language === 'vi' ? 'Xuất PDF' : 'Export PDF'} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-1 rounded"><FileText size={16} /></button><button onClick={() => handleCopyTrip(trip)} title={t.copy_trip} className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 p-1 rounded"><Copy size={16} /></button><button onClick={() => handleStartEditTrip(trip)} className="text-gray-600 hover:text-daiichi-red"><Edit3 size={18} /></button><button onClick={() => handleDeleteTrip(trip.id)} className="text-gray-600 hover:text-red-600"><Trash2 size={18} /></button><NotePopover note={trip.note} onSave={(note) => handleSaveTripNote(trip.id, note)} language={language} /><button onClick={() => { setSelectedTrip(trip); setPreviousTab('completed-trips'); setActiveTab('seat-mapping'); }} className="text-daiichi-red hover:underline font-bold text-sm">{t.view_seats}</button></div></td>
                        </tr>
                      );
                    })}
                    {completedTrips.length === 0 && (
                      <tr><td colSpan={['time','licensePlate','route','driver','seats','passengers','addons'].filter(k => tripColVisibility[k as keyof typeof tripColVisibility]).length + 1} className="px-6 py-10 text-center text-sm text-gray-400">{language === 'vi' ? 'Chưa có chuyến nào hoàn thành' : 'No completed trips yet'}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      }

      case 'stop-management':
        return <StopManagement language={language} stops={stops} onUpdateStops={setStops} />;

      case 'financial-report':
        return <FinancialReport language={language} agents={agents} bookings={bookings} invoices={invoices} />;

      case 'payment-management':
        return (
          <PaymentManagement
            language={language}
            bookings={bookings}
            agents={agents}
            currentUser={currentUser}
          />
        );

      case 'consignments': {
        const filteredConsignments = consignments.filter(c => {
          const searchOk = !consignmentSearch ||
            (c.sender || c.senderName || '').toLowerCase().includes(consignmentSearch.toLowerCase()) ||
            (c.receiver || c.receiverName || '').toLowerCase().includes(consignmentSearch.toLowerCase()) ||
            c.id.toLowerCase().includes(consignmentSearch.toLowerCase());
          const statusOk = consignmentStatusFilter === 'ALL' || c.status === consignmentStatusFilter;
          const dateOk = (() => {
            if (!consignmentDateFrom && !consignmentDateTo) return true;
            const d = c.createdAt?.toDate ? c.createdAt.toDate() : (c.createdAt ? new Date(c.createdAt) : null);
            if (!d) return true;
            if (consignmentDateFrom && d < new Date(consignmentDateFrom)) return false;
            if (consignmentDateTo) {
              const toDate = new Date(consignmentDateTo);
              toDate.setHours(23, 59, 59, 999);
              if (d > toDate) return false;
            }
            return true;
          })();
          return searchOk && statusOk && dateOk;
        });

        const statusColorMap: Record<string, string> = {
          DELIVERED: 'bg-green-100 text-green-600',
          PICKED_UP: 'bg-blue-100 text-blue-600',
          PENDING: 'bg-yellow-100 text-yellow-600',
        };
        const statusLabelMap: Record<string, string> = {
          DELIVERED: t.filter_delivered || 'Delivered',
          PICKED_UP: t.filter_picked_up || 'In Transit',
          PENDING: t.filter_pending || 'Pending',
        };

        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">{t.consignment_title}</h2>
              <button onClick={() => setShowCreateConsignment(true)} className="bg-daiichi-red text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-daiichi-red/20">+ {t.create_bill}</button>
            </div>

            {/* Advanced Search Bar */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    value={consignmentSearch}
                    onChange={e => setConsignmentSearch(e.target.value)}
                    placeholder={t.search_sender_receiver || 'Search by sender/receiver...'}
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
                  />
                </div>
                <button
                  onClick={() => setShowConsignmentFilters(v => !v)}
                  className={cn("flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all border", showConsignmentFilters ? "bg-daiichi-red text-white border-daiichi-red" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50")}
                >
                  <Filter size={16} />
                  {t.advanced_search || 'Advanced'}
                </button>
                {(consignmentSearch || consignmentStatusFilter !== 'ALL' || consignmentDateFrom || consignmentDateTo) && (
                  <button
                    onClick={() => { setConsignmentSearch(''); setConsignmentStatusFilter('ALL'); setConsignmentDateFrom(''); setConsignmentDateTo(''); }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-500 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all"
                  >
                    <X size={14} />
                    {t.reset_filter || 'Reset'}
                  </button>
                )}
              </div>

              {/* Expanded Filters */}
              {showConsignmentFilters && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-gray-100">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">{t.status}</label>
                    <select value={consignmentStatusFilter} onChange={e => setConsignmentStatusFilter(e.target.value as any)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none">
                      <option value="ALL">{t.filter_status_all || 'All statuses'}</option>
                      <option value="PENDING">{t.filter_pending || 'Pending'}</option>
                      <option value="PICKED_UP">{t.filter_picked_up || 'In Transit'}</option>
                      <option value="DELIVERED">{t.filter_delivered || 'Delivered'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">{t.date_from || 'From Date'}</label>
                    <input type="date" value={consignmentDateFrom} onChange={e => setConsignmentDateFrom(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">{t.date_to || 'To Date'}</label>
                    <input type="date" value={consignmentDateTo} onChange={e => setConsignmentDateTo(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none" />
                  </div>
                </motion.div>
              )}

              <p className="text-xs text-gray-400">
                {filteredConsignments.length} / {consignments.length} {language === 'vi' ? 'đơn hàng' : language === 'en' ? 'orders' : '注文'}
              </p>
            </div>

            <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <ResizableTh width={consignMgmtColWidths.code} onResize={(w) => setConsignMgmtColWidths(p => ({ ...p, code: w }))} className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.consignment_code || 'Code'}</ResizableTh>
                    <ResizableTh width={consignMgmtColWidths.sender} onResize={(w) => setConsignMgmtColWidths(p => ({ ...p, sender: w }))} className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.sender}</ResizableTh>
                    <ResizableTh width={consignMgmtColWidths.receiver} onResize={(w) => setConsignMgmtColWidths(p => ({ ...p, receiver: w }))} className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.receiver}</ResizableTh>
                    <ResizableTh width={consignMgmtColWidths.goodsType} onResize={(w) => setConsignMgmtColWidths(p => ({ ...p, goodsType: w }))} className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.goods_type}</ResizableTh>
                    <ResizableTh width={consignMgmtColWidths.weight} onResize={(w) => setConsignMgmtColWidths(p => ({ ...p, weight: w }))} className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.weight}</ResizableTh>
                    <ResizableTh width={consignMgmtColWidths.cod} onResize={(w) => setConsignMgmtColWidths(p => ({ ...p, cod: w }))} className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.cod}</ResizableTh>
                    <ResizableTh width={consignMgmtColWidths.notes} onResize={(w) => setConsignMgmtColWidths(p => ({ ...p, notes: w }))} className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Ghi chú' : 'Notes'}</ResizableTh>
                    <ResizableTh width={consignMgmtColWidths.status} onResize={(w) => setConsignMgmtColWidths(p => ({ ...p, status: w }))} className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.status}</ResizableTh>
                    <ResizableTh width={consignMgmtColWidths.options} onResize={(w) => setConsignMgmtColWidths(p => ({ ...p, options: w }))} className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.options}</ResizableTh>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredConsignments.length === 0 ? (
                    <tr><td colSpan={9} className="px-8 py-12 text-center text-gray-400 text-sm">
                      {language === 'vi' ? 'Không tìm thấy đơn hàng' : language === 'en' ? 'No orders found' : '注文が見つかりません'}
                    </td></tr>
                  ) : filteredConsignments.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-5 font-bold text-daiichi-red text-sm">{(c.id.length >= 8 ? c.id.slice(-8) : c.id).toUpperCase()}</td>
                      <td className="px-6 py-5">
                        <p className="font-bold text-gray-800 text-sm">{c.sender || c.senderName}</p>
                        {c.senderPhone && <p className="text-xs text-gray-400">{c.senderPhone}</p>}
                      </td>
                      <td className="px-6 py-5">
                        <p className="font-bold text-gray-800 text-sm">{c.receiver || c.receiverName}</p>
                        {c.receiverPhone && <p className="text-xs text-gray-400">{c.receiverPhone}</p>}
                      </td>
                      <td className="px-6 py-5 text-sm text-gray-600">{c.type || '—'}</td>
                      <td className="px-6 py-5 text-sm text-gray-600">{c.weight || '—'}</td>
                      <td className="px-6 py-5 font-bold text-gray-700">{c.cod ? c.cod.toLocaleString() + 'đ' : '—'}</td>
                      <td className="px-6 py-5 text-sm text-gray-500 max-w-[160px] truncate">{c.notes || '—'}</td>
                      <td className="px-6 py-5">
                        <span className={cn("px-3 py-1 rounded-full text-[10px] font-bold uppercase", statusColorMap[c.status] || 'bg-gray-100 text-gray-600')}>
                          {statusLabelMap[c.status] || c.status}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex gap-3">
                          <button onClick={() => handleStartEditConsignment(c)} className="text-gray-600 hover:text-daiichi-red"><Edit3 size={18} /></button>
                          <button onClick={() => handleDeleteConsignment(c.id)} className="text-gray-600 hover:text-red-600"><Trash2 size={18} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>

          {/* Create Consignment Modal */}
          {showCreateConsignment && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-[32px] p-8 max-w-xl w-full space-y-6 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold">{t.create_bill}</h3>
                  <button onClick={() => setShowCreateConsignment(false)} className="p-2 hover:bg-gray-50 rounded-xl">
                    <X size={20} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.sender}</label>
                    <input type="text" value={newConsignment.senderName} onChange={e => setNewConsignment(prev => ({ ...prev, senderName: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" placeholder={language === 'vi' ? 'Tên người gửi' : 'Sender name'} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'SĐT người gửi' : 'Sender phone'}</label>
                    <input type="text" value={newConsignment.senderPhone} onChange={e => setNewConsignment(prev => ({ ...prev, senderPhone: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" placeholder="09xxx" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.receiver}</label>
                    <input type="text" value={newConsignment.receiverName} onChange={e => setNewConsignment(prev => ({ ...prev, receiverName: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" placeholder={language === 'vi' ? 'Tên người nhận' : 'Receiver name'} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'SĐT người nhận' : 'Receiver phone'}</label>
                    <input type="text" value={newConsignment.receiverPhone} onChange={e => setNewConsignment(prev => ({ ...prev, receiverPhone: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" placeholder="09xxx" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.goods_type}</label>
                    <input type="text" value={newConsignment.type} onChange={e => setNewConsignment(prev => ({ ...prev, type: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" placeholder={language === 'vi' ? 'Loại hàng...' : 'Goods type...'} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.weight}</label>
                    <input type="text" value={newConsignment.weight} onChange={e => setNewConsignment(prev => ({ ...prev, weight: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" placeholder={language === 'vi' ? 'VD: 2kg' : 'e.g. 2kg'} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.cod}</label>
                    <input type="number" min="0" value={newConsignment.cod} onChange={e => setNewConsignment(prev => ({ ...prev, cod: parseInt(e.target.value) || 0 }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" placeholder="0" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Ghi chú' : 'Notes'}</label>
                    <input type="text" value={newConsignment.notes} onChange={e => setNewConsignment(prev => ({ ...prev, notes: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" placeholder={language === 'vi' ? 'Ghi chú thêm...' : 'Additional notes...'} />
                  </div>
                </div>
                <div className="flex justify-end gap-4 pt-2">
                  <button onClick={() => setShowCreateConsignment(false)} className="px-6 py-3 text-sm font-bold text-gray-400 hover:text-gray-600">{t.cancel}</button>
                  <button onClick={handleCreateConsignment} disabled={!newConsignment.senderName || !newConsignment.receiverName} className="px-8 py-3 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/20 disabled:opacity-50 disabled:shadow-none transition-all">
                    {language === 'vi' ? 'Tạo vận đơn' : 'Create Bill'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit Consignment Modal */}
          {showEditConsignment && editingConsignment && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-[32px] p-8 max-w-xl w-full space-y-6 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold">{language === 'vi' ? 'Chỉnh sửa vận đơn' : 'Edit Consignment'}</h3>
                  <button onClick={() => { setShowEditConsignment(false); setEditingConsignment(null); }} className="p-2 hover:bg-gray-50 rounded-xl">
                    <X size={20} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.sender}</label>
                    <input type="text" value={editConsignmentForm.senderName} onChange={e => setEditConsignmentForm(prev => ({ ...prev, senderName: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" placeholder={language === 'vi' ? 'Tên người gửi' : 'Sender name'} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'SĐT người gửi' : 'Sender phone'}</label>
                    <input type="text" value={editConsignmentForm.senderPhone} onChange={e => setEditConsignmentForm(prev => ({ ...prev, senderPhone: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" placeholder="09xxx" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.receiver}</label>
                    <input type="text" value={editConsignmentForm.receiverName} onChange={e => setEditConsignmentForm(prev => ({ ...prev, receiverName: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" placeholder={language === 'vi' ? 'Tên người nhận' : 'Receiver name'} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'SĐT người nhận' : 'Receiver phone'}</label>
                    <input type="text" value={editConsignmentForm.receiverPhone} onChange={e => setEditConsignmentForm(prev => ({ ...prev, receiverPhone: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" placeholder="09xxx" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.goods_type}</label>
                    <input type="text" value={editConsignmentForm.type} onChange={e => setEditConsignmentForm(prev => ({ ...prev, type: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" placeholder={language === 'vi' ? 'Loại hàng...' : 'Goods type...'} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.weight}</label>
                    <input type="text" value={editConsignmentForm.weight} onChange={e => setEditConsignmentForm(prev => ({ ...prev, weight: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" placeholder={language === 'vi' ? 'VD: 2kg' : 'e.g. 2kg'} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.cod}</label>
                    <input type="number" min="0" value={editConsignmentForm.cod} onChange={e => setEditConsignmentForm(prev => ({ ...prev, cod: parseInt(e.target.value) || 0 }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" placeholder="0" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Ghi chú' : 'Notes'}</label>
                    <input type="text" value={editConsignmentForm.notes} onChange={e => setEditConsignmentForm(prev => ({ ...prev, notes: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" placeholder={language === 'vi' ? 'Ghi chú thêm...' : 'Additional notes...'} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.status}</label>
                    <select value={editConsignmentForm.status} onChange={e => setEditConsignmentForm(prev => ({ ...prev, status: e.target.value as any }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10">
                      <option value="PENDING">{t.filter_pending || 'Pending'}</option>
                      <option value="PICKED_UP">{t.filter_picked_up || 'In Transit'}</option>
                      <option value="DELIVERED">{t.filter_delivered || 'Delivered'}</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-4 pt-2">
                  <button onClick={() => { setShowEditConsignment(false); setEditingConsignment(null); }} className="px-6 py-3 text-sm font-bold text-gray-400 hover:text-gray-600">{t.cancel}</button>
                  <button onClick={handleUpdateConsignment} disabled={!editConsignmentForm.senderName || !editConsignmentForm.receiverName} className="px-8 py-3 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/20 disabled:opacity-50 disabled:shadow-none transition-all">
                    {t.save}
                  </button>
                </div>
              </div>
            </div>
          )}
          </div>
        );
      }

      case 'user-guide':
        return <UserGuide language={language} currentUser={currentUser} userGuides={userGuides} />;

      default:
        return null;
    }
  };

  if (!currentUser) {
    return (
      <>
        <PWAInstallPrompt />
        {emailLinkReenter && (
          <EmailLinkReenterForm
            language={language}
            onSubmit={(email) => {
              setEmailLinkReenter(false);
              if (!auth) return;
              signInWithEmailLink(auth, email, window.location.href)
                .then(result => {
                  window.history.replaceState(null, '', window.location.pathname);
                  setEmailLinkPending({ uid: result.user.uid, email: result.user.email || email });
                })
                .catch(err => {
                  console.error('[EmailLink] Sign-in failed:', err);
                });
            }}
            onCancel={() => {
              setEmailLinkReenter(false);
              window.history.replaceState(null, '', window.location.pathname);
            }}
          />
        )}
        <Login 
          onLogin={setCurrentUser} 
          language={language} 
          setLanguage={setLanguage} 
          adminCredentials={adminCredentials}
          agents={agents}
          employees={employees}
          customers={customers}
          agentsLoading={agentsLoading}
          securityConfig={securityConfig}
          onRegister={handleRegisterMember}
          onOtpMemberLogin={handleOtpMemberLogin}
        />
      </>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-daiichi-accent">
      <PWAInstallPrompt />
      <UrgencyNotification language={language} />
      
      {/* Real-time Notifications */}
      <div className="fixed top-6 right-6 z-[100] space-y-4 pointer-events-none">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-daiichi-red/10 flex items-start gap-4 w-80 pointer-events-auto"
            >
              <div className="w-10 h-10 bg-daiichi-red/10 rounded-xl flex items-center justify-center text-daiichi-red shrink-0">
                <Bell size={20} className="animate-bounce" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-daiichi-red uppercase tracking-widest mb-1">
                  {language === 'vi' ? 'Đơn hàng mới!' : 'New Booking!'}
                </p>
                <p className="text-sm font-bold text-gray-800 line-clamp-1">{n.customerName}</p>
                <p className="text-[10px] text-gray-500 font-medium">
                  {n.route} • {n.time}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* QR Payment Modal – shown when paymentMethod is 'Chuyển khoản QR' */}
      {pendingQrBooking && (
        <PaymentQRModal
          amount={pendingQrBooking.amount}
          paymentRef={pendingQrBooking.ref}
          language={language}
          bookingLabel={pendingQrBooking.label}
          onConfirm={async () => {
            await pendingQrBooking.execute();
            setPendingQrBooking(null);
          }}
          onCancel={() => setPendingQrBooking(null)}
        />
      )}

      <TicketModal
        isOpen={isTicketOpen}
        onClose={() => {
          setIsTicketOpen(false);
          // Handle round-trip continuation: after outbound booking → move to return trip selection
          if (tripType === 'ROUND_TRIP' && roundTripPhase === 'outbound' && previousTab === 'book-ticket') {
            setOutboundBookingData(lastBooking);
            setRoundTripPhase('return');
            setActiveTab('book-ticket');
            // Reset seat selection state so user starts fresh for return trip
            setShowBookingForm(null);
            setExtraSeatIds([]);
            setAddonQuantities({});
            setSelectedTrip(null);
            setSeatSelectionHistory([]);
            setFareAmount(null);
            setFareAgentAmount(null);
            setFareError('');
            setFareLoading(false);
            setFromStopId('');
            setToStopId('');
            setPickupPoint('');
            setDropoffPoint('');
            setPickupAddress('');
            setDropoffAddress('');
            setPickupSurcharge(0);
            setDropoffSurcharge(0);
            setSurchargeAmount(0);
            setBookingDiscount(0);
            setBookingNote('');
          } else if (tripType === 'ROUND_TRIP' && roundTripPhase === 'return' && previousTab === 'book-ticket') {
            // Both legs done – reset round-trip state and go back to book-ticket
            setRoundTripPhase('outbound');
            setOutboundBookingData(null);
            setActiveTab('book-ticket');
            setSelectedTrip(null);
            setShowBookingForm(null);
            setExtraSeatIds([]);
            setAddonQuantities({});
            setSeatSelectionHistory([]);
          }
        }}
        booking={lastBooking}
        language={language}
        onRegisterMember={lastBooking?.phone ? handleRegisterMember : undefined}
      />
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        currentUser={currentUser} 
        onLogout={() => {
          setCurrentUser(null);
          if (auth) firebaseSignOut(auth).catch((err) => console.warn('[Auth] Sign-out failed:', err));
        }} 
        language={language} 
        setLanguage={setLanguage} 
        isSidebarOpen={isSidebarOpen} 
        setIsSidebarOpen={setIsSidebarOpen}
        permissions={permissions}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 bg-daiichi-accent/30 relative">
          {/* Offline mode banner */}
          {isOffline && (
            <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium bg-red-50 border border-red-200 text-red-700">
              <AlertTriangle size={16} className="shrink-0" />
              <span className="flex-1">{t.offline_mode_banner}</span>
            </div>
          )}
          {/* Mobile Menu Button - Since Header is removed */}
          <button 
            onClick={() => setIsSidebarOpen(true)} 
            className="lg:hidden absolute top-4 left-4 z-50 p-2 bg-white rounded-xl shadow-md text-gray-400 hover:text-daiichi-red transition-colors"
          >
            <Menu size={24} />
          </button>
          
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="pt-12 lg:pt-0"
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
