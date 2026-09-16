#!/usr/bin/env node

/**
 * Transactional local source links for the seven public framework packages.
 * The consumer's pnpm-workspace.yaml is used only as a temporary override;
 * package manifests and committed lockfiles are protected byte-for-byte.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SCHEMA_VERSION = 1;
export const STATE_DIRECTORY = '.torque-framework-links';
export const JOURNAL_FILE = 'journal.json';
export const WORKSPACE_FILE = 'pnpm-workspace.yaml';
export const LOCKFILE = 'pnpm-lock.yaml';
export const REQUIRED_PNPM_VERSION = '10.34.5';
export const FRAMEWORK_PACKAGE_NAMES = Object.freeze([
  '@global-torque/domain-types',
  '@global-torque/invest-core',
  '@global-torque/invest-data',
  '@global-torque/invest-runtime',
  '@global-torque/invest-widgets',
  '@global-torque/invest-features',
  '@global-torque/invest-shell',
]);

const MARKER_START = '# torque-framework-links:start';
const MARKER_END = '# torque-framework-links:end';
const recoverySource = path.join(path.dirname(fileURLToPath(import.meta.url)), 'framework-links-recovery.mjs');
const LOCK_FILE = 'transaction.lock';
const RECLAIM_LOCK_SUFFIX = '.reclaim';
const MAX_RECLAMATION_DEPTH = 32;

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function realpath(directory) {
  return fs.realpathSync(path.resolve(directory));
}

function assertDirectory(directory, label) {
  const resolved = realpath(directory);
  if (!fs.statSync(resolved).isDirectory()) throw new Error(`${label} is not a directory: ${resolved}`);
  return resolved;
}

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function packagePath(consumerRoot, packageName) {
  const match = packageName.match(/^(@[^/]+)\/(.+)$/u);
  return match
    ? path.join(consumerRoot, 'node_modules', match[1], match[2])
    : path.join(consumerRoot, 'node_modules', packageName);
}

export function frameworkPackages(frameworkRoot) {
  const root = assertDirectory(frameworkRoot, 'Framework root');
  const names = FRAMEWORK_PACKAGE_NAMES.map(name => {
    const slug = name.slice('@global-torque/'.length);
    const directory = path.join(root, 'packages', slug);
    if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
      throw new Error(`Framework package source is missing: ${directory}`);
    }
    const manifestPath = path.join(directory, 'package.json');
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    }
    catch {
      throw new Error(`Framework package manifest is unreadable: ${manifestPath}`);
    }
    if (manifest.name !== name || typeof manifest.version !== 'string') {
      throw new Error(`Framework package manifest identity is invalid: ${manifestPath}`);
    }
    const sourcePath = realpath(directory);
    if (!isWithin(root, sourcePath)) throw new Error(`Framework package escapes its source root: ${sourcePath}`);
    return { name, version: manifest.version, path: directory, realpath: sourcePath };
  });
  const versions = new Set(names.map(item => item.version));
  if (versions.size !== 1) throw new Error(`Framework package cohort is mixed: ${[...versions].join(', ')}`);
  for (let index = 0; index < names.length; index += 1) {
    for (let nested = index + 1; nested < names.length; nested += 1) {
      if (isWithin(names[index].realpath, names[nested].realpath) || isWithin(names[nested].realpath, names[index].realpath)) {
        throw new Error('Framework package cohort has overlapping source roots.');
      }
    }
  }
  return { root, version: names[0].version, packages: names };
}

function readFileSnapshot(filePath) {
  const exists = fs.existsSync(filePath);
  return {
    path: filePath,
    exists,
    sha256: exists ? sha256(fs.readFileSync(filePath)) : null,
  };
}

export function protectedSnapshot(consumerRoot) {
  const appManifests = fs.existsSync(path.join(consumerRoot, 'apps'))
    ? fs.readdirSync(path.join(consumerRoot, 'apps'), { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => path.join(consumerRoot, 'apps', entry.name, 'package.json'))
      .filter(filePath => fs.existsSync(filePath))
      .sort()
      .map(readFileSnapshot)
    : [];
  return {
    root: [
      readFileSnapshot(path.join(consumerRoot, 'package.json')),
      readFileSnapshot(path.join(consumerRoot, LOCKFILE)),
    ],
    appManifests,
  };
}

function snapshotEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function protectedFilesMatch(consumerRoot, expected) {
  const actual = protectedSnapshot(consumerRoot);
  return snapshotEqual(actual.root, expected.root) && snapshotEqual(actual.appManifests, expected.appManifests);
}

function quoteYaml(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function overrideBlock(packages) {
  return [
    `${MARKER_START} schema=${SCHEMA_VERSION}`,
    ...packages.map(item => `  ${quoteYaml(item.name)}: ${quoteYaml(`link:${item.realpath}`)}`),
    MARKER_END,
  ].join('\n');
}

/**
 * Add the temporary link overrides without parsing and reserializing the
 * consumer's YAML. This preserves comments, ordering, and dirty bytes.
 */
