import React, { useState, useRef, useEffect } from 'react';
import { 
  Bus, Users, Package, LayoutDashboard, ChevronRight, 
  Download, Filter, Calendar as CalendarIcon, Search,
  TrendingUp, ArrowUpRight, ArrowDownRight, User,
  MapPin, Clock, CreditCard, Tag, Edit3, Trash2, X, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { cn } from '../lib/utils';
import { TRANSLATIONS, Language, TripStatus } from '../App';
import { transportService } from '../services/transportService';

interface DashboardProps {
  language: Language;
  trips: any[];
  consignments: any[];
}

const ResizableTh = ({ children, className, onResize, width }: any) => {
  const [isResizing, setIsResizing] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    startX.current = e.clientX;
    startWidth.current = width;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    const newWidth = startWidth.current + (e.clientX - startX.current);
    onResize(Math.max(100, newWidth));
  };

  const handleMouseUp = () => {
    setIsResizing(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  return (
    <th 
      className={cn("relative group select-none", className)}
      style={{ width: `${width}px` }}
    >
      <div className="flex items-center gap-2 h-full">
        {children}
      </div>
      <div 
        onMouseDown={handleMouseDown}
        className={cn(
          "absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-daiichi-red/50 transition-colors",
          isResizing && "bg-daiichi-red w-0.5"
        )}
      />
    </th>
  );
};

export const Dashboard: React.FC<DashboardProps> = ({ language, trips, consignments }) => {
  const t = TRANSLATIONS[language];
  const [bookings, setBookings] = useState<any[]>([]);
  const [filterType, setFilterType] = useState<'ALL' | 'TRIP' | 'TOUR'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [agentFilter, setAgentFilter] = useState('ALL');
  const [showFilters, setShowFilters] = useState(false);

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

  // Edit State
  const [editingBooking, setEditingBooking] = useState<any>(null);

  // Subscribe to bookings from Firebase
  useEffect(() => {
    const unsubscribe = transportService.subscribeToBookings(setBookings);
    return () => unsubscribe();
  }, []);

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(bookings);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Bookings");
    XLSX.writeFile(workbook, `Daiichi_Bookings_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleDelete = (id: string) => {
    if (window.confirm(t.confirm_delete)) {
      setBookings(prev => prev.filter(b => b.id !== id));
    }
  };

  const handleEdit = (booking: any) => {
    setEditingBooking({ ...booking });
  };

  const saveEdit = () => {
    setBookings(prev => prev.map(b => b.id === editingBooking.id ? editingBooking : b));
    setEditingBooking(null);
  };

  const filteredBookings = bookings.filter(b => {
    const matchesType = filterType === 'ALL' || b.type === filterType;
    const matchesSearch = b.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         b.agent.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         b.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAgent = agentFilter === 'ALL' || b.agent === agentFilter;
    
    const bookingDate = new Date(b.date.split(' ')[0]);
    const matchesStart = !startDate || bookingDate >= new Date(startDate);
    const matchesEnd = !endDate || bookingDate <= new Date(endDate);

    return matchesType && matchesSearch && matchesAgent && matchesStart && matchesEnd;
  });

  const uniqueAgents = Array.from(new Set(bookings.map(b => b.agent)));

  const stats = [
    { label: t.stats_trips, value: '24', icon: Bus, color: 'text-blue-600', bg: 'bg-blue-50', trend: '+12%', isUp: true },
    { label: language === 'vi' ? 'Ghế đã đặt' : 'Seats Booked', value: '156', icon: Users, color: 'text-daiichi-red', bg: 'bg-red-50', trend: '+5%', isUp: true },
    { label: t.stats_consignments, value: '42', icon: Package, color: 'text-yellow-600', bg: 'bg-yellow-50', trend: '-2%', isUp: false },
    { label: language === 'vi' ? 'Doanh thu dự kiến' : 'Expected Revenue', value: '12.5M', icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50', trend: '+18%', isUp: true },
  ];

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
          <button className="flex items-center gap-2 px-6 py-3 bg-daiichi-red text-white rounded-2xl font-bold shadow-lg shadow-daiichi-red/20 hover:scale-[1.02] transition-all">
            <CalendarIcon size={20} />
            {language === 'vi' ? 'Lịch trình' : 'Schedule'}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={cn("p-4 rounded-2xl", stat.bg, stat.color)}>
                <stat.icon size={24} />
              </div>
              <div className={cn(
                "flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full",
                stat.isUp ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
              )}>
                {stat.isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {stat.trend}
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
              <h3 className="text-3xl font-bold mt-1 text-gray-800">{stat.value}</h3>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:scale-110 transition-transform duration-500">
              <stat.icon size={120} />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Main Booking List */}
        <div className="xl:col-span-2 space-y-6">
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
                    <tr key={booking.id} className="group hover:bg-gray-50/50 transition-colors">
                      <td className="py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-daiichi-accent rounded-full flex items-center justify-center text-daiichi-red font-bold text-sm">
                            {booking.customerName.charAt(0)}
                          </div>
                          <div className="overflow-hidden">
                            <p className="font-bold text-gray-800 truncate">{booking.customerName}</p>
                            <p className="text-xs text-gray-400 truncate">{booking.phone}</p>
                          </div>
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
                        <div className="flex items-center gap-2 overflow-hidden">
                          <Tag size={14} className="text-gray-400 shrink-0" />
                          <span className="text-sm text-gray-600 truncate">{booking.agent}</span>
                        </div>
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
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleEdit(booking)}
                            className="p-2 text-gray-400 hover:text-daiichi-red hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(booking.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar Stats */}
        <div className="space-y-8">
          {/* Upcoming Trips */}
          <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
            <h3 className="text-xl font-bold text-gray-800 mb-6">{t.upcoming_trips}</h3>
            <div className="space-y-4">
              {trips.filter(t => t.status === TripStatus.WAITING).slice(0, 4).map((trip, i) => (
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
              {[
                { msg: language === 'vi' ? 'Xe 29B-123.45 đã đến điểm trả khách' : 'Bus 29B-123.45 arrived at drop-off point', time: language === 'vi' ? '2 phút trước' : '2 mins ago', type: 'success' },
                { msg: language === 'vi' ? 'Đơn hàng DX-001 đã được giao' : 'Order DX-001 delivered', time: language === 'vi' ? '15 phút trước' : '15 mins ago', type: 'info' },
                { msg: language === 'vi' ? 'Cảnh báo: Xe 29B-678.90 dừng sai điểm' : 'Warning: Bus 29B-678.90 stopped at wrong point', time: language === 'vi' ? '30 phút trước' : '30 mins ago', type: 'error' },
              ].map((log, i) => (
                <div key={i} className="flex gap-4 relative">
                  {i !== 2 && <div className="absolute left-[7px] top-6 w-[2px] h-10 bg-gray-100" />}
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

      {/* Edit Modal */}
      <AnimatePresence>
        {editingBooking && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-800">{t.edit_booking}</h3>
                  <button onClick={() => setEditingBooking(null)} className="text-gray-400 hover:text-gray-600">
                    <X size={24} />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Tên khách hàng' : 'Customer Name'}</label>
                    <input 
                      type="text" 
                      value={editingBooking.customerName}
                      onChange={e => setEditingBooking({...editingBooking, customerName: e.target.value})}
                      className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Số điện thoại' : 'Phone'}</label>
                    <input 
                      type="text" 
                      value={editingBooking.phone}
                      onChange={e => setEditingBooking({...editingBooking, phone: e.target.value})}
                      className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Đại lý' : 'Agent'}</label>
                    <select 
                      value={editingBooking.agent}
                      onChange={e => setEditingBooking({...editingBooking, agent: e.target.value})}
                      className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
                    >
                      <option value="Trực tiếp">{language === 'vi' ? 'Trực tiếp' : 'Direct'}</option>
                      {uniqueAgents.filter(a => a !== 'Trực tiếp').map(a => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Trạng thái' : 'Status'}</label>
                    <select 
                      value={editingBooking.status}
                      onChange={e => setEditingBooking({...editingBooking, status: e.target.value})}
                      className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
                    >
                      <option value="PAID">{language === 'vi' ? 'Đã trả' : 'Paid'}</option>
                      <option value="BOOKED">{language === 'vi' ? 'Đã đặt' : 'Booked'}</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-4 mt-8">
                  <button 
                    onClick={() => setEditingBooking(null)}
                    className="flex-1 py-4 bg-gray-50 text-gray-500 rounded-2xl font-bold hover:bg-gray-100 transition-all"
                  >
                    {t.cancel}
                  </button>
                  <button 
                    onClick={saveEdit}
                    className="flex-1 py-4 bg-daiichi-red text-white rounded-2xl font-bold shadow-lg shadow-daiichi-red/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                  >
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
