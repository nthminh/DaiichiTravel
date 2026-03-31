# Hướng Dẫn Kiểm Thử Thanh Toán QR (Sandbox)

Hướng dẫn này mô tả hai cách để kiểm thử toàn bộ luồng thanh toán QR mà **không cần chuyển tiền thật**.

---

## Phương Pháp 1: Dùng Bộ Mô Phỏng Tích Hợp (Không Cần Tài Khoản OnePay)

Đây là cách **nhanh nhất** để kiểm thử — không cần đăng ký OnePay, không cần thẻ test.

### Yêu Cầu
- Trình duyệt máy tính (khuyến nghị: 2 tab hoặc 2 cửa sổ)
- 1 tài khoản **Khách hàng** (CUSTOMER / GUEST) — để đặt vé
- 1 tài khoản **Quản lý** (MANAGER) — để xác nhận thanh toán

---

### Bước 1 – Khách hàng đặt vé

1. Mở tab 1, đăng nhập hoặc dùng giao diện khách (không đăng nhập).
2. Chọn tuyến → chọn ghế → nhập họ tên và số điện thoại → nhấn **Tiếp tục**.
3. Xem lại thông tin đặt vé → nhấn **Xác nhận đặt vé**.
4. Popup **QR Thanh Toán** xuất hiện:
   - Banner vàng `🧪 CHẾ ĐỘ THỬ` (khi chưa cấu hình OnePay) hoặc banner xanh `🔬 MÔI TRƯỜNG THỬ NGHIỆM` (khi đã cấu hình sandbox OnePay).
   - Số tiền hiển thị lớn ở giữa.
   - Mã thanh toán (ví dụ: `DT-AB1234CD`) hiện ở dưới — hãy **ghi lại mã này**.
   - Bộ đếm ngược 30 phút.
5. **Giữ popup này mở** — đừng bấm Huỷ.

---

### Bước 2 – Quản lý xác nhận thanh toán (simulator)

1. Mở tab 2, đăng nhập với tài khoản **Quản lý**.
2. Vào **Quản lý Thanh toán** (sidebar → Daiichi Admin → Quản lý Thanh toán).
3. Cuộn xuống cuối trang để thấy mục **"Mô phỏng thanh toán (Thử nghiệm)"** (biểu tượng bình flask tím).
4. Nhấn vào mục đó để mở rộng.
5. Trong danh sách **"Giao dịch đang chờ"**, bạn sẽ thấy giao dịch của khách vừa tạo (hiển thị mã thanh toán + số tiền).
6. Nhấn vào giao dịch đó → thông tin tự động điền vào form bên dưới.
7. Kiểm tra:
   - **Mã thanh toán**: khớp với mã ở popup của khách (ví dụ: `DT-AB1234CD`)
   - **Số tiền**: đúng với số tiền đặt vé
   - **Nội dung CK**: phải chứa mã thanh toán (đã tự điền)
8. Nhấn **"Xác nhận thanh toán"**.

---

### Bước 3 – Kiểm tra kết quả trên màn hình khách hàng

Quay lại tab 1 (màn hình khách hàng):

- Popup QR tự động hiện `✅ Đã nhận thanh toán! Đang xác nhận đơn hàng...`
- Sau ~1 giây, popup đóng lại và **vé được tạo**.
- Vé có thể tải xuống PDF hoặc xem lại trong mục "Vé của tôi".

> **Nếu không thấy tự động xác nhận**: Khách có thể nhấn nút **"Tôi đã thanh toán xong"** để xác nhận thủ công.

---

## Phương Pháp 2: Dùng OnePay Sandbox (Cần Tài Khoản Test OnePay)

Dùng phương pháp này để kiểm thử mã QR thực sự được quét bởi app ngân hàng.

### Yêu Cầu
- Tài khoản merchant sandbox từ OnePay Vietnam (`https://mtf.onepay.vn`)
- Thông tin: `Merchant Code`, `Access Code`, `Hash Key (hex)`
- IPN URL đã đăng ký tại OnePay portal
- Firebase project đã deploy Cloud Function `onepayIpn`

---

### Bước 1 – Cấu Hình OnePay Trong Ứng Dụng

