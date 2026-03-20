# Phân Tích & Tái Cấu Trúc App.tsx

> Báo cáo được tạo tự động – 2026-03-19

---

## 1. Tổng quan hiện trạng

`src/App.tsx` trước khi tái cấu trúc: **2 314 dòng** (~100 KB).

File này là _entry component_ của toàn bộ ứng dụng. Trong các phiên trước đó, nhiều logic lớn đã được tách ra thành hook/page riêng:

| Đã tách trước đó | Vị trí mới |
|---|---|
| Payment flow (`handleConfirmBooking`) | `src/hooks/usePayment.ts` |
| Route CRUD | `src/hooks/useRoutes.ts` |
| Trip CRUD | `src/hooks/useTrips.ts` |
| Agent CRUD | `src/pages/AgentsPage.tsx` + `src/hooks/useAgents.ts` |
| Tất cả trang (`Dashboard`, `Settings`, …) | `src/pages/` |
| Tất cả component UI | `src/components/` |

---

## 2. Phân tích những gì còn lại trong App.tsx

Sau tất cả các lần tách trước, `App.tsx` vẫn còn:

| Phần | Dòng gốc | Mô tả |
|---|---|---|
| `EmailLinkReenterForm` | 97–142 | Component nội tuyến dùng một lần cho magic-link email |
| Employee state + 3 handler | 292–828 | `handleSaveEmployee`, `handleDeleteEmployee`, `handleStartEditEmployee` |
| `buildSeatTicketCodeMap` | 920–932 | Pure function – tạo map seatId → ticketCode |
| `getBookingGroupSeatIds` | 935–938 | Pure function – tìm seat IDs trong cùng booking group |
| `buildPassengerGroups` | 941–956 | Pure function – nhóm seat theo booking |
| `handleRegisterMember` / `handleOtpMemberLogin` | ~1100–1207 | Logic đăng ký & đăng nhập member (kết hợp chặt với `customers` state) |
| `renderContent()` | 1411–2103 | Router switch tới tất cả trang (~690 dòng JSX) |
| Logic fare lookup, surcharge helpers | ~1340–1400 | Hàm helper tính giá vé |

### Đánh giá

`renderContent()` đã delegate hoàn toàn vào lazy-loaded pages nên không cần tách thêm – việc tách sẽ tạo thêm phức tạp mà không giảm đáng kể bundle size.

`handleRegisterMember` và `handleOtpMemberLogin` phụ thuộc vào `customers` state (đang được subscribe trong App), nên tách vào hook sẽ cần truyền thêm nhiều dependency – chưa đủ giá trị.

---

## 3. Những thay đổi đã thực hiện trong phiên này

### 3.1 Tách `EmailLinkReenterForm`
- **Trước**: Component inline trong App.tsx (dòng 97–142)
- **Sau**: `src/components/EmailLinkReenterForm.tsx` (file riêng)
- **Lý do**: Component độc lập, không phụ thuộc state App. Dễ test và tái sử dụng.

### 3.2 Tạo `useEmployees` hook
- **Trước**: 3 handler functions + 7 state variables nằm trong App.tsx
- **Sau**: `src/hooks/useEmployees.ts` – đồng bộ pattern `useTrips` / `useRoutes`
- **Lý do**: Tách biệt responsibility, giảm kích thước App.tsx, dễ kiểm thử.

### 3.3 Tạo `bookingUtils.ts`
- **Trước**: 3 pure functions (`buildSeatTicketCodeMap`, `getBookingGroupSeatIds`, `buildPassengerGroups`) dùng closure để đọc `bookings`
- **Sau**: `src/lib/bookingUtils.ts` – pure functions nhận `bookings` như parameter
- **Lý do**: Pure functions không nên phụ thuộc closure. Dễ unit-test. Có thể tái dùng từ pages khác mà không cần prop drilling.

### 3.4 Sửa lỗi indentation
- `case 'vehicles':` (dòng 1896 cũ) có 12 spaces indent thay vì 6
- `case 'consignments':` có `return` lệch 4 spaces thừa

---

## 4. Kết quả sau tái cấu trúc

| Chỉ số | Trước | Sau |
|---|---|---|
| Dòng App.tsx | 2 314 | ~2 198 |
| TypeScript errors (src/) | 0 | 0 |
| File mới | – | 3 file mới |
| Hook pattern | usePayment, useRoutes, useTrips | + useEmployees |

---

## 5. Khuyến nghị tiếp theo (không bắt buộc ngay)

| Ưu tiên | Hành động | Lý do |
|---|---|---|
| Thấp | Tách `handleRegisterMember` + `handleOtpMemberLogin` → `useAuth` hook | Sẽ cần truyền nhiều deps (customers, language) |
| Thấp | Tách tour booking state (~25 `useState`) → `useTourBooking` hook | Nhiều state liên quan nhau, có thể nhóm lại |
| Thấp | Tách fare lookup logic → `useFare` hook | Đã tách được fareRequestIdRef, lookupFare |

---

## 6. Kết luận

`App.tsx` **đã đủ chuẩn** để vận hành ở quy mô hiện tại. Các page và hook chính đã được tách đúng cách. Sau phiên này, 3 đơn vị code nữa đã được tách ra, giảm kết dính trong component root.

Lint TypeScript không có lỗi nào trong `src/` sau tất cả thay đổi.
