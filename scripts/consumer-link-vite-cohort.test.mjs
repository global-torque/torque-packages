import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createServer } from 'vite';

import { FRAMEWORK_PACKAGE_NAMES, frameworkLinkViteConfig } from './consumer-link-vite.mjs';

const cohortVersion = '0.4.3';

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'framework-vite-cohort-'));
  const canonical = path.join(root, 'canonical');
  const consumer = path.join(root, 'consumer');
  const app = path.join(consumer, 'apps', 'dashboard');
  const state = path.join(consumer, '.torque-framework-links');
  fs.mkdirSync(path.join(canonical, 'packages'), { recursive: true });
  fs.mkdirSync(path.join(app, 'node_modules', '@global-torque'), { recursive: true });
  fs.mkdirSync(state, { recursive: true });
  fs.writeFileSync(path.join(canonical, 'package.json'), JSON.stringify({ type: 'module' }));
  const packages = FRAMEWORK_PACKAGE_NAMES.map(name => {
    const packageRoot = path.join(canonical, 'packages', name.slice('@global-torque/'.length));
    fs.mkdirSync(packageRoot, { recursive: true });
    const item = { name, version: cohortVersion, path: packageRoot };
    fs.writeFileSync(path.join(packageRoot, 'package.json'), JSON.stringify({ name, version: cohortVersion }));
    fs.symlinkSync(packageRoot, path.join(app, 'node_modules', ...name.split('/')));
    return item;
  });
  fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify({
    dependencies: Object.fromEntries(FRAMEWORK_PACKAGE_NAMES.map(name => [name, cohortVersion])),
  }));
  fs.writeFileSync(path.join(state, 'journal.json'), JSON.stringify({
    schemaVersion: 1,
    phase: 'active',
    consumerRoot: consumer,
    frameworkRoot: canonical,
    cohortVersion,
    packages,
  }));
  return { root, canonical, consumer, packages };
}

function addUiKitPeerFixture(fixture) {
  const app = path.join(fixture.consumer, 'apps', 'dashboard');
  const uiKitStore = path.join(
    fixture.consumer,
    'node_modules',
    '.pnpm',
    '@global-torque+ui-kit@0.1.4_reka-ui@2.10.4',
    'node_modules',
  );
  const uiKitRoot = path.join(uiKitStore, '@global-torque', 'ui-kit');
  const rekaStore = path.join(
    fixture.consumer,
    'node_modules',
    '.pnpm',
    'reka-ui@2.10.4_vue@3.5.39',
    'node_modules',
  );
  const rekaRoot = path.join(rekaStore, 'reka-ui');
  fs.mkdirSync(uiKitRoot, { recursive: true });
  fs.mkdirSync(rekaRoot, { recursive: true });
  fs.writeFileSync(path.join(uiKitRoot, 'package.json'), JSON.stringify({
    name: '@global-torque/ui-kit',
    version: '0.1.4',
    peerDependencies: { 'reka-ui': '^2.10.1' },
  }));
  fs.writeFileSync(path.join(rekaRoot, 'package.json'), JSON.stringify({
    name: 'reka-ui',
    version: '2.10.4',
    type: 'module',
    exports: {
      '.': { import: './dist/index.js', require: './dist/index.cjs' },
      './date': { import: './dist/date.js', require: './dist/date.cjs' },
      './package.json': './package.json',
    },
  }));
  fs.mkdirSync(path.join(rekaRoot, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(rekaRoot, 'dist/index.js'), 'export const packageEntry = true;\n');
  fs.writeFileSync(path.join(rekaRoot, 'dist/date.js'), 'export const dateEntry = true;\n');
  fs.mkdirSync(path.join(app, 'node_modules', '@global-torque'), { recursive: true });
  fs.symlinkSync(uiKitRoot, path.join(app, 'node_modules', '@global-torque', 'ui-kit'), 'dir');
  fs.symlinkSync(rekaRoot, path.join(uiKitStore, 'reka-ui'), 'dir');
  return { app, rekaRoot };
}

test('active startup rejects stale journal and mixed canonical package versions', t => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  assert.equal(frameworkLinkViteConfig({ root: fixture.consumer, mode: 'registry' }).resolve.preserveSymlinks, false);

  const stalePackage = fixture.packages.find(item => item.name === '@global-torque/invest-shell');
  fs.writeFileSync(path.join(stalePackage.path, 'package.json'), JSON.stringify({
    name: stalePackage.name,
    version: '0.2.2',
  }));
  assert.throws(
    () => frameworkLinkViteConfig({ root: fixture.consumer, mode: 'registry' }),
    /cohort version is stale or mixed.*invest-shell/u,
  );

  fs.writeFileSync(path.join(stalePackage.path, 'package.json'), JSON.stringify({
    name: stalePackage.name,
    version: cohortVersion,
  }));
  const journalPath = path.join(fixture.consumer, '.torque-framework-links', 'journal.json');
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
  journal.cohortVersion = '0.2.2';
  fs.writeFileSync(journalPath, JSON.stringify(journal));
  assert.throws(
    () => frameworkLinkViteConfig({ root: fixture.consumer, mode: 'registry' }),
    /cohort version is stale or mixed.*expected 0\.2\.2/u,
  );
});

test('local config binds Reka to the selected consumer UI Kit peer package root', t => {
  const fixture = createFixture();
  const { app, rekaRoot } = addUiKitPeerFixture(fixture);
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));

  const config = frameworkLinkViteConfig({ root: fixture.consumer, appRoot: app, mode: 'local' });
  assert.deepEqual(config.resolve.dedupe, ['vue', 'pinia', 'vue-router']);
  assert.deepEqual(config.optimizeDeps.exclude.slice(-2), [
    '@global-torque/ui-primitives',
    '@global-torque/ui-kit',
  ]);
  assert.equal(fs.realpathSync(config.resolve.alias['reka-ui']), fs.realpathSync(rekaRoot));
  assert.equal(config.resolve.alias['reka-ui/date'], path.join(fs.realpathSync(rekaRoot), 'dist/date.js'));
  assert.equal(config.resolve.alias['reka-ui/package.json'], path.join(fs.realpathSync(rekaRoot), 'package.json'));
  assert.deepEqual(Object.keys(config.resolve.alias), ['reka-ui/package.json', 'reka-ui/date', 'reka-ui']);
});

test('local Reka aliases preserve the peer package ESM export target in Vite SSR', async t => {
  const fixture = createFixture();
  const { app } = addUiKitPeerFixture(fixture);
  const entry = path.join(app, 'ssr-entry.mjs');
  fs.writeFileSync(entry, "import { dateEntry } from 'reka-ui/date'; export { dateEntry };\n");
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));

  const config = frameworkLinkViteConfig({ root: fixture.consumer, appRoot: app, mode: 'local' });
  const server = await createServer({
    root: app,
    appType: 'custom',
    server: { middlewareMode: true },
    resolve: config.resolve,
    ssr: { noExternal: ['reka-ui'] },
  });
  t.after(() => server.close());
  const loaded = await server.ssrLoadModule(entry);
  assert.equal(loaded.dateEntry, true);
  assert.ok([...server.moduleGraph.idToModuleMap.keys()].some(id => id.endsWith('/reka-ui/dist/date.js')));
});

test('local config rejects an app without the declared UI Kit peer closure', t => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  assert.throws(
    () => frameworkLinkViteConfig({
      root: fixture.consumer,
      appRoot: path.join(fixture.consumer, 'apps', 'dashboard'),
      mode: 'local',
    }),
    /consumer app's @global-torque\/ui-kit installation.*resolve reka-ui/u,
  );
});
