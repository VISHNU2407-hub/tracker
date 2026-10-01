/* ============================================================
   useAnalytics + useRoute — memoized derived state.
   ============================================================ */

import { useMemo, useState } from 'react';
import type { AppData } from '../types';
import {
  computeOverallStats,
  computeHabitStats,
  computeStreaks,
  evaluateDay,
  type OverallStats,
  type HabitStat,
} from '../services/analytics';
import { todayISO } from '../services/date';

export function useAnalytics(data: AppData): {
  stats: OverallStats | null;
  habitStats: HabitStat[];
  evaluate: (date: string) => ReturnType<typeof evaluateDay> | null;
} {
  const { arc, habits, dailyRecords } = data;
  const today = todayISO();

  const stats = useMemo(
    () => (arc ? computeOverallStats(arc, habits, dailyRecords, today) : null),
    [arc, habits, dailyRecords, today]
  );

  const habitStats = useMemo(
    () => (arc ? computeHabitStats(arc, habits, dailyRecords, today) : []),
    [arc, habits, dailyRecords, today]
  );

  const evaluate = useMemo(() => {
    if (!arc) return () => null;
    return (date: string) => evaluateDay(arc, habits, dailyRecords, date, today);
  }, [arc, habits, dailyRecords, today]);

  return { stats, habitStats, evaluate };
}

export function useStreaks(data: AppData) {
  const { arc, habits, dailyRecords } = data;
  const today = todayISO();
  return useMemo(
    () => (arc ? computeStreaks(arc, habits, dailyRecords, today) : { current: 0, best: 0 }),
    [arc, habits, dailyRecords, today]
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
