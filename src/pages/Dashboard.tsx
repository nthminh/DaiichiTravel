import React, { useState } from 'react';
import { 
  Bus, Users,
  Download, Calendar as CalendarIcon, Search,
  User,
  MapPin, Clock, CreditCard, Tag, Edit3, Trash2, X, Check,
  Eye, Moon, Coffee, Hotel,
  TrendingUp, CheckCircle2, Activity, BarChart2, Ticket, ArrowUpRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, getTodayVN } from '../lib/utils';
import { matchesSearch } from '../lib/searchUtils';
import { TRANSLATIONS, Language, TripStatus, UserRole, SeatStatus } from '../App';
import { transportService } from '../services/transportService';
import { ResizableTh } from '../components/ResizableTh';
import { exportRowsToExcel } from '../utils/exportUtils';
import { formatBookingDate, formatDateVN } from '../lib/vnDate';

interface DashboardProps {
  language: Language;
  trips: any[];
  consignments: any[];
  bookings: any[];
  currentUser: any;
  setActiveTab?: (tab: string) => void;
  dataRequested?: boolean;
  onLoadData?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ language, trips, consignments, bookings, currentUser, setActiveTab, dataRequested, onLoadData }) => {
  const t = TRANSLATIONS[language];
  const [filterType, setFilterType] = useState<'ALL' | 'TRIP' | 'TOUR'>('ALL');
  const [filterDepartureTime, setFilterDepartureTime] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [agentFilter, setAgentFilter] = useState('ALL');

  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [filterRoute, setFilterRoute] = useState('ALL');
  const [bookingPage, setBookingPage] = useState(1);
  const BOOKINGS_PER_PAGE = 50;

  // Consignment filter state
  const [consignmentSearch, setConsignmentSearch] = useState('');
  const [consignmentStatusFilter, setConsignmentStatusFilter] = useState<'ALL' | 'PENDING' | 'PICKED_UP' | 'DELIVERED'>('ALL');
  const [consignmentPage, setConsignmentPage] = useState(1);
  const CONSIGNMENTS_PER_PAGE = 50;

  // Column widths state
  const [colWidths, setColWidths] = useState({
    customer: 250,
    type: 120,
    route: 250,
    agent: 180,
    price: 120,
    status: 120,
    actions: 120
  });

  const [consignColWidths, setConsignColWidths] = useState({
    sender: 180,
    receiver: 180,
    typeWeight: 150,
    cod: 120,
    status: 150,
    created: 160,
  });

  // Edit State
  const [editingBooking, setEditingBooking] = useState<any>(null);
  // Edit: trip change sub-state
  const [editShowTripSearch, setEditShowTripSearch] = useState(false);
  const [editTripDate, setEditTripDate] = useState('');
  const [editSelectedTrip, setEditSelectedTrip] = useState<any>(null);
  const [editSelectedSeats, setEditSelectedSeats] = useState<string[]>([]);
  // Detail View State
  const [viewingBooking, setViewingBooking] = useState<any>(null);

  const isAgent = currentUser?.role === UserRole.AGENT;
  const isAdmin = currentUser?.role === UserRole.MANAGER;
  // Effective agent identifier used in booking.agent field
  const agentIdentifier = isAgent
    ? (currentUser.name || currentUser.address || currentUser.agentCode || '')
    : '';

  const exportToExcel = () => {
    const dataToExport = isAgent ? filteredBookings : bookings;
    const rows: Record<string, unknown>[] = dataToExport.map((b: any) => ({
      [language === 'vi' ? 'Mã đặt vé' : 'Booking ID']: b.id || '',
      [language === 'vi' ? 'Tên khách hàng' : 'Customer Name']: b.customerName || '',
      [language === 'vi' ? 'Số điện thoại' : 'Phone']: b.customerPhone || '',
      [language === 'vi' ? 'Tuyến đường' : 'Route']: b.route || '',
      [language === 'vi' ? 'Loại' : 'Type']: b.type || '',
      [language === 'vi' ? 'Ngày' : 'Date']: b.date || '',
      [language === 'vi' ? 'Giá vé (đ)' : 'Amount']: b.amount ?? 0,
      [language === 'vi' ? 'Trạng thái' : 'Status']: b.status || '',
      [language === 'vi' ? 'Người thực hiện' : 'Performed By']: b.bookedByName || b.agent || '',
      [language === 'vi' ? 'Mã vé' : 'Ticket Code']: b.ticketCode || '',
      [language === 'vi' ? 'Phương thức thanh toán' : 'Payment Method']: b.paymentMethod || '',
      [language === 'vi' ? 'Ghi chú' : 'Notes']: b.note || '',
    }));
    const filename = `Daiichi_Bookings_${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())}.xlsx`;
    exportRowsToExcel(rows, filename, language === 'vi' ? 'Đặt vé' : 'Bookings').catch(err =>
      console.error('[Excel] Export failed:', err),
    );
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t.confirm_delete)) {
      const booking = bookings.find(b => b.id === id);
      try {
        await transportService.deleteBooking(id);
        // Sync: clear seat(s) in trip for TRIP bookings
        if (booking && booking.type !== 'TOUR' && booking.tripId) {
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
          const allSeats: string[] = booking.seatIds || (booking.seatId ? [booking.seatId] : []);
          await Promise.all(allSeats.map(seatId => transportService.bookSeat(booking.tripId, seatId, emptyData)));
        }
      } catch (err) {
        console.error('Failed to delete booking:', err);
      }
    }
  };

  const handleEdit = (booking: any) => {
    setEditingBooking({ ...booking });
    setEditShowTripSearch(false);
    setEditTripDate(booking.date || '');
    setEditSelectedTrip(null);
    setEditSelectedSeats([]);
  };

  const handleView = (booking: any) => {
    setViewingBooking(booking);
  };

  const saveEdit = async () => {
    const updated = { ...editingBooking };

    // If a new trip and seats were selected for a TRIP booking
    if (updated.type !== 'TOUR' && editSelectedTrip && editSelectedSeats.length > 0) {
      // Update booking fields with the new trip info
      updated.tripId = editSelectedTrip.id;
      updated.route = editSelectedTrip.route;
      updated.date = editSelectedTrip.date;
      updated.time = editSelectedTrip.time;
      updated.seatId = editSelectedSeats[0];
      updated.seatIds = editSelectedSeats;

      // Clear old seats in the original trip
      if (editingBooking.tripId) {
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
        const oldSeats: string[] = editingBooking.seatIds || (editingBooking.seatId ? [editingBooking.seatId] : []);
        await Promise.all(oldSeats.map((seatId: string) => transportService.bookSeat(editingBooking.tripId, seatId, emptyData)));
      }
    }

    setEditingBooking(null);
    setEditShowTripSearch(false);
    setEditSelectedTrip(null);
    setEditSelectedSeats([]);

    try {
      await transportService.updateBooking(updated.id, updated);

      if (updated.type !== 'TOUR' && updated.tripId) {
        const seatUpdates = {
          customerName: updated.customerName || '',
          customerPhone: updated.phone || '',
          pickupAddress: updated.pickupAddress || '',
          dropoffAddress: updated.dropoffAddress || '',
          bookingNote: updated.bookingNote || updated.notes || '',
          status: updated.status === 'PAID' ? SeatStatus.PAID : SeatStatus.BOOKED,
        };
        const allSeats: string[] = updated.seatIds || (updated.seatId ? [updated.seatId] : []);
        await Promise.all(allSeats.map((seatId: string) => transportService.bookSeat(updated.tripId, seatId, seatUpdates)));
      }
    } catch (err) {
      console.error('Failed to update booking:', err);
    }
  };

  // Sort bookings by createdAt descending (newest first)
  const sortByCreatedDesc = (a: any, b: any) => {
    const getTime = (v: any) => {
      if (!v) return 0;
      try { return (v.toDate ? v.toDate() : new Date(v)).getTime(); } catch { return 0; }
    };
    return getTime(b.createdAt) - getTime(a.createdAt);
  };

  const normalizedSearchAmount = searchTerm.replace(/[.,\s]/g, '');
  const isNumericSearch = normalizedSearchAmount !== '' && !isNaN(Number(normalizedSearchAmount));
  const minPriceNum = minPrice ? Number(minPrice) : null;
  const maxPriceNum = maxPrice ? Number(maxPrice) : null;

  const filteredBookings = bookings.filter(b => {
    // Agent scope: only show bookings created by this agent
    if (isAgent) {
      const matchesAgentId = currentUser.id && b.agentId === currentUser.id;
      const matchesAgentName = agentIdentifier && (b.agent || '') === agentIdentifier;
      if (!matchesAgentId && !matchesAgentName) return false;
    }

    const matchesType = filterType === 'ALL' || b.type === filterType;
    const searchMatches = !searchTerm ||
      matchesSearch(b.customerName || '', searchTerm) ||
      matchesSearch(b.agent || '', searchTerm) ||
      matchesSearch(b.id || '', searchTerm) ||
      matchesSearch(b.customerPhone || '', searchTerm) ||
      matchesSearch(b.phone || '', searchTerm) ||
      matchesSearch(b.route || '', searchTerm) ||
      (isNumericSearch && String(b.amount ?? '').includes(normalizedSearchAmount));

    const matchesAgent = agentFilter === 'ALL' || b.agent === agentFilter;
    const matchesDepartureTime = filterDepartureTime === 'ALL' || (b.time || '') === filterDepartureTime;

    const amount = b.amount ?? 0;
    const matchesMinPrice = minPriceNum === null || amount >= minPriceNum;
    const matchesMaxPrice = maxPriceNum === null || amount <= maxPriceNum;

    const rawDate = b.date ? String(b.date).split(' ')[0] : '';
    const bookingDate = rawDate ? new Date(rawDate) : new Date(0);
    const matchesStart = !startDate || bookingDate >= new Date(startDate);
    const matchesEnd = !endDate || bookingDate <= new Date(endDate);

    const matchesRoute = filterRoute === 'ALL' || (b.route || '') === filterRoute;

    return matchesType && searchMatches && matchesAgent && matchesStart && matchesEnd && matchesDepartureTime && matchesMinPrice && matchesMaxPrice && matchesRoute;
  }).sort(sortByCreatedDesc);

  const bookingTotalPages = Math.max(1, Math.ceil(filteredBookings.length / BOOKINGS_PER_PAGE));
  const pagedBookings = filteredBookings.slice((bookingPage - 1) * BOOKINGS_PER_PAGE, bookingPage * BOOKINGS_PER_PAGE);

  const uniqueAgents = Array.from(new Set(bookings.filter(b => b.agentId).map(b => b.agent).filter(Boolean)));
  const uniqueRoutes = Array.from(new Set(bookings.map(b => b.route).filter(Boolean))).sort() as string[];
  const uniqueDepartureTimes = Array.from(new Set(bookings.map(b => b.time).filter(Boolean))).sort() as string[];

  const filteredConsignments = consignments.filter(c => {
    // Agent scope: only show consignments created by this agent
    if (isAgent) {
      const matchesAgentId = currentUser.id && c.agentId === currentUser.id;
      const matchesAgentName = agentIdentifier && (c.agentName || '') === agentIdentifier;
      if (!matchesAgentId && !matchesAgentName) return false;
    }

    const q = consignmentSearch;
    const searchMatches = !q ||
      matchesSearch(c.senderName || c.sender || '', q) ||
      matchesSearch(c.receiverName || c.receiver || '', q) ||
      matchesSearch(c.senderPhone || '', q) ||
      matchesSearch(c.receiverPhone || '', q) ||
      matchesSearch(c.id || '', q) ||
      matchesSearch(c.type || '', q) ||
      matchesSearch(c.agentName || '', q);
    const matchesStatus = consignmentStatusFilter === 'ALL' || c.status === consignmentStatusFilter;
    return searchMatches && matchesStatus;
  });

  const consignmentTotalPages = Math.max(1, Math.ceil(filteredConsignments.length / CONSIGNMENTS_PER_PAGE));
  const pagedConsignments = filteredConsignments.slice((consignmentPage - 1) * CONSIGNMENTS_PER_PAGE, consignmentPage * CONSIGNMENTS_PER_PAGE);

  // For agents: stats are scoped to their own data; for managers: show all
  const scopedBookings = isAgent
    ? bookings.filter(b =>
        (currentUser.id && b.agentId === currentUser.id) ||
        (agentIdentifier && (b.agent || '') === agentIdentifier))
    : bookings;
  const scopedConsignments = isAgent
    ? consignments.filter(c =>
        (currentUser.id && c.agentId === currentUser.id) ||
        (agentIdentifier && (c.agentName || '') === agentIdentifier))
    : consignments;

  const getPaginationPages = (current: number, total: number): (number | '...')[] => {
    const pages = Array.from({ length: total }, (_, i) => i + 1)
      .filter(p => p === 1 || p === total || Math.abs(p - current) <= 2);
    return pages.reduce<(number | '...')[]>((acc, p, idx, arr) => {
      if (idx > 0 && typeof arr[idx - 1] === 'number' && p - (arr[idx - 1] as number) > 1) acc.push('...');
      acc.push(p);
      return acc;
    }, []);
  };

  const sortedScopedBookings = [...scopedBookings].sort(sortByCreatedDesc);

  const formatActivityTime = (createdAt: any): string => {
    if (!createdAt) return '';
    try {
      const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
      const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
      if (diffMins < 60) return language === 'vi' ? `${diffMins} phút trước` : `${diffMins} mins ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return language === 'vi' ? `${diffHours} giờ trước` : `${diffHours} hours ago`;
      return formatDateVN(date);
    } catch {
      return '';
    }
  };


  // ── Statistics computations ──────────────────────────────────────────────
  const totalTrips = trips.length;
  const completedTrips = trips.filter(tr => tr.status === TripStatus.COMPLETED).length;
  const runningTrips = trips.filter(tr => tr.status === TripStatus.RUNNING).length;
  const waitingTrips = trips.filter(tr => tr.status === TripStatus.WAITING).length;

  const paidBookings = scopedBookings.filter(b => b.status === 'PAID');
  const pendingBookings = scopedBookings.filter(b => b.status === 'BOOKED');
  const totalRevenue = paidBookings.reduce((sum: number, b: any) => sum + (b.amount ?? 0), 0);

  // Group trips by departure time slot
  const timeSlotDefs = [
    { key: 'night',     label: language === 'vi' ? 'Đêm'   : 'Night',     range: '00–06h', hours: [0,1,2,3,4,5],       bg: 'bg-indigo-50',  text: 'text-indigo-700',  bar: 'bg-indigo-500' },
    { key: 'morning',   label: language === 'vi' ? 'Sáng'  : 'Morning',   range: '06–12h', hours: [6,7,8,9,10,11],      bg: 'bg-amber-50',   text: 'text-amber-700',   bar: 'bg-amber-400'  },
    { key: 'afternoon', label: language === 'vi' ? 'Chiều' : 'Afternoon', range: '12–18h', hours: [12,13,14,15,16,17],  bg: 'bg-orange-50',  text: 'text-orange-700',  bar: 'bg-orange-400' },
    { key: 'evening',   label: language === 'vi' ? 'Tối'   : 'Evening',   range: '18–24h', hours: [18,19,20,21,22,23],  bg: 'bg-purple-50',  text: 'text-purple-700',  bar: 'bg-purple-500' },
  ];
  const slotCounts = timeSlotDefs.map(slot => ({
    ...slot,
    count: trips.filter(tr => {
      const h = parseInt((tr.time || '0').split(':')[0], 10);
      return slot.hours.includes(h);
    }).length,
  }));
  const maxSlotCount = Math.max(...slotCounts.map(s => s.count), 1);

  // Build a sorted trip schedule list
  const sortedTrips = [...trips].sort((a, b) => {
    const ak = `${a.date || ''}T${a.time || ''}`;
    const bk = `${b.date || ''}T${b.time || ''}`;
    return ak.localeCompare(bk);
  });

  const fmtRevenue = (n: number) =>
    n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
      : n >= 1_000
      ? `${(n / 1_000).toFixed(0)}K`
      : String(n);

  /** Minimum bar height (%) so non-zero counts are always visible */
  const MIN_BAR_HEIGHT_PCT = 8;

  return (
    <div className="space-y-8 pb-20">
      {/* Header with quick actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Dashboard</h2>
          <p className="text-gray-500">{language === 'vi' ? 'Tổng quan hoạt động kinh doanh hôm nay' : 'Business overview for today'}</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-2xl font-bold text-gray-700 hover:bg-gray-50 transition-all shadow-sm"
          >
            <Download size={20} />
            {language === 'vi' ? 'Xuất Excel' : 'Export Excel'}
          </button>
          <button 
            onClick={() => setActiveTab?.('operations')}
            className="flex items-center gap-2 px-6 py-3 bg-daiichi-red text-white rounded-2xl font-bold shadow-lg shadow-daiichi-red/20 hover:scale-[1.02] transition-all">
            <CalendarIcon size={20} />
            {language === 'vi' ? 'Lịch trình' : 'Schedule'}
          </button>

        </div>
      </div>

      {/* ═══════════════════════════════════════════════
           PROFESSIONAL STATISTICS PANEL
      ════════════════════════════════════════════════ */}
      <div className="space-y-5">
        {/* ── Row 1: Trip KPI Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total trips */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 rounded-2xl bg-daiichi-red/10 flex items-center justify-center">
                <Bus size={22} className="text-daiichi-red" />
              </div>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{language === 'vi' ? 'Tổng chuyến' : 'Total Trips'}</span>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-gray-800">{totalTrips}</p>
              <p className="text-xs text-gray-400 mt-1">{language === 'vi' ? 'Tất cả các chuyến' : 'All trips in system'}</p>
            </div>
          </div>

          {/* Completed / Departed */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 rounded-2xl bg-green-50 flex items-center justify-center">
                <CheckCircle2 size={22} className="text-green-500" />
              </div>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{language === 'vi' ? 'Đã xuất bến' : 'Completed'}</span>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-gray-800">{completedTrips}</p>
              <p className="text-xs text-gray-400 mt-1">
                {totalTrips > 0
                  ? `${Math.round((completedTrips / totalTrips) * 100)}% ${language === 'vi' ? 'tổng chuyến' : 'of total'}`
                  : '—'}
              </p>
            </div>
          </div>

          {/* Running */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 rounded-2xl bg-blue-50 flex items-center justify-center">
                <Activity size={22} className="text-blue-500" />
              </div>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{language === 'vi' ? 'Đang chạy' : 'In Transit'}</span>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-gray-800">{runningTrips}</p>
              <p className="text-xs text-gray-400 mt-1">
                {waitingTrips > 0
                  ? `${waitingTrips} ${language === 'vi' ? 'chuyến chờ' : 'trips waiting'}`
                  : language === 'vi' ? 'Không có chuyến chờ' : 'No pending trips'}
              </p>
            </div>
          </div>

          {/* Revenue */}
          <div className="bg-gradient-to-br from-daiichi-red to-rose-600 rounded-3xl shadow-lg shadow-daiichi-red/20 p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center">
                <TrendingUp size={22} className="text-white" />
              </div>
              <span className="text-xs font-semibold text-white/70 uppercase tracking-wide">{language === 'vi' ? 'Doanh thu' : 'Revenue'}</span>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-white">{fmtRevenue(totalRevenue)}đ</p>
              <p className="text-xs text-white/60 mt-1">
                {paidBookings.length} {language === 'vi' ? 'vé đã thanh toán' : 'paid tickets'}
              </p>
            </div>
          </div>
        </div>

        {/* ── Row 2: Booking KPIs ── */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center shrink-0">
              <Users size={22} className="text-violet-500" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-gray-800">{scopedBookings.length}</p>
              <p className="text-xs text-gray-400">{language === 'vi' ? 'Tổng đặt chỗ' : 'Total Bookings'}</p>
            </div>
          </div>
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center shrink-0">
              <CreditCard size={22} className="text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-gray-800">{paidBookings.length}</p>
              <p className="text-xs text-gray-400">{language === 'vi' ? 'Vé đã thanh toán' : 'Paid Tickets'}</p>
            </div>
          </div>
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center shrink-0">
              <Ticket size={22} className="text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-gray-800">{pendingBookings.length}</p>
              <p className="text-xs text-gray-400">{language === 'vi' ? 'Vé chờ thanh toán' : 'Pending Tickets'}</p>
            </div>
          </div>
        </div>

        {/* ── Row 3: Charts ── */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

          {/* Left: Bar chart – trips by time slot (spans 3/5) */}
          <div className="xl:col-span-3 bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <BarChart2 size={20} className="text-daiichi-red" />
                  {language === 'vi' ? 'Phân bố chuyến theo khung giờ' : 'Trips by Time Slot'}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {language === 'vi' ? `${totalTrips} chuyến tổng cộng` : `${totalTrips} trips total`}
                </p>
              </div>
            </div>
            {/* Bar chart */}
            <div className="flex items-end gap-4 h-36 px-2">
              {slotCounts.map((slot) => (
                <div key={slot.key} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-sm font-bold text-gray-700">{slot.count}</span>
                  <div className="w-full flex items-end justify-center" style={{ height: '80px' }}>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max((slot.count / maxSlotCount) * 100, slot.count > 0 ? MIN_BAR_HEIGHT_PCT : 0)}%` }}
                      transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
                      className={`w-full rounded-t-2xl ${slot.bar} shadow-sm`}
                      style={{ maxHeight: '80px' }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-gray-600">{slot.label}</span>
                  <span className="text-[10px] text-gray-400">{slot.range}</span>
                </div>
              ))}
            </div>
            {/* Horizontal breakdown pills */}
            <div className="mt-5 grid grid-cols-2 gap-2">
              {slotCounts.map(slot => (
                <div key={slot.key} className={`flex items-center justify-between px-3 py-2 rounded-2xl ${slot.bg}`}>
                  <span className={`text-xs font-semibold ${slot.text}`}>{slot.label} ({slot.range})</span>
                  <span className={`text-xs font-bold ${slot.text}`}>
                    {slot.count} {language === 'vi' ? 'chuyến' : 'trips'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Trip schedule list (spans 2/5) */}
          <div className="xl:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">
                {language === 'vi' ? 'Lịch các chuyến' : 'Trip Schedule'}
              </h3>
              <button
                onClick={() => setActiveTab?.('operations')}
                className="text-xs text-daiichi-red font-semibold flex items-center gap-1 hover:underline"
              >
                {language === 'vi' ? 'Xem tất cả' : 'See all'} <ArrowUpRight size={13} />
              </button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto max-h-72 pr-1">
              {sortedTrips.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                  {language === 'vi' ? 'Chưa có chuyến nào' : 'No trips available'}
                </p>
              ) : sortedTrips.slice(0, 10).map((trip, i) => {
                const bookedSeats = Array.isArray(trip.seats) ? trip.seats.filter((s: any) => s.status !== 'EMPTY').length : 0;
                const totalSeats = Array.isArray(trip.seats) ? trip.seats.length : 0;
                const occupancy = totalSeats > 0 ? Math.round((bookedSeats / totalSeats) * 100) : 0;
                const statusColors: Record<string, string> = {
                  COMPLETED: 'bg-green-100 text-green-700',
                  RUNNING:   'bg-blue-100 text-blue-700',
                  WAITING:   'bg-amber-100 text-amber-700',
                };
                const statusLabels: Record<string, string> = {
                  COMPLETED: language === 'vi' ? 'Đã xuất bến' : 'Done',
                  RUNNING:   language === 'vi' ? 'Đang chạy'   : 'Running',
                  WAITING:   language === 'vi' ? 'Chờ xuất bến': 'Waiting',
                };
                return (
                  <div key={trip.id || i} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                    <div className="w-14 h-14 rounded-2xl bg-gray-50 flex flex-col items-center justify-center border border-gray-100 shrink-0">
                      <Clock size={13} className="text-daiichi-red mb-0.5" />
                      <span className="text-xs font-bold text-gray-700 leading-none">{trip.time || '—'}</span>
                      {trip.date && (
                      <span className="text-[10px] text-gray-400 leading-none mt-0.5">{formatBookingDate(trip.date)}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{trip.route || '—'}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColors[trip.status] || 'bg-gray-100 text-gray-500'}`}>
                          {statusLabels[trip.status] || trip.status}
                        </span>
                        {totalSeats > 0 && (
                          <span className="text-[10px] text-gray-400">
                            {bookedSeats}/{totalSeats} {language === 'vi' ? 'ghế' : 'seats'} · {occupancy}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      {/* ═══════════════════════════════════════════════════════════════ */}

      {/* Global Quick Search Bar */}
      <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-daiichi-red" size={20} />
            <input
              type="text"
              placeholder={language === 'vi' ? 'Tìm nhanh theo tên, SĐT, tuyến, giá...' : 'Quick search by name, phone, route, price...'}
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setBookingPage(1); }}
              className="w-full pl-12 pr-10 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/20 focus:border-daiichi-red/40 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => { setSearchTerm(''); setBookingPage(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
          {/* Search hint chips */}
          <div className="flex flex-wrap gap-2">
            {[
              { label: language === 'vi' ? 'Tên KH' : 'Name', example: language === 'vi' ? 'vd: Nguyễn Văn A' : 'e.g. John' },
              { label: language === 'vi' ? 'SĐT' : 'Phone', example: language === 'vi' ? 'vd: 0912...' : 'e.g. 091...' },
              { label: language === 'vi' ? 'Tuyến' : 'Route', example: language === 'vi' ? 'vd: Hà Nội - Đà Nẵng' : 'e.g. Hanoi - Danang' },
              { label: language === 'vi' ? 'Mã đặt vé' : 'Booking ID', example: language === 'vi' ? 'vd: BK-...' : 'e.g. BK-...' },
            ].map(chip => (
              <span key={chip.label} className="inline-flex items-center gap-1 px-3 py-1 bg-gray-50 border border-gray-100 rounded-full text-[11px] text-gray-400">
                <Search size={10} />
                <span className="font-semibold text-gray-500">{chip.label}</span>
                <span className="text-gray-300">·</span>
                <span>{chip.example}</span>
              </span>
            ))}
          </div>
          {/* Result count */}
          {searchTerm && (
            <p className="text-xs text-gray-400">
              {language === 'vi'
                ? `Tìm thấy ${filteredBookings.length} kết quả${filteredBookings.length !== bookings.length ? ` / ${bookings.length} đơn` : ''}`
                : `Found ${filteredBookings.length} result${filteredBookings.length !== 1 ? 's' : ''}${filteredBookings.length !== bookings.length ? ` of ${bookings.length} bookings` : ''}`}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-8">
        {/* Main Booking List - Full Width */}
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
            <div className="flex flex-col gap-6 mb-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h3 className="text-xl font-bold text-gray-800">
                  {language === 'vi' ? 'Danh sách đặt chỗ mới nhất' : 'Latest Bookings'}
                </h3>
              </div>

              {/* Inline Filters */}
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setBookingPage(1); }}
                  className={cn('px-3 py-2 rounded-xl text-xs font-bold border transition-all focus:outline-none', startDate ? 'bg-daiichi-red text-white border-daiichi-red [color-scheme:dark]' : 'bg-white text-gray-600 border-gray-200 hover:border-daiichi-red/40')}
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setBookingPage(1); }}
                  className={cn('px-3 py-2 rounded-xl text-xs font-bold border transition-all focus:outline-none', endDate ? 'bg-daiichi-red text-white border-daiichi-red [color-scheme:dark]' : 'bg-white text-gray-600 border-gray-200 hover:border-daiichi-red/40')}
                />
                {!isAgent && (
                  <select
                    value={agentFilter}
                    onChange={(e) => { setAgentFilter(e.target.value); setBookingPage(1); }}
                    className={cn('px-3 py-2 rounded-xl text-xs font-bold border transition-all focus:outline-none', agentFilter !== 'ALL' ? 'bg-daiichi-red text-white border-daiichi-red' : 'bg-white text-gray-600 border-gray-200 hover:border-daiichi-red/40')}
                  >
                    <option value="ALL">{t.all_agents}</option>
                    {uniqueAgents.map(agent => (
                      <option key={agent} value={agent}>{agent}</option>
                    ))}
                  </select>
                )}
                <select
                  value={filterType}
                  onChange={(e) => { setFilterType(e.target.value as 'ALL' | 'TRIP' | 'TOUR'); setBookingPage(1); }}
                  className={cn('px-3 py-2 rounded-xl text-xs font-bold border transition-all focus:outline-none', filterType !== 'ALL' ? 'bg-daiichi-red text-white border-daiichi-red' : 'bg-white text-gray-600 border-gray-200 hover:border-daiichi-red/40')}
                >
                  <option value="ALL">{language === 'vi' ? 'Tất cả loại' : 'All Types'}</option>
                  <option value="TRIP">TRIP</option>
                  <option value="TOUR">TOUR</option>
                </select>
                <select
                  value={filterDepartureTime}
                  onChange={(e) => { setFilterDepartureTime(e.target.value); setBookingPage(1); }}
                  className={cn('px-3 py-2 rounded-xl text-xs font-bold border transition-all focus:outline-none', filterDepartureTime !== 'ALL' ? 'bg-daiichi-red text-white border-daiichi-red' : 'bg-white text-gray-600 border-gray-200 hover:border-daiichi-red/40')}
                >
                  <option value="ALL">{language === 'vi' ? 'Tất cả giờ xuất bến' : 'All Departure Times'}</option>
                  {uniqueDepartureTimes.map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
                <select
                  value={filterRoute}
                  onChange={(e) => { setFilterRoute(e.target.value); setBookingPage(1); }}
                  className={cn('px-3 py-2 rounded-xl text-xs font-bold border transition-all focus:outline-none', filterRoute !== 'ALL' ? 'bg-daiichi-red text-white border-daiichi-red' : 'bg-white text-gray-600 border-gray-200 hover:border-daiichi-red/40')}
                >
                  <option value="ALL">{language === 'vi' ? 'Tất cả tuyến/tour' : 'All Routes/Tours'}</option>
                  {uniqueRoutes.map(route => (
                    <option key={route} value={route}>{route}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  placeholder={t.price_min_placeholder}
                  value={minPrice}
                  onChange={(e) => { setMinPrice(e.target.value); setBookingPage(1); }}
                  className={cn('px-3 py-2 rounded-xl text-xs font-bold border transition-all focus:outline-none w-28', minPrice ? 'bg-daiichi-red text-white border-daiichi-red placeholder-white/70' : 'bg-white text-gray-600 border-gray-200 hover:border-daiichi-red/40')}
                />
                <input
                  type="number"
                  min="0"
                  placeholder={t.price_max_placeholder}
                  value={maxPrice}
                  onChange={(e) => { setMaxPrice(e.target.value); setBookingPage(1); }}
                  className={cn('px-3 py-2 rounded-xl text-xs font-bold border transition-all focus:outline-none w-28', maxPrice ? 'bg-daiichi-red text-white border-daiichi-red placeholder-white/70' : 'bg-white text-gray-600 border-gray-200 hover:border-daiichi-red/40')}
                />
                {(startDate || endDate || agentFilter !== 'ALL' || filterType !== 'ALL' || filterDepartureTime !== 'ALL' || filterRoute !== 'ALL' || minPrice || maxPrice) && (
                  <button
                    onClick={() => {
                      setStartDate(''); setEndDate(''); setAgentFilter('ALL');
                      setFilterType('ALL'); setFilterDepartureTime('ALL');
                      setFilterRoute('ALL');
                      setMinPrice(''); setMaxPrice(''); setBookingPage(1);
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 bg-white text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all flex items-center gap-1"
                  >
                    <X size={12} /> {language === 'vi' ? 'Xóa lọc' : 'Clear'}
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto pb-4 custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-50">
                    <ResizableTh 
                      width={colWidths.customer} 
                      onResize={(w: number) => setColWidths(prev => ({ ...prev, customer: w }))}
                      className="pb-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest"
                    >
                      {language === 'vi' ? 'Khách hàng' : 'Customer'}
                    </ResizableTh>
                    <ResizableTh 
                      width={colWidths.type} 
                      onResize={(w: number) => setColWidths(prev => ({ ...prev, type: w }))}
                      className="pb-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest"
                    >
                      {language === 'vi' ? 'Loại' : 'Type'}
                    </ResizableTh>
                    <ResizableTh 
                      width={colWidths.route} 
                      onResize={(w: number) => setColWidths(prev => ({ ...prev, route: w }))}
                      className="pb-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest"
                    >
                      {language === 'vi' ? 'Tuyến/Tour' : 'Route/Tour'}
                    </ResizableTh>
                    <ResizableTh 
                      width={colWidths.agent} 
                      onResize={(w: number) => setColWidths(prev => ({ ...prev, agent: w }))}
                      className="pb-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest"
                    >
                      {language === 'vi' ? 'Người thực hiện' : 'Performed By'}
                    </ResizableTh>
                    <ResizableTh 
                      width={colWidths.price} 
                      onResize={(w: number) => setColWidths(prev => ({ ...prev, price: w }))}
                      className="pb-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest"
                    >
                      {language === 'vi' ? 'Giá' : 'Price'}
                    </ResizableTh>
                    <ResizableTh 
                      width={colWidths.status} 
                      onResize={(w: number) => setColWidths(prev => ({ ...prev, status: w }))}
                      className="pb-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest"
                    >
                      {language === 'vi' ? 'Trạng thái' : 'Status'}
                    </ResizableTh>
                    <th className="pb-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest" style={{ width: colWidths.actions }}>
                      {t.actions}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pagedBookings.map((booking) => (
                    <tr key={booking.id} className="group hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => handleView(booking)}>
                      <td className="py-5">
                        <div className="overflow-hidden">
                          <p className="font-bold text-gray-800 truncate">{booking.customerName}</p>
                          <p className="text-xs text-gray-400 truncate">{booking.phone}</p>
                        </div>
                      </td>
                      <td className="py-5">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase",
                          booking.type === 'TRIP' ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"
                        )}>
                          {booking.type}
                        </span>
                      </td>
                      <td className="py-5">
                        <p className="text-sm font-medium text-gray-700 truncate">{booking.route}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{formatBookingDate(booking.date)}{booking.time ? ` · ${booking.time}` : ''}</p>
                      </td>
                      <td className="py-5">
                        {booking.bookedByName ? (
                          <div className="overflow-hidden">
                            <p className="text-sm font-bold text-gray-700 truncate">{booking.bookedByName}</p>
                            <p className="text-[10px] text-gray-400 uppercase">{booking.bookedByRole || ''}</p>
                          </div>
                        ) : booking.agentId ? (
                          <div className="overflow-hidden">
                            <p className="text-sm font-bold text-gray-700 truncate">{booking.agent}</p>
                            <p className="text-[10px] text-gray-400 truncate font-mono">{String(booking.agentId).slice(-6).toUpperCase()}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">{language === 'vi' ? 'Khách lẻ' : 'Direct'}</span>
                        )}
                      </td>
                      <td className="py-5">
                        <p className="font-bold text-gray-800">{(booking.amount ?? 0).toLocaleString()}đ</p>
                      </td>
                      <td className="py-5">
                        <div className="flex flex-col gap-1">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-bold uppercase",
                            booking.status === 'PAID' ? "bg-green-100 text-green-600" : "bg-yellow-100 text-yellow-600"
                          )}>
                            {booking.status === 'PAID' ? (language === 'vi' ? 'Đã trả' : 'Paid') : (language === 'vi' ? 'Đã đặt' : 'Booked')}
                          </span>
                          {(booking.isCheckedIn || booking.is_checked_in) && (
                            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-600">
                              ✓ Check-in
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-5">
                        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                          <button 
                            onClick={() => handleView(booking)}
                            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title={language === 'vi' ? 'Xem chi tiết' : 'View details'}
                          >
                            <Eye size={16} />
                          </button>
                          {!isAgent && (
                            <>
                              <button 
                                onClick={() => handleEdit(booking)}
                                className="p-2 text-gray-600 hover:text-daiichi-red hover:bg-red-50 rounded-lg transition-all"
                              >
                                <Edit3 size={16} />
                              </button>
                              {isAdmin && (
                              <button 
                                onClick={() => handleDelete(booking.id)}
                                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              >
                                <Trash2 size={16} />
                              </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination controls */}
            {bookingTotalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-gray-50 mt-4">
                <span className="text-xs text-gray-400">
                  {language === 'vi'
                    ? `${(bookingPage - 1) * BOOKINGS_PER_PAGE + 1}–${Math.min(bookingPage * BOOKINGS_PER_PAGE, filteredBookings.length)} / ${filteredBookings.length} đơn`
                    : `${(bookingPage - 1) * BOOKINGS_PER_PAGE + 1}–${Math.min(bookingPage * BOOKINGS_PER_PAGE, filteredBookings.length)} of ${filteredBookings.length} bookings`}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setBookingPage(p => Math.max(1, p - 1))}
                    disabled={bookingPage === 1}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    {language === 'vi' ? '← Trước' : '← Prev'}
                  </button>
                  {getPaginationPages(bookingPage, bookingTotalPages).map((item, idx) =>
                      item === '...' ? (
                        <span key={`ellipsis-${idx}`} className="px-2 text-xs text-gray-400">…</span>
                      ) : (
                        <button
                          key={item}
                          onClick={() => setBookingPage(item as number)}
                          className={cn(
                            "w-8 h-8 text-xs font-bold rounded-lg transition-all",
                            bookingPage === item
                              ? "bg-daiichi-red text-white shadow-sm"
                              : "text-gray-600 hover:bg-gray-50 border border-gray-200"
                          )}
                        >
                          {item}
                        </button>
                      )
                    )}
                  <button
                    onClick={() => setBookingPage(p => Math.min(bookingTotalPages, p + 1))}
                    disabled={bookingPage === bookingTotalPages}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    {language === 'vi' ? 'Sau →' : 'Next →'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats Section - horizontal grid */}
      </div>

      {/* Consignment / Shipping Table */}
      <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h3 className="text-xl font-bold text-gray-800">
              {language === 'vi' ? 'Dịch vụ gửi hàng hóa' : 'Consignment / Shipping Services'}
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              {filteredConsignments.length}/{consignments.length} {language === 'vi' ? 'đơn hàng' : 'orders'}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Status filter pills */}
            <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100">
              {(['ALL', 'PENDING', 'PICKED_UP', 'DELIVERED'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => { setConsignmentStatusFilter(s); setConsignmentPage(1); }}
                  className={cn(
                    "px-3 py-1 rounded-lg text-[10px] font-bold transition-all",
                    consignmentStatusFilter === s ? "bg-daiichi-red text-white" : "text-gray-500"
                  )}
                >
                  {s === 'ALL'
                    ? (language === 'vi' ? 'Tất cả' : 'All')
                    : s === 'PENDING'
                    ? (language === 'vi' ? 'Chờ' : 'Pending')
                    : s === 'PICKED_UP'
                    ? (language === 'vi' ? 'Đã lấy' : 'Picked Up')
                    : (language === 'vi' ? 'Đã giao' : 'Delivered')}
                </button>
              ))}
            </div>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder={language === 'vi' ? 'Tìm theo tên, SĐT...' : 'Search by name, phone...'}
                value={consignmentSearch}
                onChange={e => { setConsignmentSearch(e.target.value); setConsignmentPage(1); }}
                className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10 w-56"
              />
            </div>
            {/* Export */}
            <button
              onClick={() => {
                const rows = filteredConsignments.map(c => ({
                  ID: c.id,
                  [language === 'vi' ? 'Người gửi' : 'Sender']: c.senderName || c.sender || '',
                  [language === 'vi' ? 'SĐT người gửi' : 'Sender Phone']: c.senderPhone || '',
                  [language === 'vi' ? 'Người nhận' : 'Receiver']: c.receiverName || c.receiver || '',
                  [language === 'vi' ? 'SĐT người nhận' : 'Receiver Phone']: c.receiverPhone || '',
                  [language === 'vi' ? 'Loại hàng' : 'Type']: c.type || '',
                  [language === 'vi' ? 'Khối lượng' : 'Weight']: c.weight || '',
                  COD: c.cod || 0,
                  [language === 'vi' ? 'Trạng thái' : 'Status']: c.status || '',
                  [language === 'vi' ? 'Ghi chú' : 'Notes']: c.notes || '',
                }));
                const filename = `Daiichi_Consignments_${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())}.xlsx`;
                exportRowsToExcel(rows, filename, language === 'vi' ? 'Hàng hóa' : 'Consignments').catch(err =>
                  console.error('[Excel] Export failed:', err),
                );
              }}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all"
            >
              <Download size={16} />
              {language === 'vi' ? 'Xuất Excel' : 'Export'}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto pb-4 custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-50">
                <ResizableTh width={consignColWidths.sender} onResize={(w) => setConsignColWidths(p => ({ ...p, sender: w }))} className="pb-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Người gửi' : 'Sender'}</ResizableTh>
                <ResizableTh width={consignColWidths.receiver} onResize={(w) => setConsignColWidths(p => ({ ...p, receiver: w }))} className="pb-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Người nhận' : 'Receiver'}</ResizableTh>
                <ResizableTh width={consignColWidths.typeWeight} onResize={(w) => setConsignColWidths(p => ({ ...p, typeWeight: w }))} className="pb-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Loại / KL' : 'Type / Weight'}</ResizableTh>
                <ResizableTh width={consignColWidths.cod} onResize={(w) => setConsignColWidths(p => ({ ...p, cod: w }))} className="pb-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">COD</ResizableTh>
                <ResizableTh width={consignColWidths.status} onResize={(w) => setConsignColWidths(p => ({ ...p, status: w }))} className="pb-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Trạng thái' : 'Status'}</ResizableTh>
                <ResizableTh width={consignColWidths.created} onResize={(w) => setConsignColWidths(p => ({ ...p, created: w }))} className="pb-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Ngày tạo' : 'Created'}</ResizableTh>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredConsignments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400 text-sm">
                    {language === 'vi' ? 'Chưa có đơn hàng nào' : 'No consignments found'}
                  </td>
                </tr>
              ) : pagedConsignments.map(c => (
                <tr key={c.id} className="group hover:bg-gray-50/50 transition-colors">
                  <td className="py-4">
                    <p className="font-bold text-gray-800 text-sm">{c.senderName || c.sender || '—'}</p>
                    <p className="text-xs text-gray-400">{c.senderPhone || ''}</p>
                  </td>
                  <td className="py-4">
                    <p className="font-bold text-gray-800 text-sm">{c.receiverName || c.receiver || '—'}</p>
                    <p className="text-xs text-gray-400">{c.receiverPhone || ''}</p>
                  </td>
                  <td className="py-4">
                    <p className="text-sm text-gray-700">{c.type || '—'}</p>
                    {c.weight && <p className="text-xs text-gray-400">{c.weight}</p>}
                  </td>
                  <td className="py-4">
                    <p className="font-bold text-gray-800 text-sm">{c.cod ? `${(+c.cod).toLocaleString()}đ` : '—'}</p>
                  </td>
                  <td className="py-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase",
                      c.status === 'DELIVERED' ? "bg-green-100 text-green-600"
                      : c.status === 'PICKED_UP' ? "bg-blue-100 text-blue-600"
                      : "bg-yellow-100 text-yellow-600"
                    )}>
                      {c.status === 'DELIVERED'
                        ? (language === 'vi' ? 'Đã giao' : 'Delivered')
                        : c.status === 'PICKED_UP'
                        ? (language === 'vi' ? 'Đã lấy' : 'Picked Up')
                        : (language === 'vi' ? 'Chờ xử lý' : 'Pending')}
                    </span>
                  </td>
                  <td className="py-4">
                    <p className="text-xs text-gray-500">{formatActivityTime(c.createdAt)}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {consignmentTotalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-gray-50 mt-4">
            <span className="text-xs text-gray-400">
              {language === 'vi'
                ? `${(consignmentPage - 1) * CONSIGNMENTS_PER_PAGE + 1}–${Math.min(consignmentPage * CONSIGNMENTS_PER_PAGE, filteredConsignments.length)} / ${filteredConsignments.length} đơn hàng`
                : `${(consignmentPage - 1) * CONSIGNMENTS_PER_PAGE + 1}–${Math.min(consignmentPage * CONSIGNMENTS_PER_PAGE, filteredConsignments.length)} of ${filteredConsignments.length} orders`}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setConsignmentPage(p => Math.max(1, p - 1))}
                disabled={consignmentPage === 1}
                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {language === 'vi' ? '← Trước' : '← Prev'}
              </button>
              {getPaginationPages(consignmentPage, consignmentTotalPages).map((item, idx) =>
                item === '...' ? (
                  <span key={`dots-${idx}`} className="px-2 text-gray-400 text-xs">…</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setConsignmentPage(item as number)}
                    className={cn(
                      "w-8 h-8 text-xs font-bold rounded-lg transition-all",
                      consignmentPage === item
                        ? "bg-daiichi-red text-white"
                        : "text-gray-600 hover:bg-gray-50 border border-gray-200"
                    )}
                  >
                    {item}
                  </button>
                )
              )}
              <button
                onClick={() => setConsignmentPage(p => Math.min(consignmentTotalPages, p + 1))}
                disabled={consignmentPage === consignmentTotalPages}
                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {language === 'vi' ? 'Sau →' : 'Next →'}
              </button>
            </div>
          </div>
        )}
      </div>
      <AnimatePresence>
        {viewingBooking && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              {/* Header */}
              <div className={cn("p-8 text-white relative", viewingBooking.type === 'TOUR' ? "bg-emerald-500" : "bg-blue-500")}>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">{viewingBooking.type === 'TOUR' ? (language === 'vi' ? 'Đặt tour' : 'Tour Booking') : (language === 'vi' ? 'Vé xe' : 'Bus Ticket')}</span>
                    <h3 className="text-2xl font-bold mt-1">{viewingBooking.ticketCode || `#${viewingBooking.id?.slice(-8).toUpperCase() || viewingBooking.id}`}</h3>
                    <p className="text-white/80 text-sm mt-1">{viewingBooking.route}</p>
                  </div>
                  <button onClick={() => setViewingBooking(null)} className="text-white/60 hover:text-white transition-colors p-2">
                    <X size={24} />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-8 overflow-y-auto flex-1 space-y-6">
                {/* Customer Info */}
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">{language === 'vi' ? 'Thông tin khách hàng' : 'Customer Info'}</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-2xl">
                      <div className="flex items-center gap-2 text-gray-400 mb-1">
                        <User size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{language === 'vi' ? 'Tên' : 'Name'}</span>
                      </div>
                      <p className="font-bold text-gray-800">{viewingBooking.customerName}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl">
                      <div className="flex items-center gap-2 text-gray-400 mb-1">
                        <CreditCard size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{language === 'vi' ? 'Số điện thoại' : 'Phone'}</span>
                      </div>
                      <p className="font-bold text-gray-800">{viewingBooking.phone}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl">
                      <div className="flex items-center gap-2 text-gray-400 mb-1">
                        <Users size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{language === 'vi' ? 'Số người' : 'Persons'}</span>
                      </div>
                      <p className="font-bold text-gray-800">
                        {viewingBooking.adults ?? 1} {language === 'vi' ? 'người lớn' : 'adults'}
                        {(viewingBooking.children ?? 0) > 0 && `, ${viewingBooking.children} ${language === 'vi' ? 'trẻ em' : 'children'}`}
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl">
                      <div className="flex items-center gap-2 text-gray-400 mb-1">
                        <Tag size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{language === 'vi' ? 'Người thực hiện' : 'Performed By'}</span>
                      </div>
                      <p className="font-bold text-gray-800">{viewingBooking.bookedByName || viewingBooking.agent || '—'}</p>
                      {viewingBooking.bookedByRole && <p className="text-xs text-gray-400 uppercase">{viewingBooking.bookedByRole}</p>}
                    </div>
                  </div>
                </div>

                {/* Vehicle & Trip Info (TRIP bookings only) */}
                {viewingBooking.type === 'TRIP' && viewingBooking.tripId && (() => {
                  const trip = trips.find((tr) => tr.id === viewingBooking.tripId);
                  if (!trip) return null;
                  return (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">{language === 'vi' ? 'Thông tin xe & chuyến đi' : 'Vehicle & Trip Info'}</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-orange-50 rounded-2xl">
                          <div className="flex items-center gap-2 text-orange-400 mb-1">
                            <Bus size={14} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">{language === 'vi' ? 'Số xe' : 'Vehicle'}</span>
                          </div>
                          <p className="font-bold text-orange-800">{trip.licensePlate || '—'}</p>
                        </div>
                        <div className="p-4 bg-orange-50 rounded-2xl">
                          <div className="flex items-center gap-2 text-orange-400 mb-1">
                            <User size={14} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">{language === 'vi' ? 'Tài xế' : 'Driver'}</span>
                          </div>
                          <p className="font-bold text-orange-800">{trip.driverName || '—'}</p>
                        </div>
                        <div className="p-4 bg-orange-50 rounded-2xl">
                          <div className="flex items-center gap-2 text-orange-400 mb-1">
                            <Clock size={14} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">{language === 'vi' ? 'Giờ khởi hành' : 'Departure'}</span>
                          </div>
                          <p className="font-bold text-orange-800">{trip.time || '—'}</p>
                        </div>
                        {trip.vehicleType && (
                          <div className="p-4 bg-orange-50 rounded-2xl">
                            <div className="flex items-center gap-2 text-orange-400 mb-1">
                              <Bus size={14} />
                              <span className="text-[10px] font-bold uppercase tracking-widest">{language === 'vi' ? 'Loại xe' : 'Type'}</span>
                            </div>
                            <p className="font-bold text-orange-800">{trip.vehicleType}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Service Info */}
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">{language === 'vi' ? 'Thông tin dịch vụ' : 'Service Info'}</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-2xl">
                      <div className="flex items-center gap-2 text-gray-400 mb-1">
                        <MapPin size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{viewingBooking.type === 'TOUR' ? 'Tour' : (language === 'vi' ? 'Tuyến' : 'Route')}</span>
                      </div>
                      <p className="font-bold text-gray-800 text-sm">{viewingBooking.route}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl">
                      <div className="flex items-center gap-2 text-gray-400 mb-1">
                        <CalendarIcon size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{language === 'vi' ? 'Ngày' : 'Date'}</span>
                      </div>
                      <p className="font-bold text-gray-800">{formatBookingDate(viewingBooking.date)}</p>
                    </div>
                    {viewingBooking.type !== 'TOUR' && viewingBooking.time && (
                      <div className="p-4 bg-gray-50 rounded-2xl">
                        <div className="flex items-center gap-2 text-gray-400 mb-1">
                          <Clock size={14} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">{language === 'vi' ? 'Giờ' : 'Time'}</span>
                        </div>
                        <p className="font-bold text-gray-800">{viewingBooking.time}</p>
                      </div>
                    )}
                    {viewingBooking.type !== 'TOUR' && (viewingBooking.seatId || viewingBooking.seatIds) && (
                      <div className="p-4 bg-gray-50 rounded-2xl">
                        <div className="flex items-center gap-2 text-gray-400 mb-1">
                          <Bus size={14} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">{language === 'vi' ? 'Ghế' : 'Seat'}</span>
                        </div>
                        <p className="font-bold text-gray-800">
                          {viewingBooking.seatIds?.length > 1 ? viewingBooking.seatIds.join(', ') : (viewingBooking.seatId || '—')}
                        </p>
                      </div>
                    )}
                    {(() => {
                      // For old bookings, pickupAddress/dropoffAddress may only exist in the
                      // trip's seat document (not the booking document). Fall back to seat data.
                      const seatLookup = viewingBooking.type !== 'TOUR' && viewingBooking.tripId && viewingBooking.seatId
                        ? trips.find((tr) => tr.id === viewingBooking.tripId)?.seats?.find((s: any) => s.id === viewingBooking.seatId)
                        : null;
                      const effectivePickupAddress = viewingBooking.pickupAddress || seatLookup?.pickupAddress;
                      const effectiveDropoffAddress = viewingBooking.dropoffAddress || seatLookup?.dropoffAddress;
                      const effectivePickupDetail = viewingBooking.pickupAddressDetail || seatLookup?.pickupAddressDetail;
                      const effectiveDropoffDetail = viewingBooking.dropoffAddressDetail || seatLookup?.dropoffAddressDetail;
                      const effectivePickupStopAddress = viewingBooking.pickupStopAddress || seatLookup?.pickupStopAddress;
                      const effectiveDropoffStopAddress = viewingBooking.dropoffStopAddress || seatLookup?.dropoffStopAddress;
                      const fullPickup = [effectivePickupDetail, effectivePickupAddress, effectivePickupStopAddress].filter(Boolean).join(' ');
                      const fullDropoff = [effectiveDropoffDetail, effectiveDropoffAddress, effectiveDropoffStopAddress].filter(Boolean).join(' ');
                      return <>
                        {viewingBooking.type !== 'TOUR' && viewingBooking.pickupPoint && (
                          <div className="p-4 bg-blue-50 rounded-2xl">
                            <div className="flex items-center gap-2 text-blue-400 mb-1">
                              <MapPin size={14} className="text-blue-500" />
                              <span className="text-[10px] font-bold uppercase tracking-widest">{language === 'vi' ? 'Đón' : 'Pickup'}</span>
                            </div>
                            <p className="font-bold text-blue-800 text-xs">{viewingBooking.pickupPoint}</p>
                          </div>
                        )}
                        {viewingBooking.type !== 'TOUR' && fullPickup && (
                          <div className="p-4 bg-blue-50 rounded-2xl">
                            <div className="flex items-center gap-2 text-blue-400 mb-1">
                              <MapPin size={14} className="text-blue-500" />
                              <span className="text-[10px] font-bold uppercase tracking-widest">{language === 'vi' ? 'Điểm đón' : 'Pickup Address'}</span>
                            </div>
                            <p className="font-bold text-blue-800 text-xs">{fullPickup}</p>
                          </div>
                        )}
                        {viewingBooking.type !== 'TOUR' && viewingBooking.dropoffPoint && (
                          <div className="p-4 bg-green-50 rounded-2xl">
                            <div className="flex items-center gap-2 text-green-400 mb-1">
                              <MapPin size={14} className="text-green-500" />
                              <span className="text-[10px] font-bold uppercase tracking-widest">{language === 'vi' ? 'Trả' : 'Dropoff'}</span>
                            </div>
                            <p className="font-bold text-green-800 text-xs">{viewingBooking.dropoffPoint}</p>
                          </div>
                        )}
                        {viewingBooking.type !== 'TOUR' && fullDropoff && (
                          <div className="p-4 bg-green-50 rounded-2xl">
                            <div className="flex items-center gap-2 text-green-400 mb-1">
                              <MapPin size={14} className="text-green-500" />
                              <span className="text-[10px] font-bold uppercase tracking-widest">{language === 'vi' ? 'Điểm trả' : 'Dropoff Address'}</span>
                            </div>
                            <p className="font-bold text-green-800 text-xs">{fullDropoff}</p>
                          </div>
                        )}
                      </>;
                    })()}
                    {/* Tour specific fields */}
                    {viewingBooking.type === 'TOUR' && viewingBooking.duration && (
                      <div className="p-4 bg-indigo-50 rounded-2xl">
                        <div className="flex items-center gap-2 text-indigo-400 mb-1">
                          <Clock size={14} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">{language === 'vi' ? 'Thời gian' : 'Duration'}</span>
                        </div>
                        <p className="font-bold text-indigo-800">{viewingBooking.duration}</p>
                      </div>
                    )}
                    {viewingBooking.type === 'TOUR' && (viewingBooking.nights ?? 0) > 0 && (
                      <div className="p-4 bg-indigo-50 rounded-2xl">
                        <div className="flex items-center gap-2 text-indigo-400 mb-1">
                          <Moon size={14} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">{language === 'vi' ? 'Số đêm' : 'Nights'}</span>
                        </div>
                        <p className="font-bold text-indigo-800">{viewingBooking.nights}</p>
                      </div>
                    )}
                    {viewingBooking.type === 'TOUR' && viewingBooking.accommodation && viewingBooking.accommodation !== 'none' && (
                      <div className="p-4 bg-blue-50 rounded-2xl">
                        <div className="flex items-center gap-2 text-blue-400 mb-1">
                          <Hotel size={14} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">{language === 'vi' ? 'Phòng' : 'Room'}</span>
                        </div>
                        <p className="font-bold text-blue-800 capitalize">{viewingBooking.accommodation}</p>
                      </div>
                    )}
                    {viewingBooking.type === 'TOUR' && viewingBooking.mealPlan && viewingBooking.mealPlan !== 'none' && (
                      <div className="p-4 bg-amber-50 rounded-2xl">
                        <div className="flex items-center gap-2 text-amber-400 mb-1">
                          <Coffee size={14} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">{language === 'vi' ? 'Bữa ăn' : 'Meals'}</span>
                        </div>
                        <p className="font-bold text-amber-800">{viewingBooking.mealPlan}</p>
                      </div>
                    )}
                    {viewingBooking.paymentMethod && (
                      <div className="p-4 bg-gray-50 rounded-2xl">
                        <div className="flex items-center gap-2 text-gray-400 mb-1">
                          <CreditCard size={14} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">{language === 'vi' ? 'Thanh toán' : 'Payment'}</span>
                        </div>
                        <p className="font-bold text-gray-800">{viewingBooking.paymentMethod}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes */}
                {viewingBooking.notes && (
                  <div className="p-4 bg-yellow-50 rounded-2xl border border-yellow-100">
                    <p className="text-[10px] font-bold text-yellow-600 uppercase tracking-widest mb-1">{language === 'vi' ? 'Ghi chú' : 'Notes'}</p>
                    <p className="text-sm text-gray-700">{viewingBooking.notes}</p>
                  </div>
                )}

                {/* Total */}
                <div className="flex items-center justify-between p-6 bg-gray-50 rounded-3xl border border-gray-100">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Trạng thái' : 'Status'}</p>
                    <span className={cn(
                      "text-sm font-bold",
                      viewingBooking.status === 'PAID' ? "text-green-600" : "text-yellow-600"
                    )}>
                      {viewingBooking.status === 'PAID' ? (language === 'vi' ? 'Đã trả' : 'Paid') : (language === 'vi' ? 'Đã đặt' : 'Booked')}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Tổng tiền' : 'Total'}</p>
                    <p className="text-2xl font-bold text-daiichi-red">{(viewingBooking.amount || 0).toLocaleString()}đ</p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 bg-gray-50 flex gap-3 shrink-0">
                {!isAgent && (
                  <button 
                    onClick={() => { setViewingBooking(null); handleEdit(viewingBooking); }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-daiichi-red text-white rounded-2xl font-bold shadow-lg shadow-daiichi-red/20"
                  >
                    <Edit3 size={18} />
                    {language === 'vi' ? 'Chỉnh sửa' : 'Edit'}
                  </button>
                )}
                <button 
                  onClick={() => setViewingBooking(null)}
                  className="flex-1 py-3 bg-white border border-gray-200 text-gray-600 rounded-2xl font-bold hover:bg-gray-100 transition-all"
                >
                  {language === 'vi' ? 'Đóng' : 'Close'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingBooking && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-8 overflow-y-auto flex-1">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-800">{t.edit_booking}</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      {editingBooking.type === 'TOUR' ? (language === 'vi' ? 'Đặt tour' : 'Tour Booking') : (language === 'vi' ? 'Vé xe' : 'Bus Ticket')}
                      {' • '}#{editingBooking.id?.slice(-8).toUpperCase()}
                    </p>
                  </div>
                  <button onClick={() => setEditingBooking(null)} className="text-gray-400 hover:text-gray-600">
                    <X size={24} />
                  </button>
                </div>
                <div className="space-y-4">
                  {/* Customer Name */}
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Tên khách hàng' : 'Customer Name'}</label>
                    <input type="text" value={editingBooking.customerName}
                      onChange={e => setEditingBooking({...editingBooking, customerName: e.target.value})}
                      className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" />
                  </div>
                  {/* Phone */}
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Số điện thoại' : 'Phone'}</label>
                    <input type="text" value={editingBooking.phone || ''}
                      onChange={e => setEditingBooking({...editingBooking, phone: e.target.value})}
                      className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" />
                  </div>
                  {/* Persons */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Người lớn' : 'Adults'}</label>
                      <input type="number" min="1" value={editingBooking.adults ?? 1}
                        onChange={e => setEditingBooking({...editingBooking, adults: parseInt(e.target.value) || 1})}
                        className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Trẻ em' : 'Children'}</label>
                      <input type="number" min="0" value={editingBooking.children ?? ''}
                        onChange={e => setEditingBooking({...editingBooking, children: parseInt(e.target.value) || 0})}
                        className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" />
                    </div>
                  </div>

                  {/* ── TRIP: Change Trip & Seat Section ── */}
                  {editingBooking.type !== 'TOUR' && (
                    <div className="border border-gray-100 rounded-2xl overflow-hidden">
                      {/* Current trip summary */}
                      <div className="p-4 bg-gray-50 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                            {language === 'vi' ? 'Chuyến xe hiện tại' : 'Current Trip'}
                          </p>
                          {editSelectedTrip ? (
                            <div>
                              <p className="font-bold text-daiichi-red text-sm">{editSelectedTrip.route} · {formatBookingDate(editSelectedTrip.date)} · {editSelectedTrip.time}</p>
                              <p className="text-xs text-gray-500">{editSelectedTrip.licensePlate}</p>
                              {editSelectedSeats.length > 0 && (
                                <p className="text-xs font-bold text-blue-600 mt-0.5">
                                  {language === 'vi' ? 'Ghế đã chọn' : 'Seats'}: {editSelectedSeats.join(', ')}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div>
                              <p className="font-bold text-gray-700 text-sm">{editingBooking.route} · {formatBookingDate(editingBooking.date)} · {editingBooking.time}</p>
                              <p className="text-xs text-gray-500">
                                {language === 'vi' ? 'Ghế' : 'Seat'}: {editingBooking.seatIds?.join(', ') || editingBooking.seatId || '—'}
                              </p>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            setEditShowTripSearch(v => !v);
                            setEditSelectedTrip(null);
                            setEditSelectedSeats([]);
                          }}
                          className={cn(
                            "shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-all",
                            editShowTripSearch
                              ? "bg-gray-200 text-gray-600"
                              : "bg-daiichi-red text-white shadow-sm"
                          )}
                        >
                          {editShowTripSearch
                            ? (language === 'vi' ? 'Huỷ' : 'Cancel')
                            : (language === 'vi' ? 'Đổi chuyến' : 'Change Trip')}
                        </button>
                      </div>

                      {/* Trip search panel */}
                      {editShowTripSearch && (
                        <div className="p-4 space-y-3 border-t border-gray-100">
                          {/* Date filter */}
                          <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Ngày đi' : 'Travel Date'}</label>
                            <input
                              type="date"
                              value={editTripDate}
                              min={getTodayVN()}
                              onChange={e => { setEditTripDate(e.target.value); setEditSelectedTrip(null); setEditSelectedSeats([]); }}
                              className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
                            />
                          </div>

                          {/* Matching trips list */}
                          {(() => {
                            const matchingTrips = trips
                              .filter(tr =>
                                tr.status === TripStatus.WAITING &&
                                (!editTripDate || tr.date === editTripDate) &&
                                (tr.seats || []).some((s: any) => s.status === SeatStatus.EMPTY)
                              )
                              .sort((a: any, b: any) => {
                                const aKey = `${a.date || ''}T${a.time || ''}`;
                                const bKey = `${b.date || ''}T${b.time || ''}`;
                                return aKey.localeCompare(bKey);
                              });

                            if (!editTripDate) {
                              return (
                                <p className="text-xs text-gray-400 text-center py-2">
                                  {language === 'vi' ? 'Chọn ngày để tìm chuyến xe' : 'Select a date to find trips'}
                                </p>
                              );
                            }

                            if (matchingTrips.length === 0) {
                              return (
                                <p className="text-xs text-gray-400 text-center py-2">
                                  {language === 'vi' ? 'Không có chuyến xe nào phù hợp trong ngày này' : 'No trips available on this date'}
                                </p>
                              );
                            }

                            return (
                              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                                {matchingTrips.map((tr: any) => {
                                  const emptyCount = (tr.seats || []).filter((s: any) => s.status === SeatStatus.EMPTY).length;
                                  const isSelected = editSelectedTrip?.id === tr.id;
                                  return (
                                    <button
                                      key={tr.id}
                                      onClick={() => { setEditSelectedTrip(tr); setEditSelectedSeats([]); }}
                                      className={cn(
                                        "w-full text-left p-3 rounded-xl border-2 transition-all",
                                        isSelected
                                          ? "border-daiichi-red bg-red-50"
                                          : "border-gray-100 bg-white hover:border-daiichi-red/30 hover:bg-gray-50"
                                      )}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <p className="font-bold text-gray-800 text-sm">{tr.route}</p>
                                          <p className="text-xs text-gray-500">{formatBookingDate(tr.date)} · {tr.time} · {tr.licensePlate}</p>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-xs font-bold text-green-600">{emptyCount} {language === 'vi' ? 'ghế trống' : 'seats left'}</p>
                                          <p className="text-xs text-gray-400">{tr.driverName}</p>
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          })()}

                          {/* Seat selection for selected trip */}
                          {editSelectedTrip && (
                            <div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                                {language === 'vi' ? 'Chọn ghế' : 'Select Seats'} — {editSelectedTrip.licensePlate}
                              </p>
                              {editSelectedSeats.length > 0 && (
                                <p className="text-xs font-bold text-blue-600 mb-2">
                                  {language === 'vi' ? 'Đã chọn' : 'Selected'}: {editSelectedSeats.join(', ')}
                                </p>
                              )}
                              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 bg-gray-50 rounded-xl">
                                {(editSelectedTrip.seats || [])
                                  .filter((s: any) => !s.isDriver && !s.isAisle)
                                  .sort((a: any, b: any) => {
                                    const aNum = parseInt(a.id, 10) || 0;
                                    const bNum = parseInt(b.id, 10) || 0;
                                    return aNum - bNum || String(a.id).localeCompare(String(b.id));
                                  })
                                  .map((seat: any) => {
                                    const isEmpty = seat.status === SeatStatus.EMPTY;
                                    const isChosen = editSelectedSeats.includes(seat.id);
                                    return (
                                      <button
                                        key={seat.id}
                                        disabled={!isEmpty && !isChosen}
                                        onClick={() => {
                                          if (!isEmpty && !isChosen) return;
                                          setEditSelectedSeats(prev =>
                                            prev.includes(seat.id)
                                              ? prev.filter(id => id !== seat.id)
                                              : [...prev, seat.id]
                                          );
                                        }}
                                        className={cn(
                                          "w-10 h-10 rounded-lg flex items-center justify-center text-[10px] font-bold border-2 transition-all",
                                          seat.status === SeatStatus.PAID && !isChosen && "bg-daiichi-red text-white border-daiichi-red cursor-not-allowed opacity-60",
                                          seat.status === SeatStatus.BOOKED && !isChosen && "bg-yellow-400 text-white border-yellow-400 cursor-not-allowed opacity-60",
                                          isChosen && "bg-blue-500 text-white border-blue-500 shadow-md",
                                          isEmpty && !isChosen && "bg-white border-gray-200 text-gray-600 hover:border-daiichi-red hover:text-daiichi-red cursor-pointer"
                                        )}
                                      >
                                        {seat.id}
                                      </button>
                                    );
                                  })}
                              </div>
                              {editSelectedSeats.length === 0 && (
                                <p className="text-xs text-orange-500 mt-1">
                                  {language === 'vi' ? '* Vui lòng chọn ít nhất 1 ghế' : '* Please select at least 1 seat'}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TOUR: Date field */}
                  {editingBooking.type === 'TOUR' && (
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Ngày' : 'Date'}</label>
                      <input type="date" value={editingBooking.date || ''}
                        onChange={e => setEditingBooking({...editingBooking, date: e.target.value})}
                        className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" />
                    </div>
                  )}

                  {/* Tour-specific fields */}
                  {editingBooking.type === 'TOUR' && (
                    <>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Tuyến/Tour' : 'Route/Tour'}</label>
                        <input type="text" value={editingBooking.route || ''}
                          onChange={e => setEditingBooking({...editingBooking, route: e.target.value})}
                          className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Phòng nghỉ' : 'Accommodation'}</label>
                        <select value={editingBooking.accommodation || 'none'}
                          onChange={e => setEditingBooking({...editingBooking, accommodation: e.target.value})}
                          className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/10">
                          <option value="none">{language === 'vi' ? 'Không có' : 'None'}</option>
                          <option value="standard">{language === 'vi' ? 'Tiêu chuẩn' : 'Standard'}</option>
                          <option value="deluxe">Deluxe</option>
                          <option value="suite">Suite</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Bữa ăn' : 'Meal Plan'}</label>
                        <select value={editingBooking.mealPlan || 'none'}
                          onChange={e => setEditingBooking({...editingBooking, mealPlan: e.target.value})}
                          className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/10">
                          <option value="none">{language === 'vi' ? 'Không có' : 'None'}</option>
                          <option value="breakfast">{language === 'vi' ? 'Bữa sáng' : 'Breakfast'}</option>
                          <option value="half_board">{language === 'vi' ? 'Nửa ngày ăn' : 'Half Board'}</option>
                          <option value="full_board">{language === 'vi' ? 'Cả ngày ăn' : 'Full Board'}</option>
                        </select>
                      </div>
                    </>
                  )}

                  {/* Pickup/Dropoff for TRIP bookings */}
                  {editingBooking.type !== 'TOUR' && (
                    <>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Điểm đón (tên điểm)' : 'Pickup Stop Name'}</label>
                        <input type="text" value={editingBooking.pickupAddress || ''}
                          onChange={e => setEditingBooking({...editingBooking, pickupAddress: e.target.value})}
                          className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" />
                        <input type="text" value={editingBooking.pickupAddressDetail || ''}
                          onChange={e => setEditingBooking({...editingBooking, pickupAddressDetail: e.target.value})}
                          placeholder={language === 'vi' ? 'Chi tiết (số nhà, tầng...)' : 'Detail (house no., floor...)'}
                          className="w-full mt-1 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" />
                        <input type="text" value={editingBooking.pickupStopAddress || ''}
                          onChange={e => setEditingBooking({...editingBooking, pickupStopAddress: e.target.value})}
                          placeholder={language === 'vi' ? 'Địa chỉ điểm đón' : 'Stop address'}
                          className="w-full mt-1 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Điểm trả (tên điểm)' : 'Dropoff Stop Name'}</label>
                        <input type="text" value={editingBooking.dropoffAddress || ''}
                          onChange={e => setEditingBooking({...editingBooking, dropoffAddress: e.target.value})}
                          className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" />
                        <input type="text" value={editingBooking.dropoffAddressDetail || ''}
                          onChange={e => setEditingBooking({...editingBooking, dropoffAddressDetail: e.target.value})}
                          placeholder={language === 'vi' ? 'Chi tiết (số nhà, tầng...)' : 'Detail (house no., floor...)'}
                          className="w-full mt-1 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" />
                        <input type="text" value={editingBooking.dropoffStopAddress || ''}
                          onChange={e => setEditingBooking({...editingBooking, dropoffStopAddress: e.target.value})}
                          placeholder={language === 'vi' ? 'Địa chỉ điểm trả' : 'Stop address'}
                          className="w-full mt-1 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" />
                      </div>
                    </>
                  )}
                  {/* Notes */}
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Ghi chú' : 'Notes'}</label>
                    <textarea value={editingBooking.notes || ''}
                      onChange={e => setEditingBooking({...editingBooking, notes: e.target.value})}
                      rows={2}
                      className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/10 resize-none" />
                  </div>
                  {/* Amount */}
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Tổng tiền (đ)' : 'Amount (VND)'}</label>
                    <input type="number" min="0" value={editingBooking.amount || ''}
                      onChange={e => setEditingBooking({...editingBooking, amount: parseInt(e.target.value) || 0})}
                      className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" />
                  </div>
                  {/* Agent */}
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Đại lý' : 'Agent'}</label>
                    <select value={editingBooking.agent || 'Trực tiếp'}
                      onChange={e => setEditingBooking({...editingBooking, agent: e.target.value})}
                      className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/10">
                      <option value="Trực tiếp">{language === 'vi' ? 'Trực tiếp' : 'Direct'}</option>
                      {uniqueAgents.filter(a => a !== 'Trực tiếp').map(a => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>
                  {/* Payment Method */}
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Phương thức thanh toán' : 'Payment Method'}</label>
                    <select value={editingBooking.paymentMethod || ''}
                      onChange={e => setEditingBooking({...editingBooking, paymentMethod: e.target.value})}
                      className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/10">
                      <option value="">{language === 'vi' ? '-- Chọn --' : '-- Select --'}</option>
                      <option value="Tiền mặt">{language === 'vi' ? 'Tiền mặt' : 'Cash'}</option>
                      <option value="Chuyển khoản">{language === 'vi' ? 'Chuyển khoản' : 'Bank Transfer'}</option>
                      <option value="MoMo">MoMo</option>
                      <option value="ZaloPay">ZaloPay</option>
                      <option value="Giữ vé">{language === 'vi' ? 'Giữ vé' : 'Hold Ticket'}</option>
                    </select>
                  </div>
                  {/* Status */}
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Trạng thái' : 'Status'}</label>
                    <select value={editingBooking.status}
                      onChange={e => setEditingBooking({...editingBooking, status: e.target.value})}
                      className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/10">
                      <option value="PAID">{language === 'vi' ? 'Đã trả' : 'Paid'}</option>
                      <option value="BOOKED">{language === 'vi' ? 'Đã đặt' : 'Booked'}</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-4 mt-8">
                  <button onClick={() => { setEditingBooking(null); setEditShowTripSearch(false); setEditSelectedTrip(null); setEditSelectedSeats([]); }}
                    className="flex-1 py-4 bg-gray-50 text-gray-500 rounded-2xl font-bold hover:bg-gray-100 transition-all">
                    {t.cancel}
                  </button>
                  {(() => {
                    // Disable save when trip search is open AND a trip is selected but no seats chosen yet
                    const isSaveDisabled = editShowTripSearch && editSelectedTrip !== null && editSelectedSeats.length === 0;
                    return (
                      <button
                        onClick={saveEdit}
                        disabled={isSaveDisabled}
                        className="flex-1 py-4 bg-daiichi-red text-white rounded-2xl font-bold shadow-lg shadow-daiichi-red/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
                        <Check size={20} />
                        {t.save}
                      </button>
                    );
                  })()}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
