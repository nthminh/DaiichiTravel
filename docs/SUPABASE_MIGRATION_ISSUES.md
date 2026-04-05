# Báo cáo vấn đề sau khi chuyển sang Supabase

## Tóm tắt

Sau khi chuyển từ Firebase/Firestore sang Supabase/PostgreSQL, ứng dụng gặp một số vấn đề do sự khác biệt giữa mô hình dữ liệu linh hoạt (Firebase documents) và mô hình bảng có cấu trúc cố định (PostgreSQL). Tài liệu này ghi lại tất cả vấn đề đã tìm thấy và trạng thái xử lý.

---

## 🔴 VẤN ĐỀ NGHIÊM TRỌNG (Đã sửa)

### VẤN ĐỀ #1: Schema bảng `bookings` thiếu nhiều cột – Đặt vé thất bại hoàn toàn

**Mức độ**: NGHIÊM TRỌNG – Toàn bộ chức năng đặt vé xe và đặt tour bị lỗi  
**Trạng thái**: ✅ ĐÃ SỬA (migration `006_add_missing_booking_columns.sql`)

**Mô tả:**  
Firebase Firestore lưu tài liệu dạng key-value linh hoạt, không cần khai báo cấu trúc trước. Khi chuyển sang Supabase/PostgreSQL, migration ban đầu (`001_initial_schema.sql`) chỉ khai báo các cột cơ bản cho bảng `bookings`, bỏ sót hơn 30 cột mà frontend đang ghi vào.

Khi Supabase (PostgREST) nhận yêu cầu INSERT với tên cột không tồn tại, nó sẽ trả về lỗi `42703: column "..." does not exist`, khiến `createBooking()` ném exception và **toàn bộ đặt vé/đặt tour thất bại**.

**Các cột bị thiếu (đã thêm qua migration 006):**

| Cột | Kiểu | Dữ liệu |
|-----|------|---------|
| `phone` | TEXT | Số điện thoại khách hàng (frontend ghi `phone`, không phải `customer_phone`) |
| `email` | TEXT | Email khách hàng (đặt tour) |
| `route` | TEXT | Tên tuyến đường / tên tour |
| `date` | TEXT | Ngày khởi hành / ngày đặt tour |
| `time` | TEXT | Giờ khởi hành |
| `seat_id` | TEXT | Mã ghế đơn lẻ |
| `seat_ids` | JSONB | Danh sách tất cả mã ghế |
| `amount` | NUMERIC | Tổng tiền (frontend ghi `amount`, không phải `total_amount`) |
| `agent` | TEXT | Tên đại lý |
| `booked_by_name` | TEXT | Tên nhân viên thực hiện đặt |
| `booked_by_role` | TEXT | Vai trò nhân viên |
| `agent_commission_rate` | NUMERIC | Tỷ lệ hoa hồng đại lý |
| `agent_commission_amount` | NUMERIC | Số tiền hoa hồng |
| `agent_retail_amount` | NUMERIC | Giá bán lẻ tương ứng |
| `pickup_point` | TEXT | Điểm đón (tên trạm) |
| `dropoff_point` | TEXT | Điểm trả (tên trạm) |
| `pickup_address_detail` | TEXT | Địa chỉ chi tiết điểm đón |
| `dropoff_address_detail` | TEXT | Địa chỉ chi tiết điểm trả |
| `pickup_stop_address` | TEXT | Địa chỉ trạm đón |
| `dropoff_stop_address` | TEXT | Địa chỉ trạm trả |
| `booking_note` | TEXT | Ghi chú đặt vé |
| `free_seating` | BOOLEAN | Cho phép ngồi tự do |
| `route_surcharges` | JSONB | Danh sách phụ phí tuyến đường |
| `pickup_surcharge_amount` | NUMERIC | Phụ phí điểm đón |
| `dropoff_surcharge_amount` | NUMERIC | Phụ phí điểm trả |
| `fare_doc_id` | TEXT | ID bảng giá áp dụng |
| `fare_price_per_person` | NUMERIC | Giá/người từ bảng giá |
| `fare_retail_price_per_person` | NUMERIC | Giá lẻ/người tham chiếu |
| `payment_ref` | TEXT | Mã tham chiếu thanh toán |
| `payment_status` | TEXT | Trạng thái thanh toán |
| `is_round_trip` | BOOLEAN | Vé khứ hồi |
| `outbound_leg` | JSONB | Dữ liệu chiều đi (khứ hồi) |
| `accommodation` | TEXT | Loại chỗ ở (tour) |
| `meal_plan` | TEXT | Gói ăn (tour) |
| `nights_booked` | INT | Số đêm đặt (tour) |
| `breakfasts_booked` | INT | Số bữa sáng đặt (tour) |
| `surcharge` | NUMERIC | Phụ phí tour |
| `surcharge_note` | TEXT | Ghi chú phụ phí tour |
| `duration` | TEXT | Thời gian tour |
| `nights` | INT | Số đêm tour |
| `notes` | TEXT | Ghi chú tour |

**File đã tạo:** `supabase/migrations/006_add_missing_booking_columns.sql`

---

### VẤN ĐỀ #2: Chức năng ghép chuyến (`mergeTrips`) không cập nhật ghế trong booking

**Mức độ**: NGHIÊM TRỌNG – Ghép chuyến không tái phân công ghế  
**Trạng thái**: ✅ ĐÃ SỬA (`src/hooks/usePayment.ts`)

