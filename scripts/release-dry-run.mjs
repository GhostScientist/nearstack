import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';

const rootDir = path.resolve(new URL('..', import.meta.url).pathname);
const root = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const packageNames = ['ai', 'cli', 'core', 'rag', 'react', 'rtc', 'svelte'];

execFileSync('node', [path.join(rootDir, 'scripts/release-check.mjs')], {
  cwd: rootDir,
  stdio: 'inherit',
});
execFileSync('pnpm', ['build'], { cwd: rootDir, stdio: 'inherit' });

const destination = fs.mkdtempSync(path.join(os.tmpdir(), 'nearstack-release-'));
try {
  for (const name of packageNames) {
    execFileSync('pnpm', ['pack', '--pack-destination', destination], {
      cwd: path.join(rootDir, 'packages', name),
      stdio: 'inherit',
    });
  }
  const artifacts = fs.readdirSync(destination).filter((file) => file.endsWith('.tgz'));
  if (artifacts.length !== packageNames.length) {
    throw new Error(`Expected ${packageNames.length} package archives, found ${artifacts.length}.`);
  }
  console.log(`Dry run validated ${artifacts.length} ${root.version} package archives.`);
  console.log('No registry credentials were read and nothing was published.');
} finally {
  fs.rmSync(destination, { recursive: true, force: true });
}
