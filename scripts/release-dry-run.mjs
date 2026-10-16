import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const root = JSON.parse(
  fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')
);
const packageNames = ['ai', 'cli', 'core', 'rag', 'react', 'rtc', 'svelte'];

execFileSync('node', [path.join(rootDir, 'scripts/release-check.mjs')], {
  cwd: rootDir,
  stdio: 'inherit',
});
execFileSync('pnpm', ['build'], { cwd: rootDir, stdio: 'inherit' });

const destination = fs.mkdtempSync(
  path.join(os.tmpdir(), 'nearstack-release-')
);
try {
  for (const name of packageNames) {
    execFileSync('pnpm', ['pack', '--pack-destination', destination], {
      cwd: path.join(rootDir, 'packages', name),
      stdio: 'inherit',
    });
  }
  const artifacts = fs
    .readdirSync(destination)
    .filter((file) => file.endsWith('.tgz'));
  if (artifacts.length !== packageNames.length) {
    throw new Error(
      `Expected ${packageNames.length} package archives, found ${artifacts.length}.`
    );
  }
  for (const artifact of artifacts) {
    const archivePath = path.join(destination, artifact);
    const files = new Set(
      execFileSync('tar', ['-tzf', archivePath], { encoding: 'utf8' })
        .trim()
        .split('\n')
    );
    const manifest = JSON.parse(
      execFileSync('tar', ['-xOf', archivePath, 'package/package.json'], {
        encoding: 'utf8',
      })
    );
    const entrypoints = [manifest.main, manifest.module, manifest.types];
    const collectExports = (value) => {
      if (typeof value === 'string') entrypoints.push(value);
      else if (value && typeof value === 'object')
        Object.values(value).forEach(collectExports);
    };
    collectExports(manifest.exports);
    collectExports(manifest.bin);
    for (const entry of entrypoints.filter(Boolean)) {
      if (!files.has(`package/${entry.replace(/^\.\//, '')}`)) {
        throw new Error(
          `${manifest.name}: packed entrypoint is missing: ${entry}`
        );
      }
    }
    for (const dependencies of [
      manifest.dependencies,
      manifest.peerDependencies,
      manifest.optionalDependencies,
    ]) {
      for (const [name, version] of Object.entries(dependencies ?? {})) {
        if (/^(workspace:|file:|link:)/.test(version)) {
          throw new Error(
            `${manifest.name}: ${name} has a local dependency range: ${version}`
          );
        }
      }
    }
    if (
      [...files].some(
        (file) =>
          file.startsWith('package/dist/') &&
          /\/__tests__\/|\.(?:test|spec)\./.test(file)
      )
    ) {
      throw new Error(`${manifest.name}: archive contains compiled tests`);
    }
  }
  console.log(
    `Dry run validated ${artifacts.length} ${root.version} package archives.`
  );
  console.log('No registry credentials were read and nothing was published.');
} finally {
  fs.rmSync(destination, { recursive: true, force: true });
}
