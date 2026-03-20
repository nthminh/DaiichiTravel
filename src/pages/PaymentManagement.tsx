import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  CreditCard, Search, Filter, Download, CheckCircle,
  Clock, XCircle, Users, TrendingUp, Wallet, QrCode,
  ChevronDown, ChevronUp, Pencil, X, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Language, TRANSLATIONS, User, UserRole } from '../App';
import { Agent } from '../types';
import { AgentTopUpQRModal } from '../components/PaymentQRModal';
import { transportService } from '../services/transportService';
import { NotePopover } from '../components/NotePopover';

interface PaymentManagementProps {
  language: Language;
  bookings: any[];
  agents: Agent[];
  currentUser: User | null;
  onUpdateAgent?: (agentId: string, updates: any) => void;
}

type PaymentFilter = 'all' | 'retail' | 'agent';
type StatusFilter = 'all' | 'BOOKED' | 'PENDING' | 'CONFIRMED' | 'PAID' | 'CANCELLED';

const PAGE_SIZE = 50;
const PAYABLE_STATUSES = ['BOOKED', 'PENDING'] as const;

// ── Pagination bar – defined outside component to avoid remount on every render ──
const PaginationBar = ({
  page,
  totalPages,
  total,
  language,
  onPage,
}: { page: number; totalPages: number; total: number; language: Language; onPage: (p: number) => void }) => (
  <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 text-xs text-gray-500">
    <span>
      {language === 'vi'
        ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} / ${total}`
        : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`}
    </span>
    <div className="flex items-center gap-1">
      <button
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft size={14} />
      </button>
      <span className="px-2 font-bold">{page} / {totalPages}</span>
      <button
        onClick={() => onPage(page + 1)}
        disabled={page >= totalPages}
        className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  </div>
);

