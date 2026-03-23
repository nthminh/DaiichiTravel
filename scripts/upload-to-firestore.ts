#!/usr/bin/env node
/**
 * upload-to-firestore.ts
 *
 * Bulk upload data from an Excel (.xlsx) file to Firebase Firestore.
 * Supports the stops, routes, and vehicles collections.
 *
 * Usage:
 *   npx tsx scripts/upload-to-firestore.ts --file <path.xlsx> [options]
 *
 * Options:
 *   --file <path>            Path to the Excel file (required unless --generate-templates)
 *   --collection <name>      Target collection: stops | routes | vehicles | all
 *                            (default: auto-detect from sheet names)
 *   --dry-run                Preview rows that would be uploaded without writing to Firestore
 *   --generate-templates     Generate sample Excel template files and exit
 *   --help                   Show this help message
 *
 * Excel sheet formats (Vietnamese headers are primary; English names are also accepted):
 *
 *   Stops    (sheet "Điểm dừng"):
 *     Tên điểm dừng | Địa chỉ | Loại điểm | Phí phụ thêm
 *
 *   Routes   (sheet "Tuyến"):
 *     STT | Tên tuyến | Điểm đi | Điểm đến | Giá vé | Ghi chú
 *
 *   Vehicles (sheet "Xe"):
 *     Biển số | Loại xe | Số ghế | Hạn đăng kiểm | Điện thoại
 */

import 'dotenv/config';
import ExcelJS from 'exceljs';
import { resolve } from 'path';
import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  writeBatch,
  doc,
  Firestore,
} from 'firebase/firestore';

// ---------------------------------------------------------------------------
// Types (mirror src/types.ts)
// ---------------------------------------------------------------------------

type StopCategory = 'MAJOR' | 'MINOR' | 'TOLL' | 'RESTAURANT' | 'QUICK' | 'TRANSIT' | 'OFFICE';

interface StopRow {
  name: string;
  address: string;
  category: StopCategory;
  surcharge: number;
}

interface RouteRow {
  stt: number;
  name: string;
  note?: string;
  departurePoint: string;
  arrivalPoint: string;
  price: number;
}

