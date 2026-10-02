/* ============================================================
   Platform layer — WHERE the product is running and HOW the
   user walked in. This sits ABOVE the tracker: no tracking
   logic, analytics or winterArc.* storage keys live here.

   Three ways in, one tracker:
     desktop  → standalone Electron shell (same React app)
     android  → Capacitor shell (same React app)
     web      → the browser build (the original app)
   ============================================================ */

import { Capacitor } from '@capacitor/core';

export type Platform = 'desktop' | 'android' | 'web';

/** Left-to-right order used by the welcome screen. */
export const PLATFORM_ORDER: Platform[] = ['desktop', 'android', 'web'];

/** Published installers (desktop builds, Android APKs) live here.
 *  Derived from this repo's git remote — not a guessed URL. */
export const RELEASES_URL = 'https://github.com/VISHNU2407-hub/tracker/releases';

/** Direct "latest release" download links for the published assets.
 *  GitHub resolves /releases/latest/download/<asset> to the newest
 *  release, so these keep pointing at the current installer/APK.
 *  Asset names match the files published on the releases page. */
export const DESKTOP_DOWNLOAD_URL =
  'https://github.com/VISHNU2407-hub/tracker/releases/latest/download/Life.System.Setup.1.0.0.exe';
export const ANDROID_DOWNLOAD_URL =
  'https://github.com/VISHNU2407-hub/tracker/releases/latest/download/app-debug.apk';

export interface PlatformSignals {
  /** Tauri shell (window.__TAURI__ / window.__TAURI_INTERNALS__). */
  tauri?: boolean;
  /** Electron shell — detected from the renderer user agent. */
  electron?: boolean;
  /** Capacitor native shell (isNativePlatform()). */
  nativePlatform?: boolean;
  /** Capacitor platform id: 'android' | 'ios' | 'web'. */
  capacitorPlatform?: string;
  userAgent?: string;
}

/** Pure, injectable platform resolution — unit-tested in scripts/smoke.ts. */
export function detectPlatform(s: PlatformSignals): Platform {
  if (s.tauri) return 'desktop';
  if (s.electron) return 'desktop';
  if (s.nativePlatform && s.capacitorPlatform === 'android') return 'android';
  return 'web';
}

/** Platform of the running shell. Safe in non-browser contexts (tests/SSR). */
export function currentPlatform(): Platform {
  try {
    const w = (typeof window !== 'undefined' ? window : {}) as {
      __TAURI__?: unknown;
      __TAURI_INTERNALS__?: unknown;
    };
    const tauri = Boolean(w.__TAURI__ || w.__TAURI_INTERNALS__);
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const electron = /\bElectron\//i.test(ua);

    let nativePlatform = false;
    let capacitorPlatform = 'web';
    if (typeof Capacitor !== 'undefined' && typeof Capacitor.isNativePlatform === 'function') {
      nativePlatform = Capacitor.isNativePlatform();
      capacitorPlatform = Capacitor.getPlatform();
    }

    return detectPlatform({ tauri, electron, nativePlatform, capacitorPlatform, userAgent: ua });
  } catch {
    return 'web';
  }
}

/** Human label for the running shell (shown on the welcome screen). */
export function platformLabel(p: Platform): string {
  return p === 'desktop' ? 'Desktop app' : p === 'android' ? 'Android app' : 'Web app';
}

/** Best-effort OS name for install instructions. */
export function describeOS(userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''): string {
  if (/Windows NT/i.test(userAgent)) return 'Windows';
  if (/Android/i.test(userAgent)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'iOS';
  if (/Mac OS X|Macintosh/i.test(userAgent)) return 'macOS';
  if (/Linux/i.test(userAgent)) return 'Linux';
  return 'this platform';
}

/* ------------------------------------------------------------
   Entry record — remembers that the welcome screen has been
   seen and which way the user came in. Independent from the
   winterArc.* tracking keys; clearing it only replays the intro.
   ------------------------------------------------------------ */

const ENTRY_KEY = 'lifeSystem.entry';

export interface EntryRecord {
  platform: Platform;
  at: string; // ISO timestamp
}

export function readEntry(): EntryRecord | null {
  try {
    const raw = localStorage.getItem(ENTRY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<EntryRecord>;
    if (!parsed || !PLATFORMS.includes(parsed.platform as Platform)) return null;
    return { platform: parsed.platform as Platform, at: typeof parsed.at === 'string' ? parsed.at : '' };
  } catch {
    return null;
  }
}

export function writeEntry(platform: Platform): EntryRecord {
  const record: EntryRecord = { platform, at: new Date().toISOString() };
  try {
    localStorage.setItem(ENTRY_KEY, JSON.stringify(record));
  } catch {
    /* storage unavailable — the app still works, intro will show again */
  }
  return record;
}

export function clearEntry(): void {
  try {
    localStorage.removeItem(ENTRY_KEY);
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------
   Setup record — the PERMANENT "first-run setup finished" flag.
   Written once when onboarding completes, read by the startup
   gate: without it the wizard would run on every launch (and the
   welcome screen would run again after a replay). Independent
   from lifeSystem.entry (replayable) and from winterArc.*
   (cleared by Reset All Data). Reset ONLY via Settings.
   ------------------------------------------------------------ */

const SETUP_KEY = 'lifeSystem.setup';

/** ISO timestamp of setup completion, or null when never completed. */
export function readSetup(): string | null {
  try {
    const raw = localStorage.getItem(SETUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: unknown };
    return parsed && typeof parsed.at === 'string' ? parsed.at : null;
  } catch {
    return null;
  }
}

export function writeSetup(at?: string): void {
  try {
    localStorage.setItem(SETUP_KEY, JSON.stringify({ at: at ?? new Date().toISOString() }));
  } catch {
    /* storage unavailable — onboarding will re-run next launch */
  }
}

export function clearSetup(): void {
  try {
    localStorage.removeItem(SETUP_KEY);
  } catch {
    /* ignore */
  }
}

const PLATFORMS: Platform[] = PLATFORM_ORDER;
