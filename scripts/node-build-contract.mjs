import fs from 'node:fs';
import path from 'node:path';

export const nodeExportContracts = [
  {
    packageName: '@global-torque/invest-core',
    directory: 'packages/invest-core',
    entries: [
      { specifier: './app/config', source: './src/app/config.ts', node: './dist/node/app/config.js' },
      { specifier: './markdown/tableWrap', source: './src/markdown/tableWrap.ts', node: './dist/node/markdown/tableWrap.js' },
      { specifier: './helpers/text', source: './src/helpers/text.ts', node: './dist/node/helpers/text.js' },
    ],
  },
  {
    packageName: '@global-torque/invest-runtime',
    directory: 'packages/invest-runtime',
    entries: [
      { specifier: './pwa/pwaPolicy', source: './src/pwa/pwaPolicy.ts', node: './dist/node/pwa/pwaPolicy.js' },
    ],
  },
];

const contractByPackage = new Map(nodeExportContracts.map(contract => [contract.packageName, contract]));

export const expectedNodeFiles = nodeExportContracts.flatMap(contract => contract.entries.map(entry => (
  `${contract.directory}/${entry.node.slice(2)}`
)));

export const expectedNodeFilesForPackage = packageName => (
  (contractByPackage.get(packageName)?.entries ?? []).map(entry => entry.node.slice(2))
);

export function assertNodeExportContracts(manifest, packageName) {
  const contract = contractByPackage.get(packageName);
  if (!contract) return;

  const approvedSpecifiers = new Set(contract.entries.map(entry => entry.specifier));
  for (const entry of contract.entries) {
    const actual = manifest.exports?.[entry.specifier];
    if (!actual || typeof actual !== 'object' || Array.isArray(actual)) {
      throw new Error(`${packageName}${entry.specifier}: exact conditional Node export is missing`);
    }
    const keys = Object.keys(actual);
    if (JSON.stringify(keys) !== JSON.stringify(['types', 'node', 'default'])) {
      throw new Error(`${packageName}${entry.specifier}: conditions must be ordered types,node,default`);
    }
    if (actual.types !== entry.source || actual.node !== entry.node || actual.default !== entry.source) {
      throw new Error(`${packageName}${entry.specifier}: conditional export targets differ from the accepted contract`);
    }
    if (!manifest.files?.includes(entry.node.slice(2))) {
      throw new Error(`${packageName}: files must include ${entry.node.slice(2)}`);
    }
  }

  for (const [specifier, target] of Object.entries(manifest.exports ?? {})) {
    if (approvedSpecifiers.has(specifier)) continue;
    const targets = collectExportTargets(target);
    if (targets.some(value => !value.startsWith('./src/'))) {
      throw new Error(`${packageName}${specifier}: non-Node export targets must remain under ./src/`);
    }
  }
}

export function collectExportTargets(value, targets = []) {
  if (typeof value === 'string') targets.push(value);
  else if (Array.isArray(value)) value.forEach(entry => collectExportTargets(entry, targets));
  else if (value && typeof value === 'object') Object.values(value).forEach(entry => collectExportTargets(entry, targets));
  return targets;
}

export function assertNodeBuildInventory(root) {
  const missing = expectedNodeFiles.filter(file => !fs.existsSync(path.join(root, file)));
  if (missing.length) throw new Error(`Node build output is missing: ${missing.join(', ')}`);
  const actual = [];
  for (const contract of nodeExportContracts) {
    const directory = path.join(root, contract.directory, 'dist/node');
    if (!fs.existsSync(directory)) continue;
    const walk = current => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const file = path.join(current, entry.name);
        if (entry.isDirectory()) walk(file);
        else actual.push(path.relative(root, file).split(path.sep).join('/'));
      }
    };
    walk(directory);
  }
  const expected = [...expectedNodeFiles].sort();
  actual.sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Node build output must contain exactly four files; expected ${expected.join(', ')}, found ${actual.join(', ')}`);
  }
  for (const file of expectedNodeFiles) {
    if (!fs.statSync(path.join(root, file)).isFile()) throw new Error(`Node build output is not a regular file: ${file}`);
  }
}
