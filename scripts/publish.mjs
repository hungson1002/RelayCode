import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const target = process.argv[2];
if (!['vscode', 'openvsx'].includes(target)) {
  console.error('Usage: node scripts/publish.mjs <vscode|openvsx>');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
const vsix = resolve(`${manifest.name}-${manifest.version}.vsix`);
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const packaged = spawnSync(npm, ['run', 'package'], { stdio: 'inherit' });
if (packaged.status !== 0) process.exit(packaged.status ?? 1);

const command = target === 'vscode'
  ? ['vsce', 'publish', '--packagePath', vsix, '--no-dependencies']
  : ['ovsx', 'publish', vsix];
const published = spawnSync(npx, command, { stdio: 'inherit' });
process.exit(published.status ?? 1);
