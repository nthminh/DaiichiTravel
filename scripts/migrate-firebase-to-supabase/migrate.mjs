/**
 * Firebase Firestore → Supabase PostgreSQL Migration Script
 * ============================================================
 * Usage:
 *   1. npm install (trong thư mục này)
 *   2. Đặt file serviceAccountKey.json (Firebase Service Account)
 *   3. Tạo file .env (xem .env.example)
 *   4. node migrate.mjs
 *
 * Lưu ý:
 *   - Dùng SUPABASE_SERVICE_ROLE_KEY (không phải anon key) để bypass RLS
 *   - Firebase doc IDs không phải UUID → script sinh UUID mới + giữ mapping
 *   - Firestore Timestamps được convert sang ISO 8601
 *   - Chạy idempotent: nếu chạy lại sẽ upsert (không duplicate)
 */

import admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import 'dotenv/config';

// ─── Khởi tạo Firebase Admin ──────────────────────────────────────────────────

const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH ?? './serviceAccountKey.json';
const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ─── Khởi tạo Supabase (service_role để bypass RLS) ──────────────────────────

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// ─── ID Mapping (Firebase string ID → UUID) ───────────────────────────────────
// Cần thiết vì Supabase dùng UUID PK, còn Firebase dùng string tự động
const idMap = new Map(); // firebaseId → uuid

function getOrCreateUUID(firebaseId) {
  if (!firebaseId) return null;
  if (!idMap.has(firebaseId)) {
    idMap.set(firebaseId, randomUUID());
  }
  return idMap.get(firebaseId);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** camelCase → snake_case (chỉ top-level key) */
function toSnake(key) {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/** Đệ quy convert Firestore Timestamp → ISO string trong bất kỳ value nào */
function convertValue(val) {
  if (val === null || val === undefined) return val;

  // Firestore Timestamp
  if (typeof val?.toDate === 'function') {
    return val.toDate().toISOString();
  }

  // Array
  if (Array.isArray(val)) {
    return val.map(convertValue);
  }

  // Plain object (JSONB columns giữ nguyên camelCase bên trong)
  if (typeof val === 'object' && val.constructor === Object) {
    return Object.fromEntries(
      Object.entries(val).map(([k, v]) => [k, convertValue(v)]),
    );
  }

  return val;
}

/**
 * Convert top-level keys từ camelCase → snake_case,
 * đồng thời convert Timestamps ở tất cả các cấp.
 */
function toSnakeCaseObj(obj) {
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => [toSnake(k), convertValue(v)]),
  );
}

/** Insert/upsert batch vào Supabase, tối đa 500 rows mỗi lần */
async function upsertBatch(tableName, rows, conflictCol = 'id') {
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from(tableName)
      .upsert(chunk, { onConflict: conflictCol });
    if (error) {
      console.error(`  ✗ ${tableName} [batch ${i}–${i + chunk.length}]:`, error.message);
    }
  }
}

// ─── Migration helpers ────────────────────────────────────────────────────────

/**
 * Migrate một collection đơn giản.
 * @param {string} collectionName  - Firestore collection
 * @param {string} tableName       - Supabase table
 * @param {Function} transform     - Nhận doc (có .id), trả về object sẽ insert
 */
async function migrateCollection(collectionName, tableName, transform) {
  process.stdout.write(`Migrating ${collectionName} → ${tableName} ... `);
  const snapshot = await db.collection(collectionName).get();
  if (snapshot.empty) {
    console.log('(empty)');
    return;
  }

  const rows = snapshot.docs.map((doc) => {
    const data = { id: doc.id, ...doc.data() };
    return transform ? transform(data) : defaultTransform(data);
  });

  await upsertBatch(tableName, rows);
  console.log(`✓ ${snapshot.size} records`);
}

/**
 * Transform mặc định: sinh UUID mới cho doc, giữ Firebase ID trong idMap,
 * convert tất cả keys và timestamps.
 */
