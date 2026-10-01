/* ============================================================
   Winter Arc Tracker — Data models (per spec section 4 & 5)
   ============================================================ */

export type HabitType = 'checkbox' | 'numeric' | 'duration';

export interface Habit {
  id: string;
  name: string;
  icon: string; // icon key from the icon registry
  type: HabitType;
  /** Target count for numeric, minutes for duration, 1 for checkbox */
  target: number;
  unit: string;
  active: boolean;
  createdAt: string;
  order: number;
}

export interface HabitRecord {
  value: number;
  completed: boolean;
}

/* ---------- Rules: things to FOLLOW / AVOID / CONTROL ----------
   Rules are the self-control counterpart to habits:
   habits measure what you DID, rules measure what you CONTROLLED.
   Every rule is a daily trackable item with a stored status. */

export interface Rule {
  id: string;
  text: string;
  active: boolean;
  /** Rule begins counting on this Arc day (1-based). Migrated legacy
   *  rules use 1 so they are trackable from Arc Day 1. */
  fromDay: number;
  createdAt: string;
  order: number;
}

export type RuleStatus = 'followed' | 'not_followed';

export interface RuleRecord {
  /** followed = the rule was kept that day, not_followed = broken */
  status: RuleStatus;
}

export interface DailyRecord {
  date: string; // YYYY-MM-DD
  habits: Record<string, HabitRecord>;
  rules: Record<string, RuleRecord>;
  note: string;
  updatedAt: string;
}

export type ArcStatus = 'active' | 'completed' | 'archived';

export interface Arc {
  id: string;
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD (inclusive)
  durationDays: number;
  goal: string;
  why: string;
  rules: string[];
  status: ArcStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Reflection {
  id: string;
  /** ISO week key, e.g. "2026-W40" */
  weekKey: string;
  /** Monday of that week, YYYY-MM-DD */
  weekStart: string;
  wentWell: string;
  toImprove: string;
  nextFocus: string;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  theme: 'dark';
  onboarded: boolean;
  demoMode: boolean;
}

export interface AppData {
  settings: Settings;
  arc: Arc | null;
  habits: Habit[];
  /** Trackable rule entities (daily check-in items) */
  rules: Rule[];
  dailyRecords: Record<string, DailyRecord>;
  reflections: Record<string, Reflection>; // keyed by weekKey
  version: number;
}

/* ---------- Day state model (calendar / grid) ---------- */

export type DayState = 'future' | 'empty' | 'partial' | 'complete' | 'today' | 'before-start';
