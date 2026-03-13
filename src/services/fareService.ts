/**
 * Fare service – Option 2: explicit fare table between any two stops.
 *
 * Firestore path: routeFares/{routeId}/fares/{fromStopId_toStopId}
 * Document fields: { routeId, fromStopId, toStopId, price, currency, active, updatedAt }
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { FareResult, RouteStop, Stop } from '../types';

// ─── domain error ────────────────────────────────────────────────────────────

export type FareErrorCode =
  | 'NO_DB'
  | 'SAME_STOP'
  | 'STOP_NOT_IN_ROUTE'
  | 'INVALID_STOP_ORDER'
  | 'FARE_NOT_CONFIGURED'
  | 'FARE_INACTIVE';

export class FareError extends Error {
  constructor(
    public readonly code: FareErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'FareError';
  }
}

// ─── getFareForStops ──────────────────────────────────────────────────────────

export interface GetFareParams {
  /** Route ID that owns the fare subcollection */
  routeId: string;
  fromStopId: string;
  toStopId: string;
  /** Optional: if provided, stop order is validated against this list */
  routeStops?: RouteStop[];
  /** Optional: enriches result with human-readable stop names */
  stops?: Stop[];
  /** Optional: reserved for future seasonal-pricing support */
  travelDate?: string;
}

/**
 * Look up the fare for a (fromStop → toStop) pair on a given route.
 * Throws a FareError with a descriptive code when the lookup fails.
 */
export async function getFareForStops(params: GetFareParams): Promise<FareResult> {
  const { routeId, fromStopId, toStopId, routeStops, stops } = params;

  // 1. Same-stop guard
  if (fromStopId === toStopId) {
    throw new FareError('SAME_STOP', 'Điểm đón và điểm trả phải khác nhau.');
  }

  // 2. Validate ordering within the route's stop list
  if (routeStops && routeStops.length > 0) {
    const from = routeStops.find((s) => s.stopId === fromStopId);
    const to = routeStops.find((s) => s.stopId === toStopId);

    if (!from || !to) {
      throw new FareError(
        'STOP_NOT_IN_ROUTE',
        'Điểm dừng không thuộc danh sách điểm dừng của tuyến đường này.',
      );
    }

    if (from.order >= to.order) {
      throw new FareError(
        'INVALID_STOP_ORDER',
        'Điểm đón phải nằm trước điểm trả trong hành trình.',
      );
    }
  }

  // 3. Firestore lookup
  if (!db) {
    throw new FareError('NO_DB', 'Không kết nối được cơ sở dữ liệu.');
  }

  const fareDocId = `${fromStopId}_${toStopId}`;
  const fareRef = doc(db, 'routeFares', routeId, 'fares', fareDocId);
  const fareSnap = await getDoc(fareRef);

  // Resolve stop names once for both error messages and success result
  const fromStop = stops?.find((s) => s.id === fromStopId);
  const toStop = stops?.find((s) => s.id === toStopId);

  if (!fareSnap.exists()) {
    const fromName = fromStop?.name ?? fromStopId;
    const toName = toStop?.name ?? toStopId;
    throw new FareError(
      'FARE_NOT_CONFIGURED',
      `Chưa cấu hình giá vé cho hành trình ${fromName} → ${toName}. Vui lòng cấu hình giá vé.`,
    );
  }

  const data = fareSnap.data();

  if (data['active'] === false) {
    throw new FareError(
      'FARE_INACTIVE',
      'Giá vé cho hành trình này hiện không khả dụng.',
    );
  }

  return {
    price: data['price'] as number,
    currency: (data['currency'] as string) || 'VND',
    fareDocId,
    fromStopName: fromStop?.name,
    toStopName: toStop?.name,
  };
}

// ─── upsertFare ───────────────────────────────────────────────────────────────

/**
 * Admin utility: create or overwrite a fare for a (fromStop → toStop) pair.
 * Sets active=true on every upsert so existing inactive fares are re-enabled.
 */
export async function upsertFare(
  routeId: string,
  fromStopId: string,
  toStopId: string,
  price: number,
  currency = 'VND',
): Promise<string> {
  if (!db) {
    throw new FareError('NO_DB', 'Không kết nối được cơ sở dữ liệu.');
  }

  if (fromStopId === toStopId) {
    throw new FareError('SAME_STOP', 'Điểm đón và điểm trả phải khác nhau.');
  }

  const fareDocId = `${fromStopId}_${toStopId}`;
  const fareRef = doc(db, 'routeFares', routeId, 'fares', fareDocId);

  await setDoc(
    fareRef,
    {
      routeId,
      fromStopId,
      toStopId,
      price,
      currency,
      active: true,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  return fareDocId;
}
