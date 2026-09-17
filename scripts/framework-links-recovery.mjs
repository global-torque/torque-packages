#!/usr/bin/env node

/*
 * This file is copied into the consumer's ignored .torque-framework-links
 * directory before a link transaction starts.  It intentionally uses only
 * Node built-ins: the canonical checkout may be unavailable when a consumer
 * needs to recover a half-finished local install.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const RECOVERY_SCHEMA_VERSION = 1;
export const STATE_DIRECTORY = '.torque-framework-links';
export const JOURNAL_FILE = 'journal.json';
const LOCK_FILE = 'transaction.lock';
const RECLAIM_LOCK_SUFFIX = '.reclaim';
const MAX_RECLAMATION_DEPTH = 32;
export const FRAMEWORK_PACKAGE_NAMES = Object.freeze([
  '@global-torque/domain-types',
  '@global-torque/invest-core',
  '@global-torque/invest-data',
  '@global-torque/invest-runtime',
  '@global-torque/invest-widgets',
  '@global-torque/invest-features',
  '@global-torque/invest-shell',
]);

const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const readBytes = file => fs.readFileSync(file);
const stateRoot = consumerRoot => path.join(consumerRoot, STATE_DIRECTORY);
const journalPath = consumerRoot => path.join(stateRoot(consumerRoot), JOURNAL_FILE);

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function rawWorkspace(journal) {
  const workspacePath = journal.workspacePath || path.join(journal.consumerRoot, 'pnpm-workspace.yaml');
  return fs.existsSync(workspacePath) ? readBytes(workspacePath) : Buffer.alloc(0);
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function readJournal(consumerRoot) {
  const filePath = journalPath(consumerRoot);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Framework link journal is missing: ${filePath}`);
  }
  let journal;
  try {
    journal = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  catch {
    throw new Error(`Framework link journal is unreadable: ${filePath}`);
  }
  if (!journal || journal.schemaVersion !== RECOVERY_SCHEMA_VERSION) {
    throw new Error('Framework link journal schema is unsupported; preserve it and ask the primary to inspect it.');
  }
  if (journal.consumerRoot !== consumerRoot) {
    throw new Error('Framework link journal consumer root does not match this checkout.');
  }
  return journal;
}

function assertHelperIntegrity(consumerRoot, journal) {
  const expectedPath = path.join(stateRoot(consumerRoot), 'recovery.mjs');
  const recorded = journal.recoveryHelper;
  const stat = fs.lstatSync(expectedPath, { throwIfNoEntry: false });
  if (!recorded || path.resolve(recorded.path || '') !== expectedPath || !stat?.isFile() || stat.isSymbolicLink()) {
    throw new Error('Retained framework recovery helper is missing or has an invalid path; preserve the journal for inspection.');
  }
  const actual = hash(readBytes(expectedPath));
  if (actual !== recorded.sha256) {
    throw new Error('Retained framework recovery helper checksum differs from the journal; preserve the state for inspection.');
  }
}

function setJournal(consumerRoot, journal) {
  const filePath = journalPath(consumerRoot);
  writeJson(filePath, { ...journal, updatedAt: new Date().toISOString() });
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
  const directory = stateRoot(consumerRoot);
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

function removeEmptyStateDirectory(lock) {
  if (!lock) return;
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

function removeEmptyCreatedStateDirectory(lock) {
  if (!lock?.createdStateDirectory) return;
  removeEmptyStateDirectory(lock);
}

function removeRecoveredStateFiles(lock) {
  let current;
  try {
    current = readTransactionLock(lock.lockPath);
  }
  catch {
    return false;
  }
  if (!current || !current.bytes.equals(lock.ownedBytes)) return false;
  for (const file of [JOURNAL_FILE, 'recovery.mjs']) {
    try { fs.unlinkSync(path.join(lock.stateDirectory, file)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return true;
}

function protectedPaths(consumerRoot, journal) {
  const paths = [
    path.join(consumerRoot, 'package.json'),
    path.join(consumerRoot, 'pnpm-lock.yaml'),
    ...(journal.protected?.appManifests || []).map(entry => entry.path),
  ];
  return [...new Set(paths)];
}

function protectedSnapshot(consumerRoot, journal) {
  return protectedPaths(consumerRoot, journal).map(filePath => ({
    path: filePath,
    exists: fs.existsSync(filePath),
    sha256: fs.existsSync(filePath) ? hash(readBytes(filePath)) : null,
  }));
}

function protectedMatches(consumerRoot, journal) {
  const expected = [
    ...(journal.protected?.root || []),
    ...(journal.protected?.appManifests || []),
  ];
  const actual = protectedSnapshot(consumerRoot, journal);
  return expected.length === actual.length
    && expected.every((item, index) => (
      item.path === actual[index].path
      && item.exists === actual[index].exists
      && item.sha256 === actual[index].sha256
    ));
}

function metadataFileSnapshot(filePath) {
  if (!fs.existsSync(filePath)) return { path: filePath, exists: false, bytes: null, sha256: null };
  const bytes = readBytes(filePath);
  return { path: filePath, exists: true, bytes: bytes.toString('base64'), sha256: hash(bytes) };
}

function recoveryMetadataSnapshot(consumerRoot, journal) {
  const workspacePath = journal.workspacePath || path.join(consumerRoot, 'pnpm-workspace.yaml');
  const root = [
    path.join(consumerRoot, 'package.json'),
    path.join(consumerRoot, 'pnpm-lock.yaml'),
    workspacePath,
  ].map(metadataFileSnapshot);
  const appsDirectory = path.join(consumerRoot, 'apps');
  const appManifests = fs.existsSync(appsDirectory)
    ? fs.readdirSync(appsDirectory, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => path.join(appsDirectory, entry.name, 'package.json'))
      .filter(filePath => fs.existsSync(filePath))
      .sort()
      .map(metadataFileSnapshot)
    : [];
  return { root, appManifests };
}

function metadataSnapshotsEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function restoreWorkspace(consumerRoot, journal) {
  const workspacePath = journal.workspacePath || path.join(consumerRoot, 'pnpm-workspace.yaml');
  const currentExists = fs.existsSync(workspacePath);
  const current = currentExists ? readBytes(workspacePath) : Buffer.alloc(0);
  const currentHash = hash(current);
  const baseline = Buffer.from(journal.baselineWorkspace?.base64 || '', 'base64');
  const overlay = Buffer.from(journal.overlayWorkspace?.base64 || '', 'base64');
  const baselineHash = journal.baselineWorkspace?.sha256;
  const overlayHash = journal.overlayWorkspace?.sha256;

  const baselineExists = journal.baselineWorkspace?.exists !== false;
  if (currentExists === baselineExists && currentHash === baselineHash) return { restored: false, currentHash };
  if (!currentExists || currentHash !== overlayHash) {
    const next = {
      ...journal,
      phase: 'inconsistent',
      conflict: {
        kind: 'workspace-bytes',
        observedExists: currentExists,
        observedSha256: currentHash,
        observedBase64: current.toString('base64'),
        expectedBaselineExists: baselineExists,
        expectedBaselineSha256: baselineHash,
        expectedOverlaySha256: overlayHash,
      },
    };
    setJournal(consumerRoot, next);
    throw new Error('Framework link workspace changed unexpectedly; recovery stopped without overwriting it.');
  }
  fs.writeFileSync(workspacePath, baseline, { mode: fs.statSync(workspacePath).mode });
  return { restored: true, currentHash: overlayHash };
}

function runPnpm(consumerRoot, args) {
  const executable = process.env.TORQUE_FRAMEWORK_LINK_PNPM || 'pnpm';
  const result = spawnSync(executable, args, {
    cwd: consumerRoot,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`pnpm ${args.join(' ')} failed with exit code ${result.status}.`);
}

function packageNodeModulesPath(consumerRoot, packageName) {
  const [, scope, name] = packageName.match(/^(@[^/]+)\/(.+)$/u) || [];
  if (!scope) return path.join(consumerRoot, 'node_modules', packageName);
  return path.join(consumerRoot, 'node_modules', scope, name);
}

function packageInstalled(packageRoot, packageName) {
  const installed = packageNodeModulesPath(packageRoot, packageName);
  try { fs.lstatSync(installed); return installed; } catch { return null; }
}

function registryPackageInstalled(packageRoot, packageName) {
  let current = packageRoot;
  while (true) {
    const installed = packageInstalled(current, packageName);
    if (installed) return installed;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
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

function frameworkDependencySpecifiers(manifest) {
  const result = new Map();
  for (const section of [manifest.dependencies, manifest.devDependencies, manifest.optionalDependencies, manifest.peerDependencies]) {
    if (!section || typeof section !== 'object') continue;
    for (const name of FRAMEWORK_PACKAGE_NAMES) {
      if (!Object.hasOwn(section, name)) continue;
      const specifier = section[name];
      if (result.has(name) && result.get(name) !== specifier) {
        throw new Error(`Framework dependency contract for ${name} is mixed within a package manifest.`);
      }
      result.set(name, specifier);
    }
  }
  return result;
}

function frameworkImporters(consumerRoot) {
  return [
    consumerRoot,
    ...(fs.existsSync(path.join(consumerRoot, 'apps'))
      ? fs.readdirSync(path.join(consumerRoot, 'apps'), { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => path.join(consumerRoot, 'apps', entry.name))
      : []),
  ];
}

function currentFrameworkCohort(consumerRoot, importers) {
  const declared = [];
  for (const importer of importers) {
    const manifestPath = path.join(importer, 'package.json');
    if (!fs.existsSync(manifestPath)) continue;
    const manifest = packageManifest(importer);
    for (const [name, specifier] of frameworkDependencySpecifiers(manifest)) {
      if (typeof specifier !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u.test(specifier.trim())) {
        throw new Error(`Registry recovery requires an exact framework cohort declaration for ${name} in ${manifestPath}.`);
      }
      declared.push({ name, version: specifier.trim(), importer });
    }
  }
  const versions = [...new Set(declared.map(item => item.version))];
  if (versions.length === 0) throw new Error('Registry recovery could not derive a framework cohort from consumer declarations.');
  if (versions.length !== 1) throw new Error(`Registry recovery found mixed framework cohorts in consumer declarations: ${versions.join(', ')}.`);
  return versions[0];
}

function packageManifest(packageRoot) {
  return JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
}

function packageLinkState(consumerRoot, journal) {
  const importers = [
    consumerRoot,
    ...(fs.existsSync(path.join(consumerRoot, 'apps'))
      ? fs.readdirSync(path.join(consumerRoot, 'apps'), { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => path.join(consumerRoot, 'apps', entry.name))
      : []),
  ];
  const expectedByName = new Map((journal.packages || []).map(item => [item.name, item.realpath]));
  const queue = [];
  let stale = false;
  let mixed = false;
  for (const importer of importers) {
    const manifestPath = path.join(importer, 'package.json');
    let manifest = {};
    if (fs.existsSync(manifestPath)) {
      try { manifest = packageManifest(importer); } catch { mixed = true; }
    }
    for (const packageName of frameworkDependencies(manifest)) {
      const installed = packageInstalled(importer, packageName);
      if (!installed) { mixed = true; continue; }
      try {
        if (fs.realpathSync(installed) !== expectedByName.get(packageName)) mixed = true;
        else queue.push(packageName);
      }
      catch { stale = true; }
    }
    for (const packageName of FRAMEWORK_PACKAGE_NAMES) {
      const installed = packageInstalled(importer, packageName);
      if (!installed) continue;
      try {
        if (fs.realpathSync(installed) !== expectedByName.get(packageName)) mixed = true;
        else queue.push(packageName);
      }
      catch { stale = true; }
    }
  }
  const visited = new Set();
  while (queue.length) {
    const packageName = queue.shift();
    if (visited.has(packageName)) continue;
    visited.add(packageName);
    const packageRoot = expectedByName.get(packageName);
    if (!packageRoot) { mixed = true; continue; }
    let manifest;
    try { manifest = packageManifest(packageRoot); } catch { mixed = true; continue; }
    for (const dependency of frameworkDependencies(manifest)) {
      const installed = packageInstalled(packageRoot, dependency);
      if (!installed) { mixed = true; continue; }
      try {
        if (fs.realpathSync(installed) !== expectedByName.get(dependency)) mixed = true;
        else queue.push(dependency);
      }
      catch { stale = true; }
    }
  }
  if (stale) return 'stale';
  if (mixed) return 'mixed';
  return visited.size === FRAMEWORK_PACKAGE_NAMES.length ? 'complete' : 'incomplete';
}

function assertRegistryResolution(consumerRoot) {
  const importers = frameworkImporters(consumerRoot);
  const cohort = currentFrameworkCohort(consumerRoot, importers);
  const storePath = path.join(consumerRoot, 'node_modules', '.pnpm');
  let storeRoot;
  try {
    storeRoot = fs.realpathSync(storePath);
  }
  catch {
    throw new Error(`Registry recovery could not resolve the consumer pnpm virtual store: ${storePath}.`);
  }
  const queue = [];
  for (const importer of importers) {
    const manifestPath = path.join(importer, 'package.json');
    let manifest = {};
    if (fs.existsSync(manifestPath)) manifest = packageManifest(importer);
    for (const packageName of frameworkDependencies(manifest)) {
      const installed = packageInstalled(importer, packageName);
      if (!installed) throw new Error(`Registry recovery could not resolve ${packageName} from ${importer}.`);
      queue.push({ name: packageName, installed });
    }
    for (const packageName of FRAMEWORK_PACKAGE_NAMES) {
      const installed = packageInstalled(importer, packageName);
      if (installed) queue.push({ name: packageName, installed });
    }
  }
  if (!queue.length) throw new Error('Registry recovery could not resolve a framework package from an application node_modules.');
  const visited = new Set();
  const covered = new Set();
  while (queue.length) {
    const { name, installed } = queue.shift();
    let resolved;
    try { resolved = fs.realpathSync(installed); } catch { throw new Error(`Registry recovery found a stale link for ${name}.`); }
    if (!isWithin(storeRoot, resolved) || resolved === storeRoot) {
      throw new Error(`Registry recovery found ${name} outside the consumer pnpm virtual store: ${resolved}.`);
    }
    const visit = `${name}\0${resolved}`;
    if (visited.has(visit)) continue;
    const manifest = packageManifest(resolved);
    if (manifest.name !== name) throw new Error(`Registry recovery package identity is invalid for ${name}.`);
    if (manifest.version !== cohort) {
      throw new Error(`Registry recovery found ${name}@${manifest.version}; expected current cohort ${cohort}.`);
    }
    visited.add(visit);
    covered.add(name);
    for (const [dependency, specifier] of frameworkDependencySpecifiers(manifest)) {
      if (specifier !== cohort) {
        throw new Error(`Registry recovery found ${name} -> ${dependency}@${specifier}; expected framework cohort ${cohort}.`);
      }
      const dependencyPath = registryPackageInstalled(resolved, dependency);
      if (!dependencyPath) throw new Error(`Registry recovery could not resolve ${dependency} required by ${name}.`);
      queue.push({ name: dependency, installed: dependencyPath });
    }
  }
  const missing = FRAMEWORK_PACKAGE_NAMES.filter(name => !covered.has(name));
  if (missing.length) throw new Error(`Registry recovery could not resolve the framework cohort: ${missing.join(', ')}.`);
  const lockPath = path.join(consumerRoot, 'pnpm-lock.yaml');
  if (fs.existsSync(lockPath)) {
    const lock = fs.readFileSync(lockPath, 'utf8');
    for (const packageName of FRAMEWORK_PACKAGE_NAMES) {
      const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
      if (new RegExp(`['"]?${escaped}['"]?:\\s*link:`, 'u').test(lock)) {
        throw new Error(`Registry recovery lockfile still contains a link override for ${packageName}.`);
      }
    }
  }
}

export function status(consumerRoot) {
  consumerRoot = fs.realpathSync(consumerRoot);
  const journal = readJournal(consumerRoot);
  const workspacePath = journal.workspacePath || path.join(consumerRoot, 'pnpm-workspace.yaml');
  const workspace = fs.existsSync(workspacePath) ? readBytes(workspacePath) : Buffer.alloc(0);
  const workspaceSha256 = hash(workspace);
  const expected = new Set([
    journal.baselineWorkspace?.sha256,
    journal.overlayWorkspace?.sha256,
  ]);
  const workspaceState = workspaceSha256 === journal.baselineWorkspace?.sha256
    ? 'baseline'
    : workspaceSha256 === journal.overlayWorkspace?.sha256
      ? 'overlay'
      : 'unexpected';
  return {
    schemaVersion: RECOVERY_SCHEMA_VERSION,
    phase: journal.phase,
    consumerRoot,
    frameworkRoot: journal.frameworkRoot,
    workspaceState: expected.has(workspaceSha256) ? workspaceState : 'unexpected',
    workspaceSha256,
    expectedBaselineSha256: journal.baselineWorkspace?.sha256,
    expectedOverlaySha256: journal.overlayWorkspace?.sha256,
    protectedMetadataUnchanged: protectedMatches(consumerRoot, journal),
    links: packageLinkState(consumerRoot, journal),
    conflict: journal.conflict || null,
  };
}

export function recover(consumerRoot, { install = true, run = runPnpm } = {}) {
  consumerRoot = fs.realpathSync(consumerRoot);
  const transactionLock = acquireTransactionLock(consumerRoot);
  let recoveryStateRemoved = false;
  try {
    let journal = readJournal(consumerRoot);
    assertHelperIntegrity(consumerRoot, journal);
    restoreWorkspace(consumerRoot, journal);
    journal = readJournal(consumerRoot);
    // Recovery never restores package manifests or lockfiles. The frozen
    // install below validates the consumer's current registry metadata, which
    // may have been intentionally updated after the local link was created.
    const metadataBeforeInstall = recoveryMetadataSnapshot(consumerRoot, journal);
    let installError;
    if (install) {
      try {
        // Recreate the disposable virtual store and hoisted aliases from the
        // committed registry graph.  pnpm's incremental hoist reconciliation
        // can race duplicate aliases (for example the SDK workspace and
        // registry closures) and attempt to unlink the same destination twice.
        // Force does not relax frozen-lockfile validation and any failure still
        // leaves the journal available for another guarded recovery attempt.
        run(consumerRoot, ['install', '--force', '--frozen-lockfile', '--ignore-scripts']);
      }
      catch (error) {
        installError = error;
      }
    }
    const metadataAfterInstall = recoveryMetadataSnapshot(consumerRoot, journal);
    if (!metadataSnapshotsEqual(metadataBeforeInstall, metadataAfterInstall)) {
      setJournal(consumerRoot, {
        ...journal,
        phase: 'inconsistent',
        conflict: {
          kind: 'protected-metadata-during-recovery',
          before: metadataBeforeInstall,
          observed: metadataAfterInstall,
        },
      });
      throw new Error('Consumer metadata changed during recovery; recovery stopped without overwriting it.');
    }
    if (installError) throw installError;
    assertRegistryResolution(consumerRoot);
    // Remove only state files while this exact lock instance is still ours.
    // If a replacement transaction owns the path, retain the whole state
    // directory so cleanup cannot delete that replacement lock.
    recoveryStateRemoved = removeRecoveredStateFiles(transactionLock);
    return { recovered: true, consumerRoot };
  }
  finally {
    transactionLock.release();
    if (recoveryStateRemoved) removeEmptyStateDirectory(transactionLock);
    else removeEmptyCreatedStateDirectory(transactionLock);
  }
}

export function unlink(consumerRoot) {
  return recover(consumerRoot, { install: true });
}

function parseArguments(argv) {
  const args = [...argv];
  const action = args.shift() || 'status';
  if (action === '--help' || action === '-h') return { help: true };
  let consumerRoot = process.cwd();
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--consumer-root') {
      consumerRoot = path.resolve(args[++index]);
    }
  }
  return { action, consumerRoot };
}

if (process.argv[1] && fs.existsSync(process.argv[1])
  && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  try {
    const parsed = parseArguments(process.argv.slice(2));
    if (parsed.help) {
      console.log('Usage: node recovery.mjs <status|recover|unlink> [--consumer-root PATH]');
      process.exit(0);
    }
    const result = parsed.action === 'status'
      ? status(parsed.consumerRoot)
      : parsed.action === 'recover'
        ? recover(parsed.consumerRoot)
        : parsed.action === 'unlink'
          ? unlink(parsed.consumerRoot)
          : (() => { throw new Error(`Unknown recovery action: ${parsed.action}`); })();
    console.log(JSON.stringify(result, null, 2));
  }
  catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
