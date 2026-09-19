import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { execFileSync, spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import { expectedNodeFiles } from './node-build-contract.mjs';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const positionalArguments = process.argv.slice(2).filter(argument => argument !== '--');
const artifacts = path.resolve(positionalArguments[0] ?? 'artifacts');
const expectedPackages = [
  '@global-torque/domain-types',
  '@global-torque/invest-core',
  '@global-torque/invest-data',
  '@global-torque/invest-runtime',
  '@global-torque/invest-widgets',
  '@global-torque/invest-features',
  '@global-torque/invest-shell',
];
const profileName = process.env.CONSUMER_PROFILE ?? 'baseline';
const profiles = {
  baseline: { pinia: '3.0.4', vite: '8.1.3', pluginVue: '6.0.5', nodeTypes: '25.5.0', router: '5.1.0', pnpm: '10.34.5' },
  target: { pinia: '4.0.3', vite: '8.3.0', pluginVue: '6.0.9', nodeTypes: '24.13.5', router: '5.3.1', pnpm: '12.4.2' },
};
if (!Object.hasOwn(profiles, profileName)) throw new Error(`Unknown consumer profile: ${profileName}`);
const profile = profiles[profileName];
// Reviewed exact targets published within pnpm 12's default 24-hour window.
const reviewedMigrationVersions = [
  '@types/node@24.13.5', '@vue/test-utils@2.5.1',
  '@vueuse/core@15.0.0', '@vueuse/integrations@15.0.0',
  '@vueuse/metadata@15.0.0', '@vueuse/shared@15.0.0', 'prettier@3.9.7',
];
const packageManagers = (process.env.CONSUMER_PACKAGE_MANAGERS ?? 'npm,pnpm')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);
fs.mkdirSync(process.env.TMPDIR ?? os.tmpdir(), { recursive: true });
const digest = bytes => crypto.createHash('sha512').update(bytes).digest('hex');
const integrity = bytes => `sha512-${crypto.createHash('sha512').update(bytes).digest('base64')}`;
const nodeExportPackages = [
  ['@global-torque/invest-core', 'app/config', 'dist/node/app/config.js'],
  ['@global-torque/invest-core', 'markdown/tableWrap', 'dist/node/markdown/tableWrap.js'],
  ['@global-torque/invest-core', 'helpers/text', 'dist/node/helpers/text.js'],
  ['@global-torque/invest-runtime', 'pwa/pwaPolicy', 'dist/node/pwa/pwaPolicy.js'],
];

if (!fs.existsSync(artifacts)) throw new Error(`Candidate artifact directory is missing: ${artifacts}`);
const receipt = JSON.parse(fs.readFileSync(path.join(artifacts, 'candidate-receipt.json'), 'utf8'));
if (receipt.schemaVersion !== 1 || !Array.isArray(receipt.packages)) throw new Error('Candidate receipt is missing its package matrix');
if (JSON.stringify(receipt.dependencyOrder) !== JSON.stringify(expectedPackages)) throw new Error('Candidate receipt package order is not the accepted order');
if (receipt.packages.length !== expectedPackages.length || new Set(receipt.packages.map(entry => entry.name)).size !== expectedPackages.length) {
  throw new Error('Candidate receipt does not contain exactly seven framework packages');
}
execFileSync(process.execPath, [path.join(root, 'scripts/verify-release-bundle.mjs'), path.join(artifacts, 'candidate-receipt.json')], {
  cwd: root,
  stdio: 'inherit',
});

const archives = new Map();
for (const packageName of expectedPackages) {
  const entry = receipt.packages.find(candidate => candidate.name === packageName);
  if (!entry) throw new Error(`Candidate receipt is missing ${packageName}`);
  const archive = path.join(artifacts, entry.archive);
  if (!fs.existsSync(archive)) throw new Error(`Candidate archive is missing ${entry.archive}`);
  const bytes = fs.readFileSync(archive);
  if (digest(bytes) !== entry.sha512 || integrity(bytes) !== entry.integrity) throw new Error(`Candidate archive digest mismatch ${packageName}`);
  archives.set(packageName, archive);
}

function findUiArchive(argument) {
  const supplied = argument || process.env.UI_KIT_ARCHIVE || process.env.UI_KIT_TRANSPORT_DIR;
  if (!supplied) return undefined;
  const resolved = path.resolve(supplied);
  const archive = fs.statSync(resolved).isDirectory()
    ? path.join(resolved, 'global-torque-ui-kit-0.1.4.tgz')
    : resolved;
  if (!fs.existsSync(archive)) throw new Error(`UI Kit archive is missing: ${archive}`);
  const name = path.basename(archive);
  if (name !== 'global-torque-ui-kit-0.1.4.tgz') throw new Error(`Unexpected UI Kit archive identity: ${name}`);
  return archive;
}

