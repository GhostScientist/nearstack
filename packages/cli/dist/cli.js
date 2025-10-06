#!/usr/bin/env node
import { scaffold } from './index.js';
import { blue, green } from 'kolorist';
const args = process.argv.slice(2);
const command = args[0];
if (command === 'create' || command === 'init') {
    const projectName = args[1];
    if (!projectName) {
        console.log('');
        console.log('Usage: nearstack create <project-name>');
        console.log('');
        console.log('Example:');
        console.log('  nearstack create my-app');
        process.exit(1);
    }
    scaffold(projectName);
}
else {
    console.log('');
    console.log(green('Welcome to Nearstack!'));
    console.log('');
    console.log('Nearstack is a local-first full-stack web framework');
    console.log('that makes the browser the backend.');
    console.log('');
    console.log('Usage:');
    console.log(`  ${blue('nearstack create <project-name>')}  - Create a new Nearstack app`);
    console.log(`  ${blue('nearstack init <project-name>')}    - Initialize a new Nearstack app`);
    console.log('');
}
//# sourceMappingURL=cli.js.map