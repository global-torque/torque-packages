import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

const packageDirectories = ['invest-core', 'invest-runtime'];

const nodeExportTargets = (exports) => Object.values(exports)
  .flatMap((target) => typeof target === 'object' && target !== null && 'node' in target ? [target.node] : [])
  .filter((target) => typeof target === 'string');

test('Git dependency archives contain every Node export target', async () => {
  for (const directory of packageDirectories) {
    const packageDirectory = join('packages', directory);
    const manifest = JSON.parse(await readFile(join(packageDirectory, 'package.json'), 'utf8'));

    for (const target of nodeExportTargets(manifest.exports)) {
      const repositoryPath = join(packageDirectory, target.replace(/^\.\//, ''));
      const trackedPath = execFileSync('git', ['ls-files', '--error-unmatch', repositoryPath], {
        encoding: 'utf8',
      }).trim();
      assert.equal(trackedPath, repositoryPath, `${manifest.name} Node export ${target} must be tracked for Git installs`);
    }
  }
});
