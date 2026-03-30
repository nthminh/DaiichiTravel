# Hướng Dẫn Tích Hợp & Kiểm Thử Thanh Toán OnePay

> Cập nhật: 2026-03-30

---

## Mục Lục

1. [Tổng Quan Hệ Thống](#1-tổng-quan-hệ-thống)
2. [Kiến Trúc Luồng Thanh Toán](#2-kiến-trúc-luồng-thanh-toán)
3. [Cấu Hình Môi Trường Sandbox (Admin)](#3-cấu-hình-môi-trường-sandbox-admin)
4. [Cấu Hình Môi Trường Production (Admin)](#4-cấu-hình-môi-trường-production-admin)
5. [Hướng Dẫn Thử Thanh Toán – Vai Trò Khách (Guest / Customer)](#5-hướng-dẫn-thử-thanh-toán--vai-trò-khách-guest--customer)
6. [Mô Phỏng Xác Nhận Thanh Toán – Vai Trò Admin (Manager)](#6-mô-phỏng-xác-nhận-thanh-toán--vai-trò-admin-manager)
7. [Thẻ & Tài Khoản Test Sandbox OnePay](#7-thẻ--tài-khoản-test-sandbox-onepay)
8. [Bảng Mã Phản Hồi OnePay](#8-bảng-mã-phản-hồi-onepay)
9. [Checklist Trước Khi Go-Live (Production)](#9-checklist-trước-khi-go-live-production)
10. [Câu Hỏi Thường Gặp](#10-câu-hỏi-thường-gặp)

---

## 1. Tổng Quan Hệ Thống

Daiichi Travel tích hợp cổng thanh toán **OnePay Việt Nam** với hai loại cổng:

| Loại cổng | Mô tả | Dành cho |
|-----------|-------|----------|
| **Domestic (Nội địa)** | Thẻ ATM, tài khoản ngân hàng nội địa Việt Nam | Khách dùng thẻ ATM / Internet Banking |
| **International (Quốc tế)** | Thẻ Visa, MasterCard, JCB, Amex | Khách dùng thẻ quốc tế |

Hệ thống sử dụng **HMAC-SHA256** (Web Crypto API) để tạo và xác thực chữ ký điện tử theo đặc tả OnePay. Cấu hình được lưu trong Firestore (`settings/paymentConfig`) và có thể cập nhật qua giao diện Settings — không cần build lại ứng dụng.

---

## 2. Kiến Trúc Luồng Thanh Toán

### Sơ Đồ Luồng (Khách / Customer / Guest)

```
[Khách chọn ghế trên SeatMappingPage]
        │
        ▼
[Nhập thông tin: tên, SĐT, email]
        │
        ▼
[Xác nhận đặt vé (confirmation panel)]
        │
        ▼
[handleConfirmBooking() trong usePayment.ts]
        │  ─ Tạo mã thanh toán duy nhất (paymentReference)
        │  ─ Giữ ghế trước (status → BOOKED màu vàng)
        │  ─ Ghi pendingPayments/{paymentRef} vào Firestore
        │
        ▼
[Hiện PaymentQRModal với QR code OnePay]
        │  ─ QR encode URL: https://mtf.onepay.vn/paygate/vpcpay.op?...
        │  ─ Modal subscribe realtime đến pendingPayments/{paymentRef}
        │  ─ Đồng hồ đếm ngược 30 phút (nếu hết → tự giải phóng ghế)
        │
        ▼
[Khách quét QR bằng app ngân hàng / OnePay app]
        │
        ├── [Khách bấm "Tôi đã thanh toán xong"]   ◄── hoặc
        └── [Admin xác nhận qua Payment Simulator]  ◄── (pendingPayments/{ref}.status → 'PAID'; modal tự đóng)
                │
                ▼
        [saveBookingAfterReservation()]
                │  ─ Xóa pendingPayments/{paymentRef}
                │  ─ Tạo booking với paymentStatus = 'PAID'
                │  ─ Ghế chuyển trạng thái PAID (màu xanh)
                │
                ▼
        [Hiển thị vé và tải file PDF]
```

### Các Role Và Quyền Liên Quan Đến Thanh Toán

| Role | Thanh toán QR | Chọn phương thức khác | Xem Payment Management | Cấu hình Settings |
|------|:---:|:---:|:---:|:---:|
| **GUEST** (khách chưa đăng nhập) | ✅ Bắt buộc | ✗ | ✗ | ✗ |
| **CUSTOMER** (khách đã đăng nhập) | ✅ Bắt buộc | ✗ | ✗ | ✗ |
| **AGENT** (đại lý) | ✅ Có thể chọn | ✅ | ✗ | ✅ (giới hạn) |
| **MANAGER** (quản lý) | ✅ Có thể chọn | ✅ | ✅ | ✅ (đầy đủ) |

> **Lưu ý:** Khách (GUEST/CUSTOMER) **luôn** thanh toán qua QR. Không có lựa chọn phương thức khác.

---

## 3. Cấu Hình Môi Trường Sandbox (Admin)

### Bước 1: Đăng Ký Tài Khoản Sandbox OnePay

1. Truy cập: https://mtf.onepay.vn
2. Liên hệ OnePay để nhận tài khoản sandbox:
   - **vpc_Merchant**: Mã merchant (ví dụ: `TESTONEPAY`)
   - **vpc_Access_Code**: Mã access (ví dụ: `6BEB2546`)
   - **Hash Secret Key** (dạng chuỗi hex): Khóa bí mật để ký HMAC-SHA256
3. Lưu thông tin này vào nơi an toàn; **không commit vào source code**

### Bước 2: Cấu Hình Trong Ứng Dụng (Giao Diện Settings)

1. Đăng nhập với tài khoản **MANAGER**
2. Vào Sidebar → **Cài đặt (Settings)**
3. Cuộn đến mục **"Phương thức thanh toán"** → tìm khung **"OnePay Việt Nam"**
4. Bật toggle **OnePay** (nếu chưa bật)
5. Điền các trường sau:

| Trường | Giá trị sandbox | Mô tả |
|--------|-----------------|-------|
| **Loại cổng** | `Nội địa (ATM/Domestic)` | Chọn Domestic cho thẻ ATM nội địa |
| **Môi trường** | `Sandbox / Test` | Chọn Sandbox để kiểm thử |
| **Merchant Code** | `TESTONEPAY` | vpc_Merchant do OnePay cấp |
| **Access Code** | `6BEB2546` | vpc_Access_Code do OnePay cấp |
| **Hash Secret Key** | `(chuỗi hex OnePay cấp)` | Khóa bí mật HMAC-SHA256, dạng hex |
| **Return URL** | `https://your-domain.com/payment/return` | URL nhận kết quả từ OnePay (dùng URL thật của app) |

6. Bấm **"Lưu cài đặt thanh toán"**
7. Kiểm tra mục **"🔗 Endpoint API OnePay"** hiển thị đúng:
   - Domestic Sandbox: `https://mtf.onepay.vn/paygate/vpcpay.op`
   - International Sandbox: `https://mtf.onepay.vn/onecomm-pay/vpc.op`

### Bước 3 (Tùy Chọn): Cấu Hình Qua Biến Môi Trường

Thay vì dùng Settings UI, có thể đặt trực tiếp trong file `.env`:

```env
# .env (local development)
VITE_ONEPAY_MERCHANT=TESTONEPAY
VITE_ONEPAY_ACCESS_CODE=6BEB2546
VITE_ONEPAY_HASH_KEY=A1B2C3D4E5F6...   # chuỗi hex 64 ký tự
```

> ⚠️ **Quan trọng:** Nếu cả Settings UI và `.env` đều có giá trị, Settings UI (Firestore) sẽ được ưu tiên. Chỉ dùng biến môi trường khi không có quyền truy cập Settings.

### Bước 4: Xác Nhận Endpoint Sandbox Đang Hoạt Động

Mở Developer Tools (F12) → Network, tạo một giao dịch thử. URL QR phải chứa `mtf.onepay.vn`.

---

## 4. Cấu Hình Môi Trường Production (Admin)

> ⚠️ **Cảnh báo:** Chỉ chuyển sang Production khi đã hoàn tất kiểm thử Sandbox và được OnePay cấp thông tin Production.

### Bước 1: Nhận Thông Tin Production Từ OnePay

Liên hệ OnePay Việt Nam (https://onepay.vn) để ký hợp đồng và nhận:
- **vpc_Merchant** Production (khác với sandbox)
- **vpc_Access_Code** Production
- **Hash Secret Key** Production (chuỗi hex, tuyệt đối bảo mật)
- Danh sách IP whitelist (nếu cần)

### Bước 2: Cập Nhật Cấu Hình Settings

1. Đăng nhập **MANAGER** → Sidebar → **Cài đặt**
2. Mục **"OnePay Việt Nam"** → chỉnh các trường:

| Trường | Giá trị | Lưu ý |
|--------|---------|-------|
| **Môi trường** | `Production / Thật` | ⚠️ Giao dịch thật sẽ bị tính tiền |
| **Merchant Code** | `(merchant code production)` | Khác hoàn toàn với sandbox |
| **Access Code** | `(access code production)` | Do OnePay cấp |
| **Hash Secret Key** | `(hex key production)` | **Tuyệt đối không chia sẻ** |
| **Return URL** | `https://daiichitravel.com/payment/return` | Phải là domain thật, HTTPS |

3. Bấm **"Lưu cài đặt thanh toán"**
4. Kiểm tra endpoint hiển thị: `https://onepay.vn/paygate/vpcpay.op`

### Bước 3: Cập Nhật bankConfig.ts (Nếu Cần)

Mở `src/constants/bankConfig.ts` và cập nhật:

```typescript
export const BANK_CONFIG: BankConfig = {
  bankId: 'ONEPAY',
  bankName: 'OnePay',
  accountNumber: 'YOUR_REAL_MERCHANT_CODE',   // ← Merchant code Production
  accountName: 'CONG TY TNHH DAIICHI TRAVEL', // ← Tên đăng ký với OnePay
  branch: 'YOUR_ACCESS_CODE',                  // ← Access code (chỉ hiển thị)
  isDemoMode: false,                           // ← Đổi thành false
  qrTemplate: 'compact2',
  paymentBaseUrl: 'https://onepay.vn/paygate/vpcpay.op', // ← Production URL
};
```

### Bước 4: Kiểm Tra Lần Cuối Trước Go-Live

Thực hiện một giao dịch thật nhỏ (ví dụ 10.000 VNĐ):
1. Vào SeatMappingPage với vai trò CUSTOMER
2. Đặt vé thử → xuất hiện QR code Production
3. Quét QR bằng app ngân hàng thật → thanh toán thật 10.000 VNĐ
4. Xác nhận tiền về tài khoản merchant
5. Kiểm tra booking trong Firestore có `paymentStatus: 'PAID'`

---

## 5. Hướng Dẫn Thử Thanh Toán – Vai Trò Khách (Guest / Customer)

### 5.1 Truy Cập Và Đặt Vé

**Cách 1 – Không đăng nhập (GUEST):**
1. Mở ứng dụng (không cần đăng nhập)
2. Trang chủ sẽ hiển thị form tìm kiếm chuyến đi
3. Chọn điểm đi, điểm đến, ngày khởi hành → bấm **"Tìm chuyến"**
4. Chọn một chuyến trong danh sách → bấm vào thẻ chuyến
5. Trang **SeatMappingPage** mở ra với sơ đồ ghế

**Cách 2 – Đăng nhập với tài khoản CUSTOMER:**
1. Bấm **"Đăng nhập"** → nhập email/password tài khoản customer
2. Sidebar xuất hiện menu **"Đặt vé"** và **"Vé của tôi"**
3. Vào **"Đặt vé"** → tìm kiếm chuyến như trên

### 5.2 Các Bước Trên Trang Chọn Ghế

**Bước 1 – Chọn ghế:**
- Nhấn vào một ghế màu trắng (EMPTY) trên sơ đồ
- Ghế được chọn sẽ đổi màu xanh
- Có thể chọn nhiều ghế cùng lúc

**Bước 2 – Nhập thông tin:**
- Panel thông tin hiện ra bên phải (hoặc bên dưới trên mobile)
- Điền đầy đủ:
  - **Họ và tên** (bắt buộc)
  - **Số điện thoại** (bắt buộc)
  - **Email** (tùy chọn)
- Kiểm tra tổng tiền và tuyến đi hiển thị đúng

**Bước 3 – Xác nhận:**
- Bấm **"Xác nhận đặt vé"**
- Kiểm tra lại thông tin trong panel xác nhận
- Bấm **"Tiếp tục thanh toán"** hoặc **"Xác nhận"**

**Bước 4 – Thanh toán QR:**
- Popup **PaymentQRModal** tự động xuất hiện
- Giao diện hiển thị:
  - Mã QR code OnePay
  - Số tiền cần thanh toán
  - Mã tham chiếu (ví dụ: `DT-AB1234CD`)
  - Đồng hồ đếm ngược **30 phút**
  - Nút **"Tôi đã thanh toán xong"**

### 5.3 Quét QR Và Hoàn Tất

**Môi trường Sandbox (kiểm thử):**
1. Mở app ngân hàng hỗ trợ quét QR (VCB, BIDV, VietinBank, TPBank, v.v.)
2. Vào chức năng **"Quét mã QR"** hoặc **"Thanh toán QR"**
3. Quét mã QR hiển thị trên màn hình
4. App ngân hàng sẽ chuyển hướng đến trang OnePay Sandbox (`mtf.onepay.vn`)
5. Dùng thông tin thẻ test (xem [Mục 7](#7-thẻ--tài-khoản-test-sandbox-onepay)) để thanh toán
6. Sau khi thanh toán thành công, OnePay redirect về ứng dụng

**Hoặc – Bấm xác nhận thủ công (Demo Mode):**
- Bấm nút **"Tôi đã thanh toán xong"** ngay lập tức (không cần quét QR thật)
- Booking sẽ được tạo với `paymentStatus: 'PAID'`
- Vé hiện ra và có thể tải PDF

### 5.4 Kiểm Tra Vé Sau Thanh Toán

Sau khi hoàn tất:
- Vé được hiển thị tự động (TicketModal)
- PDF vé có thể tải xuống
- Nếu đăng nhập CUSTOMER: vào **"Vé của tôi"** để xem lịch sử đặt vé

---

## 6. Mô Phỏng Xác Nhận Thanh Toán – Vai Trò Admin (Manager)

### 6.1 Truy Cập Payment Simulator

1. Đăng nhập với tài khoản **MANAGER**
2. Sidebar → **Daiichi Admin** → **Quản lý Thanh toán**
3. Cuộn xuống cuối trang → tìm mục **"🧪 Mô phỏng thanh toán (Thử nghiệm)"**
4. Bấm để mở rộng panel simulator

### 6.2 Sử Dụng Payment Simulator

Payment Simulator cho phép Admin **giả lập việc nhận được thanh toán** mà không cần quét QR thật. Đây là cách nhanh nhất để kiểm thử luồng từ đầu đến cuối trong môi trường Sandbox.

**Điều kiện tiên quyết:** Phải có ít nhất một giao dịch QR đang chờ xác nhận (khách đã mở QR modal nhưng chưa bấm "Tôi đã thanh toán").

**Các bước:**
1. Khi có giao dịch đang chờ, simulator hiện badge đỏ với số lượng
2. Bấm vào giao dịch trong danh sách để chọn (tự động điền mã và số tiền)
3. Kiểm tra các trường:
   - **Mã thanh toán**: Mã tham chiếu của giao dịch (ví dụ: `DT-AB1234CD`)
   - **Số tiền**: Số tiền khớp với đặt vé
   - **Nội dung CK**: Nội dung chuyển khoản (thường là mã tham chiếu)
4. Bấm **"Xác nhận thanh toán"**
5. Hệ thống:
   - Cập nhật `pendingPayments/{ref}` với `status: 'PAID'`
   - Modal QR bên phía khách tự động đóng
   - Booking được tạo với `paymentStatus: 'PAID'`
   - Vé hiện ra bên phía khách

### 6.3 Đánh Dấu Thanh Toán Thủ Công

Ngoài Simulator, Manager có thể đánh dấu thanh toán thủ công trong bảng giao dịch:
1. Tìm booking trong danh sách (lọc theo tên, SĐT, mã vé)
2. Bấm **"Đánh dấu ĐT"** ở cột hành động
3. Trạng thái chuyển từ `BOOKED` → `PAID`

---

## 7. Thẻ & Tài Khoản Test Sandbox OnePay

> Sử dụng thông tin dưới đây **chỉ** trên môi trường sandbox (`mtf.onepay.vn`).

### 7.1 Thẻ ATM Nội Địa (Domestic Gateway)

| Thông tin | Giá trị |
|-----------|---------|
| **Số thẻ** | `9704198526191432198` |
| **Tên chủ thẻ** | `NGUYEN VAN A` |
| **Ngày phát hành** | `07/15` |
| **OTP** | `123456` |
| **Ngân hàng** | NCB (National Citizen Bank) |

| Thông tin | Giá trị |
|-----------|---------|
| **Số thẻ** | `9704195798459170488` |
| **Tên chủ thẻ** | `NGUYEN VAN B` |
| **Ngày phát hành** | `07/15` |
| **OTP** | `123456` |
| **Ngân hàng** | NCB |

### 7.2 Thẻ Quốc Tế (International Gateway)

| Thông tin | Giá trị |
|-----------|---------|
| **Số thẻ** | `4456530000001005` |
| **Tên chủ thẻ** | `NGUYEN VAN A` |
| **Ngày hết hạn** | `01/27` |
| **CVV** | `123` |
| **Loại thẻ** | Visa |

| Thông tin | Giá trị |
|-----------|---------|
| **Số thẻ** | `5200000000001005` |
| **Tên chủ thẻ** | `NGUYEN VAN B` |
| **Ngày hết hạn** | `05/28` |
| **CVV** | `123` |
| **Loại thẻ** | MasterCard |

> 📌 **Nguồn:** Thông tin thẻ test sandbox lấy từ tài liệu OnePay dành cho merchant. Liên hệ OnePay nếu cần bộ thẻ test cập nhật nhất.

### 7.3 Kịch Bản Test Giao Dịch Thất Bại

Để test các trường hợp lỗi trong sandbox, dùng các số tiền đặc biệt (nếu OnePay sandbox hỗ trợ):
- Số tiền kết thúc bằng `01` → Giao dịch bị từ chối
- Số tiền kết thúc bằng `02` → Số dư không đủ
- Đặt `99` VNĐ cuối → Người dùng hủy

---

## 8. Bảng Mã Phản Hồi OnePay

Khi OnePay trả về kết quả (redirect URL hoặc IPN webhook), tham số `vpc_TxnResponseCode` cho biết trạng thái:

| Mã | Ý nghĩa | Hành động đề xuất |
|----|---------|-------------------|
| `0` | ✅ Giao dịch thành công | Cập nhật đơn hàng → PAID |
| `1` | Ngân hàng từ chối | Yêu cầu khách thử lại hoặc đổi thẻ |
| `2` | Ngân hàng từ chối (lý do khác) | Yêu cầu khách liên hệ ngân hàng |
| `5` | Đang xử lý tại ngân hàng | Chờ, kiểm tra lại sau |
| `7` | Lỗi xác thực chữ ký | Kiểm tra Hash Key cấu hình |
| `8` | Không đủ số dư / vượt hạn mức | Yêu cầu khách nạp tiền / đổi thẻ |
| `9` | Chưa đăng ký Internet Banking | Khách cần kích hoạt dịch vụ |
| `10` | Thẻ hết hạn hoặc bị khóa | Đổi thẻ khác |
| `25` | OTP sai hoặc hết hạn | Yêu cầu nhập lại OTP |
| `253` | Quá thời gian cho phép | Tạo lại giao dịch mới |
| `99` | Người dùng hủy | Cho phép khách quay lại thanh toán |

---

## 9. Checklist Trước Khi Go-Live (Production)

### 9.1 Phía Admin (Manager)

- [ ] Đã ký hợp đồng và nhận đủ thông tin Production từ OnePay
- [ ] Đã cập nhật Settings với thông tin Production (Merchant, AccessCode, HashKey)
- [ ] Đã chuyển môi trường → `Production / Thật`
- [ ] **Return URL** đã trỏ về domain HTTPS thật (không dùng localhost)
- [ ] Đã cập nhật `bankConfig.ts`: `isDemoMode: false`, `paymentBaseUrl` → production
- [ ] Đã test 1 giao dịch thật nhỏ (10.000 VNĐ) và xác nhận tiền về
- [ ] Nhân viên đã được huấn luyện quy trình xác nhận thanh toán thủ công
- [ ] Đã tắt Payment Simulator (chỉ dùng trong môi trường sandbox)
- [ ] Đã thiết lập webhook IPN (nếu OnePay hỗ trợ) để tự động xác nhận

### 9.2 Kiểm Tra Kỹ Thuật

- [ ] Hàm `createOnepayPaymentUrl()` tạo URL hợp lệ (test trong sandbox trước)
- [ ] Hàm `verifyOnepayIpn()` xác thực chữ ký đúng
- [ ] Firestore `settings/paymentConfig` có đủ trường: `onepayEnabled`, `onepayMerchant`, `onepayAccessCode`, `onepayHashKey`, `onepayReturnUrl`, `onepayEnvironment`, `onepayGatewayType`
- [ ] HMAC-SHA256 Hash Key là chuỗi hex hợp lệ (độ dài chẵn, chỉ ký tự `0-9A-F`)
- [ ] Không có Hash Key nào bị commit vào source code

### 9.3 Kiểm Tra Bảo Mật

- [ ] Hash Key **chỉ** lưu trong Firestore (chỉ MANAGER mới xem được trong Settings)
- [ ] Không có Hash Key trong file `.env`, git history, log file
- [ ] Return URL được whitelist trong tài khoản merchant OnePay
- [ ] Firestore rules hạn chế đọc `settings/paymentConfig` chỉ với MANAGER

---

## 10. Câu Hỏi Thường Gặp

**Q: QR code hiển thị nhưng không quét được bằng app ngân hàng?**
> A: Trong sandbox, QR code là URL OnePay test (`mtf.onepay.vn`). Một số app ngân hàng không nhận URL sandbox. Dùng Payment Simulator để test thay thế, hoặc test trực tiếp bằng cách mở URL trong trình duyệt.

**Q: Sau khi bấm "Tôi đã thanh toán xong" nhưng vé không hiện?**
> A: Kiểm tra Firestore `pendingPayments/{paymentRef}` xem còn tồn tại không. Nếu đã xóa nhưng vé chưa hiện, kiểm tra console log lỗi khi `saveBookingAfterReservation()` chạy.

**Q: Modal QR tự đóng sau 30 phút mà không được xác nhận?**
> A: Ghế được giải phóng tự động (BOOKED → EMPTY). Khách cần bắt đầu lại quy trình đặt vé. Admin không cần làm gì thêm.

**Q: Lỗi "Hash Key không hợp lệ"?**
> A: Hash Key phải là chuỗi hex (0-9, A-F), độ dài chẵn. Kiểm tra lại thông tin từ OnePay. Thông thường là 64 ký tự hex (32 bytes).

**Q: Mã phản hồi `vpc_TxnResponseCode = '7'` — lỗi chữ ký?**
> A: Hash Key không khớp giữa cấu hình ứng dụng và cấu hình merchant trên OnePay. Kiểm tra lại Hash Key trong Settings và liên hệ OnePay để xác nhận.

**Q: Làm sao xem danh sách giao dịch đang chờ xác nhận?**
> A: MANAGER vào **Quản lý Thanh toán** → panel "Mô phỏng thanh toán" hiển thị badge đỏ với số lượng giao dịch đang chờ. Cũng có thể xem trực tiếp trong Firestore collection `pendingPayments`.

**Q: Tôi cần thêm phương thức thanh toán khác ngoài QR?**
> A: Trong Settings → mục "Phương thức thanh toán", bật các phương thức: Tiền mặt, Chuyển khoản, Thẻ tín dụng, MoMo. Lưu ý: GUEST và CUSTOMER luôn dùng QR; các phương thức khác chỉ khả dụng cho AGENT và MANAGER.

---

## Phụ Lục: Endpoint OnePay Theo Môi Trường

| Loại cổng | Môi trường | URL |
|-----------|-----------|-----|
| Domestic (ATM nội địa) | **Sandbox** | `https://mtf.onepay.vn/paygate/vpcpay.op` |
| Domestic (ATM nội địa) | **Production** | `https://onepay.vn/paygate/vpcpay.op` |
| International (Visa/MC) | **Sandbox** | `https://mtf.onepay.vn/onecomm-pay/vpc.op` |
| International (Visa/MC) | **Production** | `https://onepay.vn/onecomm-pay/vpc.op` |

## Phụ Lục: Tham Số QR String OnePay

QR code được tạo từ hàm `generatePaymentQrString()` trong `src/constants/bankConfig.ts`:

```
https://mtf.onepay.vn/paygate/vpcpay.op
  ?vpc_Version=2
  &vpc_Command=pay
  &vpc_Amount={amount × 100}         ← Số tiền × 100 (đơn vị xu)
  &vpc_MerchTxnRef={paymentRef}      ← Mã tham chiếu đơn hàng
  &vpc_Merchant={merchantCode}       ← Mã merchant
  &vpc_OrderInfo={paymentRef}        ← Thông tin đơn hàng
  &vpc_Locale=vn                     ← Ngôn ngữ (vn hoặc en)
```

Ví dụ QR string đầy đủ (sandbox, 500.000 VNĐ):
```
https://mtf.onepay.vn/paygate/vpcpay.op?vpc_Version=2&vpc_Command=pay&vpc_Amount=50000000&vpc_MerchTxnRef=DT-AB1234CD&vpc_Merchant=TESTONEPAY&vpc_OrderInfo=DT-AB1234CD&vpc_Locale=vn
```

## Phụ Lục: Cấu Trúc Firestore Liên Quan

```
Firestore/
├── settings/
│   └── paymentConfig              ← Cấu hình OnePay (MANAGER đọc/ghi)
│       ├── onepayEnabled: boolean
│       ├── onepayMerchant: string
│       ├── onepayAccessCode: string
│       ├── onepayHashKey: string  ← Chỉ MANAGER xem được
│       ├── onepayReturnUrl: string
│       ├── onepayEnvironment: 'sandbox' | 'production'
│       └── onepayGatewayType: 'domestic' | 'international'
│
└── pendingPayments/
    └── {paymentRef}               ← 1 doc = 1 giao dịch QR đang chờ
        ├── paymentRef: string
        ├── expectedAmount: number
        ├── customerName: string
        ├── routeInfo: string
        ├── tripId: string
        ├── status: 'PENDING' | 'PAID'
        └── createdAt: Timestamp
```
