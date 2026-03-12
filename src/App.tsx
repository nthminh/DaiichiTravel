import React, { useState, useEffect } from 'react';
import { 
  Bus, Users, Package, LayoutDashboard, ChevronRight, 
  MapPin, Calendar, Truck, Star, Phone, Search, 
  Clock, Edit3, Trash2, Wallet, X, CheckCircle2,
  Menu, Bell, Globe, LogOut, Eye, EyeOff, AlertTriangle, Info,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

// Import Constants & Types
import { 
  UserRole, TripStatus, SeatStatus, Language, TRANSLATIONS 
} from './constants/translations';
import { Stop, Trip, Consignment, Agent, Route } from './types';
import { transportService } from './services/transportService';

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

// Re-export types for components
export { UserRole, TripStatus, SeatStatus, TRANSLATIONS };
export type { Language };

export const PAYMENT_METHODS = ['Tiền mặt', 'Chuyển khoản', 'Thẻ tín dụng', 'MoMo'] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];
const DEFAULT_PAYMENT_METHOD: PaymentMethod = 'Tiền mặt';
const PAYMENT_METHOD_TRANSLATION_KEYS: Record<PaymentMethod, string> = {
  'Tiền mặt': 'payment_cash',
  'Chuyển khoản': 'payment_transfer',
  'Thẻ tín dụng': 'payment_card',
  'MoMo': 'payment_momo',
};

export interface User {
  id: string;
  username: string;
  role: UserRole;
  name: string;
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
}