export const PaymentManagement: React.FC<PaymentManagementProps> = ({
  language,
  bookings,
  agents,
  currentUser,
  onUpdateAgent,
}) => {
  const t = TRANSLATIONS[language];
  const isAdmin = currentUser?.role === UserRole.MANAGER;

  // ── Transaction filters ────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // ── Transaction table state ────────────────────────────────────────────────
  const [topUpAgent, setTopUpAgent] = useState<Agent | null>(null);
  const [expandedBooking, setExpandedBooking] = useState<string | null>(null);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [txPage, setTxPage] = useState(1);

  // ── Agent balance section state ────────────────────────────────────────────
  const [agentSectionOpen, setAgentSectionOpen] = useState(true);
  const [agentSearch, setAgentSearch] = useState('');
  const [agentPage, setAgentPage] = useState(1);

  // ── Edit balance modal ─────────────────────────────────────────────────────
  const [editBalanceAgent, setEditBalanceAgent] = useState<Agent | null>(null);
  const [editBalanceValue, setEditBalanceValue] = useState('');

  // ── Quick date preset helper ───────────────────────────────────────────────
  const applyDatePreset = (preset: 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisYear' | 'all') => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth(); // 0-based
    const pad = (n: number) => String(n).padStart(2, '0');

    if (preset === 'all') {
      setDateFrom('');
      setDateTo('');
    } else if (preset === 'thisMonth') {
      setDateFrom(`${y}-${pad(m + 1)}-01`);
      setDateTo(`${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}`);
    } else if (preset === 'lastMonth') {
      const lm = m === 0 ? 11 : m - 1;
      const ly = m === 0 ? y - 1 : y;
      setDateFrom(`${ly}-${pad(lm + 1)}-01`);
      setDateTo(`${ly}-${pad(lm + 1)}-${pad(new Date(ly, lm + 1, 0).getDate())}`);
    } else if (preset === 'thisQuarter') {
      const q = Math.floor(m / 3);
      const qStart = q * 3;
      const qEnd = qStart + 2;
      setDateFrom(`${y}-${pad(qStart + 1)}-01`);
      setDateTo(`${y}-${pad(qEnd + 1)}-${pad(new Date(y, qEnd + 1, 0).getDate())}`);
    } else if (preset === 'thisYear') {
      setDateFrom(`${y}-01-01`);
      setDateTo(`${y}-12-31`);
    }
    setTxPage(1);
  };

  // ── Filtered bookings ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return bookings.filter(b => {
      if (paymentFilter === 'agent' && !b.agentId) return false;
      if (paymentFilter === 'retail' && b.agentId) return false;
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;

      const createdAt = b.createdAt?.toDate ? b.createdAt.toDate() : b.createdAt ? new Date(b.createdAt) : null;
      if (dateFrom && createdAt && createdAt < new Date(dateFrom)) return false;
      if (dateTo && createdAt) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (createdAt > to) return false;
      }

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

  // Reset page when filters change
  useEffect(() => { setTxPage(1); }, [paymentFilter, statusFilter, dateFrom, dateTo, search]);

  const txTotalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedTx = filtered.slice((txPage - 1) * PAGE_SIZE, txPage * PAGE_SIZE);

  // ── Filtered agents ────────────────────────────────────────────────────────
  const activeAgents = useMemo(() => agents.filter(a => a.status === 'ACTIVE'), [agents]);

  const filteredAgents = useMemo(() => {
    if (!agentSearch.trim()) return activeAgents;
    const q = agentSearch.toLowerCase();
    return activeAgents.filter(a =>
      String(a.name ?? '').toLowerCase().includes(q) ||
      String(a.code ?? '').toLowerCase().includes(q) ||
      String(a.phone ?? '').toLowerCase().includes(q)
    );
  }, [activeAgents, agentSearch]);

  const agentTotalPages = Math.max(1, Math.ceil(filteredAgents.length / PAGE_SIZE));
  const pagedAgents = filteredAgents.slice((agentPage - 1) * PAGE_SIZE, agentPage * PAGE_SIZE);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const paid = bookings.filter(b => b.status === 'PAID').reduce((s, b) => s + (b.amount || 0), 0);
    const pending = bookings.filter(b => (PAYABLE_STATUSES as readonly string[]).includes(b.status)).reduce((s, b) => s + (b.amount || 0), 0);
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

  // ── Edit balance save ──────────────────────────────────────────────────────
  const handleSaveBalance = () => {
    if (!editBalanceAgent || !onUpdateAgent) return;
    const val = parseFloat(editBalanceValue);
    if (isNaN(val)) return;
    onUpdateAgent(editBalanceAgent.id, { balance: val });
    setEditBalanceAgent(null);
  };

  // ── Export to CSV ─────────────────────────────────────────────────────────
  const handleExport = () => {
    const rows = [
      [
        t.payment_ticket_code || 'Mã vé',
        t.payment_customer || 'Khách hàng',
        language === 'vi' ? 'Số điện thoại' : language === 'ja' ? '電話番号' : 'Phone',
        language === 'vi' ? 'Tuyến' : language === 'ja' ? 'ルート' : 'Route',
        t.payment_date || 'Ngày',
        t.payment_amount_col || 'Số tiền',
        t.payment_method_col || 'Hình thức',
        t.status || 'Trạng thái',
        language === 'vi' ? 'Đại lý' : language === 'ja' ? '代理店' : 'Agent',
      ],
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
    if (status === 'CONFIRMED') return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
        <CheckCircle size={11} /> {language === 'vi' ? 'Đã xác nhận' : 'Confirmed'}
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
          {/* Header with collapse toggle */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Wallet size={16} className="text-purple-500" />
              {t.payment_agent_balance || 'Số dư đại lý'}
            </h3>
            <button
              type="button"
              onClick={() => setAgentSectionOpen(o => !o)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400"
            >
              {agentSectionOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          {agentSectionOpen && (
            <>
              {/* Agent search */}
              <div className="px-5 pt-3 pb-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
                  <input
                    type="text"
                    value={agentSearch}
                    onChange={e => { setAgentSearch(e.target.value); setAgentPage(1); }}
                    placeholder={language === 'vi' ? 'Tìm tên, mã, số điện thoại đại lý...' : 'Search agent name, code, phone...'}
                    className="w-full pl-8 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400/20"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase">{t.agents || 'Đại lý'}</th>
                      <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase">{t.payment_method || 'Hình thức'}</th>
                      <th className="text-right px-5 py-3 text-xs font-bold text-gray-400 uppercase">{t.payment_agent_balance || 'Số dư'}</th>
                      <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase">
                        {language === 'vi' ? 'Ghi chú' : language === 'ja' ? 'メモ' : 'Note'}
                      </th>
                      <th className="text-right px-5 py-3 text-xs font-bold text-gray-400 uppercase"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pagedAgents.map(agent => (
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
                        <td className="px-5 py-3">
                          <NotePopover
                            note={agent.note}
                            language={language}
                            onSave={note => onUpdateAgent?.(agent.id, { note })}
                          />
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center gap-2 justify-end">
                            {onUpdateAgent && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditBalanceAgent(agent);
                                  setEditBalanceValue(String(agent.balance || 0));
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors"
                              >
                                <Pencil size={12} />
                                {language === 'vi' ? 'Sửa số dư' : 'Edit'}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setTopUpAgent(agent)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-xl text-xs font-bold hover:bg-orange-100 transition-colors"
                            >
                              <QrCode size={13} />
                              {t.payment_agent_topup || 'Nạp tiền'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredAgents.length > PAGE_SIZE && (
                <PaginationBar
                  page={agentPage}
                  totalPages={agentTotalPages}
                  total={filteredAgents.length}
                  language={language}
                  onPage={setAgentPage}
                />
              )}
            </>
          )}
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
            onChange={e => { setSearch(e.target.value); setTxPage(1); }}
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
                onClick={() => { setPaymentFilter(f); setTxPage(1); }}
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
          <div className="flex items-center gap-1.5 flex-wrap">
            {(['all', 'PENDING', 'BOOKED', 'CONFIRMED', 'PAID', 'CANCELLED'] as StatusFilter[]).map(s => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setTxPage(1); }}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                  statusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                )}
              >
                {s === 'all'
                  ? (t.payment_all || 'Tất cả')
                  : s === 'PAID' ? (t.payment_status_paid || 'Đã TT')
                  : s === 'CANCELLED' ? (t.payment_status_cancelled || 'Đã huỷ')
                  : s === 'CONFIRMED' ? (language === 'vi' ? 'Đã xác nhận' : 'Confirmed')
                  : s === 'PENDING' ? (language === 'vi' ? 'Chờ xác nhận' : 'Pending')
                  : (t.payment_status_pending || 'Chờ TT')}
              </button>
            ))}
          </div>

          {/* Quick date presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {([
              { key: 'thisMonth', label: 'Tháng này' },
              { key: 'lastMonth', label: 'Tháng trước' },
              { key: 'thisQuarter', label: 'Quý này' },
              { key: 'thisYear', label: 'Năm nay' },
              { key: 'all', label: 'Tất cả' },
            ] as { key: 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisYear' | 'all'; label: string }[]).map(p => (
              <button
                key={p.key}
                onClick={() => applyDatePreset(p.key)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-gray-100 text-gray-500 hover:bg-gray-200"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Manual date range */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setTxPage(1); }}
              className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-400/20"
            />
            <span className="text-gray-400 text-xs">—</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setTxPage(1); }}
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
          <>
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
                    <th className="w-6" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pagedTx.map(b => {
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
                              {(PAYABLE_STATUSES as readonly string[]).includes(b.status) && (
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

            {filtered.length > PAGE_SIZE && (
              <PaginationBar
                page={txPage}
                totalPages={txTotalPages}
                total={filtered.length}
                language={language}
                onPage={setTxPage}
              />
            )}
          </>
        )}
      </div>

      {/* Edit balance modal */}
      {editBalanceAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditBalanceAgent(null)}>
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-gray-800 text-base">
                {language === 'vi' ? 'Chỉnh số dư' : 'Edit Balance'} — {editBalanceAgent.name}
              </h4>
              <button onClick={() => setEditBalanceAgent(null)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400">
                <X size={16} />
              </button>
            </div>

            <div className="text-sm text-gray-500">
              {language === 'vi' ? 'Số dư hiện tại:' : 'Current balance:'}{' '}
              <span className={cn('font-bold', (editBalanceAgent.balance || 0) < 0 ? 'text-red-600' : 'text-gray-800')}>
                {(editBalanceAgent.balance || 0).toLocaleString('vi-VN')}đ
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">
                {language === 'vi' ? 'Số dư mới (VND)' : 'New balance (VND)'}
              </label>
              <input
                type="number"
                value={editBalanceValue}
                onChange={e => setEditBalanceValue(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') { handleSaveBalance(); }
                  else if (e.key === 'Escape') { setEditBalanceAgent(null); }
                }}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditBalanceAgent(null)}
                className="px-4 py-2 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 transition-colors"
              >
                {language === 'vi' ? 'Huỷ' : 'Cancel'}
              </button>
              <button
                onClick={handleSaveBalance}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                {language === 'vi' ? 'Lưu' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

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
