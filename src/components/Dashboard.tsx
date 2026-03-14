import React, { useState } from 'react';
import { 
  Bus, Users, ChevronRight,
  Download, Filter, Calendar as CalendarIcon, Search,
  User,
  MapPin, Clock, CreditCard, Tag, Edit3, Trash2, X, Check,
  Eye, Moon, Coffee, Hotel
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { cn } from '../lib/utils';
import { TRANSLATIONS, Language, TripStatus, UserRole, SeatStatus } from '../App';
import { transportService } from '../services/transportService';
import { ResizableTh } from './ResizableTh';

interface DashboardProps {
  language: Language;
  trips: any[];
  consignments: any[];
  bookings: any[];
  currentUser: any;
  setActiveTab?: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ language, trips, consignments, bookings, currentUser, setActiveTab }) => {
  const t = TRANSLATIONS[language];
  const [filterType, setFilterType] = useState<'ALL' | 'TRIP' | 'TOUR'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PAID' | 'BOOKED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [agentFilter, setAgentFilter] = useState('ALL');
  const [showFilters, setShowFilters] = useState(false);

  // Consignment filter state
  const [consignmentSearch, setConsignmentSearch] = useState('');
  const [consignmentStatusFilter, setConsignmentStatusFilter] = useState<'ALL' | 'PENDING' | 'PICKED_UP' | 'DELIVERED'>('ALL');

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
  // Detail View State
  const [viewingBooking, setViewingBooking] = useState<any>(null);

  const isAgent = currentUser?.role === UserRole.AGENT;
  // Effective agent identifier used in booking.agent field
  const agentIdentifier = isAgent
    ? (currentUser.name || currentUser.address || currentUser.agentCode || '')
    : '';

  const exportToExcel = () => {
    const dataToExport = isAgent ? filteredBookings : bookings;
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Bookings");
    XLSX.writeFile(workbook, `Daiichi_Bookings_${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())}.xlsx`);
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
  };

  const handleView = (booking: any) => {
    setViewingBooking(booking);
  };

  const saveEdit = async () => {
    const updated = editingBooking;
    setEditingBooking(null);
    try {
      await transportService.updateBooking(updated.id, updated);
      // Sync: update seat data in trip for TRIP bookings
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
        await Promise.all(allSeats.map(seatId => transportService.bookSeat(updated.tripId, seatId, seatUpdates)));
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

  const filteredBookings = bookings.filter(b => {
    // Agent scope: only show bookings created by this agent
    if (isAgent) {
      const matchesAgentId = currentUser.id && b.agentId === currentUser.id;
      const matchesAgentName = agentIdentifier && (b.agent || '') === agentIdentifier;
      if (!matchesAgentId && !matchesAgentName) return false;
    }

    const matchesType = filterType === 'ALL' || b.type === filterType;
    const matchesSearch = (b.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (b.agent || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (b.id || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAgent = agentFilter === 'ALL' || b.agent === agentFilter;
    const matchesStatus = filterStatus === 'ALL' || b.status === filterStatus;
    
    const rawDate = b.date ? String(b.date).split(' ')[0] : '';
    const bookingDate = rawDate ? new Date(rawDate) : new Date(0);
    const matchesStart = !startDate || bookingDate >= new Date(startDate);
    const matchesEnd = !endDate || bookingDate <= new Date(endDate);

    return matchesType && matchesSearch && matchesAgent && matchesStart && matchesEnd && matchesStatus;
  }).sort(sortByCreatedDesc);

  const uniqueAgents = Array.from(new Set(bookings.filter(b => b.agentId).map(b => b.agent).filter(Boolean)));

  const filteredConsignments = consignments.filter(c => {
    // Agent scope: only show consignments created by this agent
    if (isAgent) {
      const matchesAgentId = currentUser.id && c.agentId === currentUser.id;
      const matchesAgentName = agentIdentifier && (c.agentName || '') === agentIdentifier;
      if (!matchesAgentId && !matchesAgentName) return false;
    }

    const q = consignmentSearch.toLowerCase();
    const matchesSearch = !q ||
      (c.senderName || c.sender || '').toLowerCase().includes(q) ||
      (c.receiverName || c.receiver || '').toLowerCase().includes(q) ||
      (c.senderPhone || '').toLowerCase().includes(q) ||
      (c.receiverPhone || '').toLowerCase().includes(q) ||
      (c.id || '').toLowerCase().includes(q) ||
      (c.type || '').toLowerCase().includes(q);
    const matchesStatus = consignmentStatusFilter === 'ALL' || c.status === consignmentStatusFilter;
    return matchesSearch && matchesStatus;
  });

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

  const sortedScopedBookings = [...scopedBookings].sort(sortByCreatedDesc);

  const formatActivityTime = (createdAt: any): string => {
    if (!createdAt) return '';
    try {
      const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
      const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
      if (diffMins < 60) return language === 'vi' ? `${diffMins} phút trước` : `${diffMins} mins ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return language === 'vi' ? `${diffHours} giờ trước` : `${diffHours} hours ago`;
      return date.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    } catch {
      return '';
    }
  };

  const recentActivities = sortedScopedBookings.slice(0, 3).map(b => ({
    msg: language === 'vi'
      ? `Đặt chỗ mới: ${b.customerName || ''} - ${b.route || ''}`
      : `New booking: ${b.customerName || ''} - ${b.route || ''}`,
    time: formatActivityTime(b.createdAt),
    type: 'info' as const,
  }));

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

      {/* Stats Grid removed as per requirements */}

      <div className="space-y-8">
        {/* Main Booking List - Full Width */}
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
            <div className="flex flex-col gap-6 mb-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h3 className="text-xl font-bold text-gray-800">
                  {language === 'vi' ? 'Danh sách đặt chỗ mới nhất' : 'Latest Bookings'}
                </h3>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setShowFilters(!showFilters)}
                    className={cn(
                      "p-2 rounded-xl border transition-all",
                      showFilters ? "bg-daiichi-red text-white border-daiichi-red" : "bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100"
                    )}
                  >
                    <Filter size={20} />
                  </button>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      type="text" 
                      placeholder={t.search_customer}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10 w-64"
                    />
                  </div>
                </div>
              </div>

              {/* Advanced Filters */}
              <AnimatePresence>
                {showFilters && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 bg-gray-50 rounded-3xl border border-gray-100">
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">{t.filter_by_date}</label>
                        <div className="flex gap-2">
                          <input 
                            type="date" 
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" 
                          />
                          <input 
                            type="date" 
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" 
                          />
                        </div>
                      </div>
                      {!isAgent && (
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">{t.filter_by_agent}</label>
                          <select 
                            value={agentFilter}
                            onChange={(e) => setAgentFilter(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
                          >
                            <option value="ALL">{t.all_agents}</option>
                            {uniqueAgents.map(agent => (
                              <option key={agent} value={agent}>{agent}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">{language === 'vi' ? 'Loại dịch vụ' : 'Service Type'}</label>
                        <div className="flex bg-white p-1 rounded-xl border border-gray-200">
                          {(['ALL', 'TRIP', 'TOUR'] as const).map((type) => (
                            <button
                              key={type}
                              onClick={() => setFilterType(type)}
                              className={cn(
                                "flex-1 py-1 rounded-lg text-[10px] font-bold transition-all",
                                filterType === type ? "bg-daiichi-red text-white" : "text-gray-500"
                              )}
                            >
                              {type === 'ALL' ? (language === 'vi' ? 'Tất cả' : 'All') : type}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">{language === 'vi' ? 'Trạng thái thanh toán' : 'Payment Status'}</label>
                        <div className="flex bg-white p-1 rounded-xl border border-gray-200">
                          {(['ALL', 'PAID', 'BOOKED'] as const).map((s) => (
                            <button
                              key={s}
                              onClick={() => setFilterStatus(s)}
                              className={cn(
                                "flex-1 py-1 rounded-lg text-[10px] font-bold transition-all",
                                filterStatus === s ? "bg-daiichi-red text-white" : "text-gray-500"
                              )}
                            >
                              {s === 'ALL' ? (language === 'vi' ? 'Tất cả' : 'All') : s === 'PAID' ? (language === 'vi' ? 'Đã trả' : 'Paid') : (language === 'vi' ? 'Đã đặt' : 'Booked')}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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
                      {language === 'vi' ? 'Đại lý' : 'Agent'}
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
                  {filteredBookings.map((booking) => (
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
                        <p className="text-[10px] text-gray-400 mt-0.5">{booking.date}</p>
                      </td>
                      <td className="py-5">
                        {booking.agentId ? (
                          <div className="overflow-hidden">
                            <p className="text-sm font-bold text-gray-700 truncate">{booking.agent}</p>
                            <p className="text-[10px] text-gray-400 truncate font-mono">{String(booking.agentId).slice(-6).toUpperCase()}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">{language === 'vi' ? 'Khách lẻ' : 'Direct'}</span>
                        )}
                      </td>
                      <td className="py-5">
                        <p className="font-bold text-gray-800">{booking.amount.toLocaleString()}đ</p>
                      </td>
                      <td className="py-5">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase",
                          booking.status === 'PAID' ? "bg-green-100 text-green-600" : "bg-yellow-100 text-yellow-600"
                        )}>
                          {booking.status === 'PAID' ? (language === 'vi' ? 'Đã trả' : 'Paid') : (language === 'vi' ? 'Đã đặt' : 'Booked')}
                        </span>
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
                              <button 
                                onClick={() => handleDelete(booking.id)}
                                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Stats Section - horizontal grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Upcoming Trips */}
          <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
            <h3 className="text-xl font-bold text-gray-800 mb-6">{t.upcoming_trips}</h3>
            <div className="space-y-4">
              {trips.filter(t => t.status === TripStatus.WAITING).sort((a, b) => {
                const aKey = `${a.date || ''}T${a.time || ''}`;
                const bKey = `${b.date || ''}T${b.time || ''}`;
                return aKey.localeCompare(bKey);
              }).slice(0, 4).map((trip, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-transparent hover:border-daiichi-red/10 hover:bg-white hover:shadow-md transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white rounded-2xl flex flex-col items-center justify-center font-bold text-daiichi-red border border-gray-100 shadow-sm group-hover:bg-daiichi-red group-hover:text-white transition-colors">
                      <Clock size={16} className="mb-1" />
                      <span className="text-xs">{trip.time}</span>
                    </div>
                    <div>
                      <p className="font-bold text-gray-800">{trip.licensePlate}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                        <User size={12} />
                        <span>{trip.driverName}</span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="text-gray-300 group-hover:text-daiichi-red transition-colors" size={20} />
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
            <h3 className="text-xl font-bold text-gray-800 mb-6">{t.recent_activity}</h3>
            <div className="space-y-6">
              {recentActivities.length === 0 ? (
                <p className="text-sm text-gray-400">{language === 'vi' ? 'Chưa có hoạt động nào' : 'No recent activity'}</p>
              ) : recentActivities.map((log, i) => (
                <div key={i} className="flex gap-4 relative">
                  {i !== recentActivities.length - 1 && <div className="absolute left-[7px] top-6 w-[2px] h-10 bg-gray-100" />}
                  <div className={cn(
                    "w-4 h-4 mt-1.5 rounded-full border-4 border-white shadow-sm ring-1 ring-gray-100",
                    log.type === 'success' ? 'bg-green-500' : log.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
                  )} />
                  <div>
                    <p className="text-sm font-bold text-gray-700 leading-tight">{log.msg}</p>
                    <p className="text-xs text-gray-400 mt-1">{log.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
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
                  onClick={() => setConsignmentStatusFilter(s)}
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
                onChange={e => setConsignmentSearch(e.target.value)}
                className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10 w-56"
              />
            </div>
            {/* Export */}
            <button
              onClick={() => {
                const worksheet = XLSX.utils.json_to_sheet(filteredConsignments.map(c => ({
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
                })));
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, language === 'vi' ? 'Hàng hóa' : 'Consignments');
                XLSX.writeFile(workbook, `Daiichi_Consignments_${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())}.xlsx`);
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
              ) : filteredConsignments.map(c => (
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
      </div>

      {/* Detail View Modal */}
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
                        <span className="text-[10px] font-bold uppercase tracking-widest">{language === 'vi' ? 'Đại lý' : 'Agent'}</span>
                      </div>
                      <p className="font-bold text-gray-800">{viewingBooking.agent || '—'}</p>
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
                      <p className="font-bold text-gray-800">{viewingBooking.date}</p>
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
                    {viewingBooking.type !== 'TOUR' && viewingBooking.pickupPoint && (
                      <div className="p-4 bg-blue-50 rounded-2xl">
                        <div className="flex items-center gap-2 text-blue-400 mb-1">
                          <MapPin size={14} className="text-blue-500" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">{language === 'vi' ? 'Đón' : 'Pickup'}</span>
                        </div>
                        <p className="font-bold text-blue-800 text-xs">{viewingBooking.pickupPoint}</p>
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
                  {/* Date */}
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Ngày' : 'Date'}</label>
                    <input type="text" value={editingBooking.date || ''}
                      onChange={e => setEditingBooking({...editingBooking, date: e.target.value})}
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
                      <input type="number" min="0" value={editingBooking.children ?? 0}
                        onChange={e => setEditingBooking({...editingBooking, children: parseInt(e.target.value) || 0})}
                        className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" />
                    </div>
                  </div>
                  {/* Tour-specific fields */}
                  {editingBooking.type === 'TOUR' && (
                    <>
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
                  {/* Trip-specific fields */}
                  {editingBooking.type !== 'TOUR' && editingBooking.seatId && (
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Ghế' : 'Seat'}</label>
                      <input type="text" value={editingBooking.seatIds?.join(', ') || editingBooking.seatId || ''}
                        readOnly
                        className="w-full mt-1 px-4 py-3 bg-gray-100 border border-gray-100 rounded-2xl text-gray-500 cursor-not-allowed" />
                    </div>
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
                    <input type="number" min="0" value={editingBooking.amount || 0}
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
                  <button onClick={() => setEditingBooking(null)}
                    className="flex-1 py-4 bg-gray-50 text-gray-500 rounded-2xl font-bold hover:bg-gray-100 transition-all">
                    {t.cancel}
                  </button>
                  <button onClick={saveEdit}
                    className="flex-1 py-4 bg-daiichi-red text-white rounded-2xl font-bold shadow-lg shadow-daiichi-red/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2">
                    <Check size={20} />
                    {t.save}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