const uiArchive = findUiArchive(positionalArguments[1]);
const frameworkDependencySpecs = Object.fromEntries([...archives].map(([name, archive]) => [name, `file:${archive}`]));
const directDependencies = {
  ...frameworkDependencySpecs,
  '@global-torque/ui-kit': uiArchive ? `file:${uiArchive}` : '0.1.4',
  '@global-torque/ui-primitives': '0.1.3',
  '@global-torque/sdk': '0.3.1',
  '@global-torque/client-error-handling': '0.1.0',
  '@global-torque/design-tokens': '0.2.1',
  vue: '3.5.42',
  pinia: profile.pinia,
  'vue-router': profile.router,
  'reka-ui': '2.10.4',
  sass: '1.104.1',
  vitepress: '1.6.4',
  'markdown-it': '15.0.2',
};
const developmentDependencies = {
  ...(profile.pinia.startsWith('4.') ? { '@vue/devtools-api': '8.1.5' } : {}),
  '@types/node': profile.nodeTypes,
  '@vitejs/plugin-vue': profile.pluginVue,
  '@vue/compiler-sfc': '3.5.42',
  '@vue/server-renderer': '3.5.42',
  typescript: '6.0.3',
  vite: profile.vite,
  'vite-svg-loader': '5.1.1',
  'vue-tsc': '3.3.11',
};

