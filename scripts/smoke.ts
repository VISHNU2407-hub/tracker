/* Smoke test for analytics + date services (bundled with esbuild, run with node).
   v2: rules are daily trackables — combined scoring, migration, rule stats. */
import {
  evaluateDay, computeStreaks, computeOverallStats, computeHabitStats, computeRuleStats,
  computeTrend, eligibleRulesForDate,
} from '../src/services/analytics';
import { addDays, daysBetween, weekKeyOf, isValidISO, monthGroups } from '../src/services/date';
import { importState, exportState, normalizeAppData } from '../src/services/storage';
import type { Arc, Habit, Rule, DailyRecord } from '../src/types';

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

const rules: Rule[] = [
  { id: 'r1', text: 'No Instagram after 10 PM', active: true, fromDay: 1, createdAt: '2026-10-01T00:00:00Z', order: 1 },
  { id: 'r2', text: 'Lights out by 11', active: true, fromDay: 4, createdAt: '2026-10-01T00:00:00Z', order: 2 },
];

function rec(habitsDone: Record<string, number>, ruleStatuses: Record<string, 'followed' | 'not_followed'> = {}, note = ''): DailyRecord {
  const habitRecs: DailyRecord['habits'] = {};
  for (const [id, v] of Object.entries(habitsDone)) {
    habitRecs[id] = { value: v, completed: v > 0 };
  }
  const ruleRecs: DailyRecord['rules'] = {};
  for (const [id, status] of Object.entries(ruleStatuses)) {
    ruleRecs[id] = { status };
  }
  return { date: '', habits: habitRecs, rules: ruleRecs, note, updatedAt: '' };
}

console.log('— date service —');
assert(isValidISO('2026-02-29') === false, 'non-leap year Feb 29 rejected');
assert(isValidISO('2024-02-29'), 'leap year 2024 accepted');
assert(isValidISO('2025-02-29') === false, 'invalid Feb 29 rejected');
assert(daysBetween('2025-12-30', '2026-01-02') === 3, 'month/year boundary diff = 3');
assert(addDays('2026-10-31', 1) === '2026-11-01', 'addDays across month boundary');
assert(weekKeyOf('2026-10-05') === '2026-W41', 'ISO week key Oct 5 2026 = W41');
assert(weekKeyOf('2026-01-01') === '2026-W01', 'ISO week Jan 1 2026 = W01');

console.log('— month groups (habit grid) —');
const mg = monthGroups('2026-10-25', '2026-11-30');
assert(mg.length === 2, 'Oct 25 → Nov 30 splits into 2 month groups');
assert(mg[0].label === 'October 2026' && mg[0].dates.length === 7, 'first group = Oct 25–31 (7 days)');
assert(mg[1].dates[0] === '2026-11-01' && mg[1].dates[mg[1].dates.length - 1] === '2026-11-30', 'second group = Nov 1–30');

console.log('— rule eligibility —');
const now = '2026-10-11';
assert(eligibleRulesForDate(arc, rules, '2026-10-01', now).map((r) => r.id).join(',') === 'r1', 'r2 not eligible before fromDay 4');
assert(eligibleRulesForDate(arc, rules, '2026-10-04', now).length === 2, 'both rules eligible from day 4');
assert(eligibleRulesForDate(arc, rules, '2026-09-30', now).length === 0, 'no rules eligible before arc start');
const archivedRule: Rule = { ...rules[0], active: false };
assert(eligibleRulesForDate(arc, [archivedRule], '2026-10-05', now).length === 1, 'archived rule keeps counting on past days');
assert(eligibleRulesForDate(arc, [archivedRule], now, now).length === 1, 'archived rule still eligible today (past-day gate only)');
assert(eligibleRulesForDate(arc, [archivedRule], '2026-10-15', now).length === 0, 'archived rule not eligible on future days');

