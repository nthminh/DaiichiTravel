import React, { useState, useEffect, useMemo, useRef, Suspense, lazy } from 'react';
import { 
  Bus, Users, Package, LayoutDashboard, ChevronRight, 
  MapPin, Calendar, Truck, Star, Phone, Search, 
  Clock, Edit3, Trash2, Wallet, X, CheckCircle2,
  Menu, Bell, Globe, LogOut, Eye, EyeOff, AlertTriangle, Info,
  Filter, Gift, Download, FileText, Copy, Columns, SlidersHorizontal, UserPlus, Loader2,
  Heart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, getYoutubeEmbedUrl, getLocalDateString, getOffsetDayLabel } from './lib/utils';

// Import Constants & Types
import { 
  UserRole, TripStatus, SeatStatus, Language, TRANSLATIONS 
} from './constants/translations';
import { PAYMENT_METHODS, type PaymentMethod, DEFAULT_PAYMENT_METHOD, PAYMENT_METHOD_TRANSLATION_KEYS } from './constants/paymentMethods';
import { usePayment } from './hooks/usePayment';
import { useRoutes } from './hooks/useRoutes';
import { useTrips } from './hooks/useTrips';
import { Stop, Trip, Consignment, Agent, Route, TripAddon, PricePeriod, RouteSurcharge, RouteStop, Employee, AgentPaymentOption, Invoice, UserGuide as UserGuideType, CustomerProfile, Vehicle, VehicleSeat } from './types';
import { transportService } from './services/transportService';
import { FareError } from './services/fareService';
import { auth, db, storage } from './lib/firebase';
import { signOut as firebaseSignOut, onAuthStateChanged, isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';

// Import Components – always needed on first paint
import { Login } from './components/Login';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { UrgencyNotification } from './components/UrgencyNotification';
import { StatusBadge } from './components/StatusBadge';
import { SearchableSelect } from './components/SearchableSelect';
import { Footer } from './components/Footer';
import { generateVehicleLayout, serializeLayout, SerializedSeat } from './lib/vehicleSeatUtils';
import { ResizableTh } from './components/ResizableTh';
import { matchesSearch } from './lib/searchUtils';
import { compressImage } from './lib/imageUtils';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { NotePopover } from './components/NotePopover';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { ErrorBoundary } from './components/ErrorBoundary';
import { exportTripToExcel, exportTripToPDF, exportRouteToPDF } from './utils/exportUtils';

// Lazy-loaded tab/role components – split into separate chunks to reduce initial bundle
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const TourManagement = lazy(() => import('./pages/TourManagement').then(m => ({ default: m.TourManagement })));
const StopManagement = lazy(() => import('./pages/StopManagement').then(m => ({ default: m.StopManagement })));
const FinancialReport = lazy(() => import('./pages/FinancialReport').then(m => ({ default: m.FinancialReport })));
const UserGuide = lazy(() => import('./pages/UserGuide').then(m => ({ default: m.UserGuide })));
const CustomerManagement = lazy(() => import('./pages/CustomerManagement').then(m => ({ default: m.CustomerManagement })));
const PaymentManagement = lazy(() => import('./pages/PaymentManagement').then(m => ({ default: m.PaymentManagement })));
const PickupDropoffManagement = lazy(() => import('./pages/PickupDropoffManagement').then(m => ({ default: m.PickupDropoffManagement })));
const StaffChat = lazy(() => import('./components/StaffChat').then(m => ({ default: m.StaffChat })));
const DriverTaskPanel = lazy(() => import('./pages/DriverTaskPanel').then(m => ({ default: m.DriverTaskPanel })));
const ConsignmentsPage = lazy(() => import('./pages/ConsignmentsPage').then(m => ({ default: m.ConsignmentsPage })));
const VehiclesPage = lazy(() => import('./pages/VehiclesPage').then(m => ({ default: m.VehiclesPage })));
const AgentsPage = lazy(() => import('./pages/AgentsPage').then(m => ({ default: m.AgentsPage })));
const VehicleSeatDiagram = lazy(() => import('./components/VehicleSeatDiagram').then(m => ({ default: m.VehicleSeatDiagram })));
const TicketModal = lazy(() => import('./components/TicketModal').then(m => ({ default: m.TicketModal })));
const PaymentQRModal = lazy(() => import('./components/PaymentQRModal').then(m => ({ default: m.PaymentQRModal })));
const AgentTopUpQRModal = lazy(() => import('./components/PaymentQRModal').then(m => ({ default: m.AgentTopUpQRModal })));
const MyTickets = lazy(() => import('./pages/MyTickets').then(m => ({ default: m.MyTickets })));
const AgentBookings = lazy(() => import('./pages/AgentBookings').then(m => ({ default: m.AgentBookings })));
const TourBookingForm = lazy(() => import('./components/TourBookingForm').then(m => ({ default: m.TourBookingForm })));
const EmployeesPage = lazy(() => import('./pages/EmployeesPage').then(m => ({ default: m.EmployeesPage })));
const ToursPage = lazy(() => import('./pages/ToursPage').then(m => ({ default: m.ToursPage })));
const CompletedTripsPage = lazy(() => import('./pages/CompletedTripsPage').then(m => ({ default: m.CompletedTripsPage })));
const RouteManagementPage = lazy(() => import('./pages/RouteManagementPage').then(m => ({ default: m.RouteManagementPage })));
import { DriverAssignment, StaffMessage } from './types';
import type { TourItem } from './components/TourBookingForm';

// Re-export types for components
export { UserRole, TripStatus, SeatStatus, TRANSLATIONS };
export type { Language };


export interface User {
  id: string;
  username: string;
  role: UserRole | string; // UserRole for admin/agent/customer, employee role string for staff
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  agentCode?: string;
  balance?: number;
  password?: string;
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
  // Seat ID that triggered a segment-conflict warning (cleared after a short timeout)
  const [segmentConflictSeat, setSegmentConflictSeat] = useState<string | null>(null);
  const segmentConflictTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const [tourBookingNights, setTourBookingNights] = useState(0);
  const [tourBookingBreakfasts, setTourBookingBreakfasts] = useState(0);
  const [tourAccommodation, setTourAccommodation] = useState<'none' | 'standard' | 'deluxe' | 'suite'>('none');
  const [tourMealPlan, setTourMealPlan] = useState<'none' | 'breakfast' | 'half_board' | 'full_board'>('none');
  const [tourSelectedAddons, setTourSelectedAddons] = useState<Set<string>>(new Set());
  const [tourNotes, setTourNotes] = useState('');
  const [tourPaymentMethod, setTourPaymentMethod] = useState<PaymentMethod>(DEFAULT_PAYMENT_METHOD);
  const [tourBookingSuccess, setTourBookingSuccess] = useState(false);
  const [tourBookingError, setTourBookingError] = useState<string>('');
  const [tourBookingId, setTourBookingId] = useState<string>('');
  const [lastTourBooking, setLastTourBooking] = useState<any>(null);
  const [isTourBookingLoading, setIsTourBookingLoading] = useState(false);
  const [tourBookingStatus, setTourBookingStatus] = useState<'PENDING' | 'CONFIRMED'>('PENDING');
  const [searchFrom, setSearchFrom] = useState('');
  const [searchTo, setSearchTo] = useState('');
  const [searchDate, setSearchDate] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
  const [searchReturnDate, setSearchReturnDate] = useState('');
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('');
  const [bookTicketSearch, setBookTicketSearch] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [searchTimeFrom, setSearchTimeFrom] = useState('');
  const [searchTimeTo, setSearchTimeTo] = useState('');
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

  // Terminal stops (Ga/Bến) used as departure/arrival options in route form
  const terminalStops = useMemo(
    () => {
      const terminals = stops.filter(s => s.type === 'TERMINAL');
      return terminals.length > 0 ? terminals : stops;
    },
    [stops]
  );

  // Tours state (for customer-facing page)
  const [tours, setTours] = useState<TourItem[]>([]);

  // Customer profiles state
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);

  // Pending email-link sign-in data (set when the app is opened via a magic link)
  const [emailLinkPending, setEmailLinkPending] = useState<{ uid: string; email: string } | null>(null);
  const emailLinkProcessingRef = useRef(false);
  // State to prompt user to re-enter email when localStorage key is missing (cross-device scenario)
  const [emailLinkReenter, setEmailLinkReenter] = useState(false);

  // Agent search / filter state (managed by AgentsPage)

  // Employee CRUD state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeForm, setEmployeeForm] = useState({ name: '', phone: '', email: '', address: '', role: 'STAFF', position: '', status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE', username: '', password: '', note: '' });
  const [employeeFormError, setEmployeeFormError] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeRoleFilter, setEmployeeRoleFilter] = useState<string>('ALL');
  const [showEmployeeFilters, setShowEmployeeFilters] = useState(false);

  // Driver assignments & staff messages
  const [driverAssignments, setDriverAssignments] = useState<DriverAssignment[]>([]);
  const [staffMessages, setStaffMessages] = useState<StaffMessage[]>([]);

  // Route search state
  const [routeSearch, setRouteSearch] = useState('');
  const [showRouteFilters, setShowRouteFilters] = useState(false);
  const [routeFilterDeparture, setRouteFilterDeparture] = useState('');
  const [routeFilterArrival, setRouteFilterArrival] = useState('');

  // Vehicle search state (managed by VehiclesPage)

  // Trip / Operations search state
  const [tripSearch, setTripSearch] = useState('');
  const [showTripAdvancedFilter, setShowTripAdvancedFilter] = useState(false);
  const [tripFilterRoute, setTripFilterRoute] = useState('');
  const [tripFilterStatus, setTripFilterStatus] = useState<string>('ALL');
  const [tripFilterDateFrom, setTripFilterDateFrom] = useState('');
  const [tripFilterDateTo, setTripFilterDateTo] = useState('');
  const [tripFilterTime, setTripFilterTime] = useState('');
  const [tripFilterVehicle, setTripFilterVehicle] = useState('');
  const [tripFilterDriver, setTripFilterDriver] = useState('');
  const [completedTripDateQuickFilter, setCompletedTripDateQuickFilter] = useState<string>('');
  const [showCompletedTripAdvancedFilter, setShowCompletedTripAdvancedFilter] = useState(false);
  const [completedTripFilterRoute, setCompletedTripFilterRoute] = useState('');
  const [completedTripFilterDateFrom, setCompletedTripFilterDateFrom] = useState('');
  const [completedTripFilterDateTo, setCompletedTripFilterDateTo] = useState('');

  // Route CRUD state – managed by useRoutes hook (called later once routes/storage are available)

  // Auto-generated stop IDs for departure and arrival (not real stops from the stops collection)
  const STOP_ID_DEPARTURE = '__departure__';
  const STOP_ID_ARRIVAL = '__arrival__';

  // Undo history for seat selection (shared with routes hook via routeFormStopsHistory/routeFormFaresHistory)
  const [seatSelectionHistory, setSeatSelectionHistory] = useState<{primarySeat: string | null; extraSeats: string[]}[]>([]);

  // Vehicle CRUD state (managed by VehiclesPage)

  // Vehicle seat diagram state (managed by VehiclesPage)

  // Excel import refs removed

  // Trip CRUD state – managed by useTrips hook (called later once vehicles are available)

  // Offline state (used only for UI connectivity indicator)
  const isOffline = !db;

  // Trip addon management state
  const [showTripAddons, setShowTripAddons] = useState<Trip | null>(null);
  const [showAddonDetailTrip, setShowAddonDetailTrip] = useState<Trip | null>(null);
  const [tripAddonForm, setTripAddonForm] = useState({ name: '', price: 0, description: '', type: 'OTHER' as 'SIGHTSEEING' | 'TRANSPORT' | 'FOOD' | 'OTHER' });
  const [showAddTripAddon, setShowAddTripAddon] = useState(false);
  // Addon quantities for the current booking: addonId -> quantity (0 means unselected)
  const [addonQuantities, setAddonQuantities] = useState<Record<string, number>>({});

  // Column widths for each admin table
  // agentColWidths managed by AgentsPage
  const [routeColWidths, setRouteColWidths] = useState({ stt: 80, name: 200, departure: 200, arrival: 200, price: 150, agentPrice: 150, options: 120 });
  // vehicleColWidths managed by VehiclesPage
  const [tripColWidths, setTripColWidths] = useState({ time: 180, licensePlate: 150, route: 220, driver: 180, status: 150, options: 180 });
  const [tripColVisibility, setTripColVisibility] = useState({ time: true, licensePlate: true, route: true, driver: true, status: true, seats: true, passengers: true, addons: true });
  const [showTripColPanel, setShowTripColPanel] = useState(false);
  const [showTripPassengers, setShowTripPassengers] = useState<Trip | null>(null);
  const [editingPassengerSeatId, setEditingPassengerSeatId] = useState<string | null>(null);
  const [passengerEditForm, setPassengerEditForm] = useState({ customerName: '', customerPhone: '', pickupAddress: '', dropoffAddress: '', status: SeatStatus.BOOKED as SeatStatus, bookingNote: '' });
  const [passengerColVisibility, setPassengerColVisibility] = useState({ ticketCode: true, seat: true, name: true, phone: true, pickup: true, dropoff: true, status: true, price: true, note: true });
  const [showPassengerColPanel, setShowPassengerColPanel] = useState(false);

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

  // WebSocket setup with exponential backoff reconnect logic
  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectAttempts = 0;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let unmounted = false;

    const MAX_RECONNECT_ATTEMPTS = 10;
    const BASE_DELAY_MS = 1000;
    const MAX_DELAY_MS = 30000;

    const connect = () => {
      if (unmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(`${protocol}//${window.location.host}`);

      socket.onopen = () => {
        reconnectAttempts = 0;
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'NEW_BOOKING') {
            const id = Date.now();
            setNotifications(prev => [{ ...data, id }, ...prev].slice(0, 5));
            // Auto remove notification after 5 seconds
            setTimeout(() => {
              setNotifications(prev => prev.filter(n => n.id !== id));
            }, 5000);
          }
        } catch (e) {
          console.error("Failed to parse WS message", e);
        }
      };

      socket.onclose = () => {
        if (unmounted || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
        const delay = Math.min(BASE_DELAY_MS * Math.pow(2, reconnectAttempts), MAX_DELAY_MS);
        reconnectAttempts++;
        reconnectTimeout = setTimeout(connect, delay);
      };

      setWs(socket);
    };

    connect();

    return () => {
      unmounted = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      socket?.close();
    };
  }, []);

  // Credential states
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [adminCredentials, setAdminCredentials] = useState({ username: 'admin', password: 'admin' });
  const [securityConfig, setSecurityConfig] = useState<{ phoneVerificationEnabled: boolean; phoneNumbers: string[] }>({ phoneVerificationEnabled: false, phoneNumbers: [] });

  // ─── Agent CRUD (logic extracted to AgentsPage via useAgents hook) ────────────

  // ─── Route CRUD (logic extracted to useRoutes hook) ──────────────────────────
  const {
    showAddRoute,
    setShowAddRoute,
    editingRoute,
    setEditingRoute,
    isCopyingRoute,
    setIsCopyingRoute,
    routeForm,
    setRouteForm,
    routePricePeriods,
    setRoutePricePeriods,
    showAddPricePeriod,
    setShowAddPricePeriod,
    pricePeriodForm,
    setPricePeriodForm,
    editingPricePeriodId,
    setEditingPricePeriodId,
    routeSurcharges,
    setRouteSurcharges,
    showAddRouteSurcharge,
    setShowAddRouteSurcharge,
    routeSurchargeForm,
    setRouteSurchargeForm,
    editingRouteSurchargeId,
    setEditingRouteSurchargeId,
    routeFormStops,
    setRouteFormStops,
    routeFormStopsRef,
    routeFormRef,
    allRouteStops,
    showAddRouteStop,
    setShowAddRouteStop,
    editingRouteStop,
    setEditingRouteStop,
    routeStopForm,
    setRouteStopForm,
    routeFormStopsHistory,
    setRouteFormStopsHistory,
    routeFormFaresHistory,
    setRouteFormFaresHistory,
    routeFormFares,
    setRouteFormFares,
    originalFareDocIdsRef,
    showAddRouteFare,
    setShowAddRouteFare,
    editingRouteFareIdx,
    setEditingRouteFareIdx,
    routeFareForm,
    setRouteFareForm,
    routeImageUploading,
    routeModalEditingId,
    setRouteModalEditingId,
    handleSaveRoute,
    handleRouteImageUpload,
    handleDeleteRoute,
    handleStartEditRoute,
    handleCopyRoute,
    handleSaveRouteNote,
  } = useRoutes({ routes, language, storage });

  // ─── Trip CRUD (logic extracted to useTrips hook) ────────────────────────────
  const {
    showAddTrip,
    setShowAddTrip,
    editingTrip,
    setEditingTrip,
    isCopyingTrip,
    setIsCopyingTrip,
    tripForm,
    setTripForm,
    showBatchAddTrip,
    setShowBatchAddTrip,
    batchTripForm,
    setBatchTripForm,
    batchTimeSlots,
    setBatchTimeSlots,
    batchTripLoading,
    buildSeatsForVehicle,
    handleSaveTrip,
    handleStartEditTrip,
    handleCopyTrip,
    handleCopyTripsToDate,
    handleDeleteTrip,
    handleSaveTripNote,
    handleTripVehicleSelect,
    handleBatchVehicleSelect,
    handleBatchAddTrips,
  } = useTrips({ vehicles, language });

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

  const [paymentConfig, setPaymentConfig] = useState<{ bookingCutoffEnabled: boolean; bookingCutoffMinutes: number }>({ bookingCutoffEnabled: true, bookingCutoffMinutes: 60 });

  // Subscribe to payment settings changes in real-time (to get booking cutoff config)
  useEffect(() => {
    const unsubscribe = transportService.subscribeToPaymentSettings((saved) => {
      if (saved && typeof saved === 'object') {
        setPaymentConfig({
          bookingCutoffEnabled: typeof saved.bookingCutoffEnabled === 'boolean' ? saved.bookingCutoffEnabled : true,
          bookingCutoffMinutes: typeof saved.bookingCutoffMinutes === 'number' ? saved.bookingCutoffMinutes : 60,
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
  const [extraSeatIds, setExtraSeatIds] = useState<string[]>([]);
  const [bookingNote, setBookingNote] = useState('');
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
    const unsubscribeVehicles = transportService.subscribeToVehicles((data) => setVehicles(data as unknown as Vehicle[]));
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

  // Subscribe to driverAssignments and staffMessages only when authenticated
  // (Firestore rules require isSignedIn() for these collections).
  useEffect(() => {
    if (!auth) return;
    let assignmentUnsub: (() => void) | null = null;
    let messagesUnsub: (() => void) | null = null;
    const authUnsub = onAuthStateChanged(auth, (user) => {
      if (assignmentUnsub) { assignmentUnsub(); assignmentUnsub = null; }
      if (messagesUnsub) { messagesUnsub(); messagesUnsub = null; }
      if (user) {
        assignmentUnsub = transportService.subscribeToDriverAssignments(setDriverAssignments);
        messagesUnsub = transportService.subscribeToStaffMessages(setStaffMessages);
      } else {
        setDriverAssignments([]);
        setStaffMessages([]);
      }
    });
    return () => {
      authUnsub();
      if (assignmentUnsub) assignmentUnsub();
      if (messagesUnsub) messagesUnsub();
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

  // Set default payment method when booking form opens based on user role
  useEffect(() => {
    if (!showBookingForm) return;
    if (currentUser?.role === UserRole.AGENT) {
      const agentInfo = agents.find(a => a.id === currentUser.id);
      const isPostpaid = agentInfo?.paymentType === 'POSTPAID' || !agentInfo?.paymentType;
      if (isPostpaid) {
        setPaymentMethodInput('Giữ vé');
      } else {
        setPaymentMethodInput('Chuyển khoản QR');
      }
    } else {
      // CUSTOMER / GUEST: force QR
      setPaymentMethodInput('Chuyển khoản QR');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBookingForm]);

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

  // Helper: check if a username is already taken by another agent or employee (used by employee handlers)
  const isUsernameTaken = (username: string, excludeAgentId?: string, excludeEmployeeId?: string): boolean => {
    const normalized = username.trim().toLowerCase();
    const takenByAgent = agents.some(a =>
      a.username && String(a.username).trim().toLowerCase() === normalized &&
      (!excludeAgentId || a.id !== excludeAgentId)
    );
    const takenByEmployee = employees.some(emp =>
      emp.username && String(emp.username).trim().toLowerCase() === normalized &&
      (!excludeEmployeeId || emp.id !== excludeEmployeeId)
    );
    return takenByAgent || takenByEmployee;
  };

  // --- Employee CRUD handlers ---
  const handleSaveEmployee = async () => {
    try {
      // Check for duplicate username across employees and agents
      if (employeeForm.username && employeeForm.username.trim()) {
        if (isUsernameTaken(employeeForm.username, undefined, editingEmployee?.id)) {
          setEmployeeFormError(language === 'vi' ? 'Tên đăng nhập này đã tồn tại, vui lòng chọn tên khác.' : 'This username already exists, please choose another.');
          return;
        }
      }
      setEmployeeFormError('');
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
    setEmployeeFormError('');
    setShowAddEmployee(true);
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

  // getLocalDateString and getOffsetDayLabel are imported from lib/utils

  const compareTripDateTime = (a: { date?: string; time?: string }, b: { date?: string; time?: string }) => {
    const aDate = a.date || '9999-12-31';
    const aTime = a.time || '23:59';
    const bDate = b.date || '9999-12-31';
    const bTime = b.time || '23:59';
    const aKey = `${aDate}T${aTime}`;
    const bKey = `${bDate}T${bTime}`;
    return aKey.localeCompare(bKey);
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

  const exportTripToExcelHandler = (trip: any) => exportTripToExcel(trip, bookings, routes);
  const exportTripToPDFHandler = (trip: any) => exportTripToPDF(trip, bookings, routes);


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

  // ─── Payment & booking flow (logic extracted to usePayment hook) ─────────────
  const {
    paymentMethodInput,
    setPaymentMethodInput,
    pendingQrBooking,
    setPendingQrBooking,
    agentTopUpModal,
    setAgentTopUpModal,
    handleConfirmBooking,
    capturedOutboundLeg,
    setCapturedOutboundLeg,
  } = usePayment({
    currentUser,
    language,
    selectedTrip,
    routes,
    adults,
    children,
    childrenAges,
    addonQuantities,
    pickupSurcharge,
    dropoffSurcharge,
    surchargeAmount,
    bookingDiscount,
    pickupPoint,
    dropoffPoint,
    pickupAddress,
    dropoffAddress,
    extraSeatIds,
    customerNameInput,
    phoneInput,
    fromStopId,
    toStopId,
    bookingNote,
    fareAmount,
    fareAgentAmount,
    ws,
    getApplicableRouteSurcharges,
    tripType,
    roundTripPhase,
    onRoundTripOutboundCaptured: (summary) => {
      setOutboundBookingData(summary);
      setRoundTripPhase('return');
      setActiveTab('book-ticket');
    },
    setLastBooking,
    setIsTicketOpen,
    setShowBookingForm,
    setCustomerNameInput,
    setPhoneInput,
    setAdults,
    setChildren,
    setChildrenAges,
    setExtraSeatIds,
    setPickupPoint,
    setDropoffPoint,
    setPickupAddress,
    setDropoffAddress,
    setPickupSurcharge,
    setDropoffSurcharge,
    setSurchargeAmount,
    setBookingDiscount,
    setAddonQuantities,
    setBookingNote,
    setFareAmount,
    setFareAgentAmount,
    setFareError,
    setFareLoading,
    setFromStopId,
    setToStopId,
    setSeatSelectionHistory,
    setTrips,
    setSelectedTrip,
  });

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

      case 'my-tickets':
        return (
          <MyTickets
            language={language}
            currentUser={currentUser}
            bookings={bookings}
          />
        );

      case 'agent-bookings':
        return (
          <AgentBookings
            language={language}
            currentUser={currentUser}
            bookings={bookings}
            trips={trips}
            setTrips={setTrips}
            setBookings={setBookings}
          />
        );
      
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

            {/* Agent balance banner – shown when agent is logged in */}
            {currentUser?.role === UserRole.AGENT && (() => {
              const agentData = agents.find(a => a.id === currentUser.id);
              if (!agentData) return null;
              return (
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-3xl p-5 sm:p-8 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
                    </div>
                    <div>
                      <p className="text-white/70 text-xs font-semibold uppercase tracking-wide">{language === 'vi' ? 'Số dư tài khoản đại lý' : 'Agent Account Balance'}</p>
                      <p className="text-2xl sm:text-3xl font-extrabold mt-0.5">
                        <span className={(agentData.balance || 0) < 0 ? 'text-red-300' : 'text-white'}>
                          {(agentData.balance || 0).toLocaleString('vi-VN')}đ
                        </span>
                      </p>
                      <p className="text-white/60 text-xs mt-1">{agentData.name} · {agentData.code}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setAgentTopUpModal(true)}
                    className="shrink-0 flex items-center gap-2 px-5 py-3 bg-white text-purple-700 rounded-2xl font-bold shadow-lg hover:scale-105 transition-all text-sm whitespace-nowrap"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/></svg>
                    {language === 'vi' ? 'Nạp tiền' : 'Top Up'}
                  </button>
                </div>
              );
            })()}

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
              <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
                {/* Keyword Search */}
                <div className="flex-1 min-w-[180px]">
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
                {/* Time Range Filter */}
                <div className="flex items-end gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.time_filter}</label>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                          type="time"
                          value={searchTimeFrom}
                          onChange={e => setSearchTimeFrom(e.target.value)}
                          title={t.time_from}
                          className="w-32 pl-9 pr-3 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
                        />
                      </div>
                      <span className="text-gray-400 font-bold">—</span>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                          type="time"
                          value={searchTimeTo}
                          onChange={e => setSearchTimeTo(e.target.value)}
                          title={t.time_to}
                          className="w-32 pl-9 pr-3 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
                        />
                      </div>
                    </div>
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
                  {(bookTicketSearch || priceMin || priceMax || searchTimeFrom || searchTimeTo) && (
                    <button
                      onClick={() => { setBookTicketSearch(''); setPriceMin(''); setPriceMax(''); setSearchTimeFrom(''); setSearchTimeTo(''); }}
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
                  // Time-range filter: HH:MM strings compare correctly lexicographically
                  // (e.g. '06:00' < '14:30' < '23:59'), so a direct string comparison is safe.
                  if (searchTimeFrom && trip.time && trip.time < searchTimeFrom) return false;
                  if (searchTimeTo && trip.time && trip.time > searchTimeTo) return false;
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
                        {(() => {
                          // Check if departure is within the cutoff window for non-staff users
                          const isPrivilegedUser = currentUser?.role === UserRole.MANAGER ||
                            currentUser?.role === 'SUPERVISOR' ||
                            currentUser?.role === 'STAFF';
                          let isCutoffBlocked = false;
                          if (!isPrivilegedUser && paymentConfig.bookingCutoffEnabled && paymentConfig.bookingCutoffMinutes > 0) {
                            const tripDateStr = trip.date;
                            const tripTime = trip.time || '00:00';
                            if (tripDateStr) {
                              const parts = tripDateStr.split(/[\/\-]/);
                              if (parts.length === 3) {
                                let departureDate: Date;
                                if (tripDateStr.includes('/')) {
                                  departureDate = new Date(+parts[2], +parts[1] - 1, +parts[0]);
                                } else {
                                  departureDate = new Date(+parts[0], +parts[1] - 1, +parts[2]);
                                }
                                const [hh, mm] = tripTime.split(':');
                                departureDate.setHours(+hh || 0, +mm || 0, 0, 0);
                                const msUntilDeparture = departureDate.getTime() - Date.now();
                                isCutoffBlocked = msUntilDeparture <= paymentConfig.bookingCutoffMinutes * 60 * 1000;
                              }
                            }
                          }
                          return isCutoffBlocked ? (
                            <button
                              onClick={() => alert(t.booking_cutoff_alert || 'Xe sắp chạy! Vui lòng liên hệ đại lý hoặc nhân viên nhà xe để đặt vé cận giờ.')}
                              className="w-full px-2 py-1.5 bg-gray-400 text-white rounded-xl text-xs font-bold shadow-lg shadow-gray-400/10 cursor-not-allowed"
                            >
                              🔒 {language === 'vi' ? 'Liên hệ đại lý' : language === 'ja' ? '代理店にお問い合わせ' : 'Contact Agent'}
                            </button>
                          ) : (
                            <button
                              onClick={() => { setSelectedTrip(trip); setPreviousTab('book-ticket'); setActiveTab('seat-mapping'); }}
                              className="w-full px-2 py-1.5 bg-daiichi-red text-white rounded-xl text-xs font-bold shadow-lg shadow-daiichi-red/10"
                            >
                              {t.select_seat}
                            </button>
                          );
                        })()}
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
          const childrenOver5Count = childrenAges.filter(age => age >= 5).length;
          const extraSeatsNeeded = (adults - 1) + childrenOver5Count;
          // Look up route once for this render block (used for surcharges, fare table, and blocker check)
          const tripRoute = routes.find(r => r.name === selectedTrip.route);
          // Also disable confirmation when a fare lookup error exists for a route with configured stops
          const hasFareBlocker = !!fareError && (tripRoute?.routeStops?.length ?? 0) > 0;
          const isFreeSeatingTrip = selectedTrip.seatType === 'free';
          const canConfirmBooking = isFreeSeatingTrip
            ? !hasFareBlocker
            : (extraSeatsNeeded === 0 || extraSeatIds.length >= extraSeatsNeeded) && !hasFareBlocker;
          const isSelectingExtraSeats = !isFreeSeatingTrip && !!showBookingForm && (adults > 1 || childrenOver5Count > 0);

          // Route-level surcharges
          const tripDate = selectedTrip.date || '';
          const applicableRouteSurcharges = getApplicableRouteSurcharges(tripRoute, tripDate);
          // Pre-compute stop name lists for pickup/dropoff address selects.
          // Only show STOP-type (điểm dừng) entries – never major TERMINAL stations (ga lớn).
          // Use the user-selected departure/arrival (pickupPoint/dropoffPoint) as the effective
          // terminal name; fall back to the route's fixed departure/arrival point.
          // If the selected name is itself a STOP (not a TERMINAL), find its parent TERMINAL
          // so that all sibling stops under the same terminal are offered.
          const resolveTerminal = (selectedName: string | undefined, routeDefaultName: string | undefined) => {
            const name = selectedName || routeDefaultName;
            if (!name) return undefined;
            // Direct match: the name is a TERMINAL stop
            const direct = stops.find(s => s.type === 'TERMINAL' && s.name === name);
            if (direct) return direct;
            // Indirect match: the name is a STOP – find its parent TERMINAL
            const parentId = stops.find(s => s.name === name)?.terminalId;
            if (parentId) return stops.find(s => s.id === parentId);
            return undefined;
          };
          const departureTerminal = resolveTerminal(pickupPoint, tripRoute?.departurePoint);
          const arrivalTerminal = resolveTerminal(dropoffPoint, tripRoute?.arrivalPoint);
          // Only include child STOP entries; when no terminal is resolved, show all non-TERMINAL stops
          const pickupStopNames = departureTerminal
            ? stops.filter(s => s.terminalId === departureTerminal.id).map(s => s.name)
            : stops.filter(s => s.type !== 'TERMINAL').map(s => s.name);
          const dropoffStopNames = arrivalTerminal
            ? stops.filter(s => s.terminalId === arrivalTerminal.id).map(s => s.name)
            : stops.filter(s => s.type !== 'TERMINAL').map(s => s.name);

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
            // Collect all segment bookings: prefer the new segmentBookings array, fall back to legacy fields
            const segments: Array<{ fromStopOrder: number; toStopOrder: number }> =
              (seatData?.segmentBookings ?? []).length > 0
                ? seatData.segmentBookings
                : (seatData?.fromStopOrder !== undefined && seatData?.toStopOrder !== undefined
                    ? [{ fromStopOrder: seatData.fromStopOrder, toStopOrder: seatData.toStopOrder }]
                    : []);
            if (segments.length === 0) return rawStatus;
            // Two segments [sFrom, sTo) and [currentFromOrder, currentToOrder) overlap iff:
            //   sFrom < currentToOrder AND currentFromOrder < sTo
            const anyOverlap = segments.some(
              seg => seg.fromStopOrder < currentToOrder && currentFromOrder < seg.toStopOrder
            );
            if (!anyOverlap) return SeatStatus.EMPTY; // seat is free for our segment
            return rawStatus;
          };

          const renderSeatButton = (seatId: string) => {
            const status = getEffectiveStatus(seatId);
            const rawStatus = seatStatusMap[seatId] ?? SeatStatus.EMPTY;
            const isSegmentFree = hasSegmentSelection && status === SeatStatus.EMPTY && rawStatus !== SeatStatus.EMPTY;
            const isPrimarySeat = seatId === showBookingForm;
            const isExtraSeat = extraSeatIds.includes(seatId);

            // Detect a seat that is booked for a specific sub-segment on a multi-stop route.
            // Such a seat is only half-colored: it may still be free for other segments.
            const seatDataForBtn = selectedTrip.seats.find((s: any) => s.id === seatId);
            const hasSegmentInfo =
              (seatDataForBtn?.segmentBookings ?? []).length > 0 ||
              (seatDataForBtn?.fromStopOrder !== undefined && seatDataForBtn?.toStopOrder !== undefined);
            const isPartiallyBooked =
              rawStatus !== SeatStatus.EMPTY &&
              !isSegmentFree &&
              !!(tripRoute?.routeStops?.length) &&
              hasSegmentInfo &&
              !isPrimarySeat &&
              !isExtraSeat;

            // Segment-conflict tooltip/warning badge
            const hasConflictWarning = segmentConflictSeat === seatId;

            return (
              <motion.button
                key={seatId}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  if (status !== SeatStatus.EMPTY) {
                    // Partially-booked seat on a multi-stop route
                    if (isPartiallyBooked) {
                      if (hasSegmentSelection) {
                        // Segment conflict: the user's selected segment overlaps → warn
                        if (segmentConflictTimerRef.current) clearTimeout(segmentConflictTimerRef.current);
                        setSegmentConflictSeat(seatId);
                        segmentConflictTimerRef.current = setTimeout(() => setSegmentConflictSeat(null), 3000);
                      } else {
                        // No segment selected yet → open the booking form so the user can
                        // pick a non-overlapping segment
                        if (!showBookingForm) {
                          setSeatSelectionHistory(prev => [...prev, { primarySeat: null, extraSeats: [] }]);
                          setShowBookingForm(seatId);
                          if (currentUser?.role === UserRole.CUSTOMER) {
                            if (currentUser.name) setCustomerNameInput(currentUser.name);
                            if (currentUser.phone) setPhoneInput(currentUser.phone);
                          }
                        }
                      }
                    }
                    return;
                  }
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
                  "w-10 h-10 rounded-lg flex items-center justify-center text-[10px] font-bold border-2 transition-all flex-shrink-0 relative overflow-hidden",
                  // Fully-booked seats (no segment info on a multi-stop route, or non-multi-stop)
                  rawStatus === SeatStatus.PAID && !isSegmentFree && !isPartiallyBooked && "bg-daiichi-red text-white border-daiichi-red shadow-lg shadow-daiichi-red/20",
                  rawStatus === SeatStatus.BOOKED && !isSegmentFree && !isPartiallyBooked && "bg-daiichi-yellow text-white border-daiichi-yellow shadow-lg shadow-daiichi-yellow/20",
                  // Partially-booked seat: half-colored via inline style below; apply border color only
                  isPartiallyBooked && rawStatus === SeatStatus.PAID && "border-daiichi-red text-daiichi-red hover:border-daiichi-red cursor-pointer",
                  isPartiallyBooked && rawStatus === SeatStatus.BOOKED && "border-daiichi-yellow text-daiichi-yellow hover:border-daiichi-red cursor-pointer",
                  isSegmentFree && !isPrimarySeat && !isExtraSeat && "bg-emerald-50 border-emerald-400 text-emerald-600 hover:border-daiichi-red hover:text-daiichi-red",
                  isPrimarySeat && "bg-daiichi-red/20 border-daiichi-red text-daiichi-red",
                  isExtraSeat && "bg-blue-100 border-blue-500 text-blue-600",
                  status === SeatStatus.EMPTY && !isSegmentFree && !isPrimarySeat && !isExtraSeat && "bg-white border-gray-200 text-gray-500 hover:border-daiichi-red hover:text-daiichi-red",
                  hasConflictWarning && "ring-2 ring-offset-1 ring-orange-400"
                )}
                style={isPartiallyBooked ? {
                  background: rawStatus === SeatStatus.PAID
                    ? 'linear-gradient(135deg, #E31B23 50%, #ffffff 50%)'
                    : 'linear-gradient(135deg, #FBBF24 50%, #ffffff 50%)',
                } : undefined}
                title={
                  isPartiallyBooked
                    ? (language === 'vi' ? 'Ghế đã đặt một phần chặng — chọn ghế này để chọn chặng khác' : 'Partially booked — click to book a different segment')
                    : isSegmentFree
                      ? (language === 'vi' ? 'Trống cho chặng này' : 'Free for this segment')
                      : undefined
                }
              >
                {seatId}
                {rawStatus === SeatStatus.PAID && !isSegmentFree && !isPartiallyBooked && <CheckCircle2 size={10} className="absolute top-0.5 right-0.5" />}
                {isExtraSeat && <span className="absolute top-0 right-0.5 text-[7px] font-bold text-blue-600">+</span>}
                {isSegmentFree && <span className="absolute top-0 right-0 text-[7px] font-bold text-emerald-600">✓</span>}
                {isPartiallyBooked && <span className="absolute top-0 right-0 text-[7px] font-bold leading-none" style={{ color: rawStatus === SeatStatus.PAID ? '#E31B23' : '#FBBF24' }}>½</span>}
                {hasConflictWarning && <span className="absolute bottom-0 left-0 right-0 text-[7px] font-bold text-orange-600 text-center leading-tight bg-orange-50">!</span>}
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
                  {!!(tripRoute?.routeStops?.length) && (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded border-2 border-daiichi-yellow overflow-hidden" style={{ background: 'linear-gradient(135deg, #FBBF24 50%, #ffffff 50%)' }} />
                      {language === 'vi' ? 'Đặt một phần chặng' : language === 'ja' ? '区間の一部予約' : 'Partial segment'}
                    </div>
                  )}
                  {hasSegmentSelection && (
                    <div className="flex items-center gap-2"><div className="w-4 h-4 bg-emerald-50 border-2 border-emerald-400 rounded" /> {language === 'vi' ? 'Trống chặng này' : language === 'ja' ? 'この区間は空き' : 'Free for segment'}</div>
                  )}
                </div>

                {/* Segment-conflict warning banner */}
                {segmentConflictSeat && (
                  <div className="mt-3 mx-auto max-w-xs p-2 bg-orange-50 border border-orange-300 rounded-xl flex items-center gap-2 text-xs font-bold text-orange-700 animate-pulse">
                    <span>⚠️</span>
                    <span>
                      {language === 'vi'
                        ? `Ghế ${segmentConflictSeat}: Chặng này đã có người ngồi rồi — vui lòng chọn chặng khác.`
                        : language === 'ja'
                          ? `座席 ${segmentConflictSeat}: この区間はすでに予約されています — 別の区間を選んでください。`
                          : `Seat ${segmentConflictSeat}: This segment is already booked — please choose a different segment.`}
                    </span>
                  </div>
                )}
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
                            const currentOver5Count = childrenAges.filter(age => age >= 5).length;
                            const newExtraSeatsNeeded = (newAdults - 1) + currentOver5Count;
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
                            const newOver5Count = newAges.filter(age => age >= 5).length;
                            setExtraSeatIds(prev => prev.slice(0, newOver5Count));
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
                        <p className="text-[10px] text-blue-400">{t.child_age_note || 'Children aged 5 and above are charged ticket price; aged 4 and below are free'}</p>
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
                                  // Trim extra seats if children over 5 count decreased
                                  const newOver5Count = ages.filter(age => (age ?? 0) >= 5).length;
                                  setExtraSeatIds(prev => prev.slice(0, newOver5Count));
                                }}
                                className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 text-center"
                              />
                              {(childrenAges[i] ?? 0) >= 5 && (
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
                                setPickupAddress(''); // clear sub-stop when departure changes
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
                          <div className="pl-3 border-l-2 border-gray-100">
                            <label className="text-[10px] font-semibold text-gray-400 uppercase">{t.pickup_address || 'Điểm đón'}</label>
                            <SearchableSelect
                              options={pickupStopNames}
                              value={pickupAddress}
                              onChange={setPickupAddress}
                              placeholder={t.pickup_address_ph || 'Chọn hoặc nhập điểm đón...'}
                              className="mt-0.5"
                              inputClassName="!px-3 !py-1.5 !text-xs !rounded-lg"
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
                                setDropoffAddress(''); // clear sub-stop when destination changes
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
                            {/* Segment-conflict warning inside the booking form */}
                            {(() => {
                              if (!hasSegmentSelection || !showBookingForm || showBookingForm === 'FREE') return null;
                              const bookedSeat = selectedTrip.seats.find((s: any) => s.id === showBookingForm);
                              if (!bookedSeat) return null;
                              const segs: Array<{ fromStopOrder: number; toStopOrder: number }> =
                                (bookedSeat.segmentBookings ?? []).length > 0
                                  ? bookedSeat.segmentBookings
                                  : (bookedSeat.fromStopOrder !== undefined && bookedSeat.toStopOrder !== undefined
                                      ? [{ fromStopOrder: bookedSeat.fromStopOrder, toStopOrder: bookedSeat.toStopOrder }]
                                      : []);
                              if (segs.length === 0) return null;
                              const conflict = segs.some(
                                seg => seg.fromStopOrder < currentToOrder && currentFromOrder < seg.toStopOrder
                              );
                              if (!conflict) return null;
                              return (
                                <div className="mt-2 p-2 bg-orange-50 border border-orange-300 rounded-xl flex items-start gap-2 text-xs font-bold text-orange-700">
                                  <span className="mt-0.5">⚠️</span>
                                  <span>
                                    {language === 'vi'
                                      ? 'Chặng này, ghế này đã có người ngồi rồi — vui lòng chọn chặng khác.'
                                      : language === 'ja'
                                        ? 'この区間はすでに予約されています — 別の区間を選んでください。'
                                        : 'This segment is already taken — please choose a different segment.'}
                                  </span>
                                </div>
                              );
                            })()}
                          </div>
                          <div className="pl-3 border-l-2 border-gray-100">
                            <label className="text-[10px] font-semibold text-gray-400 uppercase">{t.dropoff_address || 'Điểm trả'}</label>
                            <SearchableSelect
                              options={dropoffStopNames}
                              value={dropoffAddress}
                              onChange={setDropoffAddress}
                              placeholder={t.dropoff_address_ph || 'Chọn hoặc nhập điểm trả...'}
                              className="mt-0.5"
                              inputClassName="!px-3 !py-1.5 !text-xs !rounded-lg"
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

                    {/* Payment Method – shown conditionally based on user role */}
                    {(() => {
                      const isManager = currentUser?.role === UserRole.MANAGER;
                      const isAgent = currentUser?.role === UserRole.AGENT;
                      const agentDataForBooking = isAgent ? agents.find(a => a.id === currentUser?.id) : null;
                      const isPostpaidAgent = isAgent && (agentDataForBooking?.paymentType === 'POSTPAID' || !agentDataForBooking?.paymentType);

                      if (isManager) {
                        // Manager: show all payment methods
                        return (
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
                        );
                      }

                      if (isPostpaidAgent) {
                        // POSTPAID agent: only "Giữ vé" or "Thanh toán sau"
                        return (
                          <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">{t.payment_method}</label>
                            <select
                              value={paymentMethodInput === 'Giữ vé' || paymentMethodInput === 'Thanh toán sau' ? paymentMethodInput : 'Giữ vé'}
                              onChange={(e) => setPaymentMethodInput(e.target.value as PaymentMethod)}
                              className="w-full mt-1 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                            >
                              <option value="Giữ vé">{t.payment_hold || 'Giữ vé (có thể chỉnh sửa)'}</option>
                              <option value="Thanh toán sau">{t.payment_later || 'Thanh toán sau (công nợ)'}</option>
                            </select>
                            <p className="text-[10px] text-purple-500 mt-1 ml-1">
                              {language === 'vi'
                                ? '"Giữ vé" có thể chỉnh sửa/xóa trước 24h xe chạy. "Thanh toán sau" xuất vé ngay, tính vào công nợ.'
                                : '"Hold Ticket" can be edited/deleted up to 24h before departure. "Pay Later" issues immediately, billed to your account.'}
                            </p>
                          </div>
                        );
                      }

                      // Customer / Guest / PREPAID agent: locked to QR payment
                      return (
                        <div>
                          <label className="text-xs font-bold text-gray-500 uppercase">{t.payment_method}</label>
                          <div className="w-full mt-1 px-4 py-2.5 bg-blue-50 border border-blue-100 rounded-xl text-sm font-bold text-blue-700 flex items-center gap-2">
                            <span>📱</span>
                            <span>{t.payment_qr || 'Chuyển khoản QR'}</span>
                          </div>
                          <p className="text-[10px] text-blue-400 mt-1 ml-1">
                            {language === 'vi'
                              ? 'Thanh toán QR bắt buộc. Thời gian chờ thanh toán: 30 phút.'
                              : language === 'ja'
                              ? 'QR支払い必須。支払い待機時間：30分。'
                              : 'QR payment required. Payment window: 30 minutes.'}
                          </p>
                        </div>
                      );
                    })()}

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
                        const { childrenOver5, childrenUnder5 } = childrenAges.reduce(
                          (acc, age) => age >= 5 ? { ...acc, childrenOver5: acc.childrenOver5 + 1 } : { ...acc, childrenUnder5: acc.childrenUnder5 + 1 },
                          { childrenOver5: 0, childrenUnder5: 0 }
                        );
                        const effectiveAdults = adults + childrenOver5;
                        const effectiveChildren = childrenUnder5 + Math.max(0, children - childrenAges.length);
                        // Children under 5 are free; only charge adults (which includes children aged 5+)
                        const baseTotal = (effectiveAdults * basePriceAdult);
                        const routeSurchargeTotal = applicableRouteSurcharges.reduce((sum, sc) => sum + sc.amount * effectiveAdults, 0);
                        const allSurcharges = pickupSurcharge + dropoffSurcharge + surchargeAmount + routeSurchargeTotal;
                        const selectedAddonsInForm = (selectedTrip.addons || [] as TripAddon[]).filter((a: TripAddon) => (addonQuantities[a.id] || 0) > 0);
                        const addonsTotalInForm = selectedAddonsInForm.reduce((sum, a) => sum + a.price * (addonQuantities[a.id] || 1), 0);
                        const finalTotal = Math.round(baseTotal + allSurcharges + addonsTotalInForm);
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
                                <span>+{(sc.amount * effectiveAdults).toLocaleString()}đ</span>
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

      case 'tours':
        return (
          <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={32} /></div>}>
            <ToursPage
              tours={tours}
              tourHasSearched={tourHasSearched}
              clearedTourCards={clearedTourCards}
              tourPriceMin={tourPriceMin}
              tourPriceMax={tourPriceMax}
              tourDurationFilter={tourDurationFilter}
              expandedVideoTourId={expandedVideoTourId}
              likedTours={likedTours}
              language={language}
              setTourHasSearched={setTourHasSearched}
              setClearedTourCards={setClearedTourCards}
              setTourPriceMin={setTourPriceMin}
              setTourPriceMax={setTourPriceMax}
              setTourDurationFilter={setTourDurationFilter}
              setExpandedVideoTourId={setExpandedVideoTourId}
              toggleLike={toggleLike}
              onSelectTour={(tour) => {
                setSelectedTour(tour);
                setTourBookingName('');
                setTourBookingPhone('');
                setTourBookingEmail('');
                setTourBookingDate('');
                setTourBookingAdults(tour.numAdults ?? 1);
                setTourBookingChildren(tour.numChildren ?? 0);
                setTourBookingNights(tour.nights ?? 0);
                setTourBookingBreakfasts(tour.breakfastCount ?? 0);
                setTourAccommodation('none');
                setTourMealPlan('none');
                setTourSelectedAddons(new Set());
                setTourNotes('');
                setTourPaymentMethod(DEFAULT_PAYMENT_METHOD);
                setTourBookingSuccess(false);
                setTourBookingError('');
                setTourBookingStatus('PENDING');
                setActiveTab('book-tour');
              }}
            />
          </Suspense>
        );

      case 'book-tour':
        return (
          <TourBookingForm
            selectedTour={selectedTour}
            agents={agents}
            currentUser={currentUser}
            language={language}
            tourBookingName={tourBookingName}
            setTourBookingName={setTourBookingName}
            tourBookingPhone={tourBookingPhone}
            setTourBookingPhone={setTourBookingPhone}
            tourBookingEmail={tourBookingEmail}
            setTourBookingEmail={setTourBookingEmail}
            tourBookingDate={tourBookingDate}
            setTourBookingDate={setTourBookingDate}
            tourBookingAdults={tourBookingAdults}
            setTourBookingAdults={setTourBookingAdults}
            tourBookingChildren={tourBookingChildren}
            setTourBookingChildren={setTourBookingChildren}
            tourBookingNights={tourBookingNights}
            setTourBookingNights={setTourBookingNights}
            tourBookingBreakfasts={tourBookingBreakfasts}
            setTourBookingBreakfasts={setTourBookingBreakfasts}
            tourSelectedAddons={tourSelectedAddons}
            setTourSelectedAddons={setTourSelectedAddons}
            tourNotes={tourNotes}
            setTourNotes={setTourNotes}
            tourPaymentMethod={tourPaymentMethod}
            setTourPaymentMethod={setTourPaymentMethod}
            tourBookingSuccess={tourBookingSuccess}
            setTourBookingSuccess={setTourBookingSuccess}
            tourBookingError={tourBookingError}
            setTourBookingError={setTourBookingError}
            tourBookingId={tourBookingId}
            setTourBookingId={setTourBookingId}
            lastTourBooking={lastTourBooking}
            setLastTourBooking={setLastTourBooking}
            isTourBookingLoading={isTourBookingLoading}
            setIsTourBookingLoading={setIsTourBookingLoading}
            tourBookingStatus={tourBookingStatus}
            setTourBookingStatus={setTourBookingStatus}
            onBackToTours={() => setActiveTab('tours')}
            onViewTicket={(booking) => { setLastBooking(booking); setIsTicketOpen(true); }}
            onGoHome={() => setActiveTab('home')}
            getLocalDateString={getLocalDateString}
          />
        );

      case 'agents':
        return <AgentsPage agents={agents} employees={employees} language={language} />;

      case 'employees':
        return (
          <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={32} /></div>}>
            <EmployeesPage
              employees={employees}
              employeeSearch={employeeSearch}
              employeeRoleFilter={employeeRoleFilter}
              showEmployeeFilters={showEmployeeFilters}
              showAddEmployee={showAddEmployee}
              editingEmployee={editingEmployee}
              employeeForm={employeeForm}
              employeeFormError={employeeFormError}
              language={language}
              permissions={permissions}
              handleSaveEmployee={handleSaveEmployee}
              handleDeleteEmployee={handleDeleteEmployee}
              handleStartEditEmployee={handleStartEditEmployee}
              setShowAddEmployee={setShowAddEmployee}
              setEditingEmployee={setEditingEmployee}
              setEmployeeForm={setEmployeeForm}
              setEmployeeFormError={setEmployeeFormError}
              setEmployeeSearch={setEmployeeSearch}
              setEmployeeRoleFilter={setEmployeeRoleFilter}
              setShowEmployeeFilters={setShowEmployeeFilters}
            />
          </Suspense>
        );

      case 'routes':
        return (
          <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={32} /></div>}>
            <RouteManagementPage
              routes={routes}
              stops={stops}
              terminalStops={terminalStops}
              language={language}
              t={t}
              routeSearch={routeSearch}
              setRouteSearch={setRouteSearch}
              showRouteFilters={showRouteFilters}
              setShowRouteFilters={setShowRouteFilters}
              routeFilterDeparture={routeFilterDeparture}
              setRouteFilterDeparture={setRouteFilterDeparture}
              routeFilterArrival={routeFilterArrival}
              setRouteFilterArrival={setRouteFilterArrival}
              routeColWidths={routeColWidths}
              setRouteColWidths={setRouteColWidths}
              showAddRoute={showAddRoute}
              setShowAddRoute={setShowAddRoute}
              editingRoute={editingRoute}
              setEditingRoute={setEditingRoute}
              isCopyingRoute={isCopyingRoute}
              setIsCopyingRoute={setIsCopyingRoute}
              routeForm={routeForm}
              setRouteForm={setRouteForm}
              routePricePeriods={routePricePeriods}
              setRoutePricePeriods={setRoutePricePeriods}
              showAddPricePeriod={showAddPricePeriod}
              setShowAddPricePeriod={setShowAddPricePeriod}
              pricePeriodForm={pricePeriodForm}
              setPricePeriodForm={setPricePeriodForm}
              editingPricePeriodId={editingPricePeriodId}
              setEditingPricePeriodId={setEditingPricePeriodId}
              routeSurcharges={routeSurcharges}
              setRouteSurcharges={setRouteSurcharges}
              showAddRouteSurcharge={showAddRouteSurcharge}
              setShowAddRouteSurcharge={setShowAddRouteSurcharge}
              routeSurchargeForm={routeSurchargeForm}
              setRouteSurchargeForm={setRouteSurchargeForm}
              editingRouteSurchargeId={editingRouteSurchargeId}
              setEditingRouteSurchargeId={setEditingRouteSurchargeId}
              routeFormStops={routeFormStops}
              setRouteFormStops={setRouteFormStops}
              allRouteStops={allRouteStops}
              showAddRouteStop={showAddRouteStop}
              setShowAddRouteStop={setShowAddRouteStop}
              editingRouteStop={editingRouteStop}
              setEditingRouteStop={setEditingRouteStop}
              routeStopForm={routeStopForm}
              setRouteStopForm={setRouteStopForm}
              routeFormStopsHistory={routeFormStopsHistory}
              setRouteFormStopsHistory={setRouteFormStopsHistory}
              routeFormFaresHistory={routeFormFaresHistory}
              setRouteFormFaresHistory={setRouteFormFaresHistory}
              routeFormFares={routeFormFares}
              setRouteFormFares={setRouteFormFares}
              showAddRouteFare={showAddRouteFare}
              setShowAddRouteFare={setShowAddRouteFare}
              editingRouteFareIdx={editingRouteFareIdx}
              setEditingRouteFareIdx={setEditingRouteFareIdx}
              routeFareForm={routeFareForm}
              setRouteFareForm={setRouteFareForm}
              routeImageUploading={routeImageUploading}
              setRouteModalEditingId={setRouteModalEditingId}
              handleSaveRoute={handleSaveRoute}
              handleRouteImageUpload={handleRouteImageUpload}
              handleDeleteRoute={handleDeleteRoute}
              handleStartEditRoute={handleStartEditRoute}
              handleCopyRoute={handleCopyRoute}
              handleSaveRouteNote={handleSaveRouteNote}
            />
          </Suspense>
        );

            case 'vehicles':
        return <VehiclesPage vehicles={vehicles as any[]} language={language} uniqueVehicleTypes={uniqueVehicleTypes} />;


      case 'operations': {
        // Pre-compute active employee names (drivers first) for driver select
        const activeEmployeeNames = [
          ...employees.filter(e => e.role === 'DRIVER' && e.status === 'ACTIVE').map(e => e.name),
          ...employees.filter(e => e.role !== 'DRIVER' && e.status === 'ACTIVE').map(e => e.name),
        ];
        const filteredTrips = trips.filter(trip => {
          if (trip.status === TripStatus.COMPLETED) return false;
          // Quick dropdown filters
          if (tripFilterStatus !== 'ALL' && trip.status !== tripFilterStatus) return false;
          if (tripFilterRoute && trip.route !== tripFilterRoute) return false;
          if (tripFilterTime && trip.time !== tripFilterTime) return false;
          if (tripFilterVehicle && trip.licensePlate !== tripFilterVehicle) return false;
          if (tripFilterDriver && trip.driverName !== tripFilterDriver) return false;
          // Advanced date-range filters
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
                <button onClick={() => { setShowBatchAddTrip(true); setBatchTripForm({ dateFrom: '', dateTo: '', route: '', licensePlate: '', driverName: '', price: 0, agentPrice: 0, seatCount: 11 }); setBatchTimeSlots(['']); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm">⚡ {t.batch_add_trips}</button>
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
                      <p className="text-sm text-gray-500 mt-1">{language === 'vi' ? 'Chọn khoảng ngày và nhiều khung giờ để tạo nhiều chuyến cùng lúc' : 'Select a date range and multiple time slots to create many trips at once'}</p>
                    </div>
                    <button onClick={() => setShowBatchAddTrip(false)} className="p-2 hover:bg-gray-50 rounded-xl"><X size={20} /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.batch_date_from}</label>
                      <input type="date" value={batchTripForm.dateFrom} min={getLocalDateString(0)} onChange={e => {
                        const dateFrom = e.target.value;
                        const selectedRoute = routes.find(r => r.name === batchTripForm.route);
                        if (selectedRoute) {
                          const period = getRouteActivePeriod(selectedRoute, dateFrom);
                          const price = period ? period.price : selectedRoute.price;
                          const agentPrice = period ? period.agentPrice : (selectedRoute.agentPrice || 0);
                          setBatchTripForm(p => ({ ...p, dateFrom, dateTo: p.dateTo && p.dateTo < dateFrom ? dateFrom : p.dateTo, price, agentPrice }));
                        } else {
                          setBatchTripForm(p => ({ ...p, dateFrom, dateTo: p.dateTo && p.dateTo < dateFrom ? dateFrom : p.dateTo }));
                        }
                      }} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.batch_date_to}</label>
                      <input type="date" value={batchTripForm.dateTo} min={batchTripForm.dateFrom || getLocalDateString(0)} onChange={e => {
                        setBatchTripForm(p => ({ ...p, dateTo: e.target.value }));
                      }} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" />
                    </div>
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
                      {batchTripForm.dateFrom && (
                        <p className="text-[10px] text-blue-500 mt-0.5 ml-1">
                          {language === 'vi' ? '* Giá hiển thị theo kỳ cao điểm (nếu có), ngày thường dùng giá mặc định' : '* Price shown by peak period (if any), regular dates use default price'}
                        </p>
                      )}
                      <select value={batchTripForm.route} onChange={e => {
                        const routeName = e.target.value;
                        const selectedRoute = routes.find(r => r.name === routeName);
                        if (selectedRoute) {
                          const period = getRouteActivePeriod(selectedRoute, batchTripForm.dateFrom);
                          const price = period ? period.price : selectedRoute.price;
                          const agentPrice = period ? period.agentPrice : (selectedRoute.agentPrice || 0);
                          setBatchTripForm(p => ({ ...p, route: routeName, price, agentPrice }));
                        } else {
                          setBatchTripForm(p => ({ ...p, route: routeName }));
                        }
                      }} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none">
                        <option value="">{language === 'vi' ? '-- Chọn tuyến --' : '-- Select Route --'}</option>
                        {routes.filter(r => isRouteValidForDate(r, batchTripForm.dateFrom)).map(r => {
                          const period = getRouteActivePeriod(r, batchTripForm.dateFrom);
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
                  {(() => {
                    const validSlots = batchTimeSlots.filter(s => s);
                    let dayCount = 0;
                    if (batchTripForm.dateFrom && batchTripForm.dateTo && batchTripForm.dateTo >= batchTripForm.dateFrom) {
                      const from = new Date(batchTripForm.dateFrom + 'T00:00:00');
                      const to = new Date(batchTripForm.dateTo + 'T00:00:00');
                      dayCount = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
                    }
                    const totalTrips = dayCount * validSlots.length;
                    if (!batchTripForm.dateFrom || !batchTripForm.dateTo || validSlots.length === 0) return null;
                    return (
                      <div className="bg-blue-50 rounded-xl p-4">
                        <p className="text-sm font-bold text-blue-700 mb-2">
                          📋 {t.trips_to_create}: {dayCount} {language === 'vi' ? 'ngày' : 'days'} × {validSlots.length} {language === 'vi' ? 'khung giờ' : 'time slots'} = <span className="text-blue-900">{totalTrips} {language === 'vi' ? 'chuyến' : 'trips'}</span>
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {validSlots.map((slot, i) => (
                            <span key={i} className="px-3 py-1 bg-white text-blue-700 text-xs font-bold rounded-full border border-blue-200">{slot}</span>
                          ))}
                        </div>
                        {dayCount > 0 && (
                          <p className="text-xs text-blue-500 mt-2">{batchTripForm.dateFrom} → {batchTripForm.dateTo}</p>
                        )}
                      </div>
                    );
                  })()}
                  <div className="flex justify-end gap-4 pt-2">
                    <button onClick={() => setShowBatchAddTrip(false)} className="px-6 py-3 text-sm font-bold text-gray-400 hover:text-gray-600">{t.cancel}</button>
                    {(() => {
                      const validSlots = batchTimeSlots.filter(s => s).length;
                      let dayCount = 0;
                      if (batchTripForm.dateFrom && batchTripForm.dateTo && batchTripForm.dateTo >= batchTripForm.dateFrom) {
                        const from = new Date(batchTripForm.dateFrom + 'T00:00:00');
                        const to = new Date(batchTripForm.dateTo + 'T00:00:00');
                        dayCount = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
                      }
                      const totalTrips = dayCount * validSlots;
                      const isDisabled = batchTripLoading || !batchTripForm.dateFrom || !batchTripForm.dateTo || batchTripForm.dateTo < batchTripForm.dateFrom || !batchTripForm.route || validSlots === 0;
                      return (
                        <button onClick={handleBatchAddTrips} disabled={isDisabled} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center gap-2">
                          {batchTripLoading && <span className="animate-spin">⚡</span>}
                          {language === 'vi' ? `Tạo ${totalTrips} chuyến` : `Create ${totalTrips} Trips`}
                        </button>
                      );
                    })()}
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

            {/* Quick Dropdown Filters: route, time, vehicle, driver */}
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={tripFilterRoute}
                onChange={e => setTripFilterRoute(e.target.value)}
                className={cn('px-3 py-2 rounded-xl text-xs font-bold border transition-all focus:outline-none', tripFilterRoute ? 'bg-daiichi-red text-white border-daiichi-red' : 'bg-white text-gray-600 border-gray-200 hover:border-daiichi-red/40')}
              >
                <option value="">{t.all_routes}</option>
                {routes.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
              </select>
              <select
                value={tripFilterTime}
                onChange={e => setTripFilterTime(e.target.value)}
                className={cn('px-3 py-2 rounded-xl text-xs font-bold border transition-all focus:outline-none', tripFilterTime ? 'bg-daiichi-red text-white border-daiichi-red' : 'bg-white text-gray-600 border-gray-200 hover:border-daiichi-red/40')}
              >
                <option value="">{language === 'vi' ? 'Tất cả giờ' : 'All Times'}</option>
                {Array.from(new Set(trips.filter(t => t.status !== TripStatus.COMPLETED && t.time).map(t => t.time))).sort().map(time => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
              <select
                value={tripFilterVehicle}
                onChange={e => setTripFilterVehicle(e.target.value)}
                className={cn('px-3 py-2 rounded-xl text-xs font-bold border transition-all focus:outline-none', tripFilterVehicle ? 'bg-daiichi-red text-white border-daiichi-red' : 'bg-white text-gray-600 border-gray-200 hover:border-daiichi-red/40')}
              >
                <option value="">{t.all_vehicles}</option>
                {vehicles.map(v => <option key={v.id} value={v.licensePlate}>{v.licensePlate}</option>)}
              </select>
              <select
                value={tripFilterDriver}
                onChange={e => setTripFilterDriver(e.target.value)}
                className={cn('px-3 py-2 rounded-xl text-xs font-bold border transition-all focus:outline-none', tripFilterDriver ? 'bg-daiichi-red text-white border-daiichi-red' : 'bg-white text-gray-600 border-gray-200 hover:border-daiichi-red/40')}
              >
                <option value="">{t.all_drivers}</option>
                {activeEmployeeNames.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
              {(tripFilterRoute || tripFilterTime || tripFilterVehicle || tripFilterDriver) && (
                <button
                  onClick={() => { setTripFilterRoute(''); setTripFilterTime(''); setTripFilterVehicle(''); setTripFilterDriver(''); }}
                  className="px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 bg-white text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all flex items-center gap-1"
                >
                  <X size={12} /> {language === 'vi' ? 'Xóa lọc' : 'Clear'}
                </button>
              )}
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                  <button onClick={() => { setTripFilterRoute(''); setTripFilterTime(''); setTripFilterVehicle(''); setTripFilterDriver(''); setTripFilterStatus('ALL'); setTripFilterDateFrom(''); setTripFilterDateTo(''); }} className="px-4 py-2 text-sm font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl">
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
                          <button onClick={() => exportTripToExcelHandler(showTripPassengers)} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700"><Download size={12} /> Excel</button>
                          <button onClick={() => exportTripToPDFHandler(showTripPassengers)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700"><FileText size={12} /> PDF</button>
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
                        <td className="px-6 py-4"><div className="flex gap-3 items-center"><button onClick={() => exportTripToExcelHandler(trip)} title={language === 'vi' ? 'Xuất Excel' : 'Export Excel'} className="text-green-600 hover:text-green-700 hover:bg-green-50 p-1 rounded"><Download size={16} /></button><button onClick={() => exportTripToPDFHandler(trip)} title={language === 'vi' ? 'Xuất PDF' : 'Export PDF'} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-1 rounded"><FileText size={16} /></button><button onClick={() => handleCopyTrip(trip)} title={t.copy_trip} className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 p-1 rounded"><Copy size={16} /></button><button onClick={() => handleStartEditTrip(trip)} className="text-gray-600 hover:text-daiichi-red"><Edit3 size={18} /></button><button onClick={() => handleDeleteTrip(trip.id)} className="text-gray-600 hover:text-red-600"><Trash2 size={18} /></button><NotePopover note={trip.note} onSave={(note) => handleSaveTripNote(trip.id, note)} language={language} /><button onClick={goToSeatMap} className="text-daiichi-red hover:underline font-bold text-sm">{t.view_seats}</button></div></td>
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

      case 'completed-trips':
        return (
          <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={32} /></div>}>
            <CompletedTripsPage
              trips={trips}
              bookings={bookings}
              routes={routes}
              language={language}
              tripSearch={tripSearch}
              setTripSearch={setTripSearch}
              completedTripDateQuickFilter={completedTripDateQuickFilter}
              setCompletedTripDateQuickFilter={setCompletedTripDateQuickFilter}
              showCompletedTripAdvancedFilter={showCompletedTripAdvancedFilter}
              setShowCompletedTripAdvancedFilter={setShowCompletedTripAdvancedFilter}
              completedTripFilterRoute={completedTripFilterRoute}
              setCompletedTripFilterRoute={setCompletedTripFilterRoute}
              completedTripFilterDateFrom={completedTripFilterDateFrom}
              setCompletedTripFilterDateFrom={setCompletedTripFilterDateFrom}
              completedTripFilterDateTo={completedTripFilterDateTo}
              setCompletedTripFilterDateTo={setCompletedTripFilterDateTo}
              showTripPassengers={showTripPassengers}
              setShowTripPassengers={setShowTripPassengers}
              editingPassengerSeatId={editingPassengerSeatId}
              setEditingPassengerSeatId={setEditingPassengerSeatId}
              passengerEditForm={passengerEditForm}
              setPassengerEditForm={setPassengerEditForm}
              passengerColVisibility={passengerColVisibility}
              setPassengerColVisibility={setPassengerColVisibility}
              showPassengerColPanel={showPassengerColPanel}
              setShowPassengerColPanel={setShowPassengerColPanel}
              showTripAddons={showTripAddons}
              setShowTripAddons={setShowTripAddons}
              showAddTripAddon={showAddTripAddon}
              setShowAddTripAddon={setShowAddTripAddon}
              tripAddonForm={tripAddonForm}
              setTripAddonForm={setTripAddonForm}
              tripColVisibility={tripColVisibility}
              tripColWidths={tripColWidths}
              setTripColWidths={setTripColWidths}
              formatTripDisplayTime={formatTripDisplayTime}
              compareTripDateTime={compareTripDateTime}
              buildSeatTicketCodeMap={buildSeatTicketCodeMap}
              buildPassengerGroups={buildPassengerGroups}
              handleClosePassengerModal={handleClosePassengerModal}
              handleSavePassengerEdit={handleSavePassengerEdit}
              handleDeletePassenger={handleDeletePassenger}
              exportTripToExcelHandler={exportTripToExcelHandler}
              exportTripToPDFHandler={exportTripToPDFHandler}
              handleCopyTrip={handleCopyTrip}
              handleStartEditTrip={handleStartEditTrip}
              handleDeleteTrip={handleDeleteTrip}
              handleSaveTripNote={handleSaveTripNote}
              handleAddTripAddon={handleAddTripAddon}
              handleDeleteTripAddon={handleDeleteTripAddon}
              setSelectedTrip={setSelectedTrip}
              setPreviousTab={setPreviousTab}
              setActiveTab={setActiveTab}
            />
          </Suspense>
        );

      case 'stop-management':
        return <StopManagement language={language} stops={stops} onUpdateStops={setStops} />;

      case 'financial-report':
        return <FinancialReport language={language} agents={agents} bookings={bookings} invoices={invoices} />;

      case 'payment-management':
        return (
          <ErrorBoundary language={language} componentName="Payment Management">
            <PaymentManagement
              language={language}
              bookings={bookings}
              agents={agents}
              currentUser={currentUser}
              onUpdateAgent={handleUpdateAgent}
            />
          </ErrorBoundary>
        );

      case 'consignments':
           return <ConsignmentsPage consignments={consignments} currentUser={currentUser} language={language} />;

      case 'user-guide':
        return <UserGuide language={language} currentUser={currentUser} userGuides={userGuides} />;


      case 'pickup-dropoff':
        return (
          <PickupDropoffManagement
            language={language}
            trips={trips}
            employees={employees}
            driverAssignments={driverAssignments}
            bookings={bookings}
            currentUserName={currentUser?.name || ''}
          />
        );

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

      {/* Staff Chat (visible to MANAGER and employees) */}
      {(currentUser?.role === UserRole.MANAGER || (currentUser?.role && currentUser.role !== UserRole.AGENT && currentUser.role !== UserRole.CUSTOMER && currentUser.role !== UserRole.GUEST)) && (
        <Suspense fallback={null}>
          <StaffChat
            language={language}
            currentUserName={currentUser?.name || ''}
            currentUserId={currentUser?.id || ''}
            employees={employees}
            messages={staffMessages}
          />
        </Suspense>
      )}

      {/* Driver task panel (visible to drivers – employees with DRIVER role) */}
      {currentUser && currentUser.role === 'DRIVER' && (
        <Suspense fallback={null}>
          <DriverTaskPanel
            language={language}
            driverEmployeeId={currentUser.id}
            driverName={currentUser.name}
            assignments={driverAssignments}
          />
        </Suspense>
      )}
      
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
        <Suspense fallback={null}>
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
        </Suspense>
      )}

      {/* Agent top-up modal – for agent users on the home view */}
      {agentTopUpModal && currentUser?.role === UserRole.AGENT && (() => {
        const agentData = agents.find(a => a.id === currentUser.id);
        if (!agentData) return null;
        return (
          <Suspense fallback={null}>
            <AgentTopUpQRModal
              agentName={agentData.name}
              agentCode={agentData.code}
              language={language}
              onClose={() => setAgentTopUpModal(false)}
            />
          </Suspense>
        );
      })()}

      <Suspense fallback={null}>
        <TicketModal
          isOpen={isTicketOpen}
          onClose={() => {
            setIsTicketOpen(false);
            // Combined round-trip ticket: reset round-trip state and go to book-ticket
            if (lastBooking?.isRoundTrip && previousTab === 'book-ticket') {
              setRoundTripPhase('outbound');
              setOutboundBookingData(null);
              setCapturedOutboundLeg(null);
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
      </Suspense>
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
              <Suspense fallback={
                <div className="flex items-center justify-center min-h-[400px]">
                  <Loader2 size={32} className="animate-spin text-daiichi-red" />
                </div>
              }>
                {renderContent()}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
