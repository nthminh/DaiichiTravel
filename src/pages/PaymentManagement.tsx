import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  CreditCard, Search, Filter, Download, CheckCircle,
  Clock, XCircle, Users, TrendingUp, Wallet, QrCode,
  ChevronDown, ChevronUp, Pencil, X, ChevronLeft, ChevronRight,
  Zap, AlertTriangle, FlaskConical, Trash2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { formatDateVN } from '../lib/vnDate';
import { Language, TRANSLATIONS, User, UserRole } from '../App';
import { Agent, PendingPayment } from '../types';
import { AgentTopUpQRModal } from '../components/PaymentQRModal';
import { transportService } from '../services/transportService';
import { NotePopover } from '../components/NotePopover';

interface PaymentManagementProps {
  language: Language;
  bookings: any[];
  agents: Agent[];
  currentUser: User | null;
  onUpdateAgent?: (agentId: string, updates: any) => void;
  dataRequested?: boolean;
  onLoadData?: () => void;
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
  dataRequested,
  onLoadData,
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
  const [txPage, setTxPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deletingBooking, setDeletingBooking] = useState<string | null>(null);
  const [changingStatus, setChangingStatus] = useState<string | null>(null);

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

  // ── Change booking status ──────────────────────────────────────────────────
  const handleChangeStatus = async (bookingId: string, newStatus: string) => {
    if (!isAdmin) return;
    setChangingStatus(bookingId);
    try {
      const updates: Record<string, unknown> = { status: newStatus };
      if (newStatus === 'PAID') updates.paidAt = new Date().toISOString();
      await transportService.updateBooking(bookingId, updates);
    } catch (err) {
      console.error('Failed to change booking status:', err);
    } finally {
      setChangingStatus(null);
    }
  };

