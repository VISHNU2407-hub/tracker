/* ============================================================
   Storage service — ALL localStorage access lives here.
   Handles missing/corrupt storage safely; validates imports.

   v3: the fixed Winter Arc becomes user-created Tracks.
     - `tracks` + `activeTrackId` are the canonical challenge data.
     - `arc` stays as a mirror of the active track (and is exported
       for back-compat).
     - legacy v1/v2 data (a single `arc`) migrates into a track named
       after its title (default "Winter Arc") with all habits, rules,
       records, streaks and reflections preserved.
   ============================================================ */

import type { AppData, Arc, Habit, Rule, Track, DailyRecord, Reflection, Settings } from '../types';
import { addDays, isValidISO } from './date';

const KEYS = {
  settings: 'winterArc.settings',
  tracks: 'winterArc.tracks',
  activeTrackId: 'winterArc.activeTrackId',
  arc: 'winterArc.arc',
  habits: 'winterArc.habits',
  rules: 'winterArc.rules',
  dailyRecords: 'winterArc.dailyRecords',
  reflections: 'winterArc.reflections',
  version: 'winterArc.version',
} as const;

export const SCHEMA_VERSION = 3;

/* ---------- Safe JSON primitives ---------- */

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    // Corrupt JSON → treat as missing; clear so we don't loop on it.
    try { localStorage.removeItem(key); } catch { /* storage unavailable */ }
    return null;
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota/privacy-mode errors: fail silently, app still works in-memory.
  }
}

/* ---------- Validation helpers ---------- */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** Tracks list from stored value; undefined means "belongs to all" (legacy). */
function trackIdsOf(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.filter((x): x is string => typeof x === 'string' && x.length > 0);
}

/* ---------- Rules: parse + legacy migration ----------
   Existing arc.rules strings stay intact; they become trackable
   Rule entities eligible from Day 1. Migration is idempotent:
   stored Rule entities win; deterministic ids derived from text
   mean re-runs never duplicate. */

function parseRules(arr: unknown[]): Rule[] {
  const map = new Map<string, Rule>();
  for (const r of arr) {
    if (!isRecord(r) || typeof r.id !== 'string' || !r.id) continue;
    const text = str(r.text).trim();
    if (!text) continue;
    if (map.has(r.id)) continue; // dedupe by id, keep first
    map.set(r.id, {
      id: r.id,
      text,
      active: r.active !== false,
      fromDay: typeof r.fromDay === 'number' && r.fromDay >= 1 ? Math.floor(r.fromDay) : 1,
      createdAt: str(r.createdAt, new Date().toISOString()),
      order: typeof r.order === 'number' ? r.order : map.size,
      trackIds: trackIdsOf(r.trackIds),
    });
  }
  return Array.from(map.values()).sort((a, b) => a.order - b.order);
}

