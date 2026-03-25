# Hướng Dẫn Tối Ưu Hiệu Suất – DaiichiTravel

> Tài liệu này dành cho nhân viên vận hành và quản trị viên hệ thống.  
> Mục tiêu: giúp trang web tải nhanh hơn, trải nghiệm người dùng mượt mà hơn.

---

## 1. Hướng Dẫn Tải Ảnh Lên Hệ Thống

### ✅ Ảnh được nén tự động

Khi bạn tải ảnh lên (banner tour, ảnh tuyến đường...), hệ thống sẽ **tự động nén ảnh** trước khi lưu lên Firebase Storage:

- **Định dạng đầu ra**: WebP (nếu trình duyệt hỗ trợ), hoặc JPEG làm dự phòng
- **Kích thước tối đa**: 1280 × 960 px (hệ thống tự thu nhỏ nếu ảnh lớn hơn)
- **Chất lượng nén**: 75% (cân bằng giữa dung lượng và độ sắc nét)
- **Tiết kiệm dung lượng**: thường giảm 40–70% so với file gốc

### 📋 Khuyến nghị trước khi tải ảnh lên

| Hạng mục | Khuyến nghị |
|---------|-------------|
| **Kích thước file gốc** | Dưới 5 MB mỗi ảnh |
| **Kích thước ảnh gốc** | Dưới 4000 × 3000 px |
| **Định dạng đầu vào** | JPG, PNG, WebP, HEIC đều được |
| **Tỷ lệ khung hình banner** | 16:9 hoặc 4:3 cho đẹp nhất |
| **Tải nhiều ảnh cùng lúc** | Nên tải tối đa 5 ảnh/lần để tránh timeout |

### ⚠️ Những điều cần tránh

- **Không tải ảnh RAW** từ máy ảnh (dung lượng 20–50 MB/file): nén trước bằng phần mềm
- **Không tải ảnh có văn bản nhỏ** dưới 12px: sau nén sẽ mờ
- **Không tải ảnh screenshot màn hình** làm banner: chất lượng thấp, không chuyên nghiệp
- **Tránh upload ảnh cùng định dạng tên file** (`image.jpg`, `image.jpg`...): sẽ bị ghi đè

### 🖥️ Yêu cầu trình duyệt

| Tính năng | Chrome | Firefox | Edge | Safari |
|-----------|--------|---------|------|--------|
| Nén WebP | ≥ 32 | ≥ 65 | ≥ 18 | ≥ 14 |
| Tải ảnh nhiều file | ✅ | ✅ | ✅ | ✅ |
| Fallback JPEG | Tự động | Tự động | Tự động | Tự động |

> **Ghi chú**: Safari trên iOS/macOS hỗ trợ WebP từ phiên bản 14 (iOS 14, macOS Big Sur trở lên).  
> Trên trình duyệt cũ hơn, hệ thống sẽ tự dùng JPEG thay thế.

---

## 2. Các Yếu Tố Ảnh Hưởng Đến Tốc Độ Trang

### 2.1 Điểm Lighthouse Hiện Tại

| Chỉ số | Điểm | Ý nghĩa |
|--------|------|---------|
| **Performance** | ~43 | Cần cải thiện – trang tải chậm |
| **Accessibility** | 100 | Xuất sắc |
| **Best Practices** | 76 | Tốt |
| **SEO** | 92 | Tốt |

### 2.2 Nguyên Nhân Trang Tải Chậm

| Nguyên nhân | Mức ảnh hưởng | Trạng thái |
|-------------|--------------|------------|
| JavaScript bundle lớn (~481KB) | Cao | ✅ Đã tách thành nhiều chunk |
| Ảnh nền tải từ Firebase Storage (mạng ngoài) | Cao | ✅ Đã `preload` + `preconnect` |
| Firebase SDK khởi tạo chậm | Trung bình | Cố hữu của Firebase |
| Font chữ / icon không cache | Thấp | Dùng hệ thống (Tailwind) |
| Animation (motion/framer-motion) | Trung bình | ✅ Đã tách chunk riêng |

