#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');
const trackedFiles = [
  path.join(root, 'src', 'main.js'),
  path.join(root, 'src', 'renderer', 'renderer.js'),
];

function sha256(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
  console.log('[LeetMusic] Cleared old dist folder');
}

for (const file of trackedFiles) {
  const rel = path.relative(root, file);
  const stat = fs.statSync(file);
  const hash = sha256(file);
  console.log(`[LeetMusic] Build input ${rel}`);
  console.log(`  mtime: ${stat.mtime.toISOString()}`);
  console.log(`  sha256: ${hash}`);
}

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const run = spawnSync(npmCmd, ['exec', 'electron-builder', '--', '--win', 'portable'], {
  cwd: root,
  stdio: 'inherit',
});

if (run.status !== 0) {
  process.exit(run.status || 1);
}
