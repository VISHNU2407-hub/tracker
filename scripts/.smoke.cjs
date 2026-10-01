"use strict";

// src/services/date.ts
function todayISO() {
  return toISO(/* @__PURE__ */ new Date());
}
function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fromISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
function isValidISO(iso) {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = fromISO(iso);
  return toISO(d) === iso;
}
function addDays(iso, days) {
  const d = fromISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}
function daysBetween(a, b) {
  const da = fromISO(a);
  const db = fromISO(b);
  da.setHours(12, 0, 0, 0);
  db.setHours(12, 0, 0, 0);
  return Math.round((db.getTime() - da.getTime()) / 864e5);
}
function weekKeyOf(iso) {
  const d = fromISO(iso);
  const dow = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - dow);
  const thursday = new Date(monday);
  thursday.setDate(monday.getDate() + 3);
  const year = thursday.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - (jan4.getDay() + 6) % 7);
  const week = Math.round((monday.getTime() - week1Monday.getTime()) / 864e5 / 7) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

// src/services/analytics.ts
function eligibleHabitsForDate(habits2, date, now2 = todayISO()) {
  return habits2.filter((h) => {
    if (h.active) return h.createdAt.slice(0, 10) <= date;
    return h.createdAt.slice(0, 10) <= date && now2 >= date;
  });
}
function recordFor(records, date) {
  const rec2 = records[date];
  return rec2 && Object.keys(rec2.habits).length >= 0 ? rec2 : void 0;
}
function evaluateDay(arc2, habits2, records, date, now2 = todayISO()) {
  if (date < arc2.startDate) {
    return { state: "before-start", pct: null, completedCount: 0, eligibleCount: 0, isPerfect: false };
  }
  const dayIndex = daysBetween(arc2.startDate, date);
  if (dayIndex >= arc2.durationDays) {
    return { state: "future", pct: null, completedCount: 0, eligibleCount: 0, isPerfect: false };
  }
  if (date > now2) {
    return { state: "future", pct: null, completedCount: 0, eligibleCount: 0, isPerfect: false };
  }
  const eligible = eligibleHabitsForDate(habits2, date, now2);
  const rec2 = recordFor(records, date);
  const done = eligible.filter((h) => rec2?.habits[h.id]?.completed === true);
  const eligibleCount = eligible.length;
  const completedCount = done.length;
  const pct = eligibleCount === 0 ? null : Math.round(completedCount / eligibleCount * 100);
  const isPerfect = eligibleCount > 0 && completedCount === eligibleCount;
  let state;
  if (date === now2) state = "today";
  else if (pct === null) state = "empty";
  else if (isPerfect) state = "complete";
  else if (completedCount > 0) state = "partial";
  else state = "empty";
  return { state, pct, completedCount, eligibleCount, isPerfect };
}
function isQualifyingDay(evaln) {
  return evaln.isPerfect;
}
function computeStreaks(arc2, habits2, records, now2 = todayISO()) {
  const start2 = arc2.startDate;
  const today = now2 < start2 ? start2 : now2;
  const lastArcDay = addDays(start2, arc2.durationDays - 1);
  const end = today < lastArcDay ? today : lastArcDay;
  const qualifying = /* @__PURE__ */ new Set();
  let cursor = start2;
  while (cursor <= end) {
    const evaln = evaluateDay(arc2, habits2, records, cursor, now2);
    if (isQualifyingDay(evaln)) qualifying.add(cursor);
    cursor = addDays(cursor, 1);
  }
  let best = 0;
  let run = 0;
  cursor = start2;
  while (cursor <= end) {
    if (qualifying.has(cursor)) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
    cursor = addDays(cursor, 1);
  }
  let current = 0;
  let probe = end;
  if (!qualifying.has(end)) probe = addDays(end, -1);
  while (probe >= start2 && qualifying.has(probe)) {
    current += 1;
    probe = addDays(probe, -1);
  }
  return { current, best: Math.max(best, current) };
}
function computeOverallStats(arc2, habits2, records, now2 = todayISO()) {
  const today = now2 < arc2.startDate ? arc2.startDate : now2;
  const dayNumber = Math.min(Math.max(daysBetween(arc2.startDate, today) + 1, 1), arc2.durationDays);
  const elapsedDays = dayNumber;
  let perfectDays = 0;
  let pctSum = 0;
  let pctDays = 0;
  let qualifyingDays = 0;
  let cursor = arc2.startDate;
  const end = today;
  while (cursor <= end) {
    const evaln = evaluateDay(arc2, habits2, records, cursor, now2);
    if (evaln.isPerfect) {
      perfectDays += 1;
      qualifyingDays += 1;
    } else if (evaln.pct !== null && evaln.completedCount > 0) qualifyingDays += 1;
    if (evaln.pct !== null) {
      pctSum += evaln.pct;
      pctDays += 1;
    }
    cursor = addDays(cursor, 1);
  }
  return {
    dayNumber,
    totalPct: pctDays === 0 ? null : Math.round(pctSum / pctDays),
    perfectDays,
    elapsedDays,
    qualifyingDays,
    streaks: computeStreaks(arc2, habits2, records, now2)
  };
}
function computeHabitStats(arc2, habits2, records, now2 = todayISO()) {
  const today = now2 < arc2.startDate ? arc2.startDate : now2;
  return habits2.map((habit) => {
    let completed = 0;
    let eligible = 0;
    let totalValue = 0;
    let cur = 0;
    let best = 0;
    let run = 0;
    let cursor = arc2.startDate;
    while (cursor <= today) {
      const el = eligibleHabitsForDate([habit], cursor, now2).length > 0;
      const isDone = records[cursor]?.habits[habit.id]?.completed === true;
      if (el) {
        eligible += 1;
        if (isDone) completed += 1;
        const val = records[cursor]?.habits[habit.id]?.value ?? 0;
        totalValue += val;
      }
      if (isDone) {
        run += 1;
        if (run > best) best = run;
      } else if (el) {
        run = 0;
      }
      cursor = addDays(cursor, 1);
    }
    cur = 0;
    let probe = today;
    const lastEligible = (d) => eligibleHabitsForDate([habit], d, now2).length > 0;
    while (probe >= arc2.startDate) {
      if (records[probe]?.habits[habit.id]?.completed === true) cur += 1;
      else if (lastEligible(probe)) break;
      probe = addDays(probe, -1);
    }
    return {
      habit,
      rate: eligible === 0 ? null : Math.round(completed / eligible * 100),
      completedCount: completed,
      eligibleCount: eligible,
      totalValue,
      currentStreak: cur,
      bestStreak: Math.max(best, cur)
    };
  });
}
function computeTrend(arc2, habits2, records, days, now2 = todayISO()) {
  const today = now2 < arc2.startDate ? arc2.startDate : now2;
  const firstArcDay = arc2.startDate;
  const from = daysBetween(firstArcDay, today) < days ? firstArcDay : addDays(today, -(days - 1));
  const points = [];
  let cursor = from;
  while (cursor <= today) {
    const evaln = evaluateDay(arc2, habits2, records, cursor, now2);
    points.push({ date: cursor, pct: evaln.pct });
    cursor = addDays(cursor, 1);
  }
  return points;
}

