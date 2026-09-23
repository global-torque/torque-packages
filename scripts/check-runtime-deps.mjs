import fs from 'node:fs';
import path from 'node:path';
import { builtinModules } from 'node:module';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const reconciliation = JSON.parse(fs.readFileSync(path.join(root, 'docs/source-reconciliation.json'), 'utf8'));
const packages = fs.readdirSync(path.join(root, 'packages'), { withFileTypes: true }).filter(entry => entry.isDirectory());
const manifests = new Map(packages.map(entry => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'packages', entry.name, 'package.json'), 'utf8'));
  return [manifest.name, { directory: entry.name, manifest }];
}));
const packageNames = new Set(manifests.keys());
const externalPackageNames = new Set(Object.keys(reconciliation.externalPackages ?? {}));
const shellName = '@global-torque/invest-shell';
const shellRuntimeDependencies = new Map([
  ['@global-torque/domain-types', 'domain-types'],
  ['@global-torque/invest-core', 'invest-core'],
  ['@global-torque/invest-runtime', 'invest-runtime'],
  ['@global-torque/invest-widgets', 'invest-widgets'],
]);
const failures = [];
const bareImport = /(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'".][^'"]*)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/gu;

const shellManifest = manifests.get(shellName)?.manifest;
if (!shellManifest) failures.push(`missing package manifest ${shellName}`);
for (const [dependency, directory] of shellRuntimeDependencies) {
  const target = manifests.get(dependency);
  if (!target) {
    failures.push(`${shellName}: missing workspace target ${dependency}`);
    continue;
  }
  const declared = shellManifest?.dependencies?.[dependency];
  if (declared !== target.manifest.version) {
    failures.push(`${shellName}: ${dependency} must declare exact ${target.manifest.version}, found ${declared ?? 'missing'}`);
  }
  if (!fs.existsSync(path.join(root, 'packages', directory))) failures.push(`${shellName}: missing workspace directory ${directory}`);
}
if (shellManifest) {
  const internalShellDependencies = Object.keys(shellManifest.dependencies ?? {}).filter(name => packageNames.has(name));
  for (const dependency of internalShellDependencies) {
    if (!shellRuntimeDependencies.has(dependency)) failures.push(`${shellName}: unexpected internal dependency ${dependency}`);
  }
}

const lockfilePath = path.join(root, 'pnpm-lock.yaml');
const lockfile = fs.existsSync(lockfilePath) ? fs.readFileSync(lockfilePath, 'utf8') : '';
const importerHeader = '  packages/invest-shell:\n';
const importerCount = [...lockfile.matchAll(/^  packages\/invest-shell:\n/gmu)].length;
const importerStart = lockfile.indexOf(importerHeader);
if (importerCount !== 1) {
  failures.push(`pnpm-lock.yaml: expected exactly one packages/invest-shell importer, found ${importerCount}`);
} else if (importerStart < 0) {
  failures.push('pnpm-lock.yaml: missing packages/invest-shell importer');
} else {
  const importerBodyStart = importerStart + importerHeader.length;
  const nextImporter = lockfile.slice(importerBodyStart).search(/^  \S/mu);
  const importerBody = nextImporter < 0
    ? lockfile.slice(importerBodyStart)
    : lockfile.slice(importerBodyStart, importerBodyStart + nextImporter);
  for (const [dependency, directory] of shellRuntimeDependencies) {
    const escapedDependency = dependency.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    const entryPattern = new RegExp(`^      '${escapedDependency}':\\n        specifier: ([^\\n]+)\\n        version: ([^\\n]+)$`, 'gmu');
    const entries = [...importerBody.matchAll(entryPattern)];
    const expectedVersion = manifests.get(dependency)?.manifest.version;
    if (entries.length !== 1) {
      failures.push(`pnpm-lock.yaml: ${shellName} importer must contain exactly one ${dependency} entry, found ${entries.length}`);
      continue;
    }
    const [, specifier, version] = entries[0];
    if (specifier !== expectedVersion) failures.push(`pnpm-lock.yaml: ${dependency} specifier must be ${expectedVersion}, found ${specifier}`);
    if (version !== `link:../${directory}`) failures.push(`pnpm-lock.yaml: ${dependency} must resolve to link:../${directory}, found ${version}`);
  }
}

for (const directory of packages) {
  const packagePath = path.join(root, 'packages', directory.name);
  const packageName = JSON.parse(fs.readFileSync(path.join(packagePath, 'package.json'), 'utf8')).name;
  const manifest = manifests.get(packageName).manifest;
  const runtimeDeclared = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
  ]);
  const sourceFiles = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.(ts|vue|js|mjs)$/u.test(entry.name)) sourceFiles.push(file);
    }
  };
  walk(path.join(packagePath, 'src'));
  for (const file of sourceFiles) {
    const relative = path.relative(packagePath, file).split(path.sep).join('/');
    if (relative.includes('/__tests__/') || /\.(?:test|spec)\.[cm]?[jt]s$/u.test(relative)) continue;
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(bareImport)) {
      const specifier = match[1] ?? match[2];
      const typeOnly = /^\s*(?:import|export)\s+type\b/u.test(match[0]);
      if (specifier.startsWith('.') || specifier.startsWith('/')) continue;
      const rootSpecifier = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
      if (builtinModules.includes(rootSpecifier) || rootSpecifier.startsWith('node:') || rootSpecifier === 'vite/client') continue;
      if (rootSpecifier === manifest.name) continue;
      if (specifier.startsWith('@webdevelop-pro/')) {
        failures.push(`${path.relative(root, file)}: forbidden old framework dependency ${specifier}`);
        continue;
      }
      const kind = typeOnly ? 'type dependency' : 'runtime dependency';
      if (packageNames.has(rootSpecifier) && !runtimeDeclared.has(rootSpecifier)) failures.push(`${path.relative(root, file)}: undeclared workspace dependency ${rootSpecifier}`);
      else if (!packageNames.has(rootSpecifier) && !runtimeDeclared.has(rootSpecifier)) failures.push(`${path.relative(root, file)}: undeclared ${kind} ${rootSpecifier}`);
    }
  }
  for (const [name, version] of Object.entries(manifest.dependencies ?? {})) {
    if (name.startsWith('@webdevelop-pro/')) failures.push(`${directory.name}: forbidden old framework dependency ${name}`);
    if (name.startsWith('@global-torque/') && !packageNames.has(name) && !externalPackageNames.has(name)) failures.push(`${directory.name}: unknown @global-torque dependency ${name}`);
    if (typeof version === 'string' && /^(workspace:|file:|link:|catalog:)/u.test(version) && !packageNames.has(name)) failures.push(`${directory.name}: external dependency ${name} uses ${version}`);
    if (packageNames.has(name) && !(directory.name === 'invest-shell' && shellRuntimeDependencies.has(name)) && typeof version === 'string' && /^(?:\^|~|>=|<=|>|<)?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u.test(version)) {
      failures.push(`${directory.name}: internal dependency ${name} uses ordinary semver ${version}; use workspace protocol`);
    }
  }
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('runtime-dependency-pass');
}
