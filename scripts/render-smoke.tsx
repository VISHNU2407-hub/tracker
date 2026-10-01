/* Render smoke test — server-renders the pages/components touched by the
   feature work to catch runtime errors (import cycles, null derefs, bad JSX)
   without needing a browser. Bundled with esbuild, run via `npm test`. */
import React from 'react';
import { renderToString } from 'react-dom/server';
import { DashboardPage } from '../src/pages/Dashboard';
import { CalendarPage } from '../src/pages/Calendar';
import { HabitsPage } from '../src/pages/Habits';
import { HabitGrid } from '../src/components/calendar/HabitGrid';
import { HabitInsights } from '../src/components/habits/HabitInsights';
import { buildDemoData } from '../src/services/demoData';
import { computeHabitStats } from '../src/services/analytics';
import { addDays, monthGroups, todayISO } from '../src/services/date';
import type { AppData } from '../src/types';
import type { AppDataApi } from '../src/hooks/useAppData';
import type { PageId } from '../src/hooks/useArc';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok   ${msg}`);
  else { failures++; console.error(`  FAIL ${msg}`); }
}

const real: AppData = {
  settings: { theme: 'dark', onboarded: true, demoMode: false },
  arc: null,
  habits: [],
  dailyRecords: {},
  reflections: {},
  version: 1,
};
const data = buildDemoData(real);
const api = { data, loaded: true, today: todayISO() } as unknown as AppDataApi;
const noopNav = (_p: PageId) => undefined;
const today = todayISO();
const arc = data.arc!;

console.log('— render: Dashboard —');
const dash = renderToString(<DashboardPage api={api} onNavigate={noopNav} />);
assert(dash.includes('Coming up'), 'dashboard renders "Coming up" card');
assert(dash.includes('This week'), 'dashboard renders "This week" card');
assert(dash.includes('Your goal'), 'dashboard renders goal card');
assert(dash.includes('Habits at a glance'), 'dashboard renders habit glance');
assert(dash.includes('My Day'), 'dashboard renders My Day card');

console.log('— render: Calendar —');
const cal = renderToString(<CalendarPage api={api} />);
assert(cal.includes('Last 365 days'), 'calendar renders default year heatmap view');

console.log('— render: Habits page —');
const hab = renderToString(<HabitsPage api={api} />);
assert(hab.includes('Current streak'), 'habit cards render current streak');
assert(hab.includes('Recent activity'), 'habit cards render recent activity section');

console.log('— render: HabitGrid (monthly tracker) —');
const months = monthGroups(arc.startDate, addDays(arc.startDate, arc.durationDays - 1));
const firstMonth = renderToString(
  <HabitGrid arc={arc} habits={data.habits} records={data.dailyRecords} dates={months[0].dates} now={today} />
);
assert(firstMonth.includes('mg-table'), 'grid renders the habit table');
assert(firstMonth.includes('mg-sum-col'), 'grid renders per-habit month summary column');
assert(firstMonth.includes('mg-cell'), 'grid renders status cells');

const lastMonth = renderToString(
  <HabitGrid
    arc={arc}
    habits={data.habits}
    records={data.dailyRecords}
    dates={months[months.length - 1].dates}
    now={today}
  />
);
assert(lastMonth.includes('mg-cell future'), 'future days render as locked cells');
assert(lastMonth.includes('mg-legend-cell'), 'grid renders legend');

console.log('— render: HabitInsights —');
const stat = computeHabitStats(arc, data.habits, data.dailyRecords, today)[0];
const ins = renderToString(
  <HabitInsights habit={stat.habit} stat={stat} arc={arc} records={data.dailyRecords} now={today} />
);
assert(ins.includes('Best streak'), 'insights render best streak');
assert(ins.includes('Completion'), 'insights render completion rate');
assert(ins.includes('hi-day'), 'insights render the recent-days strip');

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