/** Turn rule text into Rule entities (stable ids derived from the text). */
function migrateTextRules(texts: string[], existing: Rule[], trackIds?: string[]): Rule[] {
  if (existing.length > 0) return existing; // entities already exist — nothing to migrate
  const out: Rule[] = [];
  for (let i = 0; i < texts.length; i++) {
    const text = texts[i].trim();
    if (!text) continue;
    out.push({
      // Deterministic id from the text so re-running never duplicates.
      id: `rule_m${hash(text)}`,
      text,
      active: true,
      fromDay: 1,
      createdAt: new Date().toISOString(),
      order: i + 1,
      trackIds,
    });
  }
  return out;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

/* ---------- Track parsing ---------- */

function parseTrack(v: unknown, fallbackId: string): Track | null {
  if (!isRecord(v) || !isValidISO(v.startDate)) return null;
  const startDate = v.startDate as string;
  const duration =
    typeof v.durationDays === 'number' && v.durationDays > 0 ? Math.floor(v.durationDays) : 90;
  const endDate = isValidISO(v.endDate) ? (v.endDate as string) : addDays(startDate, duration - 1);
  const status = v.status === 'completed' || v.status === 'archived' ? v.status : 'active';
  return {
    id: str(v.id, fallbackId) || fallbackId,
    title: str(v.title, 'My Track').trim() || 'My Track',
    description: str(v.description),
    icon: str(v.icon),
    startDate,
    endDate,
    durationDays: duration,
    goal: str(v.goal),
    why: str(v.why),
    rules: strArray(v.rules),
    status,
    createdAt: str(v.createdAt, new Date().toISOString()),
    updatedAt: str(v.updatedAt, new Date().toISOString()),
  };
}

/** Build a track from a legacy single `arc` object. */
function trackFromArc(arc: Arc): Track {
  return {
    id: arc.id || 'track_current',
    title: arc.title || 'Winter Arc',
    description: '',
    icon: '',
    startDate: arc.startDate,
    endDate: arc.endDate,
    durationDays: arc.durationDays,
    goal: arc.goal,
    why: arc.why,
    rules: Array.isArray(arc.rules) ? arc.rules : [],
    status: arc.status,
    createdAt: arc.createdAt,
    updatedAt: arc.updatedAt,
  };
}

function scopeLegacyTrackIds<T extends { trackIds?: string[] }>(items: T[], trackId: string | null): T[] {
  if (!trackId) return items;
  // Legacy items with no membership belong to the (single) migrated track.
  return items.map((item) => (item.trackIds === undefined ? { ...item, trackIds: [trackId] } : item));
}

/* ---------- Coerce unknown data into a valid AppData (load + import) ---------- */

export function normalizeAppData(input: unknown): AppData {
  const src = isRecord(input) ? input : {};

  const settings: Settings = {
    theme: 'dark',
    onboarded: src.settings && isRecord(src.settings) ? !!src.settings.onboarded : false,
    demoMode: src.settings && isRecord(src.settings) ? !!src.settings.demoMode : false,
  };

  // --- Legacy single arc (used as a fallback / migration source) ---
  let legacyArc: Arc | null = null;
  if (isRecord(src.arc) && isValidISO(src.arc.startDate) && isValidISO(src.arc.endDate)) {
    legacyArc = parseTrack(src.arc, 'track_current') as Arc;
  }

  // --- Tracks: canonical, else migrate the legacy arc into one ---
  const trackArr = Array.isArray(src.tracks) ? src.tracks : [];
  const trackMap = new Map<string, Track>();
  for (const t of trackArr) {
    const parsed = parseTrack(t, `track_${trackMap.size + 1}`);
    if (!parsed) continue;
    trackMap.set(parsed.id, parsed); // dedupe by id, last wins
  }
  if (trackMap.size === 0 && legacyArc) {
    const migrated = trackFromArc(legacyArc);
    trackMap.set(migrated.id, migrated);
  }
  let tracks = Array.from(trackMap.values());

  // Active track: stored id when valid, else the first active track, else first.
  let activeTrackId = str(src.activeTrackId) || null;
  if (!activeTrackId || !tracks.some((t) => t.id === activeTrackId)) {
    activeTrackId = tracks.find((t) => t.status === 'active')?.id ?? tracks[0]?.id ?? null;
  }
  const primaryTrack = tracks.find((t) => t.id === activeTrackId) ?? null;

  // --- Habits (dedupe by id, keep last) ---
  const habitArr = Array.isArray(src.habits) ? src.habits : [];
  const habitMap = new Map<string, Habit>();
  const validTypes = ['checkbox', 'numeric', 'duration'];
  for (const h of habitArr) {
    if (!isRecord(h) || typeof h.id !== 'string' || !h.id) continue;
    const type = validTypes.includes(str(h.type)) ? (h.type as Habit['type']) : 'checkbox';
    const targetRaw = typeof h.target === 'number' && h.target > 0 ? h.target : 1;
    habitMap.set(h.id, {
      id: h.id,
      name: str(h.name, 'Habit'),
      icon: str(h.icon, 'target'),
      type,
      target: type === 'checkbox' ? 1 : targetRaw,
      unit: str(h.unit, type === 'duration' ? 'min' : '×'),
      active: h.active !== false,
      createdAt: str(h.createdAt, new Date().toISOString()),
      order: typeof h.order === 'number' ? h.order : habitMap.size,
      trackIds: trackIdsOf(h.trackIds),
    });
  }
  let habits = scopeLegacyTrackIds(Array.from(habitMap.values()), activeTrackId);

  // --- Rules: stored entities first, else migrate from track/arc rules text ---
  const ruleArr = Array.isArray(src.rules) ? src.rules : [];
  let rules = parseRules(ruleArr);
  const ruleTexts = primaryTrack?.rules?.length ? primaryTrack.rules : (legacyArc?.rules ?? []);
  rules = migrateTextRules(ruleTexts, rules, activeTrackId ? [activeTrackId] : undefined);
  rules = scopeLegacyTrackIds(rules, activeTrackId);

  // Keep each track's rules text mirror in sync for back-compat exports.
  if (tracks.length > 0) {
    tracks = tracks.map((t) => {
      const texts = rules
        .filter((r) => r.active && belongsToTrack(r.trackIds, t.id))
        .map((r) => r.text);
      return { ...t, rules: texts };
    });
  }

  // --- Daily records (per-day rule statuses preserved verbatim) ---
  const dailyRecords: Record<string, DailyRecord> = {};
  if (isRecord(src.dailyRecords)) {
    for (const [date, rec] of Object.entries(src.dailyRecords)) {
      if (!isValidISO(date) || !isRecord(rec)) continue;
      const dayHabits: Record<string, { value: number; completed: boolean }> = {};
      if (isRecord(rec.habits)) {
        for (const [hid, hr] of Object.entries(rec.habits)) {
          if (!isRecord(hr)) continue;
          const value = typeof hr.value === 'number' && isFinite(hr.value) ? hr.value : 0;
          dayHabits[hid] = { value, completed: hr.completed === true || value > 0 };
        }
      }
      const ruleRecs: Record<string, { status: 'followed' | 'not_followed' }> = {};
      if (isRecord(rec.rules)) {
        for (const [rid, rr] of Object.entries(rec.rules)) {
          if (!isRecord(rr)) continue;
          const status = rr.status === 'not_followed' ? 'not_followed' : 'followed';
          ruleRecs[rid] = { status };
        }
      }
      dailyRecords[date] = {
        date,
        habits: dayHabits,
        rules: ruleRecs,
        note: str(rec.note),
        updatedAt: str(rec.updatedAt, new Date().toISOString()),
      };
    }
  }

  // --- Reflections ---
  const reflections: Record<string, Reflection> = {};
  if (isRecord(src.reflections)) {
    for (const [weekKey, r] of Object.entries(src.reflections)) {
      if (!isRecord(r) || typeof r.weekStart !== 'string') continue;
      reflections[weekKey] = {
        id: str(r.id, `refl_${weekKey}`),
        weekKey,
        weekStart: r.weekStart,
        wentWell: str(r.wentWell),
        toImprove: str(r.toImprove),
        nextFocus: str(r.nextFocus),
        createdAt: str(r.createdAt, new Date().toISOString()),
        updatedAt: str(r.updatedAt, new Date().toISOString()),
      };
    }
  }

  // Mirror the (post-migration) active track so pages can read `arc`.
  const activeTrack = tracks.find((t) => t.id === activeTrackId) ?? null;

  return {
    settings,
    tracks,
    activeTrackId,
    arc: activeTrack,
    habits,
    rules,
    dailyRecords,
    reflections,
    version: SCHEMA_VERSION,
  };
}

/** Membership rule shared by every layer: undefined = every track. */
export function belongsToTrack(trackIds: string[] | undefined, trackId: string): boolean {
  return trackIds === undefined || trackIds.includes(trackId);
}

/* ---------- Load / save ---------- */

export function loadAppData(): AppData {
  const version = readJSON<number>(KEYS.version) ?? SCHEMA_VERSION;
  const legacyShape: Record<string, unknown> = {
    settings: readJSON(KEYS.settings),
    tracks: readJSON(KEYS.tracks),
    activeTrackId: readJSON(KEYS.activeTrackId),
    arc: readJSON(KEYS.arc),
    habits: readJSON(KEYS.habits),
    rules: readJSON(KEYS.rules),
    dailyRecords: readJSON(KEYS.dailyRecords),
    reflections: readJSON(KEYS.reflections),
    version,
  };
  const data = normalizeAppData(legacyShape);
  saveAppData(data); // persist normalized form (migrations + repairs)
  return data;
}

export function saveAppData(data: AppData): void {
  writeJSON(KEYS.settings, data.settings);
  writeJSON(KEYS.tracks, data.tracks);
  writeJSON(KEYS.activeTrackId, data.activeTrackId);
  writeJSON(KEYS.arc, data.arc);
  writeJSON(KEYS.habits, data.habits);
  writeJSON(KEYS.rules, data.rules);
  writeJSON(KEYS.dailyRecords, data.dailyRecords);
  writeJSON(KEYS.reflections, data.reflections);
  writeJSON(KEYS.version, SCHEMA_VERSION);
}

export function resetAllData(): void {
  for (const key of Object.values(KEYS)) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }
}

/* ---------- Export / import (validate before replacing) ---------- */

export interface ImportResult {
  ok: boolean;
  error?: string;
  data?: AppData;
}

export function exportState(data: AppData): string {
  return JSON.stringify({ ...data, exportedAt: new Date().toISOString() }, null, 2);
}

export function importState(jsonText: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, error: 'Invalid JSON — the file could not be parsed.' };
  }
  if (!isRecord(parsed)) {
    return { ok: false, error: 'Invalid backup: expected a JSON object.' };
  }
  const hasTracks = Array.isArray(parsed.tracks) && parsed.tracks.length > 0;
  if (!hasTracks && parsed.arc === null && (parsed.habits === undefined || (Array.isArray(parsed.habits) && parsed.habits.length === 0))) {
    return { ok: false, error: 'This backup is empty (no track and no habits).' };
  }
  const data = normalizeAppData(parsed);
  if (data.arc === null) {
    return { ok: false, error: 'Invalid backup: no valid track data found.' };
  }
  return { ok: true, data };
}
