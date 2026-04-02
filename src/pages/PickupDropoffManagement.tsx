import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  MapPin, Search, X, Edit3, Trash2, UserPlus, CheckCircle2,
  XCircle, Clock, Truck, Bus, Filter, Download, AlertCircle,
  ArrowDownCircle, ArrowUpCircle, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { TRANSLATIONS } from '../constants/translations';
import type { Language } from '../constants/translations';
import { Trip, Employee, Seat, DriverAssignment, SeatStatus, User, UserRole } from '../types';
import { transportService } from '../services/transportService';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ToastContainer';
import { exportRowsToExcel } from '../utils/exportUtils';
import { nowVN, formatBookingDate } from '../lib/vnDate';

interface BookingRow {
  bookingId: string;          // booking document id, or synthetic key for unmatched seats
  tripId: string;
  tripRoute: string;
  tripDate: string;
  tripTime: string;
  licensePlate: string;
  primarySeatId: string;      // primary seat id used as the key for DriverAssignment
  seatIds: string[];          // all seat IDs belonging to this booking
  seatLabels: string;         // comma-separated seat labels, e.g. "A1, A2"
  customerName: string;
  customerPhone: string;
  adults: number;
  children: number;
  pickupAddress: string;
  dropoffAddress: string;
  pickupAddressDetail: string;
  dropoffAddressDetail: string;
  pickupAssignment?: DriverAssignment;
  dropoffAssignment?: DriverAssignment;
}

interface PickupDropoffManagementProps {
  language: Language;
  trips: Trip[];
  employees: Employee[];
  driverAssignments: DriverAssignment[];
  bookings: any[];
  currentUserName: string;
  currentUser?: User | null;
}

// ── Simple combo-box (type-ahead + dropdown) ───────────────────────────────────
interface ComboBoxProps {
  id: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}
