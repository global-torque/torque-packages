import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import {
  FRAMEWORK_PACKAGE_NAMES,
  buildWorkspaceOverlay,
  linkConsumer,
  protectedSnapshot,
  sha256,
  statusConsumer,
} from './consumer-links.mjs';
import { recover, status as recoveryStatus } from './framework-links-recovery.mjs';

function fixture(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'torque-framework-links-')));
  const canonical = path.join(root, 'canonical');
  const consumer = path.join(root, 'consumer');
  fs.mkdirSync(path.join(canonical, 'packages'), { recursive: true });
  fs.mkdirSync(path.join(consumer, 'apps/app'), { recursive: true });
  for (const name of FRAMEWORK_PACKAGE_NAMES) {
    const slug = name.slice('@global-torque/'.length);
    const directory = path.join(canonical, 'packages', slug);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ name, version: '0.3.0' }));
  }
  fs.writeFileSync(path.join(canonical, 'package.json'), JSON.stringify({ private: true }));
  fs.writeFileSync(path.join(canonical, 'pnpm-lock.yaml'), 'lockfileVersion: "9.0"\n');
  fs.writeFileSync(path.join(consumer, 'package.json'), JSON.stringify({ private: true }));
  fs.writeFileSync(path.join(consumer, 'pnpm-lock.yaml'), 'lockfileVersion: "9.0"\nimporters: {}\n');
  fs.writeFileSync(path.join(consumer, 'apps/app/package.json'), JSON.stringify({
    name: 'fixture-app',
    dependencies: Object.fromEntries(FRAMEWORK_PACKAGE_NAMES.map(name => [name, '0.2.2'])),
  }));
  const workspace = [
    'packages:',
    '  - apps/*',
    '',
    'overrides:',
    '  "fixture": "1.0.0"',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(consumer, 'pnpm-workspace.yaml'), workspace);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, canonical, consumer, workspace };
}

function fakePnpm(canonical, consumer, calls) {
  return (_executable, args, cwd, options = {}) => {
    calls.push({ args, cwd });
    if (args[0] === '--version') return { stdout: '12.4.2\n' };
    if (cwd === canonical) return { stdout: '' };
    if (args[0] === 'install' && args.includes('--no-lockfile')) {
      for (const name of FRAMEWORK_PACKAGE_NAMES) {
        const [scope, packageName] = name.split('/');
        const target = path.join(cwd, 'apps', 'app', 'node_modules', scope, packageName);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.symlinkSync(path.join(canonical, 'packages', packageName), target, 'dir');
      }
    }
    return { stdout: '' };
  };
}

test('retained recovery accepts a symlink to the same consumer checkout', t => {
  const { root, canonical, consumer } = fixture(t);
  const alias = path.join(root, 'consumer-alias');
  fs.symlinkSync(consumer, alias, 'dir');
  const run = fakePnpm(canonical, consumer, []);
  linkConsumer({ consumerRoot: alias, frameworkRoot: canonical, run });
  assert.equal(recoveryStatus(alias).consumerRoot, consumer);
  const cliStatus = JSON.parse(execFileSync(process.execPath, [
    path.join(alias, '.torque-framework-links/recovery.mjs'), 'status', '--consumer-root', alias,
  ], { encoding: 'utf8' }));
  assert.equal(cliStatus.consumerRoot, consumer);
  installRegistryFramework(consumer);
  recover(alias, { install: false });
  assert.equal(fs.existsSync(path.join(consumer, '.torque-framework-links')), false);
});

const registryFrameworkDependencies = Object.freeze({
  '@global-torque/domain-types': [],
  '@global-torque/invest-core': ['@global-torque/domain-types'],
  '@global-torque/invest-data': ['@global-torque/domain-types', '@global-torque/invest-core'],
  '@global-torque/invest-runtime': ['@global-torque/domain-types', '@global-torque/invest-core', '@global-torque/invest-data'],
  '@global-torque/invest-widgets': ['@global-torque/domain-types', '@global-torque/invest-core'],
  '@global-torque/invest-features': [
    '@global-torque/domain-types',
    '@global-torque/invest-core',
    '@global-torque/invest-data',
    '@global-torque/invest-runtime',
    '@global-torque/invest-widgets',
  ],
  '@global-torque/invest-shell': [
    '@global-torque/domain-types',
    '@global-torque/invest-core',
    '@global-torque/invest-runtime',
    '@global-torque/invest-widgets',
  ],
});

