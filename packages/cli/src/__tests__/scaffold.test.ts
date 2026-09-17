import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { promptsMock } = vi.hoisted(() => ({
  promptsMock: vi.fn(),
}));

vi.mock('prompts', () => ({
  default: promptsMock,
}));

import {
  FRAMEWORK_CHOICES,
  ScaffoldError,
  resolveTarget,
  scaffold,
} from '../index';

describe('scaffold', () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nearstack-cli-'));
    process.chdir(tempDir);
    promptsMock.mockReset();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('exposes all supported framework choices', () => {
    expect(FRAMEWORK_CHOICES.map((choice) => choice.value)).toEqual([
      'react',
      'sveltekit',
      'vue',
      'angular',
    ]);
  });

  it.each(['../outside', '.', '/tmp/nearstack-absolute'])(
    'rejects unsafe target %s before prompting',
    async (projectName) => {
      await expect(scaffold(projectName)).rejects.toBeInstanceOf(ScaffoldError);
      expect(promptsMock).not.toHaveBeenCalled();
    }
  );

  it('rejects a symlink target that resolves outside cwd', async () => {
    const outsideDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'nearstack-outside-')
    );
    const sentinel = path.join(outsideDir, 'sentinel.txt');
    fs.writeFileSync(sentinel, 'keep me');
    fs.symlinkSync(outsideDir, path.join(tempDir, 'linked'), 'dir');

    await expect(scaffold('linked/new-app')).rejects.toThrow(/outside/i);
    expect(fs.readFileSync(sentinel, 'utf-8')).toBe('keep me');
    fs.rmSync(outsideDir, { recursive: true, force: true });
  });

  it('uses the final directory name for nested package names', async () => {
    promptsMock.mockResolvedValueOnce({ framework: 'react' });

    await scaffold('apps/my-app');

    const packageJson = JSON.parse(
      fs.readFileSync(path.join(tempDir, 'apps/my-app/package.json'), 'utf-8')
    );
    expect(packageJson.name).toBe('my-app');
  });

  it('leaves an existing target untouched when overwrite is cancelled', async () => {
    const target = path.join(tempDir, 'existing-app');
    fs.mkdirSync(target);
    const sentinel = path.join(target, 'sentinel.txt');
    fs.writeFileSync(sentinel, 'keep me');
    promptsMock.mockResolvedValueOnce({ overwrite: false });

    await expect(scaffold('existing-app')).rejects.toThrow(/cancelled/i);
    expect(fs.readFileSync(sentinel, 'utf-8')).toBe('keep me');
  });

  it('rejects malformed package names without touching the filesystem', async () => {
    expect(() => resolveTarget('apps/Bad Name')).toThrow(/package name/i);
    expect(promptsMock).not.toHaveBeenCalled();
  });

  for (const framework of ['react', 'sveltekit', 'vue', 'angular'] as const) {
    it(`scaffolds ${framework} with tailwind and notes+ai experience`, async () => {
      promptsMock.mockResolvedValueOnce({ framework });

      await scaffold(`${framework}-app`);

      const projectDir = path.join(tempDir, `${framework}-app`);
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(projectDir, 'package.json'), 'utf-8')
      );

      expect(packageJson.name).toBe(`${framework}-app`);
      expect(JSON.stringify(packageJson)).toContain('tailwindcss');

      const srcDir = path.join(projectDir, 'src');
      const sourceChunks: string[] = [];
      const stack = [srcDir];
      while (stack.length > 0) {
        const dir = stack.pop();
        if (!dir) continue;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            stack.push(fullPath);
            continue;
          }
          if (/\.(ts|tsx|vue|svelte|html)$/.test(entry.name)) {
            sourceChunks.push(fs.readFileSync(fullPath, 'utf-8').toLowerCase());
          }
        }
      }

      const source = sourceChunks.join('\n');
      expect(source).toContain('note');
      expect(source).toContain('ai');
      expect(source).toContain('systemprompt');
    });
  }
});
