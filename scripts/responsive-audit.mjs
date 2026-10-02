/* ============================================================
   Responsive layout audit (dev-only, not shipped).

   Drives one headless Chrome via the DevTools Protocol over every
   screen (intro, onboarding, all 8 pages, key modals) at the eight
   required widths, and reports:
     - page-level horizontal overflow
     - elements sticking out past the viewport (the real culprits;
       body { overflow-x: hidden } hides them from scrollWidth)
     - content clipped by overflow:hidden containers
     - bottom nav / touch-target sanity

   Usage:
     node scripts/responsive-audit.mjs [baseUrl]
   ============================================================ */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = (process.argv[2] || 'http://localhost:5199').replace(/\/$/, '');
const CHROME =
  process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const WIDTHS = [320, 360, 390, 430, 768, 1024, 1280, 1440];
const PAGES = ['dashboard', 'today', 'calendar', 'habits', 'stats', 'reflection', 'tracks', 'settings'];
const HEIGHT = 900;

const SEED = JSON.parse(fs.readFileSync(path.join(process.cwd(), '.shots', 'seed.json'), 'utf8'));

const ENTRY = JSON.stringify({ platform: 'web', at: new Date().toISOString() });
const SETUP = JSON.stringify({ at: new Date().toISOString() });

/** localStorage seeding per scenario, run right before every reload. */
const SEEDERS = {
  fresh: `localStorage.removeItem('lifeSystem.entry'); localStorage.removeItem('lifeSystem.setup');` +
    `['settings','tracks','activeTrackId','arc','habits','rules','dailyRecords','reflections','version']` +
    `.forEach(k=>localStorage.removeItem('winterArc.'+k));`,
  onboard: `localStorage.setItem('lifeSystem.entry', JSON.stringify(${ENTRY})); localStorage.removeItem('lifeSystem.setup');` +
    `['settings','tracks','activeTrackId','arc','habits','rules','dailyRecords','reflections','version']` +
    `.forEach(k=>localStorage.removeItem('winterArc.'+k));`,
  app: `Object.entries(${JSON.stringify(SEED)}).forEach(([k,v])=>localStorage.setItem(k,JSON.stringify(v)));` +
    `localStorage.setItem('lifeSystem.entry', JSON.stringify(${ENTRY})); localStorage.setItem('lifeSystem.setup', JSON.stringify(${SETUP}));`,
};

/** One audit case. */
const CASES = [];
for (const w of WIDTHS) {
  CASES.push({ id: `intro-${w}`, scenario: 'fresh', route: 'dashboard', w, ready: '.intro-platforms' });
  CASES.push({ id: `onboard-${w}`, scenario: 'onboard', route: 'dashboard', w, ready: '.onboard-card' });
  for (const page of PAGES) {
    CASES.push({ id: `${page}-${w}`, scenario: 'app', route: page, w, ready: '.app-shell' });
  }
}
// Modal overlays at phone widths.
CASES.push(
  { id: 'modal-intro-sheet-390', scenario: 'fresh', route: 'dashboard', w: 390, ready: '.intro-platforms',
    click: '.intro-platform .btn', clickReady: '.modal' },
  { id: 'modal-calendar-day-390', scenario: 'app', route: 'calendar', w: 390, ready: '.app-shell',
    preClick: '.segmented button:nth-child(3)', click: '.day-cell:not(.pad)', clickReady: '.modal' },
  { id: 'modal-calendar-day-320', scenario: 'app', route: 'calendar', w: 320, ready: '.app-shell',
    preClick: '.segmented button:nth-child(3)', click: '.day-cell:not(.pad)', clickReady: '.modal' },
  { id: 'modal-habit-form-390', scenario: 'app', route: 'habits', w: 390, ready: '.app-shell',
    click: '.page-header .btn-primary', clickReady: '.modal' },
  { id: 'modal-habit-form-320', scenario: 'app', route: 'habits', w: 320, ready: '.app-shell',
    click: '.page-header .btn-primary', clickReady: '.modal' },
  { id: 'modal-reset-confirm-390', scenario: 'app', route: 'settings', w: 390, ready: '.app-shell',
    click: '.danger-zone .btn-danger', clickReady: '.modal' },
  { id: 'more-sheet-390', scenario: 'app', route: 'dashboard', w: 390, ready: '.app-shell',
    click: '.bottom-nav-item:last-child', clickReady: '.sheet' },
  { id: 'more-sheet-320', scenario: 'app', route: 'dashboard', w: 320, ready: '.app-shell',
    click: '.bottom-nav-item:last-child', clickReady: '.sheet' },
  { id: 'modal-getapps-390', scenario: 'app', route: 'dashboard', w: 390, ready: '.app-shell',
    preClick: '.bottom-nav-item:last-child', click: '.sheet-item:last-child', clickReady: '.modal' },
  { id: 'modal-getapps-320', scenario: 'app', route: 'dashboard', w: 320, ready: '.app-shell',
    preClick: '.bottom-nav-item:last-child', click: '.sheet-item:last-child', clickReady: '.modal' },
);