const ComboBox: React.FC<ComboBoxProps> = ({ id, placeholder, value, onChange, options }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    return q ? options.filter(o => o.toLowerCase().includes(q)) : options;
  }, [value, options]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative flex-1 min-w-[160px]">
      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <input
        id={id}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className="w-full pl-8 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
        autoComplete="off"
      />
      {value && (
        <button
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
          onMouseDown={e => { e.preventDefault(); onChange(''); }}
          tabIndex={-1}
        >
          <X size={13} />
        </button>
      )}
      {open && filtered.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full max-h-52 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg text-sm">
          {filtered.map(opt => (
            <li
              key={opt}
              onMouseDown={e => { e.preventDefault(); onChange(opt); setOpen(false); }}
              className={cn(
                'px-3 py-2 cursor-pointer hover:bg-daiichi-red/5',
                value === opt ? 'bg-daiichi-red/10 font-semibold text-daiichi-red' : 'text-gray-700',
              )}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const PickupDropoffManagement: React.FC<PickupDropoffManagementProps> = ({
  language,
  trips,
  employees,
  driverAssignments,
  bookings,
  currentUserName,
  currentUser,
}) => {
  const t = TRANSLATIONS[language];
  const isAdmin = currentUser?.role === UserRole.MANAGER;

  // ── Toast notifications ────────────────────────────────────────────────────
  const { toasts, showToast, dismissToast } = useToast();

  // ── Shared filter state ────────────────────────────────────────────────────
  const [filterRoute, setFilterRoute]       = useState('');
  const [filterPlate, setFilterPlate]       = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [dateFilter, setDateFilter]         = useState('');
  const [statusFilter, setStatusFilter]     = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [showFilters, setShowFilters]       = useState(false);

  // ── Pagination ─────────────────────────────────────────────────────────────
  const PAGE_SIZE = 50;
  const [pickupPage, setPickupPage]   = useState(1);
  const [dropoffPage, setDropoffPage] = useState(1);

  // Reset pages when filters change
  useEffect(() => { setPickupPage(1); setDropoffPage(1); }, [filterRoute, filterPlate, filterEmployee, dateFilter, statusFilter]);

  // Edit passenger pickup/dropoff
  const [editingRow, setEditingRow] = useState<BookingRow | null>(null);
  const [editForm, setEditForm]     = useState({ pickupAddress: '', dropoffAddress: '', pickupAddressDetail: '', dropoffAddressDetail: '' });

  // Assign driver modal
  const [assignRow, setAssignRow]           = useState<BookingRow | null>(null);
  const [assignTaskType, setAssignTaskType] = useState<'pickup' | 'dropoff'>('pickup');
  const [assignDriverId, setAssignDriverId] = useState('');
  const [assignNote, setAssignNote]         = useState('');
  const [assignLoading, setAssignLoading]   = useState(false);
  const [assignError, setAssignError]       = useState<string>('');

  // ── Derived: group seats by booking for all trips ─────────────────────────
  const allRows = useMemo<BookingRow[]>(() => {
    const rows: BookingRow[] = [];

    // Build a map: "tripId:seatId" → booking document (for TICKET bookings)
    const seatToBookingMap = new Map<string, any>();
    for (const bk of bookings) {
      if (!bk.tripId || bk.type === 'TOUR') continue;
      if (bk.seatId)  seatToBookingMap.set(`${bk.tripId}:${bk.seatId}`, bk);
      if (bk.seatIds) {
        for (const sid of bk.seatIds) seatToBookingMap.set(`${bk.tripId}:${sid}`, bk);
      }
    }

    for (const trip of trips) {
      const seatsWithAddress = (trip.seats || []).filter(
        (s: Seat) => s.status !== SeatStatus.EMPTY && (s.pickupAddress?.trim() || s.dropoffAddress?.trim()),
      );
      if (seatsWithAddress.length === 0) continue;

      // Group seats by their booking id; unmatched seats get their own pseudo-group
      const processedBookingIds = new Set<string>();
      const ungroupedSeats: Seat[] = [];

      for (const seat of seatsWithAddress) {
        const bk = seatToBookingMap.get(`${trip.id}:${seat.id}`);
        if (!bk) { ungroupedSeats.push(seat); continue; }
        if (processedBookingIds.has(bk.id)) continue; // already created a row for this booking
        processedBookingIds.add(bk.id);

        const allSeatIds: string[] = bk.seatIds || (bk.seatId ? [bk.seatId] : [seat.id]);
        const primarySeatId: string = bk.seatId || seat.id;
        const primarySeat: Seat = (trip.seats || []).find((s: Seat) => s.id === primarySeatId) || seat;

        const pickupAssignment = driverAssignments.find(
          a => a.tripId === trip.id && a.seatId === primarySeatId && a.taskType === 'pickup',
        );
        const dropoffAssignment = driverAssignments.find(
          a => a.tripId === trip.id && a.seatId === primarySeatId && a.taskType === 'dropoff',
        );

        const pickupAddress  = primarySeat.pickupAddress  || bk.pickupAddress  || '';
        const dropoffAddress = primarySeat.dropoffAddress || bk.dropoffAddress || '';
        if (!pickupAddress && !dropoffAddress) continue;

        rows.push({
          bookingId: bk.id,
          tripId: trip.id,
          tripRoute: trip.route || '',
          tripDate: trip.date || '',
          tripTime: trip.time || '',
          licensePlate: trip.licensePlate || '',
          primarySeatId,
          seatIds: allSeatIds,
          seatLabels: allSeatIds.join(', '),
          customerName: bk.customerName || primarySeat.customerName || '',
          customerPhone: bk.customerPhone || primarySeat.customerPhone || '',
          adults: bk.adults ?? 1,
          children: bk.children ?? 0,
          pickupAddress,
          dropoffAddress,
          pickupAddressDetail: primarySeat.pickupAddressDetail || bk.pickupAddressDetail || '',
          dropoffAddressDetail: primarySeat.dropoffAddressDetail || bk.dropoffAddressDetail || '',
          pickupAssignment,
          dropoffAssignment,
        });
      }

      // Fallback: seats with pickup/dropoff but no matching booking
      for (const seat of ungroupedSeats) {
        const pickupAssignment = driverAssignments.find(
          a => a.tripId === trip.id && a.seatId === seat.id && a.taskType === 'pickup',
        );
        const dropoffAssignment = driverAssignments.find(
          a => a.tripId === trip.id && a.seatId === seat.id && a.taskType === 'dropoff',
        );
        rows.push({
          bookingId: `${trip.id}:${seat.id}`,
          tripId: trip.id,
          tripRoute: trip.route || '',
          tripDate: trip.date || '',
          tripTime: trip.time || '',
          licensePlate: trip.licensePlate || '',
          primarySeatId: seat.id,
          seatIds: [seat.id],
          seatLabels: seat.id,
          customerName: seat.customerName || '',
          customerPhone: seat.customerPhone || '',
          adults: 1,
          children: 0,
          pickupAddress:  seat.pickupAddress  || '',
          dropoffAddress: seat.dropoffAddress || '',
          pickupAddressDetail:  seat.pickupAddressDetail  || '',
          dropoffAddressDetail: seat.dropoffAddressDetail || '',
          pickupAssignment,
          dropoffAssignment,
        });
      }
    }

    rows.sort((a, b) => {
      if (a.tripDate !== b.tripDate) return b.tripDate.localeCompare(a.tripDate);
      return a.tripTime.localeCompare(b.tripTime);
    });
    return rows;
  }, [trips, bookings, driverAssignments]);

  // ── Combo-box option lists ─────────────────────────────────────────────────
  const routeOptions   = useMemo(() => [...new Set(allRows.map(r => r.tripRoute).filter(Boolean))], [allRows]);
  const plateOptions   = useMemo(() => [...new Set(allRows.map(r => r.licensePlate).filter(Boolean))], [allRows]);
  const employeeNames  = useMemo(() => employees.filter(e => e.status === 'ACTIVE').map(e => e.name), [employees]);

  // ── Shared filter predicate ────────────────────────────────────────────────
  const applyFilters = (rows: BookingRow[]) => {
    let result = rows;
    if (filterRoute.trim()) {
      const q = filterRoute.trim().toLowerCase();
      result = result.filter(r => r.tripRoute.toLowerCase().includes(q));
    }
    if (filterPlate.trim()) {
      const q = filterPlate.trim().toLowerCase();
      result = result.filter(r => r.licensePlate.toLowerCase().includes(q));
    }
    if (filterEmployee.trim()) {
      const q = filterEmployee.trim().toLowerCase();
      result = result.filter(r =>
        (r.pickupAssignment?.driverName  || '').toLowerCase().includes(q) ||
        (r.dropoffAssignment?.driverName || '').toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q)
      );
    }
    if (dateFilter) {
      result = result.filter(r => r.tripDate === dateFilter);
    }
    if (statusFilter === 'assigned') {
      result = result.filter(r => !!r.pickupAssignment || !!r.dropoffAssignment);
    } else if (statusFilter === 'unassigned') {
      result = result.filter(r => !r.pickupAssignment && !r.dropoffAssignment);
    }
    return result;
  };

  const filteredRows = useMemo(() => applyFilters(allRows), [allRows, filterRoute, filterPlate, filterEmployee, dateFilter, statusFilter]);
  const pickupRows  = useMemo(() => filteredRows.filter(r => !!r.pickupAddress),  [filteredRows]);
  const dropoffRows = useMemo(() => filteredRows.filter(r => !!r.dropoffAddress), [filteredRows]);

  // ── Drivers list ───────────────────────────────────────────────────────────
  const drivers = employees.filter(e => e.role === 'DRIVER' && e.status === 'ACTIVE');

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleStartEdit = (row: BookingRow) => {
    setEditingRow(row);
    setEditForm({ pickupAddress: row.pickupAddress, dropoffAddress: row.dropoffAddress, pickupAddressDetail: row.pickupAddressDetail || '', dropoffAddressDetail: row.dropoffAddressDetail || '' });
  };

  const handleSaveEdit = async () => {
    if (!editingRow) return;
    try {
      const trip = trips.find(tr => tr.id === editingRow.tripId);
      if (!trip) return;
      const updatedSeats = trip.seats.map((s: Seat) =>
        editingRow.seatIds.includes(s.id)
          ? { ...s, pickupAddress: editForm.pickupAddress, dropoffAddress: editForm.dropoffAddress, pickupAddressDetail: editForm.pickupAddressDetail, dropoffAddressDetail: editForm.dropoffAddressDetail }
          : s
      );
      await transportService.updateTrip(editingRow.tripId, { seats: updatedSeats });
      // Sync address snapshots in existing assignments
      if (editingRow.pickupAssignment) {
        await transportService.updateDriverAssignment(editingRow.pickupAssignment.id, {
          pickupAddress: editForm.pickupAddress,
          pickupAddressDetail: editForm.pickupAddressDetail,
        });
      }
      if (editingRow.dropoffAssignment) {
        await transportService.updateDriverAssignment(editingRow.dropoffAssignment.id, {
          dropoffAddress: editForm.dropoffAddress,
          dropoffAddressDetail: editForm.dropoffAddressDetail,
        });
      }
      setEditingRow(null);
      showToast(language === 'vi' ? 'Đã cập nhật điểm đón/trả.' : 'Pickup/dropoff updated.', 'success');
    } catch (err) {
      console.error('Failed to update pickup/dropoff:', err);
      showToast(
        language === 'vi'
          ? 'Lỗi khi cập nhật điểm đón/trả. Vui lòng thử lại.'
          : 'Failed to update pickup/dropoff. Please try again.',
        'error',
      );
    }
  };

  const handleDeleteRow = async (row: BookingRow) => {
    if (!window.confirm(
      language === 'vi'
        ? 'Xóa điểm đón/trả của đơn đặt này?'
        : "Remove this booking's pickup/dropoff addresses?",
    )) return;
    try {
      const trip = trips.find(tr => tr.id === row.tripId);
      if (!trip) return;
      const updatedSeats = trip.seats.map((s: Seat) =>
        row.seatIds.includes(s.id)
          ? { ...s, pickupAddress: '', dropoffAddress: '', pickupAddressDetail: '', dropoffAddressDetail: '' }
          : s
      );
      await transportService.updateTrip(row.tripId, { seats: updatedSeats });
      if (row.pickupAssignment)  await transportService.deleteDriverAssignment(row.pickupAssignment.id);
      if (row.dropoffAssignment) await transportService.deleteDriverAssignment(row.dropoffAssignment.id);
      showToast(language === 'vi' ? 'Đã xóa điểm đón/trả.' : 'Pickup/dropoff removed.', 'success');
    } catch (err) {
      console.error('Failed to delete pickup/dropoff:', err);
      showToast(
        language === 'vi'
          ? 'Lỗi khi xóa điểm đón/trả. Vui lòng thử lại.'
          : 'Failed to remove pickup/dropoff. Please try again.',
        'error',
      );
    }
  };

  const handleOpenAssign = (row: BookingRow, taskType: 'pickup' | 'dropoff') => {
    const existing = taskType === 'pickup' ? row.pickupAssignment : row.dropoffAssignment;
    setAssignRow(row);
    setAssignTaskType(taskType);
    setAssignDriverId(existing?.driverEmployeeId || (drivers[0]?.id ?? ''));
    setAssignNote(existing?.note || '');
    setAssignError('');
  };

  const handleConfirmAssign = async () => {
    if (!assignRow || !assignDriverId) return;
    setAssignLoading(true);
    setAssignError('');
    try {
      const driver     = employees.find(e => e.id === assignDriverId);
      const driverName = driver?.name || assignDriverId;
      const now        = nowVN();
      const existing   = assignTaskType === 'pickup' ? assignRow.pickupAssignment : assignRow.dropoffAssignment;

      if (existing) {
        await transportService.updateDriverAssignment(existing.id, {
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
        await transportService.addDriverAssignment({
          taskType: assignTaskType,
          tripId: assignRow.tripId,
          seatId: assignRow.primarySeatId,
          seatIds: assignRow.seatIds,
          tripRoute: assignRow.tripRoute,
          tripDate: assignRow.tripDate,
          tripTime: assignRow.tripTime,
          licensePlate: assignRow.licensePlate,
          customerName: assignRow.customerName,
          customerPhone: assignRow.customerPhone,
          adults: assignRow.adults,
          children: assignRow.children,
          pickupAddress:  assignTaskType === 'pickup'  ? assignRow.pickupAddress  : undefined,
          dropoffAddress: assignTaskType === 'dropoff' ? assignRow.dropoffAddress : undefined,
          pickupAddressDetail:  assignTaskType === 'pickup'  ? assignRow.pickupAddressDetail  : undefined,
          dropoffAddressDetail: assignTaskType === 'dropoff' ? assignRow.dropoffAddressDetail : undefined,
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
      showToast(
        language === 'vi'
          ? `Đã phân công tài xế ${driverName} thành công.`
          : `Driver ${driverName} assigned successfully.`,
        'success',
      );
    } catch (err) {
      console.error('Failed to assign driver:', err);
      const msg = (err as Error)?.message || '';
      setAssignError(
        language === 'vi'
          ? `Lỗi khi phân công: ${msg || 'Vui lòng kiểm tra kết nối và thử lại.'}`
          : `Assignment failed: ${msg || 'Please check your connection and try again.'}`,
      );
    } finally {
      setAssignLoading(false);
    }
  };

  const handleRemoveAssignment = async (assignment: DriverAssignment) => {
    if (!window.confirm(
      language === 'vi' ? 'Hủy phân công tài xế này?' : 'Remove this driver assignment?',
    )) return;
    try {
      await transportService.deleteDriverAssignment(assignment.id);
      showToast(language === 'vi' ? 'Đã hủy phân công tài xế.' : 'Driver assignment removed.', 'success');
    } catch (err) {
      console.error('Failed to remove assignment:', err);
      showToast(
        language === 'vi'
          ? 'Lỗi khi hủy phân công. Vui lòng thử lại.'
          : 'Failed to remove assignment. Please try again.',
        'error',
      );
    }
  };

  // ── Export ─────────────────────────────────────────────────────────────────
  const handleExport = () => {
    const makeRows = (rows: BookingRow[], section: string) =>
      rows.map(r => ({
        [language === 'vi' ? 'Loại' : 'Type']: section,
        [language === 'vi' ? 'Tuyến' : 'Route']: r.tripRoute,
        [language === 'vi' ? 'Ngày' : 'Date']: formatBookingDate(r.tripDate),
        [language === 'vi' ? 'Giờ' : 'Time']: r.tripTime,
        [language === 'vi' ? 'Biển số' : 'Plate']: r.licensePlate,
        [language === 'vi' ? 'Ghế' : 'Seat']: r.seatLabels,
        [language === 'vi' ? 'Người lớn' : 'Adults']: r.adults,
        [language === 'vi' ? 'Trẻ em' : 'Children']: r.children,
        [language === 'vi' ? 'Khách hàng' : 'Customer']: r.customerName,
        [language === 'vi' ? 'SĐT' : 'Phone']: r.customerPhone,
        [t.pickup_address_col  || 'Điểm đón']: r.pickupAddress,
        [language === 'vi' ? 'Chi tiết điểm đón' : 'Pickup Detail']: r.pickupAddressDetail || '',
        [t.dropoff_address_col || 'Điểm trả']: r.dropoffAddress,
        [language === 'vi' ? 'Chi tiết điểm trả' : 'Dropoff Detail']: r.dropoffAddressDetail || '',
        [t.assigned_pickup_driver  || 'Tài xế đón']: r.pickupAssignment?.driverName  || '—',
        [t.assigned_dropoff_driver || 'Tài xế trả']: r.dropoffAssignment?.driverName || '—',
      }));

    const data = [
      ...makeRows(pickupRows,  language === 'vi' ? 'Đón' : 'Pickup'),
      ...makeRows(dropoffRows, language === 'vi' ? 'Trả' : 'Dropoff'),
    ];
    exportRowsToExcel(data, `diem-don-tra-${new Date().toISOString().slice(0, 10)}.xlsx`, 'PickupDropoff').catch(err =>
      console.error('[Excel] Export failed:', err),
    );
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
    if (status === 'completed') return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
        <CheckCircle2 size={10} />{t.assignment_completed || 'Hoàn thành'}
      </span>
    );
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
        <Clock size={10} />{t.assignment_pending || 'Chờ xác nhận'}
      </span>
    );
  };

  // ── Reusable table renderer ────────────────────────────────────────────────
  const renderTable = (rows: BookingRow[], tableType: 'pickup' | 'dropoff') => {
    const isPickup    = tableType === 'pickup';
    const addressCol  = isPickup ? (t.pickup_address_col  || 'Điểm đón')  : (t.dropoff_address_col || 'Điểm trả');
    const driverCol   = isPickup ? (t.assigned_pickup_driver  || 'Tài xế đón') : (t.assigned_dropoff_driver || 'Tài xế trả');
    const noRowsText  = isPickup ? (t.no_pickup_rows  || 'Chưa có đơn nào có điểm đón.') : (t.no_dropoff_rows || 'Chưa có đơn nào có điểm trả.');

    const page        = isPickup ? pickupPage : dropoffPage;
    const setPage     = isPickup ? setPickupPage : setDropoffPage;
    const totalPages  = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const pagedRows   = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const getAssignment = (row: BookingRow) => isPickup ? row.pickupAssignment : row.dropoffAssignment;

    return (
      <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {[
                  language === 'vi' ? 'Tuyến / Chuyến xe' : 'Route / Trip',
                  language === 'vi' ? 'Hành khách' : 'Passenger',
                  addressCol,
                  driverCol,
                  t.assignment_status || 'Trạng thái',
                  language === 'vi' ? 'Thao tác' : 'Actions',
                ].map((h, i) => (
                  <th key={i} className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-16 text-center text-gray-400">
                    <MapPin size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="font-medium">{noRowsText}</p>
                  </td>
                </tr>
              ) : pagedRows.map((row, idx) => {
                const assignment = getAssignment(row);
                const isEditing  = editingRow?.tripId === row.tripId && editingRow?.primarySeatId === row.primarySeatId;
                return (
                  <tr key={`${tableType}-${row.tripId}-${row.primarySeatId}-${idx}`} className="hover:bg-gray-50 transition-colors">
                    {/* Trip info */}
                    <td className="px-5 py-4">
                      <p className="font-bold text-gray-800">{row.tripRoute}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatBookingDate(row.tripDate)}{row.tripTime && ` • ${row.tripTime}`}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Bus size={11} className="text-gray-400" />
                        <span className="text-[10px] text-gray-400">{row.licensePlate}</span>
                        <span className="text-[10px] text-gray-300">• {language === 'vi' ? 'Ghế' : 'Seat'} {row.seatLabels}</span>
                      </div>
                    </td>

                    {/* Passenger / booking info */}
                    <td className="px-5 py-4">
                      <p className="font-semibold text-gray-800">{row.customerName || '—'}</p>
                      <p className="text-xs text-gray-400">{row.customerPhone || ''}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {row.adults}{language === 'vi' ? ' NL' : ' adult(s)'}
                        {row.children > 0 && <>, {row.children}{language === 'vi' ? ' TE' : ' child(ren)'}</>}
                      </p>
                    </td>

                    {/* Address */}
                    <td className="px-5 py-4">
                      {isEditing ? (
                        <div className="space-y-1">
                          <input
                            type="text"
                            value={isPickup ? editForm.pickupAddress : editForm.dropoffAddress}
                            onChange={e => setEditForm(p =>
                              isPickup
                                ? { ...p, pickupAddress: e.target.value }
                                : { ...p, dropoffAddress: e.target.value }
                            )}
                            className="w-full px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                            placeholder={addressCol}
                          />
                          <input
                            type="text"
                            value={isPickup ? editForm.pickupAddressDetail : editForm.dropoffAddressDetail}
                            onChange={e => setEditForm(p =>
                              isPickup
                                ? { ...p, pickupAddressDetail: e.target.value }
                                : { ...p, dropoffAddressDetail: e.target.value }
                            )}
                            className="w-full px-3 py-1 bg-white border border-blue-100 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-200"
                            placeholder={language === 'vi' ? 'Chi tiết (số nhà...)' : 'Detail (house no.)'}
                          />
                        </div>
                      ) : (
                        <div>
                          {(isPickup ? row.pickupAddressDetail : row.dropoffAddressDetail) && (
                            <p className="text-[11px] text-gray-400 mb-0.5">{isPickup ? row.pickupAddressDetail : row.dropoffAddressDetail}</p>
                          )}
                          <span className={cn('text-sm', (isPickup ? row.pickupAddress : row.dropoffAddress) ? 'text-gray-700' : 'text-gray-300')}>
                            {(isPickup ? row.pickupAddress : row.dropoffAddress) || '—'}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Assigned driver */}
                    <td className="px-5 py-4">
                      {assignment ? (
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{assignment.driverName}</p>
                          {assignment.note && <p className="text-[10px] text-gray-400 truncate max-w-[120px]">{assignment.note}</p>}
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      {assignment ? (
                        <div className="space-y-1">
                          <StatusBadge status={assignment.status} />
                          {assignment.rejectionReason && (
                            <p className="text-[10px] text-red-500 max-w-[140px] truncate">{assignment.rejectionReason}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        {isEditing ? (
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
                            <button
                              onClick={() => handleOpenAssign(row, tableType)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title={isPickup ? (t.assign_pickup_driver || 'Phân công tài xế đi đón') : (t.assign_dropoff_driver || 'Phân công tài xế đi trả')}
                            >
                              <UserPlus size={15} />
                            </button>
                            {assignment && (
                              <button onClick={() => handleRemoveAssignment(assignment)} className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" title={language === 'vi' ? 'Hủy phân công' : 'Remove assignment'}>
                                <XCircle size={15} />
                              </button>
                            )}
                            {isAdmin && (
                            <button onClick={() => handleDeleteRow(row)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title={language === 'vi' ? 'Xóa' : 'Delete'}>
                              <Trash2 size={15} />
                            </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {rows.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 text-xs text-gray-500">
            <span>
              {language === 'vi'
                ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, rows.length)} / ${rows.length}`
                : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, rows.length)} of ${rows.length}`}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-2 font-bold">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const hasActiveFilters = filterRoute || filterPlate || filterEmployee || dateFilter || statusFilter !== 'all';

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
          { label: language === 'vi' ? 'Tổng mục' : 'Total', value: filteredRows.length, icon: MapPin, color: 'text-blue-600 bg-blue-50' },
          { label: language === 'vi' ? 'Có tài xế đón/trả' : 'With assignment', value: filteredRows.filter(r => !!r.pickupAssignment || !!r.dropoffAssignment).length, icon: UserPlus, color: 'text-green-600 bg-green-50' },
          { label: language === 'vi' ? 'Chưa phân công' : 'Unassigned', value: filteredRows.filter(r => !r.pickupAssignment && !r.dropoffAssignment).length, icon: Clock, color: 'text-amber-600 bg-amber-50' },
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

      {/* ── Shared filters ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Route combo-box */}
          <ComboBox
            id="filter-route"
            placeholder={t.filter_by_trip || 'Tìm theo chuyến'}
            value={filterRoute}
            onChange={setFilterRoute}
            options={routeOptions}
          />
          {/* Plate combo-box */}
          <ComboBox
            id="filter-plate"
            placeholder={t.filter_by_vehicle || 'Tìm theo xe'}
            value={filterPlate}
            onChange={setFilterPlate}
            options={plateOptions}
          />
          {/* Employee/driver combo-box */}
          <ComboBox
            id="filter-employee"
            placeholder={t.filter_by_employee || 'Tìm theo nhân viên'}
            value={filterEmployee}
            onChange={setFilterEmployee}
            options={employeeNames}
          />
          {/* Date */}
          <input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none"
          />
          {/* More filters toggle */}
          <button
            onClick={() => setShowFilters(p => !p)}
            className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all', showFilters ? 'bg-daiichi-red text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
          >
            <Filter size={14} />
            {language === 'vi' ? 'Lọc' : 'Filter'}
          </button>
          {/* Clear */}
          {hasActiveFilters && (
            <button
              onClick={() => { setFilterRoute(''); setFilterPlate(''); setFilterEmployee(''); setDateFilter(''); setStatusFilter('all'); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-red-50 text-red-500 hover:bg-red-100 transition-all"
            >
              <X size={14} />{language === 'vi' ? 'Xóa lọc' : 'Clear'}
            </button>
          )}
        </div>
        {showFilters && (
          <div className="flex gap-2 flex-wrap pt-1 border-t border-gray-100">
            {([
              { id: 'all',        label: language === 'vi' ? 'Tất cả' : 'All' },
              { id: 'assigned',   label: language === 'vi' ? 'Đã phân công' : 'Assigned' },
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

      {/* ── Pickup table ───────────────────────────────────────────────────── */}
      <div>
        <h3 className="flex items-center gap-2 text-base font-bold text-gray-700 mb-3">
          <ArrowDownCircle size={18} className="text-green-600" />
          {t.pickup_section_title || 'Danh sách Điểm đón'}
          <span className="ml-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-bold">{pickupRows.length}</span>
        </h3>
        {renderTable(pickupRows, 'pickup')}
      </div>

      {/* ── Dropoff table ──────────────────────────────────────────────────── */}
      <div>
        <h3 className="flex items-center gap-2 text-base font-bold text-gray-700 mb-3">
          <ArrowUpCircle size={18} className="text-red-500" />
          {t.dropoff_section_title || 'Danh sách Điểm trả'}
          <span className="ml-1 px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-xs font-bold">{dropoffRows.length}</span>
        </h3>
        {renderTable(dropoffRows, 'dropoff')}
      </div>

      {/* ── Assign Driver Modal ────────────────────────────────────────────── */}
      <AnimatePresence>
        {assignRow && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[32px] p-8 max-w-lg w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Truck size={18} className="text-daiichi-red" />
                  {assignTaskType === 'pickup'
                    ? (t.assign_pickup_modal_title || 'Phân công tài xế – Đi đón')
                    : (t.assign_dropoff_modal_title || 'Phân công tài xế – Đi trả')}
                </h3>
                <button onClick={() => setAssignRow(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                  <X size={18} />
                </button>
              </div>

              {/* Task type indicator */}
              <div className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold',
                assignTaskType === 'pickup' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600',
              )}>
                {assignTaskType === 'pickup'
                  ? <><ArrowDownCircle size={13} />{language === 'vi' ? 'Nhiệm vụ: Đi đón khách' : 'Task: Pickup passenger'}</>
                  : <><ArrowUpCircle size={13} />{language === 'vi' ? 'Nhiệm vụ: Đi trả khách' : 'Task: Dropoff passenger'}</>
                }
              </div>

              {/* Task summary */}
              <div className="bg-gray-50 rounded-2xl p-4 space-y-1.5 text-sm">
                <div className="flex gap-2"><span className="text-gray-400 w-20 shrink-0">{language === 'vi' ? 'Tuyến:' : 'Route:'}</span><span className="font-semibold">{assignRow.tripRoute}</span></div>
                <div className="flex gap-2"><span className="text-gray-400 w-20 shrink-0">{language === 'vi' ? 'Ngày/Giờ:' : 'Date/Time:'}</span><span>{formatBookingDate(assignRow.tripDate)} {assignRow.tripTime}</span></div>
                <div className="flex gap-2"><span className="text-gray-400 w-20 shrink-0">{language === 'vi' ? 'Khách:' : 'Customer:'}</span><span>{assignRow.customerName} {assignRow.customerPhone}</span></div>
                <div className="flex gap-2">
                  <span className="text-gray-400 w-20 shrink-0">{language === 'vi' ? 'Số khách:' : 'Pax:'}</span>
                  <span>
                    {assignRow.adults}{language === 'vi' ? ' người lớn' : ' adult(s)'}
                    {assignRow.children > 0 && <>, {assignRow.children}{language === 'vi' ? ' trẻ em' : ' child(ren)'}</>}
                  </span>
                </div>
                {assignTaskType === 'pickup' && assignRow.pickupAddress && (
                  <div className="flex gap-2"><span className="text-gray-400 w-20 shrink-0">{t.pickup_address_col || 'Điểm đón'}:</span><span className="text-green-700">{assignRow.pickupAddress}</span></div>
                )}
                {assignTaskType === 'dropoff' && assignRow.dropoffAddress && (
                  <div className="flex gap-2"><span className="text-gray-400 w-20 shrink-0">{t.dropoff_address_col || 'Điểm trả'}:</span><span className="text-red-600">{assignRow.dropoffAddress}</span></div>
                )}
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

              {/* Error */}
              {assignError && (
                <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{assignError}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-1">
                <button onClick={() => { setAssignRow(null); setAssignError(''); }} className="px-5 py-2.5 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors">
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
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};
