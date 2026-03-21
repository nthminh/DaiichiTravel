/**
 * Fare service – Option 2: explicit fare table between any two stops.
 *
 * Firestore path: routeFares/{routeId}/fares/{fareDocId}
 * fareDocId format:
 *   - No date restriction: "{fromStopId}_{toStopId}"
 *   - Date-specific:       "{fromStopId}_{toStopId}|{startDate}|{endDate}"
 * Document fields: { routeId, fromStopId, toStopId, price, currency, active, updatedAt }
 */
import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
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
 * When multiple fares exist for the same stop pair (with different date ranges),
 * the fare that covers `travelDate` is preferred; falls back to the fare without
 * date restrictions, then to any active fare.
 * Throws a FareError with a descriptive code when the lookup fails.
 */
export async function getFareForStops(params: GetFareParams): Promise<FareResult> {
  const { routeId, fromStopId, toStopId, routeStops, stops, travelDate } = params;

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

  // 3. Firestore lookup – query all fares for this stop pair to support
  //    multiple date-specific fares on the same (fromStop → toStop) segment.
  if (!db) {
    throw new FareError('NO_DB', 'Không kết nối được cơ sở dữ liệu.');
  }

  const faresSnap = await getDocs(
    query(
      collection(db, 'routeFares', routeId, 'fares'),
      where('fromStopId', '==', fromStopId),
      where('toStopId', '==', toStopId),
    ),
  );

  // Resolve stop names once for both error messages and success result
  const fromStop = stops?.find((s) => s.id === fromStopId);
  const toStop = stops?.find((s) => s.id === toStopId);

  const activeFares = faresSnap.docs
    .map(d => ({ ...(d.data() as Record<string, unknown>), fareDocId: d.id }))
    .filter(f => f['active'] !== false);

  if (activeFares.length === 0) {
    const fromName = fromStop?.name ?? fromStopId;
    const toName = toStop?.name ?? toStopId;
    throw new FareError(
      'FARE_NOT_CONFIGURED',
      `Chưa cấu hình giá vé cho hành trình ${fromName} → ${toName}. Vui lòng cấu hình giá vé.`,
    );
  }

  // Select the best fare: prefer date-specific match over default (no-date) fare.
  // When travelDate is not provided, the current date (UTC) is used as a fallback.
  const dateToCheck = travelDate ?? new Date().toISOString().slice(0, 10);
  let selected = activeFares.find(f => {
    const start = f['startDate'] as string | undefined;
    const end = f['endDate'] as string | undefined;
    if (!start && !end) return false; // skip default fare in first pass
    return (!start || start <= dateToCheck) && (!end || end >= dateToCheck);
  });

  if (!selected) {
    // Fall back to the fare without date restrictions, then any active fare.
    selected =
      activeFares.find(f => !f['startDate'] && !f['endDate']) ?? activeFares[0];
  }

  return {
    price: selected['price'] as number,
    agentPrice: selected['agentPrice'] as number | undefined,
    currency: (selected['currency'] as string) || 'VND',
    fareDocId: selected['fareDocId'] as string,
    fromStopName: fromStop?.name,
    toStopName: toStop?.name,
  };
}

// ─── upsertFare ───────────────────────────────────────────────────────────────

/**
 * Build a deterministic Firestore document ID for a fare.
 * Fares without date restrictions use the legacy "{fromStopId}_{toStopId}" format
 * for backward compatibility.  Date-specific fares append the date range so that
 * multiple fares for the same stop pair can coexist in Firestore.
 */
export function buildFareDocId(
  fromStopId: string,
  toStopId: string,
  startDate?: string,
  endDate?: string,
): string {
  if (!startDate && !endDate) {
    return `${fromStopId}_${toStopId}`;
  }
  return `${fromStopId}_${toStopId}|${startDate || ''}|${endDate || ''}`;
}

/**
 * Admin utility: create or overwrite a fare for a (fromStop → toStop) pair.
 * Sets active=true on every upsert so existing inactive fares are re-enabled.
 *
 * @param fareDocId  Optional explicit document ID.  When omitted, one is derived
 *                   from the stop IDs and date range via {@link buildFareDocId}.
 */
export async function upsertFare(
  routeId: string,
  fromStopId: string,
  toStopId: string,
  price: number,
  agentPrice?: number,
  currency = 'VND',
  startDate?: string,
  endDate?: string,
  sortOrder?: number,
  fareDocId?: string,
): Promise<string> {
  if (!db) {
    throw new FareError('NO_DB', 'Không kết nối được cơ sở dữ liệu.');
  }

  if (fromStopId === toStopId) {
    throw new FareError('SAME_STOP', 'Điểm đón và điểm trả phải khác nhau.');
  }

  const resolvedFareDocId =
    fareDocId ?? buildFareDocId(fromStopId, toStopId, startDate, endDate);
  const fareRef = doc(db, 'routeFares', routeId, 'fares', resolvedFareDocId);

  const fareData: Record<string, unknown> = {
    routeId,
    fromStopId,
    toStopId,
    price,
    currency,
    active: true,
    updatedAt: new Date().toISOString(),
  };
  if (agentPrice !== undefined) {
    fareData['agentPrice'] = agentPrice;
  }
  if (startDate) {
    fareData['startDate'] = startDate;
  }
  if (endDate) {
    fareData['endDate'] = endDate;
  }
  if (sortOrder !== undefined) {
    fareData['sortOrder'] = sortOrder;
  }

  await setDoc(fareRef, fareData, { merge: true });

  return resolvedFareDocId;
}