  // ── Delete booking ─────────────────────────────────────────────────────────
  const handleDeleteBooking = async (bookingId: string) => {
    if (!isAdmin) return;
    setDeletingBooking(bookingId);
    try {
      await transportService.deleteBooking(bookingId);
      setConfirmDelete(null);
      if (expandedBooking === bookingId) setExpandedBooking(null);
    } catch (err) {
      console.error('Failed to delete booking:', err);
    } finally {
      setDeletingBooking(null);
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

  // ── Payment Test Simulator ─────────────────────────────────────────────────
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [simulatorRef, setSimulatorRef] = useState('');
  const [simulatorAmount, setSimulatorAmount] = useState('');
  const [simulatorContent, setSimulatorContent] = useState('');
  const [simulatorError, setSimulatorError] = useState('');
  const [simulatorSuccess, setSimulatorSuccess] = useState('');
  const [simulatorLoading, setSimulatorLoading] = useState(false);
  const [simulatorOpen, setSimulatorOpen] = useState(false);

  // Subscribe to pending payments in real-time
  useEffect(() => {
    const unsub = transportService.subscribeToPendingPayments(setPendingPayments);
    return unsub;
  }, []);

  // Auto-fill amount when a pending payment is selected
  const handleSelectPendingPayment = useCallback((p: PendingPayment) => {
    setSimulatorRef(p.paymentRef);
    setSimulatorAmount(String(p.expectedAmount));
    setSimulatorContent(p.paymentRef);
    setSimulatorError('');
    setSimulatorSuccess('');
  }, []);

  const handleSimulatePayment = async () => {
    setSimulatorError('');
    setSimulatorSuccess('');
    const ref = simulatorRef.trim().toUpperCase();
    const amt = parseFloat(simulatorAmount);
    const content = simulatorContent.trim();

    if (!ref) {
      setSimulatorError(language === 'vi' ? 'Vui lòng nhập mã thanh toán.' : 'Please enter payment reference.');
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      setSimulatorError(language === 'vi' ? 'Vui lòng nhập số tiền hợp lệ.' : 'Please enter a valid amount.');
      return;
    }

    // Find the corresponding pending payment to verify amount
    const pending = pendingPayments.find(p => p.paymentRef.toUpperCase() === ref);
    if (!pending) {
      setSimulatorError(
        language === 'vi'
          ? `Không tìm thấy giao dịch chờ với mã "${ref}". Hãy chắc chắn khách hàng đang ở màn hình thanh toán.`
          : `No pending payment found for "${ref}". Make sure the customer is on the payment screen.`
      );
      return;
    }

    setSimulatorLoading(true);
    try {
      await transportService.confirmPendingPayment(ref, amt, content || ref);
      setSimulatorSuccess(
        language === 'vi'
          ? `✅ Đã xác nhận thanh toán ${amt.toLocaleString('vi-VN')}đ cho mã "${ref}". App sẽ tự động cập nhật.`
          : `✅ Payment of ${amt.toLocaleString()} confirmed for "${ref}". App will update automatically.`
      );
      setSimulatorRef('');
      setSimulatorAmount('');
      setSimulatorContent('');
    } catch (err) {
      console.error('Simulator error:', err);
      setSimulatorError(language === 'vi' ? 'Lỗi khi xác nhận thanh toán. Vui lòng thử lại.' : 'Error confirming payment. Please try again.');
    } finally {
      setSimulatorLoading(false);
    }
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
        b.createdAt ? formatDateVN(b.createdAt) : '',
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

      {/* Lazy-load prompt */}
      {!dataRequested && (
        <div className="flex flex-col items-center justify-center py-14 gap-4 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <CreditCard size={36} className="text-gray-300" />
          <p className="text-sm text-gray-500">{language === 'vi' ? 'Dữ liệu thanh toán chưa được tải. Nhấn nút bên dưới để tải.' : 'Payment data not loaded yet. Click below to load.'}</p>
          <button
            onClick={onLoadData}
            className="px-5 py-2 bg-daiichi-red text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors"
          >
            {language === 'vi' ? 'Tải dữ liệu' : 'Load Data'}
          </button>
        </div>
      )}

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
                            {createdAt ? formatDateVN(createdAt) : '—'}
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
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={b.status}
                                  disabled={changingStatus === b.id}
                                  onChange={e => handleChangeStatus(b.id, e.target.value)}
                                  aria-label={language === 'vi' ? 'Thay đổi trạng thái' : 'Change status'}
                                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-50 cursor-pointer"
                                >
                                  <option value="PENDING">{language === 'vi' ? 'Chờ TT' : 'Pending'}</option>
                                  <option value="BOOKED">{language === 'vi' ? 'Đã đặt' : 'Booked'}</option>
                                  <option value="CONFIRMED">{language === 'vi' ? 'Đã xác nhận' : 'Confirmed'}</option>
                                  <option value="PAID">{language === 'vi' ? 'Đã thanh toán' : 'Paid'}</option>
                                  <option value="CANCELLED">{language === 'vi' ? 'Đã huỷ' : 'Cancelled'}</option>
                                </select>
                                <button
                                  onClick={() => setConfirmDelete(b.id)}
                                  className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                  title={language === 'vi' ? 'Xoá giao dịch' : 'Delete booking'}
                                  aria-label={language === 'vi' ? 'Xoá giao dịch' : 'Delete booking'}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
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
                                  <p className="font-semibold text-gray-700">
                                    {b.time || b.date
                                      ? [b.time, b.date ? formatDateVN(b.date) : ''].filter(Boolean).join(' – ')
                                      : '—'}
                                  </p>
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

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmDelete(null)}>
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <div>
                <h4 className="font-bold text-gray-800 text-base">
                  {language === 'vi' ? 'Xoá giao dịch?' : 'Delete booking?'}
                </h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  {language === 'vi' ? 'Thao tác này không thể hoàn tác.' : 'This action cannot be undone.'}
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 transition-colors"
              >
                {language === 'vi' ? 'Huỷ' : 'Cancel'}
              </button>
              <button
                onClick={() => handleDeleteBooking(confirmDelete)}
                disabled={deletingBooking === confirmDelete}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deletingBooking === confirmDelete
                  ? (language === 'vi' ? 'Đang xoá...' : 'Deleting...')
                  : (language === 'vi' ? 'Xoá' : 'Delete')}
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

      {/* ── Payment Test Simulator (manager only) ─────────────────────────── */}
      {isAdmin && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Section header */}
          <button
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
            onClick={() => setSimulatorOpen(o => !o)}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center">
                <FlaskConical size={18} className="text-purple-600" />
              </div>
              <div className="text-left">
                <p className="font-bold text-gray-800 text-sm">
                  {language === 'vi' ? 'Mô phỏng thanh toán (Thử nghiệm)' : 'Payment Simulator (Test)'}
                </p>
                <p className="text-xs text-gray-400">
                  {language === 'vi'
                    ? `${pendingPayments.length} giao dịch QR đang chờ xác nhận`
                    : `${pendingPayments.length} QR transaction(s) awaiting confirmation`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {pendingPayments.length > 0 && (
                <span className="w-5 h-5 bg-purple-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {pendingPayments.length}
                </span>
              )}
              {simulatorOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
            </div>
          </button>

          {simulatorOpen && (
            <div className="border-t border-gray-100 p-5 space-y-5">
              {/* Pending payments list */}
              {pendingPayments.length > 0 ? (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                    {language === 'vi' ? 'Giao dịch đang chờ' : 'Pending Transactions'}
                  </p>
                  <div className="space-y-2">
                    {pendingPayments.map(p => (
                      <button
                        key={p.id}
                        onClick={() => handleSelectPendingPayment(p)}
                        className={cn(
                          'w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all hover:bg-purple-50',
                          simulatorRef.toUpperCase() === p.paymentRef.toUpperCase()
                            ? 'border-purple-400 bg-purple-50'
                            : 'border-gray-200 bg-gray-50'
                        )}
                      >
                        <div>
                          <p className="font-bold text-gray-800 text-sm font-mono">{p.paymentRef}</p>
                          <p className="text-xs text-gray-500">{p.customerName} · {p.routeInfo}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-purple-700 text-sm">{p.expectedAmount.toLocaleString('vi-VN')}đ</p>
                          <p className="text-[10px] text-gray-400">
                            {language === 'vi' ? 'Nhấn để chọn' : 'Click to select'}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-gray-400 text-sm">
                  <QrCode size={32} className="mx-auto mb-2 opacity-30" />
                  <p>
                    {language === 'vi'
                      ? 'Không có giao dịch QR nào đang chờ.'
                      : 'No pending QR transactions.'}
                  </p>
                  <p className="text-xs mt-1">
                    {language === 'vi'
                      ? 'Giao dịch sẽ xuất hiện khi khách hàng đến màn hình thanh toán.'
                      : 'Transactions appear when a customer reaches the payment screen.'}
                  </p>
                </div>
              )}

              {/* Simulator form */}
              <div className="bg-purple-50 rounded-2xl p-4 space-y-3 border border-purple-100">
                <p className="text-xs font-bold text-purple-700 uppercase tracking-widest">
                  {language === 'vi' ? 'Nhập thông tin thanh toán' : 'Enter Payment Details'}
                </p>

                <div className="space-y-2">
                  <label className="block text-xs text-gray-500 font-medium">
                    {language === 'vi' ? 'Mã thanh toán (paymentRef)' : 'Payment Reference'}
                  </label>
                  <input
                    type="text"
                    value={simulatorRef}
                    onChange={e => {
                      setSimulatorRef(e.target.value.toUpperCase());
                      setSimulatorContent(e.target.value.toUpperCase());
                      setSimulatorError('');
                      setSimulatorSuccess('');
                    }}
                    placeholder="DT-ABC123"
                    className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-400/30"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs text-gray-500 font-medium">
                    {language === 'vi' ? 'Số tiền (VNĐ)' : 'Amount (VND)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={simulatorAmount}
                    onChange={e => {
                      setSimulatorAmount(e.target.value);
                      setSimulatorError('');
                      setSimulatorSuccess('');
                    }}
                    placeholder="500000"
                    className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-400/30"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs text-gray-500 font-medium">
                    {language === 'vi' ? 'Nội dung chuyển khoản' : 'Transfer Description'}
                  </label>
                  <input
                    type="text"
                    value={simulatorContent}
                    onChange={e => {
                      setSimulatorContent(e.target.value.toUpperCase());
                      setSimulatorError('');
                      setSimulatorSuccess('');
                    }}
                    placeholder={language === 'vi' ? 'Nội dung phải chứa mã vé' : 'Must contain ticket code'}
                    className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-400/30"
                  />
                  <p className="text-[10px] text-gray-400">
                    {language === 'vi'
                      ? 'Nội dung phải chứa mã thanh toán (ví dụ: DT-ABC123) để được xác nhận tự động.'
                      : 'Content must include the payment ref (e.g. DT-ABC123) for auto-confirmation.'}
                  </p>
                </div>

                {simulatorError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-2.5">
                    <AlertTriangle size={13} className="text-red-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-700">{simulatorError}</p>
                  </div>
                )}

                {simulatorSuccess && (
                  <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-xl p-2.5">
                    <CheckCircle size={13} className="text-green-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-green-700">{simulatorSuccess}</p>
                  </div>
                )}

                <button
                  onClick={handleSimulatePayment}
                  disabled={simulatorLoading || !simulatorRef.trim() || !simulatorAmount}
                  className={cn(
                    'w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2',
                    simulatorLoading || !simulatorRef.trim() || !simulatorAmount
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-200'
                  )}
                >
                  <Zap size={15} />
                  {simulatorLoading
                    ? (language === 'vi' ? 'Đang xử lý...' : 'Processing...')
                    : (language === 'vi' ? 'Xác nhận thanh toán (Giả lập)' : 'Confirm Payment (Simulate)')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
