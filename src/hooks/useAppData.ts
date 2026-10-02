/* ============================================================
   useAppData — central state store wired to the storage service.
   Every mutation persists immediately.

   v3: user-created Tracks. `tracks` + `activeTrackId` are
   canonical; `arc` is kept as a live mirror of the active track
   so analytics and pages read one derived "current track".
   ============================================================ */

import { useCallback, useEffect, useState } from 'react';
import { useToday } from './useToday';
import type { AppData, Arc, Habit, Rule, Track, DailyRecord, Reflection, RuleStatus, TrackStatus } from '../types';
import {
  loadAppData,
  saveAppData,
  resetAllData,
  normalizeAppData,
  SCHEMA_VERSION,
} from '../services/storage';
import { addDays, isEditableDate, todayISO, weekKeyOf, weekStartOf } from '../services/date';
import { writeSetup, clearEntry, clearSetup } from '../app/platform';

const EMPTY: AppData = {
  settings: { theme: 'dark', onboarded: false, demoMode: false },
  tracks: [],
  activeTrackId: null,
  arc: null,
  habits: [],
  rules: [],
  dailyRecords: {},
  reflections: {},
  version: SCHEMA_VERSION,
};

/** Fields a user supplies when creating (or editing) a track. */
export interface TrackDraft {
  title: string;
  description?: string;
  icon?: string;
  startDate: string;
  durationDays: number;
  goal?: string;
  why?: string;
}

