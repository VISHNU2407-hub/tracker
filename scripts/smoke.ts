/* Smoke test for analytics + date services (bundled with esbuild, run with node). */
import {
  evaluateDay, computeStreaks, computeOverallStats, computeHabitStats, computeTrend,
} from '../src/services/analytics';
import { addDays, daysBetween, weekKeyOf, isValidISO } from '../src/services/date';
import { importState, exportState, normalizeAppData } from '../src/services/storage';
import type { Arc, Habit, DailyRecord } from '../src/types';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok   ${msg}`);
  else { failures++; console.error(`  FAIL ${msg}`); }
}

const start = '2026-10-01';
const arc: Arc = {
  id: 'arc_current', title: 'Winter Arc', startDate: start,
  endDate: '2026-12-29', durationDays: 90,
  goal: 'g', why: 'w', rules: [], status: 'active',
  createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
};

const habits: Habit[] = [
  { id: 'h1', name: 'Check', icon: 'check', type: 'checkbox', target: 1, unit: 'session', active: true, createdAt: '2026-10-01T00:00:00Z', order: 1 },
  { id: 'h2', name: 'Water', icon: 'hash', type: 'numeric', target: 8, unit: 'glasses', active: true, createdAt: '2026-10-01T00:00:00Z', order: 2 },
  { id: 'h3', name: 'Study', icon: 'clock', type: 'duration', target: 60, unit: 'min', active: true, createdAt: '2026-10-01T00:00:00Z', order: 3 },
];

function rec(habitsDone: Record<string, number>, note = ''): DailyRecord {
  const habits: DailyRecord['habits'] = {};
  for (const [id, v] of Object.entries(habitsDone)) {
    habits[id] = { value: v, completed: v > 0 };
  }
  return { date: '', habits, note, updatedAt: '' };
}

console.log('— date service —');
assert(isValidISO('2026-02-29') === false, 'non-leap year Feb 29 rejected');
assert(isValidISO('2024-02-29'), 'leap year 2024 accepted');
assert(isValidISO('2025-02-29') === false, 'invalid Feb 29 rejected');
assert(daysBetween('2025-12-30', '2026-01-02') === 3, 'month/year boundary diff = 3');
assert(addDays('2026-10-31', 1) === '2026-11-01', 'addDays across month boundary');
assert(weekKeyOf('2026-10-05') === '2026-W41', 'ISO week key Oct 5 2026 = W41');
assert(weekKeyOf('2026-01-01') === '2026-W01', 'ISO week Jan 1 2026 = W01');

console.log('— day evaluation —');
const now = '2026-10-11';
// Day 1 (Oct 1): everything done
const r1 = rec({ h1: 1, h2: 8, h3: 75 });
// Day 2 (Oct 2): partial — 2 of 3
const r2 = rec({ h1: 1, h2: 8, h3: 0 });
// Day 3: nothing
// Days 4..11 (Oct 4-11): all done → streak of 8 ending today

const records: Record<string, DailyRecord> = { '2026-10-01': r1, '2026-10-02': r2 };
const mkRecords = () => {
  const out: Record<string, DailyRecord> = { '2026-10-01': r1, '2026-10-02': r2 };
  for (let d = 4; d <= 11; d++) {
    out[addDays('2026-10-01', d - 1)] = rec({ h1: 1, h2: 9, h3: 90 });
  }
  return out;
};
const fullRecords = mkRecords();

const ev1 = evaluateDay(arc, habits, fullRecords, '2026-10-01', now);
assert(ev1.isPerfect && ev1.pct === 100, 'day 1 all done = perfect, 100%');
const ev2 = evaluateDay(arc, habits, fullRecords, '2026-10-02', now);
assert(!ev2.isPerfect && ev2.pct === 67, 'day 2 partial = 67%');
assert(ev2.state === 'partial', 'day 2 state = partial');
const evF = evaluateDay(arc, habits, fullRecords, '2026-11-15', now);
assert(evF.state === 'future' && evF.pct === null, 'future day locked, null pct');
const evB = evaluateDay(arc, habits, fullRecords, '2026-09-01', now);
assert(evB.state === 'before-start', 'before-start day');

console.log('— streaks —');
const streaks = computeStreaks(arc, habits, fullRecords, now);
assert(streaks.current === 8, `current streak = 8 (got ${streaks.current})`);
assert(streaks.best === 8, `best streak = 8 (got ${streaks.best})`);

// Miss today (remove Oct 11) → streak survives via Oct 10 (future days never break)
const withoutToday = { ...fullRecords };
delete withoutToday['2026-10-11'];
const s2 = computeStreaks(arc, habits, withoutToday, now);
assert(s2.current === 7, `streak survives today-miss via yesterday = 7 (got ${s2.current})`);

// Miss Oct 10 fully → current resets to 0 (Oct 11 alone doesn't chain)
const broken = { ...fullRecords, '2026-10-10': rec({}) };
const s3 = computeStreaks(arc, habits, broken, now);
assert(s3.current === 1, `broken chain → current = 1 (got ${s3.current})`);
assert(s3.best === 6, `best = longest remaining run 6 after break (got ${s3.best})`);

console.log('— overall stats —');
const overall = computeOverallStats(arc, habits, fullRecords, now);
assert(overall.dayNumber === 11, `day number = 11 (got ${overall.dayNumber})`);
assert(overall.perfectDays === 9, `perfect days = 9 (got ${overall.perfectDays})`); // days 1,4..11
assert(overall.totalPct === 88, `avg completion incl. missed day = 88% (got ${overall.totalPct})`);

console.log('— habit stats —');
const hs = computeHabitStats(arc, habits, fullRecords, now);
const study = hs.find((s) => s.habit.id === 'h3')!;
assert(study.completedCount === 9, `study completed 9 days (got ${study.completedCount})`);
assert(study.rate === 82, `study rate 9/11 = 82% (got ${study.rate})`);
assert(study.bestStreak === 8, `study best streak 8 (got ${study.bestStreak})`);

console.log('— habit creation gating —');
const lateHabit: Habit = { ...habits[0], id: 'late', createdAt: '2026-10-05T00:00:00Z', active: true };
const evLate = evaluateDay(arc, [lateHabit], fullRecords, '2026-10-02', now);
assert(evLate.eligibleCount === 0 && evLate.pct === null, 'habit created later not eligible on earlier day');

console.log('— archived habit preserves history —');
const archivedHabit: Habit = { ...habits[0], active: false };
const evArch = evaluateDay(arc, [archivedHabit], fullRecords, '2026-10-01', now);
assert(evArch.eligibleCount === 1 && evArch.pct === 100, 'archived habit still counts on past days');

console.log('— trend —');
const t7 = computeTrend(arc, habits, fullRecords, 7, now);
assert(t7.length === 7, '7-day trend has 7 points');
assert(t7[6].date === '2026-10-11', 'trend ends today');
assert(t7.every((p) => p.pct !== null), 'trend pct all non-null in window');

console.log('— export / import validation —');
const goodBackup = {
  settings: { theme: 'dark', onboarded: true },
  arc: { ...arc },
  habits,
  dailyRecords: fullRecords,
  reflections: { '2026-W41': { id: 'r1', weekKey: '2026-W41', weekStart: '2026-10-05', wentWell: 'x', toImprove: 'y', nextFocus: 'z' } },
  version: 1,
};
const imp = importState(JSON.stringify(goodBackup));
assert(imp.ok && imp.data && imp.data.arc !== null, 'valid backup imports');
assert(imp.data!.habits.length === 3 && Object.keys(imp.data!.dailyRecords).length === Object.keys(fullRecords).length, 'backup content normalized');
assert(imp.data!.reflections['2026-W41'] !== undefined, 'reflections imported');
assert(importState('not json{').ok === false, 'invalid JSON rejected');
assert(importState('[1,2,3]').ok === false, 'non-object JSON rejected');
assert(importState('{}').ok === false, 'empty object rejected (no arc)');
const badArc = { ...goodBackup, arc: { ...arc, startDate: 'nope' } };
assert(importState(JSON.stringify(badArc)).ok === false, 'backup with invalid start date rejected');
// Duplicate habit IDs normalize to last one
const dupes = { ...goodBackup, habits: [habits[0], { ...habits[0], name: 'Second' }] };
const imp2 = importState(JSON.stringify(dupes));
assert(imp2.ok && imp2.data!.habits.length === 1 && imp2.data!.habits[0].name === 'Second', 'duplicate habit IDs normalized (last wins)');
// Corrupt daily record entries dropped safely
const corrupt = { ...goodBackup, dailyRecords: { ...fullRecords, 'garbage-date': { junk: true } } };
const imp3 = importState(JSON.stringify(corrupt));
assert(imp3.ok && imp3.data!.dailyRecords['garbage-date'] === undefined, 'corrupt record entries dropped');
const exported = JSON.parse(exportState(imp.data!));
assert(!!exported.exportedAt && exported.arc.startDate === arc.startDate, 'export includes timestamp and round-trips');

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
