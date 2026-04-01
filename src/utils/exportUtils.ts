import { Route, RouteFare, SeatStatus } from '../types';
import { getSegmentInfo } from '../lib/segmentUtils';

const COMPANY_LOGO_URL =
  'https://firebasestorage.googleapis.com/v0/b/daiichitravel-f49fd.firebasestorage.app/o/daiichilogo.png?alt=media&token=bcc9d130-5370-42e2-b0f6-d0b4a3b32724';

// --- Private helpers ---

const formatTripDisplayTime = (trip: { time: string; date?: string }) =>
  trip.date ? `${trip.date} ${trip.time}` : trip.time;

const escapeHtml = (str: unknown): string => {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};

const addonTypeLabel = (type: string) =>
  type === 'SIGHTSEEING' ? 'Tham quan' : type === 'TRANSPORT' ? 'Di chuyển' : type === 'FOOD' ? 'Ăn uống' : 'Khác';

const buildSeatTicketCodeMap = (tripId: string, bookings: any[]): Map<string, string> => {
  const map = new Map<string, string>();
  for (const bk of bookings) {
    if (bk.tripId !== tripId) continue;
    if (bk.ticketCode) {
      if (bk.seatId) map.set(bk.seatId, bk.ticketCode);
      if (bk.seatIds) {
        for (const sid of bk.seatIds) map.set(sid, bk.ticketCode);
      }
    }
  }
  return map;
};

const buildPassengerGroups = (
  tripId: string,
  bookedSeats: any[],
  bookings: any[],
): { booking: any; seats: any[] }[] => {
  const seatToBookingMap = new Map<string, any>();
  for (const bk of bookings) {
    if (bk.tripId !== tripId) continue;
    if (bk.seatId) seatToBookingMap.set(bk.seatId, bk);
    if (bk.seatIds) { for (const sid of bk.seatIds) seatToBookingMap.set(sid, bk); }
  }
  const groupMap = new Map<string, { booking: any; seats: any[] }>();
  for (const seat of bookedSeats) {
    const bk = seatToBookingMap.get(seat.id);
    const key = bk?.id || bk?.ticketCode || `__${seat.id}`;
    if (!groupMap.has(key)) groupMap.set(key, { booking: bk, seats: [] });
    groupMap.get(key)!.seats.push(seat);
  }
  return [...groupMap.values()];
};

const buildAddonUsersMap = (trip: any, passengerGroups: { booking: any; seats: any[] }[]) => {
  const map = new Map<string, { name: string; price: number; type: string; description?: string; users: { name: string; phone: string; seats: string; quantity: number }[] }>();
  for (const addon of (trip.addons || [])) {
    map.set(addon.id, { name: addon.name, price: addon.price, type: addon.type, description: addon.description, users: [] });
  }
  for (const g of passengerGroups) {
    const selectedAddons: { id: string; name: string; price: number; quantity?: number }[] = g.booking?.selectedAddons || [];
    const primarySeat = g.seats[0];
    const seatIds = g.seats.map((s: any) => s.id).join(', ');
    for (const sa of selectedAddons) {
      if (!map.has(sa.id)) {
        map.set(sa.id, { name: sa.name, price: sa.price, type: '—', users: [] });
      }
      map.get(sa.id)!.users.push({
        name: primarySeat.customerName || '—',
        phone: primarySeat.customerPhone || '—',
        seats: seatIds,
        quantity: sa.quantity || 1,
      });
    }
  }
  return map;
};

// Returns the display text for pickup/dropoff columns.
// If explicit address fields are present, they are used.
// For partial-segment bookings (fromStopOrder/toStopOrder defined), the stop name is used as fallback.
const getPickupDisplay = (seat: any): string =>
  [seat.pickupAddressDetail, seat.pickupAddress, seat.pickupStopAddress].filter(Boolean).join(' & ')
  || (seat.fromStopOrder != null ? seat.pickupPoint || '' : '');

const getDropoffDisplay = (seat: any): string =>
  [seat.dropoffAddressDetail, seat.dropoffAddress, seat.dropoffStopAddress].filter(Boolean).join(' & ')
  || (seat.toStopOrder != null ? seat.dropoffPoint || '' : '');

