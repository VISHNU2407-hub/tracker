/* ============================================================
   Analytics service — pure, testable functions (spec §6).
   Every metric is derived from real records; nothing hard-coded.
   ============================================================ */

import type { Arc, DailyRecord, DayState, Habit } from '../types';
import { addDays, daysBetween, todayISO } from './date';

export interface DayEvaluation {
  state: DayState;
  /** Percentage 0..100, null when no habits are eligible that day. */
  pct: number | null;
  completedCount: number;
  eligibleCount: number;
  isPerfect: boolean;
}

/** Habits that count toward a given date: created on/before it and not archived before it.
 *  Archived habits keep counting for days up to (and including) their archive date. */
export function eligibleHabitsForDate(habits: Habit[], date: string, now: string = todayISO()): Habit[] {
  return habits.filter((h) => {
    if (h.active) return h.createdAt.slice(0, 10) <= date;
    return h.createdAt.slice(0, 10) <= date && now >= date; // archived: count past days
  });
}

/** A habit counts as done for analytics when its logged value actually meets the
 *  target: checkbox = stored flag (value 0/1), numeric/duration = value >= target.
 *  Never trust the stale stored `completed` flag for numeric/duration — it can
 *  disagree with the value after a partial log or a target edit. */
export function habitValueDone(
  habit: Pick<Habit, 'type' | 'target'>,
  rec: { value: number; completed: boolean } | undefined
): boolean {
  if (!rec) return false;
  return habit.type === 'checkbox' ? rec.completed === true : rec.value >= habit.target;
}

function recordFor(records: Record<string, DailyRecord>, date: string): DailyRecord | undefined {
  const rec = records[date];
  return rec && Object.keys(rec.habits).length >= 0 ? rec : undefined;
}

/** Core per-day evaluation used by dashboard, calendar, grid and stats. */
export function evaluateDay(
  arc: Arc,
  habits: Habit[],
  records: Record<string, DailyRecord>,
  date: string,
  now: string = todayISO()
): DayEvaluation {
  if (date < arc.startDate) {
    return { state: 'before-start', pct: null, completedCount: 0, eligibleCount: 0, isPerfect: false };
  }
  const dayIndex = daysBetween(arc.startDate, date);
  if (dayIndex >= arc.durationDays) {
    return { state: 'future', pct: null, completedCount: 0, eligibleCount: 0, isPerfect: false };
  }
  if (date > now) {
    return { state: 'future', pct: null, completedCount: 0, eligibleCount: 0, isPerfect: false };
  }

  const eligible = eligibleHabitsForDate(habits, date, now);
  const rec = recordFor(records, date);
  const done = eligible.filter((h) => habitValueDone(h, rec?.habits[h.id]));
  const eligibleCount = eligible.length;
  const completedCount = done.length;
  const pct = eligibleCount === 0 ? null : Math.round((completedCount / eligibleCount) * 100);
  const isPerfect = eligibleCount > 0 && completedCount === eligibleCount;

  let state: DayState;
  if (date === now) state = 'today';
  else if (pct === null) state = 'empty';
  else if (isPerfect) state = 'complete';
  else if (completedCount > 0) state = 'partial';
  else state = 'empty';

  return { state, pct, completedCount, eligibleCount, isPerfect };
}

/** "Qualifying day": all active habits for that day completed (perfect day), per spec §6. */
function isQualifyingDay(evaln: DayEvaluation): boolean {
  return evaln.isPerfect;
}

export interface Streaks {
  current: number;
  best: number;
}

/** Current streak: backward from the latest qualifying day through consecutive qualifying dates.
 *  Future days never break a streak (spec §6). */
export function computeStreaks(
  arc: Arc,
  habits: Habit[],
  records: Record<string, DailyRecord>,
  now: string = todayISO()
): Streaks {
  const start = arc.startDate;
  const today = now < start ? start : now;
  const lastArcDay = addDays(start, arc.durationDays - 1);
  const end = today < lastArcDay ? today : lastArcDay;

  // Collect qualifying dates from start..end.
  const qualifying = new Set<string>();
  let cursor = start;
  while (cursor <= end) {
    const evaln = evaluateDay(arc, habits, records, cursor, now);
    if (isQualifyingDay(evaln)) qualifying.add(cursor);
    cursor = addDays(cursor, 1);
  }

  // Best streak: longest consecutive run.
  let best = 0;
  let run = 0;
  cursor = start;
  while (cursor <= end) {
    if (qualifying.has(cursor)) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
    cursor = addDays(cursor, 1);
  }

  // Current streak: walk back from today (or latest qualifying day ≤ today).
  // "Today" counts toward the streak only if it is already qualifying; otherwise
  // the streak can still be alive via yesterday.
  let current = 0;
  let probe = end;
  if (!qualifying.has(end)) probe = addDays(end, -1);
  while (probe >= start && qualifying.has(probe)) {
    current += 1;
    probe = addDays(probe, -1);
  }

  return { current, best: Math.max(best, current) };
}

/** True once the final Arc day has fully passed (i.e. the day AFTER the last
 *  Arc day has begun). The Arc stays visible/complete on Day 90 itself. */
export function isArcComplete(arc: Arc, now: string = todayISO()): boolean {
  return now > addDays(arc.startDate, arc.durationDays - 1);
}

