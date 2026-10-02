# Life System

**Your Life. Your Progress. Your System.** A private, local-first, year-round tracker for habits, rules, daily progress, streaks and weekly reflection — plus **My Tracks**: user-created challenges (Winter Arc is just one example of a track) that live inside the continuous Life System.

One product, three ways in:

| Platform | What it is | Entry point |
| --- | --- | --- |
| **Web** | The same React app in any browser (original build) | `npm run dev` / Vercel |
| **Desktop** | Standalone Electron window (Windows, macOS, Linux) | `npm run desktop:dev` / `npm run desktop:build` |
| **Android** | Capacitor shell around the same build | `npm run android:build` |

The first-run **welcome screen** sits above the tracker: it shows the product, what it tracks, and the three install/continue choices. It remembers the choice in `lifeSystem.entry`. The setup wizard itself runs exactly once — `lifeSystem.setup` records completion, so welcome/onboarding only ever appear for genuinely new users (or after **Settings → Reset All Data**).

**Setup travels across platforms.** Each shell has its own storage origin, so a completed setup is exported as a **setup passport** (`lifesystem-setup.json` + a clipboard token) from **More → Get the apps**. The desktop shell imports the newest passport from the Downloads folder on first launch (file consumed once); the Android shell probes the clipboard for the token. Installed shells show a short initialization screen ("Preparing your system…") and then route straight to the correct screen — returning users land on the tracker, new users on the welcome screen. Import never overwrites an install that already finished setup, so switching platforms never resets data.

Built from `tracker.pdf` (master project specification) as the source of truth for the tracking behaviour.

## Run it (Web)

```bash
npm install
npm run dev      # development server
npm run build    # typecheck + production build → dist/
npm run preview  # serve the production build
npm test         # smoke tests: analytics, storage, render, layout invariants
```

### Deploy to Vercel

The app builds to a static site — deploy as-is:

```bash
npx vercel          # preview deployment
npx vercel --prod   # production
```

Or import the repo at vercel.com/new — the framework preset (Vite), build command (`npm run build`) and output directory (`dist`) are auto-detected, with `vercel.json` pinning them explicitly plus SPA rewrites and cache headers.

No environment variables required — all data stays in each visitor's browser (localStorage), so there are no secrets or server config.

## Install on Desktop (Electron)

```bash
npm install
npm run desktop:dev     # build + open the desktop window
npm run desktop:build   # build the installer into release/
```

- `desktop/main.cjs` serves `dist/` over the private `lifesystem://app` custom scheme in a sandboxed window (no Node access in the page). The FIXED origin keeps `localStorage` stable across launches — your data and setup state survive closing and reopening the app (a random-port loopback server would get a fresh origin, and therefore a blank app, every start).
- `electron-builder.yml` produces the NSIS installer (Windows), DMG/ZIP (macOS) and AppImage (Linux); icons come from `npm run icons`.
- Release binaries belong on the GitHub releases page — the welcome screen links there.

## Install on Android (Capacitor)

```bash
npm install
npm run icons           # regenerate launcher + splash icons (needs ffmpeg + Chrome)
npm run android:sync    # build web app and copy it into android/
npm run android:build   # sync + gradle assembleDebug (APK)
npm run android:open    # open the project in Android Studio
```

- `capacitor.config.ts` → `appId com.lifesystem.app`, `appName Life System`, `webDir dist`.
- Requirements: **JDK 17+** and **Android Studio** (or an Android SDK install) for the Gradle step — the web sync works without them.
- Launcher icons and splash screens are generated from `public/icons/icon-512.svg` by `scripts/build-icons.mjs`.

## What's inside

- **Welcome screen** — product intro, seven capability cards, and the three ways in (Desktop / Android / Web) with an honest install sheet instead of a dead download button.
- **Onboarding** — first-track setup (name, start date, duration preset or custom) → goal & why → personal rules → initial habits → Day 1.
- **Dashboard** — hero for the active track (Day X / duration, dates, progress), quick stats (current streak, best streak, perfect days, consistency), today's tasks with a circular progress indicator, and the full track map.
- **Today** — focused day view with prev/next navigation, jump-to-day, optional daily note. Only today is editable; other days are read-only history.
- **Calendar** — every challenge day grouped by month plus the full map; click any day for details (past days stay read-only).
- **Habits** — add, edit, archive, restore, reorder. Three habit types: checkbox, numeric target, duration target. Archived habits keep their history; permanent delete is guarded and explicit.
- **Stats** — overall completion, streaks, perfect days, 7/30/90-day trends with text summaries, weekly averages and per-habit rates + streaks. Everything derived from real records.
- **Reflection** — one weekly entry per ISO week: what went well, what to improve, next focus. Full history; only the current week is editable.
- **My Tracks** — create, edit, activate, complete and delete user-defined tracks (name, description, emoji, start date, duration, habits and rules included). Each track has its own progress; the active track's goal, why and daily rules are editable. Edits never erase history.
- **Settings** — export/import JSON backup with validation, and Reset All Data behind a typed confirmation (also returns the app to a true first launch).

## Architecture

```
src/
  app/          App shell, layout (sidebar, top bar, nav), intro/ (welcome), platform.ts, passport.ts (setup handoff), Initializing screen
  components/   layout, dashboard, habits, calendar, ui, icons
  pages/        Dashboard, Today, Calendar, Habits, Stats, Reflection, MyTracks, Settings, Onboarding
  services/     storage (all localStorage), analytics (pure functions), date, exportImport, demoData
  hooks/        useAppData (state + persistence), useArc (memoized analytics + routing)
desktop/        Electron main process (lifesystem:// static handler + window + passport handoff)
scripts/        smoke tests, render tests, responsive/first-run/install audits, icon factory
android/        Capacitor-generated Android project
```

- Persistence: `localStorage` under the versioned `winterArc.*` keys — `tracks` + `activeTrackId` are the canonical challenges, with `arc` kept as a live mirror of the active track (and for back-compat exports). Legacy single-`arc` data migrates automatically into a track named after its title (default "Winter Arc"). The platform layer uses its own keys: `lifeSystem.entry` (welcome screen) and `lifeSystem.setup` (permanent first-run flag — the setup wizard runs once, and only **Settings → Reset All Data** clears it). Cross-platform installs move both flags plus the dataset through the setup passport (`src/app/passport.ts`; Electron scans `LIFESYSTEM_HANDOFF_DIR` or `~/Downloads`, Android reads the clipboard token).
- All storage operations centralized in `src/services/storage.ts`; all metrics in `src/services/analytics.ts` as pure, testable functions.
- No backend, no accounts, no cloud sync (V1 scope per spec §14).

## Tech

React 18 + TypeScript + Vite for the app; Electron (desktop) and Capacitor (Android) wrap the same `dist/` build. Runtime dependencies stay small: React, `@capacitor/core`, `@capacitor/clipboard`. Tooling adds `electron`, `electron-builder`, `@capacitor/cli` and `@capacitor/android`.
