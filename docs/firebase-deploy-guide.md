# Hướng dẫn triển khai Firebase (Firebase Deploy Guide)

Tài liệu này mô tả từng bước để triển khai (deploy) DaiichiTravel lên Firebase, bao gồm cách khắc phục lỗi xung đột phiên bản phụ thuộc.

---

## Yêu cầu hệ thống

| Công cụ | Phiên bản tối thiểu |
|---------|---------------------|
| Node.js | 20.x |
| npm | 10.x |
| Firebase CLI | 13.x (`npm install -g firebase-tools`) |

Kiểm tra phiên bản hiện tại:

```bash
node --version    # >= v20.0.0
npm --version     # >= 10.0.0
firebase --version
```

---

## Quy trình deploy chuẩn (từng bước)

### Bước 1 – Kéo code mới nhất từ repository

```bash
git pull origin main
```

> Lệnh này tải về tất cả cập nhật mới nhất, bao gồm phiên bản `firebase-admin` và `firebase-functions` đã được sửa trong `functions/package.json`.

---

### Bước 2 – Cài đặt phụ thuộc cho Cloud Functions

```bash
npm --prefix functions install
```

Hoặc:

```bash
cd functions
npm install
cd ..
```

> Lệnh này đọc `functions/package.json` và `functions/package-lock.json`, cài đặt đúng các phiên bản đã được kiểm duyệt.

---

### Bước 3 – Build Cloud Functions (TypeScript → JavaScript)

```bash
npm --prefix functions run build
```

> Biên dịch `functions/src/index.ts` thành `functions/lib/index.js` để Firebase có thể thực thi.

---

### Bước 4 – Đăng nhập Firebase (nếu chưa đăng nhập)

```bash
firebase login
```

---

### Bước 5 – Deploy

**Chỉ deploy Cloud Functions:**

```bash
firebase deploy --only functions
```

**Chỉ deploy Hosting (giao diện web):**

```bash
npm run build
firebase deploy --only hosting
```

**Deploy toàn bộ (Functions + Hosting + Firestore rules + Storage rules):**

```bash
npm run build
firebase deploy
```

---

## Xử lý lỗi thường gặp

### ❌ Lỗi: ERESOLVE – Xung đột peer dependency `firebase-admin` / `firebase-functions`

**Thông báo lỗi đầy đủ:**

```
npm error code ERESOLVE
npm error ERESOLVE could not resolve

npm error While resolving: firebase-functions@4.9.0
npm error Found: firebase-admin@13.7.0
npm error   firebase-admin@"^13.7.0" from the root project

npm error Could not resolve dependency:
npm error peer firebase-admin@"^10.0.0 || ^11.0.0 || ^12.0.0" from firebase-functions@4.9.0

Error: functions predeploy error: Command terminated with non-zero exit code 1
```

**Nguyên nhân:**

`firebase-functions@4.x` chỉ hỗ trợ `firebase-admin` phiên bản 10, 11, hoặc 12. Nếu `firebase-admin` trong `functions/package.json` là `^13.x`, npm không thể giải quyết peer dependency và từ chối cài đặt.

**Cách khắc phục:**

1. Kéo phiên bản mới nhất của repo (đã có sẵn bản vá):

   ```bash
   git pull origin main
   ```

2. Xác nhận `functions/package.json` đang dùng phiên bản tương thích:

   ```bash
   cat functions/package.json | grep -E "firebase-(admin|functions)"
   ```

   Kết quả mong đợi:

   ```
   "firebase-admin": "^12.1.1",
   "firebase-functions": "^5.0.1",
   ```

3. Xóa thư mục `node_modules` cũ (nếu có) và cài lại:

   ```bash
   rm -rf functions/node_modules
   npm --prefix functions install
   ```

4. Build và deploy lại:

   ```bash
   npm --prefix functions run build
   firebase deploy --only functions
   ```

**Bảng tương thích phiên bản:**

| `firebase-functions` | `firebase-admin` được hỗ trợ |
|----------------------|------------------------------|
| `^4.x`               | `^10.x` / `^11.x` / `^12.x` |
| `^5.x`               | `^12.x` |
| `^6.x`               | `^12.x` / `^13.x` |

> ✅ Dự án hiện đang dùng `firebase-functions@^5.0.1` + `firebase-admin@^12.1.1` — tương thích hoàn toàn.

---

### ❌ Lỗi: `firebase: command not found`

Cài Firebase CLI toàn cục:

```bash
npm install -g firebase-tools
firebase login
```

---

### ❌ Lỗi: TypeScript build thất bại

```bash
npm --prefix functions run lint
```

Sửa các lỗi TypeScript báo ra trong `functions/src/index.ts`, sau đó build lại:

```bash
npm --prefix functions run build
```

---

## Cấu hình predeploy (firebase.json)

Dự án đã cấu hình sẵn các lệnh predeploy trong `firebase.json`:

```json
"predeploy": [
  "npm --prefix \"$RESOURCE_DIR\" install",
  "npm --prefix \"$RESOURCE_DIR\" run build"
]
```

Khi chạy `firebase deploy --only functions`, Firebase tự động:
1. Chạy `npm --prefix functions install`
2. Chạy `npm --prefix functions run build`
3. Upload code lên Google Cloud Functions

---

## Xem log sau khi deploy

```bash
firebase functions:log
```

Hoặc xem trực tiếp trên Firebase Console → Functions → Logs.