function defaultTransform(doc) {
  const uuid = getOrCreateUUID(doc.id);
  // eslint-disable-next-line no-unused-vars
  const { id: _firebaseId, ...rest } = doc;
  return { id: uuid, ...toSnakeCaseObj(rest) };
}

// ─── Main migration ───────────────────────────────────────────────────────────

async function main() {
  console.log('=== Firebase → Supabase Migration ===\n');

  // ── BƯỚC 1: Pre-load Firebase IDs cho tất cả parent tables ──────────────
  // Cần làm trước để foreign key references có UUID đúng khi insert children.
  console.log('--- Pre-loading IDs ---');

  const idCollections = [
    'vehicleTypes', 'vehicles', 'stops', 'routes', 'trips',
    'agents', 'employees', 'users', 'bookings', 'invoices',
    'inquiries', 'consignments', 'driverAssignments', 'staffMessages',
    'auditLogs', 'userGuides', 'customerCategories', 'categoryRequests',
    'properties', 'tours',
  ];

  for (const col of idCollections) {
    const snap = await db.collection(col).get();
    snap.docs.forEach((d) => getOrCreateUUID(d.id));
    process.stdout.write(`  ${col}: ${snap.size} IDs  `);
  }
  console.log('\n');

  // ── BƯỚC 2: Insert theo thứ tự (parent trước, child sau) ─────────────────

  // 1. vehicle_types
  await migrateCollection('vehicleTypes', 'vehicle_types', (doc) => {
    const uuid = getOrCreateUUID(doc.id);
    return toSnakeCaseObj({ id: uuid, name: doc.name, order: doc.order });
  });

  // 2. vehicles
  await migrateCollection('vehicles', 'vehicles', (doc) => {
    const uuid = getOrCreateUUID(doc.id);
    return toSnakeCaseObj({
      id: uuid,
      stt: doc.stt,
      licensePlate: doc.licensePlate,
      phone: doc.phone,
      type: doc.type,
      seats: doc.seats,
      registrationExpiry: doc.registrationExpiry,
      status: doc.status,
      ownerId: doc.ownerId,
      layout: doc.layout ?? null,
      note: doc.note,
      seatType: doc.seatType,
    });
  });

  // 3. stops
  await migrateCollection('stops', 'stops', (doc) => {
    const uuid = getOrCreateUUID(doc.id);
    return toSnakeCaseObj({
      id: uuid,
      name: doc.name,
      address: doc.address,
      category: doc.category,
      surcharge: doc.surcharge,
      distanceKm: doc.distanceKm,
      note: doc.note,
      type: doc.type,
      // terminalId là tham chiếu đến stop khác → cần map
      terminalId: doc.terminalId ? getOrCreateUUID(doc.terminalId) : null,
      priority: doc.priority,
      vehicleTypes: doc.vehicleTypes ?? null,
      stt: doc.stt,
    });
  });

  // 4. routes
  await migrateCollection('routes', 'routes', (doc) => {
    const uuid = getOrCreateUUID(doc.id);
    return toSnakeCaseObj({
      id: uuid,
      stt: doc.stt,
      name: doc.name,
      note: doc.note,
      departurePoint: doc.departurePoint,
      arrivalPoint: doc.arrivalPoint,
      price: doc.price,
      agentPrice: doc.agentPrice,
      pricePeriods: doc.pricePeriods ?? null,
      surcharges: doc.surcharges ?? null,
      details: doc.details,
      routeStops: doc.routeStops ?? null,
      disablePickupAddress: doc.disablePickupAddress,
      disableDropoffAddress: doc.disableDropoffAddress,
      duration: doc.duration,
      departureOffsetMinutes: doc.departureOffsetMinutes,
      arrivalOffsetMinutes: doc.arrivalOffsetMinutes,
      imageUrl: doc.imageUrl,
      images: doc.images ?? null,
      vehicleImageUrl: doc.vehicleImageUrl,
      updatedAt: doc.updatedAt,
      childPricingRules: doc.childPricingRules ?? null,
      routeCategory: doc.routeCategory,
      addons: doc.addons ?? null,
    });
  });

  // 5. trips (không có FK UUID quan trọng, route/vehicle là text)
  await migrateCollection('trips', 'trips', (doc) => {
    const uuid = getOrCreateUUID(doc.id);
    return toSnakeCaseObj({
      id: uuid,
      route: doc.route,
      time: doc.time,
      date: doc.date,
      licensePlate: doc.licensePlate,
      driverName: doc.driverName,
      status: doc.status ?? 'WAITING',
      seats: doc.seats ?? null,
      price: doc.price,
      agentPrice: doc.agentPrice,
      discountPercent: doc.discountPercent,
      addons: doc.addons ?? null,
      note: doc.note,
      seatType: doc.seatType,
      isMerged: doc.isMerged ?? false,
      mergedFromTripIds: doc.mergedFromTripIds ?? null,
      updatedAt: doc.updatedAt,
    });
  });

  // 6. agents
  await migrateCollection('agents', 'agents', (doc) => {
    const uuid = getOrCreateUUID(doc.id);
    return toSnakeCaseObj({
      id: uuid,
      code: doc.code,
      name: doc.name,
      phone: doc.phone,
      email: doc.email,
      address: doc.address,
      commissionRate: doc.commissionRate,
      balance: doc.balance ?? 0,
      status: doc.status ?? 'ACTIVE',
      username: doc.username,
      password: doc.password,
      note: doc.note,
      paymentType: doc.paymentType,
      creditLimit: doc.creditLimit,
      depositAmount: doc.depositAmount,
      allowedPaymentOptions: doc.allowedPaymentOptions ?? null,
      holdTicketHours: doc.holdTicketHours,
      routeCommissionRates: doc.routeCommissionRates ?? null,
      updatedAt: doc.updatedAt,
    });
  });

  // 7. employees
  await migrateCollection('employees', 'employees', (doc) => {
    const uuid = getOrCreateUUID(doc.id);
    return toSnakeCaseObj({
      id: uuid,
      name: doc.name,
      phone: doc.phone,
      email: doc.email,
      address: doc.address,
      role: doc.role,
      position: doc.position,
      status: doc.status ?? 'ACTIVE',
      username: doc.username,
      password: doc.password,
      note: doc.note,
      updatedAt: doc.updatedAt,
    });
  });

  // 8. customers (Firestore collection = 'users')
  await migrateCollection('users', 'customers', (doc) => {
    const uuid = getOrCreateUUID(doc.id);
    return toSnakeCaseObj({
      id: uuid,
      username: doc.username,
      role: doc.role,
      name: doc.name,
      phone: doc.phone,
      email: doc.email,
      address: doc.address,
      agentCode: doc.agentCode,
      balance: doc.balance ?? 0,
      password: doc.password,
      status: doc.status ?? 'ACTIVE',
      registeredAt: doc.registeredAt,
      totalBookings: doc.totalBookings ?? 0,
      totalSpent: doc.totalSpent ?? 0,
      lastActivityAt: doc.lastActivityAt,
      categoryId: doc.categoryId ? getOrCreateUUID(doc.categoryId) : null,
      categoryName: doc.categoryName,
      categoryVerificationStatus: doc.categoryVerificationStatus,
      categoryProofImageUrl: doc.categoryProofImageUrl,
      firebaseUid: doc.firebaseUid ?? doc.id, // giữ firebase UID gốc
      loginMethod: doc.loginMethod,
      viewedRoutes: doc.viewedRoutes ?? null,
      viewedTours: doc.viewedTours ?? null,
      bookedRoutes: doc.bookedRoutes ?? null,
      preferences: doc.preferences ?? null,
    });
  });

  // 9. properties
  await migrateCollection('properties', 'properties', (doc) => {
    const uuid = getOrCreateUUID(doc.id);
    return toSnakeCaseObj({
      id: uuid,
      name: doc.name,
      ownerId: doc.ownerId ? getOrCreateUUID(doc.ownerId) : null,
      country: doc.country,
      type: doc.type,
      address: doc.address,
      description: doc.description,
      images: doc.images ?? null,
      createdAt: doc.createdAt,
    });
  });

  // 10. tours
  await migrateCollection('tours', 'tours', (doc) => {
    const uuid = getOrCreateUUID(doc.id);
    return toSnakeCaseObj({
      id: uuid,
      title: doc.title,
      description: doc.description,
      price: doc.price,
      imageUrl: doc.imageUrl,
      images: doc.images ?? null,
      discountPercent: doc.discountPercent,
      priceAdult: doc.priceAdult,
      priceChild: doc.priceChild,
      numAdults: doc.numAdults,
      numChildren: doc.numChildren,
      duration: doc.duration,
      nights: doc.nights,
      pricePerNight: doc.pricePerNight,
      breakfastCount: doc.breakfastCount,
      pricePerBreakfast: doc.pricePerBreakfast,
      surcharge: doc.surcharge,
      surchargeNote: doc.surchargeNote,
      youtubeUrl: doc.youtubeUrl,
      startDate: doc.startDate,
      endDate: doc.endDate,
      departureTime: doc.departureTime,
      departureLocation: doc.departureLocation,
      returnTime: doc.returnTime,
      returnLocation: doc.returnLocation,
      roomTypes: doc.roomTypes ?? null,
      itinerary: doc.itinerary ?? null,
      addons: doc.addons ?? null,
      linkedPropertyId: doc.linkedPropertyId ? getOrCreateUUID(doc.linkedPropertyId) : null,
      childPricingRules: doc.childPricingRules ?? null,
      createdAt: doc.createdAt,
    });
  });

  // 11. customer_categories
  await migrateCollection('customerCategories', 'customer_categories', (doc) => {
    const uuid = getOrCreateUUID(doc.id);
    return toSnakeCaseObj({
      id: uuid,
      name: doc.name,
      description: doc.description,
      color: doc.color,
      sortOrder: doc.sortOrder,
    });
  });

  // 12. bookings
  await migrateCollection('bookings', 'bookings', (doc) => {
    const uuid = getOrCreateUUID(doc.id);
    return toSnakeCaseObj({
      id: uuid,
      type: doc.type ?? 'TICKET',
      userId: doc.userId ? getOrCreateUUID(doc.userId) : null,
      customerName: doc.customerName,
      customerPhone: doc.customerPhone,
      totalAmount: doc.totalAmount,
      status: doc.status ?? 'PENDING',
      createdAt: doc.createdAt,
      tripId: doc.tripId ? getOrCreateUUID(doc.tripId) : null,
      seats: doc.seats ?? null,
      tourId: doc.tourId ? getOrCreateUUID(doc.tourId) : null,
      adults: doc.adults,
      children: doc.children,
      selectedAddons: doc.selectedAddons ?? null,
      selectedRoomTypeId: doc.selectedRoomTypeId,
      selectedRoomTypeName: doc.selectedRoomTypeName,
      ticketCode: doc.ticketCode,
      agentId: doc.agentId ? getOrCreateUUID(doc.agentId) : null,
      paymentMethod: doc.paymentMethod,
      bookingDate: doc.bookingDate,
      pickupAddress: doc.pickupAddress,
      dropoffAddress: doc.dropoffAddress,
      fromStopId: doc.fromStopId,
      toStopId: doc.toStopId,
      note: doc.note,
      fareAmount: doc.fareAmount,
      discountAmount: doc.discountAmount,
      segmentInfo: doc.segmentInfo ?? null,
    });
  });

  // 13. invoices
  await migrateCollection('invoices', 'invoices', (doc) => {
    const uuid = getOrCreateUUID(doc.id);
    return toSnakeCaseObj({
      id: uuid,
      invoiceNumber: doc.invoiceNumber,
      type: doc.type,
      customerId: doc.customerId ? getOrCreateUUID(doc.customerId) : null,
      customerName: doc.customerName,
      customerPhone: doc.customerPhone,
      agentId: doc.agentId ? getOrCreateUUID(doc.agentId) : null,
      agentName: doc.agentName,
      items: doc.items ?? null,
      subtotal: doc.subtotal,
      discount: doc.discount,
      tax: doc.tax,
      total: doc.total,
      paidAmount: doc.paidAmount,
      debtAmount: doc.debtAmount,
      status: doc.status ?? 'UNPAID',
      paymentMethod: doc.paymentMethod,
      dueDate: doc.dueDate,
      createdAt: doc.createdAt,
      notes: doc.notes,
    });
  });

  // 14. inquiries
  await migrateCollection('inquiries', 'inquiries', (doc) => {
    const uuid = getOrCreateUUID(doc.id);
    return toSnakeCaseObj({
      id: uuid,
      name: doc.name,
      phone: doc.phone,
      email: doc.email,
      from: doc.from,
      to: doc.to,
      date: doc.date,
      returnDate: doc.returnDate,
      adults: doc.adults,
      children: doc.children,
      notes: doc.notes,
      tripType: doc.tripType,
      phase: doc.phase,
      createdAt: doc.createdAt,
    });
  });

  // 15. consignments
  await migrateCollection('consignments', 'consignments', (doc) => {
    const uuid = getOrCreateUUID(doc.id);
    return toSnakeCaseObj({
      id: uuid,
      senderName: doc.senderName,
      senderPhone: doc.senderPhone,
      receiverName: doc.receiverName,
      receiverPhone: doc.receiverPhone,
      status: doc.status ?? 'PENDING',
      qrCode: doc.qrCode,
      photoUrl: doc.photoUrl,
      type: doc.type,
      weight: doc.weight,
      cod: doc.cod,
      items: doc.items ?? null,
      routeId: doc.routeId ? getOrCreateUUID(doc.routeId) : null,
      tripId: doc.tripId ? getOrCreateUUID(doc.tripId) : null,
      createdAt: doc.createdAt,
      notes: doc.notes,
    });
  });

  // 16. driver_assignments
  await migrateCollection('driverAssignments', 'driver_assignments', (doc) => {
    const uuid = getOrCreateUUID(doc.id);
    return toSnakeCaseObj({
      id: uuid,
      tripId: doc.tripId ? getOrCreateUUID(doc.tripId) : null,
      seatId: doc.seatId,
      seatIds: doc.seatIds ?? null,
      tripRoute: doc.tripRoute,
      tripDate: doc.tripDate,
      tripTime: doc.tripTime,
      licensePlate: doc.licensePlate,
      customerName: doc.customerName,
      customerPhone: doc.customerPhone,
      adults: doc.adults,
      children: doc.children,
      pickupAddress: doc.pickupAddress,
      dropoffAddress: doc.dropoffAddress,
      pickupAddressDetail: doc.pickupAddressDetail,
      dropoffAddressDetail: doc.dropoffAddressDetail,
      pickupStopAddress: doc.pickupStopAddress,
      dropoffStopAddress: doc.dropoffStopAddress,
      taskType: doc.taskType,
      driverEmployeeId: doc.driverEmployeeId ? getOrCreateUUID(doc.driverEmployeeId) : null,
      driverName: doc.driverName,
      assignedBy: doc.assignedBy,
      assignedAt: doc.assignedAt,
      status: doc.status ?? 'pending',
      respondedAt: doc.respondedAt,
      completedAt: doc.completedAt,
      rejectionReason: doc.rejectionReason,
      note: doc.note,
    });
  });

  // 17. staff_messages
  await migrateCollection('staffMessages', 'staff_messages', (doc) => {
    const uuid = getOrCreateUUID(doc.id);
    return toSnakeCaseObj({
      id: uuid,
      senderId: doc.senderId ? getOrCreateUUID(doc.senderId) : null,
      senderName: doc.senderName,
      content: doc.content,
      mentions: doc.mentions ?? null,
      createdAt: doc.createdAt,
      assignmentId: doc.assignmentId ? getOrCreateUUID(doc.assignmentId) : null,
      voiceUrl: doc.voiceUrl,
      messageType: doc.messageType ?? 'text',
    });
  });

  // 18. audit_logs
  await migrateCollection('auditLogs', 'audit_logs', (doc) => {
    const uuid = getOrCreateUUID(doc.id);
    return toSnakeCaseObj({
      id: uuid,
      actorId: doc.actorId ? getOrCreateUUID(doc.actorId) : null,
      actorName: doc.actorName,
      actorRole: doc.actorRole,
      action: doc.action,
      targetType: doc.targetType,
      targetId: doc.targetId,
      targetLabel: doc.targetLabel,
      detail: doc.detail,
      createdAt: doc.createdAt,
      ipAddress: doc.ipAddress,
    });
  });

  // 19. user_guides
  await migrateCollection('userGuides', 'user_guides', (doc) => {
    const uuid = getOrCreateUUID(doc.id);
    return toSnakeCaseObj({
      id: uuid,
      role: doc.role,
      title: doc.title,
      blocks: doc.blocks ?? null,
      updatedAt: doc.updatedAt,
    });
  });

  // 20. category_requests
  await migrateCollection('categoryRequests', 'category_requests', (doc) => {
    const uuid = getOrCreateUUID(doc.id);
    return toSnakeCaseObj({
      id: uuid,
      customerId: doc.customerId ? getOrCreateUUID(doc.customerId) : null,
      customerName: doc.customerName,
      customerPhone: doc.customerPhone,
      categoryId: doc.categoryId ? getOrCreateUUID(doc.categoryId) : null,
      categoryName: doc.categoryName,
      proofImageUrl: doc.proofImageUrl,
      status: doc.status ?? 'PENDING',
      submittedAt: doc.submittedAt,
      reviewedAt: doc.reviewedAt,
      reviewedBy: doc.reviewedBy,
      reviewNote: doc.reviewNote,
    });
  });

  // 21. pending_payments (id = TEXT, không phải UUID)
  await migrateCollection('pendingPayments', 'pending_payments', (doc) => {
    return {
      id: doc.id,  // giữ nguyên text ID
      payment_ref: doc.paymentRef ?? doc.id,
      expected_amount: doc.expectedAmount ?? null,
      customer_name: doc.customerName ?? null,
      route_info: doc.routeInfo ?? null,
      trip_id: doc.tripId ? getOrCreateUUID(doc.tripId) : null,
      status: doc.status ?? 'PENDING',
      paid_amount: doc.paidAmount ?? null,
      paid_content: doc.paidContent ?? null,
      created_at: doc.createdAt ? convertValue(doc.createdAt) : null,
      confirmed_at: doc.confirmedAt ? convertValue(doc.confirmedAt) : null,
    };
  });

  // 22. settings (id = TEXT key như 'permissions', 'adminCredentials')
  console.log('\nMigrating settings → settings ...');
  {
    const snap = await db.collection('settings').get();
    if (!snap.empty) {
      const rows = snap.docs.map((doc) => ({
        id: doc.id,  // giữ nguyên text ID
        value: convertValue(doc.data()),
        updated_at: doc.data().updatedAt ? convertValue(doc.data().updatedAt) : new Date().toISOString(),
      }));
      await upsertBatch('settings', rows, 'id');
      console.log(`✓ ${snap.size} records`);
    } else {
      console.log('(empty)');
    }
  }

  // ── BƯỚC 3: Subcollections ────────────────────────────────────────────────

  // 23. routeFares/{routeId}/fares → route_fares
  console.log('\nMigrating subcollection routeFares → route_fares ...');
  {
    const routesSnap = await db.collection('routes').get();
    let totalFares = 0;
    const allRows = [];

    for (const routeDoc of routesSnap.docs) {
      const routeUUID = getOrCreateUUID(routeDoc.id);
      const faresSnap = await db.collection('routeFares').doc(routeDoc.id).collection('fares').get();
      if (faresSnap.empty) continue;

      for (const fareDoc of faresSnap.docs) {
        const data = fareDoc.data();
        allRows.push({
          id: getOrCreateUUID(`routeFare_${routeDoc.id}_${fareDoc.id}`),
          route_id: routeUUID,
          from_stop_id: data.fromStopId ? getOrCreateUUID(data.fromStopId) : null,
          to_stop_id: data.toStopId ? getOrCreateUUID(data.toStopId) : null,
          price: data.price ?? null,
          agent_price: data.agentPrice ?? null,
          currency: data.currency ?? 'VND',
          active: data.active ?? true,
          updated_at: data.updatedAt ? convertValue(data.updatedAt) : null,
          start_date: data.startDate ?? null,
          end_date: data.endDate ?? null,
          sort_order: data.sortOrder ?? null,
          fare_doc_id: fareDoc.id,  // Firestore doc ID để upsert idempotent
        });
        totalFares++;
      }
    }

    if (allRows.length > 0) {
      await upsertBatch('route_fares', allRows, 'fare_doc_id');
    }
    console.log(`✓ ${totalFares} fare records`);
  }

  // 24. routeSeatFares/{routeId}/seats → route_seat_fares
  console.log('Migrating subcollection routeSeatFares → route_seat_fares ...');
  {
    const routesSnap = await db.collection('routes').get();
    let total = 0;
    const allRows = [];

    for (const routeDoc of routesSnap.docs) {
      const routeUUID = getOrCreateUUID(routeDoc.id);
      const seatsSnap = await db.collection('routeSeatFares').doc(routeDoc.id).collection('seats').get();
      if (seatsSnap.empty) continue;

      for (const seatDoc of seatsSnap.docs) {
        const data = seatDoc.data();
        allRows.push({
          id: getOrCreateUUID(`routeSeatFare_${routeDoc.id}_${seatDoc.id}`),
          route_id: routeUUID,
          seat_id: data.seatId ?? seatDoc.id,
          price: data.price ?? null,
          agent_price: data.agentPrice ?? null,
          start_date: data.startDate ?? null,
          end_date: data.endDate ?? null,
          note: data.note ?? null,
          active: data.active ?? true,
          updated_at: data.updatedAt ? convertValue(data.updatedAt) : null,
          fare_doc_id: seatDoc.id,
        });
        total++;
      }
    }

    if (allRows.length > 0) {
      await upsertBatch('route_seat_fares', allRows, 'fare_doc_id');
    }
    console.log(`✓ ${total} seat fare records`);
  }

  // 25. properties/{id}/roomTypes → property_room_types
  console.log('Migrating subcollection properties/roomTypes → property_room_types ...');
  {
    const propsSnap = await db.collection('properties').get();
    let total = 0;
    const allRows = [];

    for (const propDoc of propsSnap.docs) {
      const propUUID = getOrCreateUUID(propDoc.id);
      const rtSnap = await db.collection('properties').doc(propDoc.id).collection('roomTypes').get();
      if (rtSnap.empty) continue;

      for (const rtDoc of rtSnap.docs) {
        const data = rtDoc.data();
        allRows.push({
          id: getOrCreateUUID(`propRoomType_${propDoc.id}_${rtDoc.id}`),
          property_id: propUUID,
          name: data.name ?? '',
          capacity_adults: data.capacityAdults ?? data.capacity ?? null,
          capacity_children: data.capacityChildren ?? null,
          area_sqm: data.areaSqm ?? null,
          base_price: data.basePrice ?? data.price ?? null,
          surcharges: data.surcharges ? convertValue(data.surcharges) : null,
          checkin_time: data.checkinTime ?? null,
          checkout_time: data.checkoutTime ?? null,
          amenities: data.amenities ?? null,
          images: data.images ?? null,
          total_units: data.totalUnits ?? data.totalRooms ?? null,
        });
        total++;
      }
    }

    if (allRows.length > 0) {
      await upsertBatch('property_room_types', allRows, 'id');
    }
    console.log(`✓ ${total} room type records`);
  }

  // ── Kết quả ───────────────────────────────────────────────────────────────

  console.log('\n══════════════════════════════════════════');
  console.log('✅  Migration hoàn thành!');
  console.log(`   Tổng ID đã map: ${idMap.size}`);
  console.log('══════════════════════════════════════════');

  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Migration thất bại:', err);
  process.exit(1);
});
