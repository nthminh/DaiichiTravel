/**
 * Vietnam timezone (UTC+7) date/time utilities.
 * All functions use 'Asia/Ho_Chi_Minh' locale so timestamps and display
 * values are always correct for Vietnamese users.
 */

const TZ = 'Asia/Ho_Chi_Minh';

/**
 * Returns the current date-time as an ISO 8601 string adjusted to
 * Vietnam time (UTC+7).  Unlike `new Date().toISOString()` which returns
 * UTC, this produces a wall-clock ISO string local to Vietnam, suitable
 * for use as `assignedAt` / `createdAt` fields that are displayed to
 * Vietnamese users.
 *
 * Example: "2025-03-18T14:30:00.000+07:00"
 */
export function nowVN(): string {
  const now = new Date();
  // Compute the offset in minutes for Asia/Ho_Chi_Minh (+420 min = +7 h)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00';
  const dateStr = `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}.000+07:00`;
  return dateStr;
}

/**
 * Returns today's date as "YYYY-MM-DD" in Vietnam timezone.
 * Equivalent to the existing pattern used in App.tsx searchDate initial state.
 */
export function todayVN(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Formats an ISO/Firestore timestamp string for display in Vietnam timezone.
 * Returns e.g. "18/03/2025 14:30" in vi locale.
 */
export function formatDateTimeVN(value: string | Date | null | undefined, locale: string = 'vi-VN'): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(locale, {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formats an ISO/Firestore timestamp string as a date only in Vietnam timezone.
 * Returns e.g. "18/03/2025" in vi locale.
 */
export function formatDateVN(value: string | Date | null | undefined, locale: string = 'vi-VN'): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale, {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
