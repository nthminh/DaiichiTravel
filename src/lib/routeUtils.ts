import { Route } from '../types';

/**
 * Parses a human-readable duration string into a total number of minutes.
 * Supports Vietnamese ("3 giờ 30 phút"), English ("3h 30m", "3 hours 30 min"),
 * and Japanese ("3時間30分") formats.
 * Returns null if the string cannot be parsed or yields zero minutes.
 */
export function parseDurationToMinutes(duration: string): number | null {
  if (!duration?.trim()) return null;
  const s = duration.trim();
  let hours = 0;
  let minutes = 0;
  let found = false;

  // Match hours: "giờ", "h" (standalone, not part of a longer word), "hr(s)", "hour(s)", "時間"
  const hMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:giờ|時間|hours?|hrs?|h(?=[^a-zA-Z]|$))/i);
  if (hMatch) {
    hours = parseFloat(hMatch[1]);
    found = true;
  }

  // Match minutes: "phút", "分", "m", "min(utes)"
  const mMatch = s.match(/(\d+)\s*(?:phút|分|minutes?|mins?|m(?=[^a-zA-Z]|$))/i);
  if (mMatch) {
    minutes = parseInt(mMatch[1], 10);
    found = true;
  }

  if (!found) return null;
  const total = Math.round(hours * 60) + minutes;
  return total > 0 ? total : null;
}

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