/* ---------------- measurement, run inside the page ---------------- */

const MEASURE = `(() => {
  const de = document.documentElement;
  const vw = de.clientWidth;
  const out = {
    vw, scrollW: de.scrollWidth, bodyScrollW: document.body ? document.body.scrollWidth : 0,
    innerW: window.innerWidth,
    overflow: de.scrollWidth > vw + 1,
    viewportExpanded: window.innerWidth > vw + 1,
    offenders: [], clipped: [], nav: null,
  };

  const sel = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const cls = (el.getAttribute('class') || '').trim().split(/\\s+/).filter(Boolean).slice(0, 3);
    if (cls.length) s += '.' + cls.join('.');
    return s;
  };

  const inScroller = (el) => {
    let p = el.parentElement;
    while (p && p !== document.body) {
      const cs = getComputedStyle(p);
      if (/(auto|scroll)/.test(cs.overflowX)) return true;
      p = p.parentElement;
    }
    return false;
  };

  const all = document.body.querySelectorAll('*');
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed') continue;
    if (r.right > vw + 1 || r.left < -1) {
      if (inScroller(el)) continue;
      out.offenders.push({ sel: sel(el), right: Math.round(r.right), left: Math.round(r.left), w: Math.round(r.width) });
      continue;
    }
    // Content clipped by a non-scrollable overflow:hidden box (cut-off text).
    // Skipped: form controls (text scrolls inside on purpose), ellipsis
    // truncation (deliberate), and sr-only (always clipped on purpose).
    if (/(hidden|clip)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
      if (el.matches('.sr-only, input, textarea, select, [style*="ellipsis"]')) continue;
      if (cs.textOverflow === 'ellipsis') continue;
      out.clipped.push({ sel: sel(el), scrollW: el.scrollWidth, clientW: el.clientWidth });
    }
  }

  const nav = document.querySelector('.bottom-nav');
  if (nav && getComputedStyle(nav).display !== 'none') {
    const nr = nav.getBoundingClientRect();
    const items = [...nav.querySelectorAll('.bottom-nav-item')].map((b) => {
      const br = b.getBoundingClientRect();
      return { w: Math.round(br.width), h: Math.round(br.height) };
    });
    out.nav = { w: Math.round(nr.width), fits: nr.right <= vw + 1, items };
  }

  out.offenders = out.offenders.slice(0, 14);
  out.clipped = out.clipped.slice(0, 8);
  // Ground truth: which page is actually on screen (catches nav races).
  const topbar = document.querySelector('.topbar-page');
  out.top = topbar ? topbar.innerText.trim()
    : (document.querySelector('.intro') ? 'intro'
      : (document.querySelector('.onboard') ? 'onboard' : '?'));
  return out;
})()`;

/* ---------------- Chrome / CDP plumbing ---------------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function launchChrome() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'resp-audit-'));
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
        on(fn) {
          ws.addEventListener('message', (ev) => {
            const msg = JSON.parse(ev.data);
            if (msg.id && pending.has(msg.id)) {
              const { res, rej } = pending.get(msg.id);
              pending.delete(msg.id);
              msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
            } else if (msg.method) fn(msg);
          });
        },
        close() { ws.close(); },
      });
    });
    ws.addEventListener('error', reject);
  });
}

const waitFor = async (cdp, sessionId, expr, label, timeout = 15000) => {
  const probe = expr.startsWith('.') || expr.startsWith('#')
    ? `document.querySelector(${JSON.stringify(expr)})`
    : expr;
  const t0 = Date.now();
  for (;;) {
    try {
      const r = await cdp.send('Runtime.evaluate', { expression: `!!(${probe})`, returnByValue: true }, sessionId);
      if (r.result.value) return;
    } catch { /* context destroyed mid-reload — retry */ }
    if (Date.now() - t0 > timeout) throw new Error(`timeout waiting for ${label}`);
    await sleep(120);
  }
};

const evalJS = (cdp, sessionId, expression) =>
  cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: false }, sessionId).then((r) => {
    // In-page parse/runtime errors surface as exceptionDetails, not rejects.
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text || 'evaluate failed');
    }
    return r; // callers read r.result.value
  });

/* ---------------- run ---------------- */

const { child, profile, port } = await launchChrome();
const ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
const cdp = await connect(ver.webSocketDebuggerUrl);
cdp.on(() => {});

