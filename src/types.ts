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

export interface DailyRecord {
  date: string; // YYYY-MM-DD
  habits: Record<string, HabitRecord>;
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
  dailyRecords: Record<string, DailyRecord>;
  reflections: Record<string, Reflection>; // keyed by weekKey
  version: number;
}

/* ---------- Day state model (calendar / grid) ---------- */

export type DayState = 'future' | 'empty' | 'partial' | 'complete' | 'today' | 'before-start';
