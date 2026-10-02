/* ============================================================
   Desktop persistence probe (dev-only, not shipped).

   Verifies the Electron shell serves the app from ONE stable
   origin across launches (lifesystem://app), so localStorage
   (winterArc.* data + lifeSystem.* flags) survives relaunch.
   The old random-loopback-port server changed the origin every
   start, which silently wiped the user's tracker data.

   Flow:
     launch 1 -> write a marker into localStorage -> close app
     launch 2 -> read the marker back (must match) -> clean up

   Usage:
     node scripts/desktop-persist.mjs
   ============================================================ */

import { spawn } from 'node:child_process';
import path from 'node:path';

const ELECTRON = path.join('node_modules', 'electron', 'dist', 'electron.exe');
const DEBUG_PORT = 9461;
const PROBE_KEY = 'lifeSystem.probe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0;
let fail = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`);
  if (ok) pass++; else fail++;
}

function launch() {
  const child = spawn(ELECTRON, ['.', `--remote-debugging-port=${DEBUG_PORT}`], {
    stdio: 'ignore',
    windowsHide: true,
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
    if (!page) await sleep(300);
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
  if (child.exitCode === null) child.kill(); // fallback if window.close() was refused
  const deadline2 = Date.now() + 5000;
  while (Date.now() < deadline2 && child.exitCode === null) await sleep(150);
}

let exitCode = 0;
try {
  // ---- launch 1: write a marker ----
  console.log('launch 1: writing the persistence marker...');
  const child1 = launch();
  const s1 = await attach();
  const origin1 = await s1.evl('location.origin');
  console.log(`  origin: ${origin1}  target: ${s1.url}`);
  const marker = JSON.stringify({ at: new Date().toISOString(), n: 42 });
  await s1.evl(`localStorage.setItem(${JSON.stringify(PROBE_KEY)}, ${JSON.stringify(marker)}); localStorage.setItem('winterArc.probe', 'kept'); 1`);
  const readback = await s1.evl(`localStorage.getItem(${JSON.stringify(PROBE_KEY)})`);
  check('marker written and readable in launch 1', readback === marker);
  s1.ws.close();
  await quit(child1, s1.ws);
  check('app closed after launch 1', child1.exitCode === 0 || child1.exitCode === null,
    `exit=${child1.exitCode}`);

  // ---- launch 2: read it back ----
  console.log('launch 2: reading the persistence marker...');
  const child2 = launch();
  const s2 = await attach();
  const origin2 = await s2.evl('location.origin');
  console.log(`  origin: ${origin2}  target: ${s2.url}`);
  const marker2 = await s2.evl(`localStorage.getItem(${JSON.stringify(PROBE_KEY)})`);
  const probe2 = await s2.evl(`localStorage.getItem('winterArc.probe')`);
  check('origin is identical across launches', origin1 === origin2 && /^lifesystem:\/\/app$/.test(String(origin1)),
    `${origin1} vs ${origin2}`);
  check('marker survives the relaunch (localStorage persists)', marker2 === marker);
  check('tracking-key side of storage persists too', probe2 === 'kept');
  await s2.evl(`localStorage.removeItem(${JSON.stringify(PROBE_KEY)}); localStorage.removeItem('winterArc.probe'); 1`);
  s2.ws.close();
  await quit(child2, s2.ws);
} catch (err) {
  console.error('probe crashed:', err.message);
  exitCode = 2;
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail || exitCode) exitCode = 1;
process.exit(exitCode);