/**
 * Returns the route-segment label for a partial-route passenger.
 * e.g. "Đà Lạt → HCM" or "Trạm 2 → Trạm 4".
 * Returns empty string for full-route passengers (no stop-order info).
 */
const buildSegmentLabel = (seat: any, stopNameByOrder: Record<number, string>): string => {
  if (seat.segmentBookings && (seat.segmentBookings as any[]).length > 0) {
    return `${(seat.segmentBookings as any[]).length} chặng`;
  }
  const fromOrder = seat.fromStopOrder as number | undefined;
  const toOrder = seat.toStopOrder as number | undefined;
  if (fromOrder == null && toOrder == null) return '';
  const fromName: string = seat.pickupPoint || (fromOrder ? stopNameByOrder[fromOrder] || `Trạm ${fromOrder}` : '');
  const toName: string = seat.dropoffPoint || (toOrder ? stopNameByOrder[toOrder] || `Trạm ${toOrder}` : '');
  if (!fromName && !toName) return '';
  return `${fromName} → ${toName}`;
};

// --- Public export functions ---

// --- Excel download helper ---

/**
 * Trigger a browser download of an Excel workbook buffer.
 */
const downloadExcelBuffer = (buffer: ArrayBuffer | Buffer, filename: string): void => {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * Export a trip's passenger manifest to Excel (client-side, using ExcelJS).
 *
 * Produces a two-sheet workbook:
 *   Sheet 1 – "Danh sách khách" : passenger manifest
 *   Sheet 2 – "Dịch vụ"         : add-on services
 */
export const exportTripToExcel = async (trip: any, bookings: any[], routes: any[]): Promise<void> => {
  const { default: ExcelJS } = await import('exceljs');
  const routeData: any = routes.find((r: any) => r.name === trip.route) || null;

  const bookedSeats = (trip.seats || []).filter((s: any) => s.status !== SeatStatus.EMPTY);
  const sortedRouteStops = ((routeData?.routeStops || []) as any[]).slice().sort((a: any, b: any) => a.order - b.order);
  const totalStops = sortedRouteStops.length;
  const stopNameByOrder: Record<number, string> = {};
  for (const stop of sortedRouteStops) {
    stopNameByOrder[stop.order] = stop.stopName;
  }

  const passengerGroups = buildPassengerGroups(trip.id, bookedSeats, bookings);

  const workbook = new ExcelJS.Workbook();

  // --- Sheet 1: Passenger list ---
  const ws = workbook.addWorksheet('Danh sách khách');
  ws.columns = [
    { width: 5 }, { width: 14 }, { width: 12 }, { width: 25 }, { width: 15 },
    { width: 35 }, { width: 35 }, { width: 30 }, { width: 15 }, { width: 15 }, { width: 30 },
  ];

  const headerRows: (string | number)[][] = [
    ['DANH SÁCH HÀNH KHÁCH - TRIP DETAIL'],
    [`Số xe: ${trip.licensePlate || '—'}`],
    [`Tài xế: ${trip.driverName || '—'}`],
    [`Tuyến: ${trip.route || '—'}${routeData ? ` (${routeData.departurePoint} → ${routeData.arrivalPoint})` : ''}`],
    [`Ngày giờ chạy: ${formatTripDisplayTime(trip)}`],
    [`Trạng thái: ${trip.status || '—'}`],
    [],
    ['STT', 'Mã vé', 'Số ghế', 'Tên khách hàng', 'Số điện thoại', 'Điểm đón', 'Điểm trả', 'Loại chặng', 'Trạng thái', 'Giá vé (đ)', 'Ghi chú'],
  ];

  const dataRows = passengerGroups.map((g, idx) => {
    const primarySeat = g.seats[0];
    const seatIds = g.seats.map((s: any) => s.id).join(', ');
    const ticketCode = g.booking?.ticketCode || '—';
    const allPaid = g.seats.every((s: any) => s.status === SeatStatus.PAID);
    const totalAmount: number = g.booking?.amount ?? (trip.price || 0) * g.seats.length;
    const segInfo = getSegmentInfo(primarySeat, totalStops, stopNameByOrder, 'vi');
    return [
      idx + 1,
      ticketCode,
      seatIds,
      primarySeat?.customerName || '—',
      primarySeat?.customerPhone || '—',
      getPickupDisplay(primarySeat) || '—',
      getDropoffDisplay(primarySeat) || '—',
      segInfo.label,
      allPaid ? 'Đã thanh toán' : 'Đã đặt',
      totalAmount.toLocaleString(),
      primarySeat?.bookingNote || '',
    ];
  });

  const totalRevenue = passengerGroups.reduce(
    (sum, g) => sum + (g.booking?.amount ?? (trip.price || 0) * g.seats.length),
    0,
  );
  const segmentCount = passengerGroups.filter(g =>
    g.seats.some((s: any) => getSegmentInfo(s, totalStops, stopNameByOrder, 'vi').type !== 'full'),
  ).length;

  const summaryRows: (string | number)[][] = [
    [],
    [`Tổng số đặt chỗ: ${passengerGroups.length} (${bookedSeats.length} ghế)`],
    [`Nửa chặng: ${segmentCount}`],
    [`Tổng doanh thu dự kiến: ${totalRevenue.toLocaleString()}đ`],
  ];

  for (const row of [...headerRows, ...dataRows, ...summaryRows]) {
    ws.addRow(row);
  }

  // --- Sheet 2: Add-on services ---
  const addonUsersMap = buildAddonUsersMap(trip, passengerGroups);
  const addonHeaderRows: (string | number)[][] = [
    ['DANH SÁCH DỊCH VỤ BỔ SUNG'],
    [`Số xe: ${trip.licensePlate || '—'}`],
    [`Tuyến: ${trip.route || '—'}`],
    [`Ngày giờ chạy: ${formatTripDisplayTime(trip)}`],
    [],
    ['STT', 'Tên dịch vụ', 'Loại', 'Giá/người (đ)', 'Số khách', 'Tên khách hàng', 'Số điện thoại', 'Số ghế', 'Số lượng'],
  ];
  const addonDataRows: (string | number)[][] = [];
  let addonStt = 1;
  for (const [, info] of addonUsersMap) {
    if (info.users.length === 0) {
      addonDataRows.push([addonStt++, info.name, addonTypeLabel(info.type), info.price.toLocaleString(), 0, '—', '—', '—', '—']);
    } else {
      info.users.forEach((u, i) => {
        addonDataRows.push([
          i === 0 ? addonStt : '',
          i === 0 ? info.name : '',
          i === 0 ? addonTypeLabel(info.type) : '',
          i === 0 ? info.price.toLocaleString() : '',
          i === 0 ? info.users.length : '',
          u.name, u.phone, u.seats, u.quantity,
        ]);
      });
      addonStt++;
    }
  }

  const addonWs = workbook.addWorksheet('Dịch vụ');
  addonWs.columns = [
    { width: 5 }, { width: 25 }, { width: 15 }, { width: 14 }, { width: 10 },
    { width: 25 }, { width: 15 }, { width: 12 }, { width: 10 },
  ];
  for (const row of [...addonHeaderRows, ...addonDataRows]) {
    addonWs.addRow(row);
  }

  const sanitizedPlate = (trip.licensePlate || 'xe').replace(/[^a-zA-Z0-9]/g, '_');
  const formattedDate = (trip.date || 'nodate').replace(/-/g, '');
  const formattedTime = (trip.time || 'notime').replace(/:/g, '');
  const filename = `Chuyen_${sanitizedPlate}_${formattedDate}_${formattedTime}.xlsx`;

  const buffer = await workbook.xlsx.writeBuffer();
  downloadExcelBuffer(buffer, filename);
};

/**
 * Export arbitrary rows to a single-sheet Excel file (client-side, using ExcelJS).
 * Column headers are derived from the keys of the first row object.
 */
export const exportRowsToExcel = async (
  rows: Record<string, unknown>[],
  filename: string,
  sheetName?: string,
): Promise<void> => {
  if (!rows || rows.length === 0) return;
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(
    sheetName ? sheetName.slice(0, 31) : 'Sheet1',
  );
  const headers = Object.keys(rows[0]);
  worksheet.addRow(headers);
  for (const row of rows) {
    worksheet.addRow(
      headers.map(h => {
        const v = row[h];
        return v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : v as string | number);
      }),
    );
  }
  const safeFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  downloadExcelBuffer(buffer, safeFilename);
};

