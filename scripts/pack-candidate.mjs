import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  assertNodeBuildInventory,
  assertNodeExportContracts,
  collectExportTargets,
  expectedNodeFilesForPackage,
} from './node-build-contract.mjs';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const candidate = process.argv.slice(2).find(argument => argument !== '--') ?? '0.4.12';
const reconciliation = JSON.parse(fs.readFileSync(path.join(root, 'docs/source-reconciliation.json'), 'utf8'));
if (candidate !== reconciliation.candidate) throw new Error(`Candidate ${candidate} is not the reviewed ${reconciliation.candidate}`);
const targetRepository = reconciliation.targetRepository;
const sourceRepository = reconciliation.sourceOwner;
const expectedPackageNames = new Set(reconciliation.packages.map(entry => entry.name));
const externalPackageNames = new Set(Object.keys(reconciliation.externalPackages ?? {}));
const dependencySections = ['dependencies', 'optionalDependencies', 'peerDependencies'];

const hash = (algorithm, bytes) => crypto.createHash(algorithm).update(bytes).digest('hex');

function assertPackedManifest(manifest, packageName) {
  if (manifest.private === true || manifest.name !== packageName || manifest.version !== candidate) {
    throw new Error(`Packed manifest identity mismatch: ${packageName}`);
  }
  assertNodeExportContracts(manifest, packageName);
  for (const section of dependencySections) {
    for (const [dependency, specifier] of Object.entries(manifest[section] ?? {})) {
      if (typeof specifier !== 'string' || /^(workspace:|file:|link:|catalog:)/u.test(specifier)) {
        throw new Error(`Unresolved ${section} entry ${packageName}:${dependency}`);
      }
      if (dependency.startsWith('@webdevelop-pro/')) throw new Error(`Forbidden old framework dependency ${packageName}:${dependency}`);
      if (dependency.startsWith('@global-torque/') && !expectedPackageNames.has(dependency) && !externalPackageNames.has(dependency)) throw new Error(`Unknown @global-torque dependency ${packageName}:${dependency}`);
    }
  }
}

const globToRegExp = (pattern) => new RegExp(`^${pattern
  .replace(/[.+^${}()|[\]\\]/gu, '\\$&')
  .replaceAll('**/', '(?:.*/)?')
  .replaceAll('**', '.*')
  .replaceAll('*', '[^/]*')}$`, 'u');

