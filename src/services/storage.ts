/* ============================================================
   Storage service — ALL localStorage access lives here (spec §5).
   Handles missing/corrupt storage safely; validates imports.
   v2: adds Rule entities + per-day rule statuses. Legacy v1 data
   (rules stored as arc.rules text) migrates automatically and
   idempotently — existing rule texts are preserved verbatim.
   ============================================================ */

import type { AppData, Arc, Habit, Rule, DailyRecord, Reflection, Settings } from '../types';
import { isValidISO } from './date';

const KEYS = {
  settings: 'winterArc.settings',
  arc: 'winterArc.arc',
  habits: 'winterArc.habits',
  rules: 'winterArc.rules',
  dailyRecords: 'winterArc.dailyRecords',
  reflections: 'winterArc.reflections',
  version: 'winterArc.version',
} as const;

export const SCHEMA_VERSION = 2;

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

/* ---------- Rules: parse + legacy migration ----------
   Existing arc.rules strings stay intact; they become trackable
   Rule entities eligible from Arc Day 1 (user choice: backfill).
   Migration is idempotent: stored Rule entities win; deterministic
   ids derived from text mean re-runs never duplicate. */

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
    });
  }
  return Array.from(map.values()).sort((a, b) => a.order - b.order);
}

/** Turn arc.rules text into Rule entities (stable ids derived from the text). */
function migrateTextRules(texts: string[], existing: Rule[]): Rule[] {
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

/* ---------- Coerce unknown data into a valid AppData (load + import) ---------- */

export function normalizeAppData(input: unknown): AppData {
  const src = isRecord(input) ? input : {};

  const settings: Settings = {
    theme: 'dark',
    onboarded: src.settings && isRecord(src.settings) ? !!src.settings.onboarded : false,
    demoMode: src.settings && isRecord(src.settings) ? !!src.settings.demoMode : false,
  };

  // --- Arc ---
  let arc: Arc | null = null;
  if (isRecord(src.arc) && isValidISO(src.arc.startDate) && isValidISO(src.arc.endDate)) {
    const a = src.arc;
    const duration = typeof a.durationDays === 'number' && a.durationDays > 0 ? Math.floor(a.durationDays) : 90;
    arc = {
      id: str(a.id, 'arc_current'),
      title: str(a.title, 'Winter Arc'),
      startDate: a.startDate as string,
      endDate: a.endDate as string,
      durationDays: duration,
      goal: str(a.goal),
      why: str(a.why),
      rules: Array.isArray(a.rules) ? a.rules.filter((r): r is string => typeof r === 'string') : [],
      status: a.status === 'completed' || a.status === 'archived' ? a.status : 'active',
      createdAt: str(a.createdAt, new Date().toISOString()),
      updatedAt: str(a.updatedAt, new Date().toISOString()),
    };
  }

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
    });
  }

  // --- Rules: stored entities first, else migrate from arc.rules text ---
  const ruleArr = Array.isArray(src.rules) ? src.rules : [];
  let rules = parseRules(ruleArr);
  rules = migrateTextRules(arc?.rules ?? [], rules);
  if (arc && rules.length > 0) {
    // Keep arc.rules as the canonical text mirror (back-compat for exports).
    arc.rules = rules.map((r) => r.text);
  }

  // --- Daily records (now include per-day rule statuses) ---
  const dailyRecords: Record<string, DailyRecord> = {};
  if (isRecord(src.dailyRecords)) {
    for (const [date, rec] of Object.entries(src.dailyRecords)) {
      if (!isValidISO(date) || !isRecord(rec)) continue;
      const habits: Record<string, { value: number; completed: boolean }> = {};
      if (isRecord(rec.habits)) {
        for (const [hid, hr] of Object.entries(rec.habits)) {
          if (!isRecord(hr)) continue;
          const value = typeof hr.value === 'number' && isFinite(hr.value) ? hr.value : 0;
          habits[hid] = { value, completed: hr.completed === true || value > 0 };
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
        habits,
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

  return {
    settings,
    arc,
    habits: Array.from(habitMap.values()).sort((a, b) => a.order - b.order),
    rules,
    dailyRecords,
    reflections,
    version: SCHEMA_VERSION,
  };
}

/* ---------- Load / save ---------- */

export function loadAppData(): AppData {
  const version = readJSON<number>(KEYS.version) ?? SCHEMA_VERSION;
  const legacyShape: Record<string, unknown> = {
    settings: readJSON(KEYS.settings),
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

/* ---------- Export / import (spec §5: validate before replacing) ---------- */

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
  if (parsed.arc === null && (parsed.habits === undefined || (Array.isArray(parsed.habits) && parsed.habits.length === 0))) {
    return { ok: false, error: 'This backup is empty (no Arc and no habits).' };
  }
  const data = normalizeAppData(parsed);
  if (data.arc === null) {
    return { ok: false, error: 'Invalid backup: no valid Arc data found.' };
  }
  return { ok: true, data };
}