export function buildWorkspaceOverlay(baseline, packages) {
  if (baseline.includes(MARKER_START) || baseline.includes(MARKER_END)) {
    throw new Error('Consumer workspace already contains a framework link marker; run framework:status or framework:recover.');
  }
  const block = overrideBlock(packages);
  for (const item of packages) {
    const escapedName = item.name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    const key = new RegExp(`^\\s{2}(?:['\"])?${escapedName}(?:['\"])?\\s*:`, 'mu');
    if (key.test(baseline)) throw new Error(`Consumer overrides already claim ${item.name}; refusing to replace it.`);
  }

  const lines = baseline.split(/(?<=\n)/u);
  const anyOverrides = lines.findIndex(line => /^overrides:/u.test(line));
  if (anyOverrides >= 0 && !/^overrides:\s*(?:\{\s*\}|#.*)?(?:\r?\n)?$/u.test(lines[anyOverrides])) {
    throw new Error('Consumer overrides use an unsupported inline YAML shape; refusing to rewrite it.');
  }
  const rootOverrides = anyOverrides;
  if (rootOverrides >= 0) {
    const line = lines[rootOverrides];
    if (line.trim() === 'overrides: {}') {
      lines[rootOverrides] = `overrides:\n${block}\n`;
    }
    else {
      lines.splice(rootOverrides + 1, 0, `${block}\n`);
    }
    return lines.join('');
  }

  const suffix = baseline.endsWith('\n') || baseline.length === 0 ? '' : '\n';
  return `${baseline}${suffix}\noverrides:\n${block}\n`;
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function journalFile(consumerRoot) {
  return path.join(consumerRoot, STATE_DIRECTORY, JOURNAL_FILE);
}

function readTransactionLock(lockPath) {
  let stat;
  try {
    stat = fs.lstatSync(lockPath);
  }
  catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`Framework link transaction lock ownership is unverifiable: ${lockPath}`);
  }
  let bytes;
  try {
    bytes = fs.readFileSync(lockPath);
  }
  catch (error) {
    throw new Error(`Framework link transaction lock ownership is unverifiable: ${lockPath} (${error instanceof Error ? error.message : String(error)})`);
  }
  let owner;
  try {
    owner = JSON.parse(bytes.toString('utf8'));
  }
  catch {
    throw new Error(`Framework link transaction lock ownership is empty or malformed: ${lockPath}`);
  }
  if (!owner || typeof owner !== 'object' || !Number.isSafeInteger(owner.pid) || owner.pid <= 0
    || typeof owner.lockInstance !== 'string' || owner.lockInstance.length === 0
    || typeof owner.startedAt !== 'string' || owner.startedAt.length === 0) {
    throw new Error(`Framework link transaction lock ownership is unverifiable: ${lockPath}`);
  }
  return { owner, bytes };
}

function ownerIsDead(owner, lockPath) {
  try {
    process.kill(owner.pid, 0);
    return false;
  }
  catch (error) {
    if (error?.code === 'ESRCH') return true;
    throw new Error(`Framework link transaction lock owner is unverifiable: ${lockPath}`);
  }
}

