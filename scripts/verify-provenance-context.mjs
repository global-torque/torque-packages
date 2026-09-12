import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const receiptPath = path.resolve(process.argv[2] ?? 'artifacts/candidate-receipt.json');
const runId = process.argv[3] ?? '';
const releaseTag = process.argv[4] ?? '';
const repository = process.argv[5] ?? process.env.GITHUB_REPOSITORY ?? '';
const outputPath = process.argv[6] ? path.resolve(process.argv[6]) : null;
const expectedOverlayFiles = [
  'pnpm-lock.canonical.yaml',
  'pnpm-lock.derived.yaml',
  'pnpm-workspace.canonical.yaml',
  'pnpm-workspace.derived.yaml',
];
const expectedOverlayRoles = [
  'canonical-lockfile',
  'derived-lockfile',
  'canonical-workspace',
  'derived-workspace',
];

if (!fs.existsSync(receiptPath)) throw new Error(`Candidate receipt is missing: ${receiptPath}`);
if (!/^\d+$/u.test(runId)) throw new Error('Candidate workflow run id must be numeric');
if (!/^framework-v\d+\.\d+\.\d+$/u.test(releaseTag)) throw new Error(`Framework release tag is not a stable semver tag: ${releaseTag}`);
if (!/^[^/]+\/[^/]+$/u.test(repository)) throw new Error(`Repository identity is invalid: ${repository}`);

const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
const candidate = receipt.candidate;
if (!/^\d+\.\d+\.\d+$/u.test(candidate ?? '')) throw new Error('Candidate receipt version must be a stable semver');
if (releaseTag !== `framework-v${candidate}`) throw new Error('Release tag does not identify the receipt candidate');
if (receipt.schemaVersion !== 1 || receipt.immutable !== true || receipt.promotable !== false) throw new Error('Candidate receipt is not an immutable non-promotable receipt');
if (receipt.sourceRepository !== repository || receipt.sourceDirty !== false || !/^[0-9a-f]{40}$/u.test(receipt.sourceRevision ?? '')) {
  throw new Error('Candidate receipt source identity is not clean and repository-bound');
}
if (!Array.isArray(receipt.packages) || receipt.packages.length !== 7) throw new Error('Candidate receipt does not contain all seven packages');