interface VehicleRow {
  licensePlate: string;
  type: string;
  seats: number;
  registrationExpiry: string;
  phone?: string;
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--generate-templates') {
      args.generateTemplates = true;
    } else if ((arg === '--file' || arg === '-f') && argv[i + 1]) {
      args.file = argv[++i];
    } else if ((arg === '--collection' || arg === '-c') && argv[i + 1]) {
      args.collection = argv[++i];
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// Help text
// ---------------------------------------------------------------------------

function printHelp() {
  console.log(`
Usage: npx tsx scripts/upload-to-firestore.ts --file <path.xlsx> [options]

Options:
  --file, -f <path>        Path to the Excel (.xlsx) file  [required]
  --collection, -c <name>  Collection to upload: stops | routes | vehicles | all
                           (default: auto-detect from sheet names)
  --dry-run                Preview rows without writing to Firestore
  --generate-templates     Create sample Excel template files and exit
  --help, -h               Show this message

Excel sheet formats (Vietnamese headers preferred; English names accepted):

  Stops    (sheet name: "Điểm dừng" | "stops"):
    Tên điểm dừng  Địa chỉ  Loại điểm  Phí phụ thêm

  Routes   (sheet name: "Tuyến" | "routes"):
    STT  Tên tuyến  Điểm đi  Điểm đến  Giá vé  Ghi chú

  Vehicles (sheet name: "Xe" | "vehicles"):
    Biển số  Loại xe  Số ghế  Hạn đăng kiểm  Điện thoại

Valid stop categories: MAJOR | MINOR | TOLL | RESTAURANT | QUICK | TRANSIT | OFFICE

Examples:
  npx tsx scripts/upload-to-firestore.ts --generate-templates
  npx tsx scripts/upload-to-firestore.ts --file data.xlsx
  npx tsx scripts/upload-to-firestore.ts --file data.xlsx --collection stops
  npx tsx scripts/upload-to-firestore.ts --file data.xlsx --dry-run
`);
}

// ---------------------------------------------------------------------------
// Template generation
// ---------------------------------------------------------------------------

async function generateTemplates() {
  // Stops template
  const stopsData = [
    { 'Tên điểm dừng': 'Văn phòng Hà Nội', 'Địa chỉ': '12 Nguyễn Du, Hoàn Kiếm, Hà Nội', 'Loại điểm': 'OFFICE', 'Phí phụ thêm': 0 },
    { 'Tên điểm dừng': 'Trạm dừng Ninh Bình', 'Địa chỉ': 'Quốc lộ 1A, Ninh Bình', 'Loại điểm': 'MAJOR', 'Phí phụ thêm': 0 },
    { 'Tên điểm dừng': 'Trạm thu phí Pháp Vân', 'Địa chỉ': 'Pháp Vân, Hà Nội', 'Loại điểm': 'TOLL', 'Phí phụ thêm': 25000 },
  ];

  // Routes template
  const routesData = [
    { STT: 1, 'Tên tuyến': 'Hà Nội - Cát Bà', 'Điểm đi': '12 Nguyễn Du, Hà Nội', 'Điểm đến': 'Cảng Cát Bà, Hải Phòng', 'Giá vé': 150000, 'Ghi chú': '' },
    { STT: 2, 'Tên tuyến': 'Hà Nội - Hạ Long', 'Điểm đi': '12 Nguyễn Du, Hà Nội', 'Điểm đến': 'Cảng Tuần Châu, Quảng Ninh', 'Giá vé': 180000, 'Ghi chú': '' },
  ];

  // Vehicles template
  const vehiclesData = [
    { 'Biển số': '29B-12345', 'Loại xe': 'Ghế ngồi', 'Số ghế': 45, 'Hạn đăng kiểm': '2026-12-31', 'Điện thoại': '' },
    { 'Biển số': '30M-67890', 'Loại xe': 'Giường nằm', 'Số ghế': 40, 'Hạn đăng kiểm': '2026-06-30', 'Điện thoại': '0912345678' },
  ];

  const writeSheet = (wb: ExcelJS.Workbook, name: string, data: Record<string, unknown>[]) => {
    const ws = wb.addWorksheet(name);
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    ws.addRow(headers);
    for (const row of data) {
      ws.addRow(headers.map(h => row[h] ?? ''));
    }
  };

  // Single workbook with all three sheets
  const wb = new ExcelJS.Workbook();
  writeSheet(wb, 'Điểm dừng', stopsData);
  writeSheet(wb, 'Tuyến', routesData);
  writeSheet(wb, 'Xe', vehiclesData);
  await wb.xlsx.writeFile('Mau_Import_Firestore.xlsx');
  console.log('✅ Generated: Mau_Import_Firestore.xlsx  (sheets: Điểm dừng, Tuyến, Xe)');

  // Individual templates
  const wbStops = new ExcelJS.Workbook();
  writeSheet(wbStops, 'Điểm dừng', stopsData);
  await wbStops.xlsx.writeFile('Mau_Import_Diem_Dung.xlsx');
  console.log('✅ Generated: Mau_Import_Diem_Dung.xlsx');

  const wbRoutes = new ExcelJS.Workbook();
  writeSheet(wbRoutes, 'Tuyến', routesData);
  await wbRoutes.xlsx.writeFile('Mau_Import_Tuyen.xlsx');
  console.log('✅ Generated: Mau_Import_Tuyen.xlsx');

  const wbVehicles = new ExcelJS.Workbook();
  writeSheet(wbVehicles, 'Xe', vehiclesData);
  await wbVehicles.xlsx.writeFile('Mau_Import_Xe.xlsx');
  console.log('✅ Generated: Mau_Import_Xe.xlsx');
}

// ---------------------------------------------------------------------------
// Row parsers – mirror the column mappings in App.tsx / StopManagement.tsx
// ---------------------------------------------------------------------------

function parseStopRows(rows: Record<string, unknown>[]): StopRow[] {
  const validCategories: StopCategory[] = ['MAJOR', 'MINOR', 'TOLL', 'RESTAURANT', 'QUICK', 'TRANSIT', 'OFFICE'];
  return rows
    .filter(r => r['Tên điểm dừng'] || r['name'] || r['Name'])
    .map(r => {
      const cat = String(r['Loại điểm'] || r['category'] || r['Category'] || 'MAJOR').trim().toUpperCase() as StopCategory;
      return {
        name: String(r['Tên điểm dừng'] || r['name'] || r['Name'] || '').trim(),
        address: String(r['Địa chỉ'] || r['address'] || r['Address'] || '').trim(),
        category: validCategories.includes(cat) ? cat : 'MAJOR',
        surcharge: Number(r['Phí phụ thêm'] || r['surcharge'] || r['Surcharge'] || 0),
      };
    })
    .filter(r => r.name !== '');
}

function parseRouteRows(rows: Record<string, unknown>[]): RouteRow[] {
  return rows
    .filter(r => r['Tên tuyến'] || r['name'] || r['Name'])
    .map((r, idx) => {
      const note = String(r['Ghi chú'] || r['note'] || r['Note'] || '').trim();
      return {
        stt: Number(r['STT'] || r['stt'] || idx + 1),
        name: String(r['Tên tuyến'] || r['name'] || r['Name'] || '').trim(),
        ...(note ? { note } : {}),
        departurePoint: String(r['Điểm đi'] || r['departurePoint'] || r['Departure'] || '').trim(),
        arrivalPoint: String(r['Điểm đến'] || r['arrivalPoint'] || r['Arrival'] || '').trim(),
        price: Number(r['Giá vé'] || r['price'] || r['Price'] || 0),
      };
    })
    .filter(r => r.name !== '');
}

function parseVehicleRows(rows: Record<string, unknown>[]): VehicleRow[] {
  return rows
    .filter(r => r['Biển số'] || r['licensePlate'] || r['License Plate'])
    .map(r => {
      const phone = String(r['Điện thoại'] || r['phone'] || r['Phone'] || '').trim();
      return {
        licensePlate: String(r['Biển số'] || r['licensePlate'] || r['License Plate'] || '').trim(),
        type: String(r['Loại xe'] || r['type'] || r['Type'] || 'Ghế ngồi').trim(),
        seats: Number(r['Số ghế'] || r['seats'] || r['Seats'] || 0),
        registrationExpiry: String(r['Hạn đăng kiểm'] || r['registrationExpiry'] || r['Registration Expiry'] || '').trim(),
        ...(phone ? { phone } : {}),
      };
    })
    .filter(r => r.licensePlate !== '');
}

// ---------------------------------------------------------------------------
// Firestore upload helpers  (mirrors importStops / importRoutes / importVehicles)
// ---------------------------------------------------------------------------

async function uploadStops(db: Firestore, rows: StopRow[], dryRun: boolean): Promise<void> {
  const existing = await getDocs(collection(db, 'stops'));
  const existingNames = new Set(existing.docs.map(d => (d.data() as StopRow).name));
  const toAdd = rows.filter(r => r.name && !existingNames.has(r.name));
  const skipped = rows.length - toAdd.length;

  if (toAdd.length === 0) {
    console.log(`  ⚠️  stops: all ${rows.length} row(s) already exist – nothing to add.`);
    return;
  }

  if (dryRun) {
    console.log(`  🔍 [dry-run] stops: would add ${toAdd.length} row(s), skip ${skipped} duplicate(s).`);
    toAdd.forEach((r, i) => console.log(`    ${i + 1}. ${r.name} (${r.category})`));
    return;
  }

  const batch = writeBatch(db);
  toAdd.forEach(r => {
    const ref = doc(collection(db, 'stops'));
    batch.set(ref, r);
  });
  await batch.commit();
  console.log(`  ✅ stops: added ${toAdd.length} row(s)${skipped > 0 ? `, skipped ${skipped} duplicate(s)` : ''}.`);
}

async function uploadRoutes(db: Firestore, rows: RouteRow[], dryRun: boolean): Promise<void> {
  const existing = await getDocs(collection(db, 'routes'));
  const existingNames = new Set(existing.docs.map(d => (d.data() as RouteRow).name));
  const toAdd = rows.filter(r => r.name && !existingNames.has(r.name));
  const skipped = rows.length - toAdd.length;

  if (toAdd.length === 0) {
    console.log(`  ⚠️  routes: all ${rows.length} row(s) already exist – nothing to add.`);
    return;
  }

  if (dryRun) {
    console.log(`  🔍 [dry-run] routes: would add ${toAdd.length} row(s), skip ${skipped} duplicate(s).`);
    toAdd.forEach((r, i) => console.log(`    ${i + 1}. ${r.name} (${r.departurePoint} → ${r.arrivalPoint})`));
    return;
  }

  const batch = writeBatch(db);
  toAdd.forEach(r => {
    const ref = doc(collection(db, 'routes'));
    batch.set(ref, r);
  });
  await batch.commit();
  console.log(`  ✅ routes: added ${toAdd.length} row(s)${skipped > 0 ? `, skipped ${skipped} duplicate(s)` : ''}.`);
}

async function uploadVehicles(db: Firestore, rows: VehicleRow[], dryRun: boolean): Promise<void> {
  const existing = await getDocs(collection(db, 'vehicles'));
  const existingPlates = new Set(existing.docs.map(d => (d.data() as VehicleRow).licensePlate));
  const toAdd = rows.filter(r => r.licensePlate && !existingPlates.has(r.licensePlate));
  const skipped = rows.length - toAdd.length;

  if (toAdd.length === 0) {
    console.log(`  ⚠️  vehicles: all ${rows.length} row(s) already exist – nothing to add.`);
    return;
  }

  if (dryRun) {
    console.log(`  🔍 [dry-run] vehicles: would add ${toAdd.length} row(s), skip ${skipped} duplicate(s).`);
    toAdd.forEach((r, i) => console.log(`    ${i + 1}. ${r.licensePlate} – ${r.type} (${r.seats} seats)`));
    return;
  }

  const batch = writeBatch(db);
  toAdd.forEach(r => {
    const ref = doc(collection(db, 'vehicles'));
    batch.set(ref, { ...r, status: 'ACTIVE' });
  });
  await batch.commit();
  console.log(`  ✅ vehicles: added ${toAdd.length} row(s)${skipped > 0 ? `, skipped ${skipped} duplicate(s)` : ''}.`);
}

// ---------------------------------------------------------------------------
// Sheet-name → collection mapping
// ---------------------------------------------------------------------------

/** Returns the collection name for a given sheet name, or null if not recognised. */
function detectCollection(sheetName: string): 'stops' | 'routes' | 'vehicles' | null {
  const lower = sheetName.toLowerCase().trim();
  if (lower === 'điểm dừng' || lower === 'stops' || lower === 'stop') return 'stops';
  if (lower === 'tuyến' || lower === 'tuyen' || lower === 'routes' || lower === 'route') return 'routes';
  if (lower === 'xe' || lower === 'vehicles' || lower === 'vehicle') return 'vehicles';
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (args.generateTemplates) {
    await generateTemplates();
    process.exit(0);
  }

  if (!args.file) {
    console.error('❌ Error: --file <path.xlsx> is required.\n');
    printHelp();
    process.exit(1);
  }

  // ── Firebase initialisation ────────────────────────────────────────────────
  const projectId =
    process.env.VITE_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    'daiichitravel-f49fd';

  const apiKey =
    process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '';

  if (!apiKey) {
    console.error(
      '❌ Firebase API key not found.\n' +
      '   Set VITE_FIREBASE_API_KEY in your .env file (copy .env.example → .env and fill in the values).',
    );
    process.exit(1);
  }

  const firebaseConfig = {
    apiKey,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || '',
  };

  let app: FirebaseApp;
  let db: Firestore;
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  } catch (err) {
    console.error('❌ Failed to initialise Firebase:', err);
    process.exit(1);
  }

  // ── Read Excel file ────────────────────────────────────────────────────────
  const filePath = resolve(args.file as string);
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.readFile(filePath);
  } catch (err) {
    console.error(`❌ Cannot read file "${filePath}":`, err);
    process.exit(1);
  }

  /** Extract all rows from a worksheet as an array of plain objects. */
  const sheetToJson = (worksheet: ExcelJS.Worksheet): Record<string, unknown>[] => {
    const rows: Record<string, unknown>[] = [];
    let headers: string[] = [];
    worksheet.eachRow((row, rowNumber) => {
      // row.values is 1-indexed (index 0 is undefined)
      const values = (row.values as unknown[]).slice(1);
      if (rowNumber === 1) {
        headers = values.map(v => (v == null ? '' : String(v)));
      } else {
        const obj: Record<string, unknown> = {};
        headers.forEach((h, i) => { obj[h] = values[i] ?? ''; });
        rows.push(obj);
      }
    });
    return rows;
  };

  const dryRun = args.dryRun === true;
  const targetCollection = typeof args.collection === 'string' ? args.collection : 'all';
  const sheetNames = wb.worksheets.map(ws => ws.name);

  console.log(`\n📂 File : ${filePath}`);
  console.log(`📋 Sheets: ${sheetNames.join(', ')}`);
  if (dryRun) console.log('🔍 DRY-RUN mode – no data will be written to Firestore.');
  console.log('');

  // ── Process sheets ─────────────────────────────────────────────────────────
  let processedAny = false;

  for (const sheetName of sheetNames) {
    const collectionName = detectCollection(sheetName);
    if (!collectionName) {
      console.log(`  ⏭  Sheet "${sheetName}" – not recognised (expected: "Điểm dừng", "Tuyến", "Xe"). Skipping.`);
      continue;
    }
    if (targetCollection !== 'all' && targetCollection !== collectionName) {
      console.log(`  ⏭  Sheet "${sheetName}" → ${collectionName} – skipped (--collection ${targetCollection}).`);
      continue;
    }

    const worksheet = wb.getWorksheet(sheetName)!;
    const rows = sheetToJson(worksheet);

    if (rows.length === 0) {
      console.log(`  ⚠️  Sheet "${sheetName}" is empty. Skipping.`);
      continue;
    }

    console.log(`  📄 Sheet "${sheetName}" → ${collectionName} (${rows.length} row(s))`);

    try {
      if (collectionName === 'stops') {
        const parsed = parseStopRows(rows);
        await uploadStops(db, parsed, dryRun);
      } else if (collectionName === 'routes') {
        const parsed = parseRouteRows(rows);
        await uploadRoutes(db, parsed, dryRun);
      } else if (collectionName === 'vehicles') {
        const parsed = parseVehicleRows(rows);
        await uploadVehicles(db, parsed, dryRun);
      }
    } catch (err) {
      console.error(`  ❌ Error uploading "${sheetName}":`, err);
    }

    processedAny = true;
    console.log('');
  }

  if (!processedAny) {
    console.log(
      '⚠️  No sheets were processed.\n' +
      '   Make sure your Excel file has sheets named "Điểm dừng", "Tuyến", or "Xe".\n' +
      '   Run with --generate-templates to create sample template files.',
    );
    process.exit(1);
  }

  console.log('🎉 Done.');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