interface TourItem {
  id: string;
  title: string;
  description: string;
  price: number;
  imageUrl: string;
  discountPercent?: number;
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
  const [language, setLanguage] = useState<Language>('vi');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [consignments, setConsignments] = useState<Consignment[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<any>(null);
  const [showBookingForm, setShowBookingForm] = useState<string | null>(null);
  const [activeDeck, setActiveDeck] = useState(0);
  const [tripType, setTripType] = useState<'ONE_WAY' | 'ROUND_TRIP'>('ONE_WAY');
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [pickupPoint, setPickupPoint] = useState('');
  const [dropoffPoint, setDropoffPoint] = useState('');
  const [surchargeAmount, setSurchargeAmount] = useState(0);
  const [bookingDiscount, setBookingDiscount] = useState(0);
  const [pickupSurcharge, setPickupSurcharge] = useState(0);
  const [dropoffSurcharge, setDropoffSurcharge] = useState(0);
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
  const [searchFrom, setSearchFrom] = useState('');
  const [searchTo, setSearchTo] = useState('');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

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

  // Agent CRUD state
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [agentForm, setAgentForm] = useState({ name: '', code: '', phone: '', email: '', address: '', commissionRate: 10, balance: 0, status: 'ACTIVE' as const, username: '', password: '' });

  // Agent search / filter state
  const [agentSearch, setAgentSearch] = useState('');
  const [agentStatusFilter, setAgentStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [showAgentFilters, setShowAgentFilters] = useState(false);

  // Route CRUD state
  const [showAddRoute, setShowAddRoute] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [routeForm, setRouteForm] = useState({ stt: 1, name: '', departurePoint: '', arrivalPoint: '', price: 0 });

  // Vehicle CRUD state
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [vehicleForm, setVehicleForm] = useState({ licensePlate: '', type: 'Limousine 11 chỗ', seats: 11, registrationExpiry: '', status: 'ACTIVE' });

  // Vehicle seat diagram state
  const [diagramVehicle, setDiagramVehicle] = useState<Vehicle | null>(null);

  // Excel import refs removed

  // Trip CRUD state
  const [showAddTrip, setShowAddTrip] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [tripForm, setTripForm] = useState({ time: '', route: '', licensePlate: '', driverName: '', price: 0, seatCount: 11, status: TripStatus.WAITING });
  const [newConsignment, setNewConsignment] = useState({
    senderName: '', senderPhone: '', receiverName: '', receiverPhone: '',
    type: '', weight: '', cod: 0, notes: '',
  });

  // Persist user session to localStorage so F5 doesn't log out
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('currentUser');
    }
  }, [currentUser]);

  // Ensure agents and guests start on the home page
  useEffect(() => {
    if (currentUser && (currentUser.role === UserRole.AGENT || currentUser.role === UserRole.CUSTOMER)) {
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
  const [adminCredentials, setAdminCredentials] = useState({ username: 'admin', password: 'admin' });

  // Load admin credentials from Firebase on mount
  useEffect(() => {
    transportService.getAdminSettings()
      .then(saved => { if (saved) setAdminCredentials(saved); })
      .catch(err => console.error('Failed to load admin settings:', err));
  }, []);

  // Booking form inputs
  const [customerNameInput, setCustomerNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [childrenAges, setChildrenAges] = useState<number[]>([]);
  const [paymentMethodInput, setPaymentMethodInput] = useState<PaymentMethod>(DEFAULT_PAYMENT_METHOD);
  const [extraSeatIds, setExtraSeatIds] = useState<string[]>([]);
  // Ticket Modal State
  const [isTicketOpen, setIsTicketOpen] = useState(false);
  const [lastBooking, setLastBooking] = useState<any>(null);

  const t = TRANSLATIONS[language];

  useEffect(() => {
    const unsubscribeTrips = transportService.subscribeToTrips(setTrips);
    const unsubscribeConsignments = transportService.subscribeToConsignments(setConsignments);
    const unsubscribeAgents = transportService.subscribeToAgents(setAgents);
    const unsubscribeStops = transportService.subscribeToStops(setStops);
    const unsubscribeRoutes = transportService.subscribeToRoutes(setRoutes);
    const unsubscribeVehicles = transportService.subscribeToVehicles(setVehicles);
    const unsubscribeTours = transportService.subscribeToTours(setTours);
    return () => {
      unsubscribeTrips();
      unsubscribeConsignments();
      unsubscribeAgents();
      unsubscribeStops();
      unsubscribeRoutes();
      unsubscribeVehicles();
      unsubscribeTours();
    };
  }, []);

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
      setAgentForm({ name: '', code: '', phone: '', email: '', address: '', commissionRate: 10, balance: 0, status: 'ACTIVE', username: '', password: '' });
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
    setAgentForm({ name: agent.name, code: agent.code, phone: agent.phone, email: agent.email, address: agent.address || '', commissionRate: agent.commissionRate, balance: agent.balance, status: agent.status, username: agent.username || '', password: agent.password || '' });
    setShowAddAgent(true);
  };

  // --- Route CRUD handlers ---
  const handleSaveRoute = async () => {
    try {
      if (editingRoute) {
        await transportService.updateRoute(editingRoute.id, routeForm);
      } else {
        await transportService.addRoute(routeForm);
      }
      setShowAddRoute(false);
      setEditingRoute(null);
      setRouteForm({ stt: 1, name: '', departurePoint: '', arrivalPoint: '', price: 0 });
    } catch (err) {
      console.error('Failed to save route:', err);
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
    setRouteForm({ stt: route.stt, name: route.name, departurePoint: route.departurePoint, arrivalPoint: route.arrivalPoint, price: route.price });
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
      setVehicleForm({ licensePlate: '', type: 'Limousine 11 chỗ', seats: 11, registrationExpiry: '', status: 'ACTIVE' });
    } catch (err) {
      console.error('Failed to save vehicle:', err);
    }
  };

  const handleStartEditVehicle = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setVehicleForm({ licensePlate: vehicle.licensePlate, type: vehicle.type, seats: vehicle.seats, registrationExpiry: vehicle.registrationExpiry, status: vehicle.status || 'ACTIVE' });
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

  // --- Trip CRUD handlers ---
  const handleSaveTrip = async () => {
    try {
      // Find the vehicle to use its saved layout for proper seat labeling
      const vehicle = vehicles.find(v => v.licensePlate === tripForm.licensePlate);
      let seats: { id: string; row: number; col: number; deck: number; status: SeatStatus }[];

      const savedLayout = vehicle?.layout as SerializedSeat[] | null | undefined;
      if (savedLayout && savedLayout.length > 0) {
        seats = savedLayout.map(s => ({
          id: s.label,
          row: s.row,
          col: s.col,
          deck: s.deck,
          status: SeatStatus.EMPTY,
        }));
      } else {
        // Fall back to generating layout from vehicle type / seat count
        const generatedLayout = generateVehicleLayout(
          vehicle?.type || 'Ghế ngồi',
          tripForm.seatCount
        );
        const serialized = serializeLayout(generatedLayout);
        seats = serialized.map(s => ({
          id: s.label,
          row: s.row,
          col: s.col,
          deck: s.deck,
          status: SeatStatus.EMPTY,
        }));
      }

      if (editingTrip) {
        await transportService.updateTrip(editingTrip.id, { time: tripForm.time, route: tripForm.route, licensePlate: tripForm.licensePlate, driverName: tripForm.driverName, price: tripForm.price, status: tripForm.status });
      } else {
        await transportService.addTrip({ time: tripForm.time, route: tripForm.route, licensePlate: tripForm.licensePlate, driverName: tripForm.driverName, price: tripForm.price, status: tripForm.status, seats });
      }
      setShowAddTrip(false);
      setEditingTrip(null);
      setTripForm({ time: '', route: '', licensePlate: '', driverName: '', price: 0, seatCount: 11, status: TripStatus.WAITING });
    } catch (err) {
      console.error('Failed to save trip:', err);
    }
  };

  const handleStartEditTrip = (trip: Trip) => {
    setEditingTrip(trip);
    setTripForm({ time: trip.time, route: trip.route, licensePlate: trip.licensePlate, driverName: trip.driverName, price: trip.price, seatCount: trip.seats?.length || 11, status: trip.status });
    setShowAddTrip(true);
  };

  const handleDeleteTrip = async (tripId: string) => {
    if (!window.confirm(language === 'vi' ? 'Bạn có chắc muốn xóa chuyến này?' : 'Delete this trip?')) return;
    try {
      await transportService.deleteTrip(tripId);
    } catch (err) {
      console.error('Failed to delete trip:', err);
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

  const handleCreateConsignment = async () => {
    if (!newConsignment.senderName || !newConsignment.receiverName) return;
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
      });
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
    const basePriceAdult = selectedTrip.price || 0;
    const basePriceChild = selectedTrip.priceChild || basePriceAdult;
    
    // Children over 4 years old are charged adult price and need their own seat
    const { childrenOver4, childrenUnder4 } = childrenAges.reduce(
      (acc, age) => age > 4 ? { ...acc, childrenOver4: acc.childrenOver4 + 1 } : { ...acc, childrenUnder4: acc.childrenUnder4 + 1 },
      { childrenOver4: 0, childrenUnder4: 0 }
    );
    const effectiveAdults = adults + childrenOver4;
    const effectiveChildren = childrenUnder4 + Math.max(0, children - childrenAges.length);
    
    const totalBase = (effectiveAdults * basePriceAdult) + (effectiveChildren * basePriceChild);
    const totalSurcharge = pickupSurcharge + dropoffSurcharge + surchargeAmount;
    const totalAmount = Math.round((totalBase + totalSurcharge) * (1 - bookingDiscount / 100));

    // Extra seats for children over 4 (one seat per such child)
    const extraSeatsForBooking = extraSeatIds.slice(0, childrenOver4);
    const allSeatIds = [seatId, ...extraSeatsForBooking];

    const bookingData = {
      customerName: customerNameInput.trim() || (language === 'vi' ? 'Khách lẻ' : 'Walk-in'),
      phone: phoneInput.trim(),
      type: 'TRIP',
      route: selectedTrip.route,
      date: new Date().toLocaleDateString('vi-VN'),
      time: selectedTrip.time,
      tripId: selectedTrip.id,
      seatId,
      seatIds: allSeatIds,
      amount: totalAmount,
      agent: currentUser?.role === UserRole.AGENT ? currentUser.name : 'Trực tiếp',
      status: 'BOOKED',
      adults,
      children,
      pickupPoint,
      dropoffPoint,
      paymentMethod: paymentMethodInput,
    };

    try {
      // Save booking to Firebase
      const result = await transportService.createBooking(bookingData);

      // Update seat status in Firebase for all seats
      await transportService.bookSeat(selectedTrip.id, seatId, {
        status: SeatStatus.BOOKED,
        customerName: bookingData.customerName,
        customerPhone: bookingData.phone,
      });
      for (const extraSeatId of extraSeatsForBooking) {
        await transportService.bookSeat(selectedTrip.id, extraSeatId, {
          status: SeatStatus.BOOKED,
          customerName: bookingData.customerName,
          customerPhone: bookingData.phone,
        });
      }

      setLastBooking({ ...bookingData, id: result.id });
    } catch (err) {
      console.error('Failed to save booking:', err);
      setLastBooking(bookingData);
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
    setPickupSurcharge(0);
    setDropoffSurcharge(0);
    setSurchargeAmount(0);
    setBookingDiscount(0);
    setPaymentMethodInput(DEFAULT_PAYMENT_METHOD);

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
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard language={language} trips={trips} consignments={consignments} />;
      
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
                  <div className="flex flex-wrap gap-3">
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
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
                    <input type="date" className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-daiichi-red/10" defaultValue={new Date().toISOString().split('T')[0]} />
                  </div>
                </div>
                {tripType === 'ROUND_TRIP' && (
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.return_date}</label>
                    <div className="relative mt-1">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input type="date" className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-daiichi-red/10" />
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.vehicle_type}</label>
                  <div className="relative mt-1">
                    <Bus className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <select className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl appearance-none focus:ring-2 focus:ring-daiichi-red/10">
                      <option>{t.limo_11}</option>
                      <option>{t.bus_45}</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.adults}</label>
                    <div className="flex items-center gap-2 mt-1 px-3 py-3 bg-gray-50 border border-gray-100 rounded-2xl">
                      <Users className="text-gray-400 flex-shrink-0" size={18} />
                      <button type="button" onClick={() => setAdults(Math.max(1, adults - 1))} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-600 font-bold text-lg leading-none flex-shrink-0">−</button>
                      <span className="flex-1 text-center font-bold text-gray-800">{adults}</span>
                      <button type="button" onClick={() => setAdults(adults + 1)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-daiichi-red text-white font-bold text-lg leading-none flex-shrink-0">+</button>
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.children}</label>
                    <div className="flex items-center gap-2 mt-1 px-3 py-3 bg-gray-50 border border-gray-100 rounded-2xl">
                      <Users className="text-gray-400 flex-shrink-0" size={18} />
                      <button type="button" onClick={() => setChildren(Math.max(0, children - 1))} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-600 font-bold text-lg leading-none flex-shrink-0">−</button>
                      <span className="flex-1 text-center font-bold text-gray-800">{children}</span>
                      <button type="button" onClick={() => setChildren(children + 1)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-daiichi-red text-white font-bold text-lg leading-none flex-shrink-0">+</button>
                    </div>
                  </div>
                </div>
                <div className="flex items-end">
                  <button className="w-full py-4 bg-daiichi-red text-white rounded-2xl font-bold shadow-lg shadow-daiichi-red/20 hover:scale-[1.02] transition-all">{t.search_btn}</button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-bold px-2">{t.available_trips}</h3>
              {trips.map((trip) => (
                <div key={trip.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-center gap-8">
                  <div className="text-center md:text-left">
                    <p className="text-3xl font-bold text-gray-800">{trip.time}</p>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">{t.departure}</p>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="px-3 py-1 bg-daiichi-accent text-daiichi-red rounded-full text-[10px] font-bold uppercase">{trip.route}</span>
                      <span className="text-sm text-gray-400">•</span>
                      <span className="text-sm font-medium text-gray-600">{trip.licensePlate}</span>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Users size={16} />
                        <span>{t.driver}: {trip.driverName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Bus size={16} />
                        <span>{language === 'vi' ? 'Còn' : 'Only'} {trip.seats.filter(s => s.status === SeatStatus.EMPTY).length} {t.seats_left}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-daiichi-red mb-2">{trip.price.toLocaleString()}đ</p>
                    <button 
                      onClick={() => { setSelectedTrip(trip); setActiveTab('seat-mapping'); }}
                      className="px-8 py-3 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/10"
                    >
                      {t.select_seat}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'seat-mapping':
        if (!selectedTrip) return null;
        {
          const childrenOver4Count = childrenAges.filter(age => age > 4).length;
          const extraSeatsNeeded = childrenOver4Count;
          const canConfirmBooking = extraSeatsNeeded === 0 || extraSeatIds.length >= extraSeatsNeeded;
          const isSelectingExtraSeats = !!showBookingForm && childrenOver4Count > 0;

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

          const renderSeatButton = (seatId: string) => {
            const status = seatStatusMap[seatId] ?? SeatStatus.EMPTY;
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
                      setExtraSeatIds(prev => prev.filter(id => id !== seatId));
                    } else if (isSelectingExtraSeats && extraSeatIds.length < extraSeatsNeeded) {
                      setExtraSeatIds(prev => [...prev, seatId]);
                    } else if (!isSelectingExtraSeats) {
                      setExtraSeatIds([]);
                      setShowBookingForm(seatId);
                    }
                  } else {
                    setShowBookingForm(seatId);
                  }
                }}
                className={cn(
                  "h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all relative overflow-hidden",
                  status === SeatStatus.PAID && "bg-daiichi-red text-white shadow-lg shadow-daiichi-red/20",
                  status === SeatStatus.BOOKED && "bg-daiichi-yellow text-white shadow-lg shadow-daiichi-yellow/20",
                  isPrimarySeat && "bg-daiichi-red/20 border-2 border-daiichi-red text-daiichi-red",
                  isExtraSeat && "bg-blue-100 border-2 border-blue-500 text-blue-600",
                  status === SeatStatus.EMPTY && !isPrimarySeat && !isExtraSeat && "bg-white border-2 border-gray-100 text-gray-400 hover:border-daiichi-red hover:text-daiichi-red"
                )}
              >
                <span className="text-[10px] font-bold leading-none">{seatId}</span>
                <Users size={14} />
                {status === SeatStatus.PAID && <CheckCircle2 size={10} className="absolute top-1 right-1" />}
                {isExtraSeat && <span className="absolute top-0 right-0.5 text-[7px] font-bold text-blue-600">+</span>}
              </motion.button>
            );
          };

          return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-4 sm:p-8 rounded-[40px] shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold">{t.seat_map_title}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{selectedTrip.licensePlate}</p>
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
                            return <div key={colIdx} className="w-14 h-14 flex-shrink-0" />;
                          }
                          return (
                            <div key={colIdx} className="w-14 flex-shrink-0">
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

                <div className="mt-6 flex justify-center gap-6 text-xs font-bold uppercase tracking-wider">
                  <div className="flex items-center gap-2"><div className="w-4 h-4 bg-daiichi-red rounded" /> {t.paid}</div>
                  <div className="flex items-center gap-2"><div className="w-4 h-4 bg-daiichi-yellow rounded" /> {t.booked}</div>
                  <div className="flex items-center gap-2"><div className="w-4 h-4 bg-white border border-gray-200 rounded" /> {t.empty}</div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold mb-4">{t.trip_info}</h3>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">{t.total_seats}</span><span className="font-bold">{selectedTrip.seats.length}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">{t.paid_seats}</span><span className="font-bold text-green-600">{selectedTrip.seats.filter(s => s.status === SeatStatus.PAID).length}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">{t.booked_seats}</span><span className="font-bold text-daiichi-yellow">{selectedTrip.seats.filter(s => s.status === SeatStatus.BOOKED).length}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">{t.empty_seats}</span><span className="font-bold text-gray-400">{selectedTrip.seats.filter(s => s.status === SeatStatus.EMPTY).length}</span></div>
                </div>
              </div>

              {showBookingForm && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-white p-6 rounded-2xl shadow-sm border-2 border-daiichi-red">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">{t.booking_title}: {showBookingForm}</h3>
                    <button onClick={() => { setShowBookingForm(null); setExtraSeatIds([]); }} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                  </div>
                  <form className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">{t.adults}</label>
                        <div className="flex items-center gap-2 mt-1 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl">
                          <button type="button" onClick={() => setAdults(Math.max(1, adults - 1))} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 font-bold text-lg leading-none flex-shrink-0">−</button>
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
                              while (arr.length < count) arr.push(0);
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
                                type="number"
                                min="0"
                                max="17"
                                value={childrenAges[i] ?? ''}
                                placeholder={`${t.child_age_placeholder || 'Age'} ${i + 1}`}
                                onChange={e => {
                                  const ages = [...childrenAges];
                                  ages[i] = parseInt(e.target.value) || 0;
                                  setChildrenAges(ages);
                                  // Trim extra seats if children over 4 count decreased
                                  const newOver4Count = ages.filter(age => age > 4).length;
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

                    {/* Extra seats required notice for children over 4 */}
                    {childrenOver4Count > 0 && (
                      <div className={cn("p-3 rounded-xl border space-y-2", canConfirmBooking ? "bg-green-50 border-green-200" : "bg-orange-50 border-orange-200")}>
                        <p className={cn("text-xs font-bold uppercase", canConfirmBooking ? "text-green-600" : "text-orange-600")}>
                          {t.child_needs_seat || 'Children over 4 need their own seat'}
                        </p>
                        {!canConfirmBooking && (
                          <p className="text-[10px] text-orange-500">
                            {t.select_extra_seats_prompt || 'Please select extra seat(s) on the map for children over 4'} ({extraSeatIds.length}/{extraSeatsNeeded})
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
                    
                    {/* Pickup Point */}
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">{t.pickup_point}</label>
                      <SearchableSelect
                        options={stops.map(s => s.name)}
                        value={pickupPoint}
                        onChange={(val) => {
                          setPickupPoint(val);
                          const stop = stops.find(s => s.name === val);
                          setPickupSurcharge(stop?.surcharge || 0);
                        }}
                        placeholder={t.select_pickup}
                        className="mt-1"
                      />
                    </div>

                    {/* Dropoff Point */}
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">{t.dropoff_point}</label>
                      <SearchableSelect
                        options={stops.map(s => s.name)}
                        value={dropoffPoint}
                        onChange={(val) => {
                          setDropoffPoint(val);
                          const stop = stops.find(s => s.name === val);
                          setDropoffSurcharge(stop?.surcharge || 0);
                        }}
                        placeholder={t.select_dropoff}
                        className="mt-1"
                      />
                    </div>

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

                    <div className="p-4 bg-daiichi-accent/20 rounded-xl border border-daiichi-accent/30">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-500 uppercase">{t.total_amount}</span>
                        <span className="text-xl font-bold text-daiichi-red">
                          {(() => {
                            const basePriceAdult = selectedTrip.price || 0;
                            const basePriceChild = selectedTrip.priceChild || basePriceAdult;
                            const { childrenOver4, childrenUnder4 } = childrenAges.reduce(
                              (acc, age) => age > 4 ? { ...acc, childrenOver4: acc.childrenOver4 + 1 } : { ...acc, childrenUnder4: acc.childrenUnder4 + 1 },
                              { childrenOver4: 0, childrenUnder4: 0 }
                            );
                            const effectiveAdults = adults + childrenOver4;
                            const effectiveChildren = childrenUnder4 + Math.max(0, children - childrenAges.length);
                            const baseTotal = (effectiveAdults * basePriceAdult) + (effectiveChildren * basePriceChild) + pickupSurcharge + dropoffSurcharge + surchargeAmount;
                            return Math.round(baseTotal * (1 - bookingDiscount / 100)).toLocaleString();
                          })()}đ
                        </span>
                      </div>
                      {bookingDiscount > 0 && (
                        <p className="text-xs text-green-600 font-bold mt-1 text-right">-{bookingDiscount}% {t.booking_discount}</p>
                      )}
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
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold">{t.tours}</h2>
              <p className="text-sm text-gray-500">{language === 'vi' ? 'Khám phá các tour du lịch hấp dẫn' : 'Explore our amazing tour packages'}</p>
            </div>
            {tours.length === 0 ? (
              <div className="text-center py-20">
                <Star className="mx-auto text-gray-300 mb-4" size={48} />
                <p className="text-gray-400">{language === 'vi' ? 'Chưa có tour nào. Liên hệ để biết thêm!' : 'No tours available yet. Contact us for more info!'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {tours.map((tour) => {
                  const discountedPrice = tour.discountPercent && tour.discountPercent > 0
                    ? Math.round(tour.price * (1 - tour.discountPercent / 100))
                    : null;
                  return (
                    <div key={tour.id} className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md transition-all">
                      <div className="relative h-48 overflow-hidden">
                        <img src={tour.imageUrl} alt={tour.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                        {tour.discountPercent && tour.discountPercent > 0 ? (
                          <div className="absolute top-4 left-4 bg-daiichi-red text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">
                            -{tour.discountPercent}% {language === 'vi' ? 'GIẢM' : 'OFF'}
                          </div>
                        ) : null}
                      </div>
                      <div className="p-6">
                        <h4 className="text-lg font-bold mb-2">{tour.title}</h4>
                        <p className="text-sm text-gray-500 line-clamp-2 mb-4">{tour.description}</p>
                        <div className="flex justify-between items-end">
                          <div>
                            {discountedPrice ? (
                              <>
                                <p className="text-xl font-bold text-daiichi-red">{discountedPrice.toLocaleString()}đ</p>
                                <p className="text-xs text-gray-400 line-through">{tour.price.toLocaleString()}đ</p>
                              </>
                            ) : (
                              <p className="text-xl font-bold text-daiichi-red">{tour.price.toLocaleString()}đ</p>
                            )}
                          </div>
                          <button
                            onClick={() => { setSelectedTour(tour); setActiveTab('book-tour'); }}
                            className="px-5 py-2.5 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/20 hover:scale-105 transition-all text-sm"
                          >
                            {t.book_tour || (language === 'vi' ? 'Đặt tour' : 'Book Tour')}
                          </button>
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
        const accommodationCosts: Record<string, number> = { none: 0, standard: 300000, deluxe: 500000, suite: 800000 };
        const mealCosts: Record<string, number> = { none: 0, breakfast: 100000, half_board: 200000, full_board: 300000 };
        const totalPersons = tourBookingAdults + tourBookingChildren;
        const baseTourPrice = selectedTour
          ? (tourBookingAdults * (selectedTour.discountPercent
              ? Math.round(selectedTour.price * (1 - selectedTour.discountPercent / 100))
              : selectedTour.price))
            + (tourBookingChildren * Math.round((selectedTour.discountPercent
              ? Math.round(selectedTour.price * (1 - selectedTour.discountPercent / 100))
              : selectedTour.price) * 0.5))
          : 0;
        const accomCost = accommodationCosts[tourAccommodation] * totalPersons;
        const mealCost = mealCosts[tourMealPlan] * totalPersons;
        const tourTotal = baseTourPrice + accomCost + mealCost;

        if (tourBookingSuccess) {
          return (
            <div className="flex flex-col items-center justify-center py-20 space-y-6">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="text-green-500" size={40} />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">{t.tour_booking_success}</h2>
              <p className="text-gray-500 text-center max-w-md">
                {language === 'vi'
                  ? `Cảm ơn ${tourBookingName}! Chúng tôi sẽ liên hệ qua SĐT ${tourBookingPhone} để xác nhận tour.`
                  : `Thank you ${tourBookingName}! We will contact you at ${tourBookingPhone} to confirm your tour.`}
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => { setTourBookingSuccess(false); setActiveTab('tours'); }}
                  className="px-6 py-3 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50"
                >
                  {language === 'vi' ? 'Xem thêm tour' : 'Browse more tours'}
                </button>
                <button
                  onClick={() => { setTourBookingSuccess(false); setActiveTab('home'); }}
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
                  <p className="text-xs text-gray-500 line-clamp-2 mt-1">{selectedTour.description}</p>
                  <p className="text-daiichi-red font-bold mt-2">
                    {selectedTour.discountPercent && selectedTour.discountPercent > 0
                      ? <>{Math.round(selectedTour.price * (1 - selectedTour.discountPercent / 100)).toLocaleString()}đ <span className="text-xs text-gray-400 line-through">{selectedTour.price.toLocaleString()}đ</span></>
                      : <>{selectedTour.price.toLocaleString()}đ</>
                    }
                    <span className="text-xs font-normal text-gray-500 ml-1">/{language === 'vi' ? 'người lớn' : 'adult'}</span>
                  </p>
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
                    min={new Date().toISOString().split('T')[0]}
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
                <div className="flex justify-between text-sm"><span className="text-gray-500">{t.tour_price_per_adult} × {tourBookingAdults}</span><span className="font-bold">{selectedTour ? (Math.round((selectedTour.discountPercent ? Math.round(selectedTour.price * (1 - selectedTour.discountPercent / 100)) : selectedTour.price)) * tourBookingAdults).toLocaleString() : 0}đ</span></div>
                {tourBookingChildren > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">{t.tour_price_per_child} × {tourBookingChildren}</span><span className="font-bold">{selectedTour ? (Math.round((selectedTour.discountPercent ? Math.round(selectedTour.price * (1 - selectedTour.discountPercent / 100)) : selectedTour.price) * 0.5) * tourBookingChildren).toLocaleString() : 0}đ</span></div>}
                {tourAccommodation !== 'none' && <div className="flex justify-between text-sm"><span className="text-gray-500">{t.tour_accommodation_cost}</span><span className="font-bold">{accomCost.toLocaleString()}đ</span></div>}
                {tourMealPlan !== 'none' && <div className="flex justify-between text-sm"><span className="text-gray-500">{t.tour_meal_cost}</span><span className="font-bold">{mealCost.toLocaleString()}đ</span></div>}
                <div className="border-t border-daiichi-accent/40 pt-2 flex justify-between">
                  <span className="text-xs font-bold text-gray-500 uppercase">{t.total_amount}</span>
                  <span className="text-xl font-bold text-daiichi-red">{tourTotal.toLocaleString()}đ</span>
                </div>
              </div>

              <button
                type="button"
                disabled={!tourBookingName.trim() || !tourBookingPhone.trim() || !tourBookingDate || !selectedTour}
                onClick={() => setTourBookingSuccess(true)}
                className={cn(
                  "w-full py-4 text-white rounded-xl font-bold shadow-lg",
                  tourBookingName.trim() && tourBookingPhone.trim() && tourBookingDate && selectedTour
                    ? "bg-daiichi-red shadow-daiichi-red/20"
                    : "bg-gray-300 shadow-gray-200 cursor-not-allowed"
                )}
              >
                {t.confirm_tour_booking}
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
            agent.name.toLowerCase().includes(q) ||
            agent.code.toLowerCase().includes(q) ||
            (agent.phone || '').toLowerCase().includes(q) ||
            (agent.email || '').toLowerCase().includes(q) ||
            (agent.address || '').toLowerCase().includes(q);
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
                    <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.agent_id_name}</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.username}</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.phone_number}</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.commission}</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.balance}</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.status}</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.options}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAgents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-8 py-12 text-center text-gray-400 text-sm">
                        {language === 'vi' ? 'Không tìm thấy đại lý nào phù hợp.' : 'No agents found matching your search.'}
                      </td>
                    </tr>
                  ) : filteredAgents.map((agent) => (
                    <tr key={agent.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-8 py-6"><p className="font-bold text-gray-800">{agent.name}</p><p className="text-xs text-gray-400 font-mono">{agent.code}</p></td>
                      <td className="px-8 py-6"><p className="text-xs font-bold text-gray-700">User: <span className="text-daiichi-red">{agent.username}</span></p><p className="text-[10px] text-gray-400">Pass: {agent.password}</p></td>
                      <td className="px-8 py-6"><p className="text-sm font-medium">{agent.phone}</p><p className="text-xs text-gray-400">{agent.email}</p></td>
                      <td className="px-8 py-6"><span className="px-3 py-1 bg-daiichi-accent text-daiichi-red rounded-full text-xs font-bold">{agent.commissionRate}%</span></td>
                      <td className="px-8 py-6 font-bold text-gray-700">{(agent.balance || 0).toLocaleString()}đ</td>
                      <td className="px-8 py-6"><span className={cn("px-3 py-1 rounded-full text-[10px] font-bold uppercase", agent.status === 'ACTIVE' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600')}>{agent.status === 'ACTIVE' ? t.status_active : t.status_locked}</span></td>
                      <td className="px-8 py-6"><div className="flex gap-3"><button onClick={() => handleStartEditAgent(agent)} className="text-gray-400 hover:text-daiichi-red"><Edit3 size={18} /></button><button onClick={() => handleDeleteAgent(agent.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={18} /></button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        );
      }

      case 'routes':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-3">
              <div><h2 className="text-2xl font-bold">{t.route_management}</h2><p className="text-sm text-gray-500">{t.route_list}</p></div>
              <div className="flex gap-3">
                <button onClick={() => { setShowAddRoute(true); setEditingRoute(null); setRouteForm({ stt: routes.length + 1, name: '', departurePoint: '', arrivalPoint: '', price: 0 }); }} className="bg-daiichi-red text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-daiichi-red/20">+ {t.add_trip}</button>
              </div>
            </div>

            {/* Add/Edit Route Modal */}
            {showAddRoute && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-[32px] p-8 max-w-lg w-full space-y-6 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold">{editingRoute ? (language === 'vi' ? 'Chỉnh sửa tuyến' : 'Edit Route') : (language === 'vi' ? 'Thêm tuyến mới' : 'Add New Route')}</h3>
                    <button onClick={() => { setShowAddRoute(false); setEditingRoute(null); }} className="p-2 hover:bg-gray-50 rounded-xl"><X size={20} /></button>
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">STT</label><input type="number" value={routeForm.stt} onChange={e => setRouteForm(p => ({ ...p, stt: parseInt(e.target.value) || 1 }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                      <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.ticket_price} (đ)</label><input type="number" min="0" value={routeForm.price} onChange={e => setRouteForm(p => ({ ...p, price: parseInt(e.target.value) || 0 }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                    </div>
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.route_name}</label><input type="text" value={routeForm.name} onChange={e => setRouteForm(p => ({ ...p, name: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" placeholder={language === 'vi' ? 'VD: Hà Nội - Cát Bà' : 'e.g. Hanoi - Cat Ba'} /></div>
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.departure_point}</label><input type="text" value={routeForm.departurePoint} onChange={e => setRouteForm(p => ({ ...p, departurePoint: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.arrival_point}</label><input type="text" value={routeForm.arrivalPoint} onChange={e => setRouteForm(p => ({ ...p, arrivalPoint: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                  </div>
                  <div className="flex justify-end gap-4 pt-2">
                    <button onClick={() => { setShowAddRoute(false); setEditingRoute(null); }} className="px-6 py-3 text-sm font-bold text-gray-400 hover:text-gray-600">{t.cancel}</button>
                    <button onClick={handleSaveRoute} disabled={!routeForm.name} className="px-8 py-3 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/20 disabled:opacity-50">{editingRoute ? t.save : (language === 'vi' ? 'Thêm tuyến' : 'Add Route')}</button>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">STT</th>
                    <th className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.route_name}</th>
                    <th className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.departure_point}</th>
                    <th className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.arrival_point}</th>
                    <th className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.ticket_price}</th>
                    <th className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.options}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {routes.map((route) => (
                    <tr key={route.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-6 text-sm text-gray-500">{route.stt}</td>
                      <td className="px-6 py-6"><p className="font-bold text-gray-800">{route.name}</p></td>
                      <td className="px-6 py-6"><p className="text-xs text-gray-500 max-w-[200px]">{route.departurePoint}</p></td>
                      <td className="px-6 py-6"><p className="text-xs text-gray-500 max-w-[200px]">{route.arrivalPoint}</p></td>
                      <td className="px-6 py-6"><p className="font-bold text-daiichi-red">{route.price > 0 ? `${route.price.toLocaleString()}đ` : t.contact}</p></td>
                      <td className="px-6 py-6"><div className="flex gap-3"><button onClick={() => handleStartEditRoute(route)} className="text-gray-400 hover:text-daiichi-red"><Edit3 size={18} /></button><button onClick={() => handleDeleteRoute(route.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={18} /></button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        );

      case 'vehicles':
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
                <button onClick={() => { setShowAddVehicle(true); setEditingVehicle(null); setVehicleForm({ licensePlate: '', type: 'Ghế ngồi', seats: 16, registrationExpiry: '', status: 'ACTIVE' }); }} className="bg-daiichi-red text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-daiichi-red/20">+ {t.add_vehicle}</button>
              </div>
            </div>

            {/* Add/Edit Vehicle Modal */}
            {showAddVehicle && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-[32px] p-8 max-w-lg w-full space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold">{editingVehicle ? (language === 'vi' ? 'Chỉnh sửa phương tiện' : 'Edit Vehicle') : (language === 'vi' ? 'Thêm phương tiện mới' : 'Add New Vehicle')}</h3>
                    <button onClick={() => { setShowAddVehicle(false); setEditingVehicle(null); }} className="p-2 hover:bg-gray-50 rounded-xl"><X size={20} /></button>
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
                  </div>
                  <div className="flex justify-end gap-4 pt-2">
                    <button onClick={() => { setShowAddVehicle(false); setEditingVehicle(null); }} className="px-6 py-3 text-sm font-bold text-gray-400 hover:text-gray-600">{t.cancel}</button>
                    <button onClick={handleSaveVehicle} disabled={!vehicleForm.licensePlate} className="px-8 py-3 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/20 disabled:opacity-50">{editingVehicle ? t.save : (language === 'vi' ? 'Thêm xe' : 'Add Vehicle')}</button>
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

            <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">STT</th>
                    <th className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.license_plate}</th>
                    <th className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.vehicle_type}</th>
                    <th className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.seats}</th>
                    <th className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.registration_expiry}</th>
                    <th className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.options}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {vehicles.map((v, idx) => (
                    <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-6 text-sm text-gray-500">{idx + 1}</td>
                      <td className="px-6 py-6 font-bold text-gray-800">{v.licensePlate}</td>
                      <td className="px-6 py-6 text-sm">{v.type}</td>
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
                          <button onClick={() => handleStartEditVehicle(v)} className="text-gray-400 hover:text-daiichi-red p-1.5"><Edit3 size={16} /></button>
                          <button onClick={() => handleDeleteVehicle(v.id)} className="text-gray-400 hover:text-red-600 p-1.5"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        );

      case 'operations':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">{t.operation_management}</h2>
              <button onClick={() => { setShowAddTrip(true); setEditingTrip(null); setTripForm({ time: '', route: '', licensePlate: '', driverName: '', price: 0, seatCount: 11, status: TripStatus.WAITING }); }} className="bg-daiichi-red text-white px-4 py-2 rounded-lg font-bold">+ {t.add_trip}</button>
            </div>

            {/* Add/Edit Trip Modal */}
            {showAddTrip && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-[32px] p-8 max-w-lg w-full space-y-6 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold">{editingTrip ? (language === 'vi' ? 'Chỉnh sửa chuyến' : 'Edit Trip') : (language === 'vi' ? 'Thêm chuyến mới' : 'Add New Trip')}</h3>
                    <button onClick={() => { setShowAddTrip(false); setEditingTrip(null); }} className="p-2 hover:bg-gray-50 rounded-xl"><X size={20} /></button>
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.departure_time}</label><input type="time" value={tripForm.time} onChange={e => setTripForm(p => ({ ...p, time: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                      <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.ticket_price} (đ)</label><input type="number" min="0" value={tripForm.price} onChange={e => setTripForm(p => ({ ...p, price: parseInt(e.target.value) || 0 }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                    </div>
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.route_name}</label>
                      <select value={tripForm.route} onChange={e => setTripForm(p => ({ ...p, route: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none">
                        <option value="">{language === 'vi' ? '-- Chọn tuyến --' : '-- Select Route --'}</option>
                        {routes.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                      </select>
                    </div>
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.license_plate}</label>
                      <select value={tripForm.licensePlate} onChange={e => setTripForm(p => ({ ...p, licensePlate: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none">
                        <option value="">{language === 'vi' ? '-- Chọn xe --' : '-- Select Vehicle --'}</option>
                        {vehicles.map(v => <option key={v.id} value={v.licensePlate}>{v.licensePlate} - {v.type}</option>)}
                      </select>
                    </div>
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.driver}</label><input type="text" value={tripForm.driverName} onChange={e => setTripForm(p => ({ ...p, driverName: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
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
                    <button onClick={() => { setShowAddTrip(false); setEditingTrip(null); }} className="px-6 py-3 text-sm font-bold text-gray-400 hover:text-gray-600">{t.cancel}</button>
                    <button onClick={handleSaveTrip} disabled={!tripForm.time || !tripForm.route || !tripForm.licensePlate} className="px-8 py-3 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/20 disabled:opacity-50">{editingTrip ? t.save : (language === 'vi' ? 'Thêm chuyến' : 'Add Trip')}</button>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{t.departure_time}</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{t.license_plate}</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{t.driver}</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{t.status}</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{t.options}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {trips.map((trip) => (
                    <tr key={trip.id} className="hover:bg-gray-50 cursor-pointer">
                      <td className="px-6 py-4 font-bold" onClick={() => { setSelectedTrip(trip); setActiveTab('seat-mapping'); }}>{trip.time}</td>
                      <td className="px-6 py-4 font-medium" onClick={() => { setSelectedTrip(trip); setActiveTab('seat-mapping'); }}>{trip.licensePlate}</td>
                      <td className="px-6 py-4 text-gray-600" onClick={() => { setSelectedTrip(trip); setActiveTab('seat-mapping'); }}>{trip.driverName}</td>
                      <td className="px-6 py-4" onClick={() => { setSelectedTrip(trip); setActiveTab('seat-mapping'); }}><StatusBadge status={trip.status} language={language} /></td>
                      <td className="px-6 py-4"><div className="flex gap-3"><button onClick={() => handleStartEditTrip(trip)} className="text-gray-400 hover:text-daiichi-red"><Edit3 size={18} /></button><button onClick={() => handleDeleteTrip(trip.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={18} /></button><button onClick={() => { setSelectedTrip(trip); setActiveTab('seat-mapping'); }} className="text-daiichi-red hover:underline font-bold text-sm">{t.view_seats}</button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        );

      case 'tour-management':
        return <TourManagement language={language} />;

      case 'stop-management':
        return <StopManagement language={language} stops={stops} onUpdateStops={setStops} />;

      case 'financial-report':
        return <FinancialReport language={language} agents={agents} />;

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
                    <th className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.consignment_code || 'Code'}</th>
                    <th className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.sender}</th>
                    <th className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.receiver}</th>
                    <th className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.goods_type}</th>
                    <th className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.weight}</th>
                    <th className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.cod}</th>
                    <th className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Ghi chú' : 'Notes'}</th>
                    <th className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.status}</th>
                    <th className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.options}</th>
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
                          <button onClick={() => handleStartEditConsignment(c)} className="text-gray-400 hover:text-daiichi-red"><Edit3 size={18} /></button>
                          <button onClick={() => handleDeleteConsignment(c.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={18} /></button>
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

      default:
        return null;
    }
  };

  if (!currentUser) {
    return (
      <Login 
        onLogin={setCurrentUser} 
        language={language} 
        setLanguage={setLanguage} 
        adminCredentials={adminCredentials}
        agents={agents}
      />
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-daiichi-accent">
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

      <TicketModal 
        isOpen={isTicketOpen} 
        onClose={() => setIsTicketOpen(false)} 
        booking={lastBooking} 
        language={language} 
      />
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        currentUser={currentUser} 
        onLogout={() => setCurrentUser(null)} 
        language={language} 
        setLanguage={setLanguage} 
        isSidebarOpen={isSidebarOpen} 
        setIsSidebarOpen={setIsSidebarOpen} 
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 bg-daiichi-accent/30 relative">
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
