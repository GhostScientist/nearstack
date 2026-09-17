import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const requested = process.argv[2] ?? 'dist';
if (path.basename(requested) !== 'dist') {
  throw new Error('clean-dist only accepts a directory named dist.');
}

fs.rmSync(path.resolve(process.cwd(), requested), {
  recursive: true,
  force: true,
});
