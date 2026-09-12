import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  buildInvestShellCss,
  buildResolvedCss,
  evaluateBudget,
  measureCss,
} from './check-css-budget.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageDirectory = path.resolve(scriptDirectory, '..');
const repositoryRoot = path.resolve(packageDirectory, '../..');
const fixtureDirectory = path.join(scriptDirectory, 'fixtures/css-budget');

const buildFixture = (entry) => buildResolvedCss({
  entryPath: path.join(fixtureDirectory, entry),
  rootDirectory: fixtureDirectory,
});

test('counts CSS imported through the production Vite pipeline', async () => {
  const [withImport, withoutImport] = await Promise.all([
    buildFixture('entry.scss'),
    buildFixture('entry-without-import.scss'),
  ]);
  const withImportMetrics = measureCss(withImport.css);
  const withoutImportMetrics = measureCss(withoutImport.css);

  assert.match(withImport.css, /fixture-imported-byte-contract/);
  assert.doesNotMatch(withImport.css, /@import/);
  assert.ok(withImportMetrics.rawBytes > withoutImportMetrics.rawBytes);
  assert.ok(withImportMetrics.gzipBytes > withoutImportMetrics.gzipBytes);
});

test('measures all public shell entries in app order against the reviewed bytes', async () => {
  const policy = JSON.parse(fs.readFileSync(path.join(packageDirectory, 'css-budget.json'), 'utf8'));
  assert.deepEqual(policy.entries, [
    'src/styles/geometry.css',
    'src/styles/components.css',
    'src/styles/index.scss',
  ]);
  assert.equal(policy.maximum.rawBytes - policy.current.rawBytes, 250);
  assert.equal(policy.maximum.gzipBytes - policy.current.gzipBytes, 50);
  assert.equal(policy.maximum.generatedSelectorOccurrences, 0);
  const { css } = await buildInvestShellCss(policy.entries);
  const metrics = measureCss(css);

  assert.doesNotMatch(css, /@import/);
  assert.equal(metrics.rawBytes, policy.current.rawBytes);
  assert.equal(metrics.sha256, policy.current.sha256);
  assert.equal(metrics.generatedSelectorOccurrences, 0);
  assert.deepEqual(evaluateBudget(metrics, policy.maximum), []);
  // Compression can differ across supported Node/zlib versions; enforce its
  // cap instead of treating the reference gzip size as a byte fingerprint.
});

test('rejects an unresolved stylesheet import', async () => {
  await assert.rejects(buildResolvedCss({
    entrySource: 'import "./missing-budget-stylesheet.css";',
    rootDirectory: fixtureDirectory,
  }));
});

test('rejects generated dimension selectors even below the byte caps', () => {
  const metrics = measureCss('.is--max-width-12 { max-width: 12px; }');
  assert.deepEqual(evaluateBudget(metrics, {
    rawBytes: 1000,
    gzipBytes: 1000,
    generatedSelectorOccurrences: 0,
  }), ['generatedSelectorOccurrences: 1 exceeds 0']);
});

test('uses the same canonical measurement from root and package CLI invocations', () => {
  const scriptPath = path.join(scriptDirectory, 'check-css-budget.mjs');
  const measureFrom = cwd => JSON.parse(execFileSync(
    process.execPath,
    [scriptPath, '--json'],
    { cwd, encoding: 'utf8' },
  ));
  const fromRepositoryRoot = measureFrom(repositoryRoot);
  const fromPackageDirectory = measureFrom(packageDirectory);

  assert.deepEqual(fromRepositoryRoot, fromPackageDirectory);
});