export interface OverallStats {
  dayNumber: number;
  totalPct: number | null;
  perfectDays: number;
  elapsedDays: number;
  qualifyingDays: number;
  streaks: Streaks;
}

export function computeOverallStats(
  arc: Arc,
  habits: Habit[],
  records: Record<string, DailyRecord>,
  now: string = todayISO()
): OverallStats {
  const today = now < arc.startDate ? arc.startDate : now;
  const dayNumber = Math.min(Math.max(daysBetween(arc.startDate, today) + 1, 1), arc.durationDays);
  const elapsedDays = dayNumber;

  let perfectDays = 0;
  let pctSum = 0;
  let pctDays = 0;
  let qualifyingDays = 0;

  let cursor = arc.startDate;
  const end = today;
  while (cursor <= end) {
    const evaln = evaluateDay(arc, habits, records, cursor, now);
    if (evaln.isPerfect) { perfectDays += 1; qualifyingDays += 1; }
    else if (evaln.pct !== null && evaln.completedCount > 0) qualifyingDays += 1;
    if (evaln.pct !== null) { pctSum += evaln.pct; pctDays += 1; }
    cursor = addDays(cursor, 1);
  }

  return {
    dayNumber,
    totalPct: pctDays === 0 ? null : Math.round(pctSum / pctDays),
    perfectDays,
    elapsedDays,
    qualifyingDays,
    streaks: computeStreaks(arc, habits, records, now),
  };
}

export interface HabitStat {
  habit: Habit;
  rate: number | null;      // completed / eligible occurrences
  completedCount: number;
  eligibleCount: number;
  totalValue: number;       // sum of logged values (minutes / units)
  currentStreak: number;
  bestStreak: number;
}

/** Per-habit analytics: rate, totals and streaks over eligible days. */
export function computeHabitStats(
  arc: Arc,
  habits: Habit[],
  records: Record<string, DailyRecord>,
  now: string = todayISO()
): HabitStat[] {
  const today = now < arc.startDate ? arc.startDate : now;
  return habits.map((habit) => {
    let completed = 0;
    let eligible = 0;
    let totalValue = 0;
    let cur = 0;
    let best = 0;
    let run = 0;

    let cursor = arc.startDate;
    while (cursor <= today) {
      const el = eligibleHabitsForDate([habit], cursor, now).length > 0;
      const isDone = habitValueDone(habit, records[cursor]?.habits[habit.id]);
      if (el) {
        eligible += 1;
        if (isDone) completed += 1;
        const val = records[cursor]?.habits[habit.id]?.value ?? 0;
        totalValue += val;
      }
      if (isDone) {
        run += 1;
        if (run > best) best = run;
      } else if (el) {
        run = 0; // only eligible-but-missed days break a habit streak
      }
      cursor = addDays(cursor, 1);
    }

    // Current habit streak: count back from today.
    cur = 0;
    let probe = today;
    const lastEligible = (d: string) => eligibleHabitsForDate([habit], d, now).length > 0;
    while (probe >= arc.startDate) {
      if (habitValueDone(habit, records[probe]?.habits[habit.id])) cur += 1;
      else if (lastEligible(probe)) break;
      // not eligible (e.g. habit created later): keep walking back
      probe = addDays(probe, -1);
    }

    return {
      habit,
      rate: eligible === 0 ? null : Math.round((completed / eligible) * 100),
      completedCount: completed,
      eligibleCount: eligible,
      totalValue,
      currentStreak: cur,
      bestStreak: Math.max(best, cur),
    };
  });
}

export interface TrendPoint {
  date: string;
  pct: number | null;
}

/** Daily completion percentages for the last N arc days ending today. */
export function computeTrend(
  arc: Arc,
  habits: Habit[],
  records: Record<string, DailyRecord>,
  days: number,
  now: string = todayISO()
): TrendPoint[] {
  const today = now < arc.startDate ? arc.startDate : now;
  const firstArcDay = arc.startDate;
  const from = daysBetween(firstArcDay, today) < days
    ? firstArcDay
    : addDays(today, -(days - 1));

  const points: TrendPoint[] = [];
  let cursor = from;
  while (cursor <= today) {
    const evaln = evaluateDay(arc, habits, records, cursor, now);
    points.push({ date: cursor, pct: evaln.pct });
    cursor = addDays(cursor, 1);
  }
  return points;
}

/** Weekly buckets (completion % per ISO week) for the trend chart. */
export function computeWeeklyTrend(
  arc: Arc,
  habits: Habit[],
  records: Record<string, DailyRecord>,
  weeks: number,
  now: string = todayISO()
): TrendPoint[] {
  const daily = computeTrend(arc, habits, records, arc.durationDays, now);
  const buckets = new Map<string, { sum: number; n: number; first: string }>();
  for (const p of daily) {
    if (p.pct === null) continue;
    // simple Monday bucket via date math from arc start
    const dayIdx = daysBetween(arc.startDate, p.date);
    const weekIdx = Math.floor(dayIdx / 7);
    const key = `W${weekIdx}`;
    const b = buckets.get(key) ?? { sum: 0, n: 0, first: p.date };
    b.sum += p.pct;
    b.n += 1;
    buckets.set(key, b);
  }
  const out: TrendPoint[] = [];
  for (const [, b] of buckets) out.push({ date: b.first, pct: Math.round(b.sum / b.n) });
  return out.slice(-weeks);
}
