import crypto from 'node:crypto';
import fs from 'node:fs';
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
if (JSON.stringify(receipt.compatibilityMatrix) !== JSON.stringify(reconciliation.compatibilityMatrix)) throw new Error('Receipt compatibility matrix differs from source reconciliation');
const tokenMatrix = receipt.compatibilityMatrix?.designTokens;
if (
  !Array.isArray(tokenMatrix)
  || JSON.stringify(tokenMatrix.map(entry => entry.cohort)) !== JSON.stringify(['absent', '0.2.1', '0.3.0'])
  || tokenMatrix.some(entry => entry.cohort !== 'absent' && (
    typeof entry.sourceTag !== 'string'
    || !/^[0-9a-f]{40}$/u.test(entry.sourceCommit ?? '')
    || typeof entry.archive !== 'string'
    || !/^[0-9a-f]{64}$/u.test(entry.archiveSha256 ?? '')
    || !/^sha512-[A-Za-z0-9+/]+=*$/u.test(entry.integrity ?? '')
    || !/^[0-9a-f]{64}$/u.test(entry.inventorySha256 ?? '')
    || !/^[0-9a-f]{64}$/u.test(entry.attestation?.sha256 ?? '')
  ))
  || tokenMatrix.some(entry => entry.cohort === 'absent' && entry.archive !== null)
) throw new Error('Receipt compatibility matrix does not bind absent, 0.2.1, and 0.3.0 token identities');
if (typeof receipt.sourceRepository !== 'string' || typeof receipt.sourcePackageRepository !== 'string') throw new Error('Receipt source repositories are missing');
if (typeof receipt.sourceDirty !== 'boolean') throw new Error('Receipt source cleanliness is missing');
if (receipt.sourceRevision !== null && !/^[0-9a-f]{40}$/u.test(receipt.sourceRevision)) throw new Error('Receipt source revision is not a full commit or null');
if (!receipt.sourceDirty && !receipt.sourceRevision) throw new Error('Clean receipt must identify a target-repository commit');
if (receipt.sourcePackageRevision !== undefined && !/^[0-9a-f]{40}$/u.test(receipt.sourcePackageRevision)) throw new Error('Receipt source package revision is not a full commit');
if (
  receipt.browserContract?.schemaVersion !== 1
  || receipt.browserContract.package !== '@global-torque/invest-shell'
  || receipt.browserContract.result !== 'pass'
  || receipt.browserContract.file !== 'browser-contract-report.json'
  || !/^[0-9a-f]{64}$/u.test(receipt.browserContract.sha256 ?? '')
) throw new Error('Receipt Chromium CSS contract evidence is missing or invalid');
const browserReportPath = path.join(path.dirname(receiptPath), receipt.browserContract.file);
if (!fs.existsSync(browserReportPath)) throw new Error('Receipt Chromium CSS contract report is missing');
const browserReportBytes = fs.readFileSync(browserReportPath);
if (crypto.createHash('sha256').update(browserReportBytes).digest('hex') !== receipt.browserContract.sha256) throw new Error('Receipt Chromium CSS contract report digest mismatch');
const browserReport = JSON.parse(browserReportBytes);
if (browserReport.schemaVersion !== 1 || browserReport.package !== receipt.browserContract.package || browserReport.result !== 'pass') throw new Error('Receipt Chromium CSS contract report identity mismatch');
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
console.log(`release-bundle-pass ${receipt.candidate}`);
