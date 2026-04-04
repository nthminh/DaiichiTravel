/**
 * migrate.mjs  –  Chuyển dữ liệu từ Firebase Firestore sang Supabase PostgreSQL
 *
 * Phạm vi:
 *   - 1 dòng trips   (dòng đầu tiên trong collection 'trips')
 *   - Tất cả dòng route_fares
 *   - Tất cả dòng route_seat_fares
 *
 * Cách dùng:
 *   1. Cài đặt firebase-admin (nếu chưa có):
 *        npm install firebase-admin --save-dev
 *   2. Đặt file service account JSON của Firebase vào thư mục gốc,
 *      ví dụ: serviceAccountKey.json
 *   3. Cài các biến môi trường (hoặc tạo file .env.migrate):
 *        FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
 *        SUPABASE_URL=https://xxxx.supabase.co
 *        SUPABASE_SERVICE_ROLE_KEY=eyJ...   ← dùng service_role, KHÔNG dùng anon key
 *   4. Chạy:
 *        node migrate.mjs
 *
 * Lưu ý:
 *   - Script dùng MD5 hash để tạo UUID xác định (deterministic) từ Firebase doc ID,
 *     nên chạy lại nhiều lần vẫn cho cùng kết quả (idempotent).
 *   - Bản ghi đã tồn tại trong Supabase sẽ được CẬP NHẬT (upsert), không bị trùng.
 *   - Bookings liên quan KHÔNG bị ảnh hưởng vì UUID giữ nguyên.
 */

import { createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import admin from 'firebase-admin';

// ─── 1. Load cấu hình ─────────────────────────────────────────────────────────

// Đọc .env.migrate nếu có (không bắt buộc, có thể dùng biến môi trường hệ thống)
const envFile = '.env.migrate';
if (existsSync(envFile)) {
  const lines = readFileSync(envFile, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !process.env[key]) process.env[key] = val;
  }
}

const {
  FIREBASE_SERVICE_ACCOUNT_PATH = './serviceAccountKey.json',
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌  Thiếu biến môi trường SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!existsSync(FIREBASE_SERVICE_ACCOUNT_PATH)) {
  console.error(`❌  Không tìm thấy file service account: ${FIREBASE_SERVICE_ACCOUNT_PATH}`);
  process.exit(1);
}

// ─── 2. Khởi tạo Firebase Admin ───────────────────────────────────────────────