function isManifestPathAllowed(relative, manifest) {
  if (relative === 'package.json') return true;
  const builtIn = /^(?:README|readme|LICENSE|LICENCE|COPYING)(?:\.[^/]*)?$/u;
  if (builtIn.test(relative)) return true;
  return (manifest.files ?? []).some((entry) => {
    if (typeof entry !== 'string' || path.posix.isAbsolute(entry) || entry.split('/').includes('..')) return false;
    const normalized = entry.replace(/^\.\//u, '').replace(/\/$/u, '');
    if (!normalized) return false;
    if (normalized.includes('*')) return globToRegExp(normalized).test(relative);
    return relative === normalized || relative.startsWith(`${normalized}/`);
  });
}

function inspectPackedArchive(archive, manifest, packageName) {
  const archiveFiles = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split('\n').filter(Boolean).sort();
  const details = execFileSync('tar', ['-tvzf', archive], { encoding: 'utf8' });
  if (details.split('\n').some(line => /^[dhlpbc]/u.test(line))) throw new Error(`Archive contains a non-regular entry: ${packageName}`);
  if (archiveFiles.some(file => !file.startsWith('package/') || file.endsWith('/') || file.includes('\0'))) throw new Error(`Unsafe archive entry: ${packageName}`);
  const relativeFiles = archiveFiles.map(file => {
    const relative = file.slice('package/'.length);
    if (!relative || path.posix.isAbsolute(relative) || relative.split('/').includes('..') || path.posix.normalize(relative) !== relative) {
      throw new Error(`Unsafe archive path ${packageName}:${file}`);
    }
    if (!isManifestPathAllowed(relative, manifest)) throw new Error(`Archive file is outside the manifest allowlist ${packageName}:${relative}`);
    return relative;
  });
  if (new Set(relativeFiles).size !== relativeFiles.length) throw new Error(`Duplicate archive entry: ${packageName}`);
  const exportTargets = collectExportTargets(manifest.exports);
  const nodeTargets = new Set(expectedNodeFilesForPackage(packageName).map(file => `./${file}`));
  if (!manifest.exports || exportTargets.some(target => !target.startsWith('./src/') && !nodeTargets.has(target))) throw new Error(`Packed export target escapes source: ${packageName}`);
  for (const target of exportTargets) {
    const relativeTarget = target.slice(2);
    const prefix = `package/${relativeTarget.split('*')[0]}`;
    if (target.includes('*') ? !archiveFiles.some(file => file.startsWith(prefix)) : !archiveFiles.includes(`package/${relativeTarget}`)) {
      throw new Error(`Packed export target is absent ${packageName}:${target}`);
    }
  }
  return { archiveFiles, relativeFiles };
}

let repositoryRevision = null;
try {
  repositoryRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
} catch {
  // A local extracted workspace may not have a target-repository commit yet.
}
if (repositoryRevision && !/^[0-9a-f]{40}$/u.test(repositoryRevision)) throw new Error('Target repository revision is not a full commit');
let sourceDirty = true;
try {
  sourceDirty = Boolean(execFileSync('git', ['status', '--porcelain=v1'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim());
} catch {
  // No Git checkout is an unclean, non-promotable local source.
}
if (process.env.REQUIRE_CLEAN_SOURCE === 'true' && (sourceDirty || !repositoryRevision)) {
  throw new Error('A clean target-repository commit is required for this candidate workflow');
}
const output = path.resolve(process.env.CANDIDATE_OUTPUT_DIR ?? path.join(root, 'artifacts'));
if (fs.existsSync(output)) throw new Error('artifacts/ already exists; failed candidates must receive a new version');

for (const directory of ['packages/invest-core/dist/node', 'packages/invest-runtime/dist/node']) {
  fs.rmSync(path.join(root, directory), { recursive: true, force: true });
}
execFileSync('pnpm', ['run', 'build:node'], { cwd: root, stdio: 'inherit' });
assertNodeBuildInventory(root);
execFileSync('pnpm', ['run', 'check'], { cwd: root, stdio: 'inherit' });
assertNodeBuildInventory(root);

const browserReportPath = process.env.CSS_BROWSER_REPORT ? path.resolve(process.env.CSS_BROWSER_REPORT) : null;
if (!browserReportPath || !fs.existsSync(browserReportPath)) throw new Error('A successful Chromium CSS contract report is required for this candidate');
const browserReportBytes = fs.readFileSync(browserReportPath);
const browserReport = JSON.parse(browserReportBytes);
if (browserReport.schemaVersion !== 1 || browserReport.package !== '@global-torque/invest-shell' || browserReport.result !== 'pass') {
  throw new Error('Chromium CSS contract report is not a successful invest-shell report');
}

fs.mkdirSync(output, { recursive: true });
const browserContract = {
  schemaVersion: 1,
  package: browserReport.package,
  file: 'browser-contract-report.json',
  sha256: hash('sha256', browserReportBytes),
  result: browserReport.result,
  playwright: browserReport.playwright,
  chromium: browserReport.chromium,
};
fs.writeFileSync(path.join(output, browserContract.file), browserReportBytes, { mode: 0o600 });
const packages = [...reconciliation.packages].sort((a, b) => a.releaseOrder - b.releaseOrder);
const entries = [];
for (const entry of packages) {
  const directory = path.join(root, entry.directory);
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
  if (manifest.version !== candidate || manifest.name !== entry.name) throw new Error(`Manifest does not match receipt: ${entry.name}`);
  execFileSync('pnpm', ['pack', '--pack-destination', output], { cwd: directory, stdio: 'inherit' });
  const archive = path.join(output, `${entry.name.slice(1).replace('/', '-')}-${candidate}.tgz`);
  if (!fs.existsSync(archive)) throw new Error(`Expected archive missing: ${archive}`);
  const bytes = fs.readFileSync(archive);
  const sha512Hex = crypto.createHash('sha512').update(bytes).digest('hex');
  const integrity = `sha512-${crypto.createHash('sha512').update(bytes).digest('base64')}`;
  const packedManifest = JSON.parse(execFileSync('tar', ['-xOzf', archive, 'package/package.json'], { encoding: 'utf8' }));
  assertPackedManifest(packedManifest, entry.name);
  const { archiveFiles, relativeFiles: files } = inspectPackedArchive(archive, packedManifest, entry.name);
  const fileSha512 = Object.fromEntries(files.map((file, index) => [
    file,
    crypto.createHash('sha512').update(execFileSync('tar', ['-xOzf', archive, archiveFiles[index]], { maxBuffer: 64 * 1024 * 1024 })).digest('hex'),
  ]));
  const proof = {
    schemaVersion: 1,
    package: entry.name,
    version: candidate,
    sourceRepository: targetRepository,
    sourceRevision: repositoryRevision,
    sourceDirty,
    sourcePackageRepository: sourceRepository,
    sourcePackageRevision: reconciliation.sourceRevision,
    artifact: path.basename(archive),
    sha512: sha512Hex,
    integrity,
    files: fileSha512,
  };
  fs.writeFileSync(`${archive}.manifest.json`, `${JSON.stringify(proof, null, 2)}\n`);
  fs.writeFileSync(`${archive}.sha512`, `${sha512Hex}  ${path.basename(archive)}\n`);
  entries.push({ name: entry.name, version: candidate, directory: entry.directory, sourceRevision: repositoryRevision, sourceDirty, sourcePackageRepository: sourceRepository, sourcePackageRevision: reconciliation.sourceRevision, archive: path.basename(archive), sha512: sha512Hex, integrity, files, fileSha512 });
}
const lockfile = fs.existsSync(path.join(root, 'pnpm-lock.yaml')) ? crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'pnpm-lock.yaml'))).digest('hex') : null;
const lockText = fs.existsSync(path.join(root, 'pnpm-lock.yaml')) ? fs.readFileSync(path.join(root, 'pnpm-lock.yaml'), 'utf8') : '';
const uiRegistryIntegrity = lockText.match(/['"]?@global-torque\/ui-kit@0\.1\.4['"]?:\n\s+resolution: \{integrity: ([^,}]+)/u)?.[1] ?? null;
const uiKit = { mode: 'registry', package: '@global-torque/ui-kit', version: '0.1.4', integrity: uiRegistryIntegrity, lockfileSha256: lockfile };
const receipt = {
  schemaVersion: 1,
  candidate,
  sourceRepository: targetRepository,
  sourceRevision: repositoryRevision,
  sourceDirty,
  sourcePackageRepository: sourceRepository,
  sourcePackageRevision: reconciliation.sourceRevision,
  generatedAt: new Date().toISOString(),
  lockfileSha256: lockfile,
  uiKit,
  compatibilityMatrix: reconciliation.compatibilityMatrix,
  browserContract,
  packages: entries,
  dependencyOrder: packages.map(entry => entry.name),
  immutable: true,
  promotable: false,
};
fs.writeFileSync(path.join(output, 'candidate-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(`packed-candidate ${candidate} ${entries.length} packages`);
