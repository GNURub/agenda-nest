import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const esmDir = resolve('dist/esm');
const cjsDir = resolve('dist/cjs');

await mkdir(esmDir, { recursive: true });
await mkdir(cjsDir, { recursive: true });

await writeFile(
  resolve(esmDir, 'package.json'),
  JSON.stringify({ type: 'module' }, null, 2) + '\n',
  'utf8',
);

await writeFile(
  resolve(cjsDir, 'package.json'),
  JSON.stringify({ type: 'commonjs' }, null, 2) + '\n',
  'utf8',
);
