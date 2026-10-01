/* ============================================================
   useAppData — central state store wired to the storage service.
   Every mutation persists immediately (spec §5).
   v2: rules are daily-trackable entities; per-day follow status
   is stored inside each DailyRecord.
   ============================================================ */

import { useCallback, useEffect, useState } from 'react';
import { useToday } from './useToday';
import type { AppData, Arc, Habit, Rule, DailyRecord, Reflection, RuleStatus } from '../types';
import {
  loadAppData,
  saveAppData,
  resetAllData,
  normalizeAppData,
  SCHEMA_VERSION,
} from '../services/storage';
import { todayISO, weekStartOf } from '../services/date';

const EMPTY: AppData = {
  settings: { theme: 'dark', onboarded: false, demoMode: false },
  arc: null,
  habits: [],
  rules: [],
  dailyRecords: {},
  reflections: {},
  version: SCHEMA_VERSION,
};

export interface AppDataApi {
  data: AppData;
  loaded: boolean;
  /** Today's local date (YYYY-MM-DD). Refreshes automatically at midnight. */
  today: string;
  /* onboarding / settings */
  completeOnboarding: (arc: Arc, habits: Omit<Habit, 'id' | 'createdAt' | 'order' | 'active'>[], rules: string[]) => void;
  setOnboarded: (v: boolean) => void;
  setDemoMode: (v: boolean) => void;
  updateArc: (patch: Partial<Arc>) => void;
  /* habits */
  addHabit: (h: Omit<Habit, 'id' | 'createdAt' | 'order' | 'active'>) => Habit;
  updateHabit: (id: string, patch: Partial<Omit<Habit, 'id' | 'createdAt'>>) => void;
  archiveHabit: (id: string) => void;
  restoreHabit: (id: string) => void;
  deleteHabitPermanently: (id: string) => void;
  reorderHabits: (orderedIds: string[]) => void;
  /* rules */
  addRule: (text: string, fromDay?: number) => Rule;
  updateRule: (id: string, patch: Partial<Omit<Rule, 'id' | 'createdAt'>>) => void;
  archiveRule: (id: string) => void;
  restoreRule: (id: string) => void;
  deleteRulePermanently: (id: string) => void;
  reorderRules: (orderedIds: string[]) => void;
  /** status null removes the stored status for that day */
  setRuleStatus: (date: string, ruleId: string, status: RuleStatus | null) => void;
  /* daily records */
  setHabitValue: (date: string, habitId: string, value: number) => void;
  toggleHabit: (date: string, habitId: string) => void;
  setDayNote: (date: string, note: string) => void;
  /* reflections */
  saveReflection: (weekKey: string, fields: Pick<Reflection, 'wentWell' | 'toImprove' | 'nextFocus'>) => void;
  deleteReflection: (weekKey: string) => void;
  /* danger zone */
  replaceAllData: (imported: unknown) => void;
  wipeEverything: () => void;
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Pure next-state update for one day's records — shared by mutateDay,
 *  setHabitValue and toggleHabit so no caller has to re-enter apply(). */
function withDay(d: AppData, date: string, fn: (rec: DailyRecord) => DailyRecord): AppData {
  const existing: DailyRecord = d.dailyRecords[date] ?? {
    date,
    habits: {},
    rules: {},
    note: '',
    updatedAt: new Date().toISOString(),
  };
  const next = fn({ ...existing, rules: existing.rules ?? {} });
  return {
    ...d,
    dailyRecords: {
      ...d.dailyRecords,
      [date]: { ...next, date, updatedAt: new Date().toISOString() },
    },
  };
}

function makeHabit(h: Omit<Habit, 'id' | 'createdAt' | 'order' | 'active'>, order: number): Habit {
  return {
    ...h,
    id: newId('habit'),
    active: true,
    createdAt: new Date().toISOString(),
    order,
  };
}

function makeRule(text: string, order: number, fromDay: number): Rule {
  return {
    id: newId('rule'),
    text: text.trim(),
    active: true,
    fromDay,
    createdAt: new Date().toISOString(),
    order,
  };
}

export function useAppData(): AppDataApi {
  const [data, setData] = useState<AppData>(EMPTY);
  const hookToday = useToday();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      setData(loadAppData());
    } catch {
      setData(EMPTY);
    }
    setLoaded(true);
  }, []);

  const apply = useCallback((fn: (d: AppData) => AppData) => {
    setData((prev) => {
      const next = fn(prev);
      saveAppData(next);
      return next;
    });
  }, []);

  const completeOnboarding = useCallback<AppDataApi['completeOnboarding']>(
    (arc, habitDefs, ruleTexts) => {
      apply((d) => ({
        ...d,
        settings: { ...d.settings, onboarded: true },
        arc: { ...arc, updatedAt: new Date().toISOString() },
        habits: habitDefs.map((h, i) => makeHabit(h, i + 1)),
        rules: ruleTexts.map((t, i) => makeRule(t, i + 1, 1)),
        dailyRecords: {}, // fresh arc
        reflections: {},
      }));
    },
    [apply]
  );

  const setOnboarded = useCallback((v: boolean) => {
    apply((d) => ({ ...d, settings: { ...d.settings, onboarded: v } }));
  }, [apply]);

  const setDemoMode = useCallback((v: boolean) => {
    apply((d) => ({ ...d, settings: { ...d.settings, demoMode: v } }));
  }, [apply]);

  const updateArc = useCallback<AppDataApi['updateArc']>(
    (patch) => {
      apply((d) =>
        d.arc
          ? { ...d, arc: { ...d.arc, ...patch, updatedAt: new Date().toISOString() } }
          : d
      );
    },
    [apply]
  );

  /* ---------- habits ---------- */

  const addHabit = useCallback<AppDataApi['addHabit']>(
    (h) => {
      const habit = makeHabit(h, 0);
      apply((d) => ({
        ...d,
        habits: [...d.habits, { ...habit, order: d.habits.length + 1 }],
      }));
      return habit;
    },
    [apply]
  );

  const updateHabit = useCallback<AppDataApi['updateHabit']>(
    (id, patch) => {
      apply((d) => ({
        ...d,
        habits: d.habits.map((h) => (h.id === id ? { ...h, ...patch } : h)),
      }));
    },
    [apply]
  );

  const archiveHabit = useCallback(
    (id: string) => {
      apply((d) => ({
        ...d,
        habits: d.habits.map((h) => (h.id === id ? { ...h, active: false } : h)),
      }));
    },
    [apply]
  );

  const restoreHabit = useCallback(
    (id: string) => {
      apply((d) => ({
        ...d,
        habits: d.habits.map((h) => (h.id === id ? { ...h, active: true } : h)),
      }));
    },
    [apply]
  );

  const deleteHabitPermanently = useCallback(
    (id: string) => {
      apply((d) => {
        // Remove definition AND its records — used only from the archived list
        // with an explicit confirmation, since this does destroy history.
        const dailyRecords: Record<string, DailyRecord> = {};
        for (const [date, rec] of Object.entries(d.dailyRecords)) {
          if (!rec.habits[id]) {
            dailyRecords[date] = rec;
          } else {
            const habits = { ...rec.habits };
            delete habits[id];
            dailyRecords[date] = { ...rec, habits, updatedAt: new Date().toISOString() };
          }
        }
        return { ...d, habits: d.habits.filter((h) => h.id !== id), dailyRecords };
      });
    },
    [apply]
  );

  const reorderHabits = useCallback<AppDataApi['reorderHabits']>(
    (orderedIds) => {
      apply((d) => {
        const orderMap = new Map(orderedIds.map((id, i) => [id, i + 1]));
        return {
          ...d,
          habits: d.habits.map((h) =>
            orderMap.has(h.id) ? { ...h, order: orderMap.get(h.id)! } : h
          ),
        };
      });
    },
    [apply]
  );

  /* ---------- rules ---------- */

  const addRule = useCallback<AppDataApi['addRule']>(
    (text, fromDay) => {
      const rule = makeRule(text, 0, fromDay ?? 1);
      apply((d) => ({
        ...d,
        rules: [...d.rules, { ...rule, order: d.rules.length + 1 }],
        // Mirror active rule texts onto arc.rules for back-compat.
        arc: d.arc
          ? { ...d.arc, rules: [...d.arc.rules, rule.text], updatedAt: new Date().toISOString() }
          : d.arc,
      }));
      return rule;
    },
    [apply]
  );

  const updateRule = useCallback<AppDataApi['updateRule']>(
    (id, patch) => {
      apply((d) => {
        const rules = d.rules.map((r) => (r.id === id ? { ...r, ...patch } : r));
        return {
          ...d,
          rules,
          arc: d.arc ? { ...d.arc, rules: rules.map((r) => r.text), updatedAt: new Date().toISOString() } : d.arc,
        };
      });
    },
    [apply]
  );

  const archiveRule = useCallback(
    (id: string) => {
      apply((d) => {
        const rules = d.rules.map((r) => (r.id === id ? { ...r, active: false } : r));
        return {
          ...d,
          rules,
          arc: d.arc ? { ...d.arc, rules: rules.filter((r) => r.active).map((r) => r.text) } : d.arc,
        };
      });
    },
    [apply]
  );

  const restoreRule = useCallback(
    (id: string) => {
      apply((d) => {
        const rules = d.rules.map((r) => (r.id === id ? { ...r, active: true } : r));
        return {
          ...d,
          rules,
          arc: d.arc ? { ...d.arc, rules: rules.filter((r) => r.active).map((r) => r.text) } : d.arc,
        };
      });
    },
    [apply]
  );

  const deleteRulePermanently = useCallback(
    (id: string) => {
      apply((d) => {
        // Removes the rule entity AND all its stored statuses (history-destroying,
        // confirm-gated in the UI like habit deletion).
        const dailyRecords: Record<string, DailyRecord> = {};
        for (const [date, rec] of Object.entries(d.dailyRecords)) {
          if (!rec.rules?.[id]) {
            dailyRecords[date] = rec;
          } else {
            const rules = { ...rec.rules };
            delete rules[id];
            dailyRecords[date] = { ...rec, rules, updatedAt: new Date().toISOString() };
          }
        }
        const remaining = d.rules.filter((r) => r.id !== id);
        return {
          ...d,
          rules: remaining,
          dailyRecords,
          arc: d.arc ? { ...d.arc, rules: remaining.map((r) => r.text) } : d.arc,
        };
      });
    },
    [apply]
  );

  const reorderRules = useCallback<AppDataApi['reorderRules']>(
    (orderedIds) => {
      apply((d) => {
        const orderMap = new Map(orderedIds.map((id, i) => [id, i + 1]));
        return {
          ...d,
          rules: d.rules.map((r) =>
            orderMap.has(r.id) ? { ...r, order: orderMap.get(r.id)! } : r
          ),
        };
      });
    },
    [apply]
  );

  const setRuleStatus = useCallback<AppDataApi['setRuleStatus']>(
    (date, ruleId, status) => {
      apply((d) =>
        withDay(d, date, (rec) => {
          const rules = { ...(rec.rules ?? {}) };
          if (status === null) {
            delete rules[ruleId];
          } else {
            rules[ruleId] = { status };
          }
          return { ...rec, rules };
        })
      );
    },
    [apply]
  );

  /* ---------- daily records ---------- */

  const mutateDay = useCallback(
    (date: string, fn: (rec: DailyRecord) => DailyRecord) => {
      apply((d) => withDay(d, date, fn));
    },
    [apply]
  );

  const setHabitValue = useCallback<AppDataApi['setHabitValue']>(
    (date, habitId, value) => {
      apply((d) => {
        const habit = d.habits.find((h) => h.id === habitId);
        const completed =
          habit?.type === 'checkbox' ? value > 0 : habit ? value >= habit.target : value > 0;
        return withDay(d, date, (rec) => ({
          ...rec,
          habits: { ...rec.habits, [habitId]: { value, completed } },
        }));
      });
    },
    [apply]
  );

  const toggleHabit = useCallback<AppDataApi['toggleHabit']>(
    (date, habitId) => {
      apply((d) => {
        const habit = d.habits.find((h) => h.id === habitId);
        return withDay(d, date, (rec) => {
          const cur = rec.habits[habitId];
          const wasDone = habit
            ? habit.type === 'checkbox'
              ? cur?.completed === true
              : (cur?.value ?? 0) >= habit.target
            : cur?.completed === true;
          const completed = !wasDone;
          // Restore the last logged value when un-completing, else a sensible full value.
          const value = completed
            ? cur?.value && cur.value > 0
              ? cur.value
              : habit?.type === 'checkbox'
                ? 1
                : (habit?.target ?? 1)
            : 0;
          return { ...rec, habits: { ...rec.habits, [habitId]: { value, completed } } };
        });
      });
    },
    [apply]
  );

  const setDayNote = useCallback<AppDataApi['setDayNote']>(
    (date, note) => {
      mutateDay(date, (rec) => ({ ...rec, note }));
    },
    [mutateDay]
  );

  /* ---------- reflections ---------- */

  const saveReflection = useCallback<AppDataApi['saveReflection']>(
    (weekKey, fields) => {
      apply((d) => {
        const existing = d.reflections[weekKey];
        const nowISO = new Date().toISOString();
        const reflection: Reflection = {
          id: existing?.id ?? newId('refl'),
          weekKey,
          weekStart: weekStartOf(weekKeyToSampleDate(weekKey)),
          ...fields,
          createdAt: existing?.createdAt ?? nowISO,
          updatedAt: nowISO,
        };
        return { ...d, reflections: { ...d.reflections, [weekKey]: reflection } };
      });
    },
    [apply]
  );

  const deleteReflection = useCallback((weekKey: string) => {
    apply((d) => {
      if (!d.reflections[weekKey]) return d;
      const reflections = { ...d.reflections };
      delete reflections[weekKey];
      return { ...d, reflections };
    });
  }, [apply]);

  /* ---------- danger zone ---------- */

  const replaceAllData = useCallback(
    (imported: unknown) => {
      const normalized = normalizeAppData(imported);
      normalized.settings.onboarded = true;
      saveAppData(normalized);
      setData(normalized);
    },
    []
  );

  const wipeEverything = useCallback(() => {
    resetAllData();
    setData({ ...EMPTY, version: SCHEMA_VERSION });
  }, []);

  return {
    data,
    loaded,
    today: hookToday,
    completeOnboarding,
    setOnboarded,
    setDemoMode,
    updateArc,
    addHabit,
    updateHabit,
    archiveHabit,
    restoreHabit,
    deleteHabitPermanently,
    reorderHabits,
    addRule,
    updateRule,
    archiveRule,
    restoreRule,
    deleteRulePermanently,
    reorderRules,
    setRuleStatus,
    setHabitValue,
    toggleHabit,
    setDayNote,
    saveReflection,
    deleteReflection,
    replaceAllData,
    wipeEverything,
  };
}

/** Derive a sample date inside a weekKey like "2026-W40" for weekStart storage. */
function weekKeyToSampleDate(weekKey: string): string {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekKey);
  if (!m) return todayISO();
  const year = Number(m[1]);
  const week = Number(m[2]);
  // Jan 4 is always in ISO week 1.
  const jan4 = new Date(year, 0, 4);
  const dow = (jan4.getDay() + 6) % 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dow + (week - 1) * 7);
  const y = monday.getFullYear();
  const mo = String(monday.getMonth() + 1).padStart(2, '0');
  const da = String(monday.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}