function writeConsumer(consumer) {
  const overrides = {
    ...frameworkDependencySpecs,
    ...(uiArchive ? { '@global-torque/ui-kit': `file:${uiArchive}` } : {}),
  };
  const packageJson = {
    name: 'torque-framework-detached-consumer',
    version: '1.0.0',
    private: true,
    type: 'module',
    packageManager: `pnpm@${profile.pnpm}`,
    scripts: { build: 'vite build', 'build:ssr': 'vite build --ssr src/entry-server.ts --outDir dist-ssr' },
    dependencies: directDependencies,
    devDependencies: developmentDependencies,
    overrides,
  };
  fs.writeFileSync(path.join(consumer, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);
  fs.writeFileSync(path.join(consumer, 'pnpm-workspace.yaml'), `${JSON.stringify({ overrides, ...(profile.pnpm.startsWith('12.') ? { verifyDepsBeforeRun: false, minimumReleaseAgeExclude: reviewedMigrationVersions } : {}) }, null, 2)}\n`);
  fs.mkdirSync(path.join(consumer, 'src'), { recursive: true });
  fs.writeFileSync(path.join(consumer, 'index.html'), `<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Detached consumer</title></head>
  <body><div id="app"></div><script type="module" src="/src/main.ts"></script></body>
</html>
`);
  fs.writeFileSync(path.join(consumer, 'vite.config.ts'), `import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import svgLoader from 'vite-svg-loader';

export default defineConfig({
  plugins: [vue(), svgLoader({ defaultImport: 'url' })],
  ssr: { noExternal: [/^@global-torque\\//u] },
});
`);
  fs.writeFileSync(path.join(consumer, 'vite.hmr.config.ts'), `import { defineConfig } from 'vite';
import base from './vite.config';
export default defineConfig({ ...base, optimizeDeps: { entries: ['hmr.html'] } });
`);
  fs.writeFileSync(path.join(consumer, 'tsconfig.json'), `${JSON.stringify({
    compilerOptions: {
      target: 'ESNext',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      strict: true,
      jsx: 'preserve',
      jsxImportSource: 'vue',
      resolveJsonModule: true,
      esModuleInterop: true,
      allowImportingTsExtensions: true,
      skipLibCheck: true,
      types: ['vite/client', 'node'],
    },
    include: ['src/**/*.ts', 'src/**/*.vue'],
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(consumer, 'src/vite-env.d.ts'), `/// <reference types="vite/client" />

declare module '*.svg?component' {
  import type { FunctionalComponent, SVGAttributes } from 'vue';

  const component: FunctionalComponent<SVGAttributes>;
  export default component;
}
`);
  fs.writeFileSync(path.join(consumer, 'src/App.vue'), `<script setup lang="ts">
import { isCanonicalDecimalString } from '@global-torque/invest-core/decimal/canonicalDecimal';
import { stripHtmlAndMarkdown } from '@global-torque/invest-core/helpers/text';
import { VFormAuthSocial } from '@global-torque/invest-features/auth';
import { VLogo } from '@global-torque/invest-shell/components';
import { VCardOffer } from '@global-torque/invest-widgets/offers';
import { defineComponent, h, ref } from 'vue';
import { useProbeStore } from './store';
import { useSessionStore } from '@global-torque/invest-runtime/session';
import { setInvestRuntimeConfig } from '@global-torque/invest-runtime/config';
import { createInvestAppConfigFromEnv } from '@global-torque/invest-core/app/config';
import { AreaChart } from '@global-torque/invest-widgets/charts/area';
import { DonutChart } from '@global-torque/invest-widgets/charts/donut';
import ChevronDownIcon from '@global-torque/invest-widgets/icons/images/chevron-down.svg?component';
import chevronDownUrl from '@global-torque/invest-widgets/icons/images/chevron-down.svg';

setInvestRuntimeConfig({ ...createInvestAppConfigFromEnv({ ENV: 'test' }), brand: { title: 'Consumer', description: 'Probe' } });
const session = useSessionStore();
const store = useProbeStore();
const chartData = [{ label: 'A', value: 10, benchmark: 8 }, { label: 'B', value: 20, benchmark: 12 }, { label: 'C', value: 15, benchmark: 18 }];
const legendClicks = ref(0);
const canonicalValue = isCanonicalDecimalString('12.5') ? '12.5' : 'invalid';
const textValue = stripHtmlAndMarkdown('<strong>Plain</strong> **text**');
const hostIcon = defineComponent({ render: () => h('svg', { 'aria-hidden': 'true' }) });
const socialIcons = {
  google: { icon: hostIcon, iconHover: hostIcon },
  github: { icon: hostIcon, iconHover: hostIcon },
  linkedin: { icon: hostIcon, iconHover: hostIcon },
};
</script>

<template>
  <main class="consumer-probe">
    <output data-testid="session-active">{{ session.userLoggedIn }}</output>
    <button data-testid="session-sync" @click="session.syncSessionFromCookies()">Read session</button>
    <button data-testid="session-reset" @click="session.resetAll()">Log out</button>
    <output data-testid="store-label">{{ store.label }}</output>
    <output data-testid="store-value">{{ store.count }}</output>
    <button data-testid="store-increment" @click="store.count++">Increment</button>
    <button data-testid="store-reset" @click="store.$reset()">Reset</button>
    <div data-testid="area-chart"><AreaChart :data="chartData" index="label" :categories="['value', 'benchmark']" @legend-item-click="legendClicks++" /></div>
    <output data-testid="legend-clicks">{{ legendClicks }}</output>
    <div data-testid="donut-chart" style="height: 300px"><DonutChart :data="chartData" index="label" category="value" /></div>
    <div data-testid="logo"><VLogo brand-name="Detached consumer" /></div>
    <div data-testid="social"><VFormAuthSocial :social-icons="socialIcons" /></div>
    <div data-testid="offer"><VCardOffer /></div>
    <h3 class="is--h3__title" data-testid="typography-witness">Detached consumer</h3>
    <span class="is--lt-tablet-hide" data-testid="desktop-witness">Desktop witness</span>
    <div data-testid="svg-component"><ChevronDownIcon aria-hidden="true" /></div>
    <img data-testid="svg-url" :src="chevronDownUrl" alt="" width="24" height="24">
    <output data-testid="canonical-value">{{ canonicalValue }}</output>
    <output data-testid="text-transform">{{ textValue }}</output>
  </main>
</template>
`);
  fs.writeFileSync(path.join(consumer, 'src/markdown-compatibility.ts'), `import { createMarkdownRenderer } from 'vitepress';
import MarkdownIt from 'markdown-it';
import tableWrap from '@global-torque/invest-core/markdown/tableWrap';
new MarkdownIt().use(tableWrap);
export async function renderMarkdown(text: string) {
  const md = await createMarkdownRenderer(process.cwd());
  md.use(tableWrap);
  return md.render(text);
}
`);
  fs.writeFileSync(path.join(consumer, 'src/store.ts'), `import { acceptHMRUpdate, defineStore } from 'pinia';
export const useProbeStore = defineStore('consumer-probe', { state: () => ({ count: 0 }), getters: { label: state => 'v1:' + state.count } });
if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useProbeStore, import.meta.hot));
`);
  fs.writeFileSync(path.join(consumer, 'hmr.html'), '<div id="app"></div><script type="module" src="/src/hmr.ts"></script>');
  fs.writeFileSync(path.join(consumer, 'src/hmr.ts'), `import { createApp, h } from 'vue';
import { createPinia } from 'pinia';
import { useSessionStore } from '@global-torque/invest-runtime/session';
import { useProbeStore } from './store';
createApp({ setup() {
  const store = useProbeStore();
  const session = useSessionStore();
  return () => h('main', [
    h('output', { 'data-testid': 'store-label' }, store.label),
    h('output', { 'data-testid': 'session-active' }, String(session.userLoggedIn)),
    h('button', { 'data-testid': 'store-increment', onClick: () => store.count++ }, 'Increment'),
  ]);
} }).use(createPinia()).mount('#app');
`);
  fs.writeFileSync(path.join(consumer, 'src/main.ts'), `import '@global-torque/design-tokens/css';
import '@global-torque/invest-shell/styles/geometry.css';
import '@global-torque/invest-shell/styles/components.css';
import '@global-torque/invest-shell/styles';
import { createApp, createSSRApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';

const pinia = createPinia();
const state = (window as unknown as { __PINIA__?: Record<string, any> }).__PINIA__;
if (state) pinia.state.value = state;
const app = state ? createSSRApp(App) : createApp(App);
app.use(pinia).mount('#app');
`);
  fs.writeFileSync(path.join(consumer, 'src/entry-server.ts'), `import { createSSRApp } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { createPinia } from 'pinia';
import { useProbeStore } from './store';
import App from './App.vue';

export async function render(count = 0) {
  const pinia = createPinia();
  const app = createSSRApp(App).use(pinia);
  useProbeStore(pinia).count = count;
  const html = await renderToString(app);
  return { html, state: pinia.state.value };
}
`);
}

function packageRootFromResolved(resolved, packageName) {
  let directory = path.dirname(resolved);
  while (directory !== path.dirname(directory)) {
    const manifestPath = path.join(directory, 'package.json');
    if (fs.existsSync(manifestPath)) {
      try {
        if (JSON.parse(fs.readFileSync(manifestPath, 'utf8')).name === packageName) return fs.realpathSync(directory);
      } catch {
        // Continue walking if an unrelated package manifest is malformed.
      }
    }
    directory = path.dirname(directory);
  }
  throw new Error(`Cannot locate installed package root for ${packageName}: ${resolved}`);
}

function verifySingletons(consumer) {
  const requireFromConsumer = createRequire(path.join(consumer, 'package.json'));
  const packageRoots = new Map();
  for (const packageName of expectedPackages) {
    const resolved = requireFromConsumer.resolve(packageName, { paths: [consumer] });
    packageRoots.set(packageName, packageRootFromResolved(resolved, packageName));
  }
  const singletonNames = ['vue', 'pinia', 'vue-router', 'reka-ui'];
  const consumerSingletons = new Map(singletonNames.map(name => [name, fs.realpathSync(requireFromConsumer.resolve(name))]));
  for (const [packageName, packageRoot] of packageRoots) {
    for (const singleton of singletonNames) {
      let resolved;
      try {
        resolved = requireFromConsumer.resolve(singleton, { paths: [packageRoot] });
      } catch (error) {
        throw new Error(`${packageName} cannot resolve singleton ${singleton}: ${error.message}`);
      }
      assert.equal(
        fs.realpathSync(resolved),
        consumerSingletons.get(singleton),
        `${packageName} resolves a duplicate ${singleton}`,
      );
    }
  }
  for (const [packageName, packageRoot] of packageRoots) {
    const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
    const dependencies = new Set([
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.optionalDependencies ?? {}),
    ]);
    for (const dependency of expectedPackages) {
      if (!dependencies.has(dependency)) continue;
      const resolved = requireFromConsumer.resolve(dependency, { paths: [packageRoot] });
      assert.equal(
        packageRootFromResolved(resolved, dependency),
        packageRoots.get(dependency),
        `${packageName} resolves ${dependency} outside the exact consumer archive graph`,
      );
    }
  }
  console.log(`singleton-pass ${consumer}`);
}

async function verifyNativeNode(consumer) {
  const requireFromConsumer = createRequire(path.join(consumer, 'package.json'));
  const resolvedFiles = [];
  const resolvedModules = new Map();
  for (const [packageName, subpath, expectedFile] of nodeExportPackages) {
    const specifier = `${packageName}/${subpath}`;
    const resolved = requireFromConsumer.resolve(specifier, { paths: [consumer] });
    const realResolved = fs.realpathSync(resolved);
    const nodeModulesRoot = fs.realpathSync(path.join(consumer, 'node_modules'));
    assert(realResolved.startsWith(`${nodeModulesRoot}${path.sep}`), `${specifier} resolved outside consumer node_modules`);
    assert(realResolved.endsWith(`${path.sep}${expectedFile}`), `${specifier} did not resolve to ${expectedFile}`);
    resolvedFiles.push(path.relative(consumer, realResolved).split(path.sep).join('/'));
    resolvedModules.set(specifier, await import(pathToFileURL(realResolved).href));

    const packageEntry = receipt.packages.find(entry => entry.name === packageName);
    assert(packageEntry, `Receipt is missing ${packageName}`);
    assert.equal(
      digest(fs.readFileSync(realResolved)),
      packageEntry.fileSha512[expectedFile],
      `${specifier} does not match the retained archive bytes`,
    );
  }
  assert.equal(resolvedFiles.length, expectedNodeFiles.length, 'Native Node probe must resolve exactly four generated files');
  console.log(`native-node-paths-pass ${consumer}`);

  const config = resolvedModules.get('@global-torque/invest-core/app/config');
  assert.equal(typeof config.createInvestAppConfigFromEnv, 'function');
  assert.throws(() => config.assertInvestRuntimeBrandConfig({}), /requires object runtime\.brand/u);
  const serialized = config.serializeStaticConfigForInlineScript({ html: '</script>' });
  assert(serialized.includes('\\u003c'), 'Static configuration serialization must escape opening script tags');
  assert(!serialized.includes('</script>'), 'Static configuration serialization must not emit a closing script tag');

  const tableWrap = resolvedModules.get('@global-torque/invest-core/markdown/tableWrap');
  const coreRequire = createRequire(requireFromConsumer.resolve('@global-torque/invest-core/app/config', { paths: [consumer] }));
  const MarkdownIt = coreRequire('markdown-it');
  const markdown = new (MarkdownIt.default ?? MarkdownIt)();
  tableWrap.default(markdown);
  assert.match(markdown.render('| A |\n| - |\n| B |'), /v-table__wrap/u, 'Node table wrapper did not render its public wrapper');

  const vitepress = await import(pathToFileURL(requireFromConsumer.resolve('vitepress')).href);
  const vitepressMarkdown = await vitepress.createMarkdownRenderer(consumer);
  vitepressMarkdown.use(tableWrap.default);
  assert.match(vitepressMarkdown.render('| A |\n| - |\n| B |'), /v-table__wrap/u);

  const text = resolvedModules.get('@global-torque/invest-core/helpers/text');
  assert.equal(text.stripHtmlAndMarkdown('<strong>Plain</strong> **text**'), 'Plain ');

  const pwa = resolvedModules.get('@global-torque/invest-runtime/pwa/pwaPolicy');
  const policies = pwa.resolveOfflineDomainPolicies({
    FRONTEND_URL: 'https://site.example.test/',
    OFFER_URL: 'https://api.example.test/offer',
  });
  assert.equal(policies.length, 2, 'PWA policy must resolve configured service origins');
  const rules = pwa.buildWorkboxRuntimeCaching({
    FRONTEND_URL: 'https://site.example.test/',
    OFFER_URL: 'https://api.example.test/offer',
  }, { excludeNavigationPathPrefixes: ['/dashboard'] });
  assert.equal(rules.length, 2, 'PWA policy must build configured public rules');
  const navigationRule = rules.find(rule => rule.options.cacheName === pwa.PWA_CACHE_NAMES.frontendShell);
  assert(navigationRule, 'PWA navigation rule is missing');
  globalThis.self = { location: { origin: 'https://site.example.test' } };
  assert.equal(navigationRule.urlPattern({ request: { mode: 'navigate', method: 'GET' }, url: new URL('https://site.example.test/dashboard') }), false);
  assert.equal(navigationRule.urlPattern({ request: { mode: 'navigate', method: 'GET' }, url: new URL('https://site.example.test/about') }), true);
  assert.equal(typeof navigationRule.options.plugins[0].handlerDidError, 'function', 'PWA worker fallback callback is not serialized');
  delete globalThis.self;
  console.log(`native-node-behavior-pass ${consumer}`);
}

function walkFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(file));
    else files.push(file);
  }
  return files;
}

function runVite(consumer, args) {
  const vite = path.join(consumer, 'node_modules', '.bin', 'vite');
  if (!fs.existsSync(vite)) throw new Error(`Vite binary is missing from ${consumer}`);
  execFileSync(vite, args, { cwd: consumer, stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production' } });
}

function runTypecheck(consumer) {
  const vueTsc = path.join(consumer, 'node_modules', '.bin', 'vue-tsc');
  if (!fs.existsSync(vueTsc)) throw new Error(`vue-tsc binary is missing from ${consumer}`);
  execFileSync(vueTsc, ['--noEmit', '-p', 'tsconfig.json'], {
    cwd: consumer,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test' },
  });
  console.log(`consumer-typecheck-pass ${consumer}`);
}

async function assertTypographyWitness(page) {
  const typography = await page.locator('[data-testid="typography-witness"]').evaluate(element => {
    const style = getComputedStyle(element);
    return { fontSize: style.fontSize, lineHeight: style.lineHeight, fontWeight: style.fontWeight };
  });
  assert.deepEqual(
    typography,
    { fontSize: '24px', lineHeight: '36px', fontWeight: '900' },
    'Typography witness does not use the public h3 rule',
  );
}

async function verifyTypographyOverride(page) {
  const witness = page.locator('[data-testid="typography-witness"]');
  const originalStyle = await witness.getAttribute('style');
  try {
    await witness.evaluate(element => {
      element.style.setProperty('font-size', 'revert');
      element.style.setProperty('line-height', 'revert');
      element.style.setProperty('font-weight', 'revert');
    });
    let failed = false;
    try {
      await assertTypographyWitness(page);
    } catch {
      failed = true;
    }
    assert.equal(failed, true, 'Typography witness negative override must fail the same public-rule assertion');
  } finally {
    await witness.evaluate((element, style) => {
      if (style === null) element.removeAttribute('style');
      else element.setAttribute('style', style);
    }, originalStyle);
  }
  await assertTypographyWitness(page);
}

function runNegativePublicContractCheck(consumer) {
  const vueTsc = path.join(consumer, 'node_modules', '.bin', 'vue-tsc');
  const appPath = path.join(consumer, 'src', 'App.vue');
  const original = fs.readFileSync(appPath, 'utf8');
  const mismatched = original.replace('<VFormAuthSocial :social-icons="socialIcons" />', '<VFormAuthSocial />');
  if (mismatched === original) throw new Error('Detached consumer contract fixture did not contain the required public prop');
  fs.writeFileSync(appPath, mismatched);
  let failed = false;
  try {
    execFileSync(vueTsc, ['--noEmit', '-p', 'tsconfig.json'], {
      cwd: consumer,
      stdio: 'ignore',
      env: { ...process.env, NODE_ENV: 'test' },
    });
  } catch {
    failed = true;
  } finally {
    fs.writeFileSync(appPath, original);
  }
  assert.equal(failed, true, 'Detached consumer typecheck must reject a missing required public prop');
  console.log(`consumer-typecheck-negative-pass ${consumer}`);
}

async function verifyBuilds(consumer) {
  runVite(consumer, ['build', '--outDir', 'dist']);
  const browserFiles = walkFiles(path.join(consumer, 'dist'));
  assert(browserFiles.some(file => file.endsWith('.css')), 'Browser consumer emitted no CSS asset');
  const browserText = browserFiles
    .filter(file => /\.(?:css|html|js)$/u.test(file))
    .map(file => fs.readFileSync(file, 'utf8'))
    .join('\n');
  assert(browserText.includes('svg') || browserFiles.some(file => file.endsWith('.svg')), 'Browser consumer emitted no SVG asset or URL');
  assert.match(browserText, /\.is--h3__title/u, 'Public shell styles entry emitted no typography rules');
  assert.match(browserText, /@media[^{}]*(?:767|768)px\)[^{]*\{[^{}]*\.is--lt-tablet-hide/u, 'Public shell styles entry emitted no responsive rules');
  runVite(consumer, ['build', '--ssr', 'src/entry-server.ts', '--outDir', 'dist-ssr']);
  const serverEntry = walkFiles(path.join(consumer, 'dist-ssr')).find(file => file.endsWith('entry-server.js'));
  if (!serverEntry) throw new Error('SSR consumer entry was not emitted');
  const server = await import(pathToFileURL(serverEntry).href);
  const [first, second] = await Promise.all([server.render(7), server.render(19)]);
  assert.equal(first.state['consumer-probe'].count, 7, 'SSR request state leaked');
  assert.equal(second.state['consumer-probe'].count, 19, 'SSR request state leaked');
  const rendered = first.html;
  assert.match(rendered, /data-testid="store-value">7<\/output>/u);
  assert.match(rendered, /v-shadcn-chart-area/u);
  assert.match(rendered, /v-shadcn-chart-donut/u);
  const indexPath = path.join(consumer, 'dist/index.html');
  const index = fs.readFileSync(indexPath, 'utf8');
  fs.writeFileSync(path.join(consumer, 'dist/hydrated.html'), index.replace('<div id="app"></div>',
    `<div id="app">${rendered}</div><script>window.__PINIA__=${JSON.stringify(first.state).replaceAll('<', '\\u003c')}</script>`));
  assert.match(rendered, /consumer-probe/u, 'SSR consumer did not render the framework SFC');
  assert.match(rendered, /12\.5/u, 'SSR consumer did not render the source TypeScript contract');
  console.log(`consumer-build-pass ${consumer}`);
}

async function waitForPreview(url, child, output) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Vite preview exited before readiness: ${output.stderr}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The preview process may still be binding its port.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Vite preview did not become ready: ${output.stderr}`);
}

