# Hướng Dẫn Triển Khai Hệ Thống Thanh Toán QR

## Tổng Quan

Hệ thống thanh toán QR của Daiichi Travel sử dụng chuẩn **VietQR** (tương thích với tất cả ứng dụng ngân hàng Việt Nam hỗ trợ NAPAS). Hiện tại đang chạy ở **chế độ mô phỏng (demo)** với thông tin ngân hàng giả.

---

## Giai Đoạn 1: Chạy Mô Phỏng (Demo Mode – Hiện Tại)

### Mục Đích
- Kiểm tra luồng thanh toán từ đầu đến cuối
- Nhân viên và đại lý làm quen với giao diện
- Phát hiện lỗi trước khi dùng thông tin ngân hàng thật

### Cách Hoạt Động
1. Khách chọn ghế → điền thông tin → chọn "Chuyển khoản QR" (mặc định)
2. Popup QR xuất hiện với **banner vàng**: `🧪 CHẾ ĐỘ THỬ NGHIỆM — Thông tin ngân hàng là giả`
3. Khách bấm "Tôi đã thanh toán xong" → vé được tạo trong Firestore
4. Nhân viên vào "Quản lý Thanh toán" để xem và đánh dấu "Đã thanh toán"

### Lưu Ý Quan Trọng
- ⚠️ **Không chuyển tiền thật** trong chế độ demo
- Mã QR hiển thị thông tin tài khoản demo: `0123456789`
- Trạng thái thanh toán phải được nhân viên xác nhận thủ công

---

## Giai Đoạn 2: Cấu Hình Ngân Hàng Thật (Production)

### Bước 1: Nhận Thông Tin Từ VietinBank
Liên hệ chi nhánh VietinBank để lấy:
- Số tài khoản nhận tiền
- Tên chủ tài khoản (đúng như đăng ký – thường là tên công ty viết hoa không dấu)
- Tên chi nhánh (tuỳ chọn, chỉ để hiển thị)

### Bước 2: Cập Nhật File Cấu Hình

Mở file: `src/constants/bankConfig.ts`

```typescript
export const BANK_CONFIG: BankConfig = {
  bankBin: '970415',          // VietinBank BIN — KHÔNG thay đổi
  bankId: 'ICB',              // VietinBank ID cho VietQR API — KHÔNG thay đổi
  bankName: 'VietinBank',

  // ✅ THAY ĐỔI CÁC GIÁ TRỊ DƯỚI ĐÂY:
  accountNumber: '0123456789',           // ← Thay bằng số TK thật của công ty
  accountName: 'CONG TY TNHH DAIICHI TRAVEL', // ← Thay bằng tên TK thật (không dấu, hoa)
  branch: 'Chi nhánh TP.HCM',           // ← Tuỳ chọn, tên chi nhánh
  isDemoMode: false,                     // ← Đổi thành false để tắt banner demo
  qrTemplate: 'compact2',               // compact2 cho QR + logo ngân hàng
};
```

### Bước 3: Xác Minh Trước Khi Go-Live
1. Tạo một đặt vé thử với số tiền nhỏ (ví dụ 10.000đ)
2. Quét mã QR bằng app ngân hàng thật
3. Kiểm tra nội dung chuyển khoản hiển thị đúng số tiền và mã vé
4. **Chuyển tiền thử** và xác nhận tiền về tài khoản
5. Xác nhận mã vé khớp giữa nội dung CK và Firestore

### Bước 4: Tắt Demo Mode
Sau khi xác minh thành công:
```typescript
isDemoMode: false,  // Tắt banner cảnh báo demo
```

---

## Chức Năng Quản Lý Thanh Toán

### Truy Cập
- Đăng nhập với vai trò **Manager (Quản lý)**
- Sidebar → Daiichi Admin → **Quản lý Thanh toán**

### Các Tính Năng

#### Bảng Tổng Quan
| Chỉ Số | Mô Tả |
|--------|--------|
| Đã thu | Tổng tiền từ các đặt vé trạng thái PAID |
| Chờ thu | Tổng tiền từ các đặt vé trạng thái BOOKED |
| Khách lẻ | Số đặt vé không qua đại lý |
| Đại lý | Số đặt vé qua đại lý |

#### Quản Lý Số Dư Đại Lý
- Hiển thị danh sách đại lý đang hoạt động và số dư
- Màu đỏ = số dư âm (cần nạp tiền)
- Nút **"Nạp tiền"** tạo QR code để đại lý chuyển khoản