1. Đăng nhập tài khoản **Quản lý**.
2. Vào **Cài đặt** → mục **Thanh toán** → phần **OnePay Vietnam**.
3. Điền các thông tin sau:
   | Trường | Giá trị |
   |--------|---------|
   | Bật/Tắt OnePay | ✅ Bật |
   | Merchant Code | `{Merchant Code từ OnePay}` |
   | Access Code | `{Access Code từ OnePay}` |
   | Hash Key | `{Hash Key dạng hex từ OnePay}` |
   | URL Return | `https://{domain-của-bạn}/` hoặc `https://{project}.web.app/` |
   | Môi trường | `Sandbox` (kiểm thử) hoặc `Production` (thật) |
   | Loại cổng | `Domestic` (thẻ ATM nội địa) hoặc `International` (Visa/Master) |
4. Nhấn **Lưu cài đặt**.

> Sau khi lưu, popup QR sẽ hiển thị banner xanh `🔬 MÔI TRƯỜNG THỬ NGHIỆM` thay vì banner vàng, và mã QR sẽ chứa URL **đã được ký HMAC-SHA256** đầy đủ.

---

### Bước 2 – Đăng Ký IPN URL Tại OnePay Portal

IPN (Instant Payment Notification) là URL mà OnePay gọi sau khi giao dịch hoàn tất.

1. Xác định URL của Cloud Function:
   ```
   https://asia-southeast1-{PROJECT_ID}.cloudfunctions.net/onepayIpn
   ```
   Thay `{PROJECT_ID}` bằng ID Firebase project của bạn.

2. Đăng nhập vào OnePay Merchant Portal Sandbox:
   `https://mtf.onepay.vn/merchant`

3. Trong phần cấu hình merchant, đăng ký **IPN URL** với địa chỉ trên.

4. Đảm bảo Firebase Secret `ONEPAY_HASH_KEY` đã được set:
   ```bash
   firebase functions:secrets:set ONEPAY_HASH_KEY
   # Nhập Hash Key dạng hex khi được hỏi
   firebase deploy --only functions
   ```

---

### Bước 3 – Thực Hiện Giao Dịch Test

#### Với Thẻ ATM Nội Địa (Domestic):
1. Khách đặt vé → popup QR hiện ra.
2. **Tùy chọn A – Quét QR**: Dùng app ngân hàng quét mã QR. Chọn thanh toán và nhập OTP.
3. **Tùy chọn B – Mở URL**: Sao chép nội dung QR → mở bằng trình duyệt → điền thông tin thẻ test:

   | Thông tin | Giá trị |
   |-----------|---------|
   | Số thẻ | `9704180000000018` hoặc `9704198526191432198` |
   | Tên in trên thẻ | `NGUYEN VAN A` |
   | Ngày phát hành | `07/15` |
   | OTP | `otp` (điền chuỗi "otp") |

   *(Xem thêm tại: `https://mtf.onepay.vn/merchant/usertest`)*

4. Sau khi thanh toán thành công, OnePay gọi IPN URL → Cloud Function cập nhật Firestore → Popup QR tự động xác nhận.

#### Với Thẻ Quốc Tế (International):
| Thông tin | Giá trị |
|-----------|---------|
| Số thẻ | `4111111111111111` |
| Ngày hết hạn | `12/25` |
| CVV | `123` |
| OTP | `1234567` |

---

### Bước 4 – Kiểm Tra Kết Quả

Sau khi OnePay xử lý thanh toán:

1. **Trên màn hình khách hàng**: Popup QR tự động đóng và hiển thị vé.
2. **Trên Quản lý Thanh toán**: Giao dịch chuyển từ "Chờ thanh toán" → "Đã thanh toán".
3. **Trên Firebase Console**: Document `pendingPayments/{ref}` có `status: "PAID"`.

---

## Checklist Trước Khi Chạy Test

### Phương Pháp 1 (Simulator)
- [ ] Có ít nhất 1 chuyến xe/tour đang hoạt động với ghế trống
- [ ] Tài khoản khách hàng có thể truy cập trang đặt vé
- [ ] Tài khoản quản lý có thể truy cập Quản lý Thanh toán
- [ ] Kết nối internet ổn định (cần Firestore real-time)

