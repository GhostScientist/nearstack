#!/usr/bin/env node

import { scaffold } from './index.js';
import { blue, green } from 'kolorist';

export async function runCli(
  args: string[] = process.argv.slice(2)
): Promise<number> {
  const command = args[0];

  if (command === 'create' || command === 'init') {
    const projectName = args[1];

    if (!projectName) {
      console.error('Usage: nearstack create <project-name>');
      return 1;
    }

    try {
      await scaffold(projectName);
      return 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Nearstack could not create the project: ${message}`);
      return 1;
    }
  }

  console.log('');
  console.log(green('Welcome to Nearstack!'));
  console.log('');
  console.log('Nearstack is a local-first full-stack web framework');
  console.log('that makes the browser the backend.');
  console.log('');
  console.log('Usage:');
  console.log(
    `  ${blue('nearstack create <project-name>')}  - Create a new Nearstack app`
  );
  console.log(
    `  ${blue('nearstack init <project-name>')}    - Initialize a new Nearstack app`
  );
  console.log('');
  return 0;
}

void runCli().then(
  (exitCode) => {
    process.exitCode = exitCode;
  },
  (error: unknown) => {
    console.error(
      `Nearstack could not create the project: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    process.exitCode = 1;
  }
);