function registryPackageRoot(consumer, name, version, suffix = '') {
  const identity = `${name.replace('/', '+')}@${version}${suffix}`;
  return path.join(consumer, 'node_modules', '.pnpm', identity, 'node_modules', ...name.split('/'));
}

function installRegistryFramework(consumer, { version = '0.2.2', duplicate = null } = {}) {
  const packageRoots = new Map();
  for (const name of FRAMEWORK_PACKAGE_NAMES) {
    const packageRoot = registryPackageRoot(consumer, name, version);
    packageRoots.set(name, packageRoot);
    fs.mkdirSync(packageRoot, { recursive: true });
  }
  for (const name of FRAMEWORK_PACKAGE_NAMES) {
    const packageRoot = packageRoots.get(name);
    fs.writeFileSync(path.join(packageRoot, 'package.json'), JSON.stringify({
      name,
      version,
      dependencies: Object.fromEntries(registryFrameworkDependencies[name].map(dependency => [dependency, version])),
    }));
  }
  for (const [name, packageRoot] of packageRoots) {
    for (const dependency of registryFrameworkDependencies[name]) {
      const installed = path.join(packageRoot, 'node_modules', ...dependency.split('/'));
      fs.mkdirSync(path.dirname(installed), { recursive: true });
      fs.symlinkSync(packageRoots.get(dependency), installed, 'dir');
    }
    const appInstalled = path.join(consumer, 'apps/app/node_modules', ...name.split('/'));
    fs.mkdirSync(path.dirname(appInstalled), { recursive: true });
    fs.rmSync(appInstalled, { recursive: true, force: true });
    fs.symlinkSync(packageRoot, appInstalled, 'dir');
  }
  if (duplicate) {
    const duplicateRoot = registryPackageRoot(consumer, duplicate.name, version, '-duplicate');
    fs.mkdirSync(duplicateRoot, { recursive: true });
    fs.writeFileSync(path.join(duplicateRoot, 'package.json'), JSON.stringify({
      name: duplicate.name,
      version,
      dependencies: Object.fromEntries(registryFrameworkDependencies[duplicate.name].map(dependency => [dependency, version])),
    }));
    for (const dependency of registryFrameworkDependencies[duplicate.name]) {
      const installed = path.join(duplicateRoot, 'node_modules', ...dependency.split('/'));
      fs.mkdirSync(path.dirname(installed), { recursive: true });
      fs.symlinkSync(packageRoots.get(dependency), installed, 'dir');
    }
    const target = duplicate.installed || path.join(consumer, 'apps/app/node_modules', ...duplicate.name.split('/'));
    fs.rmSync(target, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.symlinkSync(duplicateRoot, target, 'dir');
    packageRoots.set(`${duplicate.name}:duplicate`, duplicateRoot);
  }
  return packageRoots;
}

test('workspace overlay is byte-preserving and contains the complete seven-package cohort', () => {
  const baseline = 'packages:\n  - apps/*\n\noverrides:\n  "fixture": "1.0.0"\n';
  const packages = FRAMEWORK_PACKAGE_NAMES.map(name => ({
    name,
    realpath: `/tmp/canonical/${name.slice('@global-torque/'.length)}`,
  }));
  const overlay = buildWorkspaceOverlay(baseline, packages);
  assert.equal(overlay.slice(0, baseline.indexOf('overrides:')), baseline.slice(0, baseline.indexOf('overrides:')));
  assert.match(overlay, /torque-framework-links:start schema=1/u);
  assert.match(overlay, /torque-framework-links:end/u);
  for (const item of packages) assert.match(overlay, new RegExp(`'${item.name.replace('/', '\\/')}': 'link:`));
  assert.throws(() => buildWorkspaceOverlay(overlay, packages), /already contains a framework link marker/u);
});

test('workspace overlay creates missing or empty overrides and rejects quoted selectors', () => {
  const packages = FRAMEWORK_PACKAGE_NAMES.map(name => ({ name, realpath: `/tmp/canonical/${name.slice('@global-torque/'.length)}` }));
  const missing = buildWorkspaceOverlay('packages:\n  - apps/*\n', packages);
  assert.match(missing, /^overrides:\n# torque-framework-links:start/mu);
  const empty = buildWorkspaceOverlay('packages:\n  - apps/*\noverrides: {}\n', packages);
  assert.match(empty, /^overrides:\n# torque-framework-links:start/mu);
  assert.throws(
    () => buildWorkspaceOverlay('overrides:\n  \'@global-torque/domain-types\': 0.2.2\n', packages),
    /already claim @global-torque\/domain-types/u,
  );
});

test('link transaction proves metadata protection, complete links, and dirty workspace restoration', t => {
  const { canonical, consumer, workspace } = fixture(t);
  const packageBytes = fs.readFileSync(path.join(consumer, 'package.json'));
  const lockBytes = fs.readFileSync(path.join(consumer, 'pnpm-lock.yaml'));
  const calls = [];
  const result = linkConsumer({ consumerRoot: consumer, frameworkRoot: canonical, run: fakePnpm(canonical, consumer, calls) });
  assert.equal(result.phase, 'active');
  assert.equal(fs.readFileSync(path.join(consumer, 'pnpm-workspace.yaml'), 'utf8'), workspace);
  assert.deepEqual(fs.readFileSync(path.join(consumer, 'package.json')), packageBytes);
  assert.deepEqual(fs.readFileSync(path.join(consumer, 'pnpm-lock.yaml')), lockBytes);
  assert.deepEqual(statusConsumer(consumer).links, 'complete');
  assert.equal(calls.filter(call => call.cwd === canonical).length, 2);
  const journal = JSON.parse(fs.readFileSync(path.join(consumer, '.torque-framework-links/journal.json'), 'utf8'));
  assert.equal(journal.packages.length, 7);
  assert.equal(journal.recoveryHelper.sha256, sha256(fs.readFileSync(journal.recoveryHelper.path)));
  assert.equal(protectedSnapshot(consumer).root[1].sha256, sha256(lockBytes));
});

test('active link retries verify owner and installed graph before reporting success', t => {
  const { root, canonical, consumer } = fixture(t);
  linkConsumer({ consumerRoot: consumer, frameworkRoot: canonical, run: fakePnpm(canonical, consumer, []) });
  const sameOwner = linkConsumer({ consumerRoot: consumer, frameworkRoot: canonical, run: fakePnpm(canonical, consumer, []) });
  assert.equal(sameOwner.phase, 'active');

  const stale = path.join(consumer, 'apps/app/node_modules/@global-torque/invest-core');
  fs.rmSync(stale, { recursive: true, force: true });
  fs.mkdirSync(stale, { recursive: true });
  fs.writeFileSync(path.join(stale, 'package.json'), JSON.stringify({ name: '@global-torque/invest-core', version: '0.2.2' }));
  assert.throws(
    () => linkConsumer({ consumerRoot: consumer, frameworkRoot: canonical, run: fakePnpm(canonical, consumer, []) }),
    /active but its installed graph is stale or mixed/u,
  );

  const otherCanonical = path.join(root, 'other-canonical');
  fs.cpSync(canonical, otherCanonical, { recursive: true });
  assert.throws(
    () => linkConsumer({ consumerRoot: consumer, frameworkRoot: otherCanonical, run: fakePnpm(otherCanonical, consumer, []) }),
    /owned by .*torque-framework-links/u,
  );
});

test('retained recovery accepts only recorded workspace bytes and detects concurrent protected edits', t => {
  const { canonical, consumer } = fixture(t);
  linkConsumer({ consumerRoot: consumer, frameworkRoot: canonical, run: fakePnpm(canonical, consumer, []) });
  const workspacePath = path.join(consumer, 'pnpm-workspace.yaml');
  fs.writeFileSync(workspacePath, `${fs.readFileSync(workspacePath, 'utf8')}# user edit\n`);
  assert.throws(() => recover(consumer, { install: false }), /changed unexpectedly/u);
  const journalPath = path.join(consumer, '.torque-framework-links/journal.json');
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
  assert.equal(journal.phase, 'inconsistent');
  assert.match(journal.conflict.observedBase64, /^[A-Za-z0-9+/]+=*$/u);
});

test('retained recovery detects deletion of an empty baseline workspace', t => {
  const { canonical, consumer } = fixture(t);
  fs.writeFileSync(path.join(consumer, 'pnpm-workspace.yaml'), '');
  linkConsumer({ consumerRoot: consumer, frameworkRoot: canonical, run: fakePnpm(canonical, consumer, []) });
  installRegistryFramework(consumer);
  fs.rmSync(path.join(consumer, 'pnpm-workspace.yaml'));
  assert.throws(() => recover(consumer, { install: false }), /changed unexpectedly/u);
  const journal = JSON.parse(fs.readFileSync(path.join(consumer, '.torque-framework-links/journal.json'), 'utf8'));
  assert.equal(journal.phase, 'inconsistent');
  assert.equal(journal.conflict.observedExists, false);
  assert.equal(fs.existsSync(path.join(consumer, 'pnpm-workspace.yaml')), false);
});

test('retained recovery handles app-only framework imports and clears local state after registry restore', t => {
  const { canonical, consumer, workspace } = fixture(t);
  linkConsumer({ consumerRoot: consumer, frameworkRoot: canonical, run: fakePnpm(canonical, consumer, []) });
  installRegistryFramework(consumer);
  const recoveryCalls = [];
  const result = recover(consumer, {
    run: (root, args) => recoveryCalls.push({ root, args }),
  });
  assert.equal(result.recovered, true);
  assert.equal(fs.readFileSync(path.join(consumer, 'pnpm-workspace.yaml'), 'utf8'), workspace);
  assert.deepEqual(recoveryCalls, [{
    root: consumer,
    args: ['install', '--force', '--frozen-lockfile', '--ignore-scripts'],
  }]);
  assert.equal(fs.existsSync(path.join(consumer, '.torque-framework-links')), false);
});

test('recovery validates current metadata after an intentional consumer update', t => {
  const { canonical, consumer } = fixture(t);
  linkConsumer({ consumerRoot: consumer, frameworkRoot: canonical, run: fakePnpm(canonical, consumer, []) });
  const rootManifest = path.join(consumer, 'package.json');
  const lockfile = path.join(consumer, 'pnpm-lock.yaml');
  const appManifest = path.join(consumer, 'apps/app/package.json');
  fs.writeFileSync(rootManifest, JSON.stringify({ private: true, description: 'updated after linking' }));
  fs.appendFileSync(lockfile, 'updated: true\n');
  fs.writeFileSync(appManifest, JSON.stringify({
    name: 'fixture-app',
    dependencies: Object.fromEntries(FRAMEWORK_PACKAGE_NAMES.map(name => [name, '0.2.2'])),
  }));
  installRegistryFramework(consumer);
  const updatedRootBytes = fs.readFileSync(rootManifest);
  const result = recover(consumer, {
    run: () => {},
  });
  assert.equal(result.recovered, true);
  assert.deepEqual(fs.readFileSync(rootManifest), updatedRootBytes);
  assert.equal(fs.existsSync(path.join(consumer, '.torque-framework-links')), false);
});

test('link and recovery serialize through the retained transaction lock', t => {
  const { canonical, consumer } = fixture(t);
  const stateDirectory = path.join(consumer, '.torque-framework-links');
  fs.mkdirSync(stateDirectory, { recursive: true });
  fs.writeFileSync(path.join(stateDirectory, 'transaction.lock'), JSON.stringify({
    pid: process.pid,
    lockInstance: 'fixture-live-lock',
    startedAt: new Date().toISOString(),
  }));
  assert.throws(
    () => linkConsumer({ consumerRoot: consumer, frameworkRoot: canonical, run: fakePnpm(canonical, consumer, []) }),
    /already running/u,
  );
  fs.rmSync(stateDirectory, { recursive: true, force: true });
});

test('link preflight removes only its newly-created empty state directory', t => {
  for (const scenario of ['wrong-pnpm', 'missing-workspace', 'rejected-overlay']) {
    const { canonical, consumer } = fixture(t);
    const stateDirectory = path.join(consumer, '.torque-framework-links');
    const calls = [];
    const run = fakePnpm(canonical, consumer, calls);
    if (scenario === 'wrong-pnpm') {
      assert.throws(
        () => linkConsumer({ consumerRoot: consumer, frameworkRoot: canonical, run: () => ({ stdout: '10.34.4\n' }) }),
        /requires pnpm 12\.4\.2/u,
      );
    }
    else if (scenario === 'missing-workspace') {
      fs.rmSync(path.join(consumer, 'pnpm-workspace.yaml'));
      assert.throws(
        () => linkConsumer({ consumerRoot: consumer, frameworkRoot: canonical, run }),
        /workspace file is missing/u,
      );
    }
    else {
      fs.appendFileSync(path.join(consumer, 'pnpm-workspace.yaml'), '# torque-framework-links:start\n');
      assert.throws(
        () => linkConsumer({ consumerRoot: consumer, frameworkRoot: canonical, run }),
        /already contains a framework link marker/u,
      );
    }
    assert.equal(fs.existsSync(stateDirectory), false, `${scenario} left a new state directory`);
  }

  const preserved = fixture(t);
  const stateDirectory = path.join(preserved.consumer, '.torque-framework-links');
  fs.mkdirSync(stateDirectory, { recursive: true });
  fs.writeFileSync(path.join(stateDirectory, 'preexisting.txt'), 'keep\n');
  assert.throws(
    () => linkConsumer({ consumerRoot: preserved.consumer, frameworkRoot: preserved.canonical, run: () => ({ stdout: '10.34.4\n' }) }),
    /requires pnpm 12\.4\.2/u,
  );
  assert.equal(fs.readFileSync(path.join(stateDirectory, 'preexisting.txt'), 'utf8'), 'keep\n');
});

test('lock release preserves a replacement lock instance', t => {
  const { canonical, consumer } = fixture(t);
  const stateDirectory = path.join(consumer, '.torque-framework-links');
  const replacement = { pid: 999999, lockInstance: 'replacement-lock', startedAt: new Date().toISOString() };
  const run = (executable, args, cwd, options) => {
    if (args[0] === '--version') {
      fs.writeFileSync(path.join(stateDirectory, 'transaction.lock'), JSON.stringify(replacement));
      return { stdout: '12.4.2\n' };
    }
    return fakePnpm(canonical, consumer, [])(executable, args, cwd, options);
  };
  linkConsumer({ consumerRoot: consumer, frameworkRoot: canonical, run });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(stateDirectory, 'transaction.lock'), 'utf8')), replacement);
});

