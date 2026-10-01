/* ============================================================
   Demo data — optional preview mode only (spec §12).
   The normal dashboard is ALWAYS driven by stored user data.
   v2: includes trackable rules with followed/broken history.
   ============================================================ */

import type { AppData, Habit, Rule, DailyRecord } from '../types';
import { addDays, todayISO } from './date';

/** Deterministic pseudo-random so the preview is stable across renders. */
function mulberry(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildDemoData(real: AppData): AppData {
  const today = todayISO();
  // Start the demo arc ~5 weeks ago so charts have shape.
  const startDate = addDays(today, -34);
  const durationDays = 90;
  const rand = mulberry(42);

  const habits: Habit[] = [
    { id: 'demo_h1', name: 'Workout', icon: 'dumbbell', type: 'checkbox', target: 1, unit: 'session', active: true, createdAt: `${startDate}T08:00:00.000Z`, order: 1 },
    { id: 'demo_h2', name: 'Drink water', icon: 'hash', type: 'numeric', target: 8, unit: 'glasses', active: true, createdAt: `${startDate}T08:00:00.000Z`, order: 2 },
    { id: 'demo_h3', name: 'Deep work', icon: 'clock', type: 'duration', target: 90, unit: 'min', active: true, createdAt: `${startDate}T08:00:00.000Z`, order: 3 },
    { id: 'demo_h4', name: 'Read', icon: 'book', type: 'duration', target: 20, unit: 'min', active: true, createdAt: `${startDate}T08:00:00.000Z`, order: 4 },
  ];

  const rules: Rule[] = [
    { id: 'demo_r1', text: 'No phone in bed', active: true, fromDay: 1, createdAt: `${startDate}T08:00:00.000Z`, order: 1 },
    { id: 'demo_r2', text: 'No sugar', active: true, fromDay: 1, createdAt: `${startDate}T08:00:00.000Z`, order: 2 },
    { id: 'demo_r3', text: 'Lights out by 11 PM', active: true, fromDay: 1, createdAt: `${startDate}T08:00:00.000Z`, order: 3 },
  ];

  const dailyRecords: Record<string, DailyRecord> = {};
  for (let i = 0; i <= 34; i++) {
    const date = addDays(startDate, i);
    const r = rand();
    // Skip some days entirely (missed), some days partial.
    const skipAll = r < 0.15;
    const allDone = r > 0.55;
    const habitsRec: DailyRecord['habits'] = {};
    for (const h of habits) {
      const doneChance = allDone ? 0.92 : 0.45;
      const done = !skipAll && rand() < doneChance;
      if (done) {
        const value = h.type === 'checkbox' ? 1 : h.type === 'duration' ? h.target + Math.floor(rand() * 30) : h.target + Math.floor(rand() * 2);
        habitsRec[h.id] = { value, completed: true };
      } else if (!skipAll && rand() < 0.25) {
        const value = h.type === 'checkbox' ? 0 : Math.max(1, Math.floor(h.target * (0.3 + rand() * 0.5)));
        habitsRec[h.id] = { value, completed: false };
      }
    }
    const rulesRec: DailyRecord['rules'] = {};
    for (const rule of rules) {
      if (skipAll) continue; // unmarked day → counts as not followed
      const followChance = allDone ? 0.9 : 0.7;
      rulesRec[rule.id] = { status: rand() < followChance ? 'followed' : 'not_followed' };
    }
    dailyRecords[date] = {
      date,
      habits: habitsRec,
      rules: rulesRec,
      note: i === 20 ? 'Tough day, still got the workout in.' : '',
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    ...real,
    arc: {
      id: 'arc_current',
      title: 'Winter Arc',
      startDate,
      endDate: addDays(startDate, durationDays - 1),
      durationDays,
      goal: 'Demo: build unbreakable morning discipline',
      why: 'Preview mode — none of this is your data.',
      rules: rules.map((r) => r.text),
      status: 'active',
      createdAt: `${startDate}T08:00:00.000Z`,
      updatedAt: new Date().toISOString(),
    },
    habits,
    rules,
    dailyRecords,
    reflections: {},
  };
}
