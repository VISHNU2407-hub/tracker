/* Screenshot capture harness (dev-only, not shipped).
 * Emits the demo dataset in the exact localStorage layout the app reads,
 * so headless Chrome can be pointed at a seeded page for visual review.
 * Usage: npx esbuild scripts/seed-shot.ts --bundle --platform=node --outfile=scripts/.seed-shot.cjs --log-level=error && node scripts/.seed-shot.cjs <outDir>
 */
import { buildDemoData } from '../src/services/demoData';
import { addDays, todayISO } from '../src/services/date';
import type { AppData } from '../src/types';
import * as fs from 'node:fs';
import * as path from 'node:path';

const today = todayISO();

const base: AppData = {
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

const data = buildDemoData(base);

const payload = {
  'winterArc.settings': data.settings,
  'winterArc.tracks': data.tracks,
  'winterArc.activeTrackId': data.activeTrackId,
  'winterArc.arc': data.arc,
  'winterArc.habits': data.habits,
  'winterArc.rules': data.rules,
  'winterArc.dailyRecords': data.dailyRecords,
  'winterArc.reflections': data.reflections,
  'winterArc.version': data.version,
};

const outDir = process.argv[2] ?? '.shots';
fs.mkdirSync(outDir, { recursive: true });

const seedPath = path.join(outDir, 'seed.json');
fs.writeFileSync(seedPath, JSON.stringify(payload), 'utf8');

const seedHtml = `<!doctype html>
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

fs.writeFileSync(path.join(outDir, 'seed.html'), seedHtml, 'utf8');

console.log(`seed written: ${seedPath}`);
console.log(`arc: ${data.arc?.startDate} .. ${data.arc?.endDate} (${data.arc?.durationDays} days)`);
console.log(`today: ${today} · habits ${data.habits.length} · rules ${data.rules.length} · records ${Object.keys(data.dailyRecords).length}`);