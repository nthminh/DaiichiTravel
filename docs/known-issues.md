# Known Issues & Pre-existing Bugs

Tài liệu này liệt kê các lỗi đã biết trong dự án, kèm theo phân loại và hướng khắc phục đề xuất.

---

## ⚠️ Lỗi bảo mật còn tồn tại (Security Vulnerabilities – Open)

> Cập nhật: 2026-03-19

| Package | Mức độ | CVE / Advisory | Mô tả | Hướng xử lý |
|---------|--------|----------------|-------|-------------|
| `xlsx` (SheetJS) | **HIGH** | [GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6), [GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9) | Prototype Pollution và ReDoS trong xlsx (tất cả phiên bản). **Không có bản vá.** | ① Thay thế bằng `exceljs` hoặc `xlsx-js-style` (fork có vá); ② Hoặc chuyển xuất Excel sang Cloud Function server-side để người dùng không thể khai thác client-side. |
| `@tootallnate/once` | Low | [GHSA-vpq2-c234-7xj6](https://github.com/advisories/GHSA-vpq2-c234-7xj6) | Incorrect Control Flow Scoping. Đến qua chuỗi `firebase-functions` → `firebase-admin` → `@google-cloud/storage` → `teeny-request` → `http-proxy-agent`. Chỉ ảnh hưởng `functions/` (server-side). | `npm audit fix --force` trong `functions/` sẽ cập nhật `firebase-functions` lên v4.9.0 (breaking change). Đánh giá tác động trước khi nâng cấp. |

### Rủi ro thực tế

- **xlsx**: Prototype Pollution có thể bị khai thác nếu kẻ tấn công cung cấp file Excel độc hại. Trong ứng dụng này xlsx chỉ được dùng để **xuất** (không đọc file do người dùng tải lên), nên nguy cơ bị khai thác thực tế **thấp hơn** nhưng vẫn cần theo dõi và lên kế hoạch thay thế.
- **@tootallnate/once**: Chỉ chạy trong Cloud Functions, không phải trình duyệt. Mức độ khai thác thực tế rất thấp.

---

## ✅ Tất cả đã khắc phục (All Fixed)

| File | Lỗi | Mô tả | Giải pháp |
|------|-----|-------|-----------|
| `src/App.tsx` | TS2307 – module not found | `@types/react` và `@types/react-dom` chưa được cài đặt | Thêm vào `devDependencies` |
| `src/App.tsx` | Payment logic quá lớn | Hàm `handleConfirmBooking` (~250 dòng) nằm trong App.tsx | Tách ra `src/hooks/usePayment.ts` |
| `src/App.tsx` | `User.phone` không tồn tại | Interface `User` trong App.tsx thiếu trường `phone?` và `email?` | Thêm các trường còn thiếu |
| `src/App.tsx` | `agentForm.status` type | `status: 'ACTIVE' as const` bị rút gọn type quá hẹp, không nhận `'INACTIVE'` | Đổi thành `as 'ACTIVE' \| 'INACTIVE'` |
| `src/App.tsx` | agentForm reset thiếu trường | Nút "Thêm đại lý" reset form thiếu các trường `paymentType`, `creditLimit`... | Bổ sung đủ trường vào object reset |
| `src/App.tsx` | Vehicle type mismatch | `Vehicle[]` từ App.tsx không khớp với `Vehicle[]` từ types.ts khi truyền vào `VehiclesPage` | Xóa định nghĩa `Vehicle`/`VehicleSeat` khỏi `App.tsx`, import từ `types.ts`; dùng `as any[]` tại call site `VehiclesPage` |
| `src/App.tsx` | `subscribeToVehicles` callback mismatch | `Dispatch<SetStateAction<Vehicle[]>>` không khớp với `(vehicles: Vehicle[]) => void` | Bọc trong arrow function với type cast |
| `src/types.ts` | `User.role` type hẹp | `role: UserRole` không chấp nhận các role dạng string như `'DRIVER'`, `'STAFF'` | Đổi thành `UserRole \| string` |
| `src/components/Dashboard.tsx` | So sánh kiểu không hợp lệ | `'info' as const` tạo literal type, so sánh với `'success'` và `'error'` luôn false | Đổi thành `as 'info' \| 'success' \| 'error'` |
| `src/components/PaymentManagement.tsx` | Thiếu prop `language` | `PaginationBar` yêu cầu prop `language` nhưng không được truyền tại 2 nơi | Thêm prop `language` vào cả 2 call site |
| `src/components/Sidebar.tsx` | Type mismatch trong `includes()` | `item.roles.includes(currentUser.role)` lỗi do `string` không khớp với `UserRole` | Cast về `UserRole` |
| `functions/src/index.ts` | TS2307 – nodemailer / isomorphic-dompurify | `@types/nodemailer` và `@types/dompurify` chưa có trong `functions/package.json` | Thêm vào `devDependencies` trong `functions/package.json` |
| `src/App.tsx` + `src/types.ts` | Duplicate `Vehicle` / `VehicleSeat` | Hai định nghĩa `Vehicle` khác nhau gây type mismatch | Xóa định nghĩa khỏi `App.tsx`, import từ `types.ts` |
| `scripts/upload-to-firestore.ts` | TS2307 / TS2580 | `tsconfig.json` gốc không bao gồm Node.js types | Tạo `tsconfig.scripts.json` riêng với `"types": ["node"]` |
| `src/App.tsx` | Bundle size ~1.7MB | Nhiều component render inline, không lazy load | Dùng `React.lazy()` + `manualChunks` trong `vite.config.ts`; `index` chunk giảm từ ~1.7MB → 481KB (gzip: 453KB → 114KB) |
| `src/App.tsx` | WebSocket không tự kết nối lại | Không có reconnect logic khi kết nối bị ngắt | Thêm exponential backoff reconnect vào useEffect WebSocket |
| `src/App.tsx` | `EmailLinkReenterForm` nằm inline | Component độc lập nên tách ra file riêng | Tách ra `src/components/EmailLinkReenterForm.tsx` |
| `src/App.tsx` | Employee CRUD inline | 3 handler + 7 state nằm trực tiếp trong App | Tách ra `src/hooks/useEmployees.ts` |
| `src/App.tsx` | Booking helper closures | `buildSeatTicketCodeMap`, `getBookingGroupSeatIds`, `buildPassengerGroups` dùng closure không testable | Tách ra `src/lib/bookingUtils.ts` (pure functions) |
| `src/App.tsx` | Indentation lỗi | `case 'vehicles':` và `case 'consignments':` có indent sai | Sửa về 6 spaces đúng chuẩn |

---

## 📋 Tóm tắt

| Loại | Số lượng | Trạng thái |
|------|----------|------------|
| Lỗi TypeScript trong `src/` | 11 | ✅ Đã khắc phục |
| Lỗi TypeScript trong `functions/` | 2 (nodemailer, dompurify) | ✅ Đã khắc phục |
| Lỗi TypeScript trong `scripts/` | Multiple | ✅ Đã khắc phục (`tsconfig.scripts.json`) |
| Duplicate type definitions | 1 (Vehicle) | ✅ Đã khắc phục |
| Bundle size warning | 1 | ✅ Đã khắc phục (481KB < 500KB) |
| WebSocket reconnect | 1 | ✅ Đã khắc phục (exponential backoff) |
| App.tsx refactor (phiên này) | 4 vấn đề | ✅ Đã khắc phục |
| **Lỗ hổng bảo mật `xlsx`** | 1 (HIGH) | ⚠️ Chưa có bản vá upstream – cần theo dõi |
| **Lỗ hổng `@tootallnate/once`** | 1 (Low) | ⚠️ Chỉ ảnh hưởng Cloud Functions – ưu tiên thấp |