const serviceAccount = JSON.parse(readFileSync(FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ─── 3. Khởi tạo Supabase client (service_role – bypass RLS) ─────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ─── 4. Tiện ích ──────────────────────────────────────────────────────────────

/**
 * Tạo UUID xác định (deterministic UUID v4 format) từ bất kỳ chuỗi nào.
 * Cùng Firebase doc ID → cùng UUID → idempotent khi chạy lại.
 */
function toUUID(str) {
  const hash = createHash('md5').update(str).digest('hex');
  // Định dạng: 8-4-4-4-12 ký tự hex
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join('-');
}

/**
 * Chuyển camelCase → snake_case (chỉ cấp top-level).
 * JSONB fields (seats, addons) giữ nguyên camelCase bên trong.
 */
function toSnake(key) {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function toSnakeCaseObj(obj) {
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => [toSnake(k), v]),
  );
}

/** Chia mảng thành các chunk nhỏ hơn để batch insert */
function chunks(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

// ─── 5. Migrate Trips ─────────────────────────────────────────────────────────

async function migrateTrips() {
  console.log('\n📦  Đang tải 1 trip từ Firebase...');

  // Chỉ lấy 1 dòng đầu tiên trong collection 'trips'
  const snapshot = await db.collection('trips').limit(1).get();
  if (snapshot.empty) {
    console.log('ℹ️   Không có trip nào trong Firebase.');
    return { total: 0, inserted: 0, errors: 0 };
  }

  console.log(`✅  Tải xong 1 trip từ Firebase.`);

  const rows = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // Chuyển Firebase doc → Supabase row
    const trip = {
      id: toUUID(doc.id),              // deterministic UUID từ Firebase doc ID
      route: data.route ?? null,
      time: data.time ?? null,
      date: data.date ?? null,
      license_plate: data.licensePlate ?? null,
      driver_name: data.driverName ?? null,
      status: data.status ?? 'WAITING',
      seats: data.seats ?? [],          // JSONB – giữ nguyên camelCase bên trong
      price: data.price ?? null,
      agent_price: data.agentPrice ?? null,
      discount_percent: data.discountPercent ?? null,
      addons: data.addons ?? null,      // JSONB
      note: data.note ?? null,
      seat_type: data.seatType ?? null,
      is_merged: data.isMerged ?? false,
      merged_from_trip_ids: data.mergedFromTripIds ?? null,
      // Ưu tiên updatedAt từ Firebase, fallback về now()
      updated_at: data.updatedAt
        ? new Date(data.updatedAt).toISOString()
        : new Date().toISOString(),
    };

    rows.push(trip);
  }

  // Upsert theo batch 100 rows (tránh payload quá lớn)
  let inserted = 0;
  let errors = 0;
  const BATCH_SIZE = 100;

  for (const batch of chunks(rows, BATCH_SIZE)) {
    const { error } = await supabase
      .from('trips')
      .upsert(batch, { onConflict: 'id' });

    if (error) {
      console.error(`❌  Lỗi khi upsert batch: ${error.message}`);
      errors += batch.length;
    } else {
      inserted += batch.length;
      process.stdout.write(`   → Đã upsert ${inserted}/${rows.length} trips...\r`);
    }
  }

  console.log(`\n✅  Hoàn thành trips: ${inserted} thành công, ${errors} lỗi.`);
  return { total: rows.length, inserted, errors };
}

// ─── 6. Migrate RouteFares ────────────────────────────────────────────────────

async function migrateRouteFares() {
  console.log('\n📦  Đang tải route_fares từ Firebase...');

  // Lấy tất cả routes để biết routeId → Supabase UUID
  const routesSnap = await db.collection('routes').get();
  const routeIdMap = {};
  for (const rdoc of routesSnap.docs) {
    routeIdMap[rdoc.id] = toUUID(rdoc.id);
  }

  // Lấy tất cả stops để biết stopId → Supabase UUID
  const stopsSnap = await db.collection('stops').get();
  const stopIdMap = {};
  for (const sdoc of stopsSnap.docs) {
    stopIdMap[sdoc.id] = toUUID(sdoc.id);
  }

  let total = 0;
  let inserted = 0;
  let errors = 0;

  for (const [firebaseRouteId, supabaseRouteId] of Object.entries(routeIdMap)) {
    const faresSnap = await db
      .collection('routeFares')
      .doc(firebaseRouteId)
      .collection('fares')
      .get();

    if (faresSnap.empty) continue;

    const rows = [];
    for (const fdoc of faresSnap.docs) {
      const d = fdoc.data();
      rows.push({
        id: toUUID(fdoc.id + '_' + firebaseRouteId),
        route_id: supabaseRouteId,
        from_stop_id: stopIdMap[d.fromStopId] ?? null,
        to_stop_id: stopIdMap[d.toStopId] ?? null,
        price: d.price ?? null,
        agent_price: d.agentPrice ?? null,
        currency: d.currency ?? 'VND',
        active: d.active ?? true,
        updated_at: d.updatedAt ? new Date(d.updatedAt).toISOString() : new Date().toISOString(),
        start_date: d.startDate ?? null,
        end_date: d.endDate ?? null,
        sort_order: d.sortOrder ?? null,
        fare_doc_id: fdoc.id,
      });
    }

    total += rows.length;

    for (const batch of chunks(rows, 100)) {
      const { error } = await supabase
        .from('route_fares')
        .upsert(batch, { onConflict: 'fare_doc_id' });

      if (error) {
        console.error(`❌  route_fares batch lỗi: ${error.message}`);
        errors += batch.length;
      } else {
        inserted += batch.length;
        process.stdout.write(`   → route_fares: ${inserted}/${total}...\r`);
      }
    }
  }

  console.log(`\n✅  Hoàn thành route_fares: ${inserted}/${total} thành công, ${errors} lỗi.`);
  return { total, inserted, errors };
}

// ─── 7. Migrate RouteSeatFares ────────────────────────────────────────────────

async function migrateRouteSeatFares() {
  console.log('\n📦  Đang tải route_seat_fares từ Firebase...');

  // Lấy tất cả routes để biết routeId → Supabase UUID
  const routesSnap = await db.collection('routes').get();
  const routeIdMap = {};
  for (const rdoc of routesSnap.docs) {
    routeIdMap[rdoc.id] = toUUID(rdoc.id);
  }

  let total = 0;
  let inserted = 0;
  let errors = 0;

  for (const [firebaseRouteId, supabaseRouteId] of Object.entries(routeIdMap)) {
    const seatsSnap = await db
      .collection('routeSeatFares')
      .doc(firebaseRouteId)
      .collection('seats')
      .get();

    if (seatsSnap.empty) continue;

    const rows = [];
    for (const sdoc of seatsSnap.docs) {
      const d = sdoc.data();
      rows.push({
        id: toUUID(sdoc.id + '_seat_' + firebaseRouteId),
        route_id: supabaseRouteId,
        seat_id: d.seatId ?? sdoc.id,
        price: d.price ?? null,
        agent_price: d.agentPrice ?? null,
        start_date: d.startDate ?? null,
        end_date: d.endDate ?? null,
        note: d.note ?? null,
        active: d.active ?? true,
        updated_at: d.updatedAt ? new Date(d.updatedAt).toISOString() : new Date().toISOString(),
        fare_doc_id: sdoc.id,
      });
    }

    total += rows.length;

    for (const batch of chunks(rows, 100)) {
      const { error } = await supabase
        .from('route_seat_fares')
        .upsert(batch, { onConflict: 'fare_doc_id' });

      if (error) {
        console.error(`❌  route_seat_fares batch lỗi: ${error.message}`);
        errors += batch.length;
      } else {
        inserted += batch.length;
        process.stdout.write(`   → route_seat_fares: ${inserted}/${total}...\r`);
      }
    }
  }

  console.log(`\n✅  Hoàn thành route_seat_fares: ${inserted}/${total} thành công, ${errors} lỗi.`);
  return { total, inserted, errors };
}

// ─── 8. Main ──────────────────────────────────────────────────────────────────

(async () => {
  console.log('='.repeat(60));
  console.log('  MIGRATE: Firebase → Supabase  (1 trip + tất cả route_fares + route_seat_fares)');
  console.log('='.repeat(60));

  const start = Date.now();

  try {
    const tripsResult = await migrateTrips();
    const faresResult = await migrateRouteFares();
    const seatFaresResult = await migrateRouteSeatFares();

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log('\n' + '='.repeat(60));
    console.log(`  Trips (1 dòng):   ${tripsResult.inserted}/${tripsResult.total} upserted`);
    console.log(`  Route fares:      ${faresResult.inserted}/${faresResult.total} upserted`);
    console.log(`  Route seat fares: ${seatFaresResult.inserted}/${seatFaresResult.total} upserted`);
    console.log(`  Thời gian: ${elapsed}s`);
    const totalErrors = tripsResult.errors + faresResult.errors + seatFaresResult.errors;
    if (totalErrors > 0) {
      console.log(`  ⚠️  ${totalErrors} bản ghi gặp lỗi – xem log ở trên.`);
    }
    console.log('='.repeat(60));
  } catch (err) {
    console.error('\n❌  Lỗi không xử lý được:', err);
    process.exit(1);
  } finally {
    // Đóng kết nối Firebase
    await admin.app().delete();
  }
})();