#### Nạp Tiền Cho Đại Lý (PREPAID)
1. Admin bấm nút "Nạp tiền" bên cạnh đại lý cần nạp
2. Nhập số tiền muốn nạp
3. Bấm "Tạo QR nạp tiền"
4. Đại lý quét QR và chuyển khoản với nội dung `TOPUP{mã đại lý}`
5. Sau khi tiền về, admin vào Firestore hoặc trang Agents để cập nhật số dư

> **Lưu ý:** Hiện tại số dư đại lý phải cập nhật thủ công. Trong tương lai có thể tích hợp webhook từ ngân hàng để tự động cộng số dư.

#### Lọc và Tìm Kiếm
- Lọc theo loại: Tất cả / Khách lẻ / Đại lý
- Lọc theo trạng thái: Tất cả / Chờ TT / Đã TT / Đã huỷ
- Lọc theo khoảng ngày
- Tìm kiếm theo mã vé, tên khách, số điện thoại

#### Đánh Dấu Đã Thanh Toán
Khi nhận được tiền thủ công (tiền mặt hoặc chuyển khoản không qua QR):
1. Tìm giao dịch trong danh sách
2. Bấm **"Đánh dấu ĐT"** để chuyển trạng thái từ BOOKED → PAID

#### Xuất Dữ Liệu
- Bấm **"Xuất CSV"** để tải file .csv với dữ liệu đã lọc
- File có BOM UTF-8 để Excel đọc tiếng Việt chính xác

---

## Luồng Thanh Toán Chi Tiết

### Khách Lẻ (Walk-in / Online)
```
Chọn ghế
→ Điền thông tin (tên, SĐT)
→ Chọn "Chuyển khoản QR" (mặc định)
→ Popup QR hiện ra:
    - QR code VietinBank
    - Số tiền
    - Nội dung CK: mã tham chiếu (ví dụ DT-AB1234CD)
→ Khách quét QR bằng app ngân hàng
→ Khách bấm "Tôi đã thanh toán xong"
→ Hệ thống lưu đặt vé với status = BOOKED, paymentMethod = "Chuyển khoản QR"
→ Nhân viên nhận thông báo thời gian thực
→ Nhân viên kiểm tra sao kê ngân hàng → đánh dấu PAID trong hệ thống
```

### Đại Lý (PREPAID - phải nạp tiền trước)
```
Đại lý liên hệ admin → admin tạo QR nạp tiền
→ Đại lý chuyển khoản với nội dung "TOPUP{mã ĐL}"
→ Admin cập nhật số dư trong Firestore
→ Đại lý đăng nhập và đặt vé bình thường
→ Hệ thống trừ số dư (cần tích hợp thêm logic này)
```

### Đại Lý (POSTPAID - được ghi nợ)
```
Đại lý đặt vé → hệ thống ghi nhận
→ Cuối kỳ admin kiểm tra danh sách đặt vé theo đại lý
→ Xuất CSV → gửi đối soát
→ Đại lý chuyển khoản tổng
→ Admin cập nhật trạng thái
```

---

## Thông Tin Kỹ Thuật

### VietQR API
- URL: `https://img.vietqr.io/image/{bankId}-{accountNumber}-{template}.png?amount={amount}&addInfo={ref}&accountName={name}`
- Template hiện dùng: `compact2` (QR + logo ngân hàng + thông tin TK)
- Tài liệu: https://vietqr.io/danh-sach-api/

### Định Dạng QR String (EMVCo)
Nếu img.vietqr.io không khả dụng (mất mạng), hệ thống tự tạo QR string theo chuẩn EMVCo QRCPS-MPM và dùng `qrcode.react` để render.

### Bảo Mật
- Thông tin ngân hàng chỉ lưu trong `src/constants/bankConfig.ts` (frontend)
- Không lưu thông tin nhạy cảm trong Firestore hay localStorage
- Không có webhook thanh toán thật (manual verification in demo)
- Cần thêm webhook xác nhận tự động khi dùng production

---

## Checklist Trước Khi Go-Live

- [ ] Nhận số TK và tên TK từ VietinBank
- [ ] Cập nhật `src/constants/bankConfig.ts` với thông tin thật
- [ ] Set `isDemoMode: false`
- [ ] Test quét QR và chuyển tiền nhỏ (10.000đ)
- [ ] Xác nhận tiền về đúng TK
- [ ] Xác nhận nội dung CK hiển thị đúng mã vé
- [ ] Huấn luyện nhân viên quy trình xác nhận thủ công
- [ ] Cân nhắc tích hợp webhook tự động (liên hệ VietinBank về IPAY Gateway)

---

## Liên Hệ Hỗ Trợ

- **Tích hợp webhook ngân hàng**: Liên hệ VietinBank về dịch vụ iTransfer/iPayment API
- **VietQR API**: https://vietqr.io
- **NAPAS QR chuẩn**: https://napas.com.vn
