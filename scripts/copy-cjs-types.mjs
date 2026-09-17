import fs from 'node:fs';
import process from 'node:process';

const files = process.argv.slice(2);
if (files.length % 2 !== 0) {
  throw new Error('copy-cjs-types expects source/destination pairs.');
}

for (let index = 0; index < files.length; index += 2) {
  fs.copyFileSync(files[index], files[index + 1]);
}
