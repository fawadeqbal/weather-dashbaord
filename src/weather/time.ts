/**
 * Helpers for the local wall-clock strings in the weather model ("2026-11-23T14:41").
 * They never convert time zones: the provider already gives each place's local time.
 */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function parts(localIso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(localIso);
  if (!m) throw new Error(`Not a local ISO time: ${localIso}`);
  return { y: +m[1], mo: +m[2], d: +m[3], h: m[4] ? +m[4] : 0, mi: m[5] ? +m[5] : 0 };
}

function weekdayIndex(localIso: string): number {
  const { y, mo, d } = parts(localIso);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}

export const weekdayShort = (localIso: string) => WEEKDAYS[weekdayIndex(localIso)];
export const weekdayLong = (localIso: string) => WEEKDAYS_LONG[weekdayIndex(localIso)];

/** "Nov 24" */
export function formatShortDate(localIso: string): string {
  const { mo, d } = parts(localIso);
  return `${MONTHS[mo - 1].slice(0, 3)} ${d}`;
}

/** "Monday, November 23" */
export function formatLongDate(localIso: string): string {
  const { mo, d } = parts(localIso);
  return `${WEEKDAYS_LONG[weekdayIndex(localIso)]}, ${MONTHS[mo - 1]} ${d}`;
}

export function minutesSinceMidnight(localIso: string): number {
  const { h, mi } = parts(localIso);
  return h * 60 + mi;
}

/** Whole minutes between two local times (b − a), across dates. */
export function minutesBetween(a: string, b: string): number {
  const pa = parts(a);
  const pb = parts(b);
  return Math.round((Date.UTC(pb.y, pb.mo - 1, pb.d, pb.h, pb.mi) - Date.UTC(pa.y, pa.mo - 1, pa.d, pa.h, pa.mi)) / 60000);
}

/** 134 → "2 h 14 min", 45 → "45 min". */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r} min`;
  return r ? `${h} h ${r} min` : `${h} h`;
}

/**
 * The current wall-clock time in an IANA time zone, as "YYYY-MM-DDTHH:mm".
 * Falls back to `fallback` if the zone is unknown to this browser.
 */
export function localNowIn(timeZone: string, now: Date = new Date(), fallback?: string): string {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const p = Object.fromEntries(fmt.formatToParts(now).map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
  } catch {
    return fallback ?? now.toISOString().slice(0, 16);
  }
}

/** "Updated just now", "Updated 4 min ago", "Updated 2 h ago". */
export function formatUpdated(fetchedAtIso: string, now: Date = new Date()): string {
  const mins = Math.floor((now.getTime() - new Date(fetchedAtIso).getTime()) / 60000);
  if (mins < 1) return 'Updated just now';
  if (mins < 60) return `Updated ${mins} min ago`;
  return `Updated ${Math.floor(mins / 60)} h ago`;
}
