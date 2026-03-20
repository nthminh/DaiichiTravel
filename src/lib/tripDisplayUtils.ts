import { Language } from '../constants/translations';

/**
 * Returns a display string for a trip's departure time.
 * When a date is present it is prepended: "2025-08-01 08:00".
 */
export const formatTripDisplayTime = (trip: { time: string; date?: string }): string =>
  trip.date ? `${trip.date} ${trip.time}` : trip.time;

/**
 * Returns the abbreviated day-of-week string for a YYYY-MM-DD date in the
 * given language (e.g. "T2", "Mon", "月").
 */
export function getDayOfWeekStr(dateStr: string, language: Language): string {
  const [y, m, day] = dateStr.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  const days: Record<Language, string[]> = {
    vi: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'],
    en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    ja: ['日', '月', '火', '水', '木', '金', '土'],
  };
  return days[language][d.getDay()];
}

/**
 * Returns a short human-readable date string: "T2, 01/08".
 */
export function formatTripDateDisplay(dateStr: string, language: Language): string {
  const [y, m, day] = dateStr.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  const dow = getDayOfWeekStr(dateStr, language);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dow}, ${dd}/${mm}`;
}

/**
 * Comparator for sorting trips chronologically by date + time.
 * Trips without a date sort last.
 */
export function compareTripDateTime(
  a: { date?: string; time?: string },
  b: { date?: string; time?: string },
): number {
  const aKey = `${a.date || '9999-12-31'}T${a.time || '23:59'}`;
  const bKey = `${b.date || '9999-12-31'}T${b.time || '23:59'}`;
  return aKey.localeCompare(bKey);
}
