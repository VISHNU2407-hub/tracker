/* ============================================================
   First-run flow check (dev-only, not shipped).

   Drives one headless Chrome through the real product flow:
     fresh profile -> welcome -> platform -> onboarding -> tracker
     relaunch      -> straight to the tracker (no welcome, no wizard)
     replay entry  -> welcome only, wizard stays done
     Reset All Data -> back to a true first launch
   Also asserts the lifeSystem.setup flag is written once and
   stays independent of the winterArc.* tracking keys.

   Usage:
     node scripts/first-run-flow.mjs [baseUrl]
   ============================================================ */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = (process.argv[2] || 'http://localhost:5199').replace(/\/$/, '');
const CHROME =
  process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0;
let fail = 0;
function check(name, ok) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  if (ok) pass++; else fail++;
  return ok;
}

function launchChrome() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'flow-'));
  const child = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--no-default-browser-check', '--force-prefers-reduced-motion',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--remote-allow-origins=*', 'about:blank',
  ], { stdio: 'ignore', windowsHide: true });
  const portFile = path.join(profile, 'DevToolsActivePort');
  const deadline = Date.now() + 20000;
  return new Promise((resolve, reject) => {
    const tick = () => {
      try {
        if (fs.existsSync(portFile)) {
          const port = parseInt(fs.readFileSync(portFile, 'utf8').split('\n')[0], 10);
          if (port > 0) return resolve({ child, profile, port });
        }
      } catch { /* retry */ }
      if (Date.now() > deadline) return reject(new Error('chrome did not start'));
      setTimeout(tick, 200);
    };
    tick();
  });
}

function connect(url) {
  const ws = new WebSocket(url);
  const pending = new Map();
  let seq = 0;
  return new Promise((resolve, reject) => {
    ws.addEventListener('open', () => {
      ws.addEventListener('message', (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.id && pending.has(msg.id)) {
          const { res, rej } = pending.get(msg.id);
          pending.delete(msg.id);
          if (msg.error) rej(new Error(msg.error.message)); else res(msg.result);
        }
      });
      resolve({
        send(method, params = {}, sessionId) {
          return new Promise((res, rej) => {
            const id = ++seq;
            pending.set(id, { res, rej });
            ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
            setTimeout(() => {
              if (pending.has(id)) { pending.delete(id); rej(new Error('timeout: ' + method)); }
            }, 30000);
          });
        },
        close() { ws.close(); },
      });
    });
    ws.addEventListener('error', reject);
  });
}

const evalJS = (cdp, sessionId, expression) =>
  cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: false }, sessionId)
    .then((r) => {
      // Surface in-page parse/runtime errors instead of resolving undefined.
      if (r.exceptionDetails) {
        throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text || 'evaluate failed');
      }
      return r.result && r.result.value;
    });

const waitFor = async (cdp, sessionId, expr, timeout = 12000) => {
  // Selector-style expressions ('.cls' / '#id') become querySelector probes.
  const probe = expr.startsWith('.') || expr.startsWith('#')
    ? `document.querySelector(${JSON.stringify(expr)})`
    : expr;
  const t0 = Date.now();
  for (;;) {
    try {
      const v = await evalJS(cdp, sessionId, `!!(${probe})`);
      if (v) return true;
    } catch { /* reload in flight */ }
    if (Date.now() - t0 > timeout) return false;
    await sleep(120);
  }
};

const reload = async (cdp, sessionId, seed = '') => {
  try {
    await evalJS(cdp, sessionId, `(function(){ ${seed} location.hash='/dashboard'; location.reload(); return 1; })()`);
  } catch { /* context destroyed by the reload -- expected */ }
  // Wait until a fresh document on the app origin is reachable again.
  for (let i = 0; i < 60; i++) {
    try {
      if (await evalJS(cdp, sessionId, `location.href.startsWith(${JSON.stringify(BASE)})`)) break;
    } catch { /* navigation in flight */ }
    await sleep(100);
  }
  await sleep(700);
};

const diag = async (cdp, sessionId, label) => {
  try {
    const state = await evalJS(cdp, sessionId, `JSON.stringify({
      href: location.href,
      intro: !!document.querySelector('.intro-platforms'),
      onboard: !!document.querySelector('.onboard-card'),
      shell: !!document.querySelector('.app-shell'),
      entry: localStorage.getItem('lifeSystem.entry'),
      setup: localStorage.getItem('lifeSystem.setup'),
      text: document.body.innerText.slice(0, 80),
    })`);
    console.log(`      [${label}] ${state}`);
  } catch (e) {
    console.log(`      [${label}] diag failed: ${e.message}`);
  }
};

const WINTER_KEYS = `['settings','tracks','activeTrackId','arc','habits','rules','dailyRecords','reflections','version']`;
const CLEAR_ALL = `${WINTER_KEYS}.forEach(k=>localStorage.removeItem('winterArc.'+k));` +
  `localStorage.removeItem('lifeSystem.entry'); localStorage.removeItem('lifeSystem.setup');`;
const CLEAR_ENTRY_ONLY = `localStorage.removeItem('lifeSystem.entry');`;

/* ---------------- run ---------------- */

const { child, profile, port } = await launchChrome();
const ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
const cdp = await connect(ver.webSocketDebuggerUrl);

