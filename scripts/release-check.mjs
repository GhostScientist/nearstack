import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = path.resolve(new URL('..', import.meta.url).pathname);
const root = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const packageNames = ['ai', 'cli', 'core', 'rag', 'react', 'rtc', 'svelte'];
const failures = [];

if (!/^0\.2\.\d+$/.test(root.version)) {
  failures.push(`root version must be a coordinated 0.2.x version (got ${root.version})`);
}

for (const name of packageNames) {
  const packagePath = path.join(rootDir, 'packages', name, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  if (packageJson.version !== root.version) {
    failures.push(`${packageJson.name} is ${packageJson.version}; expected ${root.version}`);
  }
}

const templatesDir = path.join(rootDir, 'packages', 'cli', 'templates');
for (const entry of fs.readdirSync(templatesDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const packagePath = path.join(templatesDir, entry.name, 'package.json');
  if (!fs.existsSync(packagePath)) continue;
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  for (const [dependency, version] of Object.entries({
    '@nearstack-dev/ai': packageJson.dependencies?.['@nearstack-dev/ai'],
    '@nearstack-dev/core': packageJson.dependencies?.['@nearstack-dev/core'],
    '@nearstack-dev/react': packageJson.dependencies?.['@nearstack-dev/react'],
    '@nearstack-dev/svelte': packageJson.dependencies?.['@nearstack-dev/svelte'],
  })) {
    if (version !== undefined && version !== `^${root.version}`) {
      failures.push(`${entry.name} declares ${dependency} as ${version}; expected ^${root.version}`);
    }
  }
}

const react = JSON.parse(fs.readFileSync(path.join(rootDir, 'packages/react/package.json'), 'utf8'));
if (react.peerDependencies?.['@nearstack-dev/ai'] !== `^${root.version}`) {
  failures.push('react AI peer range is not aligned with the coordinated version');
}

if (failures.length > 0) {
  console.error('Release check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Release metadata is coherent for ${root.version}.`);
}