test('recovery contender fails closed for a live empty lock', t => {
  const { canonical, consumer } = fixture(t);
  linkConsumer({ consumerRoot: consumer, frameworkRoot: canonical, run: fakePnpm(canonical, consumer, []) });
  installRegistryFramework(consumer);
  const stateDirectory = path.join(consumer, '.torque-framework-links');
  const lockPath = path.join(stateDirectory, 'transaction.lock');
  fs.rmSync(lockPath, { force: true });
  const descriptor = fs.openSync(lockPath, 'wx');
  try {
    const workspace = fs.readFileSync(path.join(consumer, 'pnpm-workspace.yaml'));
    const journal = fs.readFileSync(path.join(stateDirectory, 'journal.json'));
    assert.throws(() => recover(consumer, { install: false }), /empty or malformed/u);
    assert.deepEqual(fs.readFileSync(path.join(consumer, 'pnpm-workspace.yaml')), workspace);
    assert.deepEqual(fs.readFileSync(path.join(stateDirectory, 'journal.json')), journal);
    assert.equal(fs.statSync(lockPath).size, 0);
  }
  finally {
    fs.closeSync(descriptor);
  }
});

test('recovery reclaims an interrupted dead-owner claim before recovering', t => {
  const { canonical, consumer } = fixture(t);
  linkConsumer({ consumerRoot: consumer, frameworkRoot: canonical, run: fakePnpm(canonical, consumer, []) });
  installRegistryFramework(consumer);
  const lockPath = path.join(consumer, '.torque-framework-links/transaction.lock');
  fs.writeFileSync(lockPath, JSON.stringify({
    pid: 2_000_000_000,
    lockInstance: 'dead-owner',
    startedAt: new Date().toISOString(),
  }));
  fs.writeFileSync(`${lockPath}.reclaim`, JSON.stringify({
    pid: 2_000_000_000,
    lockInstance: 'interrupted-claim',
    startedAt: new Date().toISOString(),
  }));
  assert.equal(recover(consumer, { install: false }).recovered, true);
  assert.equal(fs.existsSync(path.join(consumer, '.torque-framework-links')), false);
});

