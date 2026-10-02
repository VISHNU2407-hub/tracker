/* ============================================================
   useAnalytics + useRoute — memoized derived state.

   Every metric is scoped to the ACTIVE track: habits and rules
   that belong to it (membership is `trackIds`; undefined = all
   tracks) are evaluated against its window. The overall Life
   System is continuous — tracks are challenges inside it.
   ============================================================ */

import { useMemo, useState } from 'react';
import type { AppData, Habit, Rule } from '../types';
import {
  computeOverallStats,
  computeHabitStats,
  computeRuleStats,
  computeStreaks,
  evaluateDay,
  type OverallStats,
  type HabitStat,
  type RuleStat,
} from '../services/analytics';
import { belongsToTrack } from '../services/storage';
import { todayISO } from '../services/date';

/** Items whose `trackIds` includes the track (undefined = every track). */
export function scopedToTrack<T extends { trackIds?: string[] }>(
  items: T[],
  trackId: string | null | undefined
): T[] {
  if (!trackId) return items;
  return items.filter((item) => belongsToTrack(item.trackIds, trackId));
}

/** The active track plus the habits & rules that belong to it. */
export function trackScope(data: AppData): { track: AppData['arc']; habits: Habit[]; rules: Rule[] } {
  const track = data.arc;
  return {
    track,
    habits: scopedToTrack(data.habits, track?.id),
    rules: scopedToTrack(data.rules, track?.id),
  };
}

export function useAnalytics(data: AppData): {
  stats: OverallStats | null;
  habitStats: HabitStat[];
  ruleStats: RuleStat[];
  evaluate: (date: string) => ReturnType<typeof evaluateDay> | null;
} {
  const { habits, rules, dailyRecords } = data;
  const arc = data.arc;
  const today = todayISO();
  const scope = useMemo(() => trackScope(data), [data]);
  const scopedHabits = scope.habits;
  const scopedRules = scope.rules;

  const stats = useMemo(
    () => (arc ? computeOverallStats(arc, scopedHabits, scopedRules, dailyRecords, today) : null),
    [arc, scopedHabits, scopedRules, dailyRecords, today]
  );

  const habitStats = useMemo(
    () => (arc ? computeHabitStats(arc, scopedHabits, dailyRecords, today) : []),
    [arc, scopedHabits, dailyRecords, today]
  );

  const ruleStats = useMemo(
    () => (arc ? computeRuleStats(arc, scopedRules, dailyRecords, today) : []),
    [arc, scopedRules, dailyRecords, today]
  );

  const evaluate = useMemo(() => {
    if (!arc) return () => null;
    return (date: string) => evaluateDay(arc, scopedHabits, scopedRules, dailyRecords, date, today);
  }, [arc, scopedHabits, scopedRules, dailyRecords, today]);

  // `habits`/`rules` referenced so the hook re-derives when definitions change.
  void habits;
  void rules;

  return { stats, habitStats, ruleStats, evaluate };
}

export function useStreaks(data: AppData) {
  const arc = data.arc;
  const today = todayISO();
  const scope = trackScope(data);
  return useMemo(
    () => (arc ? computeStreaks(arc, scope.habits, scope.rules, data.dailyRecords, today) : { current: 0, best: 0 }),
    [arc, scope, data.dailyRecords, today]
  );
}

export type PageId =
  | 'dashboard'
  | 'today'
  | 'calendar'
  | 'habits'
  | 'stats'
  | 'reflection'
  | 'tracks'
  | 'settings';

export function useRoute(): { page: PageId; setPage: (p: PageId) => void } {
  const [page, setPage] = useState<PageId>('dashboard');
  return { page, setPage };
}
