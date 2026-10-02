/* ============================================================
   Install-flow test (dev-only, not shipped) — desktop E2E for
   the cross-platform first-launch spec.

   Simulates: complete setup on Web → download desktop app →
   install → launch (the passport file lands in the handoff
   folder, exactly like the web "Get the apps" button writes it).

   Covered here (Electron):
     flow 2  fresh install + passport → initialization screen →
             straight into the tracker (no welcome / onboarding)
     flow 4  relaunch → initialization screen → tracker, data intact
     flow 6  Reset All Data → welcome now; NEXT launch is a true
             first launch again (passport stays consumed)
   Web flow 1 (refresh → dashboard) is covered by
   scripts/first-run-flow.mjs.
   Android flows 3 & 5 cannot be compiled here (no JDK) — their
   logic is unit-tested in scripts/smoke.ts (apply/guard/token).

   An isolated --user-data-dir is used so the test never touches
   the real Electron profile.

   Usage:
     npm run build && node scripts/install-flow.mjs
   ============================================================ */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ELECTRON = path.join('node_modules', 'electron', 'dist', 'electron.exe');
const DEBUG_PORT = 9462;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'ls-install-flow-'));
const HANDOFF = path.join(ROOT, 'handoff');
const USERDATA = path.join(ROOT, 'userdata');
fs.mkdirSync(HANDOFF);
fs.mkdirSync(USERDATA);