export interface AppDataApi {
  data: AppData;
  loaded: boolean;
  /** Today's local date (YYYY-MM-DD). Refreshes automatically at midnight. */
  today: string;
  /* onboarding / settings */
  completeOnboarding: (track: Arc, habits: Omit<Habit, 'id' | 'createdAt' | 'order' | 'active' | 'trackIds'>[], rules: string[]) => void;
  setOnboarded: (v: boolean) => void;
  setDemoMode: (v: boolean) => void;
  /* tracks */
  createTrack: (draft: TrackDraft, includedHabitIds?: string[], includedRuleIds?: string[]) => Track;
  updateTrack: (id: string, patch: Partial<Omit<Track, 'id' | 'createdAt'>>) => void;
  /** Set which habits/rules belong to a track (membership is `trackIds`). */
  setTrackMembership: (id: string, habitIds: string[], ruleIds: string[]) => void;
  deleteTrack: (id: string) => void;
  setActiveTrack: (id: string) => void;
  setTrackStatus: (id: string, status: TrackStatus) => void;
  /** Back-compat alias: patches the ACTIVE track. */
  updateArc: (patch: Partial<Arc>) => void;
  /* habits */
  addHabit: (h: Omit<Habit, 'id' | 'createdAt' | 'order' | 'active' | 'trackIds'>) => Habit;
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
  /** status null removes the stored status for that day.
   *  REJECTED unless date is today — previous/future days are read-only. */
  setRuleStatus: (date: string, ruleId: string, status: RuleStatus | null) => void;
  /* daily records — all three reject any date other than today */
  setHabitValue: (date: string, habitId: string, value: number) => void;
  toggleHabit: (date: string, habitId: string) => void;
  setDayNote: (date: string, note: string) => void;
  /* reflections — only the current week's reflection is writable */
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

/** Keep `arc` (the derived active track) and every track's rules text
 *  mirror in sync after each mutation — single source of truth: the
 *  Rule/Habit entities. */
function syncActive(d: AppData): AppData {
  const ruleTextsFor = (trackId: string): string[] =>
    d.rules
      .filter((r) => r.active && (r.trackIds === undefined || r.trackIds.includes(trackId)))
      .map((r) => r.text);
  const tracks = d.tracks.map((t) => {
    const rules = ruleTextsFor(t.id);
    return rules.length === t.rules.length && rules.every((x, i) => x === t.rules[i])
      ? t
      : { ...t, rules };
  });
  const base = tracks === d.tracks ? d : { ...d, tracks };
  const active = tracks.find((t) => t.id === d.activeTrackId) ?? null;
  return { ...base, arc: active };
}

function makeHabit(
  h: Omit<Habit, 'id' | 'createdAt' | 'order' | 'active' | 'trackIds'>,
  order: number,
  trackId: string | null
): Habit {
  return {
    ...h,
    id: newId('habit'),
    active: true,
    createdAt: new Date().toISOString(),
    order,
    trackIds: trackId ? [trackId] : undefined,
  };
}

function makeRule(text: string, order: number, fromDay: number, trackId: string | null): Rule {
  return {
    id: newId('rule'),
    text: text.trim(),
    active: true,
    fromDay,
    createdAt: new Date().toISOString(),
    order,
    trackIds: trackId ? [trackId] : undefined,
  };
}

function makeTrack(draft: TrackDraft): Track {
  const durationDays = Math.max(1, Math.floor(draft.durationDays) || 90);
  const nowISO = new Date().toISOString();
  return {
    id: newId('track'),
    title: draft.title.trim() || 'My Track',
    description: (draft.description ?? '').trim(),
    icon: (draft.icon ?? '').trim(),
    startDate: draft.startDate,
    endDate: addDays(draft.startDate, durationDays - 1),
    durationDays,
    goal: (draft.goal ?? '').trim(),
    why: (draft.why ?? '').trim(),
    rules: [],
    status: 'active',
    createdAt: nowISO,
    updatedAt: nowISO,
  };
}

/** Materialise membership then add/remove a track id (undefined = all tracks). */
function setMembership<T extends { id: string; trackIds?: string[] }>(
  items: T[],
  trackId: string,
  selectedIds: Set<string>,
  allTrackIds: string[]
): T[] {
  return items.map((item) => {
    const current = item.trackIds === undefined ? allTrackIds : item.trackIds;
    const next = new Set(current);
    if (selectedIds.has(item.id)) next.add(trackId);
    else next.delete(trackId);
    return { ...item, trackIds: Array.from(next) };
  });
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
      const next = syncActive(fn(prev));
      saveAppData(next);
      return next;
    });
  }, []);

  /**
   * Hard gate for tracked-day writes: only today's record may be mutated.
   * Calls for any previous or future date are rejected right here, so the
   * read-only rule holds no matter what the UI (or a hand-made call) tries.
   */
  const applyDay = useCallback(
    (date: string, fn: (d: AppData) => AppData) => {
      if (!isEditableDate(date)) return;
      apply(fn);
    },
    [apply]
  );

  /**
   * Same gate at week granularity for reflections: only the week containing
   * today is writable — past/future weeks are history.
   */
  const applyReflectionWeek = useCallback(
    (weekKey: string, fn: (d: AppData) => AppData) => {
      if (weekKey !== weekKeyOf(todayISO())) return;
      apply(fn);
    },
    [apply]
  );

  const completeOnboarding = useCallback<AppDataApi['completeOnboarding']>(
    (track, habitDefs, ruleTexts) => {
      const trackId = track.id || newId('track');
      const nowISO = new Date().toISOString();
      const newTrack: Track = {
        id: trackId,
        title: (track.title || 'My Track').trim() || 'My Track',
        description: (track.description ?? '').trim(),
        icon: (track.icon ?? '').trim(),
        startDate: track.startDate,
        endDate: track.endDate || addDays(track.startDate, Math.max(1, track.durationDays) - 1),
        durationDays: Math.max(1, Math.floor(track.durationDays) || 90),
        goal: (track.goal ?? '').trim(),
        why: (track.why ?? '').trim(),
        rules: [],
        status: 'active',
        createdAt: nowISO,
        updatedAt: nowISO,
      };
      apply((d) => ({
        ...d,
        settings: { ...d.settings, onboarded: true },
        tracks: [newTrack],
        activeTrackId: trackId,
        habits: habitDefs.map((h, i) => makeHabit(h, i + 1, trackId)),
        rules: ruleTexts.map((t, i) => makeRule(t, i + 1, 1, trackId)),
        dailyRecords: {}, // fresh track
        reflections: {},
      }));
      writeSetup(); // permanent first-run flag → wizard never runs again
    },
    [apply]
  );

  const setOnboarded = useCallback((v: boolean) => {
    apply((d) => ({ ...d, settings: { ...d.settings, onboarded: v } }));
  }, [apply]);

  const setDemoMode = useCallback((v: boolean) => {
    apply((d) => ({ ...d, settings: { ...d.settings, demoMode: v } }));
  }, [apply]);

  /* ---------- tracks ---------- */

  const createTrack = useCallback<AppDataApi['createTrack']>(
    (draft, includedHabitIds, includedRuleIds) => {
      const track = makeTrack(draft);
      apply((d) => {
        const allTrackIds = [...d.tracks.map((t) => t.id), track.id];
        const habitIds = new Set(includedHabitIds ?? d.habits.filter((h) => h.active).map((h) => h.id));
        const ruleIds = new Set(includedRuleIds ?? d.rules.filter((r) => r.active).map((r) => r.id));
        return {
          ...d,
          tracks: [...d.tracks, track],
          activeTrackId: track.id, // newly created track becomes the working one
          habits: setMembership(d.habits, track.id, habitIds, allTrackIds),
          rules: setMembership(d.rules, track.id, ruleIds, allTrackIds),
        };
      });
      return track;
    },
    [apply]
  );

  const updateTrack = useCallback<AppDataApi['updateTrack']>(
    (id, patch) => {
      apply((d) => {
        const tracks = d.tracks.map((t) => {
          if (t.id !== id) return t;
          const next: Track = { ...t, ...patch, updatedAt: new Date().toISOString() };
          // Keep the end date consistent with start + duration unless given.
          if ((patch.startDate || patch.durationDays) && patch.endDate === undefined) {
            const duration = Math.max(1, Math.floor(patch.durationDays ?? t.durationDays));
            next.durationDays = duration;
            next.endDate = addDays(patch.startDate ?? t.startDate, duration - 1);
          }
          return next;
        });
        return { ...d, tracks };
      });
    },
    [apply]
  );

  const setTrackMembership = useCallback<AppDataApi['setTrackMembership']>(
    (id, habitIds, ruleIds) => {
      apply((d) => {
        if (!d.tracks.some((t) => t.id === id)) return d;
        const allTrackIds = d.tracks.map((t) => t.id);
        return {
          ...d,
          habits: setMembership(d.habits, id, new Set(habitIds), allTrackIds),
          rules: setMembership(d.rules, id, new Set(ruleIds), allTrackIds),
        };
      });
    },
    [apply]
  );

  const setTrackStatus = useCallback<AppDataApi['setTrackStatus']>(
    (id, status) => updateTrack(id, { status }),
    [updateTrack]
  );

  const setActiveTrack = useCallback<AppDataApi['setActiveTrack']>(
    (id) => {
      apply((d) => (d.tracks.some((t) => t.id === id) ? { ...d, activeTrackId: id } : d));
    },
    [apply]
  );

  const deleteTrack = useCallback<AppDataApi['deleteTrack']>(
    (id) => {
      apply((d) => {
        const tracks = d.tracks.filter((t) => t.id !== id);
        // Remove the track from every membership list (records are preserved).
        const dropMembership = <T extends { trackIds?: string[] }>(items: T[]): T[] =>
          items.map((item) =>
            item.trackIds === undefined
              ? item
              : { ...item, trackIds: item.trackIds.filter((tid) => tid !== id) }
          );
        const activeTrackId =
          d.activeTrackId === id
            ? tracks.find((t) => t.status === 'active')?.id ?? tracks[0]?.id ?? null
            : d.activeTrackId;
        return {
          ...d,
          tracks,
          activeTrackId,
          habits: dropMembership(d.habits),
          rules: dropMembership(d.rules),
        };
      });
    },
    [apply]
  );

  const updateArc = useCallback<AppDataApi['updateArc']>(
    (patch) => {
      apply((d) => {
        if (!d.activeTrackId) return d;
        const tracks = d.tracks.map((t) =>
          t.id === d.activeTrackId ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t
        );
        return { ...d, tracks };
      });
    },
    [apply]
  );

  /* ---------- habits ---------- */

  const addHabit = useCallback<AppDataApi['addHabit']>(
    (h) => {
      const habit = makeHabit(h, 0, null);
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
      const rule = makeRule(text, 0, fromDay ?? 1, null);
      apply((d) => ({
        ...d,
        rules: [...d.rules, { ...rule, order: d.rules.length + 1, trackIds: d.activeTrackId ? [d.activeTrackId] : undefined }],
      }));
      return rule;
    },
    [apply]
  );

  const updateRule = useCallback<AppDataApi['updateRule']>(
    (id, patch) => {
      apply((d) => ({
        ...d,
        rules: d.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      }));
    },
    [apply]
  );

  const archiveRule = useCallback(
    (id: string) => {
      apply((d) => ({
        ...d,
        rules: d.rules.map((r) => (r.id === id ? { ...r, active: false } : r)),
      }));
    },
    [apply]
  );

  const restoreRule = useCallback(
    (id: string) => {
      apply((d) => ({
        ...d,
        rules: d.rules.map((r) => (r.id === id ? { ...r, active: true } : r)),
      }));
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
        return { ...d, rules: d.rules.filter((r) => r.id !== id), dailyRecords };
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
      applyDay(date, (d) =>
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
    [applyDay]
  );

  /* ---------- daily records (today only) ---------- */

  const mutateDay = useCallback(
    (date: string, fn: (rec: DailyRecord) => DailyRecord) => {
      applyDay(date, (d) => withDay(d, date, fn));
    },
    [applyDay]
  );

  const setHabitValue = useCallback<AppDataApi['setHabitValue']>(
    (date, habitId, value) => {
      applyDay(date, (d) => {
        const habit = d.habits.find((h) => h.id === habitId);
        const completed =
          habit?.type === 'checkbox' ? value > 0 : habit ? value >= habit.target : value > 0;
        return withDay(d, date, (rec) => ({
          ...rec,
          habits: { ...rec.habits, [habitId]: { value, completed } },
        }));
      });
    },
    [applyDay]
  );

  const toggleHabit = useCallback<AppDataApi['toggleHabit']>(
    (date, habitId) => {
      applyDay(date, (d) => {
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
    [applyDay]
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
      applyReflectionWeek(weekKey, (d) => {
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
    [applyReflectionWeek]
  );

  const deleteReflection = useCallback((weekKey: string) => {
    applyReflectionWeek(weekKey, (d) => {
      if (!d.reflections[weekKey]) return d;
      const reflections = { ...d.reflections };
      delete reflections[weekKey];
      return { ...d, reflections };
    });
  }, [applyReflectionWeek]);

  /* ---------- danger zone ---------- */

  const replaceAllData = useCallback(
    (imported: unknown) => {
      const normalized = normalizeAppData(imported);
      normalized.settings.onboarded = true;
      saveAppData(normalized);
      setData(normalized);
      writeSetup(); // a restored backup is a configured tracker
    },
    []
  );

  const wipeEverything = useCallback(() => {
    resetAllData();
    // Full reset also returns the product to its first-launch state:
    // welcome screen + setup wizard (explicit Settings action only).
    clearEntry();
    clearSetup();
    setData({ ...EMPTY, version: SCHEMA_VERSION });
  }, []);

  return {
    data,
    loaded,
    today: hookToday,
    completeOnboarding,
    setOnboarded,
    setDemoMode,
    createTrack,
    updateTrack,
    setTrackMembership,
    deleteTrack,
    setActiveTrack,
    setTrackStatus,
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
