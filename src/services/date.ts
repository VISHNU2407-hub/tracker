/* ============================================================
   Date service — local calendar-date math only (no UTC drift).
   All dates are "YYYY-MM-DD" strings unless noted.
   ============================================================ */

export function todayISO(): string {
  return toISO(new Date());
}

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse "YYYY-MM-DD" into a local Date at midnight. */
export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function isValidISO(iso: unknown): iso is string {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = fromISO(iso);
  return toISO(d) === iso;
}

export function addDays(iso: string, days: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

/** Whole-day difference: b - a. Uses local noon to dodge DST edges. */
export function daysBetween(a: string, b: string): number {
  const da = fromISO(a);
  const db = fromISO(b);
  da.setHours(12, 0, 0, 0);
  db.setHours(12, 0, 0, 0);
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

/** Day number inside the arc: floor(today - start) + 1, clamped 1..duration. */
export function dayNumber(today: string, startDate: string, durationDays: number): number {
  return Math.min(Math.max(daysBetween(startDate, today) + 1, 1), durationDays);
}

export function formatShort(iso: string): string {
  return fromISO(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatLong(iso: string): string {
  return fromISO(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function weekdayInitial(iso: string): string {
  return fromISO(iso).toLocaleDateString(undefined, { weekday: 'narrow' });
}

export function isWeekend(iso: string): boolean {
  const wd = fromISO(iso).getDay();
  return wd === 0 || wd === 6;
}

/** Monday-based week start. */
export function weekStartOf(iso: string): string {
  const d = fromISO(iso);
  const dow = (d.getDay() + 6) % 7; // Mon=0..Sun=6
  d.setDate(d.getDate() - dow);
  return toISO(d);
}

/** ISO-8601 week key like "2026-W41" (Monday-based, week 1 contains Jan 4). */
export function weekKeyOf(iso: string): string {
  const d = fromISO(iso);
  const dow = (d.getDay() + 6) % 7; // Mon=0..Sun=6
  const monday = new Date(d);
  monday.setDate(d.getDate() - dow);
  // The year of the week is the year of this week's Thursday.
  const thursday = new Date(monday);
  thursday.setDate(monday.getDate() + 3);
  const year = thursday.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const week =
    Math.round((monday.getTime() - week1Monday.getTime()) / 86_400_000 / 7) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** Split a date range into calendar-month groups (label + list of dates).
 *  Used by the Calendar month view and the monthly habit grid. */
export interface MonthGroup {
  label: string;
  dates: string[];
}

export function monthGroups(startISO: string, endISO: string): MonthGroup[] {
  const groups: MonthGroup[] = [];
  let cursor = startISO;
  while (cursor <= endISO) {
    const d = fromISO(cursor);
    const label = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const dates: string[] = [];
    for (let day = d.getDate(); day <= daysInMonth && cursor <= endISO; day++) {
      dates.push(cursor);
      cursor = addDays(cursor, 1);
    }
    groups.push({ label, dates });
  }
  return groups;
}

export function formatDateRange(startISO: string, endISO: string): string {
  const s = fromISO(startISO);
  const e = fromISO(endISO);
  const sameYear = s.getFullYear() === e.getFullYear();
  const sameMonth = sameYear && s.getMonth() === e.getMonth();
  const fmt = (d: Date, withMonth: boolean) =>
    d.toLocaleDateString(undefined, {
      ...(withMonth ? { month: 'short' } : {}),
      day: 'numeric',
      ...(sameYear ? {} : { year: 'numeric' }),
    });
  if (sameMonth) {
    return `${s.toLocaleDateString(undefined, { month: 'short' })} ${s.getDate()} – ${e.getDate()}, ${e.getFullYear()}`;
  }
  return `${fmt(s, true)} – ${fmt(e, true)}, ${e.getFullYear()}`;
}
