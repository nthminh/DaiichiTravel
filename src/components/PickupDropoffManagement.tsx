import React, { useState, useMemo } from 'react';
import {
  MapPin, Search, X, Edit3, Trash2, UserPlus, CheckCircle2,
  XCircle, Clock, Truck, Bus, ChevronDown, Filter, Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { TRANSLATIONS } from '../constants/translations';
import type { Language } from '../constants/translations';
import { Trip, Employee, Seat, DriverAssignment, SeatStatus } from '../types';
import { transportService } from '../services/transportService';

interface PassengerRow {
  tripId: string;
  tripRoute: string;
  tripDate: string;
  tripTime: string;
  licensePlate: string;
  seatId: string;
  seatLabel: string;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  dropoffAddress: string;
  assignment?: DriverAssignment;
}

interface PickupDropoffManagementProps {
  language: Language;
  trips: Trip[];
  employees: Employee[];
  driverAssignments: DriverAssignment[];
  currentUserName: string;
}

export const PickupDropoffManagement: React.FC<PickupDropoffManagementProps> = ({
  language,
  trips,
  employees,
  driverAssignments,
  currentUserName,
}) => {
  const t = TRANSLATIONS[language];

  // ── State ──────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Edit passenger pickup/dropoff
  const [editingRow, setEditingRow] = useState<PassengerRow | null>(null);
  const [editForm, setEditForm] = useState({ pickupAddress: '', dropoffAddress: '' });

  // Assign driver modal
  const [assignRow, setAssignRow] = useState<PassengerRow | null>(null);
  const [assignDriverId, setAssignDriverId] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  // ── Derived: flatten passengers with pickup/dropoff from all trips ─────────
  const allRows = useMemo<PassengerRow[]>(() => {
    const rows: PassengerRow[] = [];
    for (const trip of trips) {
      for (const seat of (trip.seats || [])) {
        const hasPickup = !!(seat.pickupAddress && seat.pickupAddress.trim());
        const hasDropoff = !!(seat.dropoffAddress && seat.dropoffAddress.trim());
        if (!hasPickup && !hasDropoff) continue;
        if (seat.status === SeatStatus.EMPTY) continue;
        const assignment = driverAssignments.find(
          a => a.tripId === trip.id && a.seatId === seat.id
        );
        rows.push({
          tripId: trip.id,
          tripRoute: trip.route || '',
          tripDate: trip.date || '',
          tripTime: trip.time || '',
          licensePlate: trip.licensePlate || '',
          seatId: seat.id,
          seatLabel: seat.id,
          customerName: seat.customerName || '',
          customerPhone: seat.customerPhone || '',
          pickupAddress: seat.pickupAddress || '',
          dropoffAddress: seat.dropoffAddress || '',
          assignment,
        });
      }
    }
    // Sort by date desc, then time asc
    rows.sort((a, b) => {
      if (a.tripDate !== b.tripDate) return b.tripDate.localeCompare(a.tripDate);
      return a.tripTime.localeCompare(b.tripTime);
    });
    return rows;
  }, [trips, driverAssignments]);

  // ── Filtered rows ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let rows = allRows;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.customerName.toLowerCase().includes(q) ||
        r.customerPhone.toLowerCase().includes(q) ||
        r.tripRoute.toLowerCase().includes(q) ||
        r.pickupAddress.toLowerCase().includes(q) ||
        r.dropoffAddress.toLowerCase().includes(q) ||
        (r.assignment?.driverName || '').toLowerCase().includes(q)
      );
    }
    if (dateFilter) {
      rows = rows.filter(r => r.tripDate === dateFilter);
    }
    if (statusFilter === 'assigned') {
      rows = rows.filter(r => !!r.assignment);
    } else if (statusFilter === 'unassigned') {
      rows = rows.filter(r => !r.assignment);
    }
    return rows;
  }, [allRows, search, dateFilter, statusFilter]);

  // ── Drivers list ───────────────────────────────────────────────────────────
  const drivers = employees.filter(e => e.role === 'DRIVER' && e.status === 'ACTIVE');

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleStartEdit = (row: PassengerRow) => {
    setEditingRow(row);
    setEditForm({ pickupAddress: row.pickupAddress, dropoffAddress: row.dropoffAddress });
  };

  const handleSaveEdit = async () => {
    if (!editingRow) return;
    try {
      const trip = trips.find(t => t.id === editingRow.tripId);
      if (!trip) return;
      const updatedSeats = trip.seats.map((s: Seat) =>
        s.id === editingRow.seatId
          ? { ...s, pickupAddress: editForm.pickupAddress, dropoffAddress: editForm.dropoffAddress }
          : s
      );
      await transportService.updateTrip(editingRow.tripId, { seats: updatedSeats });
      // Also update assignment snapshot if exists
      if (editingRow.assignment) {
        await transportService.updateDriverAssignment(editingRow.assignment.id, {
          pickupAddress: editForm.pickupAddress,
          dropoffAddress: editForm.dropoffAddress,
        });
      }
      setEditingRow(null);
    } catch (err) {
      console.error('Failed to update pickup/dropoff:', err);
    }
  };

  const handleDeleteRow = async (row: PassengerRow) => {
    if (!window.confirm(language === 'vi' ? 'Xóa điểm đón/trả của hành khách này?' : 'Remove this passenger\'s pickup/dropoff addresses?')) return;
    try {
      const trip = trips.find(t => t.id === row.tripId);
      if (!trip) return;
      const updatedSeats = trip.seats.map((s: Seat) =>
        s.id === row.seatId
          ? { ...s, pickupAddress: '', dropoffAddress: '' }
          : s
      );
      await transportService.updateTrip(row.tripId, { seats: updatedSeats });
      // Remove any associated assignment
      if (row.assignment) {
        await transportService.deleteDriverAssignment(row.assignment.id);
      }
    } catch (err) {
      console.error('Failed to delete pickup/dropoff:', err);
    }
  };

  const handleOpenAssign = (row: PassengerRow) => {
    setAssignRow(row);
    setAssignDriverId(row.assignment?.driverEmployeeId || (drivers[0]?.id ?? ''));
    setAssignNote(row.assignment?.note || '');
  };

  const handleConfirmAssign = async () => {
    if (!assignRow || !assignDriverId) return;
    setAssignLoading(true);
    try {
      const driver = employees.find(e => e.id === assignDriverId);
      const driverName = driver?.name || assignDriverId;
      const now = new Date().toISOString();

      if (assignRow.assignment) {
        // Re-assign: update existing
        await transportService.updateDriverAssignment(assignRow.assignment.id, {
          driverEmployeeId: assignDriverId,
          driverName,
          assignedBy: currentUserName,
          assignedAt: now,
          status: 'pending',
          note: assignNote,
          respondedAt: undefined,
          rejectionReason: undefined,
        });
      } else {
        // New assignment
        await transportService.addDriverAssignment({
          tripId: assignRow.tripId,
          seatId: assignRow.seatId,
          tripRoute: assignRow.tripRoute,
          tripDate: assignRow.tripDate,
          tripTime: assignRow.tripTime,
          licensePlate: assignRow.licensePlate,
          customerName: assignRow.customerName,
          customerPhone: assignRow.customerPhone,
          pickupAddress: assignRow.pickupAddress,
          dropoffAddress: assignRow.dropoffAddress,
          driverEmployeeId: assignDriverId,
          driverName,
          assignedBy: currentUserName,
          assignedAt: now,
          status: 'pending',
          note: assignNote,
        });
      }
      setAssignRow(null);
      setAssignNote('');
    } catch (err) {
      console.error('Failed to assign driver:', err);
    } finally {
      setAssignLoading(false);
    }
  };

  const handleRemoveAssignment = async (row: PassengerRow) => {
    if (!row.assignment) return;
    if (!window.confirm(language === 'vi' ? 'Hủy phân công tài xế này?' : 'Remove this driver assignment?')) return;
    try {
      await transportService.deleteDriverAssignment(row.assignment.id);
    } catch (err) {
      console.error('Failed to remove assignment:', err);
    }
  };

  // ── Export ─────────────────────────────────────────────────────────────────
  const handleExport = () => {
    const data = filtered.map(r => ({
      [language === 'vi' ? 'Tuyến' : 'Route']: r.tripRoute,
      [language === 'vi' ? 'Ngày' : 'Date']: r.tripDate,
      [language === 'vi' ? 'Giờ' : 'Time']: r.tripTime,
      [language === 'vi' ? 'Biển số' : 'Plate']: r.licensePlate,
      [language === 'vi' ? 'Ghế' : 'Seat']: r.seatLabel,
      [language === 'vi' ? 'Khách hàng' : 'Customer']: r.customerName,
      [language === 'vi' ? 'SĐT' : 'Phone']: r.customerPhone,
      [t.pickup_address_col || 'Điểm đón']: r.pickupAddress,
      [t.dropoff_address_col || 'Điểm trả']: r.dropoffAddress,
      [t.assigned_driver || 'Tài xế']: r.assignment?.driverName || '—',
      [t.assignment_status || 'Trạng thái']: r.assignment
        ? (r.assignment.status === 'accepted' ? (t.assignment_accepted || 'Đã nhận')
          : r.assignment.status === 'rejected' ? (t.assignment_rejected || 'Từ chối')
          : (t.assignment_pending || 'Chờ xác nhận'))
        : '—',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PickupDropoff');
    XLSX.writeFile(wb, `diem-don-tra-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ── Status badge helper ────────────────────────────────────────────────────
  const StatusBadge = ({ status }: { status: DriverAssignment['status'] }) => {
    if (status === 'accepted') return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-green-100 text-green-700">
        <CheckCircle2 size={10} />{t.assignment_accepted || 'Đã nhận việc'}
      </span>
    );
    if (status === 'rejected') return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
        <XCircle size={10} />{t.assignment_rejected || 'Từ chối'}
      </span>
    );
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
        <Clock size={10} />{t.assignment_pending || 'Chờ xác nhận'}
      </span>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <MapPin size={22} className="text-daiichi-red" />
            {t.pickup_dropoff_management || 'Quản lý Điểm đón/Trả'}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">{t.pickup_dropoff_desc || ''}</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:border-daiichi-red hover:text-daiichi-red transition-all"
        >
          <Download size={15} />
          {language === 'vi' ? 'Xuất Excel' : 'Export Excel'}
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: language === 'vi' ? 'Tổng mục' : 'Total', value: allRows.length, icon: MapPin, color: 'text-blue-600 bg-blue-50' },
          { label: language === 'vi' ? 'Đã phân công' : 'Assigned', value: allRows.filter(r => !!r.assignment).length, icon: UserPlus, color: 'text-green-600 bg-green-50' },
          { label: language === 'vi' ? 'Chưa phân công' : 'Unassigned', value: allRows.filter(r => !r.assignment).length, icon: Clock, color: 'text-amber-600 bg-amber-50' },
        ].map((s, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', s.color)}>
              <s.icon size={18} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{s.label}</p>
              <p className="text-2xl font-bold text-gray-800 mt-0.5">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search & filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={language === 'vi' ? 'Tìm khách hàng, tuyến, địa chỉ...' : 'Search customer, route, address...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
            />
          </div>
          <input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none"
          />
          <button
            onClick={() => setShowFilters(p => !p)}
            className={cn('flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all', showFilters ? 'bg-daiichi-red text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
          >
            <Filter size={14} />
            {language === 'vi' ? 'Lọc' : 'Filter'}
          </button>
          {(search || dateFilter || statusFilter !== 'all') && (
            <button
              onClick={() => { setSearch(''); setDateFilter(''); setStatusFilter('all'); }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-50 text-red-500 hover:bg-red-100 transition-all"
            >
              <X size={14} />{language === 'vi' ? 'Xóa lọc' : 'Clear'}
            </button>
          )}
        </div>
        {showFilters && (
          <div className="flex gap-2 flex-wrap pt-1 border-t border-gray-100">
            {([
              { id: 'all', label: language === 'vi' ? 'Tất cả' : 'All' },
              { id: 'assigned', label: t.assignment_accepted || 'Đã phân công' },
              { id: 'unassigned', label: language === 'vi' ? 'Chưa phân công' : 'Unassigned' },
            ] as { id: 'all' | 'assigned' | 'unassigned'; label: string }[]).map(opt => (
              <button
                key={opt.id}
                onClick={() => setStatusFilter(opt.id)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-bold transition-all', statusFilter === opt.id ? 'bg-daiichi-red text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main table */}
      <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {[
                  language === 'vi' ? 'Tuyến / Chuyến xe' : 'Route / Trip',
                  language === 'vi' ? 'Hành khách' : 'Passenger',
                  t.pickup_address_col || 'Điểm đón',
                  t.dropoff_address_col || 'Điểm trả',
                  t.assigned_driver || 'Tài xế',
                  t.assignment_status || 'Trạng thái',
                  language === 'vi' ? 'Thao tác' : 'Actions',
                ].map((h, i) => (
                  <th key={i} className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-8 py-16 text-center text-gray-400">
                    <MapPin size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="font-medium">{t.no_pickup_dropoff || 'Chưa có hành khách nào nhập điểm đón/trả.'}</p>
                  </td>
                </tr>
              ) : filtered.map((row, idx) => (
                <tr key={`${row.tripId}-${row.seatId}-${idx}`} className="hover:bg-gray-50 transition-colors">
                  {/* Trip info */}
                  <td className="px-5 py-4">
                    <p className="font-bold text-gray-800">{row.tripRoute}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {row.tripDate} {row.tripTime && `• ${row.tripTime}`}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Bus size={11} className="text-gray-400" />
                      <span className="text-[10px] text-gray-400">{row.licensePlate}</span>
                      <span className="text-[10px] text-gray-300">• {language === 'vi' ? 'Ghế' : 'Seat'} {row.seatLabel}</span>
                    </div>
                  </td>

                  {/* Passenger */}
                  <td className="px-5 py-4">
                    <p className="font-semibold text-gray-800">{row.customerName || '—'}</p>
                    <p className="text-xs text-gray-400">{row.customerPhone || ''}</p>
                  </td>

                  {/* Pickup address */}
                  <td className="px-5 py-4">
                    {editingRow?.tripId === row.tripId && editingRow?.seatId === row.seatId ? (
                      <input
                        type="text"
                        value={editForm.pickupAddress}
                        onChange={e => setEditForm(p => ({ ...p, pickupAddress: e.target.value }))}
                        className="w-full px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                        placeholder={t.pickup_address_col || 'Điểm đón'}
                      />
                    ) : (
                      <span className={cn('text-sm', row.pickupAddress ? 'text-gray-700' : 'text-gray-300')}>
                        {row.pickupAddress || '—'}
                      </span>
                    )}
                  </td>

                  {/* Dropoff address */}
                  <td className="px-5 py-4">
                    {editingRow?.tripId === row.tripId && editingRow?.seatId === row.seatId ? (
                      <input
                        type="text"
                        value={editForm.dropoffAddress}
                        onChange={e => setEditForm(p => ({ ...p, dropoffAddress: e.target.value }))}
                        className="w-full px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                        placeholder={t.dropoff_address_col || 'Điểm trả'}
                      />
                    ) : (
                      <span className={cn('text-sm', row.dropoffAddress ? 'text-gray-700' : 'text-gray-300')}>
                        {row.dropoffAddress || '—'}
                      </span>
                    )}
                  </td>

                  {/* Assigned driver */}
                  <td className="px-5 py-4">
                    {row.assignment ? (
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{row.assignment.driverName}</p>
                        {row.assignment.note && <p className="text-[10px] text-gray-400 truncate max-w-[120px]">{row.assignment.note}</p>}
                      </div>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-5 py-4">
                    {row.assignment ? (
                      <div className="space-y-1">
                        <StatusBadge status={row.assignment.status} />
                        {row.assignment.rejectionReason && (
                          <p className="text-[10px] text-red-500 max-w-[140px] truncate">{row.assignment.rejectionReason}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      {editingRow?.tripId === row.tripId && editingRow?.seatId === row.seatId ? (
                        <>
                          <button onClick={handleSaveEdit} className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors" title={language === 'vi' ? 'Lưu' : 'Save'}>
                            <CheckCircle2 size={16} />
                          </button>
                          <button onClick={() => setEditingRow(null)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors" title={language === 'vi' ? 'Hủy' : 'Cancel'}>
                            <X size={16} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => handleStartEdit(row)} className="p-1.5 rounded-lg text-gray-400 hover:text-daiichi-red hover:bg-red-50 transition-colors" title={language === 'vi' ? 'Chỉnh sửa' : 'Edit'}>
                            <Edit3 size={15} />
                          </button>
                          <button onClick={() => handleOpenAssign(row)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title={t.assign_driver || 'Phân công tài xế'}>
                            <UserPlus size={15} />
                          </button>
                          {row.assignment && (
                            <button onClick={() => handleRemoveAssignment(row)} className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" title={language === 'vi' ? 'Hủy phân công' : 'Remove assignment'}>
                              <XCircle size={15} />
                            </button>
                          )}
                          <button onClick={() => handleDeleteRow(row)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title={language === 'vi' ? 'Xóa' : 'Delete'}>
                            <Trash2 size={15} />
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

      {/* Assign Driver Modal */}
      <AnimatePresence>
        {assignRow && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[32px] p-8 max-w-lg w-full shadow-2xl space-y-5"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Truck size={18} className="text-daiichi-red" />
                  {t.assign_modal_title || 'Phân công tài xế'}
                </h3>
                <button onClick={() => setAssignRow(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                  <X size={18} />
                </button>
              </div>

              {/* Task summary */}
              <div className="bg-gray-50 rounded-2xl p-4 space-y-1.5 text-sm">
                <div className="flex gap-2"><span className="text-gray-400 w-20 shrink-0">{language === 'vi' ? 'Tuyến:' : 'Route:'}</span><span className="font-semibold">{assignRow.tripRoute}</span></div>
                <div className="flex gap-2"><span className="text-gray-400 w-20 shrink-0">{language === 'vi' ? 'Ngày/Giờ:' : 'Date/Time:'}</span><span>{assignRow.tripDate} {assignRow.tripTime}</span></div>
                <div className="flex gap-2"><span className="text-gray-400 w-20 shrink-0">{language === 'vi' ? 'Khách:' : 'Customer:'}</span><span>{assignRow.customerName} {assignRow.customerPhone}</span></div>
                {assignRow.pickupAddress && <div className="flex gap-2"><span className="text-gray-400 w-20 shrink-0">{t.pickup_address_col || 'Điểm đón'}:</span><span className="text-green-700">{assignRow.pickupAddress}</span></div>}
                {assignRow.dropoffAddress && <div className="flex gap-2"><span className="text-gray-400 w-20 shrink-0">{t.dropoff_address_col || 'Điểm trả'}:</span><span className="text-red-600">{assignRow.dropoffAddress}</span></div>}
              </div>

              {/* Driver selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.select_driver || 'Chọn tài xế'}</label>
                {drivers.length === 0 ? (
                  <p className="text-sm text-amber-600 bg-amber-50 px-4 py-3 rounded-xl">
                    {language === 'vi' ? 'Chưa có tài xế nào trong danh sách nhân viên. Vui lòng thêm nhân viên với vai trò DRIVER.' : 'No drivers found. Please add employees with the DRIVER role.'}
                  </p>
                ) : (
                  <select
                    value={assignDriverId}
                    onChange={e => setAssignDriverId(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
                  >
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.name}{d.phone ? ` • ${d.phone}` : ''}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Note */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.assignment_note || 'Ghi chú nhiệm vụ'}</label>
                <textarea
                  value={assignNote}
                  onChange={e => setAssignNote(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10 resize-none"
                  placeholder={language === 'vi' ? 'Thêm ghi chú cho tài xế...' : 'Add note for driver...'}
                />
              </div>

              <div className="flex justify-end gap-3 pt-1">
                <button onClick={() => setAssignRow(null)} className="px-5 py-2.5 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors">
                  {language === 'vi' ? 'Hủy' : 'Cancel'}
                </button>
                <button
                  onClick={handleConfirmAssign}
                  disabled={!assignDriverId || drivers.length === 0 || assignLoading}
                  className="px-7 py-2.5 bg-daiichi-red text-white rounded-xl text-sm font-bold shadow-lg shadow-daiichi-red/20 disabled:opacity-50 hover:bg-red-700 transition-colors"
                >
                  {assignLoading ? (language === 'vi' ? 'Đang lưu...' : 'Saving...') : (t.confirm_assign || 'Phân công')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