test('competing stale-lock reclamation fails closed while another claim exists', t => {
  const { canonical, consumer } = fixture(t);
  const stateDirectory = path.join(consumer, '.torque-framework-links');
  fs.mkdirSync(stateDirectory, { recursive: true });
  const lockPath = path.join(stateDirectory, 'transaction.lock');
  fs.writeFileSync(lockPath, JSON.stringify({
    pid: 2_000_000_000,
    lockInstance: 'stale-owner',
    startedAt: new Date().toISOString(),
  }));
  fs.writeFileSync(`${lockPath}.reclaim`, JSON.stringify({
    pid: process.pid,
    lockInstance: 'live-contender',
    startedAt: new Date().toISOString(),
  }));
  assert.throws(
    () => linkConsumer({ consumerRoot: consumer, frameworkRoot: canonical, run: fakePnpm(canonical, consumer, []) }),
    /stale-lock reclamation is already running/u,
  );
  assert.equal(fs.existsSync(lockPath), true);
  assert.equal(fs.readFileSync(lockPath, 'utf8').includes('stale-owner'), true);
});

test('stale-lock reclamation preserves an unverifiable claim', t => {
  const { canonical, consumer } = fixture(t);
  const stateDirectory = path.join(consumer, '.torque-framework-links');
  fs.mkdirSync(stateDirectory, { recursive: true });
  const lockPath = path.join(stateDirectory, 'transaction.lock');
  const claimPath = `${lockPath}.reclaim`;
  fs.writeFileSync(lockPath, JSON.stringify({
    pid: 2_000_000_000,
    lockInstance: 'stale-owner',
    startedAt: new Date().toISOString(),
  }));
  fs.writeFileSync(claimPath, '');
  assert.throws(
    () => linkConsumer({ consumerRoot: consumer, frameworkRoot: canonical, run: fakePnpm(canonical, consumer, []) }),
    /empty or malformed/u,
  );
  assert.equal(fs.existsSync(lockPath), true);
  assert.equal(fs.existsSync(claimPath), true);
});

