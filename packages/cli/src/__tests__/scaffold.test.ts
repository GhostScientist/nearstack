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

import { FRAMEWORK_CHOICES, scaffold } from '../index';

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

  for (const framework of ['react', 'sveltekit', 'vue', 'angular'] as const) {
    it(`scaffolds ${framework} with tailwind and todo+ai experience`, async () => {
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
      expect(source).toContain('todo');
      expect(source).toContain('ai');
      expect(source).toContain('systemprompt');
    });
  }
});
