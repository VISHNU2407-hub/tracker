/* ============================================================
   useAnalytics + useRoute — memoized derived state.
   v2: rules participate in day evaluation; ruleStats exposed.
   ============================================================ */

import { useMemo, useState } from 'react';
import type { AppData } from '../types';
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
import { todayISO } from '../services/date';

export function useAnalytics(data: AppData): {
  stats: OverallStats | null;
  habitStats: HabitStat[];
  ruleStats: RuleStat[];
  evaluate: (date: string) => ReturnType<typeof evaluateDay> | null;
} {
  const { arc, habits, rules, dailyRecords } = data;
  const today = todayISO();

  const stats = useMemo(
    () => (arc ? computeOverallStats(arc, habits, rules, dailyRecords, today) : null),
    [arc, habits, rules, dailyRecords, today]
  );

  const habitStats = useMemo(
    () => (arc ? computeHabitStats(arc, habits, dailyRecords, today) : []),
    [arc, habits, dailyRecords, today]
  );

  const ruleStats = useMemo(
    () => (arc ? computeRuleStats(arc, rules, dailyRecords, today) : []),
    [arc, rules, dailyRecords, today]
  );

  const evaluate = useMemo(() => {
    if (!arc) return () => null;
    return (date: string) => evaluateDay(arc, habits, rules, dailyRecords, date, today);
  }, [arc, habits, rules, dailyRecords, today]);

  return { stats, habitStats, ruleStats, evaluate };
}

export function useStreaks(data: AppData) {
  const { arc, habits, rules, dailyRecords } = data;
  const today = todayISO();
  return useMemo(
    () => (arc ? computeStreaks(arc, habits, rules, dailyRecords, today) : { current: 0, best: 0 }),
    [arc, habits, rules, dailyRecords, today]
  );
}

export type PageId =
  | 'dashboard'
  | 'today'
  | 'calendar'
  | 'habits'
  | 'stats'
  | 'reflection'
  | 'myarc'
  | 'settings';

export function useRoute(): { page: PageId; setPage: (p: PageId) => void } {
  const [page, setPage] = useState<PageId>('dashboard');
  return { page, setPage };
}
