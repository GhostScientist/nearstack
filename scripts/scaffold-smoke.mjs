import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(new URL('..', import.meta.url).pathname);
const packageNames = ['ai', 'cli', 'core', 'rag', 'react', 'rtc', 'svelte'];

execFileSync('pnpm', ['build'], { cwd: rootDir, stdio: 'inherit' });
const { FRAMEWORK_CHOICES, scaffold } = await import(
  pathToFileURL(path.join(rootDir, 'packages/cli/dist/index.js')).href
);
const expectedFrameworks =
  process.env.NEARSTACK_FRAMEWORKS?.split(',').filter(Boolean);
const availableFrameworks = FRAMEWORK_CHOICES.map(({ value }) => value);
if (
  expectedFrameworks &&
  (expectedFrameworks.length !== availableFrameworks.length ||
    expectedFrameworks.some(
      (framework) => !availableFrameworks.includes(framework)
    ))
) {
  throw new Error(
    `Framework matrix is stale. Choices: ${availableFrameworks.join(', ')}`
  );
}
const selectedFramework = process.env.NEARSTACK_FRAMEWORK;
const choicesToRun = FRAMEWORK_CHOICES.filter(
  ({ value }) => !selectedFramework || value === selectedFramework
);
if (selectedFramework && choicesToRun.length === 0) {
  throw new Error(`Unknown scaffold framework: ${selectedFramework}`);
}
const destination = fs.mkdtempSync(
  path.join(os.tmpdir(), 'nearstack-scaffolds-')
);
const archives = fs.mkdtempSync(path.join(os.tmpdir(), 'nearstack-packs-'));
const originalCwd = process.cwd();

try {
  const archivePaths = new Map();
  for (const name of packageNames) {
    const before = new Set(fs.readdirSync(archives));
    execFileSync('pnpm', ['pack', '--pack-destination', archives], {
      cwd: path.join(rootDir, 'packages', name),
      stdio: 'inherit',
    });
    const archive = fs
      .readdirSync(archives)
      .find((file) => file.endsWith('.tgz') && !before.has(file));
    if (!archive) throw new Error(`No archive was produced for ${name}.`);
    archivePaths.set(name, path.join(archives, archive));
  }

  const overrides = Object.fromEntries(
    packageNames.map((name) => [
      `@nearstack-dev/${name}`,
      `file:${archivePaths.get(name)}`,
    ])
  );

  for (const { value: framework } of choicesToRun) {
    const frameworkRoot = path.join(destination, framework);
    const appDir = path.join(frameworkRoot, `${framework}-app`);
    fs.mkdirSync(frameworkRoot, { recursive: true });
    process.chdir(frameworkRoot);
    await scaffold(`${framework}-app`, { framework });

    const packagePath = path.join(appDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    packageJson.pnpm = { ...(packageJson.pnpm ?? {}), overrides };
    fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

    execFileSync(
      'pnpm',
      [
        'install',
        '--no-frozen-lockfile',
        '--registry=https://registry.npmjs.org',
      ],
      {
        cwd: appDir,
        stdio: 'inherit',
        timeout: framework === 'angular' ? 600_000 : 300_000,
      }
    );
    execFileSync('pnpm', ['run', 'build'], {
      cwd: appDir,
      stdio: 'inherit',
      timeout: framework === 'angular' ? 600_000 : 300_000,
    });
    console.log(`Scaffold smoke passed: ${framework}`);
  }
} finally {
  process.chdir(originalCwd);
  fs.rmSync(destination, { recursive: true, force: true });
  fs.rmSync(archives, { recursive: true, force: true });
}
