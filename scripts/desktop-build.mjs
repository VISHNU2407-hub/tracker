#!/usr/bin/env node
/* ============================================================
   Desktop installer build.

   electron-builder unpacks Electron into "<out>.tmp" and then renames
   that folder into place. On machines with a workspace filesystem
   policy that denies renaming directories containing executables
   (reproducible here: copying electron's dist into ./release and
   renaming it fails with EPERM), that rename aborts the build.

   So: build into the OS temp directory, then copy the artifacts back
   into ./release — `npm run desktop:build` keeps working everywhere.
   ============================================================ */

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const builderPkg = path.dirname(require.resolve('electron-builder/package.json'));
const cli = path.join(builderPkg, 'cli.js');
const staging = path.join(os.tmpdir(), 'life-system-release');
const outDir = path.join(root, 'release');

fs.rmSync(staging, { recursive: true, force: true });
fs.mkdirSync(staging, { recursive: true });

console.log(`electron-builder → ${staging}`);
const res = spawnSync(
  process.execPath,
  [
    cli,
    '--config',
    path.join(root, 'electron-builder.yml'),
    `--config.directories.output=${staging}`,
  ],
  { stdio: 'inherit', cwd: root }
);
if (res.error) {
  console.error(res.error.message);
  process.exit(1);
}
if (res.status !== 0) process.exit(res.status ?? 1);

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
for (const entry of fs.readdirSync(staging)) {
  fs.cpSync(path.join(staging, entry), path.join(outDir, entry), { recursive: true });
}
fs.rmSync(staging, { recursive: true, force: true });

console.log('\nDesktop artifacts:');
for (const entry of fs.readdirSync(outDir)) {
  const stat = fs.statSync(path.join(outDir, entry));
  console.log(`  release/${entry}${stat.isFile() ? `  ${(stat.size / 1024 / 1024).toFixed(1)} MB` : ''}`);
}