function releaseTransactionLock(lockPath, ownedBytes, descriptor) {
  try { fs.closeSync(descriptor); } catch { /* already closed */ }
  let current;
  try {
    current = readTransactionLock(lockPath);
  }
  catch {
    // A replacement or damaged lock belongs to another transaction. Never
    // remove it while releasing this transaction's handle.
    return;
  }
  if (!current || !current.bytes.equals(ownedBytes)) return;
  try { fs.unlinkSync(lockPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}

function acquireReclamationLock(lockPath, depth = 0) {
  const claimPath = `${lockPath}${RECLAIM_LOCK_SUFFIX}`;
  let descriptor;
  try {
    descriptor = fs.openSync(claimPath, 'wx', 0o600);
  }
  catch (error) {
    if (error.code === 'EEXIST') {
      if (depth >= MAX_RECLAMATION_DEPTH) {
        throw new Error(`Framework link transaction stale-lock reclamation chain is too deep: ${claimPath}`);
      }
      const observed = readTransactionLock(claimPath);
      if (!observed) return acquireReclamationLock(lockPath, depth);
      if (!ownerIsDead(observed.owner, claimPath)) {
        throw new Error(`Framework link transaction stale-lock reclamation is already running: ${claimPath}`);
      }
      // An interrupted stale-owner cleanup can leave a dead claim behind.
      // Reclaim that claim through the same guarded, instance-checked path;
      // each nested claim is bounded so malformed chains cannot recurse forever.
      removeStaleTransactionLock(claimPath, observed, depth + 1);
      return acquireReclamationLock(lockPath, depth + 1);
    }
    throw error;
  }
  const owner = {
    pid: process.pid,
    lockInstance: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
  };
  const ownedBytes = Buffer.from(JSON.stringify(owner));
  try {
    fs.writeFileSync(descriptor, ownedBytes);
  }
  catch (error) {
    try { fs.closeSync(descriptor); } catch { /* already closed */ }
    try { fs.unlinkSync(claimPath); } catch { /* preserve the original write error */ }
    throw error;
  }
  return { release: () => releaseTransactionLock(claimPath, ownedBytes, descriptor) };
}

function removeStaleTransactionLock(lockPath, observed, depth = 0) {
  const reclamationLock = acquireReclamationLock(lockPath, depth);
  try {
    const current = readTransactionLock(lockPath);
    if (!current) return;
    if (!current.bytes.equals(observed.bytes)) return;
    if (!ownerIsDead(current.owner, lockPath)) {
      throw new Error(`Framework link transaction is already running (pid ${current.owner.pid}).`);
    }
    // The reclamation claim serializes stale-owner removal with competing
    // contenders. Re-read while holding it so a replacement instance is
    // never removed by this stale-owner cleanup.
    const confirmed = readTransactionLock(lockPath);
    if (!confirmed || !confirmed.bytes.equals(observed.bytes)) return;
    try { fs.unlinkSync(lockPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  finally {
    reclamationLock.release();
  }
}

function acquireTransactionLock(consumerRoot) {
  const directory = path.join(consumerRoot, STATE_DIRECTORY);
  const createdDirectory = fs.mkdirSync(directory, { recursive: true, mode: 0o700 }) !== undefined;
  const lockPath = path.join(directory, LOCK_FILE);
  while (true) {
    try {
      const descriptor = fs.openSync(lockPath, 'wx', 0o600);
      const owner = {
        pid: process.pid,
        lockInstance: crypto.randomUUID(),
        startedAt: new Date().toISOString(),
      };
      const ownedBytes = Buffer.from(JSON.stringify(owner));
      try {
        fs.writeFileSync(descriptor, ownedBytes);
      }
      catch (error) {
        try { fs.closeSync(descriptor); } catch { /* already closed */ }
        try { fs.unlinkSync(lockPath); } catch { /* preserve the original write error */ }
        throw error;
      }
      return {
        release: () => releaseTransactionLock(lockPath, ownedBytes, descriptor),
        lockPath,
        ownedBytes,
        stateDirectory: directory,
        createdStateDirectory: createdDirectory,
      };
    }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const observed = readTransactionLock(lockPath);
      if (!observed) continue;
      removeStaleTransactionLock(lockPath, observed);
    }
  }
}

function removeEmptyCreatedStateDirectory(lock) {
  if (!lock?.createdStateDirectory) return;
  const lockPath = path.join(lock.stateDirectory, LOCK_FILE);
  if (fs.existsSync(lockPath)) return;
  try {
    if (fs.readdirSync(lock.stateDirectory).length === 0) fs.rmdirSync(lock.stateDirectory);
  }
  catch (error) {
    // A concurrent file, journal, or helper makes the directory non-empty;
    // retain it for the owning transaction or subsequent recovery.
    if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(error.code)) throw error;
  }
}

function writeJournal(consumerRoot, journal) {
  writeJson(journalFile(consumerRoot), { ...journal, updatedAt: new Date().toISOString() });
}

function readJournal(consumerRoot) {
  const filePath = journalFile(consumerRoot);
  if (!fs.existsSync(filePath)) return null;
  let journal;
  try {
    journal = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  catch {
    throw new Error(`Framework link journal is unreadable: ${filePath}`);
  }
  if (!journal || journal.schemaVersion !== SCHEMA_VERSION) throw new Error('Framework link journal schema is unsupported.');
  return journal;
}

function ensurePnpmVersion(run, consumerRoot) {
  const result = run('pnpm', ['--version'], consumerRoot, { capture: true });
  const version = String(result.stdout || '').trim().split(/\s+/u).at(-1);
  if (version !== REQUIRED_PNPM_VERSION) {
    throw new Error(`Framework linking requires pnpm ${REQUIRED_PNPM_VERSION}; found ${version || 'unknown'}.`);
  }
}

function defaultRun(executable, args, cwd, options = {}) {
  const result = spawnSync(executable, args, {
    cwd,
    env: process.env,
    stdio: options.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${executable} ${args.join(' ')} failed with exit code ${result.status}.`);
  return result;
}

function copyRecoveryHelper(consumerRoot) {
  const directory = path.join(consumerRoot, STATE_DIRECTORY);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const target = path.join(directory, 'recovery.mjs');
  const source = fs.readFileSync(recoverySource);
  fs.writeFileSync(target, source, { mode: 0o700 });
  return { path: target, sha256: sha256(source) };
}

function workspaceSnapshot(consumerRoot) {
  const filePath = path.join(consumerRoot, WORKSPACE_FILE);
  const bytes = fs.existsSync(filePath) ? fs.readFileSync(filePath) : Buffer.alloc(0);
  return { path: filePath, exists: bytes.length > 0 || fs.existsSync(filePath), bytes, sha256: sha256(bytes) };
}

function encode(bytes) {
  return { base64: bytes.toString('base64'), sha256: sha256(bytes) };
}

function updatePhase(consumerRoot, journal, phase, extra = {}) {
  const updated = { ...journal, ...extra, phase, updatedAt: new Date().toISOString() };
  writeJournal(consumerRoot, updated);
  return updated;
}

function restoreWorkspaceIfSafe(consumerRoot, journal) {
  const snapshot = workspaceSnapshot(consumerRoot);
  const expected = Buffer.from(journal.overlayWorkspace.base64, 'base64');
  const baseline = Buffer.from(journal.baselineWorkspace.base64, 'base64');
  const baselineExists = journal.baselineWorkspace.exists !== false;
  if (snapshot.exists === baselineExists && snapshot.sha256 === journal.baselineWorkspace.sha256) return true;
  if (!snapshot.exists || snapshot.sha256 !== journal.overlayWorkspace.sha256) {
    updatePhase(consumerRoot, journal, 'inconsistent', {
      conflict: {
        kind: 'workspace-bytes',
        observedExists: snapshot.exists,
        observedSha256: snapshot.sha256,
        observedBase64: snapshot.bytes.toString('base64'),
        expectedBaselineExists: baselineExists,
        expectedBaselineSha256: journal.baselineWorkspace.sha256,
        expectedOverlaySha256: journal.overlayWorkspace.sha256,
      },
    });
    return false;
  }
  if (!protectedFilesMatch(consumerRoot, journal.protected)) {
    updatePhase(consumerRoot, journal, 'inconsistent', {
      conflict: { kind: 'protected-metadata', observed: protectedSnapshot(consumerRoot) },
    });
    return false;
  }
  if (!expected.equals(snapshot.bytes)) throw new Error('Overlay hash unexpectedly matched different bytes.');
  fs.writeFileSync(journal.workspacePath, baseline);
  return true;
}

function packageInstalled(packageRoot, packageName) {
  const installed = packagePath(packageRoot, packageName);
  try {
    fs.lstatSync(installed);
    return installed;
  }
  catch {
    return null;
  }
}

function frameworkDependencies(manifest) {
  return FRAMEWORK_PACKAGE_NAMES.filter(name => [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.optionalDependencies,
    manifest.peerDependencies,
  ].some(section => section && Object.hasOwn(section, name)));
}

function readPackageManifest(packageRoot) {
  const manifestPath = path.join(packageRoot, 'package.json');
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  }
  catch {
    throw new Error(`Framework package manifest is unreadable: ${manifestPath}`);
  }
}

function assertResolvedLink(installed, expected, label) {
  let resolved;
  try { resolved = fs.realpathSync(installed); }
  catch { throw new Error(`Framework link is stale or unreadable for ${label}: ${installed}`); }
  if (resolved !== expected) throw new Error(`Framework link is mixed for ${label}: ${resolved}`);
}

function assertLinkedPackages(consumerRoot, cohort) {
  const expectedByName = new Map(cohort.packages.map(item => [item.name, item.realpath]));
  const importers = [
    consumerRoot,
    ...(fs.existsSync(path.join(consumerRoot, 'apps'))
      ? fs.readdirSync(path.join(consumerRoot, 'apps'), { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => path.join(consumerRoot, 'apps', entry.name))
      : []),
  ];
  const queue = [];
  for (const importer of importers) {
    let manifest = {};
    const manifestPath = path.join(importer, 'package.json');
    if (fs.existsSync(manifestPath)) manifest = readPackageManifest(importer);
    for (const packageName of frameworkDependencies(manifest)) {
      const installed = packageInstalled(importer, packageName);
      if (!installed) throw new Error(`Framework importer graph is incomplete for ${packageName} in ${importer}.`);
      assertResolvedLink(installed, expectedByName.get(packageName), `${packageName} in ${importer}`);
      queue.push(packageName);
    }
    // Validate every materialized importer copy, including transitive or
    // hoisted copies. Root copies are optional; app declarations determine
    // which roots must exist.
    for (const packageName of FRAMEWORK_PACKAGE_NAMES) {
      const installed = packageInstalled(importer, packageName);
      if (!installed) continue;
      assertResolvedLink(installed, expectedByName.get(packageName), `${packageName} in ${importer}`);
      queue.push(packageName);
    }
  }
  if (!queue.length) throw new Error('Framework link cohort is incomplete: no application imports a framework package.');

  const visited = new Set();
  while (queue.length) {
    const packageName = queue.shift();
    if (visited.has(packageName)) continue;
    visited.add(packageName);
    const packageRoot = expectedByName.get(packageName);
    if (!packageRoot) throw new Error(`Framework link cohort contains an unknown package: ${packageName}.`);
    for (const dependency of frameworkDependencies(readPackageManifest(packageRoot))) {
      const installed = packageInstalled(packageRoot, dependency);
      if (!installed) throw new Error(`Framework canonical graph is incomplete for ${dependency} required by ${packageName}.`);
      assertResolvedLink(installed, expectedByName.get(dependency), `${dependency} required by ${packageName}`);
      queue.push(dependency);
    }
  }
  if (visited.size !== FRAMEWORK_PACKAGE_NAMES.length) {
    throw new Error(`Framework link cohort is incomplete or unreachable: ${FRAMEWORK_PACKAGE_NAMES.filter(name => !visited.has(name)).join(', ')}.`);
  }
}

function assertActiveJournal(consumerRoot, journal, framework) {
  if (journal.frameworkRoot !== framework.root) {
    throw new Error(`Framework link journal is owned by ${journal.frameworkRoot}; run framework:unlink before switching framework roots.`);
  }
  if (journal.cohortVersion !== framework.version) {
    throw new Error(`Framework link journal cohort ${journal.cohortVersion} differs from ${framework.version}; run framework:unlink before relinking.`);
  }
  const expectedByName = new Map(framework.packages.map(item => [item.name, item.realpath]));
  const recordedNames = (journal.packages || []).map(item => item.name).sort();
  if (JSON.stringify(recordedNames) !== JSON.stringify([...FRAMEWORK_PACKAGE_NAMES].sort())) {
    throw new Error('Framework link journal has the wrong package identities; run framework:recover.');
  }
  for (const item of journal.packages) {
    if (item.realpath !== expectedByName.get(item.name)) {
      throw new Error(`Framework link journal package path is stale for ${item.name}; run framework:recover then framework:link.`);
    }
  }
  const workspace = workspaceSnapshot(consumerRoot);
  if (workspace.sha256 !== journal.baselineWorkspace?.sha256) {
    throw new Error('Framework link journal workspace is not at its recorded baseline; run framework:recover.');
  }
  try {
    assertLinkedPackages(consumerRoot, { packages: journal.packages });
  }
  catch (error) {
    throw new Error(`Framework link journal is active but its installed graph is stale or mixed; run framework:recover then framework:link. (${error instanceof Error ? error.message : String(error)})`);
  }
}

function markFailure(consumerRoot, journal, error) {
  updatePhase(consumerRoot, journal, 'failed', {
    error: error instanceof Error ? error.message : String(error),
    protectedAfter: protectedSnapshot(consumerRoot),
    workspaceAfter: (() => {
      const snapshot = workspaceSnapshot(consumerRoot);
      return encode(snapshot.bytes);
    })(),
  });
}

function markInconsistent(consumerRoot, journal, kind, details) {
  return updatePhase(consumerRoot, journal, 'inconsistent', {
    conflict: { kind, ...details },
    protectedAfter: protectedSnapshot(consumerRoot),
    workspaceAfter: encode(workspaceSnapshot(consumerRoot).bytes),
  });
}

export function linkConsumer({ consumerRoot, frameworkRoot, run = defaultRun } = {}) {
  const consumer = assertDirectory(consumerRoot || process.cwd(), 'Consumer root');
  const framework = frameworkPackages(frameworkRoot);
  if (isWithin(framework.root, consumer) || isWithin(consumer, framework.root)) {
    throw new Error('Consumer and framework roots must be separate checkouts.');
  }
  const current = readJournal(consumer);
  if (current) {
    if (current.phase === 'active') {
      assertActiveJournal(consumer, current, framework);
      return { action: 'link', phase: 'active', consumerRoot: consumer, frameworkRoot: framework.root, cohortVersion: framework.version };
    }
    throw new Error(`Framework link journal is ${current.phase}; run framework:recover before linking again.`);
  }

  const transactionLock = acquireTransactionLock(consumer);
  try {
    const lockedCurrent = readJournal(consumer);
    if (lockedCurrent) {
      if (lockedCurrent.phase === 'active') {
        assertActiveJournal(consumer, lockedCurrent, framework);
        return { action: 'link', phase: 'active', consumerRoot: consumer, frameworkRoot: framework.root, cohortVersion: framework.version };
      }
      throw new Error(`Framework link journal is ${lockedCurrent.phase}; run framework:recover before linking again.`);
    }
    return linkConsumerTransaction({ consumer, framework, run });
  }
  finally {
    transactionLock.release();
    removeEmptyCreatedStateDirectory(transactionLock);
  }
}

function linkConsumerTransaction({ consumer, framework, run }) {

  ensurePnpmVersion(run, consumer);
  const workspace = workspaceSnapshot(consumer);
  if (!workspace.exists) throw new Error(`Consumer workspace file is missing: ${workspace.path}`);
  const baselineBytes = workspace.bytes;
  const overlay = buildWorkspaceOverlay(baselineBytes.toString('utf8'), framework.packages);
  const protectedBefore = protectedSnapshot(consumer);
  const helper = copyRecoveryHelper(consumer);
  let journal = {
    schemaVersion: SCHEMA_VERSION,
    phase: 'preparing',
    consumerRoot: consumer,
    frameworkRoot: framework.root,
    cohortVersion: framework.version,
    workspacePath: workspace.path,
    baselineWorkspace: { ...encode(baselineBytes), exists: workspace.exists },
    overlayWorkspace: encode(Buffer.from(overlay, 'utf8')),
    protected: protectedBefore,
    packages: framework.packages,
    recoveryHelper: helper,
    createdAt: new Date().toISOString(),
  };
  writeJournal(consumer, journal);

  try {
    // Canonical preparation precedes every consumer metadata write.
    run('pnpm', ['install', '--frozen-lockfile', '--ignore-scripts'], framework.root);
    run('pnpm', ['run', 'build:node'], framework.root);
    if (!protectedFilesMatch(consumer, protectedBefore)) {
      markInconsistent(consumer, journal, 'protected-metadata', { observed: protectedSnapshot(consumer) });
      throw new Error('Consumer metadata changed before the framework overlay was written.');
    }
    const beforeWrite = workspaceSnapshot(consumer);
    if (beforeWrite.exists !== workspace.exists || beforeWrite.sha256 !== workspace.sha256) {
      markInconsistent(consumer, journal, 'workspace-bytes', {
        observedSha256: beforeWrite.sha256,
        observedBase64: beforeWrite.bytes.toString('base64'),
      });
      throw new Error('Consumer workspace changed before the framework overlay was written.');
    }
    journal = updatePhase(consumer, journal, 'canonical-ready');
    fs.writeFileSync(workspace.path, Buffer.from(overlay, 'utf8'));
    journal = updatePhase(consumer, journal, 'overlay-written');
    run('pnpm', ['install', '--no-lockfile', '--ignore-scripts'], consumer);
    journal = updatePhase(consumer, journal, 'consumer-install-complete');
    if (!protectedFilesMatch(consumer, protectedBefore)) {
      markInconsistent(consumer, journal, 'protected-metadata', { observed: protectedSnapshot(consumer) });
      throw new Error('Consumer metadata changed during framework linking.');
    }
    if (!restoreWorkspaceIfSafe(consumer, journal)) {
      throw new Error('Framework overlay was left in place because the consumer workspace changed.');
    }
    assertLinkedPackages(consumer, framework);
    journal = updatePhase(consumer, journal, 'active');
    return { action: 'link', phase: 'active', consumerRoot: consumer, frameworkRoot: framework.root, cohortVersion: framework.version };
  }
  catch (error) {
    const latest = readJournal(consumer) || journal;
    if (latest.phase !== 'inconsistent') {
      try { restoreWorkspaceIfSafe(consumer, latest); }
      catch { /* The journal records the conflict; never overwrite user bytes. */ }
      markFailure(consumer, latest, error);
    }
    throw error;
  }
}

export function statusConsumer(consumerRoot) {
  const consumer = assertDirectory(consumerRoot || process.cwd(), 'Consumer root');
  const journal = readJournal(consumer);
  if (!journal) return { action: 'status', phase: 'registry', consumerRoot: consumer };
  const workspace = workspaceSnapshot(consumer);
  const state = workspace.sha256 === journal.baselineWorkspace.sha256
    ? 'baseline'
    : workspace.sha256 === journal.overlayWorkspace.sha256 ? 'overlay' : 'unexpected';
  let links = 'unknown';
  if (journal.packages) {
    try {
      assertLinkedPackages(consumer, { packages: journal.packages });
      links = 'complete';
    }
    catch {
      links = 'mixed';
    }
  }
  return {
    action: 'status',
    phase: journal.phase,
    consumerRoot: consumer,
    frameworkRoot: journal.frameworkRoot,
    cohortVersion: journal.cohortVersion,
    workspaceState: state,
    workspaceSha256: workspace.sha256,
    protectedMetadataUnchanged: protectedFilesMatch(consumer, journal.protected),
    links,
    conflict: journal.conflict || null,
  };
}

export function invokeRecovery(consumerRoot, action = 'recover') {
  const consumer = assertDirectory(consumerRoot || process.cwd(), 'Consumer root');
  const helper = path.join(consumer, STATE_DIRECTORY, 'recovery.mjs');
  if (!fs.existsSync(helper)) throw new Error(`Retained recovery helper is missing: ${helper}`);
  const result = spawnSync(process.execPath, [helper, action, '--consumer-root', consumer], {
    cwd: consumer,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Framework ${action} recovery failed with exit code ${result.status}.`);
  return { action, consumerRoot: consumer };
}

function parseArguments(argv) {
  const args = [...argv];
  const action = args.shift() || 'status';
  if (action === '--help' || action === '-h') return { help: true };
  let consumerRoot = process.cwd();
  let frameworkRoot = process.env.TORQUE_FRAMEWORK_ROOT;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--consumer-root') consumerRoot = path.resolve(args[++index]);
    else if (args[index] === '--framework-root') frameworkRoot = path.resolve(args[++index]);
    else if (args[index] === '--help' || args[index] === '-h') return { help: true };
  }
  return { action, consumerRoot, frameworkRoot };
}

export function helpText() {
  return `Usage: node scripts/consumer-links.mjs <link|unlink|status|recover> [options]\n\nOptions:\n  --consumer-root PATH   Consumer checkout (default: current directory)\n  --framework-root PATH  Canonical framework checkout (required for link)\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const parsed = parseArguments(process.argv.slice(2));
    if (parsed.help) {
      console.log(helpText());
    }
    else {
      const result = parsed.action === 'link'
        ? linkConsumer(parsed)
        : parsed.action === 'status'
          ? statusConsumer(parsed.consumerRoot)
          : parsed.action === 'recover' || parsed.action === 'unlink'
            ? invokeRecovery(parsed.consumerRoot, parsed.action)
            : (() => { throw new Error(`Unknown framework link action: ${parsed.action}`); })();
      console.log(JSON.stringify(result, null, 2));
    }
  }
  catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