### 2.3 Những Cải Tiến Đã Thực Hiện

**Giảm kích thước JavaScript:**
- Bundle ban đầu từ **1.7 MB → 481 KB** (giảm 72%)
- Gzip còn **~114 KB** truyền qua mạng
- 29 trang/component được lazy-load (chỉ tải khi cần)
- Tách riêng: React, Firebase, Animation, Icon, QR, Date, Excel

**Tối ưu ảnh:**
- Nén tự động trước khi upload lên Firebase
- WebP (nhỏ hơn JPEG 25–40%)
- Ảnh hero được `preload` để hiển thị sớm
- Kết nối Firebase Storage được thiết lập sớm bằng `preconnect`

**Cache & PWA:**
- Manifest PWA để cài app trên điện thoại
- Service Worker hỗ trợ offline
- Các tài sản tĩnh được cache trình duyệt

---

## 3. Hướng Dẫn Cho Nhân Viên – Sử Dụng Tối Ưu

### 3.1 Khi Đăng Ảnh Tour / Tuyến Đường

```
1. Chụp/lấy ảnh gốc từ máy ảnh hoặc nguồn
2. (Tùy chọn) Cắt ảnh về tỷ lệ 16:9 hoặc 4:3
3. Tải ảnh lên hệ thống → hệ thống tự nén
4. Kiểm tra preview ảnh sau khi tải lên
5. Lưu thông tin
```

### 3.2 Kiểm Tra Tốc Độ Trang (Dành Cho Quản Trị Viên)

Dùng [Google PageSpeed Insights](https://pagespeed.web.dev/) hoặc DevTools → Lighthouse:

1. Mở Chrome → F12 → tab **Lighthouse**
2. Chọn **Mobile** để kiểm tra tốc độ trên điện thoại
3. Nhấn **Analyze page load**
4. Xem điểm **Performance** (mục tiêu: ≥ 70)

### 3.3 Những Điều Cần Lưu Ý Khi Dùng Hệ Thống

- **Dùng trình duyệt mới nhất** (Chrome, Edge, Firefox, Safari) để có trải nghiệm tốt nhất
- **Kết nối internet ổn định** (≥ 5 Mbps) khi upload nhiều ảnh
- **Tránh mở quá nhiều tab** cùng lúc khi dùng hệ thống quản lý
- **Xóa cache trình duyệt** nếu gặp lỗi hiển thị (Ctrl+Shift+Del)

---

## 4. Kế Hoạch Cải Tiến Tiếp Theo (Đề Xuất)

| Hạng mục | Lợi ích | Độ ưu tiên |
|---------|---------|-----------|
| **CDN cho ảnh tĩnh** | Tải ảnh nhanh hơn 50–80% toàn cầu | Cao |
| **Ảnh mờ placeholder (LQIP)** | Không còn "vùng trắng" khi ảnh đang tải | Trung bình |
| **Lazy loading ảnh trong danh sách** | Tải ít ảnh hơn khi mới mở trang | Trung bình |
| **Server-Side Rendering (SSR)** | FCP nhanh hơn ~40% | Cao (cần refactor lớn) |
| **HTTP/2 Push** | Tải nhiều tài sản song song | Thấp (cần cấu hình server) |
| **Preload font tùy chỉnh** | Tránh FOUT (flash of unstyled text) | Thấp |
| **Brotli compression** | Nhỏ hơn gzip 10–15% | Trung bình |
| **Firestore offline persistence** | Dùng được khi mất mạng | Trung bình |

---

## 5. Liên Hệ Hỗ Trợ Kỹ Thuật

Nếu gặp vấn đề về tốc độ hoặc lỗi tải ảnh, vui lòng liên hệ nhóm kỹ thuật và cung cấp:

1. **Tên trình duyệt và phiên bản** (Chrome 120, Safari 17...)
2. **Kích thước file ảnh gốc** (MB)
3. **Thông báo lỗi** (nếu có – chụp màn hình)
4. **Bước tái hiện lỗi**

---

*Cập nhật lần cuối: 2026-03-25*
