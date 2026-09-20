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
const candidate = process.argv.slice(2).find(argument => argument !== '--') ?? '0.4.1';
const reconciliation = JSON.parse(fs.readFileSync(path.join(root, 'docs/source-reconciliation.json'), 'utf8'));
if (candidate !== reconciliation.candidate) throw new Error(`Candidate ${candidate} is not the reviewed ${reconciliation.candidate}`);
const targetRepository = reconciliation.targetRepository;
const sourceRepository = reconciliation.sourceOwner;
const expectedPackageNames = new Set(reconciliation.packages.map(entry => entry.name));
const externalPackageNames = new Set(Object.keys(reconciliation.externalPackages ?? {}));
const dependencySections = ['dependencies', 'optionalDependencies', 'peerDependencies'];
const expectedOverlayFiles = [
  'pnpm-lock.canonical.yaml',
  'pnpm-lock.derived.yaml',
  'pnpm-workspace.canonical.yaml',
  'pnpm-workspace.derived.yaml',
];
const expectedOverlayRoles = [
  'canonical-lockfile',
  'derived-lockfile',
  'canonical-workspace',
  'derived-workspace',
];

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
let sourceStatus = null;
try {
  sourceStatus = execFileSync('git', ['status', '--porcelain=v1'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  sourceDirty = Boolean(sourceStatus);
} catch {
  // No Git checkout is an unclean, non-promotable local source.
}
const uiLockOverlayPath = process.env.UI_KIT_LOCK_OVERLAY_RECEIPT ? path.resolve(process.env.UI_KIT_LOCK_OVERLAY_RECEIPT) : null;
const uiLockOverlay = uiLockOverlayPath ? JSON.parse(fs.readFileSync(uiLockOverlayPath, 'utf8')) : null;
const externalDependenciesReceiptPath = process.env.EXTERNAL_DEPENDENCIES_RECEIPT
  ? path.resolve(process.env.EXTERNAL_DEPENDENCIES_RECEIPT)
  : null;
if (!externalDependenciesReceiptPath || !fs.existsSync(externalDependenciesReceiptPath)) {
  throw new Error('An authenticated external dependency receipt is required for this candidate');
}
const externalDependenciesReceipt = JSON.parse(fs.readFileSync(externalDependenciesReceiptPath, 'utf8'));
if (
  externalDependenciesReceipt.schemaVersion !== 1
  || JSON.stringify(externalDependenciesReceipt.dependencies) !== JSON.stringify(reconciliation.externalDependencies)
  || externalDependenciesReceipt.verified?.['@global-torque/design-tokens']?.integrity
    !== reconciliation.externalDependencies?.['@global-torque/design-tokens']?.integrity
) throw new Error('External dependency receipt does not match source reconciliation');
if (uiLockOverlay) {
  if (uiLockOverlay.schemaVersion !== 1 || uiLockOverlay.mode !== 'authenticated-ui-kit-overlay') throw new Error('UI Kit lock overlay receipt is not authenticated');
  if (
    !Array.isArray(uiLockOverlay.retainedFiles)
    || uiLockOverlay.retainedFiles.length !== expectedOverlayFiles.length
    || JSON.stringify(uiLockOverlay.retainedFiles.map(file => file.name)) !== JSON.stringify(expectedOverlayFiles)
    || uiLockOverlay.retainedFiles.some((file, index) => (
      file.role !== expectedOverlayRoles[index]
      || typeof file.name !== 'string'
      || path.basename(file.name) !== file.name
      || !expectedOverlayFiles.includes(file.name)
      || !/^[0-9a-f]{64}$/u.test(file.sha256 ?? '')
    ))
  ) throw new Error('UI Kit lock overlay receipt does not retain the canonical and derived YAML files');
  const allowed = new Set(['pnpm-lock.yaml', 'pnpm-workspace.yaml']);
  const dirtyPaths = sourceStatus === null ? [] : sourceStatus.split('\n').filter(Boolean).map(line => line.slice(3).trim().split(' -> ')[0]);
  if (process.env.REQUIRE_CLEAN_SOURCE === 'true' && dirtyPaths.some(file => !allowed.has(file))) throw new Error('Authenticated UI Kit overlay has unrelated source changes');
  if (sourceStatus !== null) sourceDirty = dirtyPaths.some(file => !allowed.has(file));
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

fs.mkdirSync(output, { recursive: true });
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
if (uiLockOverlay && uiLockOverlay.canonicalLockSha256 !== lockfile) throw new Error('Current lockfile does not match the authenticated canonical UI Kit lock digest');
const uiTransportPath = process.env.UI_KIT_TRANSPORT_RECEIPT ? path.resolve(process.env.UI_KIT_TRANSPORT_RECEIPT) : null;
const uiTransport = uiTransportPath ? JSON.parse(fs.readFileSync(uiTransportPath, 'utf8')) : null;
if (uiTransport) {
  if (uiTransport.schemaVersion !== 1 || uiTransport.package !== '@global-torque/ui-kit' || uiTransport.version !== '0.1.4' || uiTransport.canonical !== true) throw new Error('UI Kit transport receipt is not canonical');
  if (path.basename(uiTransportPath) !== 'transport-receipt.json') throw new Error('UI Kit transport receipt must use the canonical transport-receipt.json filename');
  if (!uiLockOverlay) throw new Error('Authenticated UI Kit transport requires a lock overlay receipt');
  const transportDirectory = process.env.UI_KIT_TRANSPORT_DIR ? path.resolve(process.env.UI_KIT_TRANSPORT_DIR) : path.dirname(uiTransportPath);
  const originalAttestationPath = process.env.UI_KIT_ORIGINAL_ATTESTATION ? path.resolve(process.env.UI_KIT_ORIGINAL_ATTESTATION) : path.join(transportDirectory, uiTransport.originalAttestation?.file ?? 'original-provenance.json');
  const transportFiles = [
    uiTransport.artifact,
    uiTransport.sidecar,
    uiTransport.sha512Sidecar,
    uiTransport.selectedRelease,
    uiTransport.originalAttestation?.file,
    'transport-receipt.json',
  ];
  for (const file of transportFiles) {
    if (!file || !fs.existsSync(path.join(transportDirectory, file))) throw new Error(`UI Kit transport file is missing: ${file}`);
    fs.copyFileSync(path.join(transportDirectory, file), path.join(output, file));
  }
  if (!fs.existsSync(originalAttestationPath) || fs.statSync(originalAttestationPath).size === 0) throw new Error('Original UI Kit attestation is missing before candidate receipt');
  const expectedAttestationSha256 = uiTransport.originalAttestation?.sha256;
  if (expectedAttestationSha256 !== hash('sha256', fs.readFileSync(originalAttestationPath))) throw new Error('Original UI Kit attestation digest mismatch');
}
const lockText = fs.existsSync(path.join(root, 'pnpm-lock.yaml')) ? fs.readFileSync(path.join(root, 'pnpm-lock.yaml'), 'utf8') : '';
const uiRegistryIntegrity = lockText.match(/['"]?@global-torque\/ui-kit@0\.1\.4['"]?:\n\s+resolution: \{integrity: ([^,}]+)/u)?.[1] ?? null;
if (uiTransport) {
  if (uiRegistryIntegrity !== uiTransport.integrity) throw new Error('Canonical pnpm lockfile does not retain the authenticated UI Kit integrity');
  const expectedOverlayMapping = ['packages/invest-features', 'packages/invest-shell', 'packages/invest-widgets'].map(importer => ({
    importer,
    canonical: '0.1.4',
    derived: 'file:global-torque-ui-kit-0.1.4.tgz',
  }));
  if (
    uiLockOverlay.schemaVersion !== 1
    || uiLockOverlay.mode !== 'authenticated-ui-kit-overlay'
    || !/^[0-9a-f]{64}$/u.test(uiLockOverlay.canonicalLockSha256 ?? '')
    || !/^[0-9a-f]{64}$/u.test(uiLockOverlay.derivedLockSha256 ?? '')
    || uiLockOverlay.canonicalLockSha256 !== lockfile
    || JSON.stringify(uiLockOverlay.locatorMapping) !== JSON.stringify(expectedOverlayMapping)
  ) throw new Error('Authenticated UI Kit lock overlay receipt is incomplete or maps unexpected locators');
  const transportIdentityKeys = ['schemaVersion', 'package', 'version', 'sourceRepository', 'sourceCommit', 'sourceRunId', 'sourceReleaseTag', 'artifact', 'sha512', 'integrity', 'canonical'];
  if (transportIdentityKeys.some(key => uiLockOverlay.uiKit?.[key] !== uiTransport[key])) throw new Error('UI Kit lock overlay receipt does not bind the authenticated transport identity');
  const retainedDirectory = process.env.UI_KIT_LOCK_OVERLAY_DIR ? path.resolve(process.env.UI_KIT_LOCK_OVERLAY_DIR) : null;
  if (!retainedDirectory || !fs.existsSync(retainedDirectory)) throw new Error('UI Kit lock overlay retained-file directory is missing');
  for (const file of uiLockOverlay.retainedFiles) {
    const source = path.join(retainedDirectory, file.name);
    if (!fs.existsSync(source)) throw new Error(`UI Kit retained YAML is missing: ${file.name}`);
    const bytes = fs.readFileSync(source);
    if (hash('sha256', bytes) !== file.sha256) throw new Error(`UI Kit retained YAML digest mismatch: ${file.name}`);
    fs.copyFileSync(source, path.join(output, file.name));
  }
}
const uiKit = uiTransport
  ? {
    ...uiTransport,
    lockOverlay: {
      canonicalLockSha256: uiLockOverlay.canonicalLockSha256,
      derivedLockSha256: uiLockOverlay.derivedLockSha256,
      locatorMapping: uiLockOverlay.locatorMapping,
      retainedFiles: uiLockOverlay.retainedFiles,
    },
  }
  : { mode: 'registry', package: '@global-torque/ui-kit', version: '0.1.4', integrity: uiRegistryIntegrity, lockfileSha256: lockfile, authenticated: false };
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
  externalDependencies: externalDependenciesReceipt.dependencies,
  packages: entries,
  dependencyOrder: packages.map(entry => entry.name),
  immutable: true,
  promotable: false,
};
fs.writeFileSync(path.join(output, 'candidate-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(`packed-candidate ${candidate} ${entries.length} packages`);
