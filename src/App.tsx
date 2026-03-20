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
import { EmailLinkReenterForm } from './components/EmailLinkReenterForm';
import { useEmployees } from './hooks/useEmployees';
import { getBookingGroupSeatIds, buildSeatTicketCodeMap as libBuildSeatTicketCodeMap, buildPassengerGroups as libBuildPassengerGroups } from './lib/bookingUtils';

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
const OperationsPage = lazy(() => import('./pages/OperationsPage').then(m => ({ default: m.OperationsPage })));
const BookTicketPage = lazy(() => import('./pages/BookTicketPage').then(m => ({ default: m.BookTicketPage })));
const SeatMappingPage = lazy(() => import('./pages/SeatMappingPage').then(m => ({ default: m.SeatMappingPage })));
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
  const [pickupAddressSurcharge, setPickupAddressSurcharge] = useState(0);
  const [dropoffAddressSurcharge, setDropoffAddressSurcharge] = useState(0);
  // Fare-table state (Option 2: explicit fare lookup between stops)
  const [fareAmount, setFareAmount] = useState<number | null>(null);
  const [fareAgentAmount, setFareAgentAmount] = useState<number | null>(null); // agent-specific fare per segment
  const [fareError, setFareError] = useState<string>('');
  const [fareLoading, setFareLoading] = useState(false);
  const [fromStopId, setFromStopId] = useState('');
  const [toStopId, setToStopId] = useState('');
  // Seat ID that triggered a segment-conflict warning (cleared after a short timeout)

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

  // Employee data state (must be declared before useEmployees which needs agents)
  const [employees, setEmployees] = useState<Employee[]>([]);

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
  const [routeColWidths, setRouteColWidths] = useState({ stt: 80, name: 200, departure: 200, arrival: 200, price: 150, agentPrice: 150, duration: 140, options: 120 });
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

  // ─── Employee CRUD (logic extracted to useEmployees hook) ───────────────────
  const {
    showAddEmployee,
    setShowAddEmployee,
    editingEmployee,
    setEditingEmployee,
    employeeForm,
    setEmployeeForm,
    employeeFormError,
    setEmployeeFormError,
    handleSaveEmployee: _handleSaveEmployee,
    handleDeleteEmployee,
    handleStartEditEmployee,
  } = useEmployees({ language, agents });

  const handleSaveEmployee = () => _handleSaveEmployee(employees);

  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeRoleFilter, setEmployeeRoleFilter] = useState<string>('ALL');
  const [showEmployeeFilters, setShowEmployeeFilters] = useState(false);

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

  // Wrap imported pure functions with the local `bookings` dependency
  const buildSeatTicketCodeMap = (tripId: string) =>
    libBuildSeatTicketCodeMap(tripId, bookings);

  const buildPassengerGroups = (tripId: string, bookedSeats: any[]) =>
    libBuildPassengerGroups(tripId, bookedSeats, bookings);

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
    pickupAddressSurcharge,
    dropoffAddressSurcharge,
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
    setPickupAddressSurcharge,
    setDropoffAddressSurcharge,
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
          <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={32} /></div>}>
            <BookTicketPage
              trips={trips}
              routes={routes}
              vehicles={vehicles}
              language={language}
              searchFrom={searchFrom}
              searchTo={searchTo}
              searchDate={searchDate}
              searchReturnDate={searchReturnDate}
              vehicleTypeFilter={vehicleTypeFilter}
              bookTicketSearch={bookTicketSearch}
              priceMin={priceMin}
              priceMax={priceMax}
              searchTimeFrom={searchTimeFrom}
              searchTimeTo={searchTimeTo}
              hasSearched={hasSearched}
              clearedTripCards={clearedTripCards}
              searchAdults={searchAdults}
              searchChildren={searchChildren}
              roundTripPhase={roundTripPhase}
              outboundBookingData={outboundBookingData}
              tripType={tripType}
              showInquiryForm={showInquiryForm}
              inquiryName={inquiryName}
              inquiryPhone={inquiryPhone}
              inquiryEmail={inquiryEmail}
              inquiryNotes={inquiryNotes}
              inquiryLoading={inquiryLoading}
              inquirySuccess={inquirySuccess}
              inquiryError={inquiryError}
              currentUser={currentUser}
              tripCardImgIdx={tripCardImgIdx}
              paymentConfig={paymentConfig}
              showAddonDetailTrip={showAddonDetailTrip}
              setSearchFrom={setSearchFrom}
              setSearchTo={setSearchTo}
              setSearchDate={setSearchDate}
              setSearchReturnDate={setSearchReturnDate}
              setBookTicketSearch={setBookTicketSearch}
              setPriceMin={setPriceMin}
              setPriceMax={setPriceMax}
              setSearchTimeFrom={setSearchTimeFrom}
              setSearchTimeTo={setSearchTimeTo}
              setHasSearched={setHasSearched}
              setClearedTripCards={setClearedTripCards}
              setSearchAdults={setSearchAdults}
              setSearchChildren={setSearchChildren}
              setTripType={setTripType}
              setShowInquiryForm={setShowInquiryForm}
              setInquiryName={setInquiryName}
              setInquiryPhone={setInquiryPhone}
              setInquiryEmail={setInquiryEmail}
              setInquiryNotes={setInquiryNotes}
              setInquirySuccess={setInquirySuccess}
              handleInquirySubmit={handleInquirySubmit}
              setSelectedTrip={setSelectedTrip}
              setPreviousTab={setPreviousTab}
              setActiveTab={setActiveTab}
              setRoundTripPhase={setRoundTripPhase}
              setTripCardImgIdx={setTripCardImgIdx}
              setShowAddonDetailTrip={setShowAddonDetailTrip}
              compareTripDateTime={compareTripDateTime}
              formatTripDateDisplay={formatTripDateDisplay}
            />
          </Suspense>
        );
      case 'seat-mapping':
        if (!selectedTrip) return null;
        return (
          <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={32} /></div>}>
            <SeatMappingPage
              selectedTrip={selectedTrip}
              routes={routes}
              stops={stops}
              vehicles={vehicles}
              agents={agents}
              currentUser={currentUser}
              language={language}
              tripType={tripType}
              previousTab={previousTab}
              roundTripPhase={roundTripPhase}
              activeDeck={activeDeck}
              adults={adults}
              children={children}
              childrenAges={childrenAges}
              extraSeatIds={extraSeatIds}
              showBookingForm={showBookingForm}
              customerNameInput={customerNameInput}
              phoneInput={phoneInput}
              pickupPoint={pickupPoint}
              dropoffPoint={dropoffPoint}
              pickupAddress={pickupAddress}
              dropoffAddress={dropoffAddress}
              fromStopId={fromStopId}
              toStopId={toStopId}
              pickupSurcharge={pickupSurcharge}
              dropoffSurcharge={dropoffSurcharge}
              pickupAddressSurcharge={pickupAddressSurcharge}
              dropoffAddressSurcharge={dropoffAddressSurcharge}
              surchargeAmount={surchargeAmount}
              addonQuantities={addonQuantities}
              bookingNote={bookingNote}
              paymentMethodInput={paymentMethodInput}
              fareAmount={fareAmount}
              fareAgentAmount={fareAgentAmount}
              fareLoading={fareLoading}
              fareError={fareError}
              setActiveDeck={setActiveDeck}
              setAdults={setAdults}
              setChildren={setChildren}
              setChildrenAges={setChildrenAges}
              setExtraSeatIds={setExtraSeatIds}
              setSeatSelectionHistory={setSeatSelectionHistory}
              setShowBookingForm={setShowBookingForm}
              setCustomerNameInput={setCustomerNameInput}
              setPhoneInput={setPhoneInput}
              setPickupPoint={setPickupPoint}
              setDropoffPoint={setDropoffPoint}
              setPickupAddress={setPickupAddress}
              setDropoffAddress={setDropoffAddress}
              setFromStopId={setFromStopId}
              setToStopId={setToStopId}
              setPickupSurcharge={setPickupSurcharge}
              setDropoffSurcharge={setDropoffSurcharge}
              setPickupAddressSurcharge={setPickupAddressSurcharge}
              setDropoffAddressSurcharge={setDropoffAddressSurcharge}
              setSurchargeAmount={setSurchargeAmount}
              setAddonQuantities={setAddonQuantities}
              setBookingNote={setBookingNote}
              setPaymentMethodInput={setPaymentMethodInput}
              setFareAmount={setFareAmount}
              setFareError={setFareError}
              setActiveTab={setActiveTab}
              handleConfirmBooking={handleConfirmBooking}
              lookupFare={lookupFare}
            />
          </Suspense>
        );

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


      case 'operations':
        return (
          <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={32} /></div>}>
            <OperationsPage
              trips={trips}
              routes={routes}
              vehicles={vehicles}
              bookings={bookings}
              employees={employees}
              language={language}
              t={t}
              tripSearch={tripSearch}
              setTripSearch={setTripSearch}
              showTripAdvancedFilter={showTripAdvancedFilter}
              setShowTripAdvancedFilter={setShowTripAdvancedFilter}
              tripFilterRoute={tripFilterRoute}
              setTripFilterRoute={setTripFilterRoute}
              tripFilterStatus={tripFilterStatus}
              setTripFilterStatus={setTripFilterStatus}
              tripFilterDateFrom={tripFilterDateFrom}
              setTripFilterDateFrom={setTripFilterDateFrom}
              tripFilterDateTo={tripFilterDateTo}
              setTripFilterDateTo={setTripFilterDateTo}
              tripFilterTime={tripFilterTime}
              setTripFilterTime={setTripFilterTime}
              tripFilterVehicle={tripFilterVehicle}
              setTripFilterVehicle={setTripFilterVehicle}
              tripFilterDriver={tripFilterDriver}
              setTripFilterDriver={setTripFilterDriver}
              showAddTrip={showAddTrip}
              setShowAddTrip={setShowAddTrip}
              editingTrip={editingTrip}
              setEditingTrip={setEditingTrip}
              isCopyingTrip={isCopyingTrip}
              setIsCopyingTrip={setIsCopyingTrip}
              tripForm={tripForm}
              setTripForm={setTripForm}
              showBatchAddTrip={showBatchAddTrip}
              setShowBatchAddTrip={setShowBatchAddTrip}
              batchTripForm={batchTripForm}
              setBatchTripForm={setBatchTripForm}
              batchTimeSlots={batchTimeSlots}
              setBatchTimeSlots={setBatchTimeSlots}
              batchTripLoading={batchTripLoading}
              showTripAddons={showTripAddons}
              setShowTripAddons={setShowTripAddons}
              showAddTripAddon={showAddTripAddon}
              setShowAddTripAddon={setShowAddTripAddon}
              tripAddonForm={tripAddonForm}
              setTripAddonForm={setTripAddonForm}
              tripColWidths={tripColWidths}
              setTripColWidths={setTripColWidths}
              tripColVisibility={tripColVisibility}
              setTripColVisibility={setTripColVisibility}
              showTripColPanel={showTripColPanel}
              setShowTripColPanel={setShowTripColPanel}
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
              showAddonDetailTrip={showAddonDetailTrip}
              setShowAddonDetailTrip={setShowAddonDetailTrip}
              setSelectedTrip={setSelectedTrip}
              setPreviousTab={setPreviousTab}
              setActiveTab={setActiveTab}
              compareTripDateTime={compareTripDateTime}
              formatTripDisplayTime={formatTripDisplayTime}
              buildSeatTicketCodeMap={buildSeatTicketCodeMap}
              buildPassengerGroups={buildPassengerGroups}
              handleClosePassengerModal={handleClosePassengerModal}
              handleSavePassengerEdit={handleSavePassengerEdit}
              handleDeletePassenger={handleDeletePassenger}
              handleAddTripAddon={handleAddTripAddon}
              handleDeleteTripAddon={handleDeleteTripAddon}
              exportTripToExcelHandler={exportTripToExcelHandler}
              exportTripToPDFHandler={exportTripToPDFHandler}
              handleSaveTrip={handleSaveTrip}
              handleStartEditTrip={handleStartEditTrip}
              handleCopyTrip={handleCopyTrip}
              handleCopyTripsToDate={handleCopyTripsToDate}
              handleDeleteTrip={handleDeleteTrip}
              handleSaveTripNote={handleSaveTripNote}
              handleTripVehicleSelect={handleTripVehicleSelect}
              handleBatchVehicleSelect={handleBatchVehicleSelect}
              handleBatchAddTrips={handleBatchAddTrips}
              getRouteActivePeriod={getRouteActivePeriod}
              isRouteValidForDate={isRouteValidForDate}
              formatRouteOption={formatRouteOption}
            />
          </Suspense>
        );

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
