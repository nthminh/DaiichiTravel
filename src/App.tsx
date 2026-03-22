import React, { useState, useEffect, useMemo, useRef, Suspense, lazy } from 'react';
import { 
  Users, Package, LayoutDashboard, ChevronRight, 
  MapPin, Calendar, Truck, Search, 
  Clock, Edit3, Trash2, Wallet, X, CheckCircle2,
  Menu, Bell, Globe, LogOut, Eye, EyeOff, AlertTriangle, Info,
  Filter, Gift, Download, FileText, Copy, Columns, SlidersHorizontal, Loader2,
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
import { useWebSocket } from './hooks/useWebSocket';
import { useAuth } from './hooks/useAuth';
import { usePassengerManagement } from './hooks/usePassengerManagement';
import { Stop, Trip, Consignment, Agent, Route, TripAddon, PricePeriod, RouteSurcharge, RouteStop, Employee, AgentPaymentOption, Invoice, UserGuide as UserGuideType, CustomerProfile, Vehicle, VehicleSeat, User } from './types';
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
import { buildSeatTicketCodeMap as libBuildSeatTicketCodeMap, buildPassengerGroups as libBuildPassengerGroups } from './lib/bookingUtils';

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
const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
import { DriverAssignment, StaffMessage } from './types';
import type { TourItem } from './components/TourBookingForm';

// Re-export types for components
export { UserRole, TripStatus, SeatStatus, TRANSLATIONS };
export type { Language, User };



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
  // New: controls whether the pre-booking info form (step 1) is shown before seat selection
  const [showPreBookingInfo, setShowPreBookingInfo] = useState(false);
  const [activeDeck, setActiveDeck] = useState(0);
  const [tripType, setTripType] = useState<'ONE_WAY' | 'ROUND_TRIP'>('ONE_WAY');
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [pickupPoint, setPickupPoint] = useState('');
  const [dropoffPoint, setDropoffPoint] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [pickupAddressDetail, setPickupAddressDetail] = useState('');
  const [dropoffAddressDetail, setDropoffAddressDetail] = useState('');
  const [pickupStopAddress, setPickupStopAddress] = useState('');
  const [dropoffStopAddress, setDropoffStopAddress] = useState('');
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
  const [tripFilterSeatCount, setTripFilterSeatCount] = useState('');
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

  // WebSocket setup with exponential backoff reconnect logic (extracted to useWebSocket hook)
  const { ws, notifications } = useWebSocket();

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
    isSavingRoute,
    routeSaveError,
    setRouteSaveError,
    routeConflictWarning,
    setRouteConflictWarning,
    handleSaveRoute,
    handleForceSaveRoute,
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
    isSavingTrip,
    tripSaveError,
    setTripSaveError,
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
    selectedTripIdsForMerge,
    setSelectedTripIdsForMerge,
    mergeLoading,
    mergeError,
    setMergeError,
    handleToggleTripForMerge,
    handleMergeTrips,
  } = useTrips({ vehicles, language });

  // ─── Auth helpers (logic extracted to useAuth hook) ──────────────────────────
  const { handleRegisterMember, handleOtpMemberLogin } = useAuth({ language, customers });

  // ─── Passenger management (logic extracted to usePassengerManagement hook) ───
  const {
    showTripPassengers,
    setShowTripPassengers,
    editingPassengerSeatId,
    setEditingPassengerSeatId,
    passengerEditForm,
    setPassengerEditForm,
    passengerColVisibility,
    setPassengerColVisibility,
    showPassengerColPanel,
    setShowPassengerColPanel,
    handleClosePassengerModal,
    handleSavePassengerEdit,
    handleDeletePassenger,
  } = usePassengerManagement({ language, bookings, setTrips });

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

  const [paymentConfig, setPaymentConfig] = useState<{ bookingCutoffEnabled: boolean; bookingCutoffMinutes: number }>({ bookingCutoffEnabled: true, bookingCutoffMinutes: 120 });

  // Subscribe to payment settings changes in real-time (to get booking cutoff config)
  useEffect(() => {
    const unsubscribe = transportService.subscribeToPaymentSettings((saved) => {
      if (saved && typeof saved === 'object') {
        setPaymentConfig({
          bookingCutoffEnabled: typeof saved.bookingCutoffEnabled === 'boolean' ? saved.bookingCutoffEnabled : true,
          bookingCutoffMinutes: typeof saved.bookingCutoffMinutes === 'number' ? saved.bookingCutoffMinutes : 120,
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

  // Auto-fill name & phone for logged-in customers whenever the pre-booking info form or booking form opens
  useEffect(() => {
    if ((showPreBookingInfo || showBookingForm) && currentUser?.role === UserRole.CUSTOMER) {
      const name = currentUser.name;
      const phone = currentUser.phone;
      if (name) setCustomerNameInput(prev => prev || name);
      if (phone) setPhoneInput(prev => prev || phone);
    }
  }, [showPreBookingInfo, showBookingForm, currentUser?.role, currentUser?.name, currentUser?.phone]);

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

  // When a new trip is selected for booking, show the info form first (step 1)
  // and auto-fill pickup/dropoff from search parameters if available.
  useEffect(() => {
    if (!selectedTrip) return;
    setShowPreBookingInfo(true);
    setShowBookingForm(null);
    setExtraSeatIds([]);
    setAddonQuantities({});
    setFareAmount(null);
    setFareError('');

    const tripRoute = routes.find((r) => r.name === selectedTrip.route);
    const isReturnPhaseNow = tripType === 'ROUND_TRIP' && roundTripPhase === 'return';
    const fromSearch = isReturnPhaseNow ? searchTo : searchFrom;
    const toSearch = isReturnPhaseNow ? searchFrom : searchTo;

    let newFromId = '';
    let newToId = '';

    if (fromSearch) {
      setPickupPoint(fromSearch);
      const routeStop = tripRoute?.routeStops?.find((rs) => rs.stopName === fromSearch);
      const globalStop = stops.find((s) => s.name === fromSearch);
      newFromId = routeStop?.stopId || globalStop?.id || '';
      if (newFromId) setFromStopId(newFromId);
      if (globalStop?.surcharge) setPickupSurcharge(globalStop.surcharge);
    }

    if (toSearch) {
      setDropoffPoint(toSearch);
      const routeStop = tripRoute?.routeStops?.find((rs) => rs.stopName === toSearch);
      const globalStop = stops.find((s) => s.name === toSearch);
      newToId = routeStop?.stopId || globalStop?.id || '';
      if (newToId) setToStopId(newToId);
      if (globalStop?.surcharge) setDropoffSurcharge(globalStop.surcharge);
    }

    // Trigger fare lookup immediately if both stops are identified
    if (newFromId && newToId && (tripRoute?.routeStops?.length ?? 0) > 0) {
      lookupFare(tripRoute, newFromId, newToId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTrip?.id]);

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
    agents,
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
    pickupAddressDetail,
    dropoffAddressDetail,
    pickupStopAddress,
    dropoffStopAddress,
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
      setShowPreBookingInfo(true); // Show info form again for the return leg
      setActiveTab('book-ticket');
      // Carry over customer name & phone from outbound to return phase
      const { customerName, phone } = summary;
      if (customerName) { setCustomerNameInput(customerName); setInquiryName(customerName); }
      if (phone) { setPhoneInput(phone); setInquiryPhone(phone); }
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
    setPickupAddressDetail,
    setDropoffAddressDetail,
    setPickupStopAddress,
    setDropoffStopAddress,
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
          <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={32} /></div>}>
            <HomePage
              language={language}
              currentUser={currentUser}
              agents={agents}
              setActiveTab={setActiveTab}
              setAgentTopUpModal={setAgentTopUpModal}
            />
          </Suspense>
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
              showPreBookingInfo={showPreBookingInfo}
              customerNameInput={customerNameInput}
              phoneInput={phoneInput}
              pickupPoint={pickupPoint}
              dropoffPoint={dropoffPoint}
              pickupAddress={pickupAddress}
              dropoffAddress={dropoffAddress}
              pickupAddressDetail={pickupAddressDetail}
              dropoffAddressDetail={dropoffAddressDetail}
              pickupStopAddress={pickupStopAddress}
              dropoffStopAddress={dropoffStopAddress}
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
              setShowPreBookingInfo={setShowPreBookingInfo}
              setCustomerNameInput={setCustomerNameInput}
              setPhoneInput={setPhoneInput}
              setPickupPoint={setPickupPoint}
              setDropoffPoint={setDropoffPoint}
              setPickupAddress={setPickupAddress}
              setDropoffAddress={setDropoffAddress}
              setPickupAddressDetail={setPickupAddressDetail}
              setDropoffAddressDetail={setDropoffAddressDetail}
              setPickupStopAddress={setPickupStopAddress}
              setDropoffStopAddress={setDropoffStopAddress}
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
        return <AgentsPage agents={agents} employees={employees} language={language} routes={routes} />;

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
              isSavingRoute={isSavingRoute}
              routeSaveError={routeSaveError}
              setRouteSaveError={setRouteSaveError}
              routeConflictWarning={routeConflictWarning}
              setRouteConflictWarning={setRouteConflictWarning}
              handleSaveRoute={handleSaveRoute}
              handleForceSaveRoute={handleForceSaveRoute}
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
              tripFilterSeatCount={tripFilterSeatCount}
              setTripFilterSeatCount={setTripFilterSeatCount}
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
              isSavingTrip={isSavingTrip}
              tripSaveError={tripSaveError}
              setTripSaveError={setTripSaveError}
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
              selectedTripIdsForMerge={selectedTripIdsForMerge}
              setSelectedTripIdsForMerge={setSelectedTripIdsForMerge}
              mergeLoading={mergeLoading}
              mergeError={mergeError}
              setMergeError={setMergeError}
              handleToggleTripForMerge={handleToggleTripForMerge}
              handleMergeTrips={() => handleMergeTrips(bookings)}
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
            onCancel={async () => {
              await pendingQrBooking.cancel();
              setPendingQrBooking(null);
            }}
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
