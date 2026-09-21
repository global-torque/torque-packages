import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { assertNodeExportContracts, nodeExportContracts } from './node-build-contract.mjs';
import { resolveCssContractPackageRoots } from '../packages/invest-shell/scripts/css-contract-package-roots.mjs';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const reconciliation = JSON.parse(fs.readFileSync(path.join(root, 'docs/source-reconciliation.json'), 'utf8'));
const tempRoot = process.env.TMPDIR ?? os.tmpdir();
fs.mkdirSync(tempRoot, { recursive: true });
const fixtureRoot = fs.mkdtempSync(path.join(tempRoot, 'torque-release-contracts-'));
const sha512 = bytes => crypto.createHash('sha512').update(bytes).digest('hex');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const integrity = bytes => `sha512-${crypto.createHash('sha512').update(bytes).digest('base64')}`;
const expectedOverlayFileNames = [
  'pnpm-lock.canonical.yaml',
  'pnpm-lock.derived.yaml',
  'pnpm-workspace.canonical.yaml',
  'pnpm-workspace.derived.yaml',
];
const expectedOverlayImporters = ['packages/invest-features', 'packages/invest-shell', 'packages/invest-widgets'];
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const runScript = (script, args, options = {}) => execFileSync(process.execPath, [path.join(root, 'scripts', script), ...args], {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
  ...options,
});
const expectFailure = (label, callback) => assert.throws(callback, undefined, `${label} must reject`);

// Exercise the reconciliation-derived packlist guard without changing the workspace.
const packlistFixture = path.join(fixtureRoot, 'packlist-version');
fs.mkdirSync(path.join(packlistFixture, 'scripts'), { recursive: true });
fs.mkdirSync(path.join(packlistFixture, 'docs'), { recursive: true });
for (const file of ['check-packlist.mjs', 'node-build-contract.mjs']) {
  fs.copyFileSync(path.join(root, 'scripts', file), path.join(packlistFixture, 'scripts', file));
}
fs.copyFileSync(path.join(root, 'docs/source-reconciliation.json'), path.join(packlistFixture, 'docs/source-reconciliation.json'));
for (const entry of fs.readdirSync(path.join(root, 'packages'))) {
  const directory = path.join(packlistFixture, 'packages', entry);
  fs.mkdirSync(path.join(directory, 'src'), { recursive: true });
  fs.copyFileSync(path.join(root, 'packages', entry, 'package.json'), path.join(directory, 'package.json'));
}
const checkFixturePacklist = () => execFileSync(process.execPath, [path.join(packlistFixture, 'scripts/check-packlist.mjs')], { encoding: 'utf8', stdio: 'pipe' });
assert.match(checkFixturePacklist(), /packlist-contract-pass 7 packages/u);
const mismatchedManifestPath = path.join(packlistFixture, 'packages/domain-types/package.json');
const mismatchedManifest = JSON.parse(fs.readFileSync(mismatchedManifestPath, 'utf8'));
mismatchedManifest.version = '99.0.0';
writeJson(mismatchedManifestPath, mismatchedManifest);
assert.throws(checkFixturePacklist, /public MIT .* metadata missing/u);