### Phương Pháp 2 (OnePay Sandbox)
- [ ] Đã có tài khoản merchant sandbox từ OnePay
- [ ] Đã cấu hình OnePay trong Settings (bước 1 phía trên)
- [ ] Firebase Secret `ONEPAY_HASH_KEY` đã được set và deploy
- [ ] IPN URL đã đăng ký tại OnePay portal
- [ ] Đã kiểm tra URL Cloud Function hoạt động:
  ```bash
  curl -X GET "https://asia-southeast1-{PROJECT_ID}.cloudfunctions.net/onepayIpn?test=1"
  # Kết quả mong đợi: HTTP 400 (missing vpc_SecureHash – chứng tỏ function đang chạy)
  ```

---

## Xử Lý Sự Cố Thường Gặp

### Popup QR không xuất hiện
- Kiểm tra xem đã nhấn "Xác nhận đặt vé" chưa (không phải "Tiếp tục").
- Thử với ghế khác (ghế hiện tại có thể đã bị giữ chỗ).

### Simulator không thấy giao dịch đang chờ
- Đảm bảo khách hàng đang **giữ popup QR mở** (đừng bấm Huỷ).
- Kiểm tra kết nối Firestore — thử reload trang Quản lý Thanh toán.
- Kiểm tra Firestore Collection `pendingPayments` để xác nhận document tồn tại.

### Popup QR tự động đóng ngay sau khi simulator xác nhận nhưng vé không được tạo
- Mở DevTools (F12) → tab Console → tìm lỗi màu đỏ.
- Thường là do Firestore rules chưa cho phép ghi vào `bookings`.

### QR code không quét được (Phương pháp 2)
- Đây là triệu chứng phổ biến nhất khi credentials chưa được cấu hình đúng.
- Kiểm tra popup có hiển thị banner xanh `🔬 MÔI TRƯỜNG THỬ NGHIỆM` không.
  - Nếu hiện banner **vàng**: chưa cấu hình OnePay → dùng Phương pháp 1.
  - Nếu hiện banner **xanh**: đã cấu hình nhưng URL QR vẫn lỗi → kiểm tra credentials.
- Mở URL QR trong trình duyệt để xem thông báo lỗi từ OnePay.

### OnePay trả về lỗi "Chữ ký không hợp lệ"
- Hash Key trong Settings phải là chuỗi **hex** (chỉ ký tự 0-9, A-F), không phải Base64.
- Đảm bảo Hash Key trong Settings **khớp hoàn toàn** với Hash Key trong Firebase Secret `ONEPAY_HASH_KEY`.
- Cả hai giá trị phải giống nhau để client tạo URL và server xác thực IPN đều dùng cùng key.

### IPN không được nhận (Firestore không cập nhật tự động)
- Kiểm tra Cloud Function logs:
  ```bash
  firebase functions:log --only onepayIpn
  ```
- Kiểm tra IPN URL đã đăng ký tại OnePay portal chưa.
- Kiểm tra Firebase Secret `ONEPAY_HASH_KEY` đã được set chưa:
  ```bash
  firebase functions:secrets:access ONEPAY_HASH_KEY
  ```

---

## Ghi Chú Quan Trọng

| Tình huống | Hành vi |
|-----------|---------|
| OnePay **chưa cấu hình** | Banner vàng, QR là demo URL, xác nhận thủ công hoặc qua simulator |
| OnePay **sandbox** đã cấu hình | Banner xanh, QR là URL đã ký đầy đủ, IPN tự động xác nhận |
| OnePay **production** đã cấu hình | Không có banner, QR thật, IPN thật — **chỉ dùng khi go-live** |
| Nhấn "Tôi đã thanh toán xong" | Luôn hoạt động ở mọi chế độ — tạo vé ngay lập tức |

---

## Liên Hệ OnePay

- **Portal Sandbox**: https://mtf.onepay.vn/merchant
- **Tài liệu kỹ thuật**: Liên hệ OnePay Vietnam để nhận Integration Guide
- **Email hỗ trợ**: Xem trang web chính thức OnePay Vietnam