let exitCode = 0;
try {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);

  // Land on the app origin once so localStorage applies to it.
  await cdp.send('Page.navigate', { url: `${BASE}/#/dashboard` }, sessionId);
  await sleep(3000);

  // 1 -- fresh profile -> welcome screen
  await reload(cdp, sessionId, CLEAR_ALL);
  const gotIntro = await waitFor(cdp, sessionId, '.intro-platforms');
  check('fresh profile shows the welcome screen', gotIntro);
  if (!gotIntro) await diag(cdp, sessionId, 'step1');
  check('fresh profile has no entry/setup keys',
    (await evalJS(cdp, sessionId,
      `!localStorage.getItem('lifeSystem.entry') && !localStorage.getItem('lifeSystem.setup')`)) === true);

  // 2 -- walk in -> setup wizard runs (first launch only)
  await evalJS(cdp, sessionId, `(function(){ document.querySelector('.intro-top .btn-ghost').click(); return 1; })()`);
  const gotWiz = await waitFor(cdp, sessionId, '.onboard-card');
  check('walking in -> setup wizard (first run)', gotWiz);
  if (!gotWiz) await diag(cdp, sessionId, 'step2');
  check('entry recorded for the walk-in',
    (await evalJS(cdp, sessionId, `(JSON.parse(localStorage.getItem('lifeSystem.entry')||'{}')).platform`)) === 'web');
  check('wizard not yet marked complete',
    (await evalJS(cdp, sessionId, `!localStorage.getItem('lifeSystem.setup')`)) === true);

  // 3 -- click through the wizard (fills the required goal when it blocks)
  let opened = false;
  for (let i = 0; i < 20; i++) {
    if (await evalJS(cdp, sessionId, `!!document.querySelector('.app-shell')`)) { opened = true; break; }
    await evalJS(cdp, sessionId, `(function(){
      const goal = document.querySelector('#ob-goal');
      if (goal && !goal.value) {
        const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        set.call(goal, 'Be a person who keeps promises');
        goal.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const btn = [...document.querySelectorAll('.onboard-actions .btn-primary')].find(b => !b.disabled);
      if (btn) btn.click();
      return 1;
    })()`);
    await sleep(420);
  }
  check('wizard finishes into the tracker', opened);
  if (!opened) await diag(cdp, sessionId, 'step3');
  check('permanent setup flag written once onboarding completes',
    ((await evalJS(cdp, sessionId, `(JSON.parse(localStorage.getItem('lifeSystem.setup')||'null')||{}).at || ''`)) || '').length > 0);
  check('winterArc.settings marked onboarded',
    (await evalJS(cdp, sessionId, `(JSON.parse(localStorage.getItem('winterArc.settings')||'null')||{}).onboarded === true`)) === true);

  // 4 -- relaunch (same profile) -> straight back into the tracker
  await reload(cdp, sessionId);
  const back = await waitFor(cdp, sessionId, '.app-shell', 8000);
  check('relaunch: tracker opens directly', back);
  if (!back) await diag(cdp, sessionId, 'step4');
  check('relaunch: welcome screen does NOT reappear',
    (await evalJS(cdp, sessionId, `!document.querySelector('.intro-platforms')`)) === true);
  check('relaunch: setup wizard does NOT reappear',
    (await evalJS(cdp, sessionId, `!document.querySelector('.onboard-card')`)) === true);

  // 5 -- Settings "Replay welcome screen" (clears entry only)
  await reload(cdp, sessionId, CLEAR_ENTRY_ONLY);
  const replayIntro = await waitFor(cdp, sessionId, '.intro-platforms', 8000);
  check('replay: clearing the entry brings the welcome screen back', replayIntro);
  if (!replayIntro) await diag(cdp, sessionId, 'step5');
  check('replay: setup flag survives the replay',
    (await evalJS(cdp, sessionId, `!!localStorage.getItem('lifeSystem.setup')`)) === true);
  await evalJS(cdp, sessionId, `(function(){ document.querySelector('.intro-top .btn-ghost').click(); return 1; })()`);
  await sleep(600);
  check('replay: entering again skips the wizard (setup already done)',
    (await evalJS(cdp, sessionId, `!!document.querySelector('.app-shell') && !document.querySelector('.onboard-card')`)) === true);

  // 6 -- Settings -> Reset All Data -> true first launch again
  await reload(cdp, sessionId);
  try {
    await evalJS(cdp, sessionId, `(function(){ location.hash='/settings'; location.reload(); return 1; })()`);
  } catch { /* context destroyed */ }
  await sleep(900);
  const onSettings = await waitFor(cdp, sessionId, '.danger-zone');
  check('reset: settings page opens', onSettings);
  if (!onSettings) await diag(cdp, sessionId, 'step6');
  await evalJS(cdp, sessionId, `(function(){ document.querySelector('.danger-zone .btn-danger').click(); return 1; })()`);
  const modalOpen = await waitFor(cdp, sessionId, '.modal');
  check('reset: confirmation dialog opens', modalOpen);
  await evalJS(cdp, sessionId, `(function(){
    const input = document.querySelector('.modal input.input');
    if (!input) return 1;
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(input, 'RESET');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return 1;
  })()`);
  await sleep(250);
  await evalJS(cdp, sessionId, `(function(){ document.querySelector('.modal .btn-danger').click(); return 1; })()`);
  await sleep(1200);
  const firstAgain = await waitFor(cdp, sessionId, '.intro-platforms', 8000);
  check('reset: back to a true first launch (welcome screen)', firstAgain);
  if (!firstAgain) await diag(cdp, sessionId, 'step6b');
  check('reset: entry + setup keys cleared',
    (await evalJS(cdp, sessionId,
      `!localStorage.getItem('lifeSystem.entry') && !localStorage.getItem('lifeSystem.setup')`)) === true);
} catch (err) {
  console.error('flow crashed:', err.message);
  exitCode = 2;
} finally {
  try { cdp.close(); } catch { /* ignore */ }
  child.kill();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail || exitCode) exitCode = 1;
process.exit(exitCode);