async function verifyBrowser(consumer, manager) {
  const evidenceRoot = path.resolve(
    process.env.RUNNER_TEMP ?? process.env.TMPDIR ?? os.tmpdir(),
    'torque-framework-consumer-evidence',
    receipt.candidate,
    profileName,
    manager,
  );
  fs.mkdirSync(evidenceRoot, { recursive: true });
  const port = 4300 + (process.pid % 1000);
  const vite = path.join(consumer, 'node_modules', '.bin', 'vite');
  const output = { stdout: '', stderr: '' };
  const preview = spawn(vite, ['preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: consumer,
    env: { ...process.env, NODE_ENV: 'production' },
  });
  preview.stdout.on('data', chunk => { output.stdout += chunk.toString(); });
  preview.stderr.on('data', chunk => { output.stderr += chunk.toString(); });
  const report = {
    schemaVersion: 1,
    profile: profileName,
    packageManager: manager,
    resolvedVersions: resolvedVersions(consumer),
    node: process.version,
    chromium: null,
    candidateReceipt: path.resolve(artifacts, 'candidate-receipt.json'),
    candidateDigest: digest(fs.readFileSync(path.resolve(artifacts, 'candidate-receipt.json'))),
    result: 'fail',
    viewports: [],
    errors: [],
  };
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    report.chromium = await browser.version();
    await waitForPreview(`http://127.0.0.1:${port}/`, preview, output);
    for (const viewport of [{ name: 'desktop', width: 1280, height: 800 }, { name: 'mobile', width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      const page = await context.newPage();
      const pageErrors = [];
      const consoleErrors = [];
      const failedRequests = [];
      const badResponses = [];
      const resources = new Set();
      page.on('pageerror', error => pageErrors.push(String(error)));
      page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
      page.on('requestfailed', request => failedRequests.push(`${request.url()}: ${request.failure()?.errorText ?? 'failed'}`));
      page.on('response', response => {
        if (response.url().startsWith(`http://127.0.0.1:${port}/`)) {
          resources.add(response.request().resourceType());
          if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`);
        }
      });
      try {
        await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle', timeout: 20000 });
        await page.locator('[data-testid="logo"]').waitFor();
        await page.locator('[data-testid="social"]').waitFor();
        await page.locator('[data-testid="offer"]').waitFor();
        assert(await page.locator('[data-testid="svg-component"] svg').count() > 0, 'Detached SFC SVG did not mount');
        assert.equal(await page.locator('[data-testid="canonical-value"]').textContent(), '12.5');
        assert.equal(await page.locator('[data-testid="text-transform"]').textContent(), 'Plain ');
        const image = page.locator('[data-testid="svg-url"]');
        await image.waitFor({ state: 'visible' });
        assert(await image.evaluate(element => element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0), 'Detached SVG URL image did not load');
        assert.equal(await page.locator('[data-testid="session-active"]').textContent(), 'false');
        await context.addCookies([{ name: 'session', value: encodeURIComponent(JSON.stringify({ active: true })), url: `http://127.0.0.1:${port}` }]);
        await page.locator('[data-testid="session-sync"]').click();
        assert.equal(await page.locator('[data-testid="session-active"]').textContent(), 'true');
        await page.locator('[data-testid="session-reset"]').click();
        assert.equal(await page.locator('[data-testid="session-active"]').textContent(), 'false');
        assert(!(await context.cookies()).some(cookie => cookie.name === 'session'), 'Logout did not remove the real browser session cookie');
        assert.equal(await page.locator('[data-testid="store-value"]').textContent(), '0');
        await page.locator('[data-testid="store-increment"]').click();
        assert.equal(await page.locator('[data-testid="store-value"]').textContent(), '1');
        await page.locator('[data-testid="store-reset"]').click();
        assert.equal(await page.locator('[data-testid="store-value"]').textContent(), '0');
        await page.locator('[data-testid="area-chart"] path[class$="-area"]').first().waitFor();
        await page.locator('[data-testid="donut-chart"] path[class$="-segment"]').first().waitFor();
        const area = page.locator('[data-testid="area-chart"]');
        const legend = area.locator('.v-chart-legend').getByText('value', { exact: true });
        await legend.click();
        assert.equal(await page.locator('[data-testid="legend-clicks"]').textContent(), '1');
        await page.waitForFunction(() => {
          const lines = [...document.querySelectorAll('[data-testid="area-chart"] path[class$="-linePath"]')];
          return lines.length === 2 && lines.some(line => Number(getComputedStyle(line.parentElement).opacity) === 0.2);
        });
        await legend.click();
        await page.waitForFunction(() => {
          const lines = [...document.querySelectorAll('[data-testid="area-chart"] path[class$="-linePath"]')];
          return lines.length === 2 && lines.every(line => Number(getComputedStyle(line.parentElement).opacity) === 1);
        });
        await area.locator('path[class$="-area"]').first().hover({ force: true });
        await area.locator('.v-chart-tooltip').waitFor({ state: 'visible' });
        assert.match(await area.locator('.v-chart-tooltip').innerText(), /value/);
        assert.match(await area.locator('.v-chart-tooltip').innerText(), /benchmark/);
        assert(await area.locator('[class$="-crosshair-component"] circle').count() > 0, 'Area crosshair did not render data markers');
        const segments = page.locator('[data-testid="donut-chart"] path[class$="-segment"]');
        await segments.first().scrollIntoViewIfNeeded();
        const segmentPoint = await segments.first().evaluate(element => {
          const point = element.getPointAtLength(element.getTotalLength() * 0.2);
          const screen = new DOMPoint(point.x * 0.97, point.y * 0.97).matrixTransform(element.getScreenCTM());
          return { x: screen.x, y: screen.y };
        });
        await page.mouse.move(segmentPoint.x, segmentPoint.y);
        const donutTooltip = page.locator('[data-testid="donut-chart"] .v-chart-tooltip');
        await donutTooltip.waitFor({ state: 'visible' });
        assert.equal(await donutTooltip.locator('.v-chart-tooltip__right').innerText(), '20');
        assert.doesNotMatch(await donutTooltip.innerText(), /NaN/);
        await page.mouse.click(segmentPoint.x, segmentPoint.y);
        await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="donut-chart"] path[class$="-segment"]')].filter(el => Number(getComputedStyle(el).opacity) === 0.2).length === 2);
        await page.mouse.click(segmentPoint.x, segmentPoint.y);
        await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="donut-chart"] path[class$="-segment"]')].every(el => Number(getComputedStyle(el).opacity) === 1));
        await assertTypographyWitness(page);
        await verifyTypographyOverride(page);
        const desktopWitnessDisplay = await page.locator('[data-testid="desktop-witness"]').evaluate(element => getComputedStyle(element).display);
        assert.equal(desktopWitnessDisplay === 'none', viewport.name === 'mobile', 'Responsive witness has the wrong visibility');
        await page.waitForTimeout(100);
        assert.deepEqual(pageErrors, [], 'Browser page errors were reported');
        assert.deepEqual(consoleErrors, [], 'Browser console errors were reported');
        assert.deepEqual(failedRequests, [], 'Browser resource requests failed');
        assert.deepEqual(badResponses, [], 'Browser resources returned an error response');
        for (const resourceType of ['script', 'stylesheet']) assert(resources.has(resourceType), `Missing local ${resourceType} browser resource`);
        await page.screenshot({ path: path.join(evidenceRoot, `${viewport.name}.png`), fullPage: true });
        await page.goto(`http://127.0.0.1:${port}/hydrated.html`, { waitUntil: 'networkidle' });
        assert.equal(await page.locator('[data-testid="store-value"]').textContent(), '7');
        await page.locator('[data-testid="store-increment"]').click();
        assert.equal(await page.locator('[data-testid="store-value"]').textContent(), '8');
        assert.deepEqual(pageErrors, [], 'Hydration page errors were reported');
        assert.deepEqual(consoleErrors, [], 'Hydration console errors were reported');
        report.viewports.push({ ...viewport, result: 'pass', resources: [...resources] });
      } catch (error) {
        report.errors.push(`${viewport.name}: ${error.message}`);
        report.viewports.push({ ...viewport, result: 'fail', resources: [...resources] });
        await page.screenshot({ path: path.join(evidenceRoot, `${viewport.name}-failure.png`), fullPage: true }).catch(() => {});
        throw error;
      } finally {
        await context.close();
      }
    }
    report.result = 'pass';
    console.log(`browser-proof-pass ${manager} ${evidenceRoot}`);
  } catch (error) {
    report.errors.push(error.message);
    throw error;
  } finally {
    fs.writeFileSync(path.join(evidenceRoot, 'report.json'), `${JSON.stringify({ ...report, preview: output }, null, 2)}\n`);
    if (browser) await browser.close();
    preview.kill('SIGTERM');
    await new Promise(resolve => {
      if (preview.exitCode !== null) resolve();
      else preview.once('exit', resolve);
      setTimeout(resolve, 3000);
    });
    if (preview.exitCode === null) preview.kill('SIGKILL');
  }
}

async function verifyStoreHmr(consumer, evidence) {
  const port = 5400 + (process.pid % 1000);
  const output = { stdout: '', stderr: '' };
  const server = spawn(path.join(consumer, 'node_modules/.bin/vite'), ['--config', 'vite.hmr.config.ts', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: consumer, env: { ...process.env, NODE_ENV: 'development' } });
  server.stdout.on('data', chunk => { output.stdout += chunk; });
  server.stderr.on('data', chunk => { output.stderr += chunk; });
  const storePath = path.join(consumer, 'src/store.ts');
  const original = fs.readFileSync(storePath, 'utf8');
  const report = { result: 'fail', errors: [], server: output };
  let browser;
  try {
    await waitForPreview(`http://127.0.0.1:${port}/`, server, output);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const errors = report.errors;
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(`http://127.0.0.1:${port}/hmr.html`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('[data-testid="session-active"]').textContent(), 'false');
    await page.locator('[data-testid="store-increment"]').click();
    assert.equal(await page.locator('[data-testid="store-label"]').textContent(), 'v1:1');
    fs.writeFileSync(storePath, original.replace("'v1:'", "'v2:'"));
    await page.waitForFunction(() => document.querySelector('[data-testid="store-label"]')?.textContent === 'v2:1');
    assert.deepEqual(errors, [], 'Store HMR raised browser errors');
    report.result = 'pass';
    console.log(`consumer-pinia-hmr-pass ${consumer}`);
  } catch (error) {
    report.errors.push(error.message);
    throw error;
  } finally {
    fs.writeFileSync(path.join(evidence, 'hmr-report.json'), JSON.stringify(report, null, 2) + '\n');
    fs.writeFileSync(storePath, original);
    if (browser) await browser.close();
    server.kill('SIGTERM');
    await new Promise(resolve => { if (server.exitCode !== null) resolve(); else { server.once('exit', resolve); setTimeout(resolve, 3000); } });
    if (server.exitCode === null) server.kill('SIGKILL');
  }
}

function resolvedVersions(consumer) {
  return Object.fromEntries([...Object.keys(directDependencies), ...Object.keys(developmentDependencies)].map(name => {
    const resolved = path.join(consumer, 'node_modules', ...name.split('/'), 'package.json');
    return [name, JSON.parse(fs.readFileSync(resolved, 'utf8')).version];
  }));
}

function installedGraph(consumer) {
  const visited = new Set();
  const packages = [];
  function visitModules(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory)) {
      if (entry === '.pnpm') {
        const store = path.join(directory, entry);
        for (const slot of fs.readdirSync(store)) {
          visitModules(slot === 'node_modules' ? path.join(store, slot) : path.join(store, slot, 'node_modules'));
        }
      } else if (entry.startsWith('@')) {
        visitModules(path.join(directory, entry));
      } else if (!entry.startsWith('.')) {
        const candidate = path.join(directory, entry);
        if (!fs.existsSync(path.join(candidate, 'package.json'))) continue;
        const real = fs.realpathSync(candidate);
        if (visited.has(real)) continue;
        visited.add(real);
        const manifest = JSON.parse(fs.readFileSync(path.join(real, 'package.json'), 'utf8'));
        packages.push({ name: manifest.name, version: manifest.version, engines: manifest.engines ?? {}, path: path.relative(consumer, real) });
        visitModules(path.join(real, 'node_modules'));
      }
    }
  }
  visitModules(path.join(consumer, 'node_modules'));
  return packages.sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`));
}

for (const manager of packageManagers) {
  if (!['npm', 'pnpm'].includes(manager)) throw new Error(`Unsupported detached consumer package manager: ${manager}`);
  const base = fs.mkdtempSync(path.join(os.tmpdir(), `torque-framework-${manager}-`));
  const consumer = path.join(base, 'consumer');
  fs.mkdirSync(consumer, { recursive: true });
  try {
    writeConsumer(consumer);
    const managerVersion = execFileSync(manager, ['--version'], { cwd: consumer, encoding: 'utf8' }).trim();
    if (manager === 'pnpm') assert.equal(managerVersion, profile.pnpm, 'Detached pnpm version does not match the profile');
    console.log(`consumer-toolchain ${profileName} ${manager}@${managerVersion} node@${process.version}`);
    const installArgs = manager === 'npm'
      ? ['install', '--ignore-scripts', '--no-audit', '--no-fund']
      : ['install', '--ignore-scripts'];
    execFileSync(manager, installArgs, { cwd: consumer, stdio: 'inherit', env: { ...process.env, CI: 'true' } });
    const evidence = path.resolve(process.env.RUNNER_TEMP ?? process.env.TMPDIR ?? os.tmpdir(),
      'torque-framework-consumer-evidence', receipt.candidate, profileName, manager);
    fs.mkdirSync(evidence, { recursive: true });
    for (const file of ['package.json', 'package-lock.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']) {
      if (fs.existsSync(path.join(consumer, file))) fs.copyFileSync(path.join(consumer, file), path.join(evidence, file));
    }
    fs.writeFileSync(path.join(evidence, 'dependency-graph.json'), `${JSON.stringify(installedGraph(consumer), null, 2)}\n`);
    fs.writeFileSync(path.join(evidence, 'toolchain.json'), `${JSON.stringify({ profile: profileName, manager, managerVersion, node: process.version }, null, 2)}\n`);
    console.log(`consumer-versions ${profileName} ${manager} ${JSON.stringify(resolvedVersions(consumer))}`);
    runTypecheck(consumer);
    runNegativePublicContractCheck(consumer);
    await verifyNativeNode(consumer);
    verifySingletons(consumer);
    await verifyBuilds(consumer);
    await verifyBrowser(consumer, manager);
    await verifyStoreHmr(consumer, evidence);
    console.log(`archive-consumer-pass ${manager}`);
  } finally {
    if (process.env.KEEP_CONSUMER_ARTIFACTS !== 'true') fs.rmSync(base, { recursive: true, force: true });
    else console.log(`consumer-retained ${base}`);
  }
}

console.log(`detached-consumers-pass ${packageManagers.join(',')}`);
