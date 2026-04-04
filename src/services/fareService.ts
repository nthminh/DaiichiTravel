/**
 * Fare service – explicit fare table between any two stops.
 *
 * Supabase table: route_fares
 * fare_doc_id format:
 *   - No date restriction: "{fromStopId}_{toStopId}"
 *   - Date-specific:       "{fromStopId}_{toStopId}|{startDate}|{endDate}"
 * Row fields: { routeId, fromStopId, toStopId, price, currency, active, updatedAt, fareDocId }
 */
import { supabase, isSupabaseConfigured, toCamelCaseObj } from '../lib/supabase';
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

  // 3. Supabase lookup – query all fares for this stop pair to support
  //    multiple date-specific fares on the same (fromStop → toStop) segment.
  if (!isSupabaseConfigured || !supabase) {
    throw new FareError('NO_DB', 'Không kết nối được cơ sở dữ liệu.');
  }

  const { data: rows } = await supabase
    .from('route_fares')
    .select('*')
    .eq('route_id', routeId)
    .eq('from_stop_id', fromStopId)
    .eq('to_stop_id', toStopId);

  // Resolve stop names once for both error messages and success result.
  // Also check routeStops so that synthetic IDs like __departure__/__arrival__
  // are shown with their human-readable station name in error messages.
  const fromStop = stops?.find((s) => s.id === fromStopId);
  const toStop = stops?.find((s) => s.id === toStopId);

  const activeFares = (rows || [])
    .map((r) => toCamelCaseObj<Record<string, unknown>>(r))
    .filter((f) => f['active'] !== false);

  if (activeFares.length === 0) {
    const fromName = fromStop?.name
      ?? routeStops?.find((rs) => rs.stopId === fromStopId)?.stopName
      ?? fromStopId;
    const toName = toStop?.name
      ?? routeStops?.find((rs) => rs.stopId === toStopId)?.stopName
      ?? toStopId;
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
 * Build a deterministic Firestore document ID for a per-seat fare.
 * Seats without date restrictions use "{seatId}" as the document ID.
 * Date-specific overrides append the date range: "{seatId}|{startDate}|{endDate}".
 */
export function buildSeatFareDocId(
  seatId: string,
  startDate?: string,
  endDate?: string,
): string {
  if (!startDate && !endDate) {
    return seatId;
  }
  return `${seatId}|${startDate || ''}|${endDate || ''}`;
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
  if (!isSupabaseConfigured || !supabase) {
    throw new FareError('NO_DB', 'Không kết nối được cơ sở dữ liệu.');
  }

  if (fromStopId === toStopId) {
    throw new FareError('SAME_STOP', 'Điểm đón và điểm trả phải khác nhau.');
  }

  const resolvedFareDocId =
    fareDocId ?? buildFareDocId(fromStopId, toStopId, startDate, endDate);

  const fareData: Record<string, unknown> = {
    route_id: routeId,
    from_stop_id: fromStopId,
    to_stop_id: toStopId,
    // Keep camelCase aliases too so toCamelCaseObj round-trips correctly
    fare_doc_id: resolvedFareDocId,
    price,
    currency,
    active: true,
    updated_at: new Date().toISOString(),
  };
  if (agentPrice !== undefined) fareData['agent_price'] = agentPrice;
  if (startDate) fareData['start_date'] = startDate;
  if (endDate) fareData['end_date'] = endDate;
  if (sortOrder !== undefined) fareData['sort_order'] = sortOrder;

  await supabase!
    .from('route_fares')
    .upsert(fareData, { onConflict: 'fare_doc_id' });

  return resolvedFareDocId;
}