for (const command of ['jq', 'tar', 'sha512sum']) execFileSync(command, ['--version'], { stdio: 'ignore' });
const releaseWorkflow = fs.readFileSync(path.join(root, '.github/workflows/release.yml'), 'utf8');
const provenanceWorkflow = fs.readFileSync(path.join(root, '.github/workflows/npm-provenance.yml'), 'utf8');
const publisherWorkflow = fs.readFileSync(path.join(root, '.github/workflows/publish.yml'), 'utf8');
const consumerScript = fs.readFileSync(path.join(root, 'scripts/verify-archive-consumers.mjs'), 'utf8');
const packCandidateScript = fs.readFileSync(path.join(root, 'scripts/pack-candidate.mjs'), 'utf8');
const cssContractScript = fs.readFileSync(path.join(root, 'packages/invest-shell/scripts/check-css-browser.mjs'), 'utf8');
const cssContractRootsScript = fs.readFileSync(path.join(root, 'packages/invest-shell/scripts/css-contract-package-roots.mjs'), 'utf8');
assert.match(consumerScript, /CONSUMER_TOKEN_MODE/u, 'Detached consumers must select an explicit token compatibility mode');
assert.match(consumerScript, /new Set\(\['absent', '0\.2\.1', '0\.3\.0'\]\)/u, 'Detached consumers must support all reviewed token modes');
assert.match(packCandidateScript, /compatibilityMatrix: reconciliation\.compatibilityMatrix/u, 'Candidate receipt must bind the complete token compatibility matrix');
assert.match(releaseWorkflow, /gh api[\s\S]+releases\//u);
assert.doesNotMatch(releaseWorkflow, /actions\/download-artifact/u);
assert.match(releaseWorkflow, /global-torque-ui-kit-0\.1\.4\.tgz/u);
assert.match(releaseWorkflow, /verify-ui-kit-lock-overlay\.mjs/u);
assert.match(releaseWorkflow, /REQUIRE_CLEAN_SOURCE: 'true'/u);
assert.match(releaseWorkflow, /pnpm run pack:candidate/u);
assert.match(releaseWorkflow, /verify-external-dependency\.mjs/u);
assert.doesNotMatch(releaseWorkflow, /pnpm audit|verify-candidate\.mjs|verify-archive-consumers\.mjs/u);
assert.match(releaseWorkflow, /pnpm exec playwright install --with-deps chromium/u);
assert.match(releaseWorkflow, /test:css-browser/u);
assert.match(releaseWorkflow, /CSS_BROWSER_REPORT/u);
assert.doesNotMatch(releaseWorkflow, /- run: pnpm run check/u);
assert.ok(packCandidateScript.indexOf("['run', 'build:node']") < packCandidateScript.indexOf("['run', 'check']"), 'Node build must precede tests');
assert.ok(packCandidateScript.indexOf("['run', 'check']") < packCandidateScript.indexOf('fs.mkdirSync(output'), 'Tests must precede output creation');
assert.match(releaseWorkflow, /pnpm run test:release/u);
assert.match(releaseWorkflow, /gh attestation verify[\s\S]+--bundle/u);
assert.match(releaseWorkflow, /actions\/setup-node@[0-9a-f]{40}\b/u);
assert.match(releaseWorkflow, /gh run view "\$UI_KIT_SOURCE_RUN_ID" --repo global-torque\/vue-ui/u);
assert.match(releaseWorkflow, /Verified public UI artifacts/u);
for (const match of releaseWorkflow.matchAll(/uses:\s+[^@\s]+@([0-9a-f]+)/gu)) assert.equal(match[1].length, 40, 'Release workflow action pins must be full commit SHAs');
for (const match of provenanceWorkflow.matchAll(/uses:\s+[^@\s]+@([0-9a-f]+)/gu)) assert.equal(match[1].length, 40, 'Provenance workflow action pins must be full commit SHAs');
assert.match(provenanceWorkflow, /verify-provenance-context\.mjs/u);
assert.match(provenanceWorkflow, /refs\/tags\/\$RELEASE_TAG/u);
assert.match(provenanceWorkflow, /Verify every immutable release asset byte/u);
assert.match(provenanceWorkflow, /cmp "artifacts\/\$asset_name"/u);
assert.match(provenanceWorkflow, /actions\/attest@/u);
assert.doesNotMatch(provenanceWorkflow, /npm publish/u);
assert.match(publisherWorkflow, /workflow_dispatch:/u);
assert.match(publisherWorkflow, /id-token:\s*write/u);
assert.match(publisherWorkflow, /gh release download/u);
assert.match(
  publisherWorkflow,
  /bootstrap:\n\s+description: Use the temporary NPM_BOOTSTRAP_TOKEN[\s\S]+?required: true\n\s+default: false\n\s+type: boolean/u,
  'Publisher must expose an explicit required boolean bootstrap input',
);
assert.match(
  publisherWorkflow,
  /NODE_AUTH_TOKEN: \$\{\{ inputs\.bootstrap && secrets\.NPM_BOOTSTRAP_TOKEN \|\| '' \}\}/u,
  'Bootstrap auth must be sourced from the repository secret only when enabled',
);
assert.equal(
  (publisherWorkflow.match(/secrets\.NPM_BOOTSTRAP_TOKEN/gu) ?? []).length,
  1,
  'Publisher must reference the bootstrap secret exactly once',
);
assert.doesNotMatch(
  publisherWorkflow,
  /NODE_AUTH_TOKEN:[ \t]+(?!\$\{\{)[^\n]+/u,
  'Publisher must not contain a literal bootstrap token',
);
assert.match(
  publisherWorkflow,
  /gh release verify-asset "\$RELEASE_TAG" "\$asset"/u,
  'Publisher must verify each retained asset using its downloaded local path',
);
assert.doesNotMatch(
  publisherWorkflow,
  /gh release verify-asset "\$RELEASE_TAG" "\$\(basename "\$asset"\)"/u,
  'Publisher must not verify a basename that is absent from the working directory',
);
assert.match(publisherWorkflow, /verify-provenance-context\.mjs/u);
assert.match(publisherWorkflow, /verify-release-bundle\.mjs/u);
assert.match(
  publisherWorkflow,
  /archive="\.\/release\/global-torque-\$\{package\}-\$\{CANDIDATE\}\.tgz"/u,
  'Publisher must pass an explicit filesystem path to npm publish',
);
assert.match(publisherWorkflow, /npm publish "\$archive" --access public --provenance --tag latest/u);
assert.match(publisherWorkflow, /package_spec="@global-torque\/\$\{package\}@\$\{CANDIDATE\}"/u);
assert.match(publisherWorkflow, /npm pack "\$package_spec" --pack-destination registry/u);
assert.match(publisherWorkflow, /cmp "\$archive" "registry\/\$registry_archive"/u);
assert.match(publisherWorkflow, /publication-receipt\.json/u);
assert.ok(publisherWorkflow.indexOf('domain-types invest-core invest-data invest-runtime invest-widgets invest-features invest-shell') < publisherWorkflow.indexOf('npm publish'), 'Publisher must define dependency order before publication');
assert.doesNotMatch(publisherWorkflow, /pnpm (?:run )?(?:pack|build)/u);
for (const match of publisherWorkflow.matchAll(/uses:\s+[^@\s]+@([0-9a-f]+)/gu)) assert.equal(match[1].length, 40, 'Publisher workflow action pins must be full commit SHAs');
assert.match(provenanceWorkflow, /type == "array" and length > 0 and all\(\.\[\]; \(\.attestation \| type == "object"\) and \(\.verificationResult \| type == "object"\)\)/u);
assert.doesNotMatch(provenanceWorkflow, /matrix\.package\s*==\s*['"]domain-types['"]/u);
assert.match(consumerScript, /@global-torque\/invest-shell\/styles';/u);
assert.match(consumerScript, /@global-torque\/invest-features\/offers/u);
assert.match(consumerScript, /CSS_CONTRACT_FEATURES_PACKAGE_DIR/u);
assert.match(cssContractRootsScript, /CSS_CONTRACT_PACKAGE_DIR/u);
assert.match(cssContractRootsScript, /CSS_CONTRACT_FEATURES_PACKAGE_DIR/u);
assert.doesNotMatch(cssContractScript, /packageDirectoryOverride|featuresPackageDirectoryOverride/u, 'Browser contract must not duplicate root override selection');
assert.match(cssContractScript, /css-contract-package-roots\.mjs/u, 'Browser contract must use the shared root resolver');
assert.match(
  cssContractScript,
  /resolveCssContractPackageRoots\(\{ canonicalPackageDirectory \}\)/u,
  'Browser contract must call the shared root resolver with its canonical source root',
);
assert.match(consumerScript, /Public shell styles entry emitted no typography rules/u);
assert.match(consumerScript, /Public shell styles entry emitted no responsive rules/u);
assert.match(consumerScript, /@playwright\/test/u);
assert.match(consumerScript, /chromium\.launch/u);
assert.match(consumerScript, /check-css-browser\.mjs/u);
assert.match(consumerScript, /width: 1280, height: 800/u);
assert.match(consumerScript, /width: 390, height: 844/u);
assert.match(consumerScript, /fontSize: '24px'/u);
assert.match(consumerScript, /lineHeight: '36px'/u);
assert.match(consumerScript, /fontWeight: '900'/u);
assert.match(consumerScript, /setProperty\('font-size', 'revert'\)/u);
assert.match(consumerScript, /finally \{/u);
assert.match(consumerScript, /torque-framework-consumer-evidence/u);
assert.ok(provenanceWorkflow.indexOf('verify-release-bundle.mjs') < provenanceWorkflow.indexOf('gh attestation verify'), 'Provenance verification must precede signing');
assert.ok(provenanceWorkflow.indexOf('gh attestation verify') < provenanceWorkflow.indexOf('actions/attest@'), 'Source attestation verification must precede npm identity signing');
assert.ok(releaseWorkflow.indexOf('gh attestation verify') < releaseWorkflow.indexOf('pnpm install --force --lockfile-only --no-frozen-lockfile --ignore-scripts'), 'UI attestation verification must precede dependency graph derivation');
assert.ok(releaseWorkflow.indexOf('source_status=') < releaseWorkflow.indexOf('pnpm install --force --lockfile-only --no-frozen-lockfile --ignore-scripts'), 'Source cleanliness must be checked before dependency graph derivation');
assert.ok(releaseWorkflow.includes('pnpm install --frozen-lockfile --ignore-scripts'), 'Release workflow must install the verified graph with frozen lockfile enforcement');
assert.doesNotMatch(releaseWorkflow, /pnpm install --no-frozen-lockfile(?! --ignore-scripts)/u);

const cssContractRoots = path.join(fixtureRoot, 'css-contract-roots');
const cssShellRoot = path.join(cssContractRoots, 'shell');
const cssFeaturesRoot = path.join(fixtureRoot, 'separate-css-features', 'features');
const cssShellSource = path.join(root, 'packages/invest-shell');
const cssFeaturesSource = path.join(root, 'packages/invest-features');
const cssShellFiles = [
  'package.json',
  'src/styles/geometry.css',
  'src/styles/components.css',
  'src/components/VHeaderBar/VHeaderBar.vue',
  'src/components/VFooter/VFooter.vue',
  'src/components/VFooter/VFooterBottom.vue',
  'src/components/VFooter/VFooterMenu.vue',
  'src/components/VFooter/VFooterText.vue',
  'src/pwa/PWAFooterMenu.vue',
];
const cssFeaturesFiles = ['package.json', 'src/offers/components/OffersDetailsSide.vue'];
for (const [source, destination, files] of [
  [cssShellSource, cssShellRoot, cssShellFiles],
  [cssFeaturesSource, cssFeaturesRoot, cssFeaturesFiles],
]) {
  for (const file of files) {
    const target = path.join(destination, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(source, file), target);
  }
}
assert.notEqual(path.dirname(cssShellRoot), path.dirname(cssFeaturesRoot), 'CSS roots must be non-sibling fixtures');
assert.deepEqual(
  resolveCssContractPackageRoots({
    environment: {},
    canonicalPackageDirectory: cssShellSource,
    workspaceRoot: root,
  }),
  {
    packageDirectory: path.resolve(cssShellSource),
    featuresPackageDirectory: path.resolve(cssFeaturesSource),
    version: reconciliation.packages[0].version,
  },
  'CSS contract source fallback must accept the verified Torque workspace root',
);
const resolveFixtureRoots = environment => resolveCssContractPackageRoots({
  environment,
  canonicalPackageDirectory: cssShellRoot,
  workspaceRoot: cssContractRoots,
});
expectFailure('CSS contract source fallback outside the Torque workspace', () => resolveFixtureRoots({}));
const missingShellRoot = path.join(fixtureRoot, 'missing-css-shell');
expectFailure('CSS contract missing package manifest', () => resolveCssContractPackageRoots({
  environment: { CSS_CONTRACT_PACKAGE_DIR: missingShellRoot, CSS_CONTRACT_FEATURES_PACKAGE_DIR: cssFeaturesRoot },
  canonicalPackageDirectory: cssShellRoot,
  workspaceRoot: cssContractRoots,
}));
const malformedShellRoot = path.join(fixtureRoot, 'malformed-css-shell');
fs.mkdirSync(malformedShellRoot, { recursive: true });
fs.writeFileSync(path.join(malformedShellRoot, 'package.json'), '{ malformed\n');
expectFailure('CSS contract malformed package manifest', () => resolveCssContractPackageRoots({
  environment: { CSS_CONTRACT_PACKAGE_DIR: malformedShellRoot, CSS_CONTRACT_FEATURES_PACKAGE_DIR: cssFeaturesRoot },
  canonicalPackageDirectory: cssShellRoot,
  workspaceRoot: cssContractRoots,
}));
const wrongNameShellRoot = path.join(fixtureRoot, 'wrong-name-css-shell');
fs.mkdirSync(wrongNameShellRoot, { recursive: true });
writeJson(path.join(wrongNameShellRoot, 'package.json'), {
  name: '@global-torque/not-invest-shell',
  version: reconciliation.packages[0].version,
});
expectFailure('CSS contract wrong package name', () => resolveCssContractPackageRoots({
  environment: { CSS_CONTRACT_PACKAGE_DIR: wrongNameShellRoot, CSS_CONTRACT_FEATURES_PACKAGE_DIR: cssFeaturesRoot },
  canonicalPackageDirectory: cssShellRoot,
  workspaceRoot: cssContractRoots,
}));
expectFailure('CSS contract shell-only override', () => resolveFixtureRoots({ CSS_CONTRACT_PACKAGE_DIR: cssShellRoot }));
expectFailure('CSS contract features-only override', () => resolveFixtureRoots({ CSS_CONTRACT_FEATURES_PACKAGE_DIR: cssFeaturesRoot }));
expectFailure('CSS contract empty shell override', () => resolveFixtureRoots({ CSS_CONTRACT_PACKAGE_DIR: '', CSS_CONTRACT_FEATURES_PACKAGE_DIR: cssFeaturesRoot }));
expectFailure('CSS contract empty features override', () => resolveFixtureRoots({ CSS_CONTRACT_PACKAGE_DIR: cssShellRoot, CSS_CONTRACT_FEATURES_PACKAGE_DIR: '' }));
expectFailure('CSS contract both empty overrides', () => resolveFixtureRoots({ CSS_CONTRACT_PACKAGE_DIR: '', CSS_CONTRACT_FEATURES_PACKAGE_DIR: '' }));
expectFailure('CSS contract swapped package roots', () => resolveFixtureRoots({ CSS_CONTRACT_PACKAGE_DIR: cssFeaturesRoot, CSS_CONTRACT_FEATURES_PACKAGE_DIR: cssShellRoot }));
const mismatchedFeaturesRoot = path.join(fixtureRoot, 'mismatched-css-features', 'features');
fs.mkdirSync(mismatchedFeaturesRoot, { recursive: true });
fs.copyFileSync(path.join(cssFeaturesRoot, 'package.json'), path.join(mismatchedFeaturesRoot, 'package.json'));
const mismatchedFeaturesManifest = JSON.parse(fs.readFileSync(path.join(mismatchedFeaturesRoot, 'package.json')));
mismatchedFeaturesManifest.version = '99.0.0';
writeJson(path.join(mismatchedFeaturesRoot, 'package.json'), mismatchedFeaturesManifest);
expectFailure('CSS contract mismatched package cohorts', () => resolveFixtureRoots({
  CSS_CONTRACT_PACKAGE_DIR: cssShellRoot,
  CSS_CONTRACT_FEATURES_PACKAGE_DIR: mismatchedFeaturesRoot,
}));
const resolvedFixtureRoots = resolveFixtureRoots({
  CSS_CONTRACT_PACKAGE_DIR: cssShellRoot,
  CSS_CONTRACT_FEATURES_PACKAGE_DIR: cssFeaturesRoot,
});
assert.deepEqual(
  resolvedFixtureRoots,
  {
    packageDirectory: path.resolve(cssShellRoot),
    featuresPackageDirectory: path.resolve(cssFeaturesRoot),
    version: reconciliation.packages[0].version,
  },
  'CSS contract must accept independently installed non-sibling shell and features roots',
);

function parseWorkflowJob(workflow, jobName) {
  const lines = workflow.split('\n');
  const jobHeader = new RegExp(`^  ${jobName}:\\s*$`, 'u');
  const steps = [];
  let inJob = false;
  let inSteps = false;
  let current = null;
  let readingWith = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (jobHeader.test(line)) {
      inJob = true;
      continue;
    }
    if (!inJob) continue;
    if (/^  [^\s].*:\s*$/u.test(line) && !/^  [a-zA-Z0-9_-]+:\s*$/u.test(line)) break;
    if (/^    steps:\s*$/u.test(line)) {
      inSteps = true;
      continue;
    }
    if (!inSteps) continue;
    const stepMatch = line.match(/^      - (name|uses):\s*(.*)$/u);
    if (stepMatch) {
      current = { [stepMatch[1]]: stepMatch[2].trim() };
      readingWith = false;
      steps.push(current);
      continue;
    }
    if (!current) continue;
    if (/^        with:\s*$/u.test(line)) {
      current.with = {};
      readingWith = true;
      continue;
    }
    if (readingWith) {
      const withMatch = line.match(/^          ([a-zA-Z0-9_-]+):\s*(.*)$/u);
      if (withMatch) {
        current.with[withMatch[1]] = withMatch[2].trim();
        continue;
      }
      readingWith = false;
    }
    const usesMatch = line.match(/^        uses:\s*(.*)$/u);
    if (usesMatch) {
      current.uses = usesMatch[1].trim();
      continue;
    }
    const conditionMatch = line.match(/^        if:\s*(.*)$/u);
    if (conditionMatch) {
      readingWith = false;
      current.if = conditionMatch[1].trim();
      continue;
    }
    const runMatch = line.match(/^        run:\s*(.*)$/u);
    if (!runMatch) continue;
    readingWith = false;
    if (runMatch[1] !== '|- ' && runMatch[1] !== '|' && runMatch[1] !== '>-' && runMatch[1] !== '>') {
      current.run = runMatch[1];
      continue;
    }
    const body = [];
    index += 1;
    while (index < lines.length) {
      const bodyLine = lines[index];
      if (bodyLine.trim() !== '' && !/^          /u.test(bodyLine)) break;
      body.push(bodyLine.startsWith('          ') ? bodyLine.slice(10) : '');
      index += 1;
    }
    current.run = body.join('\n');
    index -= 1;
  }
  return steps;
}

function matrixPackages(workflow) {
  const match = workflow.match(/package:\s*\[([^\]]+)\]/u);
  if (!match) throw new Error('Provenance workflow matrix is missing');
  return match[1].split(',').map(value => value.trim()).filter(Boolean);
}

const provenanceSteps = parseWorkflowJob(provenanceWorkflow, 'attest');
const provenanceMatrix = matrixPackages(provenanceWorkflow);
assert.deepEqual(provenanceMatrix, ['domain-types', 'invest-core', 'invest-data', 'invest-runtime', 'invest-widgets', 'invest-features', 'invest-shell']);
const publisherSteps = parseWorkflowJob(publisherWorkflow, 'publish');
const publisherStep = publisherSteps.find(step => step.name === 'Publish exact retained tarballs sequentially with trusted OIDC');
assert.ok(publisherStep?.run, 'Publisher must define the sequential publication body');
assert.match(publisherStep.run, /if \[\[ "\$\{BOOTSTRAP\}" == "true" \]\]; then[\s\S]+unset NODE_AUTH_TOKEN/u);
assert.match(publisherStep.run, /for package in "\$\{packages\[@\]\}"; do[\s\S]+npm publish "\$archive"/u);
assert.match(publisherStep.run, /registry_retry_attempts=8/u);
assert.match(publisherStep.run, /while \(\( pack_attempt <= registry_retry_attempts \)\); do/u);
assert.match(publisherStep.run, /sleep "\$pack_delay_seconds"[\s\S]+pack_delay_seconds=\$\(\(pack_delay_seconds \* 2\)\)/u);
assert.match(publisherStep.run, /npm view "\$package_spec" version --json/u);
assert.match(publisherStep.run, /view_error_text[\s\S]+E404[\s\S]+ETARGET/u);
assert.match(publisherStep.run, /pack_error_text[\s\S]+E404[\s\S]+ETARGET/u);
assert.match(publisherStep.run, /cmp "\$archive" "registry\/\$registry_archive"/u);
assert.doesNotThrow(
  () => execFileSync('bash', ['-n'], { input: publisherStep.run, encoding: 'utf8' }),
  'Publisher shell body must pass Bash syntax validation',
);
const publisherDownloadStep = publisherSteps.find(step => step.name === 'Download and reverify the exact retained candidate');
assert.ok(publisherDownloadStep?.run, 'Publisher must define the retained candidate download body');
for (const requiredTransportAsset of [
  'selected-release.json',
  'original-provenance.json',
  'transport-receipt.json',
  'pnpm-lock.canonical.yaml',
  'pnpm-lock.derived.yaml',
  'pnpm-workspace.canonical.yaml',
  'pnpm-workspace.derived.yaml',
]) {
  assert.match(
    publisherDownloadStep.run,
    new RegExp(`--pattern '${requiredTransportAsset.replaceAll('.', '\\.')}'`, 'u'),
    `Publisher must download retained UI Kit asset ${requiredTransportAsset}`,
  );
}
const candidateSteps = parseWorkflowJob(releaseWorkflow, 'candidate');
const candidateJob = releaseWorkflow.match(/^  candidate:\n[\s\S]*?^    steps:/mu)?.[0] ?? '';
assert.match(candidateJob, /\n    permissions:\n[\s\S]*?\n      contents: write\n/u, 'Candidate workflow must be able to read draft transport assets');
assert.match(releaseWorkflow, /\n  contents: read\n/u, 'Workflow default permissions must remain read-only');
const releaseDownloadStep = candidateSteps.find(step => step.name === 'Download retained UI Kit transport from this repository');
const installDependencyStep = candidateSteps.find(step => step.name === 'Install checked dependency graph');
const candidateAttestationStep = candidateSteps.find(step => step.uses?.startsWith('actions/attest@'));
const candidateRetentionStep = candidateSteps.find(step => step.name === 'Retain exact candidate and combined receipt');
assert.equal(candidateAttestationStep?.if, undefined, 'Candidate attestation must retain success gating');
assert.equal(candidateRetentionStep?.if, undefined, 'Canonical candidate retention must retain success gating');
assert.ok(installDependencyStep?.run, 'Actual release workflow must define the dependency installation body');
assert.ok(installDependencyStep.run.indexOf('source_status=') < installDependencyStep.run.indexOf('pnpm install'), 'Dependency installation must follow the source cleanliness guard');
const assetVerificationStep = provenanceSteps.find(step => step.name === 'Verify every immutable release asset byte');
const archiveVerificationStep = provenanceSteps.find(step => step.name === 'Verify the exact retained archive');
const signingStep = provenanceSteps.find(step => step.uses?.startsWith('actions/attest@'));
assert.ok(releaseDownloadStep?.run, 'Actual release workflow must define the UI Kit download body');
const releaseDownloadBlock = releaseWorkflow.match(/- name: Download retained UI Kit transport from this repository[\s\S]*?(?=\n      - name:)/u)?.[0] ?? '';
const installDependencyBlock = releaseWorkflow.match(/- name: Install checked dependency graph[\s\S]*?(?=\n      - name:)/u)?.[0] ?? '';
assert.match(releaseDownloadBlock, /GH_TOKEN: \$\{\{ github\.token \}\}/u, 'UI Kit download must retain the repository token');
assert.doesNotMatch(installDependencyBlock, /GH_TOKEN:/u, 'Dependency installation must not receive an unused repository token');
assert.ok(assetVerificationStep?.run?.includes('gh api'), 'Actual asset verification body must download release assets');
assert.ok(assetVerificationStep?.run?.includes('cmp "artifacts/$asset_name"'), 'Actual asset verification body must compare every retained byte');
assert.match(releaseDownloadStep.run, /gh api --header 'Accept: application\/octet-stream' \\\n\s+"\/repos\/\$\{GITHUB_REPOSITORY\}\/releases\/assets\/\$asset_id" > "\$transport_dir\/\$asset"/u);
assert.match(assetVerificationStep.run, /gh api --header 'Accept: application\/octet-stream' \\\n\s+"\/repos\/\$\{GITHUB_REPOSITORY\}\/releases\/assets\/\$asset_id" > "\$release_assets\/\$asset_name"/u);
assert.doesNotMatch(releaseDownloadStep.run, /--output/u, 'UI Kit download must use gh api stdout');
assert.doesNotMatch(assetVerificationStep.run, /--output/u, 'Release asset verification must use gh api stdout');
assert.ok(archiveVerificationStep?.run?.includes('verify-release-bundle.mjs'), 'Actual archive verification body must verify the local bundle');
assert.doesNotMatch(archiveVerificationStep.run, /gh api/u, 'Per-package archive verification must reuse the full asset download');
assert.ok(signingStep, 'Actual matrix workflow must retain the npm identity signing step');

function makeArchive(directory, manifest, files = {}) {
  const packageDirectory = path.join(directory, 'package');
  fs.mkdirSync(path.join(packageDirectory, 'src'), { recursive: true });
  writeJson(path.join(packageDirectory, 'package.json'), manifest);
  fs.writeFileSync(path.join(packageDirectory, 'README.md'), '# Fixture package\n');
  fs.writeFileSync(path.join(packageDirectory, 'LICENSE'), 'MIT\n');
  fs.writeFileSync(path.join(packageDirectory, 'NOTICE.md'), 'Fixture notice\n');
  for (const [relative, contents] of Object.entries(files)) {
    const file = path.join(packageDirectory, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents);
  }
}

function packageFiles(directory) {
  const files = [];
  const walk = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) walk(file);
      else files.push(path.relative(directory, file).split(path.sep).join('/'));
    }
  };
  walk(path.join(directory, 'package'));
  return files.sort();
}

function packFixtureArchive(archive, directory) {
  execFileSync('tar', ['-czf', archive, '-C', directory, ...packageFiles(directory)]);
}

function archiveMetadata(archive) {
  const archiveFiles = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split('\n').filter(Boolean).sort();
  const files = archiveFiles.map(file => file.slice('package/'.length));
  const fileSha512 = Object.fromEntries(files.map((file, index) => [
    file,
    sha512(execFileSync('tar', ['-xOzf', archive, archiveFiles[index]], { maxBuffer: 1024 * 1024 })),
  ]));
  const bytes = fs.readFileSync(archive);
  return { files, fileSha512, sha512: sha512(bytes), integrity: integrity(bytes) };
}

const packageNames = [
  '@global-torque/domain-types',
  '@global-torque/invest-core',
  '@global-torque/invest-data',
  '@global-torque/invest-runtime',
  '@global-torque/invest-widgets',
  '@global-torque/invest-features',
  '@global-torque/invest-shell',
];
const publisherPackageDirectories = packageNames.map(name => name.slice('@global-torque/'.length));
const publisherCandidate = '0.4.12';
const publisherNpmStub = [
  '#!/usr/bin/env node',
  "import fs from 'node:fs';",
  "import path from 'node:path';",
  'const command = process.argv[2];',
  'const args = process.argv.slice(3);',
  'const state = process.env.PUBLISH_STUB_STATE;',
  'const mode = process.env.PUBLISH_STUB_MODE;',
  'const candidate = process.env.PUBLISH_STUB_CANDIDATE;',
  "const append = (file, value) => fs.appendFileSync(path.join(state, file), value + '\\n');",
  "const packageFromSpec = spec => spec.slice('@global-torque/'.length).split('@')[0];",
  "if (command === 'view') {",
  "  if (mode === 'existing' || mode === 'tampered') {",
  "    process.stdout.write(JSON.stringify(candidate) + '\\n');",
  '    process.exit(0);',
  '  }',
  "  process.stderr.write('npm error code ' + (mode === 'auth' ? 'E401' : 'E404') + '\\n');",
  '  process.exit(1);',
  '}',
  "if (command === 'publish') {",
  "  append('publish.log', args[0]);",
  '  process.exit(0);',
  '}',
  "if (command === 'pack') {",
  '  const packageName = packageFromSpec(args[0]);',
  "  const filename = 'global-torque-' + packageName + '-' + candidate + '.tgz';",
  "  const countFile = path.join(state, 'pack-' + packageName + '.count');",
  "  const count = (Number(fs.existsSync(countFile) ? fs.readFileSync(countFile, 'utf8') : 0) || 0) + 1;",
  "  fs.writeFileSync(countFile, String(count) + '\\n');",
  '  if (count <= Number(process.env.PUBLISH_STUB_PACK_FAILURES)) {',
  "    process.stderr.write('npm error code ETARGET\\n');",
  '    process.exit(1);',
  '  }',
  "  const registryArchive = path.join(process.cwd(), 'registry', filename);",
  "  fs.copyFileSync(path.join(process.cwd(), 'release', filename), registryArchive);",
  "  if (mode === 'tampered') fs.appendFileSync(registryArchive, 'tampered\\n');",
  "  process.stdout.write(filename + '\\n');",
  '  process.exit(0);',
  '}',
  "process.stderr.write('unexpected npm invocation\\n');",
  'process.exit(64);',
].join('\n') + '\n';
const publisherSleepStub = [
  '#!/usr/bin/env node',
  "import fs from 'node:fs';",
  "import path from 'node:path';",
  "fs.appendFileSync(path.join(process.env.PUBLISH_STUB_STATE, 'sleep.log'), (process.argv[2] ?? '') + '\\n');",
].join('\n') + '\n';

function makePublisherLoopFixture(label, { mode = 'existing', packFailures = 0 } = {}) {
  const directory = path.join(fixtureRoot, 'publisher-loop-' + label);
  const releaseDirectory = path.join(directory, 'release');
  const registryDirectory = path.join(directory, 'registry');
  const stateDirectory = path.join(directory, 'state');
  const binDirectory = path.join(directory, 'bin');
  fs.mkdirSync(releaseDirectory, { recursive: true });
  fs.mkdirSync(registryDirectory, { recursive: true });
  fs.mkdirSync(stateDirectory, { recursive: true });
  fs.mkdirSync(binDirectory, { recursive: true });
  for (const packageDirectory of publisherPackageDirectories) {
    const archiveName = 'global-torque-' + packageDirectory + '-' + publisherCandidate + '.tgz';
    fs.writeFileSync(path.join(releaseDirectory, archiveName), 'archive:' + packageDirectory + '\n');
  }
  writeJson(path.join(releaseDirectory, 'candidate-receipt.json'), {
    candidate: publisherCandidate,
    dependencyOrder: packageNames,
    packages: packageNames.map(name => ({ name })),
  });
  const npmPath = path.join(binDirectory, 'npm');
  const sleepPath = path.join(binDirectory, 'sleep');
  fs.writeFileSync(npmPath, publisherNpmStub);
  fs.writeFileSync(sleepPath, publisherSleepStub);
  fs.chmodSync(npmPath, 0o755);
  fs.chmodSync(sleepPath, 0o755);
  return { directory, stateDirectory, binDirectory, mode, packFailures };
}

function runPublisherLoopFixture(fixture) {
  return execFileSync('bash', ['-euo', 'pipefail', '-c', publisherStep.run], {
    cwd: fixture.directory,
    env: {
      ...process.env,
      PATH: fixture.binDirectory + ':' + process.env.PATH,
      CANDIDATE: publisherCandidate,
      BOOTSTRAP: 'false',
      NODE_AUTH_TOKEN: '',
      RUNNER_TEMP: fixture.directory,
      PUBLISH_STUB_STATE: fixture.stateDirectory,
      PUBLISH_STUB_MODE: fixture.mode,
      PUBLISH_STUB_CANDIDATE: publisherCandidate,
      PUBLISH_STUB_PACK_FAILURES: String(fixture.packFailures),
    },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

const readPublisherLines = file => (
  fs.existsSync(file)
    ? fs.readFileSync(file, 'utf8').split('\n').map(line => line.trim()).filter(Boolean)
    : []
);

function assertPublisherLoopReceipt(fixture) {
  const receipt = JSON.parse(fs.readFileSync(path.join(fixture.directory, 'publication-receipt.json'), 'utf8'));
  assert.deepEqual(receipt.dependencyOrder, packageNames);
  assert.deepEqual(receipt.packages.map(entry => entry.package), packageNames);
  for (const entry of receipt.packages) {
    assert.equal(entry.sha512, entry.registrySha512);
    assert.deepEqual(
      fs.readFileSync(path.resolve(fixture.directory, entry.archive)),
      fs.readFileSync(path.join(fixture.directory, 'registry', entry.registryArchive)),
    );
  }
}

const existingPublisherFixture = makePublisherLoopFixture('existing');
runPublisherLoopFixture(existingPublisherFixture);
assert.deepEqual(readPublisherLines(path.join(existingPublisherFixture.stateDirectory, 'publish.log')), []);
assertPublisherLoopReceipt(existingPublisherFixture);

const tamperedPublisherFixture = makePublisherLoopFixture('tampered', { mode: 'tampered' });
assert.throws(() => runPublisherLoopFixture(tamperedPublisherFixture), undefined, 'Existing registry bytes must be compared');
assert.deepEqual(readPublisherLines(path.join(tamperedPublisherFixture.stateDirectory, 'publish.log')), []);

const propagationPublisherFixture = makePublisherLoopFixture('propagation', { mode: 'absent', packFailures: 2 });
runPublisherLoopFixture(propagationPublisherFixture);
assert.deepEqual(
  readPublisherLines(path.join(propagationPublisherFixture.stateDirectory, 'publish.log')),
  publisherPackageDirectories.map(packageDirectory => './release/global-torque-' + packageDirectory + '-' + publisherCandidate + '.tgz'),
);
for (const packageDirectory of publisherPackageDirectories) {
  assert.equal(
    Number(fs.readFileSync(path.join(propagationPublisherFixture.stateDirectory, 'pack-' + packageDirectory + '.count'), 'utf8')),
    3,
  );
}
assert.deepEqual(
  readPublisherLines(path.join(propagationPublisherFixture.stateDirectory, 'sleep.log')).slice(0, 2),
  ['2', '4'],
);
assertPublisherLoopReceipt(propagationPublisherFixture);

const authPublisherFixture = makePublisherLoopFixture('auth', { mode: 'auth' });
assert.throws(() => runPublisherLoopFixture(authPublisherFixture), undefined, 'Registry auth errors must not be treated as absence');
assert.deepEqual(readPublisherLines(path.join(authPublisherFixture.stateDirectory, 'publish.log')), []);

const exhaustedPublisherFixture = makePublisherLoopFixture('exhausted', { mode: 'absent', packFailures: 8 });
assert.throws(() => runPublisherLoopFixture(exhaustedPublisherFixture), undefined, 'Registry propagation retries must be bounded');
assert.deepEqual(
  readPublisherLines(path.join(exhaustedPublisherFixture.stateDirectory, 'publish.log')),
  ['./release/global-torque-domain-types-0.4.12.tgz'],
);
assert.equal(
  Number(fs.readFileSync(path.join(exhaustedPublisherFixture.stateDirectory, 'pack-domain-types.count'), 'utf8')),
  8,
);
assert.deepEqual(
  readPublisherLines(path.join(exhaustedPublisherFixture.stateDirectory, 'sleep.log')),
  ['2', '4', '8', '16', '32', '64', '128'],
);

const dependencyMap = {
  '@global-torque/domain-types': {},
  '@global-torque/invest-core': { '@global-torque/domain-types': '0.4.12' },
  '@global-torque/invest-data': { '@global-torque/domain-types': '0.4.12', '@global-torque/invest-core': '0.4.12' },
  '@global-torque/invest-runtime': { '@global-torque/domain-types': '0.4.12', '@global-torque/invest-core': '0.4.12', '@global-torque/invest-data': '0.4.12' },
  '@global-torque/invest-widgets': { '@global-torque/domain-types': '0.4.12', '@global-torque/invest-core': '0.4.12' },
  '@global-torque/invest-features': { '@global-torque/domain-types': '0.4.12', '@global-torque/invest-core': '0.4.12', '@global-torque/invest-data': '0.4.12', '@global-torque/invest-runtime': '0.4.12' },
  '@global-torque/invest-shell': { '@global-torque/domain-types': '0.4.12', '@global-torque/invest-core': '0.4.12', '@global-torque/invest-runtime': '0.4.12', '@global-torque/invest-widgets': '0.4.12', '@global-torque/invest-features': '0.4.12' },
};

function makeCandidate(directory) {
  fs.mkdirSync(directory, { recursive: true });
  const sourcePackageRevision = 'a'.repeat(40);
  const packages = [];
  for (const [index, name] of packageNames.entries()) {
    const packageDirectory = path.join(directory, `package-${index}`);
    const archiveName = `${name.slice(1).replace('/', '-')}-0.4.12.tgz`;
    const archive = path.join(directory, archiveName);
    const nodeContract = nodeExportContracts.find(contract => contract.packageName === name);
    const manifest = {
      name,
      version: '0.4.12',
      files: ['src', 'README.md', 'LICENSE', 'NOTICE.md', ...(nodeContract?.entries.map(entry => entry.node.slice(2)) ?? [])],
      exports: { '.': './src/index.ts' },
      dependencies: dependencyMap[name],
    };
    const archiveFiles = { 'src/index.ts': `export const packageName = '${name}';\n` };
    if (nodeContract) {
      manifest.exports = {
        ...manifest.exports,
        ...Object.fromEntries(nodeContract.entries.map(entry => [entry.specifier, {
          types: entry.source,
          node: entry.node,
          default: entry.source,
        }])),
      };
      for (const entry of nodeContract.entries) {
        archiveFiles[entry.source.slice(2)] = `export const packageName = '${name}';\n`;
        archiveFiles[entry.node.slice(2)] = `export const packageName = '${name}';\n`;
      }
    }
    makeArchive(packageDirectory, manifest, archiveFiles);
    packFixtureArchive(archive, packageDirectory);
    const metadata = archiveMetadata(archive);
    const entry = {
    name, version: '0.4.12', directory: `packages/${name.slice('@global-torque/'.length)}`,
      sourceRevision: null, sourceDirty: true, sourcePackageRepository: 'fixture/source', sourcePackageRevision,
      archive: archiveName, ...metadata,
    };
    packages.push(entry);
    writeJson(`${archive}.manifest.json`, {
      schemaVersion: 1, package: name, version: '0.4.12', sourceRepository: 'fixture/torque-packages',
      sourceRevision: null, sourceDirty: true, sourcePackageRepository: 'fixture/source', sourcePackageRevision,
      artifact: archiveName, sha512: metadata.sha512, integrity: metadata.integrity, files: metadata.fileSha512,
    });
    fs.writeFileSync(`${archive}.sha512`, `${metadata.sha512}  ${archiveName}\n`);
  }
  const receipt = {
    schemaVersion: 1, candidate: '0.4.12', sourceRepository: 'fixture/torque-packages', sourceRevision: null,
    sourceDirty: true, sourcePackageRepository: 'fixture/source', sourcePackageRevision,
    generatedAt: '2026-01-01T00:00:00.000Z', lockfileSha256: 'b'.repeat(64),
    uiKit: { mode: 'registry', package: '@global-torque/ui-kit', version: '0.1.4' },
    externalDependencies: reconciliation.externalDependencies,
    compatibilityMatrix: reconciliation.compatibilityMatrix,
    browserContract: {
      schemaVersion: 1, package: '@global-torque/invest-shell', file: 'browser-contract-report.json',
      sha256: sha256(Buffer.from(JSON.stringify({ schemaVersion: 1, package: '@global-torque/invest-shell', playwright: '1.63.0', chromium: 'chromium', result: 'pass', checks: [] }) + '\n')),
      result: 'pass', playwright: '1.63.0', chromium: 'chromium',
    },
    packages,
    dependencyOrder: packageNames, immutable: true, promotable: false,
  };
  writeJson(path.join(directory, 'browser-contract-report.json'), { schemaVersion: 1, package: '@global-torque/invest-shell', playwright: '1.63.0', chromium: 'chromium', result: 'pass', checks: [] });
  receipt.browserContract.sha256 = sha256(fs.readFileSync(path.join(directory, 'browser-contract-report.json')));
  writeJson(path.join(directory, 'candidate-receipt.json'), receipt);
  return receipt;
}

function preserveNodeBuildOutputs(callback) {
  const backupRoot = path.join(fixtureRoot, 'node-build-output-backup');
  const directories = ['packages/invest-core/dist/node', 'packages/invest-runtime/dist/node'];
  fs.rmSync(backupRoot, { recursive: true, force: true });
  const existing = [];
  for (const relative of directories) {
    const source = path.join(root, relative);
    if (!fs.existsSync(source)) continue;
    const backup = path.join(backupRoot, relative);
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    fs.cpSync(source, backup, { recursive: true });
    existing.push([source, backup]);
  }
  try {
    return callback();
  } finally {
    for (const relative of directories) fs.rmSync(path.join(root, relative), { recursive: true, force: true });
    for (const [source, backup] of existing) {
      fs.mkdirSync(path.dirname(source), { recursive: true });
      fs.cpSync(backup, source, { recursive: true });
    }
    fs.rmSync(backupRoot, { recursive: true, force: true });
  }
}

function makePackCandidatePnpmStub(directory, mode, sentinel, called) {
  const binDirectory = path.join(directory, 'bin');
  const pnpm = path.join(binDirectory, 'pnpm');
  fs.mkdirSync(binDirectory, { recursive: true });
  fs.writeFileSync(pnpm, `#!/bin/sh
set -eu
printf 'invoke:%s:%s\\n' "\${1:-}" "\${2:-}" >> "${called}"
if [ "\${1:-}" = run ] && [ "\${2:-}" = build:node ]; then
  mkdir -p \
    packages/invest-core/dist/node/app \
    packages/invest-core/dist/node/markdown \
    packages/invest-core/dist/node/helpers \
    packages/invest-runtime/dist/node/pwa
  : > packages/invest-core/dist/node/app/config.js
  : > packages/invest-core/dist/node/markdown/tableWrap.js
  : > packages/invest-core/dist/node/helpers/text.js
  : > packages/invest-runtime/dist/node/pwa/pwaPolicy.js
  printf 'stage:build:node:success\\n' >> "${called}"
  exit 0
fi
if [ "\${1:-}" = run ] && [ "\${2:-}" = check ]; then
  if [ "${mode}" = check-failure ]; then
    printf 'stage:check:exit:42\\n' >> "${called}"
    exit 42
  fi
  printf 'stage:check:success\\n' >> "${called}"
  if [ "${mode}" = inventory-failure ]; then
    rm packages/invest-runtime/dist/node/pwa/pwaPolicy.js
    : > packages/invest-runtime/dist/node/extra.js
    printf 'stage:check:inventory-missing-pwaPolicy\\n' >> "${called}"
  fi
  exit 0
fi
if [ "\${1:-}" = pack ]; then
  printf 'stage:pack:invoked\\n' >> "${called}"
  : > "${sentinel}"
  exit 0
fi
exit 99
`);
  fs.chmodSync(pnpm, 0o755);
  return binDirectory;
}

function expectPackCandidateFailure(label, { candidate = '0.4.12', mode, existingOutput = false }) {
  const directory = path.join(fixtureRoot, `pack-candidate-${label}`);
  const output = path.join(directory, 'output');
  const packSentinel = path.join(directory, 'pack-called');
  const pnpmSentinel = path.join(directory, 'pnpm-called');
  fs.rmSync(directory, { recursive: true, force: true });
  fs.mkdirSync(directory, { recursive: true });
  if (existingOutput) {
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, 'existing-sentinel'), 'preserve\n');
  }
  const externalReceipt = path.join(directory, 'external-dependencies.json');
  writeJson(externalReceipt, {
    schemaVersion: 1,
    dependencies: reconciliation.externalDependencies,
    verified: {
      '@global-torque/design-tokens': {
        integrity: reconciliation.externalDependencies['@global-torque/design-tokens'].integrity,
      },
    },
  });
  const pnpmPath = makePackCandidatePnpmStub(directory, mode, packSentinel, pnpmSentinel);
  let failure;
  preserveNodeBuildOutputs(() => {
    try {
      execFileSync(process.execPath, [path.join(root, 'scripts/pack-candidate.mjs'), candidate], {
        cwd: root,
        env: {
          ...process.env,
          PATH: `${pnpmPath}:${process.env.PATH}`,
          CANDIDATE_OUTPUT_DIR: output,
          EXTERNAL_DEPENDENCIES_RECEIPT: externalReceipt,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      failure = error;
    }
  });
  assert.ok(failure, `${label} must reject before packing`);
  assert.equal(fs.existsSync(packSentinel), false, `${label} must not invoke pnpm pack`);
  const invocationLog = fs.existsSync(pnpmSentinel)
    ? fs.readFileSync(pnpmSentinel, 'utf8').trim().split('\n').filter(Boolean)
    : [];
  assert.equal(
    invocationLog.length > 0,
    !existingOutput && candidate === '0.4.12',
    `${label} must stop before build when eligibility or output checks fail`,
  );
  if (mode === 'check-failure' && !existingOutput && candidate === '0.4.12') {
    assert.deepEqual(invocationLog, [
      'invoke:run:build:node',
      'stage:build:node:success',
      'invoke:run:check',
      'stage:check:exit:42',
    ], `${label} must record build then the explicit check exit marker`);
  }
  if (mode === 'inventory-failure') {
    assert.deepEqual(invocationLog, [
      'invoke:run:build:node',
      'stage:build:node:success',
      'invoke:run:check',
      'stage:check:success',
      'stage:check:inventory-missing-pwaPolicy',
    ], `${label} must record check success before the missing pwaPolicy diagnostic`);
  }
  assert.equal(invocationLog.includes('stage:pack:invoked'), false, `${label} must not record a pack invocation`);
  if (existingOutput) {
    assert.ok(fs.existsSync(path.join(output, 'existing-sentinel')), `${label} must preserve an existing output directory`);
    assert.equal(fs.readFileSync(path.join(output, 'existing-sentinel'), 'utf8'), 'preserve\n', `${label} must preserve existing output bytes`);
  } else {
    assert.equal(fs.existsSync(output), false, `${label} must not create an output directory`);
  }
  fs.rmSync(directory, { recursive: true, force: true });
}

expectPackCandidateFailure('existing-output', { mode: 'check-failure', existingOutput: true });
expectPackCandidateFailure('invalid-eligibility', { candidate: '99.0.0', mode: 'check-failure' });
expectPackCandidateFailure('full-check-failure', { mode: 'check-failure' });
expectPackCandidateFailure('post-check-inventory-failure', { mode: 'inventory-failure' });

const candidateDirectory = path.join(fixtureRoot, 'candidate');
const candidateReceipt = makeCandidate(candidateDirectory);
execFileSync('jq', ['-e', '.packages | length == 7', path.join(candidateDirectory, 'candidate-receipt.json')], { stdio: 'ignore' });
const candidateCore = candidateReceipt.packages.find(entry => entry.name === '@global-torque/invest-core');
const candidateCoreManifest = JSON.parse(execFileSync('tar', ['-xOzf', path.join(candidateDirectory, candidateCore.archive), 'package/package.json'], { encoding: 'utf8' }));
assert.doesNotThrow(() => assertNodeExportContracts(candidateCoreManifest, '@global-torque/invest-core'));
runScript('verify-release-bundle.mjs', [path.join(candidateDirectory, 'candidate-receipt.json')]);

function refreshPackageMetadata(directory, packageName) {
  const receiptPath = path.join(directory, 'candidate-receipt.json');
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  const entry = receipt.packages.find(item => item.name === packageName);
  const archive = path.join(directory, entry.archive);
  const metadata = archiveMetadata(archive);
  Object.assign(entry, metadata);
  const sidecarPath = `${archive}.manifest.json`;
  const sidecar = JSON.parse(fs.readFileSync(sidecarPath, 'utf8'));
  Object.assign(sidecar, { sha512: metadata.sha512, integrity: metadata.integrity, files: metadata.fileSha512 });
  writeJson(sidecarPath, sidecar);
  fs.writeFileSync(`${archive}.sha512`, `${metadata.sha512}  ${path.basename(archive)}\n`);
  writeJson(receiptPath, receipt);
}

function mutateArchive(label, packageName, mutate) {
  const directory = path.join(fixtureRoot, label);
  fs.cpSync(candidateDirectory, directory, { recursive: true });
  const receipt = JSON.parse(fs.readFileSync(path.join(directory, 'candidate-receipt.json'), 'utf8'));
  const entry = receipt.packages.find(item => item.name === packageName);
  const archive = path.join(directory, entry.archive);
  const unpack = path.join(directory, 'unpack');
  fs.mkdirSync(unpack, { recursive: true });
  execFileSync('tar', ['-xzf', archive, '-C', unpack]);
  const manifestPath = path.join(unpack, 'package', 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  mutate({ manifest, manifestPath, packageDirectory: path.join(unpack, 'package') });
  writeJson(manifestPath, manifest);
  packFixtureArchive(archive, unpack);
  refreshPackageMetadata(directory, packageName);
  return directory;
}

for (const [label, packageName, mutate] of [
  ['wrong-package-version', '@global-torque/domain-types', ({ manifest }) => { manifest.version = '99.0.0'; }],
  ['broken-export', '@global-torque/domain-types', ({ manifest }) => { manifest.exports['.'] = './src/missing.ts'; }],
  ['node-leaf-root', '@global-torque/invest-core', ({ manifest }) => { manifest.exports['.'] = './dist/node/app/config.js'; }],
  ['node-leaf-alias', '@global-torque/invest-core', ({ manifest }) => { manifest.exports['./config-alias'] = './dist/node/app/config.js'; }],
  ['node-leaf-nested-condition', '@global-torque/invest-core', ({ manifest }) => {
    manifest.exports['./config-nested'] = {
      browser: './src/app/config.ts',
      node: { default: './dist/node/app/config.js' },
      default: './src/app/config.ts',
    };
  }],
  ['missing-file', '@global-torque/domain-types', ({ packageDirectory }) => { fs.rmSync(path.join(packageDirectory, 'src', 'index.ts')); }],
  ['unexpected-file', '@global-torque/domain-types', ({ packageDirectory }) => { fs.writeFileSync(path.join(packageDirectory, 'unexpected.txt'), 'unexpected\n'); }],
  ['protocol', '@global-torque/invest-core', ({ manifest }) => { manifest.dependencies['@global-torque/domain-types'] = 'workspace:*'; }],
  ['old-scope', '@global-torque/invest-core', ({ manifest }) => { manifest.dependencies['@webdevelop-pro/domain-types'] = '0.3.0'; }],
]) {
  const directory = mutateArchive(label, packageName, mutate);
  expectFailure(label, () => runScript('verify-release-bundle.mjs', [path.join(directory, 'candidate-receipt.json')]));
}

function makeUiTransport(directory) {
  fs.mkdirSync(directory, { recursive: true });
  const packageDirectory = path.join(directory, 'ui-package');
  const archiveName = 'global-torque-ui-kit-0.1.4.tgz';
  makeArchive(packageDirectory, {
    name: '@global-torque/ui-kit', version: '0.1.4', files: ['src', 'README.md', 'LICENSE'], exports: { '.': './src/index.ts' },
  }, { 'src/index.ts': 'export const uiKit = true;\n' });
  const archive = path.join(directory, archiveName);
  packFixtureArchive(archive, packageDirectory);
  const metadata = archiveMetadata(archive);
  writeJson(`${archive}.manifest.json`, {
    schemaVersion: 1, package: '@global-torque/ui-kit', version: '0.1.4', sourceCommit: 'c'.repeat(40), sourceDirty: false,
    artifact: archiveName, sha512: metadata.sha512, integrity: metadata.integrity, files: metadata.fileSha512,
  });
  fs.writeFileSync(`${archive}.sha512`, `${metadata.sha512}  ${archiveName}\n`);
  writeJson(path.join(directory, 'selected-release.json'), {
    schemaVersion: 1, selection: 'single-package', package: '@global-torque/ui-kit', version: '0.1.4', sourceCommit: 'c'.repeat(40),
    sourceDirty: false, artifact: archiveName, sha512: metadata.sha512, integrity: metadata.integrity,
  });
  const statement = {
    _type: 'https://in-toto.io/Statement/v1',
    subject: [{ name: archiveName, digest: { sha256: sha256(fs.readFileSync(archive)) } }],
    predicateType: 'https://slsa.dev/provenance/v1',
    predicate: {
      buildDefinition: {
        externalParameters: { workflow: { repository: 'https://github.com/global-torque/vue-ui', ref: 'refs/tags/ui-kit-v0.1.4', path: '.github/workflows/release.yml' } },
        resolvedDependencies: [{ uri: 'git+https://github.com/global-torque/vue-ui@refs/tags/ui-kit-v0.1.4', digest: { gitCommit: 'c'.repeat(40) } }],
      },
      runDetails: { metadata: { invocationId: 'https://github.com/global-torque/vue-ui/actions/runs/12345/attempts/1' } },
    },
  };
  writeJson(path.join(directory, 'original-provenance.json'), {
    mediaType: 'application/vnd.dev.sigstore.bundle.v0.3+json',
    verificationMaterial: { certificate: { rawBytes: 'fixture' } },
    dsseEnvelope: { payloadType: 'application/vnd.in-toto+json', payload: Buffer.from(JSON.stringify(statement)).toString('base64'), signatures: [{ sig: 'fixture' }] },
  });
  runScript('verify-ui-kit-transport.mjs', [directory, '12345', 'ui-kit-v0.1.4', path.join(directory, 'original-provenance.json'), path.join(directory, 'transport-receipt.json')]);
  return directory;
}

const uiDirectory = makeUiTransport(path.join(fixtureRoot, 'ui-transport'));

function makeUiLockOverlay(directory, transportDirectory, tarballVersion) {
  const transport = JSON.parse(fs.readFileSync(path.join(transportDirectory, 'transport-receipt.json'), 'utf8'));
  const canonicalLockTemplate = fs.readFileSync(path.join(root, 'pnpm-lock.yaml'), 'utf8');
  const canonicalLock = canonicalLockTemplate.replace(
    /(('@global-torque\/ui-kit@0\.1\.4':\n\s+resolution: \{integrity: ))[^,}]+/u,
    `$1${transport.integrity}`,
  );
  const canonicalWorkspace = fs.readFileSync(path.join(root, 'pnpm-workspace.yaml'), 'utf8');
  const archive = path.join(transportDirectory, 'global-torque-ui-kit-0.1.4.tgz').replaceAll('\\', '/');
  const locator = `file:${archive}`;
  let derivedLock = canonicalLock.replace('overrides:\n', `overrides:\n  '@global-torque/ui-kit': ${locator}\n`);
  for (const importer of expectedOverlayImporters) {
    const header = `  ${importer}:\n`;
    const start = derivedLock.indexOf(header);
    assert.notEqual(start, -1, `Fixture lockfile is missing ${importer}`);
    const rest = derivedLock.slice(start + header.length);
    const next = rest.search(/\n  [^\s]/u);
    const blockEnd = next === -1 ? derivedLock.length : start + header.length + next;
    const block = derivedLock.slice(start, blockEnd);
    const updated = block.replace(/('@global-torque\/ui-kit':\n\s+specifier:) 0\.1\.4/u, `$1 ${locator}`);
    assert.notEqual(updated, block, `Fixture lockfile is missing the UI Kit specifier for ${importer}`);
    derivedLock = `${derivedLock.slice(0, start)}${updated}${derivedLock.slice(blockEnd)}`;
  }
  derivedLock = derivedLock.replaceAll('@global-torque/ui-kit@0.1.4', `@global-torque/ui-kit@${locator}`);
  if (tarballVersion !== undefined) {
    const header = `  '@global-torque/ui-kit@${locator}':\n`;
    const start = derivedLock.indexOf(header);
    assert.notEqual(start, -1);
    const resolutionEnd = derivedLock.indexOf('\n', start + header.length);
    derivedLock = `${derivedLock.slice(0, resolutionEnd)}\n    version: ${tarballVersion}${derivedLock.slice(resolutionEnd)}`;
  }
  const derivedWorkspace = canonicalWorkspace.replace('overrides:\n', `overrides:\n  '@global-torque/ui-kit': '${locator}'\n`);
  const canonicalLockPath = path.join(directory, 'pnpm-lock.canonical.yaml');
  const derivedLockPath = path.join(directory, 'pnpm-lock.derived.yaml');
  const canonicalWorkspacePath = path.join(directory, 'pnpm-workspace.canonical.yaml');
  const derivedWorkspacePath = path.join(directory, 'pnpm-workspace.derived.yaml');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(canonicalLockPath, canonicalLock);
  fs.writeFileSync(derivedLockPath, derivedLock);
  fs.writeFileSync(canonicalWorkspacePath, canonicalWorkspace);
  fs.writeFileSync(derivedWorkspacePath, derivedWorkspace);
  const overlayReceiptPath = path.join(directory, 'ui-kit-lock-overlay.json');
  runScript('verify-ui-kit-lock-overlay.mjs', [
    canonicalLockPath,
    derivedLockPath,
    path.join(transportDirectory, 'transport-receipt.json'),
    overlayReceiptPath,
    canonicalWorkspacePath,
    derivedWorkspacePath,
  ]);
  return JSON.parse(fs.readFileSync(overlayReceiptPath, 'utf8'));
}

makeUiLockOverlay(path.join(fixtureRoot, 'pnpm12-ui-overlay'), uiDirectory, '0.1.4');
expectFailure('pnpm12-ui-overlay-wrong-version', () =>
  makeUiLockOverlay(path.join(fixtureRoot, 'pnpm12-ui-overlay-wrong-version'), uiDirectory, '0.1.5'));
expectFailure('pnpm12-ui-overlay-extra-field', () =>
  makeUiLockOverlay(path.join(fixtureRoot, 'pnpm12-ui-overlay-extra-field'), uiDirectory, '0.1.4\n    unexpected: true'));

const canonicalCandidateDirectory = path.join(fixtureRoot, 'canonical-candidate');
fs.cpSync(candidateDirectory, canonicalCandidateDirectory, { recursive: true });
const canonicalCandidateReceipt = JSON.parse(fs.readFileSync(path.join(canonicalCandidateDirectory, 'candidate-receipt.json'), 'utf8'));
const uiTransportReceipt = JSON.parse(fs.readFileSync(path.join(uiDirectory, 'transport-receipt.json'), 'utf8'));
for (const file of [
  uiTransportReceipt.artifact,
  uiTransportReceipt.sidecar,
  uiTransportReceipt.sha512Sidecar,
  uiTransportReceipt.selectedRelease,
  uiTransportReceipt.originalAttestation.file,
  'transport-receipt.json',
]) fs.copyFileSync(path.join(uiDirectory, file), path.join(canonicalCandidateDirectory, file));
const overlayReceipt = makeUiLockOverlay(canonicalCandidateDirectory, uiDirectory);
const cleanRevision = 'd'.repeat(40);
canonicalCandidateReceipt.sourceRevision = cleanRevision;
canonicalCandidateReceipt.sourceDirty = false;
for (const entry of canonicalCandidateReceipt.packages) {
  entry.sourceRevision = cleanRevision;
  entry.sourceDirty = false;
  const sidecarPath = path.join(canonicalCandidateDirectory, `${entry.archive}.manifest.json`);
  const sidecar = JSON.parse(fs.readFileSync(sidecarPath, 'utf8'));
  sidecar.sourceRevision = cleanRevision;
  sidecar.sourceDirty = false;
  writeJson(sidecarPath, sidecar);
}
for (const file of overlayReceipt.retainedFiles) {
  const source = path.join(canonicalCandidateDirectory, file.name);
  assert.ok(fs.existsSync(source), `Fixture retained overlay file is missing ${file.name}`);
}
canonicalCandidateReceipt.uiKit = {
  ...uiTransportReceipt,
  lockOverlay: {
    canonicalLockSha256: overlayReceipt.canonicalLockSha256,
    derivedLockSha256: overlayReceipt.derivedLockSha256,
    locatorMapping: overlayReceipt.locatorMapping,
    retainedFiles: overlayReceipt.retainedFiles,
  },
};
canonicalCandidateReceipt.lockfileSha256 = overlayReceipt.canonicalLockSha256;
writeJson(path.join(canonicalCandidateDirectory, 'candidate-receipt.json'), canonicalCandidateReceipt);
runScript('verify-release-bundle.mjs', [path.join(canonicalCandidateDirectory, 'candidate-receipt.json')]);

// Exercise the publisher's exact retained-asset input with a canonical UI Kit
// candidate. This catches a workflow that verifies only package tarballs while
// silently omitting the JSON transport and attestation files required by the
// combined receipt verifier.
const publisherBundleDirectory = path.join(fixtureRoot, 'publisher-canonical-bundle');
const publisherReleaseDirectory = path.join(publisherBundleDirectory, 'release');
fs.mkdirSync(publisherReleaseDirectory, { recursive: true });
const publisherAssetNames = expectedAssetsForReceipt(canonicalCandidateReceipt);
for (const assetName of publisherAssetNames) {
  fs.copyFileSync(
    path.join(canonicalCandidateDirectory, assetName),
    path.join(publisherReleaseDirectory, assetName),
  );
}
runScript('verify-release-bundle.mjs', [path.join(publisherReleaseDirectory, 'candidate-receipt.json')]);
assert.deepEqual(
  publisherAssetNames.filter(name => new Set([
    'candidate-receipt.json',
    'original-provenance.json',
    'selected-release.json',
    'transport-receipt.json',
  ]).has(name)),
  [
    'candidate-receipt.json',
    'original-provenance.json',
    'selected-release.json',
    'transport-receipt.json',
  ],
  'Publisher fixture must retain all canonical UI Kit JSON assets',
);
const missingOverlayDirectory = path.join(fixtureRoot, 'canonical-candidate-missing-overlay');
fs.cpSync(canonicalCandidateDirectory, missingOverlayDirectory, { recursive: true });
const missingOverlayReceiptPath = path.join(missingOverlayDirectory, 'candidate-receipt.json');
const missingOverlayReceipt = JSON.parse(fs.readFileSync(missingOverlayReceiptPath, 'utf8'));
delete missingOverlayReceipt.uiKit.lockOverlay;
writeJson(missingOverlayReceiptPath, missingOverlayReceipt);
expectFailure('missing-ui-lock-overlay', () => runScript('verify-release-bundle.mjs', [missingOverlayReceiptPath]));
const missingRetainedOverlayDirectory = path.join(fixtureRoot, 'canonical-candidate-missing-retained-yaml');
fs.cpSync(canonicalCandidateDirectory, missingRetainedOverlayDirectory, { recursive: true });
fs.rmSync(path.join(missingRetainedOverlayDirectory, 'pnpm-workspace.derived.yaml'));
expectFailure('missing-retained-ui-workspace', () => runScript('verify-release-bundle.mjs', [path.join(missingRetainedOverlayDirectory, 'candidate-receipt.json')]));
const tamperedRetainedOverlayDirectory = path.join(fixtureRoot, 'canonical-candidate-tampered-retained-yaml');
fs.cpSync(canonicalCandidateDirectory, tamperedRetainedOverlayDirectory, { recursive: true });
fs.appendFileSync(path.join(tamperedRetainedOverlayDirectory, 'pnpm-lock.derived.yaml'), '# tamper\n');
expectFailure('tampered-retained-ui-lock', () => runScript('verify-release-bundle.mjs', [path.join(tamperedRetainedOverlayDirectory, 'candidate-receipt.json')]));
const forgedOverlayDirectory = path.join(fixtureRoot, 'canonical-candidate-forged-mapping');
fs.cpSync(canonicalCandidateDirectory, forgedOverlayDirectory, { recursive: true });
const forgedReceiptPath = path.join(forgedOverlayDirectory, 'candidate-receipt.json');
const forgedReceipt = JSON.parse(fs.readFileSync(forgedReceiptPath, 'utf8'));
forgedReceipt.uiKit.lockOverlay.locatorMapping[0].derived = 'file:unrelated.tgz';
writeJson(forgedReceiptPath, forgedReceipt);
expectFailure('forged-retained-ui-mapping', () => runScript('verify-release-bundle.mjs', [forgedReceiptPath]));
const emptyAttestation = path.join(fixtureRoot, 'ui-empty-attestation');
fs.cpSync(uiDirectory, emptyAttestation, { recursive: true });
fs.writeFileSync(path.join(emptyAttestation, 'original-provenance.json'), '');
expectFailure('empty-attestation', () => runScript('verify-ui-kit-transport.mjs', [emptyAttestation, '12345', 'ui-kit-v0.1.4']));
const emptyRawBundle = path.join(fixtureRoot, 'ui-empty-raw-bundle');
fs.cpSync(uiDirectory, emptyRawBundle, { recursive: true });
fs.writeFileSync(path.join(emptyRawBundle, 'original-provenance.json'), '{}\n');
expectFailure('empty-raw-sigstore-bundle', () => runScript('verify-ui-kit-transport.mjs', [emptyRawBundle, '12345', 'ui-kit-v0.1.4']));
const tamperedUi = path.join(fixtureRoot, 'ui-tampered');
fs.cpSync(uiDirectory, tamperedUi, { recursive: true });
fs.appendFileSync(path.join(tamperedUi, 'global-torque-ui-kit-0.1.4.tgz'), 'tamper');
expectFailure('tampered-ui-archive', () => runScript('verify-ui-kit-transport.mjs', [tamperedUi, '12345', 'ui-kit-v0.1.4']));

function expectedAssetsForReceipt(receipt) {
  const assets = new Set([
    ...receipt.packages.flatMap(entry => [entry.archive, `${entry.archive}.manifest.json`, `${entry.archive}.sha512`]),
    'candidate-receipt.json',
    receipt.browserContract.file,
  ]);
  if (receipt.uiKit?.canonical === true) {
    for (const name of [receipt.uiKit.artifact, receipt.uiKit.sidecar, receipt.uiKit.sha512Sidecar, receipt.uiKit.selectedRelease, receipt.uiKit.originalAttestation?.file, 'transport-receipt.json']) assets.add(name);
    for (const file of receipt.uiKit.lockOverlay.retainedFiles) assets.add(file.name);
  }
  return [...assets].sort();
}

function makeWorkflowFixture(label) {
  const directory = path.join(fixtureRoot, `workflow-${label}`);
  const artifacts = path.join(directory, 'artifacts');
  const releaseAssets = path.join(directory, 'release-assets');
  fs.mkdirSync(directory, { recursive: true });
  fs.symlinkSync(path.join(root, 'scripts'), path.join(directory, 'scripts'), 'dir');
  fs.cpSync(canonicalCandidateDirectory, artifacts, { recursive: true });
  fs.mkdirSync(releaseAssets, { recursive: true });
  const receipt = JSON.parse(fs.readFileSync(path.join(artifacts, 'candidate-receipt.json'), 'utf8'));
  const assetNames = expectedAssetsForReceipt(receipt);
  for (const name of assetNames) fs.copyFileSync(path.join(artifacts, name), path.join(releaseAssets, name));
  const sourceRevision = receipt.sourceRevision;
  writeJson(path.join(directory, 'run.json'), {
    status: 'completed',
    conclusion: 'success',
    event: 'workflow_dispatch',
    headBranch: 'framework-v0.4.12',
    headSha: sourceRevision,
    workflowName: 'Framework package candidate',
  });
  writeJson(path.join(directory, 'release.json'), {
    id: 99,
    tag_name: 'framework-v0.4.12',
    draft: false,
    prerelease: false,
    immutable: true,
    assets: assetNames.map((name, index) => ({ id: index + 1, name })),
  });
  writeJson(path.join(directory, 'tag-ref.json'), {
    ref: 'refs/tags/framework-v0.4.12',
    object: { type: 'commit', sha: sourceRevision },
  });
  writeJson(path.join(directory, 'annotated-tag.json'), {});
  fs.writeFileSync(path.join(directory, 'gh-calls.log'), '');
  return { directory, artifacts, releaseAssets, assetNames };
}

const workflowGhStub = path.join(fixtureRoot, 'workflow-gh');
fs.mkdirSync(workflowGhStub, { recursive: true });
const workflowGh = path.join(workflowGhStub, 'gh');
const workflowGhSource = [
  '#!/usr/bin/env node',
  "import fs from 'node:fs';",
  "import path from 'node:path';",
  'const args = process.argv.slice(2);',
  'const directory = process.env.GH_FIXTURE_DIR;',
  "const readJson = name => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));",
  "const log = line => fs.appendFileSync(path.join(directory, 'gh-calls.log'), line + '\\n');",
  "if (args[0] === 'run' && args[1] === 'view') {",
  "  log('run ' + (process.env.PACKAGE ?? ''));",
  "  process.stdout.write(JSON.stringify(readJson('run.json')) + '\\n');",
  "} else if (args[0] === 'api' && args.some(argument => argument.includes('/releases/tags/'))) {",
  "  log('release ' + (process.env.PACKAGE ?? ''));",
  "  process.stdout.write(JSON.stringify(readJson('release.json')) + '\\n');",
  "} else if (args[0] === 'api' && args.some(argument => argument.includes('/git/ref/tags/'))) {",
  "  log('ref ' + (process.env.PACKAGE ?? ''));",
  "  process.stdout.write(JSON.stringify(readJson('tag-ref.json')) + '\\n');",
  "} else if (args[0] === 'api' && args.some(argument => argument.includes('/git/tags/'))) {",
  "  log('annotated ' + (process.env.PACKAGE ?? ''));",
  "  process.stdout.write(JSON.stringify(readJson('annotated-tag.json')) + '\\n');",
  "} else if (args[0] === 'api' && args.some(argument => argument.includes('/releases/assets/'))) {",
  "  const endpointIndex = args.findIndex(argument => argument.includes('/releases/assets/'));",
  "  const endpoint = args[endpointIndex];",
  "  const optionArgs = args.slice(1, endpointIndex);",
  "  if (endpointIndex !== args.length - 1 || optionArgs.length !== 2 || optionArgs[0] !== '--header' || optionArgs[1] !== 'Accept: application/octet-stream' || args.includes('--output')) process.exit(2);",
  "  const assetId = endpoint?.split('/').at(-1);",
  "  const release = readJson('release.json');",
  "  const asset = release.assets.find(candidate => String(candidate.id) === assetId);",
  "  if (!asset) process.exit(3);",
  "  process.stdout.write(fs.readFileSync(path.join(directory, 'release-assets', asset.name)));",
  "  log('asset ' + (process.env.PACKAGE ?? '') + ' ' + asset.name);",
  "} else if (args[0] === 'api' && args.some(argument => argument.includes('/releases/'))) {",
  "  log('release ' + (process.env.PACKAGE ?? ''));",
  "  process.stdout.write(JSON.stringify(readJson('release.json')) + '\\n');",
  "} else if (args[0] === 'attestation' && args[1] === 'verify') {",
  "  log('attestation ' + (process.env.PACKAGE ?? ''));",
  "  if (process.env.GH_ATTESTATION_MODE === 'failed') process.exit(4);",
  "  process.stdout.write(process.env.GH_ATTESTATION_MODE === 'empty-array' ? '[]\\n' : '[{\"attestation\":{\"bundle\":{}},\"verificationResult\":{}}]\\n');",
  '} else {',
  '  process.exit(2);',
  '}',
].join('\n') + '\n';
fs.writeFileSync(workflowGh, workflowGhSource);
fs.chmodSync(workflowGh, 0o755);

function makeReleaseWorkflowFixture(label) {
  const directory = path.join(fixtureRoot, `release-workflow-${label}`);
  const releaseAssets = path.join(directory, 'release-assets');
  fs.mkdirSync(releaseAssets, { recursive: true });
  fs.symlinkSync(path.join(root, 'scripts'), path.join(directory, 'scripts'), 'dir');
  const assetNames = [
    uiTransportReceipt.artifact,
    uiTransportReceipt.sidecar,
    uiTransportReceipt.sha512Sidecar,
    uiTransportReceipt.selectedRelease,
    uiTransportReceipt.originalAttestation.file,
    'transport-receipt.json',
  ];
  for (const name of assetNames) fs.copyFileSync(path.join(uiDirectory, name), path.join(releaseAssets, name));
  writeJson(path.join(directory, 'release.json'), {
    id: 99,
    tag_name: 'ui-kit-transport-v0.1.4',
    draft: true,
    prerelease: false,
    assets: assetNames.map((name, index) => ({ id: index + 1, name })),
  });
  writeJson(path.join(directory, 'run.json'), {
    status: 'completed',
    conclusion: 'success',
    event: 'push',
    headBranch: 'ui-kit-v0.1.4',
    headSha: 'c'.repeat(40),
    workflowName: 'Verified public UI artifacts',
  });
  fs.writeFileSync(path.join(directory, 'gh-calls.log'), '');
  return { directory, releaseAssets, assetNames };
}

function evaluateWorkflowCondition(condition, matrixPackage) {
  if (!condition) return true;
  const expression = condition.replace(/^\$\{\{\s*/u, '').replace(/\s*\}\}$/u, '').trim();
  if (expression === 'always()') return true;
  const equality = expression.match(/^matrix\.package\s*([!=]=)\s*['"]([^'"]+)['"]$/u);
  if (equality) return equality[1] === '==' ? matrixPackage === equality[2] : matrixPackage !== equality[2];
  throw new Error(`Unsupported workflow condition in contract test: ${condition}`);
}

function runActualProvenanceWorkflow(fixture, matrixPackage, options = {}) {
  const runnerTemp = path.join(fixture.directory, options.runnerTempName ?? `runner-${matrixPackage}`);
  fs.mkdirSync(runnerTemp, { recursive: true });
  const sentinel = path.join(runnerTemp, 'signing-sentinel');
  const outputPath = path.join(runnerTemp, 'github-output');
  const env = {
    ...process.env,
    PATH: `${workflowGhStub}:${process.env.PATH}`,
    GH_FIXTURE_DIR: fixture.directory,
    GH_ATTESTATION_MODE: options.attestationMode ?? 'valid',
    GITHUB_REPOSITORY: 'fixture/torque-packages',
    GITHUB_WORKSPACE: fixture.directory,
    RUNNER_TEMP: runnerTemp,
    GITHUB_OUTPUT: outputPath,
    GITHUB_ENV: path.join(runnerTemp, 'github-env'),
    CANDIDATE_RUN_ID: '67890',
    CANDIDATE: '0.4.12',
    RELEASE_TAG: 'framework-v0.4.12',
    PACKAGE: matrixPackage,
  };
  fs.writeFileSync(outputPath, '');
  fs.writeFileSync(env.GITHUB_ENV, '');
  const context = { cwd: fixture.directory, env, package: matrixPackage, executed: [] };
  for (const step of provenanceSteps) {
    if (!evaluateWorkflowCondition(step.if, matrixPackage)) continue;
    context.executed.push(step.name ?? step.uses);
    try {
      if (step.run) {
        execFileSync('bash', ['-euo', 'pipefail', '-c', step.run], {
          cwd: fixture.directory,
          env,
          stdio: ['ignore', 'pipe', 'pipe'],
          encoding: 'utf8',
        });
      } else if (step.uses?.startsWith('actions/attest@')) {
        fs.writeFileSync(sentinel, 'signed\n');
      } else if (
        step.uses?.startsWith('actions/checkout@')
        || step.uses?.startsWith('actions/setup-node@')
        || step.uses?.startsWith('actions/download-artifact@')
        || step.uses?.startsWith('actions/upload-artifact@')
      ) {
        // GitHub action network and metadata operations are represented by local fixtures.
      } else {
        throw new Error(`Unexpected action in bounded workflow test: ${step.uses}`);
      }
    } catch (error) {
      error.workflowStep = step.name ?? step.uses;
      error.workflowContext = context;
      throw error;
    }
  }
  return { sentinel, context, runnerTemp };
}

const releaseWorkflowFixture = makeReleaseWorkflowFixture('valid');
const releaseRunnerTemp = path.join(releaseWorkflowFixture.directory, 'runner with spaces');
fs.mkdirSync(releaseRunnerTemp, { recursive: true });
const releaseWorkflowEnv = {
  ...process.env,
  PATH: `${workflowGhStub}:${process.env.PATH}`,
  GH_FIXTURE_DIR: releaseWorkflowFixture.directory,
  GITHUB_REPOSITORY: 'fixture/torque-packages',
  RUNNER_TEMP: releaseRunnerTemp,
  GITHUB_ENV: path.join(releaseRunnerTemp, 'github-env'),
  GH_TOKEN: 'fixture-token',
  UI_KIT_TRANSPORT_RELEASE_ID: '99',
  UI_KIT_TRANSPORT_TAG: 'ui-kit-transport-v0.1.4',
  UI_KIT_SOURCE_RUN_ID: '12345',
  UI_KIT_SOURCE_TAG: 'ui-kit-v0.1.4',
};
fs.writeFileSync(releaseWorkflowEnv.GITHUB_ENV, '');
execFileSync('bash', ['-euo', 'pipefail', '-c', releaseDownloadStep.run], {
  cwd: releaseWorkflowFixture.directory,
  env: releaseWorkflowEnv,
  stdio: ['ignore', 'pipe', 'pipe'],
  encoding: 'utf8',
});
const downloadedTransport = path.join(releaseRunnerTemp, 'torque-ui-kit-transport');
for (const assetName of releaseWorkflowFixture.assetNames) {
  assert.equal(
    Buffer.compare(
      fs.readFileSync(path.join(downloadedTransport, assetName)),
      fs.readFileSync(path.join(releaseWorkflowFixture.releaseAssets, assetName)),
    ),
    0,
    `Release workflow must preserve ${assetName} bytes`,
  );
}

const validWorkflowFixture = makeWorkflowFixture('valid');
for (const matrixPackage of provenanceMatrix) {
  const result = runActualProvenanceWorkflow(validWorkflowFixture, matrixPackage);
  assert.ok(fs.existsSync(result.sentinel), `Signing sentinel is missing for ${matrixPackage}`);
  assert.ok(result.context.executed.includes(assetVerificationStep.name), `Asset verification did not run for ${matrixPackage}`);
  assert.ok(result.context.executed.includes(archiveVerificationStep.name), `Archive verification did not run for ${matrixPackage}`);
}
const workflowAssetCalls = fs.readFileSync(path.join(validWorkflowFixture.directory, 'gh-calls.log'), 'utf8')
  .split('\n').filter(line => line.startsWith('asset '));
assert.equal(workflowAssetCalls.length, validWorkflowFixture.assetNames.length * provenanceMatrix.length, 'Every matrix path must compare every release asset');
assert.equal(new Set(workflowAssetCalls.map(line => line.replace(/^asset [^ ]+ /u, ''))).size, validWorkflowFixture.assetNames.length, 'Matrix asset verification must include UI and retained overlay files');

const provenanceDownloadResult = runActualProvenanceWorkflow(validWorkflowFixture, 'invest-shell', { runnerTempName: 'runner with spaces' });
const downloadedReleaseAssets = path.join(provenanceDownloadResult.runnerTemp, 'framework-release-assets');
for (const assetName of validWorkflowFixture.assetNames) {
  assert.equal(
    Buffer.compare(
      fs.readFileSync(path.join(downloadedReleaseAssets, assetName)),
      fs.readFileSync(path.join(validWorkflowFixture.releaseAssets, assetName)),
    ),
    0,
    `Provenance workflow must preserve ${assetName} bytes`,
  );
}

const workflowGhEnv = { ...process.env, GH_FIXTURE_DIR: validWorkflowFixture.directory };
const binaryAssetName = validWorkflowFixture.assetNames.find(name => name.endsWith('.tgz'));
assert.ok(binaryAssetName, 'Workflow fixture must include a binary archive asset');
const binaryAssetId = validWorkflowFixture.assetNames.indexOf(binaryAssetName) + 1;
const assetEndpoint = `/repos/fixture/torque-packages/releases/assets/${binaryAssetId}`;
const directAssetBytes = execFileSync(workflowGh, [
  'api', '--header', 'Accept: application/octet-stream', assetEndpoint,
], { env: workflowGhEnv, encoding: 'buffer', stdio: ['ignore', 'pipe', 'pipe'] });
assert.deepEqual(directAssetBytes, fs.readFileSync(path.join(validWorkflowFixture.releaseAssets, binaryAssetName)), 'Asset endpoint must emit exact binary stdout bytes');
assert.notEqual(directAssetBytes.at(-1), 0x0a, 'Asset endpoint must not append a newline to binary stdout');
expectFailure('gh-api-output-flag', () => execFileSync(workflowGh, [
  'api', '--header', 'Accept: application/octet-stream', '--output', path.join(fixtureRoot, 'bad output'), assetEndpoint,
], { env: workflowGhEnv, stdio: ['ignore', 'pipe', 'pipe'] }));
expectFailure('gh-api-unknown-flag', () => execFileSync(workflowGh, [
  'api', '--unknown', 'value', assetEndpoint,
], { env: workflowGhEnv, stdio: ['ignore', 'pipe', 'pipe'] }));

const releaseGuardBin = path.join(fixtureRoot, 'release-guard-bin');
fs.mkdirSync(releaseGuardBin, { recursive: true });
const releaseGuardGit = path.join(releaseGuardBin, 'git');
const releaseGuardPnpm = path.join(releaseGuardBin, 'pnpm');
fs.writeFileSync(releaseGuardGit, "#!/bin/sh\nif [ \"$1\" = status ]; then printf '%s\\n' \"${GIT_STATUS:-}\"; else exit 1; fi\n");
fs.writeFileSync(releaseGuardPnpm, "#!/bin/sh\nprintf '%s\\n' called > \"$PNPM_SENTINEL\"\n");
fs.chmodSync(releaseGuardGit, 0o755);
fs.chmodSync(releaseGuardPnpm, 0o755);
const guardSentinel = path.join(fixtureRoot, 'release-install-sentinel');
let guardFailure;
try {
  execFileSync('bash', ['-euo', 'pipefail', '-c', installDependencyStep.run], {
    cwd: root,
    env: {
      ...process.env,
      PATH: `${releaseGuardBin}:${process.env.PATH}`,
      GIT_STATUS: ' M unrelated-release-source.ts',
      PNPM_SENTINEL: guardSentinel,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
} catch (error) {
  guardFailure = error;
}
assert.ok(guardFailure, 'Unrelated release source changes must fail before installation');
assert.equal(fs.existsSync(guardSentinel), false, 'The source cleanliness guard must prevent pnpm installation');

function expectWorkflowFailure(label, options, expectedStep) {
  const fixture = makeWorkflowFixture(label);
  if (options.run) writeJson(path.join(fixture.directory, 'run.json'), { ...JSON.parse(fs.readFileSync(path.join(fixture.directory, 'run.json'), 'utf8')), ...options.run });
  if (options.release) writeJson(path.join(fixture.directory, 'release.json'), { ...JSON.parse(fs.readFileSync(path.join(fixture.directory, 'release.json'), 'utf8')), ...options.release });
  if (options.tagRef) writeJson(path.join(fixture.directory, 'tag-ref.json'), { ...JSON.parse(fs.readFileSync(path.join(fixture.directory, 'tag-ref.json'), 'utf8')), ...options.tagRef });
  if (options.mutateAsset) options.mutateAsset(fixture);
  let failure;
  try {
    runActualProvenanceWorkflow(fixture, 'invest-shell', { attestationMode: options.attestationMode });
  } catch (error) {
    failure = error;
  }
  assert.ok(failure, `${label} must fail`);
  assert.equal(failure.workflowStep, expectedStep, `${label} must fail at its intended workflow gate`);
  assert.equal(fs.existsSync(path.join(fixture.directory, 'runner-invest-shell', 'signing-sentinel')), false, `${label} must not sign`);
}

expectWorkflowFailure('workflow-draft-release', { release: { draft: true } }, 'Verify the immutable release and successful candidate run');
expectWorkflowFailure('workflow-prerelease', { release: { prerelease: true } }, 'Verify the immutable release and successful candidate run');
expectWorkflowFailure('workflow-mutable-release', { release: { immutable: false } }, 'Verify the immutable release and successful candidate run');
expectWorkflowFailure('workflow-wrong-commit', { tagRef: { object: { type: 'commit', sha: 'e'.repeat(40) } } }, 'Verify the immutable release and successful candidate run');
expectWorkflowFailure('workflow-failed-run', { run: { conclusion: 'failure' } }, 'Verify the immutable release and successful candidate run');
expectWorkflowFailure('workflow-missing-release-asset', { release: { assets: validWorkflowFixture.assetNames.slice(1).map((name, index) => ({ id: index + 1, name })) } }, 'Verify the immutable release and successful candidate run');
expectWorkflowFailure('workflow-other-package-byte-mismatch', {
  mutateAsset: fixture => fs.appendFileSync(path.join(fixture.releaseAssets, 'global-torque-domain-types-0.4.12.tgz'), 'tamper'),
}, 'Verify every immutable release asset byte');
expectWorkflowFailure('workflow-ui-byte-mismatch', {
  mutateAsset: fixture => fs.appendFileSync(path.join(fixture.releaseAssets, 'global-torque-ui-kit-0.1.4.tgz'), 'tamper'),
}, 'Verify every immutable release asset byte');
expectWorkflowFailure('workflow-retained-byte-mismatch', {
  mutateAsset: fixture => fs.appendFileSync(path.join(fixture.releaseAssets, 'pnpm-workspace.derived.yaml'), '# tamper\n'),
}, 'Verify every immutable release asset byte');
expectWorkflowFailure('workflow-missing-release-byte', {
  mutateAsset: fixture => fs.rmSync(path.join(fixture.releaseAssets, 'pnpm-lock.derived.yaml')),
}, 'Verify every immutable release asset byte');
expectWorkflowFailure('workflow-failed-attestation', { attestationMode: 'failed' }, 'Verify the exact retained archive');
expectWorkflowFailure('workflow-empty-attestation-result', { attestationMode: 'empty-array' }, 'Verify the exact retained archive');

const contextDirectory = path.join(fixtureRoot, 'context');
fs.mkdirSync(contextDirectory, { recursive: true });
const contextReceipt = JSON.parse(JSON.stringify(candidateReceipt));
contextReceipt.sourceRepository = 'fixture/torque-packages';
contextReceipt.sourceRevision = 'd'.repeat(40);
contextReceipt.sourceDirty = false;
writeJson(path.join(contextDirectory, 'candidate-receipt.json'), contextReceipt);
const expectedContextAssets = contextReceipt.packages.flatMap(entry => [entry.archive, `${entry.archive}.manifest.json`, `${entry.archive}.sha512`]).concat('candidate-receipt.json', contextReceipt.browserContract.file).sort();
const ghBin = path.join(fixtureRoot, 'bin');
fs.mkdirSync(ghBin, { recursive: true });
const ghStub = path.join(ghBin, 'gh');
fs.writeFileSync(ghStub, `#!/usr/bin/env node
import fs from 'node:fs';
const args = process.argv.slice(2);
const dir = process.env.GH_FIXTURE_DIR;
const read = name => process.stdout.write(fs.readFileSync(dir + '/' + name, 'utf8'));
if (args[0] === 'run' && args[1] === 'view') read('run.json');
else if (args[0] === 'api' && args[1].includes('/releases/tags/')) read('release.json');
else if (args[0] === 'api' && args[1].includes('/git/ref/tags/')) read('tag-ref.json');
else if (args[0] === 'api' && args[1].includes('/git/tags/')) read('annotated-tag.json');
else process.exit(2);
`);
fs.chmodSync(ghStub, 0o755);
const writeContextFixture = ({ run = {}, release = {}, tagRef = {} } = {}) => {
  writeJson(path.join(contextDirectory, 'run.json'), { status: 'completed', conclusion: 'success', event: 'workflow_dispatch', headBranch: 'framework-v0.4.12', headSha: 'd'.repeat(40), workflowName: 'Framework package candidate', ...run });
  writeJson(path.join(contextDirectory, 'release.json'), { id: 99, tag_name: 'framework-v0.4.12', draft: false, prerelease: false, immutable: true, assets: expectedContextAssets.map((name, index) => ({ id: index + 1, name })), ...release });
  writeJson(path.join(contextDirectory, 'tag-ref.json'), { ref: 'refs/tags/framework-v0.4.12', object: { type: 'commit', sha: 'd'.repeat(40) }, ...tagRef });
  writeJson(path.join(contextDirectory, 'annotated-tag.json'), {});
};
const contextEnv = { ...process.env, PATH: `${ghBin}:${process.env.PATH}`, GH_FIXTURE_DIR: contextDirectory };
writeContextFixture();
runScript('verify-provenance-context.mjs', [path.join(contextDirectory, 'candidate-receipt.json'), '67890', 'framework-v0.4.12', 'fixture/torque-packages'], { env: contextEnv });
for (const [label, fixture] of [
  ['draft-release', { release: { draft: true } }],
  ['prerelease', { release: { prerelease: true } }],
  ['mutable-release', { release: { immutable: false } }],
  ['wrong-tag-commit', { tagRef: { object: { type: 'commit', sha: 'e'.repeat(40) } } }],
  ['failed-run', { run: { conclusion: 'failure' } }],
  ['incomplete-assets', { release: { assets: expectedContextAssets.slice(1).map((name, index) => ({ id: index + 1, name })) } }],
]) {
  writeContextFixture(fixture);
  expectFailure(label, () => runScript('verify-provenance-context.mjs', [path.join(contextDirectory, 'candidate-receipt.json'), '67890', 'framework-v0.4.12', 'fixture/torque-packages'], { env: contextEnv }));
}
const wrongReceipt = JSON.parse(fs.readFileSync(path.join(contextDirectory, 'candidate-receipt.json'), 'utf8'));
wrongReceipt.candidate = '99.0.0';
writeJson(path.join(contextDirectory, 'candidate-receipt.json'), wrongReceipt);
writeContextFixture();
expectFailure('receipt-identity', () => runScript('verify-provenance-context.mjs', [path.join(contextDirectory, 'candidate-receipt.json'), '67890', 'framework-v0.4.12', 'fixture/torque-packages'], { env: contextEnv }));

console.log(`release-contract-tests-pass ${fixtureRoot}`);
