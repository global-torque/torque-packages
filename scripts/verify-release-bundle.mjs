import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { assertNodeExportContracts, collectExportTargets, expectedNodeFilesForPackage } from './node-build-contract.mjs';

const receiptPath = path.resolve(process.argv[2] ?? 'artifacts/candidate-receipt.json');
const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
const root = path.resolve(new URL('..', import.meta.url).pathname);
const reconciliation = JSON.parse(fs.readFileSync(path.join(root, 'docs/source-reconciliation.json'), 'utf8'));
const expectedPackages = [
  '@global-torque/domain-types',
  '@global-torque/invest-core',
  '@global-torque/invest-data',
  '@global-torque/invest-runtime',
  '@global-torque/invest-widgets',
  '@global-torque/invest-features',
  '@global-torque/invest-shell',
];
const expectedPackageNames = new Set(expectedPackages);
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

function assertPackedManifest(manifest, packageName, version) {
  if (manifest.name !== packageName || manifest.version !== version || manifest.private === true) {
    throw new Error(`Packed manifest identity mismatch ${packageName}`);
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
  if (/^(?:README|readme|LICENSE|LICENCE|COPYING)(?:\.[^/]*)?$/u.test(relative)) return true;
  return (manifest.files ?? []).some((entry) => {
    if (typeof entry !== 'string' || entry.startsWith('/') || entry.split('/').includes('..')) return false;
    const normalized = entry.replace(/^\.\//u, '').replace(/\/$/u, '');
    if (!normalized) return false;
    return normalized.includes('*')
      ? globToRegExp(normalized).test(relative)
      : relative === normalized || relative.startsWith(`${normalized}/`);
  });
}

function assertArchiveInventory(archiveFiles, manifest, packageName) {
  const relativeFiles = archiveFiles.map((file) => {
    if (!file.startsWith('package/') || file.endsWith('/') || file.includes('\0')) throw new Error(`Unsafe archive path ${packageName}:${file}`);
    const relative = file.slice('package/'.length);
    if (!relative || path.posix.isAbsolute(relative) || relative.split('/').includes('..') || path.posix.normalize(relative) !== relative) {
      throw new Error(`Unsafe archive path ${packageName}:${file}`);
    }
    if (!isManifestPathAllowed(relative, manifest)) throw new Error(`Archive file is outside the manifest allowlist ${packageName}:${relative}`);
    return relative;
  });
  if (new Set(relativeFiles).size !== relativeFiles.length) throw new Error(`Duplicate archive entry ${packageName}`);
  const exportTargets = collectExportTargets(manifest.exports);
  const nodeTargets = new Set(expectedNodeFilesForPackage(packageName).map(file => `./${file}`));
  if (!manifest.exports || exportTargets.some(target => !target.startsWith('./src/') && !nodeTargets.has(target))) throw new Error(`Packed export target escapes source ${packageName}`);
  for (const target of exportTargets) {
    const relativeTarget = target.slice(2);
    const prefix = `package/${relativeTarget.split('*')[0]}`;
    if (target.includes('*') ? !archiveFiles.some(file => file.startsWith(prefix)) : !archiveFiles.includes(`package/${relativeTarget}`)) {
      throw new Error(`Packed export target is absent ${packageName}:${target}`);
    }
  }
  if (!relativeFiles.some(file => file.startsWith('src/'))) throw new Error(`Source absent from ${packageName}`);
  return relativeFiles;
}
if (receipt.schemaVersion !== 1 || receipt.immutable !== true || receipt.promotable !== false) throw new Error('Receipt is not an immutable non-promotable candidate');
if (typeof receipt.sourceRepository !== 'string' || typeof receipt.sourcePackageRepository !== 'string') throw new Error('Receipt source repositories are missing');
if (typeof receipt.sourceDirty !== 'boolean') throw new Error('Receipt source cleanliness is missing');
if (receipt.sourceRevision !== null && !/^[0-9a-f]{40}$/u.test(receipt.sourceRevision)) throw new Error('Receipt source revision is not a full commit or null');
if (!receipt.sourceDirty && !receipt.sourceRevision) throw new Error('Clean receipt must identify a target-repository commit');
if (receipt.sourcePackageRevision !== undefined && !/^[0-9a-f]{40}$/u.test(receipt.sourcePackageRevision)) throw new Error('Receipt source package revision is not a full commit');
if (!Array.isArray(receipt.packages) || receipt.packages.length !== expectedPackages.length) throw new Error('Receipt must contain all seven framework packages');
if (JSON.stringify(receipt.dependencyOrder) !== JSON.stringify(expectedPackages)) throw new Error('Receipt dependency order is not the accepted framework order');
if (new Set(receipt.packages.map(entry => entry.name)).size !== expectedPackages.length || receipt.packages.some(entry => !expectedPackages.includes(entry.name))) throw new Error('Receipt contains an unknown or duplicate package identity');
const artifactRoot = path.dirname(receiptPath);
for (const entry of receipt.packages) {
  if (entry.sourceRevision !== receipt.sourceRevision || entry.sourceDirty !== receipt.sourceDirty || entry.sourcePackageRepository !== receipt.sourcePackageRepository || entry.sourcePackageRevision !== receipt.sourcePackageRevision) throw new Error(`Package source identity mismatch ${entry.name}`);
  const archive = path.join(artifactRoot, entry.archive);
  if (!fs.existsSync(archive)) throw new Error(`Missing candidate archive ${entry.archive}`);
  const expectedArchive = `${entry.name.slice(1).replace('/', '-')}-${receipt.candidate}.tgz`;
  if (entry.archive !== expectedArchive) throw new Error(`Archive identity mismatch ${entry.name}`);
  const bytes = fs.readFileSync(archive);
  const sha512 = crypto.createHash('sha512').update(bytes).digest('hex');
  if (sha512 !== entry.sha512) throw new Error(`SHA-512 mismatch ${entry.name}`);
  if (entry.integrity !== `sha512-${crypto.createHash('sha512').update(bytes).digest('base64')}`) throw new Error(`Integrity mismatch ${entry.name}`);
  const archiveFiles = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split('\n').filter(Boolean).sort();
  const details = execFileSync('tar', ['-tvzf', archive], { encoding: 'utf8' });
  if (details.split('\n').some(line => /^[dhlpbc]/u.test(line))) throw new Error(`Archive contains a non-regular entry ${entry.name}`);
  const relativeFiles = archiveFiles.map(file => {
    if (!file.startsWith('package/') || file.endsWith('/') || file.includes('\0')) throw new Error(`Unsafe archive path ${entry.name}:${file}`);
    const relative = file.slice('package/'.length);
    if (!relative || path.posix.isAbsolute(relative) || relative.split('/').includes('..') || path.posix.normalize(relative) !== relative) throw new Error(`Unsafe archive path ${entry.name}:${file}`);
    return relative;
  });
  if (new Set(relativeFiles).size !== relativeFiles.length) throw new Error(`Duplicate archive entry ${entry.name}`);
  if (!Array.isArray(entry.files) || entry.files.some(file => typeof file !== 'string') || new Set(entry.files).size !== entry.files.length) throw new Error(`Receipt file inventory is invalid ${entry.name}`);
  if (JSON.stringify(relativeFiles) !== JSON.stringify([...entry.files].sort())) throw new Error(`Receipt file inventory differs from the archive ${entry.name}`);
  const packedManifest = JSON.parse(execFileSync('tar', ['-xOzf', archive, 'package/package.json'], { encoding: 'utf8' }));
  assertPackedManifest(packedManifest, entry.name, receipt.candidate);
  assertArchiveInventory(archiveFiles, packedManifest, entry.name);
  if (!entry.files.some(file => file === 'package.json')) throw new Error(`Manifest absent from ${entry.name}`);
  if (!entry.files.some(file => file.startsWith('src/'))) throw new Error(`Source absent from ${entry.name}`);
  if (!entry.fileSha512 || Object.keys(entry.fileSha512).length !== entry.files.length) throw new Error(`Per-file hashes absent from ${entry.name}`);
  const sidecar = JSON.parse(fs.readFileSync(`${archive}.manifest.json`, 'utf8'));
  if (sidecar.package !== entry.name || sidecar.version !== receipt.candidate || sidecar.artifact !== entry.archive) throw new Error(`Sidecar metadata mismatch ${entry.name}`);
  if (sidecar.sourceRepository !== receipt.sourceRepository || sidecar.sourceRevision !== receipt.sourceRevision || sidecar.sourceDirty !== receipt.sourceDirty || sidecar.sourcePackageRepository !== receipt.sourcePackageRepository || sidecar.sourcePackageRevision !== receipt.sourcePackageRevision) throw new Error(`Sidecar source identity mismatch ${entry.name}`);
  if (sidecar.sha512 !== entry.sha512 || sidecar.integrity !== entry.integrity) throw new Error(`Sidecar archive digest mismatch ${entry.name}`);
  if (!sidecar.files || typeof sidecar.files !== 'object' || Array.isArray(sidecar.files) || JSON.stringify(Object.keys(sidecar.files).sort()) !== JSON.stringify([...entry.files].sort())) throw new Error(`Sidecar file inventory differs from the archive ${entry.name}`);
  for (const file of entry.files) {
    const fileSha512 = crypto.createHash('sha512').update(execFileSync('tar', ['-xOzf', archive, `package/${file}`], { maxBuffer: 64 * 1024 * 1024 })).digest('hex');
    if (entry.fileSha512[file] !== fileSha512 || sidecar.files?.[file] !== fileSha512) throw new Error(`Per-file SHA-512 mismatch ${entry.name}:${file}`);
  }
}
if (receipt.uiKit?.canonical === true) {
  const uiKit = receipt.uiKit;
  const requiredTransportFiles = [
    uiKit.artifact,
    uiKit.sidecar,
    uiKit.sha512Sidecar,
    uiKit.selectedRelease,
    uiKit.originalAttestation?.file,
    'transport-receipt.json',
  ];
  for (const file of requiredTransportFiles) {
    if (typeof file !== 'string' || !fs.existsSync(path.join(artifactRoot, file))) throw new Error(`Missing canonical UI Kit transport file ${file}`);
  }
  const transportReceipt = JSON.parse(fs.readFileSync(path.join(artifactRoot, 'transport-receipt.json'), 'utf8'));
  for (const key of ['schemaVersion', 'package', 'version', 'sourceRepository', 'sourceCommit', 'sourceRunId', 'sourceReleaseTag', 'artifact', 'sha512', 'integrity', 'canonical']) {
    if (transportReceipt[key] !== uiKit[key]) throw new Error(`UI Kit transport receipt identity mismatch ${key}`);
  }
  const expectedOverlayMapping = ['packages/invest-features', 'packages/invest-shell', 'packages/invest-widgets'].map(importer => ({
    importer,
    canonical: '0.1.4',
    derived: 'file:global-torque-ui-kit-0.1.4.tgz',
  }));
  const overlay = uiKit.lockOverlay;
  if (
    !overlay
    || !/^[0-9a-f]{64}$/u.test(overlay.canonicalLockSha256 ?? '')
    || !/^[0-9a-f]{64}$/u.test(overlay.derivedLockSha256 ?? '')
    || overlay.canonicalLockSha256 !== receipt.lockfileSha256
    || JSON.stringify(overlay.locatorMapping) !== JSON.stringify(expectedOverlayMapping)
    || !Array.isArray(overlay.retainedFiles)
    || overlay.retainedFiles.length !== expectedOverlayFiles.length
    || JSON.stringify(overlay.retainedFiles.map(file => file.name)) !== JSON.stringify(expectedOverlayFiles)
    || overlay.retainedFiles.some((file, index) => (
      file.role !== expectedOverlayRoles[index]
      || typeof file.name !== 'string'
      || path.basename(file.name) !== file.name
      || !expectedOverlayFiles.includes(file.name)
      || !/^[0-9a-f]{64}$/u.test(file.sha256 ?? '')
    ))
  ) throw new Error('UI Kit combined receipt has an incomplete or unexpected lock overlay mapping');
  const verificationDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'torque-ui-kit-release-'));
  const verificationReceipt = path.join(verificationDirectory, 'transport-receipt.json');
  const verificationOverlayReceipt = path.join(verificationDirectory, 'ui-kit-lock-overlay.json');
  try {
    for (const file of overlay.retainedFiles) {
      const retainedPath = path.join(artifactRoot, file.name);
      if (!fs.existsSync(retainedPath)) throw new Error(`Missing retained UI Kit YAML ${file.name}`);
      const retainedBytes = fs.readFileSync(retainedPath);
      if (crypto.createHash('sha256').update(retainedBytes).digest('hex') !== file.sha256) throw new Error(`Retained UI Kit YAML digest mismatch ${file.name}`);
    }
    execFileSync(process.execPath, [
      path.join(path.dirname(new URL(import.meta.url).pathname), 'verify-ui-kit-lock-overlay.mjs'),
      path.join(artifactRoot, 'pnpm-lock.canonical.yaml'),
      path.join(artifactRoot, 'pnpm-lock.derived.yaml'),
      path.join(artifactRoot, 'transport-receipt.json'),
      verificationOverlayReceipt,
      path.join(artifactRoot, 'pnpm-workspace.canonical.yaml'),
      path.join(artifactRoot, 'pnpm-workspace.derived.yaml'),
    ], { stdio: 'inherit' });
    const verifiedOverlay = JSON.parse(fs.readFileSync(verificationOverlayReceipt, 'utf8'));
    if (
      verifiedOverlay.canonicalLockSha256 !== overlay.canonicalLockSha256
      || verifiedOverlay.derivedLockSha256 !== overlay.derivedLockSha256
      || JSON.stringify(verifiedOverlay.locatorMapping) !== JSON.stringify(overlay.locatorMapping)
      || JSON.stringify(verifiedOverlay.retainedFiles) !== JSON.stringify(overlay.retainedFiles)
    ) throw new Error('UI Kit retained lock overlay verification differs from the combined receipt');
    execFileSync(process.execPath, [
      path.join(path.dirname(new URL(import.meta.url).pathname), 'verify-ui-kit-transport.mjs'),
      artifactRoot,
      uiKit.sourceRunId,
      uiKit.sourceReleaseTag,
      path.join(artifactRoot, uiKit.originalAttestation.file),
      verificationReceipt,
    ], { stdio: 'inherit' });
  } finally {
    fs.rmSync(verificationDirectory, { recursive: true, force: true });
  }
}
console.log(`release-bundle-pass ${receipt.candidate}`);