test('recovery cleanup preserves a replacement lock instance', t => {
  const { canonical, consumer } = fixture(t);
  linkConsumer({ consumerRoot: consumer, frameworkRoot: canonical, run: fakePnpm(canonical, consumer, []) });
  installRegistryFramework(consumer);
  const stateDirectory = path.join(consumer, '.torque-framework-links');
  const replacement = { pid: 999999, lockInstance: 'recovery-replacement-lock', startedAt: new Date().toISOString() };
  const result = recover(consumer, {
    run: () => fs.writeFileSync(path.join(stateDirectory, 'transaction.lock'), JSON.stringify(replacement)),
  });
  assert.equal(result.recovered, true);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(stateDirectory, 'transaction.lock'), 'utf8')), replacement);
  assert.equal(fs.existsSync(path.join(stateDirectory, 'journal.json')), true);
});

test('metadata changes during the consumer install stop recovery without restoring workspace bytes', t => {
  const { canonical, consumer } = fixture(t);
  const calls = [];
  const fake = fakePnpm(canonical, consumer, calls);
  const run = (executable, args, cwd, options) => {
    const result = fake(executable, args, cwd, options);
    if (cwd === consumer && args.includes('--no-lockfile')) {
      fs.appendFileSync(path.join(consumer, 'package.json'), '\nroot edit\n');
      fs.appendFileSync(path.join(consumer, 'pnpm-lock.yaml'), '\nlock edit\n');
      const manifest = path.join(consumer, 'apps/app/package.json');
      fs.appendFileSync(manifest, '\napp edit\n');
    }
    return result;
  };
  assert.throws(
    () => linkConsumer({ consumerRoot: consumer, frameworkRoot: canonical, run }),
    /metadata changed during framework linking/u,
  );
  const journal = JSON.parse(fs.readFileSync(path.join(consumer, '.torque-framework-links/journal.json'), 'utf8'));
  assert.equal(journal.phase, 'inconsistent');
  assert.equal(journal.conflict.kind, 'protected-metadata');
  assert.match(fs.readFileSync(path.join(consumer, 'pnpm-workspace.yaml'), 'utf8'), /torque-framework-links:start/u);
  assert.match(fs.readFileSync(path.join(consumer, 'package.json'), 'utf8'), /root edit/u);
  assert.match(fs.readFileSync(path.join(consumer, 'pnpm-lock.yaml'), 'utf8'), /lock edit/u);
  assert.match(fs.readFileSync(path.join(consumer, 'apps/app/package.json'), 'utf8'), /app edit/u);
  assert.equal(calls.some(call => call.cwd === consumer && call.args.includes('--no-lockfile')), true);
});