/**
 * Export a summary of multiple trips to Excel.
 * Used by the "Export all trips" button on the Operations page.
 */
export const exportAllTripsToExcel = async (trips: any[]): Promise<void> => {
  if (!trips || trips.length === 0) return;
  const rows: Record<string, unknown>[] = trips.map(trip => {
    const bookedCount = (trip.seats || []).filter((s: any) => s.status !== SeatStatus.EMPTY).length;
    const emptyCount = (trip.seats || []).filter((s: any) => s.status === SeatStatus.EMPTY).length;
    const totalSeats = (trip.seats || []).length;
    return {
      'Ngày': trip.date || '',
      'Giờ': trip.time || '',
      'Tuyến': trip.route || '',
      'Biển số xe': trip.licensePlate || '',
      'Tài xế': trip.driverName || '',
      'Đã đặt': bookedCount,
      'Còn trống': emptyCount,
      'Tổng ghế': totalSeats,
      'Trạng thái': trip.status || '',
      'Ghi chú': trip.note || '',
    };
  });
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  await exportRowsToExcel(rows, `Danh_sach_chuyen_${today}.xlsx`, 'Chuyến xe');
};

export const exportTripToPDF = (trip: any, bookings: any[], routes: Route[]) => {
  const bookedSeats = (trip.seats || []).filter((s: any) => s.status !== SeatStatus.EMPTY);
  const routeData = routes.find(r => r.name === trip.route);
  const seatTicketCodeMap = buildSeatTicketCodeMap(trip.id, bookings);
  const passengerGroups = buildPassengerGroups(trip.id, bookedSeats, bookings);
  const totalRevenue = passengerGroups.reduce((sum, g) => sum + (g.booking?.amount ?? (trip.price || 0) * g.seats.length), 0);

  // --- Segment (partial-route) passenger data ---
  const sortedRouteStops = (routeData?.routeStops || []).slice().sort((a: any, b: any) => a.order - b.order);
  const totalStops = sortedRouteStops.length;
  const stopNameByOrder: Record<number, string> = {};
  for (const stop of sortedRouteStops) stopNameByOrder[stop.order] = stop.stopName;

  // Build stop-by-stop boarding/alighting schedule from all segment passengers
  interface StopPassenger { seatId: string; name: string; phone: string; label: string; }
  interface StopInfo { stopName: string; boarding: StopPassenger[]; alighting: StopPassenger[]; }
  const stopSchedule = new Map<number, StopInfo>();
  const ensureStop = (order: number, stopName: string): StopInfo => {
    if (!stopSchedule.has(order)) stopSchedule.set(order, { stopName, boarding: [], alighting: [] });
    return stopSchedule.get(order)!;
  };

  for (const g of passengerGroups) {
    for (const seat of g.seats) {
      if (seat.segmentBookings && (seat.segmentBookings as any[]).length > 0) {
        // Multi-segment seat: each segmentBooking is a different passenger on a different sub-segment
        for (const seg of (seat.segmentBookings as any[])) {
          const fromOrder: number = seg.fromStopOrder;
          const toOrder: number = seg.toStopOrder;
          const label = `${seg.pickupPoint || stopNameByOrder[fromOrder] || `Trạm ${fromOrder}`} → ${seg.dropoffPoint || stopNameByOrder[toOrder] || `Trạm ${toOrder}`}`;
          const info: StopPassenger = { seatId: seat.id, name: seg.customerName || '—', phone: seg.customerPhone || '—', label };
          if (fromOrder > 1) ensureStop(fromOrder, stopNameByOrder[fromOrder] || seg.pickupPoint || `Trạm ${fromOrder}`).boarding.push(info);
          if (totalStops === 0 || toOrder < totalStops) ensureStop(toOrder, stopNameByOrder[toOrder] || seg.dropoffPoint || `Trạm ${toOrder}`).alighting.push(info);
        }
      } else {
        const fromOrder = seat.fromStopOrder as number | undefined;
        const toOrder = seat.toStopOrder as number | undefined;
        const label = buildSegmentLabel(seat, stopNameByOrder);
        const info: StopPassenger = { seatId: seat.id, name: seat.customerName || '—', phone: seat.customerPhone || '—', label };
        if (fromOrder != null && fromOrder > 1) ensureStop(fromOrder, stopNameByOrder[fromOrder] || seat.pickupPoint || `Trạm ${fromOrder}`).boarding.push(info);
        if (toOrder != null && totalStops > 0 && toOrder < totalStops) ensureStop(toOrder, stopNameByOrder[toOrder] || seat.dropoffPoint || `Trạm ${toOrder}`).alighting.push(info);
      }
    }
  }
  const sortedStopEntries = Array.from(stopSchedule.entries()).sort((a, b) => a[0] - b[0]);
  const segmentGroupCount = passengerGroups.filter(g => g.seats.some((s: any) => getSegmentInfo(s, totalStops, stopNameByOrder, 'vi').type !== 'full')).length;

  // Build addon → users map for the services section
  const pdfAddonMap = buildAddonUsersMap(trip, passengerGroups);
  const addonsSection = pdfAddonMap.size > 0 ? `
  <h2 style="color:#cc2222;font-size:14px;margin:20px 0 6px;border-bottom:1px solid #eee;padding-bottom:4px;">Dịch vụ bổ sung (${pdfAddonMap.size} dịch vụ)</h2>
  <table>
    <thead>
      <tr><th>STT</th><th>Tên dịch vụ</th><th>Loại</th><th>Giá/người</th><th>Tổng khách</th><th>Danh sách khách sử dụng</th></tr>
    </thead>
    <tbody>
      ${Array.from(pdfAddonMap.values()).map((info, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><b>${escapeHtml(info.name)}</b>${info.description ? `<br><span style="color:#888;font-size:11px;">${escapeHtml(info.description)}</span>` : ''}</td>
        <td>${escapeHtml(addonTypeLabel(info.type))}</td>
        <td>${info.price.toLocaleString()}đ</td>
        <td>${info.users.length > 0 ? info.users.length : '<span style="color:#999">—</span>'}</td>
        <td>${info.users.length > 0 ? info.users.map(u => `${escapeHtml(u.name)} (${escapeHtml(u.phone)}) – Ghế ${escapeHtml(u.seats)} × ${u.quantity}`).join('<br>') : '<span style="color:#999;font-style:italic;">Chưa có khách</span>'}</td>
      </tr>`).join('')}
    </tbody>
  </table>` : '';

  // Build stop-by-stop schedule section (only if there are segment passengers)
  const stopScheduleSection = sortedStopEntries.length > 0 ? `
  <h2 style="color:#1565c0;font-size:14px;margin:20px 0 6px;border-bottom:2px solid #bbdefb;padding-bottom:4px;">🚏 Lịch dừng chặng – ${sortedStopEntries.length} trạm có khách lên/xuống</h2>
  <table>
    <thead>
      <tr>
        <th style="background:#1565c0;width:55px;">Trạm</th>
        <th style="background:#1565c0;">Tên trạm</th>
        <th style="background:#2e7d32;">🟢 Khách lên xe (${sortedStopEntries.reduce((s, [, v]) => s + v.boarding.length, 0)})</th>
        <th style="background:#bf360c;">🟠 Khách xuống xe (${sortedStopEntries.reduce((s, [, v]) => s + v.alighting.length, 0)})</th>
      </tr>
    </thead>
    <tbody>
      ${sortedStopEntries.map(([order, act]) => `
      <tr>
        <td style="text-align:center;font-weight:bold;font-size:15px;">${order}</td>
        <td><b>${escapeHtml(act.stopName)}</b></td>
        <td style="color:#1b5e20;vertical-align:top;">${act.boarding.length > 0
          ? act.boarding.map(p => `<b>Ghế ${escapeHtml(p.seatId)}</b> – ${escapeHtml(p.name)} (${escapeHtml(p.phone)})${p.label ? `<br><span style="font-size:11px;color:#1565c0;">↗ ${escapeHtml(p.label)}</span>` : ''}`).join('<br><br>')
          : '<span style="color:#bbb">—</span>'
        }</td>
        <td style="color:#bf360c;vertical-align:top;">${act.alighting.length > 0
          ? act.alighting.map(p => `<b>Ghế ${escapeHtml(p.seatId)}</b> – ${escapeHtml(p.name)} (${escapeHtml(p.phone)})${p.label ? `<br><span style="font-size:11px;color:#bf360c;">↙ ${escapeHtml(p.label)}</span>` : ''}`).join('<br><br>')
          : '<span style="color:#bbb">—</span>'
        }</td>
      </tr>`).join('')}
    </tbody>
  </table>` : '';

  const htmlContent = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https://firebasestorage.googleapis.com;">
  <title>Chuyến xe ${escapeHtml(trip.licensePlate)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; font-size: 13px; }
    .page-header { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; border-bottom: 2px solid #cc2222; padding-bottom: 12px; margin-bottom: 16px; }
    .page-header img { height: 56px; width: auto; justify-self: start; }
    .page-header h1 { color: #cc2222; font-size: 18px; margin: 0; text-align: center; }
    .info { margin-bottom: 16px; color: #444; }
    .info p { margin: 2px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th { background: #cc2222; color: white; padding: 8px 10px; text-align: left; font-size: 12px; }
    td { padding: 7px 10px; border-bottom: 1px solid #eee; font-size: 12px; }
    tr:nth-child(even) { background: #f9f9f9; }
    .group-row { background: #fff8e1 !important; }
    .segment-row { background: #e3f2fd !important; }
    .badge { font-size: 10px; border-radius: 3px; padding: 2px 6px; white-space: nowrap; font-weight: bold; }
    .badge-full { color: #15803d; background: #dcfce7; }
    .badge-multi { color: #7e22ce; background: #f3e8ff; }
    .badge-partial { color: #c2410c; background: #ffedd5; }
    .summary { margin-top: 16px; font-weight: bold; color: #cc2222; }
    @media print { button { display: none; } }
  </style>
</head>
<body>
  <div class="page-header">
    <img src="${COMPANY_LOGO_URL}" alt="Daiichi Travel">
    <h1>DANH SÁCH HÀNH KHÁCH</h1>
    <div aria-hidden="true"></div>
  </div>
  <div class="info">
    <p><b>Số xe:</b> ${escapeHtml(trip.licensePlate) || '—'}</p>
    <p><b>Tài xế:</b> ${escapeHtml(trip.driverName) || '—'}</p>
    <p><b>Tuyến:</b> ${escapeHtml(trip.route) || '—'}${routeData ? ` (${escapeHtml(routeData.departurePoint)} → ${escapeHtml(routeData.arrivalPoint)})` : ''}</p>
    <p><b>Ngày giờ:</b> ${escapeHtml(formatTripDisplayTime(trip))}</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>STT</th><th>Mã vé</th><th>Số ghế</th><th>Tên khách</th><th>Số điện thoại</th><th>Điểm đón</th><th>Điểm trả</th><th>Loại chặng</th><th>Trạng thái</th><th>Giá vé</th><th>Ghi chú</th>
      </tr>
    </thead>
    <tbody>
      ${passengerGroups.map((g, i) => {
        const primarySeat = g.seats[0];
        const seatIds = g.seats.map((s: any) => s.id).join(', ');
        const ticketCode = g.booking?.ticketCode || seatTicketCodeMap.get(primarySeat.id) || '—';
        const allPaid = g.seats.every((s: any) => s.status === 'PAID');
        const totalAmount = g.booking?.amount ?? (trip.price || 0) * g.seats.length;
        const isGroup = g.seats.length > 1;
        const segInfo = getSegmentInfo(primarySeat, totalStops, stopNameByOrder, 'vi');
        const rowClass = segInfo.type !== 'full' ? 'segment-row' : (isGroup ? 'group-row' : '');
        const badgeClass = segInfo.type === 'full' ? 'badge-full' : segInfo.type === 'multi' ? 'badge-multi' : 'badge-partial';
        return `
        <tr${rowClass ? ` class="${rowClass}"` : ''}>
          <td>${i + 1}</td>
          <td>${escapeHtml(ticketCode)}</td>
          <td>${escapeHtml(seatIds)}${isGroup ? ' 👥' : ''}</td>
          <td>${escapeHtml(primarySeat.customerName) || '—'}</td>
          <td>${escapeHtml(primarySeat.customerPhone) || '—'}</td>
          <td>${escapeHtml(getPickupDisplay(primarySeat)) || '—'}</td>
          <td>${escapeHtml(getDropoffDisplay(primarySeat)) || '—'}</td>
          <td><span class="badge ${badgeClass}">${escapeHtml(segInfo.label)}</span></td>
          <td>${allPaid ? 'Đã TT' : 'Đã đặt'}</td>
          <td>${totalAmount.toLocaleString()}đ</td>
          <td>${escapeHtml(primarySeat.bookingNote) || ''}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
  <div class="summary">
    <p>Tổng đặt chỗ: ${passengerGroups.length} (${bookedSeats.length} ghế)${segmentGroupCount > 0 ? ` | <span style="color:#c2410c;">Nửa chặng: ${segmentGroupCount}</span>` : ''} | Doanh thu dự kiến: ${totalRevenue.toLocaleString()}đ</p>
  </div>
  ${stopScheduleSection}
  ${addonsSection}
