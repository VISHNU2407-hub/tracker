/* ============================================================
   Life System — Data models.

   The system is year-round personal growth tracking. A "Track"
   is a user-created challenge/arc (e.g. Winter Arc, Fitness
   Journey) inside the continuous Life System. There is no fixed
   built-in challenge — tracks are entirely user-defined.

   Habits = things you DO. Rules = things you CONTROL / FOLLOW.
   Both can belong to one or more tracks.
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
  /** Tracks this habit belongs to. undefined = every track (legacy),
   *  [] = no track, non-empty = exactly those tracks. */
  trackIds?: string[];
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
  /** Rule begins counting on this track day (1-based). Migrated legacy
   *  rules use 1 so they are trackable from Day 1. */
  fromDay: number;
  createdAt: string;
  order: number;
  /** Tracks this rule belongs to. undefined = every track (legacy),
   *  [] = no track, non-empty = exactly those tracks. */
  trackIds?: string[];
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

export type TrackStatus = 'active' | 'completed' | 'archived';

/* ---------- Track: a user-created challenge inside the Life System ---------- */
export interface Track {
  id: string;
  /** User-defined name (e.g. "Winter Arc", "Fitness Journey"). */
  title: string;
  /** Description / purpose, free text. */
  description: string;
  /** Optional emoji or icon key. Empty string when unset. */
  icon: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD (inclusive)
  durationDays: number;
  goal: string;
  why: string;
  /** Text mirror of the track's active rules (back-compat for exports). */
  rules: string[];
  status: TrackStatus;
  createdAt: string;
  updatedAt: string;
}

/* Back-compat aliases: a track IS the challenge/arc used by analytics. */
export type ArcStatus = TrackStatus;
export type Arc = Track;

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
  /** Every user-created track. The Life System itself never ends. */
  tracks: Track[];
  /** Which track the dashboard / analytics currently reflect. */
  activeTrackId: string | null;
  /** Mirror of the active track, kept in sync by the data layer. */
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
