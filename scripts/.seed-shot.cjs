"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

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
function addDays(iso, days) {
  const d = fromISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

// src/services/demoData.ts
function mulberry(seed) {
  return () => {
    seed |= 0;
    seed = seed + 1831565813 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function buildDemoData(real) {
  const today2 = todayISO();
  const startDate = addDays(today2, -34);
  const durationDays = 90;
  const rand = mulberry(42);
  const habits = [
    { id: "demo_h1", name: "Workout", icon: "dumbbell", type: "checkbox", target: 1, unit: "session", active: true, createdAt: `${startDate}T08:00:00.000Z`, order: 1 },
    { id: "demo_h2", name: "Drink water", icon: "hash", type: "numeric", target: 8, unit: "glasses", active: true, createdAt: `${startDate}T08:00:00.000Z`, order: 2 },
    { id: "demo_h3", name: "Deep work", icon: "clock", type: "duration", target: 90, unit: "min", active: true, createdAt: `${startDate}T08:00:00.000Z`, order: 3 },
    { id: "demo_h4", name: "Read", icon: "book", type: "duration", target: 20, unit: "min", active: true, createdAt: `${startDate}T08:00:00.000Z`, order: 4 }
  ];
  const rules = [
    { id: "demo_r1", text: "No phone in bed", active: true, fromDay: 1, createdAt: `${startDate}T08:00:00.000Z`, order: 1 },
    { id: "demo_r2", text: "No sugar", active: true, fromDay: 1, createdAt: `${startDate}T08:00:00.000Z`, order: 2 },
    { id: "demo_r3", text: "Lights out by 11 PM", active: true, fromDay: 1, createdAt: `${startDate}T08:00:00.000Z`, order: 3 }
  ];
  const dailyRecords = {};
  for (let i = 0; i <= 34; i++) {
    const date = addDays(startDate, i);
    const r = rand();
    const skipAll = r < 0.15;
    const allDone = r > 0.55;
    const habitsRec = {};
    for (const h of habits) {
      const doneChance = allDone ? 0.92 : 0.45;
      const done = !skipAll && rand() < doneChance;
      if (done) {
        const value = h.type === "checkbox" ? 1 : h.type === "duration" ? h.target + Math.floor(rand() * 30) : h.target + Math.floor(rand() * 2);
        habitsRec[h.id] = { value, completed: true };
      } else if (!skipAll && rand() < 0.25) {
        const value = h.type === "checkbox" ? 0 : Math.max(1, Math.floor(h.target * (0.3 + rand() * 0.5)));
        habitsRec[h.id] = { value, completed: false };
      }
    }
    const rulesRec = {};
    for (const rule of rules) {
      if (skipAll) continue;
      const followChance = allDone ? 0.9 : 0.7;
      rulesRec[rule.id] = { status: rand() < followChance ? "followed" : "not_followed" };
    }
    dailyRecords[date] = {
      date,
      habits: habitsRec,
      rules: rulesRec,
      note: i === 20 ? "Tough day, still got the workout in." : "",
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  return {
    ...real,
    arc: {
      id: "arc_current",
      title: "Winter Arc",
      startDate,
      endDate: addDays(startDate, durationDays - 1),
      durationDays,
      goal: "Demo: build unbreakable morning discipline",
      why: "Preview mode \u2014 none of this is your data.",
      rules: rules.map((r) => r.text),
      status: "active",
      createdAt: `${startDate}T08:00:00.000Z`,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    },
    habits,
    rules,
    dailyRecords,
    reflections: {}
  };
}

// scripts/seed-shot.ts
var fs = __toESM(require("node:fs"), 1);
var path = __toESM(require("node:path"), 1);
var today = todayISO();
var base = {
  settings: { theme: "dark", onboarded: true, demoMode: false },
  arc: null,
  habits: [],
  rules: [],
  dailyRecords: {},
  reflections: {},
  version: 2
};
var data = buildDemoData(base);
var payload = {
  "winterArc.settings": data.settings,
  "winterArc.arc": data.arc,
  "winterArc.habits": data.habits,
  "winterArc.rules": data.rules,
  "winterArc.dailyRecords": data.dailyRecords,
  "winterArc.reflections": data.reflections,
  "winterArc.version": data.version
};
var outDir = process.argv[2] ?? ".shots";
fs.mkdirSync(outDir, { recursive: true });
var seedPath = path.join(outDir, "seed.json");
fs.writeFileSync(seedPath, JSON.stringify(payload), "utf8");
var seedHtml = `<!doctype html>
<html><head><meta charset="utf-8"><title>seed</title></head>
<body>
<p id="s">seeding&hellip;</p>
<script>
fetch('/.shots/seed.json?t=' + Date.now())
  .then(function (r) { return r.json(); })
  .then(function (entries) {
    Object.keys(entries).forEach(function (k) {
      localStorage.setItem(k, JSON.stringify(entries[k]));
    });
    location.replace('/#/' + (location.hash.split('/')[1] || 'dashboard'));
  })
  .catch(function (e) {
    document.getElementById('s').textContent = 'seed failed: ' + e;
  });
</script>
</body></html>`;
fs.writeFileSync(path.join(outDir, "seed.html"), seedHtml, "utf8");
console.log(`seed written: ${seedPath}`);
console.log(`arc: ${data.arc?.startDate} .. ${data.arc?.endDate} (${data.arc?.durationDays} days)`);
console.log(`today: ${today} \xB7 habits ${data.habits.length} \xB7 rules ${data.rules.length} \xB7 records ${Object.keys(data.dailyRecords).length}`);