// src/services/storage.ts
var SCHEMA_VERSION = 1;
function isRecord(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function str(v, fallback = "") {
  return typeof v === "string" ? v : fallback;
}
function normalizeAppData(input) {
  const src = isRecord(input) ? input : {};
  const settings = {
    theme: "dark",
    onboarded: src.settings && isRecord(src.settings) ? !!src.settings.onboarded : false,
    demoMode: src.settings && isRecord(src.settings) ? !!src.settings.demoMode : false
  };
  let arc2 = null;
  if (isRecord(src.arc) && isValidISO(src.arc.startDate) && isValidISO(src.arc.endDate)) {
    const a = src.arc;
    const duration = typeof a.durationDays === "number" && a.durationDays > 0 ? Math.floor(a.durationDays) : 90;
    arc2 = {
      id: str(a.id, "arc_current"),
      title: str(a.title, "Winter Arc"),
      startDate: a.startDate,
      endDate: a.endDate,
      durationDays: duration,
      goal: str(a.goal),
      why: str(a.why),
      rules: Array.isArray(a.rules) ? a.rules.filter((r) => typeof r === "string") : [],
      status: a.status === "completed" || a.status === "archived" ? a.status : "active",
      createdAt: str(a.createdAt, (/* @__PURE__ */ new Date()).toISOString()),
      updatedAt: str(a.updatedAt, (/* @__PURE__ */ new Date()).toISOString())
    };
  }
  const habitArr = Array.isArray(src.habits) ? src.habits : [];
  const habitMap = /* @__PURE__ */ new Map();
  const validTypes = ["checkbox", "numeric", "duration"];
  for (const h of habitArr) {
    if (!isRecord(h) || typeof h.id !== "string" || !h.id) continue;
    const type = validTypes.includes(str(h.type)) ? h.type : "checkbox";
    const targetRaw = typeof h.target === "number" && h.target > 0 ? h.target : 1;
    habitMap.set(h.id, {
      id: h.id,
      name: str(h.name, "Habit"),
      icon: str(h.icon, "target"),
      type,
      target: type === "checkbox" ? 1 : targetRaw,
      unit: str(h.unit, type === "duration" ? "min" : "\xD7"),
      active: h.active !== false,
      createdAt: str(h.createdAt, (/* @__PURE__ */ new Date()).toISOString()),
      order: typeof h.order === "number" ? h.order : habitMap.size
    });
  }
  const dailyRecords = {};
  if (isRecord(src.dailyRecords)) {
    for (const [date, rec2] of Object.entries(src.dailyRecords)) {
      if (!isValidISO(date) || !isRecord(rec2)) continue;
      const habits2 = {};
      if (isRecord(rec2.habits)) {
        for (const [hid, hr] of Object.entries(rec2.habits)) {
          if (!isRecord(hr)) continue;
          const value = typeof hr.value === "number" && isFinite(hr.value) ? hr.value : 0;
          habits2[hid] = { value, completed: hr.completed === true || value > 0 };
        }
      }
      dailyRecords[date] = {
        date,
        habits: habits2,
        note: str(rec2.note),
        updatedAt: str(rec2.updatedAt, (/* @__PURE__ */ new Date()).toISOString())
      };
    }
  }
  const reflections = {};
  if (isRecord(src.reflections)) {
    for (const [weekKey, r] of Object.entries(src.reflections)) {
      if (!isRecord(r) || typeof r.weekStart !== "string") continue;
      reflections[weekKey] = {
        id: str(r.id, `refl_${weekKey}`),
        weekKey,
        weekStart: r.weekStart,
        wentWell: str(r.wentWell),
        toImprove: str(r.toImprove),
        nextFocus: str(r.nextFocus),
        createdAt: str(r.createdAt, (/* @__PURE__ */ new Date()).toISOString()),
        updatedAt: str(r.updatedAt, (/* @__PURE__ */ new Date()).toISOString())
      };
    }
  }
  return {
    settings,
    arc: arc2,
    habits: Array.from(habitMap.values()).sort((a, b) => a.order - b.order),
    dailyRecords,
    reflections,
    version: SCHEMA_VERSION
  };
}
function exportState(data) {
  return JSON.stringify({ ...data, exportedAt: (/* @__PURE__ */ new Date()).toISOString() }, null, 2);
}
function importState(jsonText) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, error: "Invalid JSON \u2014 the file could not be parsed." };
  }
  if (!isRecord(parsed)) {
    return { ok: false, error: "Invalid backup: expected a JSON object." };
  }
  if (parsed.arc === null && (parsed.habits === void 0 || Array.isArray(parsed.habits) && parsed.habits.length === 0)) {
    return { ok: false, error: "This backup is empty (no Arc and no habits)." };
  }
  const data = normalizeAppData(parsed);
  if (data.arc === null) {
    return { ok: false, error: "Invalid backup: no valid Arc data found." };
  }
  return { ok: true, data };
}

