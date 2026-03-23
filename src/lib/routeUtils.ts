import { Route } from '../types';

/**
 * Returns the ordered list of stop names along the route between fromStop and toStop (inclusive).
 * Stops are ordered as: [departurePoint, ...routeStops (by order), arrivalPoint].
 * If fromStop or toStop is not found, falls back to the beginning/end of the route.
 */
export function getJourneyStops(routes: Route[], routeName: string, fromStop?: string, toStop?: string): string[] {
  const route = routes.find(r => r.name === routeName);
  if (!route) return [];
  const raw: string[] = [
    route.departurePoint,
    ...(route.routeStops || []).slice().sort((a, b) => a.order - b.order).map(s => s.stopName),
    route.arrivalPoint,
  ].filter(Boolean) as string[];
  // Remove consecutive duplicates (prevents departurePoint/arrivalPoint from appearing twice
  // when they are also present as the first/last entry in routeStops).
  const ordered = raw.filter((name, idx) => idx === 0 || name !== raw[idx - 1]);
  if (!fromStop && !toStop) return ordered;
  const fromIdx = fromStop ? ordered.findIndex(s => s === fromStop) : 0;
  let toIdx = ordered.length - 1;
  if (toStop) {
    for (let i = ordered.length - 1; i >= 0; i--) {
      if (ordered[i] === toStop) { toIdx = i; break; }
    }
  }
  const start = fromIdx >= 0 ? fromIdx : 0;
  const end = toIdx >= 0 ? toIdx : ordered.length - 1;
  if (start > end) return ordered;
  return ordered.slice(start, end + 1);
}
