import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

export const FRAMEWORK_PACKAGE_NAMES = Object.freeze([
  '@global-torque/domain-types',
  '@global-torque/invest-core',
  '@global-torque/invest-data',
  '@global-torque/invest-runtime',
  '@global-torque/invest-widgets',
  '@global-torque/invest-features',
  '@global-torque/invest-shell',
]);

const UI_SSR_CLOSURE = Object.freeze([
  '@global-torque/ui-kit',
  '@global-torque/ui-primitives',
  '@vueuse/integrations',
  'reka-ui',
  'radix-vue',
  'vue-select',
]);
const UI_PEER_OWNER = '@global-torque/ui-kit';
const UI_PEER_PACKAGE = 'reka-ui';

const stateDirectory = root => path.join(root, '.torque-framework-links');
const journalPath = root => path.join(stateDirectory(root), 'journal.json');
const ownerIdentity = (...roots) => crypto.createHash('sha256').update(roots.join('\0')).digest('hex').slice(0, 16);

/** @param {string} root @param {string} packageName */
function packageNodeModulesPath(root, packageName) {
  const match = packageName.match(/^(@[^/]+)\/(.+)$/u);
  return match
    ? path.join(root, 'node_modules', match[1], match[2])
    : path.join(root, 'node_modules', packageName);
}

/** @param {string} parent @param {string} candidate */
function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

