import React, { useState, useMemo } from 'react';
import {
  Users, Plus, Search, X, Save, Trash2, ChevronDown, ChevronUp,
  Phone, Mail, User, Calendar, Activity, Star, Eye, CheckCircle2, AlertCircle, Pencil,
  ShieldCheck, ShieldOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { TRANSLATIONS, Language } from '../App';
import { CustomerProfile } from '../types';
import { transportService } from '../services/transportService';

interface CustomerManagementProps {
  language: Language;
  customers: CustomerProfile[];
}

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

export const CustomerManagement: React.FC<CustomerManagementProps> = ({ language, customers }) => {
  const t = TRANSLATIONS[language];

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<CustomerProfile, 'id'>>({ ...EMPTY_FORM });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const showSuccess = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3000); };
  const showError = (msg: string) => { setErrorMsg(msg); setTimeout(() => setErrorMsg(''), 4000); };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return customers;
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.username || '').toLowerCase().includes(q)
    );
  }, [customers, search]);

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, registeredAt: new Date().toISOString() });
    setShowForm(true);
  };

  const openEdit = (c: CustomerProfile) => {
    setEditingId(c.id);
    setForm({
      name: c.name,
      phone: c.phone,
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
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      showError(language === 'vi' ? 'Tên và số điện thoại là bắt buộc' : 'Name and phone are required');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await transportService.updateCustomer(editingId, form);
        showSuccess(language === 'vi' ? 'Đã cập nhật khách hàng' : 'Customer updated');
      } else {
        await transportService.addCustomer({ ...form, registeredAt: new Date().toISOString() });
        showSuccess(language === 'vi' ? 'Đã thêm khách hàng' : 'Customer added');
      }
      setShowForm(false);
      setEditingId(null);
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

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch { return '—'; }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">{t.customer_management || 'Quản lý khách hàng'}</h2>
          <p className="text-gray-500 mt-1">{t.customer_management_desc || 'Hồ sơ thành viên và lịch sử hoạt động'}</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-5 py-2.5 bg-daiichi-red text-white rounded-xl font-bold text-sm shadow-lg shadow-daiichi-red/20 hover:scale-[1.02] transition-all shrink-0"
        >
          <Plus size={16} />
          {t.add_customer || 'Thêm khách hàng'}
        </button>
      </div>

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

      {/* Add/Edit Form */}
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
                {editingId
                  ? (language === 'vi' ? 'Chỉnh sửa khách hàng' : 'Edit Customer')
                  : (t.add_customer || 'Thêm khách hàng')}
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

      {/* Search bar + stats */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t.search_customer || 'Tìm tên, SĐT hoặc email...'}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
          />
        </div>
        <span className="text-sm text-gray-400 font-medium">
          {filtered.length} / {customers.length} {language === 'vi' ? 'khách hàng' : 'customers'}
        </span>
      </div>

      {/* Customer list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">{t.no_customers || 'Chưa có khách hàng nào'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
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
                    <p className="text-xs font-bold text-gray-700">{formatDate(c.registeredAt)}</p>
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
                    onClick={() => openEdit(c)}
                    className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                    title={t.edit_customer || 'Chỉnh sửa'}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(c)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    title={t.delete_customer || 'Xóa'}
                  >
                    <Trash2 size={16} />
                  </button>
                  <button
                    onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-all"
                    title={language === 'vi' ? 'Chi tiết hành vi' : 'Activity details'}
                  >
                    {expandedId === c.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

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

                      {/* Last activity */}
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                          <Activity size={11} />{t.customer_last_activity || 'Hoạt động gần đây'}
                        </p>
                        <p className="text-sm text-gray-700">{c.lastActivityAt ? formatDate(c.lastActivityAt) : '—'}</p>
                        {c.totalSpent != null && c.totalSpent > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            {t.customer_total_spent || 'Tổng chi'}: <span className="font-bold text-daiichi-red">{c.totalSpent.toLocaleString()}đ</span>
                          </p>
                        )}
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

                      {/* Booked routes */}
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                          <Calendar size={11} />{t.customer_booked_routes || 'Tuyến đã đặt'}
                        </p>
                        {(c.bookedRoutes || []).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {(c.bookedRoutes || []).slice(0, 6).map((r, i) => (
                              <span key={i} className="text-[11px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-medium">{r}</span>
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
    </div>
  );
};
