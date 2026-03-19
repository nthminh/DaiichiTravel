import * as XLSX from 'xlsx';
import { Route, SeatStatus } from '../types';

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

// --- Public export functions ---

export const exportTripToExcel = (trip: any, bookings: any[], routes: Route[]) => {
  const bookedSeats = (trip.seats || []).filter((s: any) => s.status !== SeatStatus.EMPTY);
  const routeData = routes.find(r => r.name === trip.route);
  const seatTicketCodeMap = buildSeatTicketCodeMap(trip.id, bookings);
  const passengerGroups = buildPassengerGroups(trip.id, bookedSeats, bookings);
  const headerRows = [
    ['DANH SÁCH HÀNH KHÁCH - TRIP DETAIL'],
    [`Số xe: ${trip.licensePlate || '—'}`],
    [`Tài xế: ${trip.driverName || '—'}`],
    [`Tuyến: ${trip.route || '—'}${routeData ? ` (${routeData.departurePoint} → ${routeData.arrivalPoint})` : ''}`],
    [`Ngày giờ chạy: ${formatTripDisplayTime(trip)}`],
    [`Trạng thái: ${trip.status}`],
    [],
    ['STT', 'Mã vé', 'Số ghế', 'Tên khách hàng', 'Số điện thoại', 'Điểm đón', 'Điểm trả', 'Trạng thái', 'Giá vé (đ)', 'Ghi chú'],
  ];
  const dataRows = passengerGroups.map((g, idx) => {
    const primarySeat = g.seats[0];
    const seatIds = g.seats.map((s: any) => s.id).join(', ');
    const ticketCode = g.booking?.ticketCode || seatTicketCodeMap.get(primarySeat.id) || '—';
    const allPaid = g.seats.every((s: any) => s.status === SeatStatus.PAID);
    const totalAmount = g.booking?.amount ?? (trip.price || 0) * g.seats.length;
    return [
      idx + 1,
      ticketCode,
      seatIds,
      primarySeat.customerName || '—',
      primarySeat.customerPhone || '—',
      primarySeat.pickupAddress || '—',
      primarySeat.dropoffAddress || '—',
      allPaid ? 'Đã thanh toán' : 'Đã đặt',
      totalAmount.toLocaleString(),
      primarySeat.bookingNote || '',
    ];
  });
  const totalRevenue = passengerGroups.reduce((sum, g) => sum + (g.booking?.amount ?? (trip.price || 0) * g.seats.length), 0);
  const summaryRows = [
    [],
    [`Tổng số đặt chỗ: ${passengerGroups.length} (${bookedSeats.length} ghế)`],
    [`Tổng doanh thu dự kiến: ${totalRevenue.toLocaleString()}đ`],
  ];
  const allRows = [...headerRows, ...dataRows, ...summaryRows];
  const worksheet = XLSX.utils.aoa_to_sheet(allRows);
  worksheet['!cols'] = [
    { wch: 5 }, { wch: 14 }, { wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 30 }
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh sách khách');

  // Build addon → users map for the "Dịch vụ" sheet
  const addonUsersMap = buildAddonUsersMap(trip, passengerGroups);
  const addonHeaderRows = [
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
  const addonWorksheet = XLSX.utils.aoa_to_sheet([...addonHeaderRows, ...addonDataRows]);
  addonWorksheet['!cols'] = [
    { wch: 5 }, { wch: 25 }, { wch: 15 }, { wch: 14 }, { wch: 10 }, { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 10 }
  ];
  XLSX.utils.book_append_sheet(workbook, addonWorksheet, 'Dịch vụ');

  const sanitizedPlate = (trip.licensePlate || 'xe').replace(/[^a-zA-Z0-9]/g, '_');
  const formattedDate = (trip.date || 'nodate').replace(/-/g, '');
  const formattedTime = (trip.time || 'notime').replace(/:/g, '');
  const filename = `Chuyen_${sanitizedPlate}_${formattedDate}_${formattedTime}.xlsx`;
  XLSX.writeFile(workbook, filename);
};

export const exportTripToPDF = (trip: any, bookings: any[], routes: Route[]) => {
  const bookedSeats = (trip.seats || []).filter((s: any) => s.status !== SeatStatus.EMPTY);
  const routeData = routes.find(r => r.name === trip.route);
  const seatTicketCodeMap = buildSeatTicketCodeMap(trip.id, bookings);
  const passengerGroups = buildPassengerGroups(trip.id, bookedSeats, bookings);
  const totalRevenue = passengerGroups.reduce((sum, g) => sum + (g.booking?.amount ?? (trip.price || 0) * g.seats.length), 0);

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
        <th>STT</th><th>Mã vé</th><th>Số ghế</th><th>Tên khách</th><th>Số điện thoại</th><th>Điểm đón</th><th>Điểm trả</th><th>Trạng thái</th><th>Giá vé</th><th>Ghi chú</th>
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
        return `
        <tr${isGroup ? ' class="group-row"' : ''}>
          <td>${i + 1}</td>
          <td>${escapeHtml(ticketCode)}</td>
          <td>${escapeHtml(seatIds)}${isGroup ? ' 👥' : ''}</td>
          <td>${escapeHtml(primarySeat.customerName) || '—'}</td>
          <td>${escapeHtml(primarySeat.customerPhone) || '—'}</td>
          <td>${escapeHtml(primarySeat.pickupAddress) || '—'}</td>
          <td>${escapeHtml(primarySeat.dropoffAddress) || '—'}</td>
          <td>${allPaid ? 'Đã TT' : 'Đã đặt'}</td>
          <td>${totalAmount.toLocaleString()}đ</td>
          <td>${escapeHtml(primarySeat.bookingNote) || ''}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
  <div class="summary">
    <p>Tổng đặt chỗ: ${passengerGroups.length} (${bookedSeats.length} ghế) | Doanh thu dự kiến: ${totalRevenue.toLocaleString()}đ</p>
  </div>
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

export const exportRouteToPDF = (route: Route) => {
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

  const stopsRows = (route.routeStops || [])
    .slice().sort((a, b) => a.order - b.order)
    .map((s, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${s.order}</td>
          <td>${escapeHtml(s.stopName)}</td>
        </tr>`).join('');

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
