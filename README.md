# Winter Arc Tracker

A local-first, 90-day self-improvement dashboard. Define your Winter Arc, choose daily habits, check in every day, and watch honest streaks, perfect days and analytics accumulate.

Built from `tracker.pdf` (master project specification) as the source of truth.

## Run it

```bash
npm install
npm run dev      # development server
npm run build    # typecheck + production build
npm run preview  # serve the production build
npm test         # smoke tests for date/analytics/storage services
```

## What's inside

- **Onboarding** — welcome → arc setup (start date, 90-day default) → goal & why → personal rules → initial habits → Day 1.
- **Dashboard** — hero (Day X / 90, dates, progress), quick stats (current streak, best streak, perfect days, consistency), today's tasks with a circular progress indicator, and the full 90-day map.
- **Today** — focused day view with prev/next navigation, jump-to-day, optional daily note. Future days are locked.
- **Calendar** — every arc day grouped by month plus a full 90-day map; click any day for details and edit past days.
- **Habits** — add, edit, archive, restore, reorder. Three habit types: checkbox, numeric target, duration target. Archived habits keep their history; permanent delete is guarded and explicit.
- **Stats** — overall completion, streaks, perfect days, 7/30/90-day trends with text summaries, weekly averages and per-habit rates + streaks. Everything derived from real records.
- **Reflection** — one weekly entry per ISO week: what went well, what to improve, next focus. Full history.
- **My Winter Arc** — edit goal, why, rules, start date and duration. Edits never erase history; risky date changes require confirmation.
- **Settings** — export/import JSON backup with validation, optional demo mode, and Reset All Data behind a typed confirmation.

## Architecture

```
src/
  components/   layout, dashboard, habits, calendar, ui
  pages/        Dashboard, Today, Calendar, Habits, Stats, Reflection, MyArc, Settings, Onboarding
  services/     storage (all localStorage), analytics (pure functions), date, exportImport, demoData
  hooks/        useAppData (state + persistence), useArc (memoized analytics + routing)
```

- Persistence: `localStorage` under the `winterArc.*` keys defined in the spec; schema versioned.
- All storage operations centralized in `src/services/storage.ts`; all metrics in `src/services/analytics.ts` as pure, testable functions.
- No backend, no accounts, no cloud sync (V1 scope per spec §14).

## Tech

React 18 + TypeScript + Vite. Zero runtime dependencies beyond React.
