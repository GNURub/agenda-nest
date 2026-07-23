import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'agenda-nest-package-'));
const consumerDirectory = join(temporaryDirectory, 'consumer');

try {
  execFileSync(
    'npm',
    ['pack', '--ignore-scripts', '--pack-destination', temporaryDirectory],
    { cwd: new URL('..', import.meta.url), stdio: 'pipe' },
  );

  const archive = readdirSync(temporaryDirectory).find((name) =>
    name.endsWith('.tgz'),
  );
  assert.ok(archive, 'npm pack did not create an archive');

  mkdirSync(consumerDirectory);
  writeFileSync(
    join(consumerDirectory, 'package.json'),
    JSON.stringify({ name: 'agenda-nest-package-consumer', private: true }),
  );
  execFileSync(
    'npm',
    [
      'install',
      '--ignore-scripts',
      '--no-package-lock',
      join(temporaryDirectory, archive),
    ],
    { cwd: consumerDirectory, stdio: 'pipe' },
  );

  const requireExports = execFileSync(
    'node',
    ['-e', "console.log(Object.keys(require('@gnurub/agenda-nest')).sort())"],
    { cwd: consumerDirectory, encoding: 'utf8' },
  );
  const importExports = execFileSync(
    'node',
    [
      '--input-type=module',
      '-e',
      "console.log(Object.keys(await import('@gnurub/agenda-nest')).sort())",
    ],
    { cwd: consumerDirectory, encoding: 'utf8' },
  );

  assert.equal(
    requireExports,
    importExports,
    'The installed CommonJS and ES module APIs differ',
  );
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
