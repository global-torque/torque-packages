import fs from 'node:fs';
import path from 'node:path';
import { builtinModules } from 'node:module';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const reconciliation = JSON.parse(fs.readFileSync(path.join(root, 'docs/source-reconciliation.json'), 'utf8'));
const packages = fs.readdirSync(path.join(root, 'packages'), { withFileTypes: true }).filter(entry => entry.isDirectory());
const packageNames = new Set(packages.map(entry => JSON.parse(fs.readFileSync(path.join(root, 'packages', entry.name, 'package.json'), 'utf8')).name));
const externalPackageNames = new Set(Object.keys(reconciliation.externalPackages ?? {}));
const failures = [];
const bareImport = /(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'".][^'"]*)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/gu;

for (const directory of packages) {
  const packagePath = path.join(root, 'packages', directory.name);
  const manifest = JSON.parse(fs.readFileSync(path.join(packagePath, 'package.json'), 'utf8'));
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
  }
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('runtime-dependency-pass');
}
