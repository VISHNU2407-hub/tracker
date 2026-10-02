/* ============================================================
   Life System — desktop shell (Electron)

   The React app from dist/ is served over the PRIVATE custom
   scheme lifesystem://app — a fixed origin, so localStorage
   (winterArc.* tracking data + lifeSystem.* flags) survives
   every relaunch. An HTTP server on a random loopback port
   would change the origin every start and silently wipe the
   user's data. A loopback HTTP server is kept only as a
   fallback if the custom scheme cannot be registered.
   ============================================================ */

const { app, BrowserWindow, shell, protocol, net } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { pathToFileURL } = require('url');

const DIST = path.join(__dirname, '..', 'dist');
const SMOKE = process.argv.includes('--smoke');
const SCHEME = 'lifesystem';
const APP_URL = `${SCHEME}://app/index.html`;

/* ------------------------------------------------------------
   Setup passport handoff — the cross-platform first-launch fix.

   The web build writes lifesystem-setup.json (setup flags +
   winterArc.* dataset) into the handoff folder — Downloads by
   default, overridable for tests via LIFESYSTEM_HANDOFF_DIR.
   On first launch the newest passport is read, injected into
   index.html as window.__LIFESYSTEM_HANDOFF__ (applied by the
   renderer before React mounts) and CONSUMED (renamed), so a
   Reset All Data stays reset: the flags were cleared and the
   file is gone.
   ------------------------------------------------------------ */
const HANDOFF_DIR = process.env.LIFESYSTEM_HANDOFF_DIR || path.join(os.homedir(), 'Downloads');
let handoffCache = null;
let handoffRead = false;

function takeHandoff() {
  if (handoffRead) return handoffCache;
  handoffRead = true;
  try {
    const names = fs
      .readdirSync(HANDOFF_DIR)
      .filter((n) => /^lifesystem-setup.*\.json$/i.test(n))
      .map((n) => {
        try {
          return { n, t: fs.statSync(path.join(HANDOFF_DIR, n)).mtimeMs };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.t - a.t);
    for (const { n } of names) {
      const full = path.join(HANDOFF_DIR, n);
      try {
        const data = JSON.parse(fs.readFileSync(full, 'utf8'));
        if (data && data.format === 'lifesystem-setup') {
          fs.renameSync(full, `${full}.imported`); // consumed once
          handoffCache = data;
          return handoffCache;
        }
      } catch {
        /* fall through */
      }
      try {
        fs.renameSync(full, `${full}.rejected`); // don't retry every launch
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* no handoff folder / no passports — genuinely new install */
  }
  return null;
}

/** Read dist/index.html, injecting the pending setup passport (once). */
function readAppHtml(file) {
  const html = fs.readFileSync(file, 'utf8');
  const handoff = takeHandoff();
  if (!handoff) return html;
  const payload = JSON.stringify(handoff).replace(/</g, '\\u003c');
  const tag = `<script>window.__LIFESYSTEM_HANDOFF__=${payload};</script>`;
  return html.includes('</head>') ? html.replace('</head>', `${tag}</head>`) : tag + html;
}

// Must run before app ready: 'standard' + 'secure' give the scheme real
// origin semantics (localStorage, fetch, workers) like https:// has.
protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

/** Map a request pathname to a file inside dist/ (SPA fallback → index.html). */
function resolveFile(urlPath) {
  const rel = decodeURIComponent(urlPath).replace(/^[/\\]+/, '') || 'index.html';
  let file = path.normalize(path.join(DIST, rel));
  if (!file.startsWith(DIST)) return null;
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(DIST, 'index.html');
  }
  return file;
}

function serveDist() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const file = resolveFile((req.url || '/').split('?')[0]);
        if (!file) {
          res.writeHead(403, { 'Content-Type': 'text/plain' });
          res.end('Forbidden');
          return;
        }
        res.writeHead(200, {
          'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        if (path.basename(file) === 'index.html') {
          res.end(readAppHtml(file));
        } else {
          fs.createReadStream(file).pipe(res);
        }
      } catch {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server error');
      }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function missingBuildWindow() {
  const win = new BrowserWindow({
    width: 640,
    height: 300,
    resizable: false,
    backgroundColor: '#eef4fc',
    title: 'Life System',
    webPreferences: { sandbox: true },
  });
  const html = `<!doctype html><meta charset="utf-8"><title>Life System</title>
  <body style="margin:0;font:15px/1.6 system-ui,sans-serif;background:#eef4fd;color:#15223e;display:grid;place-items:center;height:100vh;text-align:center">
    <div><h1 style="font-size:18px">Build the app first</h1>
    <p style="color:#445575">Run <code>npm run build</code>, then launch again.</p></div></body>`;
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  return win;
}

let server;
let win;
let appUrl = APP_URL;

/** Serve dist/ over the fixed custom scheme (stable origin → data survives
 *  relaunch). Returns false if the scheme cannot be registered. */
function registerAppProtocol() {
  try {
    protocol.handle(SCHEME, async (request) => {
      const file = resolveFile(new URL(request.url).pathname);
      if (!file) {
        return new Response('Forbidden', { status: 403, headers: { 'Content-Type': 'text/plain' } });
      }
      const data =
        path.basename(file) === 'index.html'
          ? Buffer.from(readAppHtml(file), 'utf8')
          : await fs.promises.readFile(file);
      return new Response(data, {
        status: 200,
        headers: {
          'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
          'Cache-Control': 'no-store',
        },
      });
    });
    return true;
  } catch (e) {
    console.warn(`Life System: custom scheme failed (${e && e.message}) — using a loopback server instead.`);
    return false;
  }
}

async function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 620,
    backgroundColor: '#eef4fd',
    title: 'Life System',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  win.once('ready-to-show', () => win.show());

  win.webContents.setWindowOpenHandler(({ url: target }) => {
    shell.openExternal(target);
    return { action: 'deny' };
  });

  if (SMOKE) {
    win.webContents.on('did-finish-load', () => {
      console.log(`SMOKE: loaded ${appUrl}`);
      app.quit();
    });
    win.webContents.on('did-fail-load', (_e, code, desc) => {
      console.error(`SMOKE: load failed ${code} ${desc}`);
      process.exitCode = 1;
      app.quit();
    });
  }

  const useProtocol = registerAppProtocol();
  if (useProtocol) {
    appUrl = APP_URL;
    try {
      await win.loadURL(appUrl);
      return;
    } catch (e) {
      console.warn(`Life System: ${appUrl} failed to load (${e && e.message}) — falling back to a loopback server.`);
    }
  }
  // Fallback: random-port loopback server (origin changes per launch —
  // data will not persist, but at least the app runs).
  server = await serveDist();
  appUrl = `http://127.0.0.1:${server.address().port}/index.html`;
  await win.loadURL(appUrl);
}

app.whenReady().then(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    if (SMOKE) {
      console.error('SMOKE: dist/index.html missing — run npm run build first');
      process.exitCode = 1;
      app.quit();
      return;
    }
    missingBuildWindow();
    return;
  }

  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (server) server.close();
  app.quit();
});

app.on('before-quit', () => {
  if (server) server.close();
});
