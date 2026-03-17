import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  CreditCard, Search, Filter, Download, CheckCircle,
  Clock, XCircle, Users, TrendingUp, Wallet, QrCode,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Language, TRANSLATIONS, User, UserRole } from '../App';
import { Agent } from '../types';
import { AgentTopUpQRModal } from './PaymentQRModal';
import { transportService } from '../services/transportService';

interface PaymentManagementProps {
  language: Language;
  bookings: any[];
  agents: Agent[];
  currentUser: User | null;
}

type PaymentFilter = 'all' | 'retail' | 'agent';
type StatusFilter = 'all' | 'BOOKED' | 'PAID' | 'CANCELLED';

export const PaymentManagement: React.FC<PaymentManagementProps> = ({
  language,
  bookings,
  agents,
  currentUser,
}) => {
  const t = TRANSLATIONS[language];
  const isAdmin = currentUser?.role === UserRole.MANAGER;

  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [topUpAgent, setTopUpAgent] = useState<Agent | null>(null);
  const [expandedBooking, setExpandedBooking] = useState<string | null>(null);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);

  // ── Filtered bookings ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return bookings.filter(b => {
      // Type filter
      if (paymentFilter === 'agent' && !b.agentId) return false;
      if (paymentFilter === 'retail' && b.agentId) return false;

      // Status filter
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;

      // Date filter
      const createdAt = b.createdAt?.toDate ? b.createdAt.toDate() : b.createdAt ? new Date(b.createdAt) : null;
      if (dateFrom && createdAt && createdAt < new Date(dateFrom)) return false;
      if (dateTo && createdAt) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (createdAt > to) return false;
      }

      // Search
      if (search) {
        const q = search.toLowerCase();
        if (
          !(b.customerName || '').toLowerCase().includes(q) &&
          !(b.phone || '').toLowerCase().includes(q) &&
          !(b.ticketCode || '').toLowerCase().includes(q) &&
          !(b.agent || '').toLowerCase().includes(q)
        ) return false;
      }

      return true;
    });
  }, [bookings, paymentFilter, statusFilter, dateFrom, dateTo, search]);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const paid = bookings.filter(b => b.status === 'PAID').reduce((s, b) => s + (b.amount || 0), 0);
    const pending = bookings.filter(b => b.status === 'BOOKED').reduce((s, b) => s + (b.amount || 0), 0);
    const agentBookings = bookings.filter(b => b.agentId);
    const retailBookings = bookings.filter(b => !b.agentId);
    return { paid, pending, agentCount: agentBookings.length, retailCount: retailBookings.length };
  }, [bookings]);

  // ── Mark a booking as PAID ─────────────────────────────────────────────────
  const handleMarkPaid = async (bookingId: string) => {
    if (!isAdmin) return;
    setMarkingPaid(bookingId);
    try {
      await transportService.updateBooking(bookingId, { status: 'PAID', paidAt: new Date().toISOString() });
    } catch (err) {
      console.error('Failed to update booking status:', err);
    } finally {
      setMarkingPaid(null);
    }
  };

  // ── Export to CSV ─────────────────────────────────────────────────────────
  const handleExport = () => {
    const rows = [
      ['Mã vé', 'Khách hàng', 'Số điện thoại', 'Tuyến', 'Ngày', 'Số tiền', 'Hình thức', 'Trạng thái', 'Đại lý'],
      ...filtered.map(b => [
        b.ticketCode || b.id,
        b.customerName || '',
        b.phone || '',
        b.route || '',
        b.createdAt?.toDate
          ? b.createdAt.toDate().toLocaleDateString('vi-VN')
          : b.createdAt ? new Date(b.createdAt).toLocaleDateString('vi-VN') : '',
        b.amount || 0,
        b.paymentMethod || '',
        b.status || '',
        b.agent || '',
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Status helpers ─────────────────────────────────────────────────────────
  const statusBadge = (status: string) => {
    if (status === 'PAID') return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
        <CheckCircle size={11} /> {t.payment_status_paid || 'Đã TT'}
      </span>
    );
    if (status === 'CANCELLED') return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
        <XCircle size={11} /> {t.payment_status_cancelled || 'Đã huỷ'}
      </span>
    );
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
        <Clock size={11} /> {t.payment_status_pending || 'Chờ TT'}
      </span>
    );
  };

  const paymentMethodBadge = (method: string) => {
    const isQr = method === 'Chuyển khoản QR';
    return (
      <span className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
        isQr ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
      )}>
        {isQr && <QrCode size={11} />}
        {method || '—'}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">{t.payment_management || 'Quản lý Thanh toán'}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{t.payment_management_desc || 'Theo dõi tất cả giao dịch khách lẻ và đại lý'}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
          className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center">
              <TrendingUp size={18} className="text-green-600" />
            </div>
            <span className="text-xs font-bold text-gray-400 uppercase">{t.payment_total_collected || 'Đã thu'}</span>
          </div>
          <p className="text-2xl font-extrabold text-green-600">{stats.paid.toLocaleString('vi-VN')}đ</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
              <Clock size={18} className="text-amber-600" />
            </div>
            <span className="text-xs font-bold text-gray-400 uppercase">{t.payment_total_pending || 'Chờ thu'}</span>
          </div>
          <p className="text-2xl font-extrabold text-amber-600">{stats.pending.toLocaleString('vi-VN')}đ</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
              <Users size={18} className="text-blue-600" />
            </div>
            <span className="text-xs font-bold text-gray-400 uppercase">{t.payment_retail || 'Khách lẻ'}</span>
          </div>
          <p className="text-2xl font-extrabold text-blue-600">{stats.retailCount}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center">
              <CreditCard size={18} className="text-purple-600" />
            </div>
            <span className="text-xs font-bold text-gray-400 uppercase">{t.payment_agent || 'Đại lý'}</span>
          </div>
          <p className="text-2xl font-extrabold text-purple-600">{stats.agentCount}</p>
        </motion.div>
      </div>

      {/* Agent balance section (admin only) */}
      {isAdmin && agents.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Wallet size={16} className="text-purple-500" />
              {t.payment_agent_balance || 'Số dư đại lý'}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase">{t.agents || 'Đại lý'}</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase">{t.payment_method || 'Hình thức'}</th>
                  <th className="text-right px-5 py-3 text-xs font-bold text-gray-400 uppercase">{t.payment_agent_balance || 'Số dư'}</th>
                  <th className="text-right px-5 py-3 text-xs font-bold text-gray-400 uppercase"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {agents.filter(a => a.status === 'ACTIVE').map(agent => (
                  <tr key={agent.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-bold text-gray-800">{agent.name}</p>
                      <p className="text-xs text-gray-400">{agent.code} · {agent.phone}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-bold',
                        agent.paymentType === 'PREPAID' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                      )}>
                        {agent.paymentType === 'PREPAID'
                          ? (language === 'vi' ? 'Trả trước' : 'Prepaid')
                          : (language === 'vi' ? 'Công nợ' : 'Postpaid')}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className={cn(
                        'font-bold',
                        (agent.balance || 0) < 0 ? 'text-red-600' : 'text-gray-800'
                      )}>
                        {(agent.balance || 0).toLocaleString('vi-VN')}đ
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setTopUpAgent(agent)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-xl text-xs font-bold hover:bg-orange-100 transition-colors ml-auto"
                      >
                        <QrCode size={13} />
                        {t.payment_agent_topup || 'Nạp tiền'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filters & Search */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={language === 'vi' ? 'Tìm mã vé, khách hàng, điện thoại...' : 'Search ticket code, customer, phone...'}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/20"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          {/* Type filter */}
          <div className="flex items-center gap-1.5">
            <Filter size={14} className="text-gray-400" />
            {(['all', 'retail', 'agent'] as PaymentFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setPaymentFilter(f)}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                  paymentFilter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                )}
              >
                {f === 'all' ? (t.payment_all || 'Tất cả') : f === 'retail' ? (t.payment_retail || 'Khách lẻ') : (t.payment_agent || 'Đại lý')}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1.5">
            {(['all', 'BOOKED', 'PAID', 'CANCELLED'] as StatusFilter[]).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                  statusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                )}
              >
                {s === 'all'
                  ? (t.payment_all || 'Tất cả')
                  : s === 'PAID' ? (t.payment_status_paid || 'Đã TT')
                  : s === 'CANCELLED' ? (t.payment_status_cancelled || 'Đã huỷ')
                  : (t.payment_status_pending || 'Chờ TT')}
              </button>
            ))}
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-400/20"
            />
            <span className="text-gray-400 text-xs">—</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-400/20"
            />
          </div>

          {/* Export */}
          {isAdmin && (
            <button
              onClick={handleExport}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-xl text-xs font-bold hover:bg-green-100 transition-colors"
            >
              <Download size={13} />
              {t.payment_export || 'Xuất CSV'}
            </button>
          )}
        </div>
      </div>

      {/* Payments table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">
            {language === 'vi' ? `${filtered.length} giao dịch` : `${filtered.length} transactions`}
          </h3>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <CreditCard size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-bold">{language === 'vi' ? 'Không có giao dịch nào' : 'No transactions'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-5 py-3 text-xs font-bold text-gray-400 uppercase">{t.payment_ticket_code || 'Mã vé'}</th>
                  <th className="px-5 py-3 text-xs font-bold text-gray-400 uppercase">{t.payment_customer || 'Khách hàng'}</th>
                  <th className="px-5 py-3 text-xs font-bold text-gray-400 uppercase hidden md:table-cell">{t.payment_date || 'Ngày'}</th>
                  <th className="px-5 py-3 text-xs font-bold text-gray-400 uppercase">{t.payment_amount_col || 'Số tiền'}</th>
                  <th className="px-5 py-3 text-xs font-bold text-gray-400 uppercase hidden lg:table-cell">{t.payment_method_col || 'Hình thức'}</th>
                  <th className="px-5 py-3 text-xs font-bold text-gray-400 uppercase">{t.status || 'T.Trạng'}</th>
                  {isAdmin && <th className="px-5 py-3 text-xs font-bold text-gray-400 uppercase">{t.payment_actions || 'Thao tác'}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(b => {
                  const createdAt = b.createdAt?.toDate
                    ? b.createdAt.toDate()
                    : b.createdAt ? new Date(b.createdAt) : null;
                  const isExpanded = expandedBooking === b.id;

                  return (
                    <React.Fragment key={b.id}>
                      <tr
                        className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                        onClick={() => setExpandedBooking(isExpanded ? null : b.id)}
                      >
                        <td className="px-5 py-3">
                          <p className="font-mono font-bold text-xs text-blue-700">{b.ticketCode || b.id?.slice(0, 8)}</p>
                          {b.agentId && (
                            <p className="text-[10px] text-purple-600 font-semibold mt-0.5">ĐL: {b.agent || '—'}</p>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <p className="font-semibold text-gray-800">{b.customerName || '—'}</p>
                          <p className="text-xs text-gray-400">{b.phone || ''}</p>
                        </td>
                        <td className="px-5 py-3 hidden md:table-cell text-xs text-gray-500">
                          {createdAt ? createdAt.toLocaleDateString('vi-VN') : '—'}
                        </td>
                        <td className="px-5 py-3 font-bold text-daiichi-red">
                          {(b.amount || 0).toLocaleString('vi-VN')}đ
                        </td>
                        <td className="px-5 py-3 hidden lg:table-cell">
                          {paymentMethodBadge(b.paymentMethod)}
                        </td>
                        <td className="px-5 py-3">
                          {statusBadge(b.status)}
                        </td>
                        {isAdmin && (
                          <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                            {b.status === 'BOOKED' && (
                              <button
                                onClick={() => handleMarkPaid(b.id)}
                                disabled={markingPaid === b.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-xl text-xs font-bold hover:bg-green-100 transition-colors disabled:opacity-50"
                              >
                                <CheckCircle size={12} />
                                {markingPaid === b.id
                                  ? (language === 'vi' ? 'Đang lưu...' : 'Saving...')
                                  : (t.payment_mark_paid || 'Đánh dấu ĐT')}
                              </button>
                            )}
                          </td>
                        )}
                        {/* Expand indicator */}
                        <td className="pr-3">
                          {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                        </td>
                      </tr>

                      {/* Expanded row */}
                      {isExpanded && (
                        <tr className="bg-blue-50/30">
                          <td colSpan={isAdmin ? 8 : 7} className="px-5 py-4">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                              <div>
                                <p className="text-gray-400 font-bold uppercase">Route</p>
                                <p className="font-semibold text-gray-700">{b.route || '—'}</p>
                              </div>
                              <div>
                                <p className="text-gray-400 font-bold uppercase">{language === 'vi' ? 'Chuyến' : 'Trip'}</p>
                                <p className="font-semibold text-gray-700">{b.tripId || '—'}</p>
                              </div>
                              <div>
                                <p className="text-gray-400 font-bold uppercase">{language === 'vi' ? 'Ghế' : 'Seats'}</p>
                                <p className="font-semibold text-gray-700">{Array.isArray(b.seats) ? b.seats.join(', ') : '—'}</p>
                              </div>
                              {b.paymentMethod === 'Chuyển khoản QR' && (
                                <div className="col-span-2 sm:col-span-3">
                                  <p className="text-gray-400 font-bold uppercase">QR Ref</p>
                                  <p className="font-mono font-bold text-blue-700">{b.paymentRef || b.ticketCode || '—'}</p>
                                </div>
                              )}
                              {b.bookingNote && (
                                <div className="col-span-2 sm:col-span-3">
                                  <p className="text-gray-400 font-bold uppercase">{language === 'vi' ? 'Ghi chú' : 'Note'}</p>
                                  <p className="text-gray-700">{b.bookingNote}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Agent top-up QR modal */}
      {topUpAgent && (
        <AgentTopUpQRModal
          agentName={topUpAgent.name}
          agentCode={topUpAgent.code}
          language={language}
          onClose={() => setTopUpAgent(null)}
        />
      )}
    </div>
  );
};