</body>
</html>`;
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    // Small delay to ensure the document is fully rendered before triggering print
    setTimeout(() => { printWindow.print(); }, 500);
  }
};

export const exportRouteToPDF = (route: Route, fares: RouteFare[] = []) => {
  const periodsRows = (route.pricePeriods || []).map((p, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(p.name || '')}</td>
        <td>${p.price > 0 ? `${p.price.toLocaleString()}đ` : '—'}</td>
        <td>${(p.agentPrice || 0) > 0 ? `${(p.agentPrice || 0).toLocaleString()}đ` : '—'}</td>
        <td>${escapeHtml(p.startDate || '')}</td>
        <td>${escapeHtml(p.endDate || '')}</td>
      </tr>`).join('');

  const surchargeTypeLabel = (type: string) =>
    type === 'HOLIDAY' ? 'Lễ/Tết' : type === 'FUEL' ? 'Xăng dầu' : 'Khác';

  const surchargesRows = (route.surcharges || []).map((s, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(s.name)}</td>
        <td>${surchargeTypeLabel(s.type)}</td>
        <td>${s.amount.toLocaleString()}đ</td>
        <td>${s.isActive ? 'Đang áp dụng' : 'Tắt'}</td>
        <td>${escapeHtml(s.startDate || '')}${s.endDate ? ` → ${escapeHtml(s.endDate)}` : ''}</td>
      </tr>`).join('');

  const sortedStops = (route.routeStops || []).slice().sort((a, b) => a.order - b.order);
  const stopsRows = sortedStops
    .map((s, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${s.order}</td>
          <td>${escapeHtml(s.stopName)}</td>
        </tr>`).join('');

  // Build stop name lookup for fare table
  const stopNameById: Record<string, string> = {};
  for (const stop of sortedStops) {
    stopNameById[stop.stopId] = stop.stopName;
  }
  const activeFares = fares.filter(f => f.active !== false);
  const faresRows = activeFares
    .slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((f, i) => {
      const fromName = stopNameById[f.fromStopId] || escapeHtml(f.fromStopId);
      const toName = stopNameById[f.toStopId] || escapeHtml(f.toStopId);
      const validRange = f.startDate || f.endDate
        ? `${escapeHtml(f.startDate || '')}${f.endDate ? ` → ${escapeHtml(f.endDate)}` : ''}`
        : '—';
      return `
        <tr>
          <td>${i + 1}</td>
          <td>${fromName}</td>
          <td>${toName}</td>
          <td>${f.price > 0 ? `${f.price.toLocaleString()}đ` : '—'}</td>
          <td>${(f.agentPrice || 0) > 0 ? `${(f.agentPrice || 0).toLocaleString()}đ` : '—'}</td>
          <td>${validRange}</td>
        </tr>`;
    }).join('');

  const htmlContent = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https://firebasestorage.googleapis.com;">
  <title>Tuyến đường: ${escapeHtml(route.name)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; font-size: 13px; color: #222; }
    .page-header { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; border-bottom: 2px solid #cc2222; padding-bottom: 12px; margin-bottom: 16px; }
    .page-header img { height: 56px; width: auto; justify-self: start; }
    .page-header h1 { color: #cc2222; font-size: 20px; margin: 0; text-align: center; }
    h2 { color: #cc2222; font-size: 14px; margin: 20px 0 6px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
    .info { margin-bottom: 16px; color: #444; }
    .info p { margin: 3px 0; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: bold; }
    .badge-red { background: #fee2e2; color: #cc2222; }
    .badge-orange { background: #fff7ed; color: #d97706; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #cc2222; color: white; padding: 7px 10px; text-align: left; font-size: 12px; }
    td { padding: 6px 10px; border-bottom: 1px solid #eee; font-size: 12px; }
    tr:nth-child(even) { background: #f9f9f9; }
    .details-box { background: #f8f8f8; border: 1px solid #eee; border-radius: 8px; padding: 12px; margin-top: 8px; white-space: pre-wrap; font-size: 12px; line-height: 1.6; }
    .no-data { color: #999; font-style: italic; font-size: 12px; }
    @media print { button { display: none; } }
  </style>
</head>
<body>
  <div class="page-header">
    <img src="${COMPANY_LOGO_URL}" alt="Daiichi Travel">
    <h1>THÔNG TIN TUYẾN ĐƯỜNG</h1>
    <div aria-hidden="true"></div>
  </div>
  <div class="info">
    <p><b>STT:</b> ${route.stt}</p>
    <p><b>Tên tuyến:</b> ${escapeHtml(route.name)}</p>
    <p><b>Điểm đi:</b> ${escapeHtml(route.departurePoint || '—')}</p>
    <p><b>Điểm đến:</b> ${escapeHtml(route.arrivalPoint || '—')}</p>
    <p><b>Giá vé lẻ:</b> <span class="badge badge-red">${route.price > 0 ? `${route.price.toLocaleString()}đ` : 'Liên hệ'}</span></p>
    <p><b>Giá đại lý:</b> <span class="badge badge-orange">${(route.agentPrice || 0) > 0 ? `${(route.agentPrice || 0).toLocaleString()}đ` : '—'}</span></p>
  </div>

  ${route.details ? `
  <h2>Chi tiết tuyến đường</h2>
  <div class="details-box">${escapeHtml(route.details)}</div>` : ''}

  <h2>Kỳ giá theo mùa (${(route.pricePeriods || []).length} kỳ)</h2>
  ${(route.pricePeriods || []).length > 0 ? `
  <table>
    <thead><tr><th>STT</th><th>Tên kỳ giá</th><th>Giá lẻ</th><th>Giá đại lý</th><th>Từ ngày</th><th>Đến ngày</th></tr></thead>
    <tbody>${periodsRows}</tbody>
  </table>` : '<p class="no-data">Không có kỳ giá đặc biệt.</p>'}

  <h2>Phụ thu tuyến đường (${(route.surcharges || []).length} khoản)</h2>
  ${(route.surcharges || []).length > 0 ? `
  <table>
    <thead><tr><th>STT</th><th>Tên phụ thu</th><th>Loại</th><th>Mức phụ thu</th><th>Trạng thái</th><th>Thời gian áp dụng</th></tr></thead>
    <tbody>${surchargesRows}</tbody>
  </table>` : '<p class="no-data">Không có phụ thu.</p>'}

  <h2>Điểm dừng trên tuyến (${(route.routeStops || []).length} điểm)</h2>
  ${(route.routeStops || []).length > 0 ? `
  <table>
    <thead><tr><th>STT</th><th>Thứ tự</th><th>Tên điểm dừng</th></tr></thead>
    <tbody>${stopsRows}</tbody>
  </table>` : '<p class="no-data">Không có điểm dừng trung gian.</p>'}

  <h2>Bảng giá theo chặng (${activeFares.length} chặng)</h2>
  ${activeFares.length > 0 ? `
  <table>
    <thead><tr><th>STT</th><th>Điểm đón</th><th>Điểm trả</th><th>Giá lẻ</th><th>Giá đại lý</th><th>Hiệu lực</th></tr></thead>
    <tbody>${faresRows}</tbody>
  </table>` : '<p class="no-data">Không có bảng giá chặng.</p>'}

  ${route.note ? `
  <h2>Ghi chú</h2>
  <div class="details-box">${escapeHtml(route.note)}</div>` : ''}
</body>
</html>`;
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);
  }
};