// scripts/smoke.ts
var failures = 0;
function assert(cond, msg) {
  if (cond) console.log(`  ok   ${msg}`);
  else {
    failures++;
    console.error(`  FAIL ${msg}`);
  }
}
var start = "2026-10-01";
var arc = {
  id: "arc_current",
  title: "Winter Arc",
  startDate: start,
  endDate: "2026-12-29",
  durationDays: 90,
  goal: "g",
  why: "w",
  rules: [],
  status: "active",
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z"
};
var habits = [
  { id: "h1", name: "Check", icon: "check", type: "checkbox", target: 1, unit: "session", active: true, createdAt: "2026-10-01T00:00:00Z", order: 1 },
  { id: "h2", name: "Water", icon: "hash", type: "numeric", target: 8, unit: "glasses", active: true, createdAt: "2026-10-01T00:00:00Z", order: 2 },
  { id: "h3", name: "Study", icon: "clock", type: "duration", target: 60, unit: "min", active: true, createdAt: "2026-10-01T00:00:00Z", order: 3 }
];
function rec(habitsDone, note = "") {
  const habits2 = {};
  for (const [id, v] of Object.entries(habitsDone)) {
    habits2[id] = { value: v, completed: v > 0 };
  }
  return { date: "", habits: habits2, note, updatedAt: "" };
}
console.log("\u2014 date service \u2014");
assert(isValidISO("2026-02-29") === false, "non-leap year Feb 29 rejected");
assert(isValidISO("2024-02-29"), "leap year 2024 accepted");
assert(isValidISO("2025-02-29") === false, "invalid Feb 29 rejected");
assert(daysBetween("2025-12-30", "2026-01-02") === 3, "month/year boundary diff = 3");
assert(addDays("2026-10-31", 1) === "2026-11-01", "addDays across month boundary");
assert(weekKeyOf("2026-10-05") === "2026-W41", "ISO week key Oct 5 2026 = W41");
assert(weekKeyOf("2026-01-01") === "2026-W01", "ISO week Jan 1 2026 = W01");
console.log("\u2014 day evaluation \u2014");
var now = "2026-10-11";
var r1 = rec({ h1: 1, h2: 8, h3: 75 });
var r2 = rec({ h1: 1, h2: 8, h3: 0 });
var mkRecords = () => {
  const out = { "2026-10-01": r1, "2026-10-02": r2 };
  for (let d = 4; d <= 11; d++) {
    out[addDays("2026-10-01", d - 1)] = rec({ h1: 1, h2: 9, h3: 90 });
  }
  return out;
};
var fullRecords = mkRecords();
var ev1 = evaluateDay(arc, habits, fullRecords, "2026-10-01", now);
assert(ev1.isPerfect && ev1.pct === 100, "day 1 all done = perfect, 100%");
var ev2 = evaluateDay(arc, habits, fullRecords, "2026-10-02", now);
assert(!ev2.isPerfect && ev2.pct === 67, "day 2 partial = 67%");
assert(ev2.state === "partial", "day 2 state = partial");
var evF = evaluateDay(arc, habits, fullRecords, "2026-11-15", now);
assert(evF.state === "future" && evF.pct === null, "future day locked, null pct");
var evB = evaluateDay(arc, habits, fullRecords, "2026-09-01", now);
assert(evB.state === "before-start", "before-start day");
console.log("\u2014 streaks \u2014");
var streaks = computeStreaks(arc, habits, fullRecords, now);
assert(streaks.current === 8, `current streak = 8 (got ${streaks.current})`);
assert(streaks.best === 8, `best streak = 8 (got ${streaks.best})`);
var withoutToday = { ...fullRecords };
delete withoutToday["2026-10-11"];
var s2 = computeStreaks(arc, habits, withoutToday, now);
assert(s2.current === 7, `streak survives today-miss via yesterday = 7 (got ${s2.current})`);
var broken = { ...fullRecords, "2026-10-10": rec({}) };
var s3 = computeStreaks(arc, habits, broken, now);
assert(s3.current === 1, `broken chain \u2192 current = 1 (got ${s3.current})`);
assert(s3.best === 6, `best = longest remaining run 6 after break (got ${s3.best})`);
console.log("\u2014 overall stats \u2014");
var overall = computeOverallStats(arc, habits, fullRecords, now);
assert(overall.dayNumber === 11, `day number = 11 (got ${overall.dayNumber})`);
assert(overall.perfectDays === 9, `perfect days = 9 (got ${overall.perfectDays})`);
assert(overall.totalPct === 88, `avg completion incl. missed day = 88% (got ${overall.totalPct})`);
console.log("\u2014 habit stats \u2014");
var hs = computeHabitStats(arc, habits, fullRecords, now);
var study = hs.find((s) => s.habit.id === "h3");
assert(study.completedCount === 9, `study completed 9 days (got ${study.completedCount})`);
assert(study.rate === 82, `study rate 9/11 = 82% (got ${study.rate})`);
assert(study.bestStreak === 8, `study best streak 8 (got ${study.bestStreak})`);
console.log("\u2014 habit creation gating \u2014");
var lateHabit = { ...habits[0], id: "late", createdAt: "2026-10-05T00:00:00Z", active: true };
var evLate = evaluateDay(arc, [lateHabit], fullRecords, "2026-10-02", now);
assert(evLate.eligibleCount === 0 && evLate.pct === null, "habit created later not eligible on earlier day");
console.log("\u2014 archived habit preserves history \u2014");
var archivedHabit = { ...habits[0], active: false };
var evArch = evaluateDay(arc, [archivedHabit], fullRecords, "2026-10-01", now);
assert(evArch.eligibleCount === 1 && evArch.pct === 100, "archived habit still counts on past days");
console.log("\u2014 trend \u2014");
var t7 = computeTrend(arc, habits, fullRecords, 7, now);
assert(t7.length === 7, "7-day trend has 7 points");
assert(t7[6].date === "2026-10-11", "trend ends today");
assert(t7.every((p) => p.pct !== null), "trend pct all non-null in window");
console.log("\u2014 export / import validation \u2014");
var goodBackup = {
  settings: { theme: "dark", onboarded: true },
  arc: { ...arc },
  habits,
  dailyRecords: fullRecords,
  reflections: { "2026-W41": { id: "r1", weekKey: "2026-W41", weekStart: "2026-10-05", wentWell: "x", toImprove: "y", nextFocus: "z" } },
  version: 1
};
var imp = importState(JSON.stringify(goodBackup));
assert(imp.ok && imp.data && imp.data.arc !== null, "valid backup imports");
assert(imp.data.habits.length === 3 && Object.keys(imp.data.dailyRecords).length === Object.keys(fullRecords).length, "backup content normalized");
assert(imp.data.reflections["2026-W41"] !== void 0, "reflections imported");
assert(importState("not json{").ok === false, "invalid JSON rejected");
assert(importState("[1,2,3]").ok === false, "non-object JSON rejected");
assert(importState("{}").ok === false, "empty object rejected (no arc)");
var badArc = { ...goodBackup, arc: { ...arc, startDate: "nope" } };
assert(importState(JSON.stringify(badArc)).ok === false, "backup with invalid start date rejected");
var dupes = { ...goodBackup, habits: [habits[0], { ...habits[0], name: "Second" }] };
var imp2 = importState(JSON.stringify(dupes));
assert(imp2.ok && imp2.data.habits.length === 1 && imp2.data.habits[0].name === "Second", "duplicate habit IDs normalized (last wins)");
var corrupt = { ...goodBackup, dailyRecords: { ...fullRecords, "garbage-date": { junk: true } } };
var imp3 = importState(JSON.stringify(corrupt));
assert(imp3.ok && imp3.data.dailyRecords["garbage-date"] === void 0, "corrupt record entries dropped");
var exported = JSON.parse(exportState(imp.data));
assert(!!exported.exportedAt && exported.arc.startDate === arc.startDate, "export includes timestamp and round-trips");
console.log(failures === 0 ? "\nALL PASS" : `
${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