let pass = 0;
let fail = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`);
  if (ok) pass++; else fail++;
}

/* ---- passport fixture (what the web build exports) ---- */
const iso = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString();
const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
const passport = {
  format: 'lifesystem-setup',
  v: 1,
  createdAt: iso(3),
  entry: { platform: 'web', at: iso(3) },
  setup: { at: iso(3) },
  data: {
    settings: { theme: 'dark', onboarded: true, demoMode: false },
    tracks: [
      {
        id: 'track_current', title: 'Winter Arc', description: 'A 90-day season.', icon: '❄️',
        startDate: day(-3), endDate: day(86), durationDays: 90,
        goal: 'Become consistent', why: 'Proof to myself',
        rules: [], status: 'active', createdAt: iso(3), updatedAt: iso(3),
      },
    ],
    activeTrackId: 'track_current',
    arc: {
      id: 'track_current', title: 'Winter Arc', description: 'A 90-day season.', icon: '❄️',
      startDate: day(-3), endDate: day(86),
      durationDays: 90, goal: 'Become consistent', why: 'Proof to myself',
      rules: [], status: 'active', createdAt: iso(3), updatedAt: iso(3),
    },
    habits: [
      { id: 'h1', name: 'Deep work', icon: 'clock', type: 'duration', target: 60, unit: 'min', active: true, createdAt: iso(3), order: 1 },
    ],
    rules: [],
    dailyRecords: {},
    reflections: [],
    version: 2,
  },
};
const PASSPORT_FILE = path.join(HANDOFF, 'lifesystem-setup.json');

/* ---- Electron + CDP ---- */
function launch() {
  const child = spawn(ELECTRON, ['.', `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${USERDATA}`], {
    stdio: 'ignore',
    windowsHide: true,
    env: { ...process.env, LIFESYSTEM_HANDOFF_DIR: HANDOFF },
  });
  child.on('error', (e) => { throw new Error('electron failed to start: ' + e.message); });
  return child;
}

async function attach() {
  const deadline = Date.now() + 30000;
  let page = null;
  while (Date.now() < deadline && !page) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
      page = list.find((t) => t.type === 'page' && /^lifesystem:|^http:\/\/127\.0\.0\.1/.test(t.url || ''));
    } catch { /* debugger not up yet */ }
    if (!page) await sleep(250);
  }
  if (!page) throw new Error('no renderer target appeared (30s)');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const pending = new Map();
  let seq = 0;
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) rej(new Error(m.error.message)); else res(m.result);
    }
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const id = ++seq;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('timeout ' + method)); } }, 15000);
  });
  const evl = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'evaluate failed');
    return r.result?.value;
  };
  return { ws, send, evl, url: page.url };
}

async function quit(child, ws) {
  try { ws?.send(JSON.stringify({ id: 9999, method: 'Runtime.evaluate', params: { expression: 'window.close()' } })); } catch { /* ignore */ }
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline && child.exitCode === null) await sleep(150);
  if (child.exitCode === null) child.kill();
  const deadline2 = Date.now() + 5000;
  while (Date.now() < deadline2 && child.exitCode === null) await sleep(150);
}

async function waitFor(evl, expr, timeout = 15000, interval = 120) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { if (await evl(expr)) return true; } catch { /* navigating/reloading */ }
    await sleep(interval);
  }
  return false;
}

/** Poll from the earliest moment: did the initialization screen appear? */
async function sawInitScreen(evl, bailExpr, maxMs = 4000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    try {
      if (await evl(`!!document.querySelector('.init-screen')`)) return true;
      if (bailExpr && (await evl(bailExpr))) return false; // already routed past it
    } catch { /* loading */ }
    await sleep(70);
  }
  return false;
}

const NO_SETUP_UI = `!!document.querySelector('.app-shell') && !document.querySelector('.intro') && !document.querySelector('.onboard-card')`;

let exitCode = 0;
try {
  fs.writeFileSync(PASSPORT_FILE, JSON.stringify(passport, null, 2));

  // ---- flow 2: first launch with a passport from the web build ----
  console.log('launch 1: fresh install + handoff from web...');
  const child1 = launch();
  const s1 = await attach();
  const init1 = await sawInitScreen(s1.evl, `!!document.querySelector('.app-shell')`);
  check('flow 2: initialization screen shown', init1);
  const inTracker1 = await waitFor(s1.evl, NO_SETUP_UI);
  check('flow 2: straight into the tracker (no welcome, no onboarding)', inTracker1);
  check('flow 2: setup flag imported',
    (await s1.evl(`!!localStorage.getItem('lifeSystem.setup')`)) === true);
  check('flow 2: dataset imported (habits carried over)',
    (await s1.evl(`JSON.parse(localStorage.getItem('winterArc.habits') || '[]').length`)) === 1);
  check('flow 2: entry record carried over',
    (await s1.evl(`JSON.parse(localStorage.getItem('lifeSystem.entry') || 'null')?.platform`)) === 'web');
  check('flow 2: inline handoff consumed after apply',
    (await s1.evl(`typeof window.__LIFESYSTEM_HANDOFF__`)) === 'undefined');
  check('flow 2: passport file consumed (imported once)',
    !fs.existsSync(PASSPORT_FILE) && fs.existsSync(`${PASSPORT_FILE}.imported`));
  s1.ws.close();
  await quit(child1, s1.ws);

  // ---- flow 4: relaunch ----
  console.log('launch 2: relaunch...');
  const child2 = launch();
  const s2 = await attach();
  const init2 = await sawInitScreen(s2.evl, `!!document.querySelector('.app-shell')`);
  check('flow 4: initialization screen on relaunch', init2);
  const inTracker2 = await waitFor(s2.evl, NO_SETUP_UI);
  check('flow 4: relaunch goes straight to the tracker', inTracker2);
  check('flow 4: data intact across relaunch',
    (await s2.evl(`JSON.parse(localStorage.getItem('winterArc.habits') || '[]').length`)) === 1 &&
    (await s2.evl(`!!localStorage.getItem('lifeSystem.setup')`)) === true);
  check('flow 4: no passport re-import (file already consumed)',
    !fs.existsSync(PASSPORT_FILE));

  // ---- flow 6: Reset All Data inside this session ----
  try {
    await s2.evl(`(function(){ location.hash='/settings'; location.reload(); return 1; })()`);
  } catch { /* context destroyed by reload */ }
  const onSettings = await waitFor(s2.evl, `!!document.querySelector('.danger-zone')`);
  check('flow 6: settings danger zone opens', onSettings);
  await s2.evl(`(function(){ document.querySelector('.danger-zone .btn-danger').click(); return 1; })()`);
  const modalOpen = await waitFor(s2.evl, `!!document.querySelector('.modal')`, 8000);
  check('flow 6: reset confirmation dialog opens', modalOpen);
  await s2.evl(`(function(){
    const input = document.querySelector('.modal input.input');
    if (!input) return 1;
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(input, 'RESET');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return 1;
  })()`);
  await sleep(250);
  await s2.evl(`(function(){ document.querySelector('.modal .btn-danger').click(); return 1; })()`);
  const welcomeAfterReset = await waitFor(s2.evl, `!!document.querySelector('.intro-platforms')`, 8000);
  check('flow 6: reset returns to the welcome screen', welcomeAfterReset);
  check('flow 6: entry + setup keys cleared by the reset',
    (await s2.evl(`!localStorage.getItem('lifeSystem.entry') && !localStorage.getItem('lifeSystem.setup')`)) === true);
  s2.ws.close();
  await quit(child2, s2.ws);

  // ---- flow 6: the NEXT launch is a true first launch ----
  console.log('launch 3: after reset...');
  const child3 = launch();
  const s3 = await attach();
  const welcomeAgain = await waitFor(s3.evl, `!!document.querySelector('.intro-platforms')`, 12000);
  check('flow 6: next launch shows welcome (reset stays reset)', welcomeAgain);
  // loadAppData() re-persists normalized defaults after a reset, so the arc
  // key comes back as the literal "null" — assert the real condition:
  // no setup flag, no entry, no arc data.
  const noResurrectData =
    (await s3.evl(`!localStorage.getItem('lifeSystem.setup') && !localStorage.getItem('lifeSystem.entry') && localStorage.getItem('winterArc.arc') === 'null'`)) === true;
  const noResurrectFile = !fs.existsSync(PASSPORT_FILE);
  check('flow 6: passport not resurrected', noResurrectData && noResurrectFile,
    `data=${noResurrectData} file=${noResurrectFile}`);
  s3.ws.close();
  await quit(child3, s3.ws);
} catch (err) {
  console.error('flow crashed:', err.message);
  exitCode = 2;
} finally {
  try { fs.rmSync(ROOT, { recursive: true, force: true }); } catch { /* ignore */ }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail || exitCode) exitCode = 1;
process.exit(exitCode);
