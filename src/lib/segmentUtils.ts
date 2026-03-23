import type { RouteStop } from '../types';
import type { Language } from '../constants/translations';

export interface SegmentInfo {
  type: 'full' | 'partial' | 'multi';
  label: string;
}

/**
 * Builds a stop-order → stop-name lookup from a route's routeStops array.
 */
export function buildStopNameByOrder(routeStops?: RouteStop[]): Record<number, string> {
  const map: Record<number, string> = {};
  if (routeStops) {
    routeStops.forEach(rs => { map[rs.order] = rs.stopName; });
  }
  return map;
}

/**
 * Determines whether a seat's booking covers the full route, a partial segment,
 * or multiple sub-segments, and returns a human-readable label for display.
 *
 * @param seat            - A seat object from Trip.seats (can be any shape)
 * @param totalStops      - Number of stops on the route (routeStops.length); use 0 when unknown
 * @param stopNameByOrder - Map from stop order to stop name, built with buildStopNameByOrder()
 * @param language        - UI language for label strings
 */
export function getSegmentInfo(
  seat: any,
  totalStops: number,
  stopNameByOrder: Record<number, string>,
  language: Language,
): SegmentInfo {
  if (seat.segmentBookings?.length > 0) {
    return {
      type: 'multi',
      label: `${seat.segmentBookings.length} ${language === 'vi' ? 'chặng' : 'seg.'}`,
    };
  }

  const from = seat.fromStopOrder as number | undefined;
  const to = seat.toStopOrder as number | undefined;

  // No stop-order info at all → treat as full route
  if (from == null && to == null) {
    return { type: 'full', label: language === 'vi' ? 'Cả chặng' : 'Full route' };
  }

  // Both endpoints set and they exactly span the route → full route
  // Use actual min/max orders from the stop map (robust against non-1-based or gapped orders).
  const orderKeys = Object.keys(stopNameByOrder).map(Number);
  const minOrder = orderKeys.length > 0 ? Math.min(...orderKeys) : 1;
  const maxOrder = orderKeys.length > 0 ? Math.max(...orderKeys) : totalStops;
  if ((totalStops > 0 || orderKeys.length > 0) && from === minOrder && to === maxOrder) {
    return { type: 'full', label: language === 'vi' ? 'Cả chặng' : 'Full route' };
  }

  // Otherwise it is a partial segment – build a descriptive label
  const fromName = seat.pickupPoint || (from != null ? stopNameByOrder[from] || `Trạm ${from}` : '');
  const toName = seat.dropoffPoint || (to != null ? stopNameByOrder[to] || `Trạm ${to}` : '');
  const segLabel =
    fromName || toName
      ? `${fromName}→${toName}`
      : language === 'vi'
      ? 'Nửa chặng'
      : 'Partial';

  return { type: 'partial', label: segLabel };
}
