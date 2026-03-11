import React, { useState, useEffect } from 'react';
import { 
  Bus, Users, Package, LayoutDashboard, ChevronRight, 
  MapPin, Calendar, Truck, Star, Phone, Search, 
  Clock, Edit3, Trash2, Wallet, X, CheckCircle2,
  Menu, Bell, Globe, LogOut, Eye, EyeOff, AlertTriangle, Info,
  Filter, FileText
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

// Re-export types for components
export { UserRole, TripStatus, SeatStatus, TRANSLATIONS };
export type { Language };

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

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
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
  const [isTetSurcharge, setIsTetSurcharge] = useState(false);
  const [pickupSurcharge, setPickupSurcharge] = useState(0);
  const [dropoffSurcharge, setDropoffSurcharge] = useState(0);
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

  // Booking form inputs
  const [customerNameInput, setCustomerNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [childrenAges, setChildrenAges] = useState<number[]>([]);
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
    return () => {
      unsubscribeTrips();
      unsubscribeConsignments();
      unsubscribeAgents();
      unsubscribeStops();
      unsubscribeRoutes();
      unsubscribeVehicles();
    };
  }, []);

  const handleUpdateAgent = async (agentId: string, updates: any) => {
    try {
      await transportService.updateAgent(agentId, updates);
    } catch {
      // Fallback to local state update if Firebase is unavailable
      setAgents(prev => prev.map(a => a.id === agentId ? { ...a, ...updates } : a));
    }
  };

  const handleUpdateAdmin = (updates: any) => {
    setAdminCredentials(prev => ({ ...prev, ...updates }));
    if (currentUser?.role === UserRole.MANAGER) {
      setCurrentUser(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const handleConfirmBooking = async (seatId: string) => {
    const basePriceAdult = selectedTrip.price || 0;
    const basePriceChild = selectedTrip.priceChild || basePriceAdult;
    
    // Children over 4 years old are charged adult price
    const { childrenOver4, childrenUnder4 } = childrenAges.reduce(
      (acc, age) => age > 4 ? { ...acc, childrenOver4: acc.childrenOver4 + 1 } : { ...acc, childrenUnder4: acc.childrenUnder4 + 1 },
      { childrenOver4: 0, childrenUnder4: 0 }
    );
    const effectiveAdults = adults + childrenOver4;
    const effectiveChildren = childrenUnder4 + Math.max(0, children - childrenAges.length);
    
    const totalBase = (effectiveAdults * basePriceAdult) + (effectiveChildren * basePriceChild);
    const totalSurcharge = pickupSurcharge + dropoffSurcharge + (isTetSurcharge ? 30000 : 0);
    const totalAmount = totalBase + totalSurcharge;

    const bookingData = {
      customerName: customerNameInput.trim() || (language === 'vi' ? 'Khách lẻ' : 'Walk-in'),
      phone: phoneInput.trim(),
      type: 'TRIP',
      route: selectedTrip.route,
      date: new Date().toLocaleDateString('vi-VN'),
      time: selectedTrip.time,
      tripId: selectedTrip.id,
      seatId,
      amount: totalAmount,
      agent: currentUser?.role === UserRole.AGENT ? currentUser.name : 'Trực tiếp',
      status: 'BOOKED',
      adults,
      children,
      pickupPoint,
      dropoffPoint,
      paymentMethod: 'Tiền mặt',
    };

    try {
      // Save booking to Firebase
      const result = await transportService.createBooking(bookingData);

      // Update seat status in Firebase
      await transportService.bookSeat(selectedTrip.id, seatId, {
        status: SeatStatus.BOOKED,
        customerName: bookingData.customerName,
        customerPhone: bookingData.phone,
      });

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
    setPickupPoint('');
    setDropoffPoint('');
    setPickupSurcharge(0);
    setDropoffSurcharge(0);
    setIsTetSurcharge(false);

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
          seats: trip.seats.map((s: any) => s.id === seatId ? { ...s, status: SeatStatus.BOOKED } : s)
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
                    <div className="relative mt-1">
                      <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input 
                        type="number" 
                        min="1"
                        value={adults}
                        onChange={(e) => setAdults(parseInt(e.target.value) || 1)}
                        className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-daiichi-red/10" 
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.children}</label>
                    <div className="relative mt-1">
                      <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input 
                        type="number" 
                        min="0"
                        value={children}
                        onChange={(e) => setChildren(parseInt(e.target.value) || 0)}
                        className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-daiichi-red/10" 
                      />
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
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-4 sm:p-8 rounded-[40px] shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold">{t.seat_map_title} - {selectedTrip.licensePlate}</h2>
                <div className="flex bg-gray-100 p-1 rounded-xl">
                  <button onClick={() => setActiveDeck(0)} className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all", activeDeck === 0 ? "bg-white text-daiichi-red shadow-sm" : "text-gray-500")}>{t.deck_lower}</button>
                  <button onClick={() => setActiveDeck(1)} className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all", activeDeck === 1 ? "bg-white text-daiichi-red shadow-sm" : "text-gray-500")}>{t.deck_upper}</button>
                </div>
              </div>
              
              <div className="max-w-md mx-auto bg-gray-50 p-4 sm:p-8 rounded-[40px] border border-gray-100">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-3 flex justify-end mb-8">
                    <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center text-gray-400 border border-gray-100">
                      <Users size={24} />
                    </div>
                  </div>
                  {selectedTrip.seats.filter(s => (s.deck || 0) === activeDeck).map((seat: any) => (
                    <motion.button
                      key={seat.id}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => seat.status === SeatStatus.EMPTY && setShowBookingForm(seat.id)}
                      className={cn(
                        "h-20 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all relative overflow-hidden",
                        seat.status === SeatStatus.PAID && "bg-daiichi-red text-white shadow-lg shadow-daiichi-red/20",
                        seat.status === SeatStatus.BOOKED && "bg-daiichi-yellow text-white shadow-lg shadow-daiichi-yellow/20",
                        seat.status === SeatStatus.EMPTY && "bg-white border-2 border-gray-100 text-gray-400 hover:border-daiichi-red hover:text-daiichi-red"
                      )}
                    >
                      <span className="text-xs font-bold">{seat.id}</span>
                      <Users size={20} />
                      {seat.status === SeatStatus.PAID && <CheckCircle2 size={12} className="absolute top-2 right-2" />}
                    </motion.button>
                  ))}
                </div>
                <div className="mt-12 flex justify-center gap-6 text-xs font-bold uppercase tracking-wider">
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
                    <button onClick={() => setShowBookingForm(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                  </div>
                  <form className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="text-xs font-bold text-gray-500 uppercase">{t.adults}</label><input type="number" min="1" value={adults} onChange={(e) => setAdults(parseInt(e.target.value) || 1)} className="w-full mt-1 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20" /></div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">{t.children}</label>
                        <input type="number" min="0" value={children} onChange={(e) => {
                          const count = parseInt(e.target.value) || 0;
                          setChildren(count);
                          setChildrenAges(prev => {
                            const arr = [...prev];
                            while (arr.length < count) arr.push(0);
                            return arr.slice(0, count);
                          });
                        }} className="w-full mt-1 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20" />
                      </div>
                    </div>

                    {/* Children age inputs */}
                    {children > 0 && (
                      <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 space-y-2">
                        <p className="text-xs font-bold text-blue-600 uppercase">{t.enter_child_ages || "Enter each child's age"}</p>
                        <p className="text-[10px] text-blue-400">{t.child_age_note || 'Children over 4 are charged adult price'}</p>
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

                    {/* Tet Surcharge Toggle */}
                    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <input 
                        type="checkbox" 
                        id="tetSurcharge" 
                        checked={isTetSurcharge} 
                        onChange={(e) => setIsTetSurcharge(e.target.checked)}
                        className="w-4 h-4 text-daiichi-red border-gray-300 rounded focus:ring-daiichi-red"
                      />
                      <label htmlFor="tetSurcharge" className="text-xs font-bold text-gray-500 uppercase cursor-pointer">
                        {t.surcharge_tet}
                      </label>
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
                            return ((effectiveAdults * basePriceAdult) + (effectiveChildren * basePriceChild) + pickupSurcharge + dropoffSurcharge + (isTetSurcharge ? 30000 : 0)).toLocaleString();
                          })()}đ
                        </span>
                      </div>
                    </div>

                    <button type="button" onClick={() => handleConfirmBooking(showBookingForm || '')} className="w-full py-4 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/20">{t.confirm_booking}</button>
                  </form>
                </motion.div>
              )}
            </div>
          </div>
        );

      case 'agents':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div><h2 className="text-2xl font-bold">{t.agents}</h2><p className="text-sm text-gray-500">{t.agent_desc}</p></div>
              <button className="bg-daiichi-red text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-daiichi-red/20">+ {t.add_agent}</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: t.total_agents, value: agents.length, icon: Users, color: 'text-blue-600' },
                { label: t.agent_revenue, value: '850M', icon: Wallet, color: 'text-green-600' },
                { label: t.commission_paid, value: '127M', icon: Star, color: 'text-daiichi-red' },
              ].map((s, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div><p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{s.label}</p><h3 className="text-2xl font-bold mt-2">{s.value}</h3></div>
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
                  {agents.map((agent) => (
                    <tr key={agent.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-8 py-6"><p className="font-bold text-gray-800">{agent.name}</p><p className="text-xs text-gray-400 font-mono">{agent.code}</p></td>
                      <td className="px-8 py-6"><p className="text-xs font-bold text-gray-700">User: <span className="text-daiichi-red">{agent.username}</span></p><p className="text-[10px] text-gray-400">Pass: {agent.password}</p></td>
                      <td className="px-8 py-6"><p className="text-sm font-medium">{agent.phone}</p><p className="text-xs text-gray-400">{agent.email}</p></td>
                      <td className="px-8 py-6"><span className="px-3 py-1 bg-daiichi-accent text-daiichi-red rounded-full text-xs font-bold">{agent.commissionRate}%</span></td>
                      <td className="px-8 py-6 font-bold text-gray-700">{agent.balance.toLocaleString()}đ</td>
                      <td className="px-8 py-6"><span className={cn("px-3 py-1 rounded-full text-[10px] font-bold uppercase", agent.status === 'ACTIVE' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600')}>{agent.status === 'ACTIVE' ? t.status_active : t.status_locked}</span></td>
                      <td className="px-8 py-6"><div className="flex gap-3"><button className="text-gray-400 hover:text-daiichi-red"><Edit3 size={18} /></button><button className="text-gray-400 hover:text-daiichi-red"><Wallet size={18} /></button><button className="text-gray-400 hover:text-red-600"><Trash2 size={18} /></button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        );

      case 'routes':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div><h2 className="text-2xl font-bold">{t.route_management}</h2><p className="text-sm text-gray-500">{t.route_list}</p></div>
              <button className="bg-daiichi-red text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-daiichi-red/20">+ {t.add_trip}</button>
            </div>
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
                      <td className="px-6 py-6"><div className="flex gap-3"><button className="text-gray-400 hover:text-daiichi-red"><Edit3 size={18} /></button><button className="text-gray-400 hover:text-red-600"><Trash2 size={18} /></button></div></td>
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
            <div className="flex justify-between items-center">
              <div><h2 className="text-2xl font-bold">{t.vehicle_management}</h2><p className="text-sm text-gray-500">{t.vehicle_list}</p></div>
              <button className="bg-daiichi-red text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-daiichi-red/20">+ {t.add_vehicle}</button>
            </div>
            <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.license_plate}</th>
                    <th className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.vehicle_type}</th>
                    <th className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.seats}</th>
                    <th className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.registration_expiry}</th>
                    <th className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.options}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {vehicles.map((v) => (
                    <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-6 font-bold text-gray-800">{v.licensePlate}</td>
                      <td className="px-6 py-6 text-sm">{v.type}</td>
                      <td className="px-6 py-6 text-sm">{v.seats}</td>
                      <td className="px-6 py-6 text-sm">{v.registrationExpiry}</td>
                      <td className="px-6 py-6"><div className="flex gap-3"><button className="text-gray-400 hover:text-daiichi-red"><Edit3 size={18} /></button><button className="text-gray-400 hover:text-daiichi-red font-bold text-xs">{t.edit_layout}</button></div></td>
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
              <button className="bg-daiichi-red text-white px-4 py-2 rounded-lg font-bold">+ {t.add_trip}</button>
            </div>
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
                    <tr key={trip.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => { setSelectedTrip(trip); setActiveTab('seat-mapping'); }}>
                      <td className="px-6 py-4 font-bold">{trip.time}</td>
                      <td className="px-6 py-4 font-medium">{trip.licensePlate}</td>
                      <td className="px-6 py-4 text-gray-600">{trip.driverName}</td>
                      <td className="px-6 py-4"><StatusBadge status={trip.status} language={language} /></td>
                      <td className="px-6 py-4"><button className="text-daiichi-red hover:underline font-bold text-sm">{t.view_seats}</button></td>
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
              <button className="bg-daiichi-red text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-daiichi-red/20">+ {t.create_bill}</button>
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
                    <th className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.cargo_items || 'Items'}</th>
                    <th className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.goods_type}</th>
                    <th className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.weight}</th>
                    <th className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.cod}</th>
                    <th className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.status}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredConsignments.length === 0 ? (
                    <tr><td colSpan={8} className="px-8 py-12 text-center text-gray-400 text-sm">
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
                      <td className="px-6 py-5">
                        {c.items && c.items.length > 0 ? (
                          <div className="space-y-1">
                            {c.items.map((item: any, i: number) => (
                              <div key={i} className="text-xs bg-gray-100 rounded-lg px-2 py-1">
                                <span className="font-bold">{item.name}</span>
                                {item.quantity > 1 && <span className="text-gray-500 ml-1">×{item.quantity}</span>}
                                {item.weight && <span className="text-gray-400 ml-1">({item.weight})</span>}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-sm text-gray-600">{c.type || '—'}</td>
                      <td className="px-6 py-5 text-sm text-gray-600">{c.weight || '—'}</td>
                      <td className="px-6 py-5 font-bold text-gray-700">{c.cod ? c.cod.toLocaleString() + 'đ' : '—'}</td>
                      <td className="px-6 py-5">
                        <span className={cn("px-3 py-1 rounded-full text-[10px] font-bold uppercase", statusColorMap[c.status] || 'bg-gray-100 text-gray-600')}>
                          {statusLabelMap[c.status] || c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
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
