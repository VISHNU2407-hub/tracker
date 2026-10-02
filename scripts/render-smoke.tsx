/* Render smoke test — server-renders the pages/components touched by the
   feature work to catch runtime errors (import cycles, null derefs, bad JSX)
   without needing a browser. Bundled with esbuild, run via `npm test`.
   v2: rules render in the daily flow and stats. */
import React from 'react';
import { renderToString } from 'react-dom/server';
import { DashboardPage } from '../src/pages/Dashboard';
import { CalendarPage } from '../src/pages/Calendar';
import { HabitsPage } from '../src/pages/Habits';
import { StatsPage } from '../src/pages/Stats';
import { MyTracksPage } from '../src/pages/MyTracks';
import { HabitGrid } from '../src/components/calendar/HabitGrid';
import { DayTasks } from '../src/components/dashboard/DayTasks';
import { Intro } from '../src/app/intro/Intro';
import { HabitHeatmap } from '../src/components/habits/HabitHeatmap';
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
  tracks: [],
  activeTrackId: null,
  arc: null,
  habits: [],
  rules: [],
  dailyRecords: {},
  reflections: {},
  version: 3,
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
assert(dash.includes('Rule control'), 'dashboard renders Rule control stat');
assert(dash.includes('Rules') && dash.includes('Habits'), 'dashboard daily list labels habits vs rules');
assert(dash.includes('section-label'), 'daily list renders labeled sections');
assert(dash.includes('rule-status-btn'), 'rules render Followed / Not followed controls');

console.log('— render: Calendar —');
const cal = renderToString(<CalendarPage api={api} />);
assert(cal.includes('Last 365 days'), 'calendar renders default year heatmap view');

console.log('— render: Habits page —');
const hab = renderToString(<HabitsPage api={api} />);
assert(hab.includes('Current streak'), 'habit cards render current streak');
assert(hab.includes('Best streak'), 'habit cards render best streak');
assert(hab.includes('hhm-month-label'), 'each habit card renders its own month-grouped heatmap');
assert(hab.includes('completed'), 'heatmaps render the completed-days footer');

console.log('— render: Stats —');
const stats = renderToString(<StatsPage api={api} />);
assert(stats.includes('Rule control'), 'stats renders Rule control section');
assert(stats.includes('days followed'), 'rule stats show days-followed counts');

console.log('— render: My Tracks —');
const mytracks = renderToString(<MyTracksPage api={api} />);
assert(mytracks.includes('daily trackable'), 'My Tracks marks rules as daily trackable');
assert(mytracks.includes('No phone in bed'), 'My Tracks lists existing rules');
assert(mytracks.includes('Day') && mytracks.includes('complete'), 'My Tracks shows per-track progress');

console.log('— render: HabitGrid (monthly tracker) —');
const months = monthGroups(arc.startDate, addDays(arc.startDate, arc.durationDays - 1));
const firstMonth = renderToString(
  <HabitGrid arc={arc} habits={data.habits} rules={data.rules} records={data.dailyRecords} dates={months[0].dates} now={today} />
);
assert(firstMonth.includes('mg-table'), 'grid renders the habit table');
assert(firstMonth.includes('mg-sum-col'), 'grid renders per-habit month summary column');
assert(firstMonth.includes('mg-cell'), 'grid renders status cells');
assert(firstMonth.includes('mg-rule-cell'), 'grid renders rule rows with rule cells');

const lastMonth = renderToString(
  <HabitGrid
    arc={arc}
    habits={data.habits}
    rules={data.rules}
    records={data.dailyRecords}
    dates={months[months.length - 1].dates}
    now={today}
  />
);
assert(lastMonth.includes('mg-cell future'), 'future days render as locked cells');
assert(lastMonth.includes('mg-legend-cell'), 'grid renders legend');

console.log('— render: HabitHeatmap —');
const stat = computeHabitStats(arc, data.habits, data.dailyRecords, today)[0];
const hm = renderToString(
  <HabitHeatmap habit={stat.habit} arc={arc} records={data.dailyRecords} now={today} />
);
assert(hm.includes('hhm-cell'), 'heatmap renders day cells');
assert(hm.includes('hhm-month'), 'heatmap groups days by month');
assert(hm.split('hhm-cell ').length - 1 >= stat.completedCount, 'completed days render as blue cells');

console.log('— render: DayTasks read-only gate (only today is editable) —');
const dayNoop = (..._args: unknown[]): void => undefined;
const dayTasksProps = {
  arc,
  habits: data.habits,
  rules: data.rules,
  records: data.dailyRecords,
  now: today,
  onToggle: dayNoop,
  onSetValue: dayNoop,
  onRuleStatus: dayNoop,
  compact: true,
};

const pastHtml = renderToString(<DayTasks {...dayTasksProps} date={addDays(today, -1)} />);
assert(pastHtml.includes('Read only'), 'previous day is labelled read-only');
assert(pastHtml.includes('task-item'), 'previous day still lists habits and rules for history');
assert(pastHtml.includes('Workout'), 'previous day still shows the stored habit data');
assert(!pastHtml.includes('task-check'), 'previous day renders no completion checkbox');
assert(!pastHtml.includes('rule-status-btn'), 'previous day renders no rule status buttons');
assert(!pastHtml.includes('task-num-input'), 'previous day renders no numeric input field');
assert(!pastHtml.includes('tap to complete'), 'previous day renders no editable hint');

const futureHtml = renderToString(<DayTasks {...dayTasksProps} date={addDays(today, 1)} />);
assert(futureHtml.includes('Locked'), 'future day stays locked');
assert(!futureHtml.includes('task-check'), 'future day renders no completion checkbox');
assert(!futureHtml.includes('task-num-input'), 'future day renders no numeric input field');

const todayHtml = renderToString(<DayTasks {...dayTasksProps} date={today} />);
assert(todayHtml.includes('task-check'), 'today keeps completion checkboxes');
assert(todayHtml.includes('rule-status-btn'), 'today keeps rule status buttons');
assert(todayHtml.includes('task-num-input'), 'today keeps numeric input fields');
assert(!todayHtml.includes('Read only'), 'today is never marked read-only');

console.log('— render: Intro (welcome screen above the tracker) —');
const intro = renderToString(<Intro arcTitle="Winter Arc" onEnter={() => undefined} />);
assert(intro.includes('Your Life. Your Progress.'), 'intro shows the product tagline');
assert(
  intro.includes('Install on Desktop') && intro.includes('Install on Android') && intro.includes('Continue on Web'),
  'intro offers the three exact ways in'
);
assert(intro.includes('Winter Arc'), 'intro names the current challenge');
assert(intro.includes('intro-platform'), 'intro renders the platform cards');
assert(intro.includes('What you can track'), 'intro explains what the system tracks');
assert(intro.includes('Habits') && intro.includes('Reflection'), 'intro lists core capabilities');
assert(!intro.includes('undefined') && !intro.includes('[object Object]'), 'intro leaks no undefined/object strings');

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