/** @param {string} root */
function readJournal(root) {
  const filePath = journalPath(root);
  if (!fs.existsSync(filePath)) return null;
  let journal;
  try { journal = JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { throw new Error(`Framework link journal is unreadable: ${filePath}`); }
  if (!journal || journal.schemaVersion !== 1) throw new Error('Framework link journal schema is unsupported.');
  return journal;
}

function installedPath(root, packageName) {
  const candidate = packageNodeModulesPath(root, packageName);
  try { fs.lstatSync(candidate); return candidate; } catch { return null; }
}

function frameworkDependencies(manifest) {
  return FRAMEWORK_PACKAGE_NAMES.filter(name => [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.optionalDependencies,
    manifest.peerDependencies,
  ].some(section => section && Object.hasOwn(section, name)));
}

function packageManifest(packageRoot) {
  return JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
}

function importExportTarget(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    for (const candidate of value) {
      const target = importExportTarget(candidate);
      if (target) return target;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  for (const condition of ['import', 'default']) {
    if (Object.hasOwn(value, condition)) {
      const target = importExportTarget(value[condition]);
      if (target) return target;
    }
  }
  return null;
}

/**
 * Build aliases from the peer package's public import export map. A directory
 * alias lets Vite resolve the package root normally; explicit subpath aliases
 * use the package's own `import` targets so CJS `require` entries are never
 * selected by this helper.
 *
 * @param {string} packageRoot
 * @param {string} packageName
 * @param {any} manifest
 * @returns {Record<string, string>}
 */
function packageImportAliases(packageRoot, packageName, manifest) {
  const exportsMap = manifest.exports;
  if (!exportsMap || typeof exportsMap !== 'object' || Array.isArray(exportsMap)) {
    throw new Error(`Consumer app ${packageName} does not expose a usable public import map.`);
  }
  const aliases = {};
  const publicSubpaths = Object.entries(exportsMap)
    .filter(([subpath]) => subpath !== '.' && subpath.startsWith('./') && !subpath.includes('*'))
    .sort(([left], [right]) => right.length - left.length);
  for (const [subpath, exportValue] of publicSubpaths) {
    const target = importExportTarget(exportValue);
    if (!target || !target.startsWith('./') || target.includes('*')) {
      throw new Error(`Consumer app ${packageName} has no supported import target for ${subpath}.`);
    }
    const targetPath = path.resolve(packageRoot, target);
    if (!isWithin(packageRoot, targetPath)) {
      throw new Error(`Consumer app ${packageName} export escapes its package root: ${subpath}.`);
    }
    try { fs.statSync(targetPath); }
    catch { throw new Error(`Consumer app ${packageName} export target is missing: ${targetPath}.`); }
    aliases[`${packageName}${subpath.slice(1)}`] = targetPath;
  }
  // Vite aliases use first prefix match. Keep the bare package entry last so
  // an explicit public subpath such as `reka-ui/date` remains resolvable.
  aliases[packageName] = packageRoot;
  return aliases;
}

/**
 * Resolve a UI peer from the app's selected public UI Kit installation. The
 * app does not declare Reka directly, so resolving it from appRoot would
 * select nothing (or an unrelated ancestor). Node's package resolver follows
 * the UI Kit package's declared peer installation and its exported manifest;
 * Vite receives the package directory and applies the package's import
 * condition itself.
 *
 * @param {string} appRoot
 * @param {string} consumerRoot
 * @returns {{root: string, aliases: Record<string, string>}}
 */
function resolveUiPeerRoot(appRoot, consumerRoot) {
  const uiKitCandidate = packageNodeModulesPath(appRoot, UI_PEER_OWNER);
  let uiKitRoot;
  try {
    uiKitRoot = fs.realpathSync(uiKitCandidate);
  }
  catch {
    throw new Error(`Local framework mode requires the consumer app's ${UI_PEER_OWNER} installation to resolve ${UI_PEER_PACKAGE}; ${uiKitCandidate} is unavailable.`);
  }
  if (!isWithin(consumerRoot, uiKitRoot)) {
    throw new Error(`Consumer app ${UI_PEER_OWNER} installation escapes the consumer root: ${uiKitRoot}.`);
  }
  let uiKitManifest;
  try { uiKitManifest = packageManifest(uiKitRoot); }
  catch (error) {
    throw new Error(`Consumer app ${UI_PEER_OWNER} manifest is unreadable: ${path.join(uiKitRoot, 'package.json')} (${error instanceof Error ? error.message : String(error)}).`);
  }
  if (uiKitManifest.name !== UI_PEER_OWNER) {
    throw new Error(`Consumer app UI package identity is invalid at ${uiKitRoot}: expected ${UI_PEER_OWNER}.`);
  }
  if (typeof uiKitManifest.peerDependencies?.[UI_PEER_PACKAGE] !== 'string') {
    throw new Error(`Consumer app ${UI_PEER_OWNER} does not declare its required ${UI_PEER_PACKAGE} peer.`);
  }
  let peerManifestPath;
  try {
    const resolveFromUiKit = createRequire(path.join(uiKitRoot, 'package.json'));
    peerManifestPath = resolveFromUiKit.resolve(`${UI_PEER_PACKAGE}/package.json`);
  }
  catch (error) {
    throw new Error(`Consumer app ${UI_PEER_OWNER} peer ${UI_PEER_PACKAGE} is unavailable from ${uiKitRoot}; run the registry install first (${error instanceof Error ? error.message : String(error)}).`);
  }
  const peerRoot = fs.realpathSync(path.dirname(peerManifestPath));
  if (!isWithin(consumerRoot, peerRoot)) {
    throw new Error(`Consumer app ${UI_PEER_PACKAGE} peer escapes the consumer root: ${peerRoot}.`);
  }
  const peerManifest = packageManifest(peerRoot);
  if (peerManifest.name !== UI_PEER_PACKAGE) {
    throw new Error(`Resolved UI peer identity is invalid at ${peerRoot}: expected ${UI_PEER_PACKAGE}.`);
  }
  return { root: peerRoot, aliases: packageImportAliases(peerRoot, UI_PEER_PACKAGE, peerManifest) };
}

function assertResolvedLink(candidate, expected, label) {
  let resolved;
  try { resolved = fs.realpathSync(candidate); }
  catch { throw new Error(`Framework link is stale or unreadable for ${label}.`); }
  if (resolved !== expected) throw new Error(`Framework importer graph is mixed for ${label}.`);
}

/** @param {string} root @param {any} journal */
function assertActiveLinks(root, journal) {
  if (journal.phase !== 'active') throw new Error(`Framework link state is ${journal.phase}; run framework:recover.`);
  if (typeof journal.cohortVersion !== 'string' || !/^\d+\.\d+\.\d+$/u.test(journal.cohortVersion)) {
    throw new Error('Framework link journal has no valid cohort version; run framework:recover.');
  }
  const canonicalRoot = fs.realpathSync(journal.frameworkRoot);
  if (journal.consumerRoot && fs.realpathSync(journal.consumerRoot) !== root) throw new Error('Framework link journal belongs to another consumer root.');
  const names = [];
  for (const item of journal.packages || []) names.push(item.name);
  names.sort();
  const expectedNames = [...FRAMEWORK_PACKAGE_NAMES].sort();
  if (JSON.stringify(names) !== JSON.stringify(expectedNames)) throw new Error('Framework link cohort has the wrong package identities.');
  const seen = new Set();
  const expectedByName = new Map();
  for (const item of journal.packages || []) {
    const expected = fs.realpathSync(item.path);
    if (!isWithin(canonicalRoot, expected)) throw new Error(`Framework package escapes its canonical root: ${item.name}`);
    const expectedSource = fs.realpathSync(path.join(canonicalRoot, 'packages', item.name.slice('@global-torque/'.length)));
    if (expected !== expectedSource) throw new Error(`Framework package source does not match its canonical package: ${item.name}.`);
    const manifest = packageManifest(expected);
    if (manifest.name !== item.name) throw new Error(`Framework package manifest identity is invalid: ${item.name}.`);
    if (manifest.version !== journal.cohortVersion) {
      throw new Error(`Framework package cohort version is stale or mixed for ${item.name}: expected ${journal.cohortVersion}, found ${manifest.version ?? '<missing>'}.`);
    }
    expectedByName.set(item.name, expected);
    if (seen.has(expected)) throw new Error(`Framework link cohort has overlapping package roots: ${item.name}.`);
    seen.add(expected);
  }
  if (seen.size !== FRAMEWORK_PACKAGE_NAMES.length) throw new Error('Framework link cohort is incomplete.');
  const roots = [...expectedByName.values()];
  for (let index = 0; index < roots.length; index += 1) {
    for (let nested = index + 1; nested < roots.length; nested += 1) {
      if (isWithin(roots[index], roots[nested]) || isWithin(roots[nested], roots[index])) {
        throw new Error('Framework link cohort has overlapping package roots.');
      }
    }
  }

  // pnpm may materialize a direct dependency in the workspace root and in
  // each importer. Check all importer copies so a stale root symlink cannot
  // hide a registry copy used by one of the applications.
  const importers = [
    root,
    ...(fs.existsSync(path.join(root, 'apps'))
      ? fs.readdirSync(path.join(root, 'apps'), { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => path.join(root, 'apps', entry.name))
      : []),
  ];
  const queue = [];
  for (const importer of importers) {
    const manifestPath = path.join(importer, 'package.json');
    const manifest = fs.existsSync(manifestPath) ? packageManifest(importer) : {};
    for (const packageName of frameworkDependencies(manifest)) {
      const candidate = installedPath(importer, packageName);
      if (!candidate) throw new Error(`Framework importer graph is incomplete for ${packageName} in ${importer}.`);
      assertResolvedLink(candidate, expectedByName.get(packageName), `${packageName} in ${importer}`);
      queue.push(packageName);
    }
    for (const packageName of FRAMEWORK_PACKAGE_NAMES) {
      const candidate = installedPath(importer, packageName);
      if (!candidate) continue;
      assertResolvedLink(candidate, expectedByName.get(packageName), `${packageName} in ${importer}`);
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
    for (const dependency of frameworkDependencies(packageManifest(packageRoot))) {
      const candidate = installedPath(packageRoot, dependency);
      if (!candidate) throw new Error(`Framework canonical graph is incomplete for ${dependency} required by ${packageName}.`);
      assertResolvedLink(candidate, expectedByName.get(dependency), `${dependency} required by ${packageName}`);
      queue.push(dependency);
    }
  }
  if (visited.size !== FRAMEWORK_PACKAGE_NAMES.length) {
    throw new Error(`Framework link cohort is incomplete or unreachable: ${FRAMEWORK_PACKAGE_NAMES.filter(name => !visited.has(name)).join(', ')}.`);
  }
}

/**
 * Return the Vite/Vitest fragment owned by local framework development.
 * This module is safe to import in registry mode without a canonical sibling
 * checkout. The Tahoe consumer owns its optional loader and calls this helper
 * only after reading its retained journal.
 */
/** @param {{root?: string, mode?: string, command?: string, appRoot?: string}} [options] @returns {any} */
export function createConsumerLinkViteConfig({ root, mode = 'registry', command = 'serve', appRoot } = {}) {
  const consumerRoot = fs.realpathSync(root || process.cwd());
  const journal = readJournal(consumerRoot);
  const local = mode === 'local' || mode === 'local-dev' || Boolean(journal);
  const common = {
    resolve: {
      preserveSymlinks: false,
      dedupe: ['vue', 'pinia', 'vue-router'],
    },
  };
  if (!local) return { active: false, config: common };
  if (!journal) throw new Error('Local framework mode requires an active framework link journal.');
  assertActiveLinks(consumerRoot, journal);
  const canonicalRoot = fs.realpathSync(journal.frameworkRoot);
  const packageRoots = journal.packages.map(item => fs.realpathSync(item.path));
  const uiPeer = appRoot
    ? resolveUiPeerRoot(fs.realpathSync(appRoot), consumerRoot)
    : null;
  if (uiPeer && isWithin(canonicalRoot, uiPeer.root)) {
    throw new Error(`Consumer app ${UI_PEER_PACKAGE} peer resolves inside the canonical framework root: ${uiPeer.root}.`);
  }
  const optimizeDepsExclude = [...FRAMEWORK_PACKAGE_NAMES];
  const noExternal = [...FRAMEWORK_PACKAGE_NAMES, ...UI_SSR_CLOSURE];
  return {
    active: true,
    frameworkRoot: canonicalRoot,
    config: {
      ...common,
      cacheDir: path.join(
        consumerRoot,
        '.cache',
        'vite',
        `framework-links-local-${ownerIdentity(canonicalRoot, appRoot ? path.resolve(appRoot) : consumerRoot)}`,
      ),
      resolve: {
        ...common.resolve,
        ...(uiPeer ? { alias: uiPeer.aliases } : {}),
      },
      optimizeDeps: {
        exclude: optimizeDepsExclude,
      },
      ssr: {
        noExternal,
      },
      server: {
        fs: {
          // Keep the consumer workspace in Vite's file-system allowlist while
          // adding the canonical source roots outside the default search root.
          allow: [consumerRoot, canonicalRoot, ...packageRoots],
        },
        watch: {
          // Canonical package trees are outside this consumer and must stay
          // visible to Vite's watcher for source edits and SFC HMR.
          ignored: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
        },
      },
      test: {
        server: {
          deps: {
            inline: [...FRAMEWORK_PACKAGE_NAMES, ...UI_SSR_CLOSURE],
          },
        },
      },
      command,
    },
  };
}

/** @param {{root?: string, mode?: string, command?: string, appRoot?: string}} [options] @returns {any} */
export function frameworkLinkViteConfig(options = {}) {
  return createConsumerLinkViteConfig(options).config;
}

export function frameworkLinkPackageNames() {
  return [...FRAMEWORK_PACKAGE_NAMES];
}
