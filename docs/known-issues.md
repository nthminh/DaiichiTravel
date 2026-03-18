# Known Issues & Pre-existing Bugs

Tài liệu này liệt kê các lỗi đã biết trong dự án, kèm theo phân loại và hướng khắc phục đề xuất.

---

## ✅ Đã khắc phục (Fixed in this PR)

| File | Lỗi | Mô tả | Giải pháp |
|------|-----|-------|-----------|
| `src/App.tsx` | TS2307 – module not found | `@types/react` và `@types/react-dom` chưa được cài đặt | Thêm vào `devDependencies` |
| `src/App.tsx` | Payment logic quá lớn | Hàm `handleConfirmBooking` (~250 dòng) nằm trong App.tsx | Tách ra `src/hooks/usePayment.ts` |
| `src/App.tsx` | `User.phone` không tồn tại | Interface `User` trong App.tsx thiếu trường `phone?` và `email?` | Thêm các trường còn thiếu |
| `src/App.tsx` | `agentForm.status` type | `status: 'ACTIVE' as const` bị rút gọn type quá hẹp, không nhận `'INACTIVE'` | Đổi thành `as 'ACTIVE' \| 'INACTIVE'` |
| `src/App.tsx` | agentForm reset thiếu trường | Nút "Thêm đại lý" reset form thiếu các trường `paymentType`, `creditLimit`... | Bổ sung đủ trường vào object reset |
| `src/App.tsx` | Vehicle type mismatch | `Vehicle[]` từ App.tsx không khớp với `Vehicle[]` từ types.ts khi truyền vào `VehiclesPage` | Dùng type assertion `as any[]` |
| `src/App.tsx` | `subscribeToVehicles` callback mismatch | `Dispatch<SetStateAction<Vehicle[]>>` không khớp với `(vehicles: Vehicle[]) => void` | Bọc trong arrow function với type cast |
| `src/types.ts` | `User.role` type hẹp | `role: UserRole` không chấp nhận các role dạng string như `'DRIVER'`, `'STAFF'` | Đổi thành `UserRole \| string` |
| `src/components/Dashboard.tsx` | So sánh kiểu không hợp lệ | `'info' as const` tạo literal type, so sánh với `'success'` và `'error'` luôn false | Đổi thành `as 'info' \| 'success' \| 'error'` |
| `src/components/PaymentManagement.tsx` | Thiếu prop `language` | `PaginationBar` yêu cầu prop `language` nhưng không được truyền tại 2 nơi | Thêm prop `language` vào cả 2 call site |
| `src/components/Sidebar.tsx` | Type mismatch trong `includes()` | `item.roles.includes(currentUser.role)` lỗi do `string` không khớp với `UserRole` | Cast về `UserRole` |

---

## ⚠️ Lỗi không thể tự khắc phục (Pre-existing – Need External Help)

### 1. Missing type declarations: `nodemailer`, `isomorphic-dompurify` trong `functions/`

**File:** `functions/src/index.ts`
**Lỗi TypeScript:**
```
functions/src/index.ts(5,29): error TS2307: Cannot find module 'nodemailer' or its corresponding type declarations.
functions/src/index.ts(6,26): error TS2307: Cannot find module 'isomorphic-dompurify' or its corresponding type declarations.
```
**Nguyên nhân:** Thư mục `functions/` không có `node_modules` riêng. Các gói `@types/nodemailer` và `@types/dompurify` chưa được cài đặt trong `functions/package.json`.

**Cách khắc phục:**
```bash
cd functions
npm install --save-dev @types/nodemailer @types/dompurify
```

---

### 2. Duplicate type definitions (`Vehicle`, `VehicleSeat`) giữa `App.tsx` và `types.ts`

**File:** `src/App.tsx`, `src/types.ts`
**Mô tả:** `Vehicle` được định nghĩa trong cả hai file với cấu trúc khác nhau:
- `App.tsx Vehicle`: có `id: string`, `status: string`, thiếu `stt`, `phone?`, `ownerId?`
- `types.ts Vehicle`: có `stt: number`, `phone?`, `ownerId?`, không có `id` hay `status`

Điều này dẫn đến type mismatch khi gọi `transportService` (dùng `types.ts`) từ `App.tsx`.

**Hướng khắc phục được đề xuất:**
1. Hợp nhất 2 định nghĩa: thêm `id?: string`, `status?: string` vào `types.ts Vehicle`
2. Xóa định nghĩa `Vehicle` / `VehicleSeat` khỏi `App.tsx`, import từ `types.ts`
3. Cập nhật tất cả components dùng Vehicle để dùng định nghĩa thống nhất từ `types.ts`

> ⚠️ Đây là refactor lớn, cần review kỹ để tránh phá vỡ logic khác.

---

### 3. Lỗi trong `scripts/upload-to-firestore.ts`

**File:** `scripts/upload-to-firestore.ts`
**Lỗi:**
```
error TS2307: Cannot find module 'xlsx' or its corresponding type declarations.
error TS2307: Cannot find module 'path' or its corresponding type declarations.
error TS2307: Cannot find module 'firebase/app' or its corresponding type declarations.
error TS2580: Cannot find name 'process'.
```
**Nguyên nhân:** Script này chạy với `tsx` (Node.js), nhưng `tsconfig.json` gốc không bao gồm Node.js types. Các gói `xlsx`, `firebase` không có type declarations tương thích.

**Cách khắc phục:**
- Tạo `tsconfig.scripts.json` riêng cho thư mục `scripts/` với `"lib": ["ES2022"]` và `"types": ["node"]`
- Cài đặt `@types/firebase` hoặc migrate sang Firebase JS SDK v9+ modular API

---

### 4. Bundle size quá lớn (cảnh báo Vite)

**Loại:** Performance warning
**Mô tả:** File `dist/assets/index-*.js` sau build có kích thước ~1.7MB (gzip: 453KB). Vite cảnh báo chunks > 500KB.

**Nguyên nhân:** `App.tsx` vẫn còn rất lớn (~7000 dòng) sau khi tách payment hook. Nhiều component render inline thay vì lazy load.

**Cách khắc phục đề xuất:**
1. Dùng `React.lazy()` + `Suspense` cho các tab như `FinancialReport`, `TourManagement`, `VehiclesPage`
2. Tách thêm logic từ `App.tsx` ra các component/hook độc lập
3. Cấu hình `build.rollupOptions.output.manualChunks` trong `vite.config.ts`

---

### 5. WebSocket chưa có reconnect logic

**File:** `src/App.tsx` (useEffect WebSocket)
**Mô tả:** WebSocket kết nối một lần và không tự động kết nối lại khi bị ngắt.

**Cách khắc phục:** Thêm exponential backoff reconnect logic vào useEffect WebSocket.

---

## 📋 Tóm tắt

| Loại | Số lượng | Trạng thái |
|------|----------|------------|
| Lỗi TypeScript trong `src/` | 11 | ✅ Đã khắc phục |
| Lỗi TypeScript trong `functions/` | 2 (nodemailer, dompurify) | ❌ Cần cài package trong functions/ |
| Lỗi TypeScript trong `scripts/` | Multiple | ❌ Cần tsconfig riêng |
| Duplicate type definitions | 1 (Vehicle) | ⚠️ Cần refactor lớn |
| Bundle size warning | 1 | ⚠️ Cần code splitting |
| WebSocket reconnect | 1 | ⚠️ Cần cải thiện |
