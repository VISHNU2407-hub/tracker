/* ============================================================
   Setup passport — the cross-platform first-run handoff.

   Web (Chrome storage), desktop (Electron) and Android
   (Capacitor) each have their OWN localStorage origin, so a
   completed first-run setup cannot move between them by itself.
   The passport is a small JSON document exported by the WEB
   build and imported by INSTALLED builds on first launch:

     - Desktop: Electron main reads the newest
       lifesystem-setup*.json from the handoff folder (Downloads
       unless LIFESYSTEM_HANDOFF_DIR overrides it), injects it as
       window.__LIFESYSTEM_HANDOFF__ into index.html — the file is
       CONSUMED (renamed) so Reset All Data stays reset.
     - Android: the web "Get the apps" action copies a clipboard
       token (lifesystem-setup:<base64>); the native shell probes
       the clipboard once before rendering (handoff-native.ts).

   Import rules:
     - NEVER touches an install that already finished setup —
       switching platforms must never reset existing data.
     - Carries lifeSystem.entry + lifeSystem.setup + the full
       winterArc.* dataset; nothing else.
     - Reset All Data clears both flags, so a consumed handoff
       stays consumed and the next launch shows the welcome
       screen again (a replayed welcome does not resurrect it).

   Pure module: localStorage + DOM helpers only — no Capacitor
   imports (unit-tested in scripts/smoke.ts).
   ============================================================ */

import {
  currentPlatform,
  readEntry,
  readSetup,
  writeEntry,
  writeSetup,
  type Platform,
} from './platform';

export const PASSPORT_FORMAT = 'lifesystem-setup';
export const PASSPORT_VERSION = 1;
export const PASSPORT_FILENAME = 'lifesystem-setup.json';
export const PASSPORT_TOKEN_PREFIX = 'lifesystem-setup:';

const DATA_PREFIX = 'winterArc.';
const DATA_KEYS = ['settings', 'tracks', 'activeTrackId', 'arc', 'habits', 'rules', 'dailyRecords', 'reflections', 'version'] as const;
const VALID_PLATFORMS: Platform[] = ['desktop', 'android', 'web'];

/** Entry record + the permanent setup flag + the tracker dataset. */
export interface Passport {
  format: typeof PASSPORT_FORMAT;
  v: number;
  createdAt: string;
  entry: { platform: Platform; at: string } | null;
  setup: { at: string };
  data: Record<string, unknown>;
}

/** True once first-run setup has finished on THIS device — either the
 *  permanent flag exists, or the user predates the flag and has real
 *  data (legacy derivation, same rule as the App.tsx startup gate). */
export function isSetupComplete(): boolean {
  if (readSetup() !== null) return true;
  try {
    const rawSettings = localStorage.getItem(DATA_PREFIX + 'settings');
    const rawArc = localStorage.getItem(DATA_PREFIX + 'arc');
    if (!rawSettings || !rawArc) return false;
    const settings = JSON.parse(rawSettings) as { onboarded?: unknown };
    return settings.onboarded === true && JSON.parse(rawArc) !== null;
  } catch {
    return false;
  }
}

/** Snapshot the completed setup as a passport, or null before setup. */
export function buildPassport(): Passport | null {
  if (!isSetupComplete()) return null;
  const data: Record<string, unknown> = {};
  for (const key of DATA_KEYS) {
    try {
      const raw = localStorage.getItem(DATA_PREFIX + key);
      data[key] = raw === null ? null : JSON.parse(raw);
    } catch {
      return null; // corrupt key — better to export nothing than a broken passport
    }
  }
  if (!data.settings || typeof data.settings !== 'object') return null;
  if (!data.arc || typeof data.arc !== 'object') return null;
  const setupAt = readSetup();
  return {
    format: PASSPORT_FORMAT,
    v: PASSPORT_VERSION,
    createdAt: new Date().toISOString(),
    entry: readEntry(),
    setup: { at: setupAt ?? new Date().toISOString() },
    data,
  };
}

