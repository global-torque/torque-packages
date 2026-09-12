import fs from 'node:fs';
import path from 'node:path';
import { assertNodeExportContracts, collectExportTargets } from './node-build-contract.mjs';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const packages = fs.readdirSync(path.join(root, 'packages'), { withFileTypes: true }).filter(entry => entry.isDirectory());
const failures = [];
for (const entry of packages) {
  const directory = path.join(root, 'packages', entry.name);
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
  if (manifest.private || manifest.version !== '0.2.0' || manifest.license !== 'MIT') failures.push(`${entry.name}: public MIT 0.2.0 metadata missing`);
  for (const required of ['src', 'README.md', 'LICENSE', 'NOTICE.md', 'CHANGELOG.md', 'SECURITY.md', 'SUPPORT.md']) {
    if (!manifest.files?.includes(required)) failures.push(`${entry.name}: files must include ${required}`);
    if (required === 'src' && !fs.existsSync(path.join(directory, required))) failures.push(`${entry.name}: missing ${required}`);
  }
  if (!manifest.exports || !manifest.exports['.']) failures.push(`${entry.name}: explicit root export missing`);
  try {
    assertNodeExportContracts(manifest, manifest.name);
  } catch (error) {
    failures.push(error.message);
  }
  for (const [specifier, target] of Object.entries(manifest.exports ?? {})) {
    const targets = collectExportTargets(target);
    const nodeTargets = new Set(
      (manifest.name === '@webdevelop-pro/invest-core'
        ? ['./dist/node/app/config.js', './dist/node/markdown/tableWrap.js', './dist/node/helpers/text.js']
        : manifest.name === '@webdevelop-pro/invest-runtime' ? ['./dist/node/pwa/pwaPolicy.js'] : []),
    );
    if (targets.some(value => !value.startsWith('./src/') && !nodeTargets.has(value))) {
      failures.push(`${entry.name}${specifier}: export is not a supported source or exact Node entry`);
    }
  }
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`packlist-contract-pass ${packages.length} packages`);
}