test('concurrent workspace edits are preserved and retained recovery reports a conflict', t => {
  const { canonical, consumer } = fixture(t);
  const fake = fakePnpm(canonical, consumer, []);
  const run = (executable, args, cwd, options) => {
    const result = fake(executable, args, cwd, options);
    if (cwd === consumer && args.includes('--no-lockfile')) {
      fs.appendFileSync(path.join(consumer, 'pnpm-workspace.yaml'), '# concurrent edit\n');
    }
    return result;
  };
  assert.throws(
    () => linkConsumer({ consumerRoot: consumer, frameworkRoot: canonical, run }),
    /overlay was left in place because the consumer workspace changed/u,
  );
  const workspace = fs.readFileSync(path.join(consumer, 'pnpm-workspace.yaml'), 'utf8');
  assert.match(workspace, /torque-framework-links:start/u);
  assert.match(workspace, /# concurrent edit/u);
  assert.equal(JSON.parse(fs.readFileSync(path.join(consumer, '.torque-framework-links/journal.json'), 'utf8')).phase, 'inconsistent');
  assert.equal(recoveryStatus(consumer).phase, 'inconsistent');
});

test('recovery compares current metadata around install and preserves concurrent changes', t => {
  const { canonical, consumer, workspace } = fixture(t);
  linkConsumer({ consumerRoot: consumer, frameworkRoot: canonical, run: fakePnpm(canonical, consumer, []) });
  installRegistryFramework(consumer);
  const deletedAppManifest = path.join(consumer, 'apps/app/package.json');
  const addedAppManifest = path.join(consumer, 'apps/new/package.json');
  const rootManifest = path.join(consumer, 'package.json');
  const beforeRoot = fs.readFileSync(rootManifest);
  const run = () => {
    fs.appendFileSync(rootManifest, '\nconcurrent root edit\n');
    fs.rmSync(deletedAppManifest);
    fs.mkdirSync(path.dirname(addedAppManifest), { recursive: true });
    fs.writeFileSync(addedAppManifest, '{"name":"new-app"}\n');
  };
  assert.throws(() => recover(consumer, { run }), /metadata changed during recovery/u);
  const journal = JSON.parse(fs.readFileSync(path.join(consumer, '.torque-framework-links/journal.json'), 'utf8'));
  assert.equal(journal.phase, 'inconsistent');
  assert.equal(journal.conflict.kind, 'protected-metadata-during-recovery');
  assert.deepEqual(journal.conflict.before.root.find(item => item.path === path.join(consumer, 'pnpm-workspace.yaml')).bytes,
    Buffer.from(workspace).toString('base64'));
  assert.deepEqual(fs.readFileSync(rootManifest), Buffer.concat([beforeRoot, Buffer.from('\nconcurrent root edit\n')]));
  assert.equal(fs.existsSync(deletedAppManifest), false);
  assert.equal(fs.readFileSync(addedAppManifest, 'utf8'), '{"name":"new-app"}\n');
  assert.equal(fs.existsSync(path.join(consumer, '.torque-framework-links/journal.json')), true);
});

test('recovery visits duplicate physical package instances independently', t => {
  const { canonical, consumer } = fixture(t);
  linkConsumer({ consumerRoot: consumer, frameworkRoot: canonical, run: fakePnpm(canonical, consumer, []) });
  const secondAppManifest = path.join(consumer, 'apps/second/package.json');
  const secondInstalled = path.join(consumer, 'apps/second/node_modules', '@global-torque', 'invest-runtime');
  fs.mkdirSync(path.dirname(secondAppManifest), { recursive: true });
  fs.writeFileSync(secondAppManifest, JSON.stringify({
    name: 'second-app',
    dependencies: { '@global-torque/invest-runtime': '0.2.2' },
  }));
  installRegistryFramework(consumer, { duplicate: { name: '@global-torque/invest-runtime', installed: secondInstalled } });
  assert.equal(recover(consumer, { install: false }).recovered, true);
});

test('recovery rejects a bad dependency edge in a second physical package instance', t => {
  const { canonical, consumer } = fixture(t);
  linkConsumer({ consumerRoot: consumer, frameworkRoot: canonical, run: fakePnpm(canonical, consumer, []) });
  const secondAppManifest = path.join(consumer, 'apps/second/package.json');
  const secondInstalled = path.join(consumer, 'apps/second/node_modules', '@global-torque', 'invest-runtime');
  fs.mkdirSync(path.dirname(secondAppManifest), { recursive: true });
  fs.writeFileSync(secondAppManifest, JSON.stringify({
    name: 'second-app',
    dependencies: { '@global-torque/invest-runtime': '0.2.2' },
  }));
  installRegistryFramework(consumer, { duplicate: { name: '@global-torque/invest-runtime', installed: secondInstalled } });
  const secondData = path.join(secondInstalled, 'node_modules', '@global-torque', 'invest-data');
  fs.rmSync(secondData, { recursive: true, force: true });
  fs.symlinkSync(path.join(canonical, 'packages/invest-data'), secondData, 'dir');
  assert.throws(() => recover(consumer, { install: false }), /outside the consumer pnpm virtual store/u);
  assert.equal(fs.existsSync(path.join(consumer, '.torque-framework-links/journal.json')), true);
});

test('recovery rejects a mixed transitive registry cohort inside the pnpm store', t => {
  const { canonical, consumer } = fixture(t);
  linkConsumer({ consumerRoot: consumer, frameworkRoot: canonical, run: fakePnpm(canonical, consumer, []) });
  installRegistryFramework(consumer);
  const runtimeRoot = registryPackageRoot(consumer, '@global-torque/invest-runtime', '0.2.2');
  const runtimeManifest = JSON.parse(fs.readFileSync(path.join(runtimeRoot, 'package.json'), 'utf8'));
  runtimeManifest.dependencies['@global-torque/invest-data'] = '0.2.1';
  fs.writeFileSync(path.join(runtimeRoot, 'package.json'), JSON.stringify(runtimeManifest));
  assert.throws(() => recover(consumer, { install: false }), /expected framework cohort 0\.2\.2/u);
  assert.equal(fs.existsSync(path.join(consumer, '.torque-framework-links/journal.json')), true);
});

test('recovery accepts an intentional current cohort update', t => {
  const { canonical, consumer } = fixture(t);
  linkConsumer({ consumerRoot: consumer, frameworkRoot: canonical, run: fakePnpm(canonical, consumer, []) });
  const appManifest = path.join(consumer, 'apps/app/package.json');
  fs.writeFileSync(appManifest, JSON.stringify({
    name: 'fixture-app',
    dependencies: Object.fromEntries(FRAMEWORK_PACKAGE_NAMES.map(name => [name, '0.3.0'])),
  }));
  installRegistryFramework(consumer, { version: '0.3.0' });
  assert.equal(recover(consumer, { install: false }).recovered, true);
});

test('stale app links are visible in status instead of being accepted as a complete cohort', t => {
  const { canonical, consumer } = fixture(t);
  linkConsumer({ consumerRoot: consumer, frameworkRoot: canonical, run: fakePnpm(canonical, consumer, []) });
  const target = path.join(consumer, 'apps/app/node_modules/@global-torque/invest-core');
  fs.rmSync(target, { recursive: true, force: true });
  fs.symlinkSync(path.join(consumer, 'missing-framework-source'), target, 'dir');
  assert.equal(statusConsumer(consumer).links, 'mixed');
  assert.equal(recoveryStatus(consumer).links, 'stale');
});

test('linking rejects roots that overlap and framework cohorts with mixed versions', t => {
  const { canonical, consumer } = fixture(t);
  assert.throws(
    () => linkConsumer({ consumerRoot: canonical, frameworkRoot: canonical, run: fakePnpm(canonical, consumer, []) }),
    /separate checkouts/u,
  );
  const manifest = path.join(canonical, 'packages/invest-core/package.json');
  const original = fs.readFileSync(manifest);
  fs.writeFileSync(manifest, JSON.stringify({ name: '@global-torque/invest-core', version: '99.0.0' }));
  try {
    assert.throws(
      () => linkConsumer({ consumerRoot: consumer, frameworkRoot: canonical, run: fakePnpm(canonical, consumer, []) }),
      /cohort is mixed/u,
    );
  }
  finally {
    fs.writeFileSync(manifest, original);
  }
});

test('interrupted consumer install restores the baseline and leaves retryable journal state', t => {
  const { canonical, consumer, workspace } = fixture(t);
  const run = fakePnpm(canonical, consumer, []);
  const interrupted = (executable, args, cwd, options) => {
    if (cwd === consumer && args.includes('--no-lockfile')) throw new Error('simulated interrupted install');
    return run(executable, args, cwd, options);
  };
  assert.throws(() => linkConsumer({ consumerRoot: consumer, frameworkRoot: canonical, run: interrupted }), /simulated interrupted install/u);
  assert.equal(fs.readFileSync(path.join(consumer, 'pnpm-workspace.yaml'), 'utf8'), workspace);
  const journal = JSON.parse(fs.readFileSync(path.join(consumer, '.torque-framework-links/journal.json'), 'utf8'));
  assert.equal(journal.phase, 'failed');
  installRegistryFramework(consumer);
  assert.equal(recover(consumer, { install: false }).recovered, true);
});

test('retained recovery is self-contained and records stable helper metadata', () => {
  const source = fs.readFileSync(new URL('./framework-links-recovery.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /from ['"](?!node:)/u);
  assert.match(source, /RECOVERY_SCHEMA_VERSION = 1/u);
  assert.equal(sha256(Buffer.from(source)).length, 64);
  assert.equal(crypto.createHash('sha256').update(source).digest('hex').length, 64);
});

test('recovery stops when the retained helper bytes no longer match its journal', t => {
  const { canonical, consumer } = fixture(t);
  linkConsumer({ consumerRoot: consumer, frameworkRoot: canonical, run: fakePnpm(canonical, consumer, []) });
  const helperPath = path.join(consumer, '.torque-framework-links/recovery.mjs');
  fs.appendFileSync(helperPath, '\n// tampered\n');
  assert.throws(() => recover(consumer, { install: false }), /checksum differs/u);
  assert.equal(fs.existsSync(path.join(consumer, '.torque-framework-links/journal.json')), true);
});
