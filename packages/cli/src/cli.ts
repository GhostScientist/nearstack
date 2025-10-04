#!/usr/bin/env node

import { scaffold } from './index.js';

const args = process.argv.slice(2);
const command = args[0];

if (command === 'create' || command === 'init') {
  const projectName = args[1] || 'my-nearstack-app';
  console.log(`Scaffolding new Nearstack app: ${projectName}`);
  scaffold(projectName);
} else {
  console.log('Welcome to Nearstack!');
  console.log('');
  console.log('Usage:');
  console.log('  nearstack create <project-name>  - Create a new Nearstack app');
  console.log('  nearstack init <project-name>    - Initialize a new Nearstack app');
}