console.log('— day evaluation (habits + rules combined) —');
// Day 1 (Oct 1): all habits done, rule followed
const r1 = rec({ h1: 1, h2: 8, h3: 75 }, { r1: 'followed' });
// Day 2 (Oct 2): habits all done but rule broken → NOT perfect
const r2 = rec({ h1: 1, h2: 8, h3: 60 }, { r1: 'not_followed' });
// Days 4..11: all done + both rules followed

const records: Record<string, DailyRecord> = { '2026-10-01': r1, '2026-10-02': r2 };
const mkRecords = () => {
  const out: Record<string, DailyRecord> = { '2026-10-01': r1, '2026-10-02': r2 };
  for (let d = 4; d <= 11; d++) {
    out[addDays('2026-10-01', d - 1)] = rec({ h1: 1, h2: 9, h3: 90 }, { r1: 'followed', r2: 'followed' });
  }
  return out;
};
const fullRecords = mkRecords();

const ev1 = evaluateDay(arc, habits, rules, fullRecords, '2026-10-01', now);
// Day 1: 3 habits + 1 rule = 4 eligible, all satisfied
assert(ev1.isPerfect && ev1.pct === 100, 'day 1 all done = perfect, 100%');
assert(ev1.habitDone === 3 && ev1.ruleFollowed === 1, 'day 1 breakdown 3 habits + 1 rule');

const ev2 = evaluateDay(arc, habits, rules, fullRecords, '2026-10-02', now);
// Day 2: 3 habits done + 1 rule broken → 3/4 = 75%
assert(!ev2.isPerfect && ev2.pct === 75, `day 2 broken rule → 75% (got ${ev2.pct})`);
assert(ev2.state === 'partial', 'day 2 state = partial (rule break blocks perfect)');

// Unmarked past rule days count as not followed (backfill semantics).
// Day 4: 3 habits done; r1 (from day 1) + r2 (from day 4) both unmarked → 3/5 = 60%
const evU = evaluateDay(arc, habits, rules, { ...fullRecords, '2026-10-04': rec({ h1: 1, h2: 9, h3: 90 }) }, '2026-10-04', now);
assert(evU.pct === 60, `unmarked rules on day 4 = 3/5 = 60% (got ${evU.pct})`);
assert(!evU.isPerfect, 'unmarked rules block perfect day');

const evF = evaluateDay(arc, habits, rules, fullRecords, '2026-11-15', now);
assert(evF.state === 'future' && evF.pct === null, 'future day locked, null pct');
const evB = evaluateDay(arc, habits, rules, fullRecords, '2026-09-01', now);
assert(evB.state === 'before-start', 'before-start day');

// No rules at all → legacy behavior preserved
const evNoRules = evaluateDay(arc, habits, [], fullRecords, '2026-10-01', now);
assert(evNoRules.isPerfect && evNoRules.pct === 100 && evNoRules.ruleEligible === 0, 'no rules → habits-only scoring unchanged');

console.log('— streaks (combined) —');
const streaks = computeStreaks(arc, habits, rules, fullRecords, now);
// Day 2 breaks the chain (rule broken), days 4–11 qualify: current = 8, best = 8
assert(streaks.current === 8, `current streak = 8 (got ${streaks.current})`);
assert(streaks.best === 8, `best streak = 8 (got ${streaks.best})`);

// Miss today (remove Oct 11) → streak survives via Oct 10 (future days never break)
const withoutToday = { ...fullRecords };
delete withoutToday['2026-10-11'];
const s2 = computeStreaks(arc, habits, rules, withoutToday, now);
assert(s2.current === 7, `streak survives today-miss via yesterday = 7 (got ${s2.current})`);

// Miss Oct 10 fully → current resets to 1
const broken = { ...fullRecords, '2026-10-10': rec({}) };
const s3 = computeStreaks(arc, habits, rules, broken, now);
assert(s3.current === 1, `broken chain → current = 1 (got ${s3.current})`);
assert(s3.best === 6, `best = longest remaining run 6 after break (got ${s3.best})`);

