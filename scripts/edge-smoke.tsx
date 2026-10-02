/* Edge-case crash harness - server-renders EVERY page against hostile data
 * shapes to catch runtime errors (null derefs, divide-by-zero, empty lists)
 * that a normal smoke test with demo data will never hit.
 * Bundled with esbuild, run via `npm run test:edge`.
 */
import React from 'react';
import { renderToString } from 'react-dom/server';
import { DashboardPage } from '../src/pages/Dashboard';
import { TodayPage } from '../src/pages/Today';
import { CalendarPage } from '../src/pages/Calendar';
import { HabitsPage } from '../src/pages/Habits';
import { StatsPage } from '../src/pages/Stats';
import { ReflectionPage } from '../src/pages/Reflection';
import { MyTracksPage } from '../src/pages/MyTracks';
import { SettingsPage } from '../src/pages/Settings';
import { buildDemoData } from '../src/services/demoData';
import { addDays, todayISO } from '../src/services/date';
import type { AppData, Arc, Habit } from '../src/types';
import type { AppDataApi } from '../src/hooks/useAppData';
import type { PageId } from '../src/hooks/useArc';

let failures = 0;
const noop = () => undefined;
const noopNav = (_p: PageId) => undefined;

function run(label: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok   ${label}`);
  } catch (err) {
    failures++;
    console.error(`  FAIL ${label}`);
    console.error(`       ${(err as Error).message}`);
  }
}

const today = todayISO();

function arcOf(patch: Partial<Arc> = {}): Arc {
  const startDate = patch.startDate ?? addDays(today, -10);
  const durationDays = patch.durationDays ?? 90;
  return {
    id: 'arc_test',
    title: 'Test Arc',
    startDate,
    endDate: addDays(startDate, durationDays - 1),
    durationDays,
    goal: 'Ship it',
    why: 'Because',
    rules: [],
    status: 'active',
    createdAt: today,
    updatedAt: today,
    ...patch,
  };
}

function habitOf(patch: Partial<Habit> = {}): Habit {
  return {
    id: 'habit_test',
    name: 'Test habit',
    icon: 'spark',
    type: 'checkbox',
    target: 1,
    unit: '',
    active: true,
    createdAt: today,
    order: 0,
    ...patch,
  };
}

function blank(patch: Partial<AppData> = {}): AppData {
  const base = {
    settings: { theme: 'dark', onboarded: true, demoMode: false },
    arc: arcOf(),
    habits: [],
    rules: [],
    dailyRecords: {},
    reflections: {},
    version: 3,
    ...patch,
  } as AppData;
  // Keep the canonical tracks/activeTrackId consistent with the arc mirror
  // used by these fixtures.
  const tracks = base.arc ? [base.arc] : [];
  return { ...base, tracks, activeTrackId: base.arc?.id ?? null };
}

function apiOf(data: AppData): AppDataApi {
  return { data, loaded: true, today } as unknown as AppDataApi;
}

/* ---------- fixtures ---------- */

const fixtures: { name: string; data: AppData }[] = [
  { name: 'arc only, no habits/rules/records', data: blank() },
  {
    name: 'habits but zero rules',
    data: blank({
      habits: [
        habitOf({ id: 'h1', order: 0 }),
        habitOf({ id: 'h2', order: 1, type: 'numeric', target: 8, unit: 'pages' }),
        habitOf({ id: 'h3', order: 2, type: 'duration', target: 30, unit: 'min' }),
      ],
    }),
  },
  {
    name: 'rules but zero habits',
    data: blank({
      rules: [
        { id: 'r1', text: 'No phone in bed', active: true, fromDay: 1, createdAt: today, order: 0 },
      ],
    }),
  },
  {
    name: 'single-day arc (duration 1)',
    data: blank({
      arc: arcOf({ startDate: today, durationDays: 1 }),
      habits: [habitOf()],
    }),
  },
  {
    name: 'arc entirely in the future',
    data: blank({
      arc: arcOf({ startDate: addDays(today, 30), durationDays: 60 }),
      habits: [habitOf()],
      rules: [{ id: 'r1', text: 'Sleep by 11', active: true, fromDay: 1, createdAt: today, order: 0 }],
    }),
  },
  {
    name: 'zero-target numeric habit (divide by zero risk)',
    data: blank({
      habits: [
        habitOf({ id: 'h0', type: 'numeric', target: 0, unit: 'reps' }),
      ],
      dailyRecords: {
        [today]: { date: today, habits: { h0: { value: 3, completed: false } }, rules: {}, note: '', updatedAt: today },
      },
    }),
  },
  {
    name: 'empty-string goal / why / note',
    data: blank({
      arc: arcOf({ goal: '', why: '' }),
      habits: [habitOf()],
      dailyRecords: {
        [today]: { date: today, habits: {}, rules: {}, note: '', updatedAt: today },
      },
    }),
  },
  {
    name: 'all habits archived',
    data: blank({
      habits: [habitOf({ active: false })],
      rules: [{ id: 'r1', text: 'Archived rule', active: false, fromDay: 1, createdAt: today, order: 0 }],
    }),
  },
  {
    name: 'records with dangling habit/rule ids',
    data: blank({
      habits: [habitOf({ id: 'h1' })],
      rules: [{ id: 'r1', text: 'Rule', active: true, fromDay: 1, createdAt: today, order: 0 }],
      dailyRecords: {
        [addDays(today, -3)]: {
          date: addDays(today, -3),
          habits: { h_deleted: { value: 1, completed: true }, h1: { value: 1, completed: true } },
          rules: { r_deleted: { status: 'followed' }, r1: { status: 'not_followed' } },
          note: 'from the past',
          updatedAt: today,
        },
      },
    }),
  },
  {
    name: 'reflections present',
    data: blank({
      reflections: {
        '2026-W40': {
          id: 'refl_1',
          weekKey: '2026-W40',
          weekStart: addDays(today, -14),
          wentWell: 'Worked',
          toImprove: 'Sleep',
          nextFocus: 'Wind down earlier',
          createdAt: today,
          updatedAt: today,
        },
      },
    }),
  },
  { name: 'full demo dataset', data: buildDemoData(blank({ arc: null })) },
];

/* ---------- run every page against every fixture ---------- */

const pages: { name: string; render: (api: AppDataApi) => string }[] = [
  { name: 'Dashboard', render: (api) => renderToString(<DashboardPage api={api} onNavigate={noopNav} />) },
  { name: 'Today', render: (api) => renderToString(<TodayPage api={api} onNavigate={noopNav} />) },
  { name: 'Calendar', render: (api) => renderToString(<CalendarPage api={api} />) },
  { name: 'Habits', render: (api) => renderToString(<HabitsPage api={api} />) },
  { name: 'Stats', render: (api) => renderToString(<StatsPage api={api} />) },
  { name: 'Reflection', render: (api) => renderToString(<ReflectionPage api={api} />) },
  { name: 'MyTracks', render: (api) => renderToString(<MyTracksPage api={api} />) },
  { name: 'Settings', render: (api) => renderToString(<SettingsPage api={api} />) },
];

console.log('- edge-case render matrix -');
for (const fx of fixtures) {
  for (const page of pages) {
    run(`${page.name} <- ${fx.name}`, () => {
      const html = page.render(apiOf(fx.data));
      if (typeof html !== 'string' || html.length === 0) {
        throw new Error('rendered empty output');
      }
    });
  }
}

/* ---------- specific invariants ---------- */

console.log('- edge-case invariants -');

run('no-habit day renders 0/0 without NaN', () => {
  const html = renderToString(<TodayPage api={apiOf(blank())} onNavigate={noopNav} />);
  if (/NaN|undefined%|Infinity/.test(html)) {
    throw new Error('numeric placeholder leaked into markup: ' + html.match(/.{0,40}(NaN|Infinity|undefined%).{0,40}/)?.[0]);
  }
});

run('day strip renders one cell per Arc day', () => {
  const data = blank({ arc: arcOf({ durationDays: 30 }) });
  const html = renderToString(<TodayPage api={apiOf(data)} onNavigate={noopNav} />);
  const cells = html.match(/daystrip-cell/g) ?? [];
  if (cells.length < 30) throw new Error(`expected 30 strip cells, found ${cells.length}`);
});

run('day strip does not overflow to 0% width when nothing tracked', () => {
  const html = renderToString(<TodayPage api={apiOf(blank())} onNavigate={noopNav} />);
  if (/width:\s*NaN%/.test(html)) throw new Error('NaN width in split bar');
});

run('zero-target habit shows no percentage chip', () => {
  const data = blank({ habits: [habitOf({ id: 'h0', type: 'numeric', target: 0, unit: 'reps' })] });
  const html = renderToString(<TodayPage api={apiOf(data)} onNavigate={noopNav} />);
  if (/NaN%/.test(html)) throw new Error('NaN percent for zero-target habit');
});

run('Dashboard keeps habits and rules labelled separately', () => {
  const data = blank({
    habits: [habitOf({ id: 'h1' })],
    rules: [{ id: 'r1', text: 'No snooze', active: true, fromDay: 1, createdAt: today, order: 0 }],
  });
  const html = renderToString(<DashboardPage api={apiOf(data)} onNavigate={noopNav} />);
  if (!html.includes('Habits')) throw new Error('missing Habits section');
  if (!html.includes('Rules')) throw new Error('missing Rules section');
  if (!html.includes('rule-status-btn')) throw new Error('rules lost their status controls');
});

run('Stats marks rules as a distinct (violet) section', () => {
  const data = blank({
    rules: [{ id: 'r1', text: 'No snooze', active: true, fromDay: 1, createdAt: today, order: 0 }],
  });
  const html = renderToString(<StatsPage api={apiOf(data)} />);
  if (!html.includes('card-rules')) throw new Error('rule section lost its distinct styling hook');
});

run('My Tracks with zero tracks shows the empty state (never re-onboards)', () => {
  const data = blank({ arc: null });
  if (data.tracks.length !== 0 || data.arc !== null) throw new Error('fixture should have no tracks');
  const html = renderToString(<MyTracksPage api={apiOf(data)} />);
  if (!html.includes('No tracks yet') || !html.includes('Create Track')) {
    throw new Error('missing zero-track empty state / Create Track action');
  }
});

run('no page leaks the string "undefined"', () => {
  for (const fx of fixtures) {
    for (const page of pages) {
      const html = page.render(apiOf(fx.data));
      if (/>undefined</.test(html) || /undefined\s*%/.test(html)) {
        throw new Error(`${page.name} <- ${fx.name} printed "undefined"`);
      }
    }
  }
});

run('future Arc counts down to its start, not to day 90', () => {
  const data = blank({ arc: arcOf({ startDate: addDays(today, 12), durationDays: 90 }) });
  const html = renderToString(<DashboardPage api={apiOf(data)} onNavigate={noopNav} />);
  if (!/Starts in 12 day/.test(html)) {
    throw new Error('expected "Starts in 12 days", got: ' + html.match(/.{0,60}days? (to go|left|Starts).{0,40}/)?.[0]);
  }
  if (/Starts in 1 day\b/.test(html)) throw new Error('off-by-one in the start countdown');
});

run('in-progress Arc reports the correct days left', () => {
  const data = blank({ arc: arcOf({ startDate: addDays(today, -29), durationDays: 90 }) });
  const html = renderToString(<DashboardPage api={apiOf(data)} onNavigate={noopNav} />);
  // startDate 29 days ago => day 30 => 90 - 30 = 60 days left.
  if (!/60 days to go/.test(html)) {
    throw new Error('expected "60 days to go" on day 30 of 90: ' + html.match(/.{0,60}days? (to go|left).{0,20}/)?.[0]);
  }
});

run('no SVG gradient is referenced with a colon-bearing id', () => {
  for (const fx of fixtures) {
    for (const page of pages) {
      const html = page.render(apiOf(fx.data));
      if (/url\(#[^)]*:/.test(html)) {
        throw new Error(`${page.name} <- ${fx.name} referenced an un-sanitised useId in an SVG url()`);
      }
    }
  }
});

void noop;

console.log(failures === 0 ? '\nEDGE: ALL PASS' : `\n${failures} EDGE FAILURE(S)`);
if (failures > 0) process.exit(1);