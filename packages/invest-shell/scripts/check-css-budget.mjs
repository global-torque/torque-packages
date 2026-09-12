import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { constants as zlibConstants, gzipSync } from 'node:zlib';
import { build as viteBuild } from 'vite';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageDirectory = path.resolve(scriptDirectory, '..');
const policyPath = path.join(packageDirectory, 'css-budget.json');
const CSS_ASSET_SEPARATOR = '\n/* webdevelop-ui-css-asset-boundary */\n';

function cssSourceToString(source) {
  return typeof source === 'string' ? source : Buffer.from(source).toString('utf8');
}

export function measureCss(css) {
  const buffer = Buffer.from(css);
  const compressed = gzipSync(buffer, {
    level: 9,
    memLevel: 9,
    strategy: zlibConstants.Z_DEFAULT_STRATEGY,
    windowBits: 15,
  });
  return {
    rawBytes: buffer.byteLength,
    gzipBytes: compressed.byteLength,
    generatedSelectorOccurrences: (css.match(/\.is--max-(?:width|height)[^{\s]*/g) ?? []).length,
    sha256: createHash('sha256').update(buffer).digest('hex'),
  };
}

export async function buildResolvedCss({
  entryPath,
  entrySource,
  rootDirectory,
  aliases = {},
}) {
  if (!entryPath && !entrySource) {
    throw new Error('A CSS budget build requires entryPath or entrySource.');
  }

  const root = path.resolve(rootDirectory);
  const virtualEntryId = '\0webdevelop-ui-css-budget-entry';
  const source = entrySource ?? `import ${JSON.stringify(path.resolve(entryPath))};`;
  const result = await viteBuild({
    appType: 'custom',
    configFile: false,
    logLevel: 'silent',
    root,
    resolve: { alias: aliases },
    plugins: [{
      name: 'webdevelop-ui-css-budget-entry',
      resolveId(id) {
        return id === virtualEntryId ? virtualEntryId : null;
      },
      load(id) {
        return id === virtualEntryId ? source : null;
      },
    }],
    build: {
      cssCodeSplit: false,
      cssMinify: false,
      minify: false,
      write: false,
      rollupOptions: {
        input: virtualEntryId,
      },
    },
  });
  const outputs = (Array.isArray(result) ? result : [result])
    .flatMap((buildResult) => buildResult.output);
  const cssAssets = outputs
    .filter((output) => output.type === 'asset' && output.fileName.endsWith('.css'))
    .map(asset => ({
      fileName: asset.fileName,
      source: cssSourceToString(asset.source),
    }))
    .sort((left, right) => left.fileName.localeCompare(right.fileName));

  if (cssAssets.length === 0) {
    throw new Error('The CSS budget Vite build emitted no CSS assets.');
  }

  return {
    css: cssAssets.map(asset => asset.source).join(CSS_ASSET_SEPARATOR),
    cssAssets: cssAssets.map(asset => asset.fileName),
  };
}

export function buildInvestShellCss(entries) {
  return buildResolvedCss({
    aliases: {
      UiKit: path.resolve(packageDirectory, '../ui-kit/src'),
    },
    entrySource: entries.map(entry => `import ${JSON.stringify(path.join(packageDirectory, entry))};`).join('\n'),
    rootDirectory: packageDirectory,
  });
}

export function evaluateBudget(metrics, maximum) {
  return Object.entries(maximum)
    .filter(([metric, limit]) => metrics[metric] > limit)
    .map(([metric, limit]) => `${metric}: ${metrics[metric]} exceeds ${limit}`);
}

export async function runCssBudget({ json = false } = {}) {
  const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  const { css, cssAssets } = await buildInvestShellCss(policy.entries);
  const metrics = measureCss(css);
  const failures = evaluateBudget(metrics, policy.maximum);

  if (failures.length > 0) {
    console.error(`Invest Shell CSS budget failed:\n- ${failures.join('\n- ')}`);
    process.exitCode = 1;
    return;
  }

  const result = {
    entries: policy.entries,
    ...metrics,
    cssAssets,
  };
  console.log(json
    ? JSON.stringify(result)
    : `Invest Shell CSS budget passed: ${JSON.stringify(result)}`);
  return result;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  await runCssBudget({ json: process.argv.includes('--json') });
}