**Mô tả:**  
Hàm `mergeTrips()` trong `transportService.ts` đọc `booking.seats` để tái ánh xạ seat ID khi ghép chuyến:

```typescript
const updatedSeats = (booking.seats || []).map((sid: string) => seatIdRemap.get(sid) ?? sid);
await supabase.from('bookings').update({ trip_id: primaryTripId, seats: updatedSeats }).eq('id', booking.id);
```

Nhưng khi tạo booking, `usePayment.ts` chỉ ghi `seatId` và `seatIds`, không ghi vào cột `seats` (JSONB). Vì vậy `booking.seats` luôn là `null`, việc tái ánh xạ không có hiệu lực.

**Fix:** Thêm `seats: allSeatIds` vào `bookingData` trong `usePayment.ts` để cột `seats` cũng được điền dữ liệu khi tạo booking.

---

### VẤN ĐỀ #3: Đếm booking phòng tour luôn trả về 0

**Mức độ**: CAO – Hiển thị số phòng còn trống sai  
**Trạng thái**: ✅ ĐÃ SỬA (tự động sau khi thêm cột `date` qua migration 006)

**Mô tả:**  
Hàm `getTourRoomBookingCounts()` và `subscribeTourRoomBookingCounts()` lọc theo cột `date`:

```typescript
.eq('date', date)
```

Trước migration 006, bảng `bookings` không có cột `date` (chỉ có `booking_date`). Truy vấn lọc trên cột không tồn tại → PostgREST trả về 0 kết quả → tất cả phòng tour luôn hiển thị còn trống.

Sau khi thêm cột `date` vào bảng `bookings` và tour booking ghi đúng `date: tourBookingDate`, truy vấn này hoạt động chính xác.

---

## 🟡 VẤN ĐỀ TRUNG BÌNH (Cosmetic / Code Quality)

### VẤN ĐỀ #4: Tên hàm `ensureFirebaseAuth` không phản ánh đúng logic

**Mức độ**: THẤP – Chỉ ảnh hưởng đến khả năng đọc code  
**Trạng thái**: ⚠️ Chưa sửa (không ảnh hưởng chức năng)

**Mô tả:**  
Trong `src/components/Login.tsx`, hàm `ensureFirebaseAuth()` thực ra đang đảm bảo session Supabase Auth (gọi `supabase.auth.signInAnonymously()`), không liên quan đến Firebase nữa. Tên hàm gây nhầm lẫn.

**Fix gợi ý:** Đổi tên thành `ensureSupabaseAuth()` hoặc `ensureAuthSession()`.

---

### VẤN ĐỀ #5: URL ảnh còn trỏ về Firebase Storage

**Mức độ**: TRUNG BÌNH – Có thể hỏng nếu Firebase bị tắt  
**Trạng thái**: ⚠️ Chưa sửa

**Mô tả:**  
Các file sau còn hardcode URL Firebase Storage:

| File | Nội dung |
|------|---------|
| `src/components/Sidebar.tsx` | Logo công ty |
| `src/components/Login.tsx` | Logo trang đăng nhập |
| `src/components/Footer.tsx` | Logo footer |
| `src/pages/HomePage.tsx` | Ảnh hero, ảnh tour |
| `src/pages/FinancialReport.tsx` | Logo báo cáo |
| `src/pages/TourManagement.tsx` | Logo export PDF |
| `src/utils/exportUtils.ts` | Logo trong file Excel/PDF xuất |

**Fix gợi ý:** Upload các asset này lên Supabase Storage bucket `images` và cập nhật URL.

---

### VẤN ĐỀ #6: Comment trong code còn nhắc đến Firestore

**Mức độ**: THẤP – Chỉ ảnh hưởng đến khả năng đọc code  
**Trạng thái**: ⚠️ Chưa sửa

**Các file có comment cũ:**
- `src/components/PaymentQRModal.tsx` (3 comment)
- `src/pages/OperationsPage.tsx` (1 comment)
- `src/hooks/useRoutes.ts` (2 comment)
- `src/lib/bookingUtils.ts` (1 comment)
- `src/lib/vnDate.ts` (3 comment)
- `src/services/transportService.ts` (3 comment)
- `src/App.tsx` (5 comment)
- `src/services/fareService.ts` (3 comment)

---

## ✅ NHỮNG GÌ ĐÃ HOẠT ĐỘNG ĐÚNG

- ✅ 25 bảng Supabase được định nghĩa đầy đủ trong migration
- ✅ Real-time subscription hoạt động (channels, postgres_changes)
- ✅ RLS policies cho phép anon/authenticated write
- ✅ Chuyển đổi camelCase ↔ snake_case (`toDb`/`fromDb`)
- ✅ Supabase Storage với helper `uploadFile()`
- ✅ 7 Edge Functions đã migrate từ Firebase Cloud Functions
- ✅ Authentication flow (anon session + custom username/password + OTP)
- ✅ Bảng giá vé (`route_fares`) với stop ID dạng TEXT
- ✅ Quản lý tuyến đường, chuyến đi, phương tiện
- ✅ Quản lý đại lý, nhân viên, khách hàng
- ✅ Thanh toán QR code (pending_payments + real-time)

---

## Hướng dẫn áp dụng migration

```bash
# Kết nối Supabase CLI và chạy migration
supabase db push

# Hoặc chạy trực tiếp SQL trong Supabase Dashboard > SQL Editor
```

Nội dung migration: `supabase/migrations/006_add_missing_booking_columns.sql`