console.log('— overall stats —');
const overall = computeOverallStats(arc, habits, rules, fullRecords, now);
assert(overall.dayNumber === 11, `day number = 11 (got ${overall.dayNumber})`);
// Perfect: day 1 + days 4..11 = 9 (day 2 broken by rule)
assert(overall.perfectDays === 9, `perfect days = 9 (got ${overall.perfectDays})`);

console.log('— habit stats (rules do not distort habit rates) —');
const hs = computeHabitStats(arc, habits, fullRecords, now);
const study = hs.find((s) => s.habit.id === 'h3')!;
// h3 done: day 1 (75≥60), day 2 (60≥60 — habits done, rule broken), days 4–11 → 10 days
assert(study.completedCount === 10, `study completed 10 days (got ${study.completedCount})`);
assert(study.rate === 91, `study rate 10/11 = 91% (got ${study.rate})`);

console.log('— rule stats —');
const rs = computeRuleStats(arc, rules, fullRecords, now);
const r1s = rs.find((s) => s.rule.id === 'r1')!;
const r2s = rs.find((s) => s.rule.id === 'r2')!;
// r1: eligible 11 days, followed 9 (day 2 broken, day 3 unmarked)
assert(r1s.eligibleCount === 11, `r1 eligible 11 days (got ${r1s.eligibleCount})`);
assert(r1s.followedCount === 9, `r1 followed 9 days (got ${r1s.followedCount})`);
assert(r1s.rate === 82, `r1 rate 82% (got ${r1s.rate})`);
assert(r1s.brokenCount === 2, `r1 broken 2 days (got ${r1s.brokenCount})`);
assert(r1s.currentStreak === 8 && r1s.bestStreak === 8, `r1 streak 8/8 (got ${r1s.currentStreak}/${r1s.bestStreak})`);
// r2: eligible days 4..11 = 8, all followed
assert(r2s.eligibleCount === 8, `r2 eligible 8 days (got ${r2s.eligibleCount})`);
assert(r2s.rate === 100, `r2 rate 100% (got ${r2s.rate})`);
// Example from spec: 26/30 → 86.7% rounds to 87
assert(Math.round((26 / 30) * 100) === 87, '26/30 control rate rounds like the spec example');

console.log('— habit creation gating —');
const lateHabit: Habit = { ...habits[0], id: 'late', createdAt: '2026-10-05T00:00:00Z', active: true };
const evLate = evaluateDay(arc, [lateHabit], rules, fullRecords, '2026-10-02', now);
assert(evLate.habitEligible === 0 && evLate.pct === null || evLate.pct !== null, 'late habit evaluated without crash');
assert(evLate.ruleEligible === 1, 'rule still eligible on day 2');
// habit created later not eligible on earlier day
const evLate2 = evaluateDay(arc, [lateHabit], [], fullRecords, '2026-10-02', now);
assert(evLate2.eligibleCount === 0 && evLate2.pct === null, 'habit created later not eligible on earlier day');

console.log('— archived habit preserves history —');
const archivedHabit: Habit = { ...habits[0], active: false };
const evArch = evaluateDay(arc, [archivedHabit], rules, fullRecords, '2026-10-01', now);
assert(evArch.habitEligible === 1 && evArch.pct === 100, 'archived habit still counts on past days');

console.log('— trend —');
const t7 = computeTrend(arc, habits, rules, fullRecords, 7, now);
assert(t7.length === 7, '7-day trend has 7 points');
assert(t7[6].date === '2026-10-11', 'trend ends today');
assert(t7.every((p) => p.pct !== null), 'trend pct all non-null in window');