function ghJson(argumentsList) {
  try {
    return JSON.parse(execFileSync('gh', argumentsList, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  } catch (error) {
    const detail = error.stderr?.toString().trim();
    throw new Error(`GitHub metadata lookup failed: ${detail || error.message}`);
  }
}

const run = ghJson([
  'run', 'view', runId,
  '--repo', repository,
  '--json', 'status,conclusion,event,headBranch,headSha,workflowName',
]);
if (
  run.status !== 'completed'
  || run.conclusion !== 'success'
  || run.event !== 'workflow_dispatch'
  || run.workflowName !== 'Framework package candidate'
  || run.headSha !== receipt.sourceRevision
) {
  throw new Error('Candidate workflow run is not the successful exact source run');
}

const release = ghJson(['api', `repos/${repository}/releases/tags/${releaseTag}`]);
if (
  release.tag_name !== releaseTag
  || release.draft !== false
  || release.prerelease !== false
  || (release.immutable !== true && release.isImmutable !== true)
) {
  throw new Error('Framework release is draft, prerelease, mutable, or has the wrong tag');
}

const tagReference = ghJson(['api', `repos/${repository}/git/ref/tags/${releaseTag}`]);
if (tagReference.ref !== `refs/tags/${releaseTag}` || !tagReference.object?.sha || !['commit', 'tag'].includes(tagReference.object.type)) {
  throw new Error('Framework release tag reference is malformed');
}
let tagCommit = tagReference.object.sha;
if (tagReference.object.type === 'tag') {
  const annotatedTag = ghJson(['api', `repos/${repository}/git/tags/${tagReference.object.sha}`]);
  if (annotatedTag.object?.type !== 'commit' || typeof annotatedTag.object.sha !== 'string') throw new Error('Framework annotated tag does not resolve to a commit');
  tagCommit = annotatedTag.object.sha;
}
if (tagCommit !== receipt.sourceRevision) throw new Error('Framework release tag does not resolve to the candidate source commit');

const expectedAssets = new Set([
  ...receipt.packages.flatMap(entry => [entry.archive, `${entry.archive}.manifest.json`, `${entry.archive}.sha512`]),
  'candidate-receipt.json',
]);
const uiKit = receipt.uiKit;
if (uiKit?.canonical === true) {
  for (const name of [uiKit.artifact, uiKit.sidecar, uiKit.sha512Sidecar, uiKit.selectedRelease, uiKit.originalAttestation?.file, 'transport-receipt.json']) {
    if (typeof name !== 'string' || name.length === 0) throw new Error('Candidate receipt has incomplete canonical UI Kit transport metadata');
    expectedAssets.add(name);
  }
  const overlay = uiKit.lockOverlay;
  if (
    !overlay
    || !Array.isArray(overlay.retainedFiles)
    || overlay.retainedFiles.length !== expectedOverlayFiles.length
    || JSON.stringify(overlay.retainedFiles.map(file => file.name)) !== JSON.stringify(expectedOverlayFiles)
    || overlay.retainedFiles.some((file, index) => (
      file.role !== expectedOverlayRoles[index]
      || typeof file.name !== 'string'
      || path.basename(file.name) !== file.name
      || !expectedOverlayFiles.includes(file.name)
      || !/^[0-9a-f]{64}$/u.test(file.sha256 ?? '')
    ))
  ) throw new Error('Candidate receipt has incomplete retained UI Kit lock overlay metadata');
  const artifactRoot = path.dirname(receiptPath);
  for (const file of overlay.retainedFiles) {
    const retainedPath = path.join(artifactRoot, file.name);
    if (!fs.existsSync(retainedPath)) throw new Error(`Candidate artifact is missing retained UI Kit YAML ${file.name}`);
    const actualDigest = crypto.createHash('sha256').update(fs.readFileSync(retainedPath)).digest('hex');
    if (actualDigest !== file.sha256) throw new Error(`Candidate retained UI Kit YAML digest mismatch ${file.name}`);
    expectedAssets.add(file.name);
  }
  const verificationDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'torque-ui-kit-context-'));
  try {
    const verifiedOverlayPath = path.join(verificationDirectory, 'ui-kit-lock-overlay.json');
    execFileSync(process.execPath, [
      path.join(path.dirname(new URL(import.meta.url).pathname), 'verify-ui-kit-lock-overlay.mjs'),
      path.join(artifactRoot, 'pnpm-lock.canonical.yaml'),
      path.join(artifactRoot, 'pnpm-lock.derived.yaml'),
      path.join(artifactRoot, 'transport-receipt.json'),
      verifiedOverlayPath,
      path.join(artifactRoot, 'pnpm-workspace.canonical.yaml'),
      path.join(artifactRoot, 'pnpm-workspace.derived.yaml'),
    ], { stdio: 'inherit' });
    const verifiedOverlay = JSON.parse(fs.readFileSync(verifiedOverlayPath, 'utf8'));
    if (
      verifiedOverlay.canonicalLockSha256 !== overlay.canonicalLockSha256
      || verifiedOverlay.derivedLockSha256 !== overlay.derivedLockSha256
      || JSON.stringify(verifiedOverlay.locatorMapping) !== JSON.stringify(overlay.locatorMapping)
      || JSON.stringify(verifiedOverlay.retainedFiles) !== JSON.stringify(overlay.retainedFiles)
    ) throw new Error('Retained UI Kit lock overlay differs from the candidate receipt');
  } finally {
    fs.rmSync(verificationDirectory, { recursive: true, force: true });
  }
}
const releaseAssets = (release.assets ?? []).map(asset => asset.name).filter(name => typeof name === 'string').sort();
const expectedAssetList = [...expectedAssets].sort();
assert.deepEqual(releaseAssets, expectedAssetList, 'Framework release assets differ from the exact candidate receipt');

const result = {
  schemaVersion: 1,
  repository,
  candidate,
  releaseTag,
  candidateRunId: runId,
  sourceRevision: receipt.sourceRevision,
  tagCommit,
  expectedAssets: expectedAssetList,
  releaseId: release.id,
};
if (outputPath) fs.writeFileSync(outputPath, `${JSON.stringify({ ...result, run, release }, null, 2)}\n`);
console.log(`provenance-context-pass ${repository} ${releaseTag} run=${runId} source=${receipt.sourceRevision}`);
