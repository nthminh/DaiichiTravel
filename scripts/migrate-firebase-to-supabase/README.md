# Firebase → Supabase Migration Script

Script Node.js để di chuyển toàn bộ dữ liệu từ **Firebase Firestore** sang **Supabase PostgreSQL** (one-time migration).

## Yêu cầu

- Node.js 18+
- Firebase Service Account JSON (có quyền đọc Firestore)
- Supabase `service_role` key (không phải `anon` key)

---

## Hướng dẫn sử dụng

### Bước 1: Cài đặt dependencies

```bash
cd /tmp/migrate
npm install
```

### Bước 2: Lấy Firebase Service Account Key

1. Vào [Firebase Console](https://console.firebase.google.com)
2. **Project Settings** → tab **Service accounts**
3. Click **Generate new private key** → tải file JSON
4. Đặt file vào `/tmp/migrate/serviceAccountKey.json`

### Bước 3: Tạo file `.env`

```bash
cp .env.example .env
```

Điền thông tin vào `.env`:
```env
FIREBASE_SERVICE_ACCOUNT_KEY_PATH=./serviceAccountKey.json
SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...    # lấy từ Supabase Dashboard → Settings → API
```

> ⚠️ **QUAN TRỌNG**: Dùng `service_role` key (không phải `anon` key).  
> Lấy tại: Supabase Dashboard → **Settings** → **API** → **Project API keys** → `service_role secret`

### Bước 4: Chạy migration

```bash
node migrate.mjs
# hoặc
npm run migrate
```

---

## Kết quả mong đợi

```
=== Firebase → Supabase Migration ===

--- Pre-loading IDs ---
  vehicleTypes: 5 IDs  vehicles: 12 IDs  ...

Migrating vehicleTypes → vehicle_types ... ✓ 5 records
Migrating vehicles → vehicles ... ✓ 12 records
...
Migrating subcollection routeFares → route_fares ... ✓ 48 fare records
Migrating subcollection routeSeatFares → route_seat_fares ... ✓ 0 seat fare records
Migrating subcollection properties/roomTypes → property_room_types ... ✓ 6 room type records

══════════════════════════════════════════
✅  Migration hoàn thành!
   Tổng ID đã map: 234
══════════════════════════════════════════
```

---

## Xử lý đặc biệt

| Vấn đề | Giải pháp trong script |
|---|---|
| Firebase IDs không phải UUID | Sinh UUID mới, map `firebaseId → UUID` trong memory |
| Firestore Timestamps | Convert `.toDate().toISOString()` đệ quy |
| Foreign keys | Map ID parent trước, rồi mới insert child |
| `settings` table (`id = TEXT`) | Giữ nguyên string ID ('permissions', etc.) |
| `pending_payments` (`id = TEXT`) | Giữ nguyên payment reference string |
| Subcollections | Flatten thành flat table với FK cột |
| Chạy lại (idempotent) | Dùng `upsert` với `onConflict: 'id'` hoặc `'fare_doc_id'` |

---

## Thứ tự insert (quan trọng vì foreign keys)

```
vehicle_types, vehicles, stops
→ routes → route_fares, route_seat_fares
→ trips → bookings, consignments, driver_assignments, staff_messages
→ agents (referenced by bookings, invoices)
→ employees (referenced by driver_assignments)
→ customers (referenced by bookings, category_requests)
→ properties → property_room_types
→ tours (references properties)
→ customer_categories → category_requests
→ pending_payments, invoices, inquiries
→ audit_logs, user_guides, settings
```

---

## Sau khi migration

1. **Kiểm tra row count** trong Supabase Dashboard
2. **Test ứng dụng** với Supabase
3. **Xóa file `.env` và `serviceAccountKey.json`** để bảo mật
