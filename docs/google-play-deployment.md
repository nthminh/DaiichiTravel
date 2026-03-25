# Hướng Dẫn Đưa App Daiichi Travel Lên Google Play Store

Daiichi Travel đã là một **Progressive Web App (PWA)** hoàn chỉnh (có `manifest.json`, service worker `sw.js`, và các icon đủ chuẩn). Cách nhanh và chính thức nhất để đưa PWA lên Google Play Store là dùng **TWA (Trusted Web Activity)** — công nghệ của Android cho phép bọc một trang web PWA thành ứng dụng Android thực sự, không cần viết thêm code native.

---

## Tổng Quan

```
Daiichi Travel (PWA) → Bubblewrap CLI → Android App Bundle (.aab) → Google Play Console
```

---

## Yêu Cầu Trước Khi Bắt Đầu

| Điều kiện | Chi tiết |
|-----------|----------|
| Node.js ≥ 18 | `node -v` kiểm tra |
| Java JDK 17+ | [Tải tại adoptium.net](https://adoptium.net) |
| Android Studio (tùy chọn) | Dùng để test trên emulator |
| Tài khoản Google Play Console | Phí đăng ký một lần $25 |
| App đã deploy lên HTTPS | Domain công khai, ví dụ: `https://daiichitravel.web.app` |
| Lighthouse PWA score ≥ 80 | Kiểm tra trong Chrome DevTools |

---

## Bước 1: Kiểm Tra PWA Đủ Chuẩn

Trước khi đóng gói, đảm bảo PWA vượt qua checklist sau:

1. Mở Chrome → truy cập URL ứng dụng (production)
2. Nhấn `F12` → tab **Lighthouse** → chọn **Progressive Web App**
3. Chạy kiểm tra — đảm bảo không có lỗi đỏ nào
4. Đặc biệt kiểm tra:
   - ✅ HTTPS
   - ✅ `manifest.json` hợp lệ với `name`, `short_name`, `start_url`, `display: "standalone"`
   - ✅ Icon 192×192 và 512×512
   - ✅ Service worker đã đăng ký

> File `public/manifest.json` và `public/sw.js` của dự án đã sẵn sàng.

---

## Bước 2: Cài Đặt Bubblewrap CLI

Bubblewrap là công cụ chính thức của Google để tạo TWA app từ PWA.

```bash
npm install -g @bubblewrap/cli
```

Kiểm tra cài đặt:

```bash
bubblewrap --version
```

---

## Bước 3: Khởi Tạo Dự Án Android TWA

Tạo thư mục mới cho project Android (không nằm trong repo Daiichi Travel):

```bash
mkdir daiichi-twa && cd daiichi-twa
bubblewrap init --manifest https://daiichitravel.web.app/manifest.json
```

> **Thay `daiichitravel.web.app` bằng domain thực tế của bạn.**

Bubblewrap sẽ hỏi bạn một số câu hỏi — trả lời theo hướng dẫn dưới:

| Câu hỏi | Gợi ý trả lời |
|---------|---------------|
| Application ID | `com.daiichitravel.app` |
| App name | `Daiichi Travel` |
| Short name | `DaiichiTravel` |
| Host URL | `daiichitravel.web.app` |
| Start URL | `/` |
| Theme color | `#e63329` |
| Background color | `#c0392b` |
| Display mode | `standalone` |
| Orientation | `portrait` |
| Status bar color | `#e63329` |
| Splash screen fade | `300` |
| Min Android version | `19` (Android 4.4+) |
| Target Android version | `34` |
| Signing key (lần đầu) | Chọn **Create new** → đặt mật khẩu và lưu file `.keystore` |

> ⚠️ **Quan trọng**: Lưu file `.keystore` và mật khẩu ở nơi an toàn. Nếu mất, bạn không thể cập nhật app trên Play Store.

---

## Bước 4: Liên Kết Domain (Digital Asset Links)

Android yêu cầu xác minh rằng bạn sở hữu domain. Bubblewrap sẽ tạo nội dung file xác minh cho bạn.

### 4a. Lấy SHA-256 fingerprint của signing key

```bash
bubblewrap fingerprint
```

Lệnh này in ra một chuỗi dạng:
```
SHA-256 Certificate Fingerprint: AA:BB:CC:DD:...
```

### 4b. Tạo file `assetlinks.json`

Tạo file với nội dung sau, thay `AA:BB:CC:DD:...` bằng fingerprint thực:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.daiichitravel.app",
    "sha256_cert_fingerprints": ["AA:BB:CC:DD:EE:FF:..."]
  }
}]
```

### 4c. Deploy file xác minh

File phải truy cập được tại:
```
https://daiichitravel.web.app/.well-known/assetlinks.json
```

**Với Firebase Hosting**, thêm vào `firebase.json`:

```json
{
  "hosting": {
    "public": "dist",
    "rewrites": [...],
    "headers": [
      {
        "source": "/.well-known/assetlinks.json",
        "headers": [{ "key": "Content-Type", "value": "application/json" }]
      }
    ]
  }
}
```

Sau đó copy file vào thư mục `public/.well-known/assetlinks.json` và deploy:

```bash
firebase deploy --only hosting
```

### 4d. Xác minh

Truy cập URL sau trong trình duyệt — phải trả về JSON hợp lệ:
```
https://daiichitravel.web.app/.well-known/assetlinks.json
```

---

## Bước 5: Build Android App

Quay lại thư mục `daiichi-twa`:

```bash
cd daiichi-twa
bubblewrap build
```

Quá trình này sẽ:
1. Tải Android SDK nếu chưa có
2. Tạo project Android
3. Ký app bằng keystore đã tạo ở Bước 3
4. Tạo 2 file:
   - `app-release-signed.apk` — để test trực tiếp trên điện thoại
   - `app-release-bundle.aab` — **file upload lên Google Play**

---

## Bước 6: Test Trước Khi Submit

### Test trên điện thoại thật

1. Bật **Developer Options** trên điện thoại Android
2. Bật **USB Debugging**
3. Kết nối điện thoại qua USB
4. Chạy lệnh:
   ```bash
   adb install app-release-signed.apk
   ```
5. Mở app trên điện thoại và kiểm tra toàn bộ chức năng

### Kiểm tra Digital Asset Links

Trong app vừa cài, nếu Digital Asset Links chưa đúng, trình duyệt Chrome sẽ hiện thanh địa chỉ. Khi đúng, URL bar sẽ biến mất và app trông như native.

---

## Bước 7: Tạo App Trên Google Play Console

1. Truy cập [play.google.com/console](https://play.google.com/console)
2. Đăng nhập bằng tài khoản Google của bạn
3. Nhấn **Create app**
4. Điền thông tin:
   - **App name**: `Daiichi Travel`
   - **Default language**: `Vietnamese`
   - **App or game**: `App`
   - **Free or paid**: Chọn phù hợp
5. Nhấn **Create app**

---

## Bước 8: Điền Thông Tin App

### Mục "App content" (bắt buộc)

Trong menu trái → **Policy** → **App content**:

| Mục | Hướng dẫn |
|-----|-----------|
| Privacy policy | Cung cấp URL đến trang chính sách bảo mật của bạn |
| Ads | Chọn "No" nếu không có quảng cáo |
| App access | Nếu cần tài khoản để dùng app, cung cấp thông tin demo |
| Content rating | Điền bảng câu hỏi — app vận tải thường được rating **Everyone** |
| Target audience | Chọn nhóm tuổi phù hợp |
| Data safety | Khai báo loại dữ liệu thu thập (email, tên, vị trí nếu có) |

### Mục "Store listing"

Trong menu trái → **Grow** → **Store presence** → **Main store listing**:

| Mục | Chi tiết |
|-----|----------|
| App name | `Daiichi Travel` |
| Short description | Tóm tắt ≤ 80 ký tự, ví dụ: `Đặt vé xe khách Daiichi Travel nhanh chóng, tiện lợi` |
| Full description | Mô tả đầy đủ ≤ 4000 ký tự về tính năng app |
| App icon | Upload `icon-512.png` (512×512 PNG) |
| Feature graphic | Ảnh banner 1024×500 pixels (thiết kế riêng) |
| Screenshots | Tối thiểu 2 ảnh, khuyến nghị 4–8 ảnh chụp màn hình điện thoại |
| Phone screenshots | Ảnh chụp từ điện thoại Android (ratio 9:16 hoặc 2:1) |

---

## Bước 9: Upload App Bundle

1. Menu trái → **Release** → **Production** → **Create new release**
2. Nếu chưa cấu hình App Signing, nhấn **Continue** → Google Play sẽ quản lý signing key
3. Nhấn **Upload** → chọn file `app-release-bundle.aab`
4. Điền **Release name** (ví dụ: `1.0.0`) và **Release notes** (tiếng Việt):
   ```
   - Phiên bản đầu tiên
   - Đặt vé xe khách trực tuyến
   - Theo dõi chuyến đi real-time
   ```
5. Nhấn **Save** → **Review release**

---

## Bước 10: Submit và Chờ Duyệt

1. Sau khi review, nhấn **Start rollout to production**
2. Google sẽ review app trong **1–3 ngày làm việc** (lần đầu tiên có thể 7 ngày)
3. Theo dõi trạng thái trong mục **Release dashboard**
4. Khi được duyệt, app xuất hiện trên Play Store và người dùng có thể tìm kiếm và tải về

---

## Cập Nhật App Sau Khi Publish

Mỗi khi cần cập nhật:

1. Sửa code → build lại web app: `npm run build`
2. Deploy lên Firebase: `firebase deploy --only hosting`
3. Nếu cần cập nhật APK (thay đổi cấu hình TWA, icon, v.v.):
   ```bash
   cd daiichi-twa
   # Sửa twa-manifest.json nếu cần
   bubblewrap build
   ```
4. Trong Play Console → **Production** → **Create new release** → tăng **version code** → upload `.aab` mới

> ⚠️ **Quan trọng**: Mỗi lần upload `.aab` mới phải tăng `versionCode` trong `twa-manifest.json` (ví dụ: từ `1` lên `2`).

---

## Xử Lý Sự Cố Thường Gặp

| Vấn đề | Nguyên nhân | Giải pháp |
|--------|-------------|-----------|
| App hiển thị thanh địa chỉ Chrome | Digital Asset Links chưa đúng | Kiểm tra lại SHA-256 fingerprint và URL assetlinks.json |
| Build thất bại: JDK not found | JDK chưa cài hoặc chưa set `JAVA_HOME` | Cài JDK 17+ và set biến môi trường |
| Google Play từ chối app | Vi phạm chính sách nội dung | Đọc email từ Google và sửa theo yêu cầu |
| Lighthouse PWA score thấp | Thiếu offline support, icon chưa đủ | Cải thiện service worker và manifest |
| App bị crash khi mở | URL trong TWA không khớp | Kiểm tra `host` trong `twa-manifest.json` |

---

## Tài Liệu Tham Khảo

- [Bubblewrap CLI](https://github.com/GoogleChromeLabs/bubblewrap)
- [Trusted Web Activities Overview](https://developer.chrome.com/docs/android/trusted-web-activity)
- [Google Play Console Help](https://support.google.com/googleplay/android-developer)
- [Digital Asset Links Validator](https://developers.google.com/digital-asset-links/tools/generator)
- [PWA Checklist](https://web.dev/pwa-checklist)