/** Validate unknown input (parsed object or JSON string) → Passport. */
export function parsePassport(input: unknown): Passport | null {
  let value = input;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object') return null;
  const p = value as Partial<Passport> & { data?: unknown };
  if (p.format !== PASSPORT_FORMAT || p.v !== PASSPORT_VERSION) return null;
  if (!p.setup || typeof p.setup.at !== 'string') return null;
  if (p.entry !== null && p.entry !== undefined) {
    if (typeof p.entry !== 'object' || !VALID_PLATFORMS.includes(p.entry.platform)) return null;
    if (typeof p.entry.at !== 'string') return null;
  }
  const d = p.data as Record<string, unknown> | undefined;
  if (!d || typeof d !== 'object') return null;
  if (!d.settings || typeof d.settings !== 'object') return null;
  if (!d.arc || typeof d.arc !== 'object') return null;
  return p as unknown as Passport;
}

/** Import a passport. NEVER overwrites an install that already finished
 *  setup — switching platforms must not reset existing data. Returns
 *  true when the passport was applied (caller should reload/route). */
export function applyPassport(input: unknown): boolean {
  const p = parsePassport(input);
  if (!p) return false;
  if (isSetupComplete()) return false;
  try {
    for (const key of DATA_KEYS) {
      const value = p.data[key];
      if (value !== undefined) localStorage.setItem(DATA_PREFIX + key, JSON.stringify(value));
    }
    writeEntry(p.entry && VALID_PLATFORMS.includes(p.entry.platform) ? p.entry.platform : currentPlatform());
    writeSetup(p.setup.at);
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------ */
/* Token (clipboard handoff — Android first launch)              */
/* ------------------------------------------------------------ */

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodePassportToken(p: Passport): string {
  return PASSPORT_TOKEN_PREFIX + toBase64(JSON.stringify(p));
}

export function decodePassportToken(text: unknown): Passport | null {
  if (typeof text !== 'string' || !text.startsWith(PASSPORT_TOKEN_PREFIX)) return null;
  try {
    return parsePassport(fromBase64(text.slice(PASSPORT_TOKEN_PREFIX.length)));
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------ */
/* Export actions (web — user gesture contexts)                  */
/* ------------------------------------------------------------ */

/** Download lifesystem-setup.json (picked up by the desktop shell's
 *  Downloads scan). Returns false when setup is not complete. */
export function downloadPassport(p: Passport): boolean {
  try {
    const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = PASSPORT_FILENAME;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch {
    return false;
  }
}

/** Copy the clipboard token (picked up by the Android shell's probe). */
export function copyPassportToken(p: Passport): boolean {
  try {
    void navigator.clipboard?.writeText(encodePassportToken(p));
    return true;
  } catch {
    return false;
  }
}

/** "Take my setup with me" — called from the Get the apps buttons
 *  (download file for desktop + clipboard token for Android). No-op
 *  before first-run setup completes. */
export function handoffToInstalledApp(): boolean {
  const p = buildPassport();
  if (!p) return false;
  downloadPassport(p);
  copyPassportToken(p);
  return true;
}

/* ------------------------------------------------------------ */
/* Inline handoff (Electron injects the passport before boot)    */
/* ------------------------------------------------------------ */

declare global {
  interface Window {
    __LIFESYSTEM_HANDOFF__?: unknown;
  }
}

/** Apply window.__LIFESYSTEM_HANDOFF__ (set by desktop/main.cjs) before
 *  React mounts, so the very first render already routes correctly.
 *  No-op without an injected passport or when setup is already done. */
export function consumeInlineHandoff(): boolean {
  try {
    const raw = typeof window === 'undefined' ? undefined : window.__LIFESYSTEM_HANDOFF__;
    if (raw === undefined) return false;
    window.__LIFESYSTEM_HANDOFF__ = undefined;
    return applyPassport(raw);
  } catch {
    return false;
  }
}
