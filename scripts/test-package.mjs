import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cjs = require('@gnurub/agenda-nest');
const esm = await import('@gnurub/agenda-nest');

const expectedExports = [
  'AgendaModule',
  'AgendaQueue',
  'Define',
  'Every',
  'InjectQueue',
  'Now',
  'OnJobComplete',
  'OnJobFail',
  'OnJobStart',
  'OnJobSuccess',
  'OnQueueError',
  'OnQueueReady',
  'Queue',
  'Schedule',
];

for (const name of expectedExports) {
  assert.ok(name in cjs, `CommonJS build is missing export "${name}"`);
  assert.ok(name in esm, `ES module build is missing export "${name}"`);
}

assert.deepEqual(
  Object.keys(cjs).sort(),
  Object.keys(esm).sort(),
  'CommonJS and ES module builds expose different APIs',
);