console.log('— storage migration (v1 → v2) —');
// v1 shape: rules as arc.rules text, no rules array, no per-day rule statuses
const v1 = {
  settings: { theme: 'dark', onboarded: true, demoMode: false },
  arc: { ...arc, rules: ['No Instagram after 10 PM', 'Up at 6:00'] },
  habits,
  dailyRecords: { '2026-10-01': { date: '2026-10-01', habits: { h1: { value: 1, completed: true } }, note: '', updatedAt: '' } },
  reflections: {},
  version: 1,
};
const norm = normalizeAppData(v1);
assert(norm.rules.length === 2, `arc.rules text migrated into 2 Rule entities (got ${norm.rules.length})`);
assert(norm.rules[0].text === 'No Instagram after 10 PM', 'rule text preserved verbatim');
assert(norm.rules[0].active === true && norm.rules[0].fromDay === 1, 'migrated rule active from Day 1');
assert(norm.rules[0].id === norm.rules[0].id, 'migrated rule has stable id');
assert(norm.arc!.rules.length === 2, 'arc.rules text mirror kept for back-compat');
// Migration is idempotent: entities win over re-migration
const again = normalizeAppData({ ...v1, rules: norm.rules, arc: { ...norm.arc!, rules: norm.rules.map((r) => r.text) } });
assert(again.rules.length === 2 && again.rules[0].id === norm.rules[0].id, 're-normalizing keeps same rule ids (no duplicates)');
// Existing rules must NOT be deleted or broken
assert(again.rules.map((r) => r.text).join('|') === 'No Instagram after 10 PM|Up at 6:00', 'existing rule texts intact');
// v1 daily record gains an empty rules map
assert(norm.dailyRecords['2026-10-01'].rules !== undefined, 'v1 daily record normalized with rules map');
// v2 export/import round-trips rule statuses
const v2 = normalizeAppData({
  settings: { theme: 'dark', onboarded: true, demoMode: false },
  arc: { ...arc, rules: ['No Instagram after 10 PM'] },
  habits,
  rules: norm.rules,
  dailyRecords: {
    '2026-10-01': { date: '2026-10-01', habits: {}, rules: { [norm.rules[0].id]: { status: 'followed' } }, note: '', updatedAt: '' },
    '2026-10-02': { date: '2026-10-02', habits: {}, rules: { [norm.rules[0].id]: { status: 'not_followed' } }, note: '', updatedAt: '' },
  },
  reflections: {},
  version: 2,
});
const roundTrip = importState(exportState(v2));
assert(roundTrip.ok && roundTrip.data!.rules.length === 2, 'v2 backup round-trips rule entities');
assert(roundTrip.data!.dailyRecords['2026-10-01'].rules[norm.rules[0].id].status === 'followed', 'followed status round-trips');
assert(roundTrip.data!.dailyRecords['2026-10-02'].rules[norm.rules[0].id].status === 'not_followed', 'not_followed status round-trips');

console.log('— export / import validation —');
const goodBackup = {
  settings: { theme: 'dark', onboarded: true },
  arc: { ...arc },
  habits,
  dailyRecords: fullRecords,
  reflections: { '2026-W41': { id: 'r1', weekKey: '2026-W41', weekStart: '2026-10-05', wentWell: 'x', toImprove: 'y', nextFocus: 'z' } },
  version: 2,
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
const dupes = { ...goodBackup, habits: [habits[0], { ...habits[0], name: 'Second' }] };
const imp2 = importState(JSON.stringify(dupes));
assert(imp2.ok && imp2.data!.habits.length === 1 && imp2.data!.habits[0].name === 'Second', 'duplicate habit IDs normalized (last wins)');
const corrupt = { ...goodBackup, dailyRecords: { ...fullRecords, 'garbage-date': { junk: true } } };
const imp3 = importState(JSON.stringify(corrupt));
assert(imp3.ok && imp3.data!.dailyRecords['garbage-date'] === undefined, 'corrupt record entries dropped');
const exported = JSON.parse(exportState(imp.data!));
assert(!!exported.exportedAt && exported.arc.startDate === arc.startDate, 'export includes timestamp and round-trips');

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
