#!/usr/bin/env node
/* ============================================================
   Platform icon factory — one source, every platform.

   Source : public/icons/icon-512.svg (rounded app tile)
   Steps  : rasterise to a transparent 512px PNG (headless Chrome,
            falling back to the checked-in PNG), then derive
              build/icon.png        desktop / Linux target
              build/icon.ico        Windows installer (7 sizes)
              android mipmap icons  launcher, round, adaptive foreground
              android splash screens brand canvas + centred icon
   ============================================================ */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SVG = path.join(root, 'public', 'icons', 'icon-512.svg');
const FALLBACK_SRC = path.join(root, 'public', 'icons', 'icon-512.png');
const BUILD = path.join(root, 'build');
const TMP = path.join(BUILD, '.sizes');
const SOURCE = path.join(BUILD, 'source-512.png');

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];
const ANDROID = [
  ['mdpi', 48, 108],
  ['hdpi', 72, 162],
  ['xhdpi', 96, 216],
  ['xxhdpi', 144, 324],
  ['xxxhdpi', 192, 432],
];
const SPLASH_BG = '0xeef4fd';

function findChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const candidates =
    process.platform === 'win32'
      ? [
          path.join(process.env['PROGRAMFILES'] ?? '', 'Google', 'Chrome', 'application', 'chrome.exe'),
          path.join(process.env['PROGRAMFILES(X86)'] ?? '', 'Google', 'Chrome', 'application', 'chrome.exe'),
          path.join(process.env['LOCALAPPDATA'] ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        ]
      : process.platform === 'darwin'
        ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
        : ['/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'];
  return candidates.find((c) => c && fs.existsSync(c)) ?? null;
}

function rasterise(sourceSvg, outPng, size) {
  const chrome = findChrome();
  if (!chrome) return false;
  try {
    execFileSync(
      chrome,
      [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        `--screenshot=${outPng}`,
        `--window-size=${size},${size}`,
        '--default-background-color=00000000',
        pathToFileURL(sourceSvg).href,
      ],
      { stdio: 'pipe', timeout: 60000 }
    );
    return fs.existsSync(outPng);
  } catch {
    return false;
  }
}

function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

function scaleTo(src, out, size) {
  execFileSync(
    'ffmpeg',
    ['-y', '-loglevel', 'error', '-i', src, '-vf', `scale=${size}:${size}:flags=lanczos`, '-frames:v', '1', out],
    { stdio: 'pipe' }
  );
}

function splashTo(src, out, w, h) {
  const size = Math.max(64, Math.round(Math.min(w, h) * 0.24));
  execFileSync(
    'ffmpeg',
    [
      '-y', '-loglevel', 'error',
      '-f', 'lavfi',
      '-i', `color=c=${SPLASH_BG}:s=${w}x${h}`,
      '-i', src,
      '-filter_complex',
      `[1:v]scale=${size}:${size}:flags=lanczos[ic];[0:v][ic]overlay=(W-w)/2:(H-h)/2:format=auto`,
      '-frames:v', '1',
      out,
    ],
    { stdio: 'pipe' }
  );
}

function buildIco(files) {
  const entries = files.map(({ size, buf }) => ({ size, buf, byte: size >= 256 ? 0 : size }));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  const dir = [];
  let offset = 6 + entries.length * 16;
  for (const e of entries) {
    const row = Buffer.alloc(16);
    row.writeUInt8(e.byte, 0);
    row.writeUInt8(e.byte, 1);
    row.writeUInt8(0, 2);
    row.writeUInt8(0, 3);
    row.writeUInt16LE(1, 4);
    row.writeUInt16LE(32, 6);
    row.writeUInt32LE(e.buf.length, 8);
    row.writeUInt32LE(offset, 12);
    dir.push(row);
    offset += e.buf.length;
  }
  return Buffer.concat([header, ...dir, ...entries.map((e) => e.buf)]);
}

function main() {
  fs.mkdirSync(BUILD, { recursive: true });
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });

  let src = FALLBACK_SRC;
  if (fs.existsSync(SVG)) {
    const rasterised = rasterise(SVG, SOURCE, 512);
    if (rasterised) {
      src = SOURCE;
      console.log('source  build/source-512.png (SVG → transparent PNG)');
    } else {
      console.log('source  public/icons/icon-512.png (Chrome not available)');
    }
  }

  const png512 = path.join(BUILD, 'icon.png');
  scaleTo(src, png512, 512);
  console.log('desktop build/icon.png  512x512');

  const icoFiles = [];
  for (const size of ICO_SIZES) {
    const out = path.join(TMP, `ico-${size}.png`);
    scaleTo(src, out, size);
    icoFiles.push({ size, buf: fs.readFileSync(out) });
  }
  fs.writeFileSync(path.join(BUILD, 'icon.ico'), buildIco(icoFiles));
  console.log(`desktop build/icon.ico  ${ICO_SIZES.join(', ')}`);

  const resDir = path.join(root, 'android', 'app', 'src', 'main', 'res');
  if (fs.existsSync(resDir)) {
    for (const [density, launcher, foreground] of ANDROID) {
      const dir = path.join(resDir, `mipmap-${density}`);
      fs.mkdirSync(dir, { recursive: true });
      scaleTo(src, path.join(dir, 'ic_launcher.png'), launcher);
      fs.copyFileSync(path.join(dir, 'ic_launcher.png'), path.join(dir, 'ic_launcher_round.png'));
      scaleTo(src, path.join(dir, 'ic_launcher_foreground.png'), foreground);
      console.log(`android mipmap-${density}  ${launcher}px launcher + ${foreground}px adaptive foreground`);
    }

    const splashes = fs
      .readdirSync(resDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && (d.name === 'drawable' || d.name.startsWith('drawable-')))
      .map((d) => path.join(resDir, d.name, 'splash.png'))
      .filter((f) => fs.existsSync(f));
    for (const splash of splashes) {
      const { w, h } = pngSize(splash);
      splashTo(src, splash, w, h);
      console.log(`android ${path.basename(path.dirname(splash))}/splash.png  ${w}x${h} branded`);
    }
  } else {
    console.log('android/ not present — skipped launcher + splash icons');
  }

  fs.rmSync(TMP, { recursive: true, force: true });
}

main();
