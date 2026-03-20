import { Route, PricePeriod, RouteSurcharge } from '../types';

/**
 * Returns the active PricePeriod for a route on the given date, or null if
 * none of the configured periods covers that date.
 */
export function getRouteActivePeriod(route: Route, date: string): PricePeriod | null {
  if (!date || !route.pricePeriods || route.pricePeriods.length === 0) return null;
  return route.pricePeriods.find(p => p.startDate <= date && p.endDate >= date) || null;
}

/**
 * Returns all route-level surcharges that are active and applicable for the
 * given trip date.  Surcharges without a date range apply all the time.
 */
export function getApplicableRouteSurcharges(
  route: Route | undefined,
  tripDate: string,
): RouteSurcharge[] {
  if (!route?.surcharges) return [];
  return route.surcharges.filter(sc => {
    if (!sc.isActive) return false;
    // If a date range is configured, only apply within that range
    if (sc.startDate && sc.endDate) {
      return !!tripDate && tripDate >= sc.startDate && tripDate <= sc.endDate;
    }
    // No date range means the surcharge applies all the time
    return true;
  });
}

/**
 * Returns true if the route is valid for the given date.
 * Routes are always available regardless of date; peak-period pricing is
 * handled separately via getRouteActivePeriod.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function isRouteValidForDate(_route: Route, _date: string): boolean {
  return true;
}

/**
 * Formats a route option label shown inside <select> dropdowns.
 * Includes the display price and season label when a price period is active.
 */
export function formatRouteOption(
  r: Route,
  period: PricePeriod | null,
  lang: string,
): string {
  const displayPrice = period ? period.price : r.price;
  const periodLabel = period
    ? (period.name || (lang === 'vi' ? 'Kỳ giá' : 'Season'))
    : '';
  const priceStr = displayPrice > 0 ? ` – ${displayPrice.toLocaleString()}đ` : '';
  const seasonStr = periodLabel ? ` (${periodLabel})` : '';
  return `${r.name}${priceStr}${seasonStr}`;
}