let exitCode = 0;
try {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });

  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }, sessionId);

  // Land on the app origin once so localStorage is reachable.
  await cdp.send('Page.navigate', { url: `${BASE}/#/dashboard` }, sessionId);
  await sleep(1500);
  // The "Get the apps" modal exports a passport file on click — deny
  // downloads so the audit never drops JSON files on the real machine.
  try { await cdp.send('Page.setDownloadBehavior', { behavior: 'deny' }, sessionId); } catch { /* older Chrome */ }

  const results = [];
  for (const c of CASES) {
    try {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: c.w, height: HEIGHT, deviceScaleFactor: 1, mobile: c.w <= 500,
      }, sessionId);

      try {
        await evalJS(cdp, sessionId, `(function(){ ${SEEDERS[c.scenario]} location.hash=${JSON.stringify('/' + c.route)}; location.reload(); return 1; })()`);
      } catch { /* context destroyed by reload — expected */ }

      await waitFor(cdp, sessionId, c.ready, `${c.id} ready`);

      if (c.preClick) {
        await evalJS(cdp, sessionId,
          `(function(){ const el = document.querySelector(${JSON.stringify(c.preClick)}); if (el) el.click(); return 1; })()`);
        await sleep(350);
      }

      if (c.click) {
        const clicked = await evalJS(cdp, sessionId,
          `(function(){ const el = document.querySelector(${JSON.stringify(c.click)}); if (!el) return false; el.click(); return true; })()`);
        if (clicked.result.value === false) {
          results.push({ id: c.id, error: 'click target missing: ' + c.click });
          console.log(`FAIL ${c.id.padEnd(28)} click target missing: ${c.click}`);
          exitCode = 1;
          continue;
        }
        await waitFor(cdp, sessionId, c.clickReady, `${c.id} modal`, 8000);
        await sleep(350);
      } else {
        await sleep(450); // settle charts/fonts/transforms
      }

      const m = await evalJS(cdp, sessionId, MEASURE);
      const data = m.result.value;

      const expectedTop =
        c.scenario === 'fresh' ? 'intro'
        : c.scenario === 'onboard' ? 'onboard'
        : c.route === 'dashboard' ? null // top bar shows the arc title here
        : { today: 'Today', calendar: 'Calendar', habits: 'Habits', stats: 'Stats',
            reflection: 'Reflection', tracks: 'My Tracks', settings: 'Settings' }[c.route];
      const topBad = expectedTop
        ? data.top !== expectedTop
        : data.top === 'intro' || data.top === 'onboard' || data.top === '?';

      results.push({ id: c.id, scenario: c.scenario, route: c.route, w: c.w, ...data, topBad });

      if (process.env.SHOTS) {
        // Headless capture can return a stale frame right after a route
        // change: give the compositor two frames, throw the first capture
        // away and keep the second one.
        await sleep(300);
        try { await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId); } catch { /* stale frame */ }
        await sleep(200);
        const shot = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
        fs.mkdirSync(path.join(process.cwd(), '.shots', 'resp'), { recursive: true });
        fs.writeFileSync(path.join(process.cwd(), '.shots', 'resp', `${c.id}.png`), Buffer.from(shot.data, 'base64'));
      }

      const bad = data.offenders.length > 0 || data.viewportExpanded || data.overflow || topBad;
      if (bad) exitCode = 1;
      const navBad = data.nav && !data.nav.fits;
      if (navBad) exitCode = 1;
      const flag = bad || navBad ? 'FAIL' : 'ok  ';
      console.log(
        `${flag} ${c.id.padEnd(28)} vw=${data.vw} scrollW=${data.scrollW} innerW=${data.innerW}` +
        ` offenders=${data.offenders.length} clipped=${data.clipped.length}` +
        ` top=${JSON.stringify(data.top)}` +
        (data.nav ? ` nav=${data.nav.w}${data.nav.fits ? '' : ' OVERFLOW'}` : '')
      );
      if (topBad) console.log(`       -> measured page is ${JSON.stringify(data.top)}, expected ${JSON.stringify(expectedTop)}`);
      if (bad) data.offenders.forEach((o) => console.log(`       -> ${o.sel} right=${o.right} left=${o.left} w=${o.w}`));
      if (navBad) console.log(`       -> bottom-nav width ${data.nav.w} > viewport ${data.vw}`);
    } catch (err) {
      results.push({ id: c.id, error: err.message });
      console.log(`FAIL ${c.id.padEnd(28)} ${err.message}`);
      exitCode = 1;
    }
  }

  fs.writeFileSync('.shots/responsive-audit.json', JSON.stringify(results, null, 2));

  // ------- summary -------
  const fails = results.filter((r) => r.error || r.offenders?.length || r.nav?.fits === false || r.viewportExpanded || r.overflow || r.topBad);
  console.log(`\n${results.length} cases, ${fails.length} with real overflow`);
  if (fails.length) {
    console.log('failing cases: ' + fails.map((f) => f.id).join(', '));
  }
  const clipped = results.filter((r) => r.clipped?.length);
  if (clipped.length) {
    console.log(`\nclipped content (overflow:hidden boxes whose content is cut): ${clipped.length} cases`);
    clipped.slice(0, 20).forEach((r) => {
      console.log(`  ${r.id}: ${r.clipped.map((c) => `${c.sel} ${c.clientW}->${c.scrollW}`).join('; ')}`);
    });
  }
  console.log('\nraw: .shots/responsive-audit.json');
} catch (err) {
  console.error('audit crashed:', err.message);
  exitCode = 2;
} finally {
  try { cdp.close(); } catch { /* ignore */ }
  child.kill();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
}
process.exit(exitCode);
