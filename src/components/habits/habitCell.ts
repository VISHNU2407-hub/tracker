/* ============================================================
   habitCell — shared per-habit/per-day + per-rule/per-day status
   derivation. One source of truth for the monthly habit grid
   (Calendar), the per-habit history strip (Habits page) and the
   per-rule rows, built on the existing analytics eligibility +
   completion rules. Purely derived from stored data — no new
   state, no duplicate calculations.
   ============================================================ */

import type { Arc, DailyRecord, Habit, Rule } from '../../types';
import { eligibleHabitsForDate, eligibleRulesForDate, habitValueDone, ruleFollowed } from '../../services/analytics';
import { addDays } from '../../services/date';

export type HabitCellState =
  | 'done'     // target met for that day
  | 'partial'  // some progress logged, target not met
  | 'missed'   // eligible day, nothing logged
  | 'pending'  // today, not done yet
  | 'na'       // habit not counting that day (not created yet / paused)
  | 'future'   // locked — the day hasn't arrived
  | 'outside'; // outside the Arc window

export interface HabitCellView {
  state: HabitCellState;
  /** Short text marker so state is never color-only. */
  glyph: string;
  /** Human-readable label for tooltips and screen readers. */
  label: string;
}

export function arcLastDay(arc: Arc): string {
  return addDays(arc.startDate, arc.durationDays - 1);
}

export function habitCellFor(
  habit: Habit,
  date: string,
  records: Record<string, DailyRecord>,
  now: string,
  arc: Arc,
): HabitCellView {
  const arcEnd = arcLastDay(arc);

  if (date < arc.startDate || date > arcEnd) {
    return { state: 'outside', glyph: '', label: 'Outside your Arc' };
  }

  if (date > now) {
    // Archived habits never become eligible again → paused, not "coming soon".
    if (!habit.active) {
      return { state: 'na', glyph: '·', label: 'Paused — habit is archived' };
    }
    return { state: 'future', glyph: '', label: 'Locked — future day' };
  }

  if (eligibleHabitsForDate([habit], date, now).length === 0) {
    return { state: 'na', glyph: '·', label: 'Not applicable — habit not started yet' };
  }

  const rec = records[date]?.habits[habit.id];

  if (habitValueDone(habit, rec)) {
    const detail = habit.type === 'checkbox' || !rec ? '' : ` (${rec.value}/${habit.target} ${habit.unit})`;
    return { state: 'done', glyph: '✓', label: `Done${detail}` };
  }

  if (habit.type !== 'checkbox' && rec && rec.value > 0) {
    return {
      state: 'partial',
      glyph: '◐',
      label: `Partial — ${rec.value}/${habit.target} ${habit.unit}`,
    };
  }

  if (date === now) {
    return { state: 'pending', glyph: '○', label: 'In progress today — not done yet' };
  }

  return { state: 'missed', glyph: '✕', label: 'Missed — no progress logged' };
}

/* ---------- Per-rule cells: what you CONTROLLED ---------- */

export interface RuleCellView {
  state: 'followed' | 'broken' | 'pending' | 'na' | 'future' | 'outside';
  glyph: string;
  label: string;
}

export function ruleCellFor(
  arc: Arc,
  rule: Rule,
  date: string,
  records: Record<string, DailyRecord>,
  now: string,
): RuleCellView {
  const arcEnd = addDays(arc.startDate, arc.durationDays - 1);

  if (date < arc.startDate || date > arcEnd) {
    return { state: 'outside', glyph: '', label: 'Outside your Arc' };
  }
  if (date > now) {
    return { state: 'future', glyph: '', label: 'Locked — future day' };
  }
  if (eligibleRulesForDate(arc, [rule], date, now).length === 0) {
    return { state: 'na', glyph: '·', label: 'Not applicable yet' };
  }

  const stored = records[date]?.rules?.[rule.id];
  if (ruleFollowed(rule, stored)) {
    return { state: 'followed', glyph: '✓', label: 'Followed' };
  }
  if (date === now && stored === undefined) {
    return { state: 'pending', glyph: '○', label: 'Not marked yet today' };
  }
  return { state: 'broken', glyph: '✕', label: 'Not followed' };
}
