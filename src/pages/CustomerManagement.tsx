import React, { useState, useMemo, useEffect } from 'react';
import {
  Users, Plus, Search, X, Save, Trash2, ChevronDown, ChevronUp,
  Phone, Mail, User, Calendar, Star, Eye, CheckCircle2, AlertCircle, Pencil,
  ShieldCheck, ShieldOff, TrendingUp, Award, MapPin, Filter, ArrowUpDown, Ticket
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { formatDateVN } from '../lib/vnDate';
import { matchesSearch } from '../lib/searchUtils';
import { TRANSLATIONS, Language } from '../App';
import { CustomerProfile, User as AppUser, UserRole } from '../types';
import { transportService } from '../services/transportService';

interface CustomerManagementProps {
  language: Language;
  customers: CustomerProfile[];
  currentUser?: AppUser | null;
  dataRequested?: boolean;
  onLoadData?: () => void;
}

const PAGE_SIZE = 50;

const EMPTY_FORM: Omit<CustomerProfile, 'id'> = {
  name: '',
  phone: '',
  email: '',
  username: '',
  password: '',
  note: '',
  status: 'ACTIVE',
  registeredAt: new Date().toISOString(),
};

export const CustomerManagement: React.FC<CustomerManagementProps> = ({ language, customers, currentUser, dataRequested, onLoadData }) => {
  const t = TRANSLATIONS[language];
  const isAdmin = currentUser?.role === UserRole.MANAGER;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'registeredAt' | 'totalBookings' | 'totalSpent'>('registeredAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const sortOptions = useMemo(() => [
    { key: 'registeredAt' as const, label: language === 'vi' ? 'Ngày đăng ký' : 'Registered' },
    { key: 'name' as const, label: language === 'vi' ? 'Tên' : 'Name' },
    { key: 'totalBookings' as const, label: language === 'vi' ? 'Số đơn' : 'Bookings' },
    { key: 'totalSpent' as const, label: language === 'vi' ? 'Tổng chi' : 'Total Spent' },
  ], [language]);  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<CustomerProfile, 'id'>>({ ...EMPTY_FORM });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const showSuccess = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3000); };
  const showError = (msg: string) => { setErrorMsg(msg); setTimeout(() => setErrorMsg(''), 4000); };

  const filtered = useMemo(() => {
    let result = customers.filter(c => {
      const searchMatch = !search ||
        matchesSearch(c.name, search) ||
        matchesSearch(c.phone, search) ||
        matchesSearch(c.email || '', search) ||
        matchesSearch(c.username || '', search) ||
        matchesSearch(c.note || '', search);
      const statusMatch = statusFilter === 'ALL' || c.status === statusFilter;
      return searchMatch && statusMatch;
    });
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (sortBy === 'registeredAt') {
        cmp = (new Date(a.registeredAt || 0).getTime()) - (new Date(b.registeredAt || 0).getTime());
      } else if (sortBy === 'totalBookings') {
        cmp = (a.totalBookings ?? 0) - (b.totalBookings ?? 0);
      } else if (sortBy === 'totalSpent') {
        cmp = (a.totalSpent ?? 0) - (b.totalSpent ?? 0);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [customers, search, statusFilter, sortBy, sortDir]);

  // Reset to first page whenever filters or sort change
  useEffect(() => { setCurrentPage(1); }, [search, statusFilter, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  // Compute insights for the summary panel
  const insights = useMemo(() => {
    const total = customers.length;
    const active = customers.filter(c => c.status === 'ACTIVE').length;
    const thisMonth = new Date();
    thisMonth.setDate(1); thisMonth.setHours(0, 0, 0, 0);
    const newThisMonth = customers.filter(c => {
      try { return new Date(c.registeredAt) >= thisMonth; } catch { return false; }
    }).length;

    // Aggregate popular routes across all customers' bookedRoutes
    const routeCounts: Record<string, number> = {};
    customers.forEach(c => {
      (c.bookedRoutes || []).forEach(r => {
        routeCounts[r] = (routeCounts[r] || 0) + 1;
      });
    });
    const topRoutes = Object.entries(routeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([route, count]) => ({ route, count }));

    // Top customers by bookings
    const topCustomers = [...customers]
      .filter(c => (c.totalBookings ?? 0) > 0)
      .sort((a, b) => (b.totalBookings ?? 0) - (a.totalBookings ?? 0))
      .slice(0, 5);

    return { total, active, newThisMonth, topRoutes, topCustomers };
  }, [customers]);

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, registeredAt: new Date().toISOString() });
    setShowForm(true);
  };

  const openEdit = (c: CustomerProfile) => {
    setEditingId(c.id);
    setForm({
      name: c.name || '',
      phone: c.phone || '',
      email: c.email || '',
      username: c.username || '',
      password: c.password || '',
      note: c.note || '',
      status: c.status,
      registeredAt: c.registeredAt,
      lastActivityAt: c.lastActivityAt,
      viewedRoutes: c.viewedRoutes,
      viewedTours: c.viewedTours,
      bookedRoutes: c.bookedRoutes,
      preferences: c.preferences,
      totalBookings: c.totalBookings,
      totalSpent: c.totalSpent,
    });
    setShowForm(false);
    setExpandedId(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(form.name || '').trim() || !(form.phone || '').trim()) {
      showError(language === 'vi' ? 'Tên và số điện thoại là bắt buộc' : 'Name and phone are required');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        // Only update fields shown in the edit form; never overwrite activity/stats data
        // (bookedRoutes, totalBookings, totalSpent, lastActivityAt, preferences are managed by
        //  the booking system via updateCustomerOnBooking, not the admin edit form)
        const updates: Record<string, unknown> = {
          name: form.name,
          phone: form.phone,
          email: form.email ?? '',
          username: form.username ?? '',
          note: form.note ?? '',
          status: form.status,
        };
        // Only update password if the admin explicitly enters a new one
        if ((form.password || '').trim()) {
          updates.password = form.password;
        }
        await transportService.updateCustomer(editingId, updates as Partial<Omit<CustomerProfile, 'id'>>);
        showSuccess(language === 'vi' ? 'Đã cập nhật khách hàng' : 'Customer updated');
        setEditingId(null);
      } else {
        // Filter out undefined values so Firestore addDoc does not reject them
        const cleanForm = Object.fromEntries(
          Object.entries(form).filter(([, v]) => v !== undefined)
        ) as Omit<CustomerProfile, 'id'>;
        await transportService.addCustomer({ ...cleanForm, registeredAt: new Date().toISOString() });
        showSuccess(language === 'vi' ? 'Đã thêm khách hàng' : 'Customer added');
        setShowForm(false);
      }
    } catch {
      showError(language === 'vi' ? 'Lưu thất bại' : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: CustomerProfile) => {
    if (!window.confirm(t.confirm_delete_customer || `Delete ${c.name}?`)) return;
    try {
      await transportService.deleteCustomer(c.id);
      showSuccess(language === 'vi' ? 'Đã xóa khách hàng' : 'Customer deleted');
    } catch {
      showError(language === 'vi' ? 'Xóa thất bại' : 'Delete failed');
    }
  };

  const toggleStatus = async (c: CustomerProfile) => {
    const newStatus = c.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await transportService.updateCustomer(c.id, { status: newStatus });
    } catch {
      showError(language === 'vi' ? 'Cập nhật thất bại' : 'Update failed');
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">{t.customer_management || 'Quản lý khách hàng'}</h2>
          <p className="text-gray-500 mt-1">{t.customer_management_desc || 'Hồ sơ thành viên và lịch sử hoạt động'}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-5 py-2.5 bg-daiichi-red text-white rounded-xl font-bold text-sm shadow-lg shadow-daiichi-red/20 hover:scale-[1.02] transition-all"
          >
            <Plus size={16} />
            {t.add_customer || 'Thêm khách hàng'}
          </button>
        </div>
      </div>

      {/* Lazy-load prompt */}
      {!dataRequested && (
        <div className="flex flex-col items-center justify-center py-14 gap-4 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <Users size={36} className="text-gray-300" />
          <p className="text-sm text-gray-500">{language === 'vi' ? 'Dữ liệu khách hàng chưa được tải. Nhấn nút bên dưới để tải.' : 'Customer data not loaded yet. Click below to load.'}</p>
          <button
            onClick={onLoadData}
            className="px-5 py-2 bg-daiichi-red text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors"
          >
            {language === 'vi' ? 'Tải dữ liệu' : 'Load Data'}
          </button>
        </div>
      )}

      {/* Alerts */}
      <AnimatePresence>
        {successMsg && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-100 p-4 rounded-xl">
            <CheckCircle2 size={18} /><span className="font-bold text-sm">{successMsg}</span>
          </motion.div>
        )}
        {errorMsg && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-100 p-4 rounded-xl">
            <AlertCircle size={18} /><span className="font-bold text-sm">{errorMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Customer Insights Panel */}
      <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-daiichi-accent rounded-xl flex items-center justify-center text-daiichi-red">
            <TrendingUp size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">{t.customer_insights_title || 'Phân Tích Khách Hàng'}</h3>
            <p className="text-xs text-gray-500">{t.customer_insights_desc || 'Tổng quan nhu cầu và sở thích khách hàng để đưa ra đề xuất và khuyến mãi phù hợp.'}</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: t.customer_insights_total || 'Tổng thành viên', value: insights.total, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: t.customer_insights_active || 'Đang hoạt động', value: insights.active, color: 'text-green-600', bg: 'bg-green-50' },
            { label: t.customer_insights_new || 'Mới trong tháng', value: insights.newThisMonth, color: 'text-daiichi-red', bg: 'bg-red-50' },
          ].map((s, i) => (
            <div key={i} className={`${s.bg} rounded-2xl p-4 text-center`}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Popular routes */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1">
              <MapPin size={11} />{t.customer_top_routes || 'Tuyến đường phổ biến'}
            </p>
            {insights.topRoutes.length > 0 ? (
              <div className="space-y-2">
                {insights.topRoutes.map((r, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-gray-400 w-4 shrink-0">{i + 1}</span>
                      <span className="text-sm text-gray-700 truncate">{r.route}</span>
                    </div>
                    <span className="text-xs font-bold text-daiichi-red bg-red-50 px-2 py-0.5 rounded-full shrink-0 ml-2">
                      {r.count}x
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">{t.customer_no_data || 'Chưa có dữ liệu.'}</p>
            )}
          </div>

          {/* Top loyal customers */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1">
              <Award size={11} />{t.customer_top_members || 'Khách hàng thân thiết'}
            </p>
            {insights.topCustomers.length > 0 ? (
              <div className="space-y-2">
                {insights.topCustomers.map((c, i) => (
                  <div key={c.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-gray-400 w-4 shrink-0">{i + 1}</span>
                      <span className="text-sm text-gray-700 truncate">{c.name}</span>
                      <span className="text-xs text-gray-400 truncate hidden sm:inline">{c.phone}</span>
                    </div>
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full shrink-0 ml-2">
                      {c.totalBookings} {t.customer_total_bookings_unit || (language === 'vi' ? 'đơn' : 'bkgs')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">{t.customer_no_data || 'Chưa có dữ liệu.'}</p>
            )}
          </div>
        </div>
      </div>

      {/* Add Form (new customer only) */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="bg-white rounded-[32px] shadow-sm border border-gray-100 p-8"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-800">
                {t.add_customer || 'Thêm khách hàng'}
              </h3>
              <button onClick={() => setShowForm(false)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Name */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">
                  {t.customer_name || 'Tên khách hàng'} *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full mt-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                  placeholder={language === 'vi' ? 'Nguyễn Văn A' : 'Full name'}
                />
              </div>

              {/* Phone */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">
                  {t.customer_phone || 'Số điện thoại'} *
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  className="w-full mt-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                  placeholder="0912 345 678"
                />
              </div>

              {/* Email */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">
                  {t.customer_email || 'Email'}
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full mt-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                  placeholder="email@example.com"
                />
              </div>

              {/* Status */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">
                  {t.customer_status || 'Trạng thái'}
                </label>
                <select
                  value={form.status}
                  onChange={e => setForm(p => ({ ...p, status: e.target.value as 'ACTIVE' | 'INACTIVE' }))}
                  className="w-full mt-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                >
                  <option value="ACTIVE">{t.customer_active || 'Đang hoạt động'}</option>
                  <option value="INACTIVE">{t.customer_inactive || 'Không hoạt động'}</option>
                </select>
              </div>

              {/* Username */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">
                  {t.customer_username || 'Tên đăng nhập'}
                </label>
                <input
                  type="text"
                  value={form.username}
                  onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                  className="w-full mt-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                  placeholder={language === 'vi' ? 'Để trống nếu dùng SĐT' : 'Leave blank to use phone'}
                />
              </div>

              {/* Password */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">
                  {t.customer_password || 'Mật khẩu'}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  className="w-full mt-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                  placeholder={language === 'vi' ? 'Mật khẩu đăng nhập' : 'Login password'}
                  autoComplete="new-password"
                />
              </div>

              {/* Note – full width */}
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">
                  {language === 'vi' ? 'Ghi chú' : 'Note'}
                </label>
                <textarea
                  value={form.note}
                  onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
                  rows={2}
                  className="w-full mt-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/20 resize-none"
                  placeholder={language === 'vi' ? 'Ghi chú nội bộ...' : 'Internal note...'}
                />
              </div>

              {/* Actions */}
              <div className="md:col-span-2 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-6 py-2.5 border border-gray-200 rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-50 transition-all"
                >
                  {language === 'vi' ? 'Hủy' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-8 py-2.5 bg-daiichi-red text-white rounded-xl font-bold text-sm shadow-lg shadow-daiichi-red/20 hover:scale-[1.02] transition-all disabled:opacity-50"
                >
                  <Save size={16} />
                  {saving ? (language === 'vi' ? 'Đang lưu...' : 'Saving...') : (language === 'vi' ? 'Lưu' : 'Save')}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search bar + advanced filter */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t.search_customer || 'Tìm tên, SĐT hoặc email...'}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
            />
          </div>

          {/* Status filter pills */}
          <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100">
            {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-3 py-1 rounded-lg text-[11px] font-bold transition-all",
                  statusFilter === s ? "bg-daiichi-red text-white" : "text-gray-500"
                )}
              >
                {s === 'ALL' ? (language === 'vi' ? 'Tất cả' : 'All')
                  : s === 'ACTIVE' ? (t.customer_active || 'Hoạt động')
                  : (t.customer_inactive || 'Ngừng')}
              </button>
            ))}
          </div>

          {/* Advanced filter toggle */}
          <button
            onClick={() => setShowAdvancedFilter(v => !v)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all",
              showAdvancedFilter ? "bg-daiichi-red text-white border-daiichi-red" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
            )}
          >
            <Filter size={14} />
            {language === 'vi' ? 'Lọc nâng cao' : 'Advanced Filter'}
          </button>

          <span className="text-sm text-gray-400 font-medium ml-auto">
            {filtered.length} / {customers.length} {language === 'vi' ? 'khách hàng' : 'customers'}
          </span>
        </div>

        {/* Advanced filter panel */}
        <AnimatePresence>
          {showAdvancedFilter && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-4 p-5 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-2">
                  <ArrowUpDown size={14} className="text-gray-400" />
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                    {language === 'vi' ? 'Sắp xếp theo' : 'Sort by'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {sortOptions.map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => {
                        if (sortBy === opt.key) {
                          setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy(opt.key);
                          setSortDir('desc');
                        }
                      }}
                      className={cn(
                        "flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all",
                        sortBy === opt.key
                          ? "bg-daiichi-red text-white border-daiichi-red"
                          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                      )}
                    >
                      {opt.label}
                      {sortBy === opt.key && (
                        <span className="ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Customer list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">{t.no_customers || 'Chưa có khách hàng nào'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {paginated.map(c => (
            <motion.div
              key={c.id}
              layout
              className="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden"
            >
              {/* Row */}
              <div className="flex items-center gap-4 px-6 py-4">
                {/* Avatar */}
                <div className="w-10 h-10 bg-daiichi-accent rounded-2xl flex items-center justify-center text-daiichi-red font-extrabold text-sm shrink-0">
                  {c.name.charAt(0).toUpperCase()}
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-800 truncate">{c.name}</span>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full",
                      c.status === 'ACTIVE' ? "text-green-600 bg-green-50" : "text-gray-500 bg-gray-100"
                    )}>
                      {c.status === 'ACTIVE' ? (t.customer_active || 'Hoạt động') : (t.customer_inactive || 'Ngừng')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-xs text-gray-500 flex items-center gap-1"><Phone size={11} />{c.phone}</span>
                    {c.email && <span className="text-xs text-gray-500 flex items-center gap-1"><Mail size={11} />{c.email}</span>}
                    {c.username && <span className="text-xs text-gray-500 flex items-center gap-1"><User size={11} />{c.username}</span>}
                  </div>
                </div>

                {/* Stats */}
                <div className="hidden sm:flex items-center gap-6 text-center shrink-0">
                  <div>
                    <p className="text-xs text-gray-400">{t.customer_total_bookings || 'Đơn'}</p>
                    <p className="text-sm font-bold text-gray-700">{c.totalBookings ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">{t.customer_registered_at || 'Đăng ký'}</p>
                    <p className="text-xs font-bold text-gray-700">{formatDateVN(c.registeredAt)}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleStatus(c)}
                    className={cn("p-2 rounded-xl transition-all", c.status === 'ACTIVE' ? "text-green-500 hover:bg-green-50" : "text-gray-400 hover:bg-gray-50")}
                    title={c.status === 'ACTIVE' ? (language === 'vi' ? 'Vô hiệu hóa' : 'Deactivate') : (language === 'vi' ? 'Kích hoạt' : 'Activate')}
                  >
                    {c.status === 'ACTIVE' ? <ShieldCheck size={16} /> : <ShieldOff size={16} />}
                  </button>
                  <button
                    onClick={() => editingId === c.id ? setEditingId(null) : openEdit(c)}
                    className={cn("p-2 rounded-xl transition-all", editingId === c.id ? "text-blue-500 bg-blue-50" : "text-gray-400 hover:text-blue-500 hover:bg-blue-50")}
                    title={t.edit_customer || 'Chỉnh sửa'}
                  >
                    <Pencil size={16} />
                  </button>
                  {isAdmin && (
                  <button
                    onClick={() => handleDelete(c)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    title={t.delete_customer || 'Xóa'}
                  >
                    <Trash2 size={16} />
                  </button>
                  )}
                  <button
                    onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-all"
                    title={language === 'vi' ? 'Chi tiết hành vi' : 'Activity details'}
                  >
                    {expandedId === c.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

              {/* Inline Edit Form */}
              <AnimatePresence initial={false}>
                {editingId === c.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: 'easeInOut' }}
                    className="overflow-hidden border-t border-blue-100"
                  >
                    <div className="px-6 py-5 bg-blue-50/40">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                          <Pencil size={14} className="text-blue-500" />
                          {language === 'vi' ? 'Chỉnh sửa khách hàng' : 'Edit Customer'}
                        </h4>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Name */}
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">
                            {t.customer_name || 'Tên khách hàng'} *
                          </label>
                          <input
                            type="text"
                            value={form.name}
                            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                            className="w-full mt-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                            placeholder={language === 'vi' ? 'Nguyễn Văn A' : 'Full name'}
                          />
                        </div>
                        {/* Phone */}
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">
                            {t.customer_phone || 'Số điện thoại'} *
                          </label>
                          <input
                            type="tel"
                            value={form.phone}
                            onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                            className="w-full mt-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                            placeholder="0912 345 678"
                          />
                        </div>
                        {/* Email */}
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">
                            {t.customer_email || 'Email'}
                          </label>
                          <input
                            type="text"
                            value={form.email}
                            onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                            className="w-full mt-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                            placeholder="email@example.com"
                          />
                        </div>
                        {/* Status */}
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">
                            {t.customer_status || 'Trạng thái'}
                          </label>
                          <select
                            value={form.status}
                            onChange={e => setForm(p => ({ ...p, status: e.target.value as 'ACTIVE' | 'INACTIVE' }))}
                            className="w-full mt-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                          >
                            <option value="ACTIVE">{t.customer_active || 'Đang hoạt động'}</option>
                            <option value="INACTIVE">{t.customer_inactive || 'Không hoạt động'}</option>
                          </select>
                        </div>
                        {/* Username */}
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">
                            {t.customer_username || 'Tên đăng nhập'}
                          </label>
                          <input
                            type="text"
                            value={form.username}
                            onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                            className="w-full mt-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                            placeholder={language === 'vi' ? 'Để trống nếu dùng SĐT' : 'Leave blank to use phone'}
                          />
                        </div>
                        {/* Password */}
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">
                            {t.customer_password || 'Mật khẩu'}
                          </label>
                          <input
                            type="password"
                            value={form.password}
                            onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                            className="w-full mt-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                            placeholder={language === 'vi' ? 'Mật khẩu đăng nhập' : 'Login password'}
                            autoComplete="new-password"
                          />
                        </div>
                        {/* Note – full width */}
                        <div className="md:col-span-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">
                            {language === 'vi' ? 'Ghi chú' : 'Note'}
                          </label>
                          <textarea
                            value={form.note}
                            onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
                            rows={2}
                            className="w-full mt-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/20 resize-none"
                            placeholder={language === 'vi' ? 'Ghi chú nội bộ...' : 'Internal note...'}
                          />
                        </div>
                        {/* Actions */}
                        <div className="md:col-span-2 flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="px-5 py-2 border border-gray-200 rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-100 transition-all"
                          >
                            {language === 'vi' ? 'Hủy' : 'Cancel'}
                          </button>
                          <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-2 bg-daiichi-red text-white rounded-xl font-bold text-sm shadow-lg shadow-daiichi-red/20 hover:scale-[1.02] transition-all disabled:opacity-50"
                          >
                            <Save size={15} />
                            {saving ? (language === 'vi' ? 'Đang lưu...' : 'Saving...') : (language === 'vi' ? 'Lưu' : 'Save')}
                          </button>
                        </div>
                      </form>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Expanded – activity & preferences */}
              <AnimatePresence initial={false}>
                {expandedId === c.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: 'easeInOut' }}
                    className="overflow-hidden border-t border-gray-100"
                  >
                    <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 bg-gray-50/60">

                      {/* Ticket summary */}
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                          <Ticket size={11} className="text-daiichi-red" />{language === 'vi' ? 'Tổng kết vé đã đặt' : 'Ticket Summary'}
                        </p>
                        <div className="space-y-1.5">
                          <p className="text-sm font-bold text-gray-700">
                            {c.totalBookings ?? 0}
                            <span className="text-xs font-normal text-gray-500 ml-1">{language === 'vi' ? 'vé' : 'tickets'}</span>
                          </p>
                          {c.totalSpent != null && c.totalSpent > 0 && (
                            <p className="text-xs text-gray-500">
                              {t.customer_total_spent || 'Tổng chi'}: <span className="font-bold text-daiichi-red">{c.totalSpent.toLocaleString()}đ</span>
                            </p>
                          )}
                          <p className="text-xs text-gray-400">{c.lastActivityAt ? formatDateVN(c.lastActivityAt) : '—'}</p>
                        </div>
                      </div>

                      {/* Booked routes */}
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                          <Calendar size={11} />{t.customer_booked_routes || 'Tuyến đã đặt'}
                        </p>
                        {(c.bookedRoutes || []).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {(c.bookedRoutes || []).slice(0, 8).map((r, i) => (
                              <span key={i} className="text-[11px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-medium">{r}</span>
                            ))}
                          </div>
                        ) : <p className="text-xs text-gray-400">—</p>}
                      </div>

                      {/* Viewed routes */}
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                          <Eye size={11} />{t.customer_viewed_routes || 'Tuyến đã xem'}
                        </p>
                        {(c.viewedRoutes || []).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {(c.viewedRoutes || []).slice(0, 6).map((r, i) => (
                              <span key={i} className="text-[11px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">{r}</span>
                            ))}
                          </div>
                        ) : <p className="text-xs text-gray-400">—</p>}
                      </div>

                      {/* Preferences */}
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                          <Star size={11} />{t.customer_preferences || 'Sở thích'}
                        </p>
                        <div className="space-y-1">
                          {(c.preferences?.vehicleTypes || []).length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {(c.preferences?.vehicleTypes || []).map((v, i) => (
                                <span key={i} className="text-[11px] bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full font-medium">{v}</span>
                              ))}
                            </div>
                          )}
                          {(c.preferences?.departurePoints || []).length > 0 && (
                            <p className="text-[11px] text-gray-500">
                              {language === 'vi' ? 'Đi từ' : 'Depart'}: {(c.preferences?.departurePoints || []).slice(0, 3).join(', ')}
                            </p>
                          )}
                          {(c.preferences?.arrivalPoints || []).length > 0 && (
                            <p className="text-[11px] text-gray-500">
                              {language === 'vi' ? 'Đến' : 'Arrive'}: {(c.preferences?.arrivalPoints || []).slice(0, 3).join(', ')}
                            </p>
                          )}
                          {!c.preferences?.vehicleTypes?.length && !c.preferences?.departurePoints?.length && !c.preferences?.arrivalPoints?.length && (
                            <p className="text-xs text-gray-400">—</p>
                          )}
                        </div>
                      </div>

                      {/* Note */}
                      {c.note && (
                        <div className="sm:col-span-2 lg:col-span-4">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                            {language === 'vi' ? 'Ghi chú' : 'Note'}
                          </p>
                          <p className="text-sm text-gray-600">{c.note}</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            ‹ {language === 'vi' ? 'Trước' : 'Prev'}
          </button>
          {(() => {
            const items: (number | 'ellipsis-start' | 'ellipsis-end')[] = [];
            if (totalPages <= 7) {
              for (let i = 1; i <= totalPages; i++) items.push(i);
            } else {
              items.push(1);
              if (currentPage > 3) items.push('ellipsis-start');
              for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
                items.push(i);
              }
              if (currentPage < totalPages - 2) items.push('ellipsis-end');
              items.push(totalPages);
            }
            return items.map((item, idx) =>
              typeof item === 'string' ? (
                <span key={item + idx} className="text-gray-400 text-sm px-1">…</span>
              ) : (
                <button
                  key={item}
                  onClick={() => setCurrentPage(item)}
                  className={cn(
                    "w-9 h-9 rounded-xl text-sm font-bold transition-all",
                    item === currentPage
                      ? "bg-daiichi-red text-white shadow-lg shadow-daiichi-red/20"
                      : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  {item}
                </button>
              )
            );
          })()}
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {language === 'vi' ? 'Sau' : 'Next'} ›
          </button>
          <span className="text-xs text-gray-400 ml-2">
            {language === 'vi' ? `Trang ${currentPage}/${totalPages}` : `Page ${currentPage}/${totalPages}`}
          </span>
        </div>
      )}
    </div>
  );
};
