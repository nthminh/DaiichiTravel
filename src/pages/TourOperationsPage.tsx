import React, { useState, useMemo } from 'react';
import {
  Calendar, Search, ChevronDown, ChevronUp, X, Eye, Check, Ban,
  Download, Users, DollarSign, Clock, Star, RefreshCw, Trash2,
  AlertCircle, CheckCircle, BarChart2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Language, TRANSLATIONS } from '../App';
import { transportService } from '../services/transportService';
import { formatBookingDate } from '../lib/vnDate';
import { exportRowsToExcel } from '../utils/exportUtils';

interface TourOperationsPageProps {
  bookings: any[];
  tours: any[];
  language: Language;
  currentUser: any | null;
}

const BOOKINGS_PER_PAGE = 50;

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  CONFIRMED: 'bg-green-100 text-green-800 border-green-200',
  CANCELLED: 'bg-red-100 text-red-800 border-red-200',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  PENDING: <Clock size={12} className="inline mr-1" />,
  CONFIRMED: <CheckCircle size={12} className="inline mr-1" />,
  CANCELLED: <Ban size={12} className="inline mr-1" />,
};

export const TourOperationsPage: React.FC<TourOperationsPageProps> = ({
  bookings,
  tours,
  language,
  currentUser,
}) => {
  const t = TRANSLATIONS[language];
  const isVi = language === 'vi';
  const isJa = language === 'ja';

  // Filter state
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterTourId, setFilterTourId] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Detail modal state
  const [detailBooking, setDetailBooking] = useState<any | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusUpdateError, setStatusUpdateError] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Export loading
  const [exporting, setExporting] = useState(false);

  // Only tour bookings
  const tourBookings = useMemo(
    () => bookings.filter((b) => b.type === 'TOUR'),
    [bookings]
  );

  // Tour name lookup
  const tourNameById = useMemo(() => {
    const map: Record<string, string> = {};
    tours.forEach((t) => { map[t.id] = t.title || t.name || t.id; });
    return map;
  }, [tours]);

  // Unique tours in bookings (for filter dropdown)
  const uniqueTourOptions = useMemo(() => {
    const seen = new Map<string, string>();
    tourBookings.forEach((b) => {
      if (b.tourId) {
        seen.set(b.tourId, tourNameById[b.tourId] || b.route || b.tourId);
      } else if (b.route) {
        seen.set(b.route, b.route);
      }
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [tourBookings, tourNameById]);

  // Filtered bookings
  const filteredBookings = useMemo(() => {
    return tourBookings.filter((b) => {
      if (filterStatus && b.status !== filterStatus) return false;
      if (filterTourId) {
        const matchId = b.tourId === filterTourId;
        const matchRoute = b.route === filterTourId;
        if (!matchId && !matchRoute) return false;
      }
      if (filterDateFrom && b.date < filterDateFrom) return false;
      if (filterDateTo && b.date > filterDateTo) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchName = (b.customerName || '').toLowerCase().includes(q);
        const matchPhone = (b.phone || '').toLowerCase().includes(q);
        const matchCode = (b.ticketCode || '').toLowerCase().includes(q);
        const matchTour = (b.route || '').toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchCode && !matchTour) return false;
      }
      return true;
    });
  }, [tourBookings, filterStatus, filterTourId, filterDateFrom, filterDateTo, search]);

  // Stats
  const stats = useMemo(() => {
    const total = filteredBookings.length;
    const confirmed = filteredBookings.filter((b) => b.status === 'CONFIRMED').length;
    const pending = filteredBookings.filter((b) => b.status === 'PENDING').length;
    const cancelled = filteredBookings.filter((b) => b.status === 'CANCELLED').length;
    const revenue = filteredBookings
      .filter((b) => b.status !== 'CANCELLED')
      .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
    return { total, confirmed, pending, cancelled, revenue };
  }, [filteredBookings]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / BOOKINGS_PER_PAGE));
  const pagedBookings = useMemo(() => {
    const start = (currentPage - 1) * BOOKINGS_PER_PAGE;
    return filteredBookings.slice(start, start + BOOKINGS_PER_PAGE);
  }, [filteredBookings, currentPage]);

  const clearFilters = () => {
    setSearch('');
    setFilterStatus('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterTourId('');
    setCurrentPage(1);
  };

  const hasFilters = search || filterStatus || filterDateFrom || filterDateTo || filterTourId;

  const handleUpdateStatus = async (bookingId: string, newStatus: string) => {
    setUpdatingStatus(true);
    setStatusUpdateError('');
    try {
      await transportService.updateBooking(bookingId, { status: newStatus });
      if (detailBooking?.id === bookingId) {
        setDetailBooking((prev: any) => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (err) {
      setStatusUpdateError(isVi ? 'Lỗi cập nhật trạng thái' : 'Status update failed');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDelete = async (bookingId: string) => {
    setDeletingId(bookingId);
    try {
      await transportService.deleteBooking(bookingId);
      setDeleteConfirmId(null);
      if (detailBooking?.id === bookingId) setDetailBooking(null);
    } catch (err) {
      console.error('Delete booking failed', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = filteredBookings.map((b) => ({
        [isVi ? 'Mã vé' : 'Ticket Code']: b.ticketCode || b.id,
        [isVi ? 'Tên khách' : 'Customer']: b.customerName || '',
        [isVi ? 'Điện thoại' : 'Phone']: b.phone || '',
        [isVi ? 'Email' : 'Email']: b.email || '',
        [isVi ? 'Tour' : 'Tour']: b.route || tourNameById[b.tourId] || '',
        [isVi ? 'Ngày khởi hành' : 'Departure Date']: b.date || '',
        [isVi ? 'Người lớn' : 'Adults']: b.adults || 0,
        [isVi ? 'Trẻ em' : 'Children']: b.children || 0,
        [isVi ? 'Đêm' : 'Nights']: b.nightsBooked || 0,
        [isVi ? 'Bữa sáng' : 'Breakfasts']: b.breakfastsBooked || 0,
        [isVi ? 'Tổng tiền' : 'Amount']: b.amount || 0,
        [isVi ? 'Trạng thái' : 'Status']: b.status || '',
        [isVi ? 'Thanh toán' : 'Payment']: b.paymentMethod || '',
        [isVi ? 'Đại lý' : 'Agent']: b.agent || '',
        [isVi ? 'Ghi chú' : 'Notes']: b.notes || '',
        [isVi ? 'Ngày đặt' : 'Booked At']: b.createdAt
          ? (typeof b.createdAt.toDate === 'function'
              ? formatBookingDate(b.createdAt.toDate().toISOString())
              : formatBookingDate(String(b.createdAt)))
          : '',
      }));
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date());
      await exportRowsToExcel(
        rows,
        `Tour_Bookings_${today}.xlsx`,
        isVi ? 'Đặt Tour' : 'Tour Bookings'
      );
    } catch (err) {
      console.error('Export failed', err);
    } finally {
      setExporting(false);
    }
  };

  const statusLabel = (status: string) => {
    if (isVi) {
      if (status === 'PENDING') return 'Chờ xử lý';
      if (status === 'CONFIRMED') return 'Đã xác nhận';
      if (status === 'CANCELLED') return 'Đã hủy';
      return status;
    }
    if (isJa) {
      if (status === 'PENDING') return '保留中';
      if (status === 'CONFIRMED') return '確認済';
      if (status === 'CANCELLED') return 'キャンセル';
      return status;
    }
    return status;
  };

  const formatAmount = (amount: number) =>
    amount.toLocaleString('vi-VN') + 'đ';

  const formatCreatedAt = (createdAt: any): string => {
    if (!createdAt) return '';
    try {
      const d = typeof createdAt.toDate === 'function' ? createdAt.toDate() : new Date(createdAt);
      return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return String(createdAt);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <Star className="text-daiichi-red" size={26} />
            {isVi ? 'Điều hành Tour' : isJa ? 'ツアー運営' : 'Tour Operations'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isVi
              ? 'Quản lý và theo dõi các đơn đặt tour du lịch'
              : isJa
              ? 'ツアー予約の管理・追跡'
              : 'Manage and track all tour bookings'}
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || filteredBookings.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {exporting ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} />}
          {isVi ? 'Xuất Excel' : isJa ? 'エクスポート' : 'Export Excel'}
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          {
            label: isVi ? 'Tổng đặt tour' : isJa ? '総予約' : 'Total',
            value: stats.total,
            icon: <BarChart2 size={18} />,
            color: 'bg-blue-50 text-blue-700 border-blue-100',
          },
          {
            label: isVi ? 'Đã xác nhận' : isJa ? '確認済' : 'Confirmed',
            value: stats.confirmed,
            icon: <CheckCircle size={18} />,
            color: 'bg-green-50 text-green-700 border-green-100',
          },
          {
            label: isVi ? 'Chờ xử lý' : isJa ? '保留中' : 'Pending',
            value: stats.pending,
            icon: <Clock size={18} />,
            color: 'bg-yellow-50 text-yellow-700 border-yellow-100',
          },
          {
            label: isVi ? 'Đã hủy' : isJa ? 'キャンセル' : 'Cancelled',
            value: stats.cancelled,
            icon: <Ban size={18} />,
            color: 'bg-red-50 text-red-700 border-red-100',
          },
          {
            label: isVi ? 'Doanh thu' : isJa ? '収益' : 'Revenue',
            value: formatAmount(stats.revenue),
            icon: <DollarSign size={18} />,
            color: 'bg-purple-50 text-purple-700 border-purple-100',
            wide: true,
          },
        ].map((card, i) => (
          <div
            key={i}
            className={cn(
              'rounded-xl border p-4 flex items-center gap-3',
              card.color,
              card.wide ? 'col-span-2 md:col-span-1' : ''
            )}
          >
            <span className="opacity-70">{card.icon}</span>
            <div>
              <p className="text-xs font-semibold opacity-70">{card.label}</p>
              <p className="text-lg font-extrabold">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              placeholder={isVi ? 'Tìm tên, SĐT, mã vé, tên tour...' : 'Search name, phone, code, tour...'}
              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/30"
            />
          </div>

          {/* Toggle filters */}
          <button
            onClick={() => setShowFilters((p) => !p)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold border transition-colors',
              showFilters
                ? 'bg-daiichi-red text-white border-daiichi-red'
                : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-daiichi-red hover:text-daiichi-red'
            )}
          >
            {showFilters ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            {isVi ? 'Bộ lọc' : 'Filters'}
            {hasFilters && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />}
          </button>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-sm text-daiichi-red font-bold hover:underline"
            >
              <X size={14} />
              {isVi ? 'Xóa bộ lọc' : 'Clear'}
            </button>
          )}
        </div>

        {/* Expanded filter row */}
        <AnimatePresence initial={false}>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap gap-3 pt-1">
                {/* Status filter */}
                <select
                  value={filterStatus}
                  onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/30"
                >
                  <option value="">{isVi ? 'Tất cả trạng thái' : 'All statuses'}</option>
                  <option value="PENDING">{isVi ? 'Chờ xử lý' : 'Pending'}</option>
                  <option value="CONFIRMED">{isVi ? 'Đã xác nhận' : 'Confirmed'}</option>
                  <option value="CANCELLED">{isVi ? 'Đã hủy' : 'Cancelled'}</option>
                </select>

                {/* Tour filter */}
                <select
                  value={filterTourId}
                  onChange={(e) => { setFilterTourId(e.target.value); setCurrentPage(1); }}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/30 max-w-xs"
                >
                  <option value="">{isVi ? 'Tất cả tour' : 'All tours'}</option>
                  {uniqueTourOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.name}</option>
                  ))}
                </select>

                {/* Date from */}
                <div className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-gray-400" />
                  <input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => { setFilterDateFrom(e.target.value); setCurrentPage(1); }}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/30"
                  />
                  <span className="text-gray-400 text-sm">–</span>
                  <input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => { setFilterDateTo(e.target.value); setCurrentPage(1); }}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/30"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bookings table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-bold text-gray-700">
            {filteredBookings.length} {isVi ? 'đơn đặt tour' : isJa ? '件のツアー予約' : 'tour bookings'}
          </span>
          {totalPages > 1 && (
            <span className="text-xs text-gray-400">
              {isVi ? `Trang ${currentPage}/${totalPages}` : `Page ${currentPage}/${totalPages}`}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3">{isVi ? 'Mã vé' : 'Code'}</th>
                <th className="text-left px-4 py-3">{isVi ? 'Khách hàng' : 'Customer'}</th>
                <th className="text-left px-4 py-3">{isVi ? 'Tour' : 'Tour'}</th>
                <th className="text-left px-4 py-3">{isVi ? 'Ngày đi' : 'Dep. Date'}</th>
                <th className="text-center px-4 py-3">
                  <Users size={14} className="inline" />
                </th>
                <th className="text-right px-4 py-3">{isVi ? 'Tổng tiền' : 'Amount'}</th>
                <th className="text-center px-4 py-3">{isVi ? 'Trạng thái' : 'Status'}</th>
                <th className="text-left px-4 py-3">{isVi ? 'Ngày đặt' : 'Booked'}</th>
                <th className="text-center px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pagedBookings.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-gray-400">
                    <Star size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="font-medium">
                      {isVi ? 'Chưa có đơn đặt tour nào' : 'No tour bookings found'}
                    </p>
                  </td>
                </tr>
              ) : (
                pagedBookings.map((b) => (
                  <motion.tr
                    key={b.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-gray-50/60 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{b.ticketCode || b.id?.slice(0, 8)}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-800">{b.customerName}</p>
                      <p className="text-xs text-gray-400">{b.phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-700 max-w-[180px] truncate">
                        {b.route || tourNameById[b.tourId] || b.tourId}
                      </p>
                      <p className="text-xs text-gray-400">{b.duration}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{b.date}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-gray-700 font-medium">{(b.adults || 0) + (b.children || 0)}</span>
                      <span className="text-xs text-gray-400 ml-1">({b.adults || 0}+{b.children || 0})</span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-800">
                      {formatAmount(Number(b.amount) || 0)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        'inline-flex items-center px-2 py-1 rounded-full text-xs font-bold border',
                        STATUS_COLORS[b.status] || 'bg-gray-100 text-gray-600 border-gray-200'
                      )}>
                        {STATUS_ICONS[b.status]}
                        {statusLabel(b.status || 'PENDING')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{formatCreatedAt(b.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setDetailBooking(b)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-blue-500 hover:bg-blue-50 transition-colors"
                          title={isVi ? 'Xem chi tiết' : 'View details'}
                        >
                          <Eye size={14} />
                        </button>
                        {b.status === 'PENDING' && (
                          <button
                            onClick={() => handleUpdateStatus(b.id, 'CONFIRMED')}
                            disabled={updatingStatus}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
                            title={isVi ? 'Xác nhận' : 'Confirm'}
                          >
                            <Check size={14} />
                          </button>
                        )}
                        {b.status !== 'CANCELLED' && (
                          <button
                            onClick={() => handleUpdateStatus(b.id, 'CANCELLED')}
                            disabled={updatingStatus}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                            title={isVi ? 'Hủy đặt' : 'Cancel'}
                          >
                            <Ban size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteConfirmId(b.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                          title={isVi ? 'Xóa' : 'Delete'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg text-sm font-bold border border-gray-200 disabled:opacity-40 hover:border-daiichi-red hover:text-daiichi-red transition-colors"
            >
              ‹ {isVi ? 'Trước' : 'Prev'}
            </button>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const page = totalPages <= 7 ? i + 1 : (
                  currentPage <= 4 ? i + 1 :
                  currentPage >= totalPages - 3 ? totalPages - 6 + i :
                  currentPage - 3 + i
                );
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={cn(
                      'w-8 h-8 rounded-lg text-sm font-bold transition-colors',
                      currentPage === page
                        ? 'bg-daiichi-red text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    {page}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg text-sm font-bold border border-gray-200 disabled:opacity-40 hover:border-daiichi-red hover:text-daiichi-red transition-colors"
            >
              {isVi ? 'Sau' : 'Next'} ›
            </button>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {detailBooking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setDetailBooking(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-extrabold text-gray-900">
                  {isVi ? 'Chi tiết đơn đặt tour' : 'Tour Booking Detail'}
                </h2>
                <button
                  onClick={() => setDetailBooking(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-daiichi-red hover:bg-red-50 transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="px-6 py-5 space-y-5">
                {/* Status badge + update */}
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={cn(
                    'inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold border',
                    STATUS_COLORS[detailBooking.status] || 'bg-gray-100 text-gray-600 border-gray-200'
                  )}>
                    {STATUS_ICONS[detailBooking.status]}
                    {statusLabel(detailBooking.status || 'PENDING')}
                  </span>

                  {detailBooking.status === 'PENDING' && (
                    <button
                      onClick={() => handleUpdateStatus(detailBooking.id, 'CONFIRMED')}
                      disabled={updatingStatus}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      <Check size={14} />
                      {isVi ? 'Xác nhận' : 'Confirm'}
                    </button>
                  )}
                  {detailBooking.status !== 'CANCELLED' && (
                    <button
                      onClick={() => handleUpdateStatus(detailBooking.id, 'CANCELLED')}
                      disabled={updatingStatus}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      <Ban size={14} />
                      {isVi ? 'Hủy' : 'Cancel'}
                    </button>
                  )}
                  {detailBooking.status === 'CANCELLED' && (
                    <button
                      onClick={() => handleUpdateStatus(detailBooking.id, 'PENDING')}
                      disabled={updatingStatus}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500 text-white rounded-lg text-sm font-bold hover:bg-yellow-600 disabled:opacity-50 transition-colors"
                    >
                      <RefreshCw size={14} />
                      {isVi ? 'Khôi phục' : 'Restore'}
                    </button>
                  )}
                  {statusUpdateError && (
                    <span className="text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle size={12} />{statusUpdateError}
                    </span>
                  )}
                </div>

                {/* Fields */}
                {[
                  [isVi ? 'Mã vé' : 'Ticket Code', detailBooking.ticketCode || detailBooking.id],
                  [isVi ? 'Tên khách' : 'Customer', detailBooking.customerName],
                  [isVi ? 'Điện thoại' : 'Phone', detailBooking.phone],
                  [isVi ? 'Email' : 'Email', detailBooking.email],
                  [isVi ? 'Tour' : 'Tour', detailBooking.route || tourNameById[detailBooking.tourId] || detailBooking.tourId],
                  [isVi ? 'Thời lượng' : 'Duration', detailBooking.duration],
                  [isVi ? 'Ngày khởi hành' : 'Departure Date', detailBooking.date],
                  [isVi ? 'Người lớn' : 'Adults', detailBooking.adults],
                  [isVi ? 'Trẻ em' : 'Children', detailBooking.children],
                  [isVi ? 'Số đêm' : 'Nights', detailBooking.nightsBooked],
                  [isVi ? 'Số bữa sáng' : 'Breakfasts', detailBooking.breakfastsBooked],
                  [isVi ? 'Tổng tiền' : 'Total Amount', formatAmount(Number(detailBooking.amount) || 0)],
                  [isVi ? 'Thanh toán' : 'Payment Method', detailBooking.paymentMethod],
                  [isVi ? 'Đại lý' : 'Agent', detailBooking.agent || (isVi ? 'Trực tiếp' : 'Direct')],
                  [isVi ? 'Hoa hồng' : 'Commission', detailBooking.agentCommissionAmount
                    ? formatAmount(Number(detailBooking.agentCommissionAmount))
                    : undefined],
                  [isVi ? 'Phụ thu' : 'Surcharge', detailBooking.surcharge
                    ? `${formatAmount(Number(detailBooking.surcharge))}${detailBooking.surchargeNote ? ` (${detailBooking.surchargeNote})` : ''}`
                    : undefined],
                  [isVi ? 'Ghi chú' : 'Notes', detailBooking.notes],
                  [isVi ? 'Ngày đặt' : 'Booked At', formatCreatedAt(detailBooking.createdAt)],
                ].filter(([, v]) => v !== undefined && v !== null && v !== '').map(([label, val]) => (
                  <div key={String(label)} className="flex items-start gap-2">
                    <span className="text-xs text-gray-400 font-semibold w-32 shrink-0 pt-0.5">{label}</span>
                    <span className="text-sm text-gray-800 font-medium">{String(val)}</span>
                  </div>
                ))}

                {/* Addons */}
                {detailBooking.selectedAddons && detailBooking.selectedAddons.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-gray-400 font-semibold w-32 shrink-0 pt-0.5">
                      {isVi ? 'Dịch vụ thêm' : 'Add-ons'}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {detailBooking.selectedAddons.map((addonId: string) => (
                        <span key={addonId} className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold">
                          {addonId}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Delete */}
              <div className="px-6 pb-5 flex justify-end">
                <button
                  onClick={() => setDeleteConfirmId(detailBooking.id)}
                  className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 font-bold"
                >
                  <Trash2 size={14} />
                  {isVi ? 'Xóa đơn đặt' : 'Delete Booking'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirm dialog */}
      <AnimatePresence>
        {deleteConfirmId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600">
                  <AlertCircle size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-gray-900">
                    {isVi ? 'Xác nhận xóa' : 'Confirm Delete'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {isVi ? 'Hành động này không thể hoàn tác.' : 'This action cannot be undone.'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-4 py-2 rounded-xl text-sm font-bold border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  {isVi ? 'Hủy' : 'Cancel'}
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirmId)}
                  disabled={!!deletingId}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deletingId ? (
                    <RefreshCw size={14} className="animate-spin inline mr-1" />
                  ) : (
                    <Trash2 size={14} className="inline mr-1" />
                  )}
                  {isVi ? 'Xóa' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
