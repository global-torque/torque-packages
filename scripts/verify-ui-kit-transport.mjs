import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const directory = path.resolve(process.argv[2] ?? '');
const runId = process.argv[3] ?? '';
const releaseTag = process.argv[4] ?? '';
const attestationPath = path.resolve(process.argv[5] ?? path.join(directory, 'original-provenance.json'));
const outputPath = path.resolve(process.argv[6] ?? path.join(directory, 'transport-receipt.json'));
const sourceRepository = process.env.UI_KIT_SOURCE_REPOSITORY ?? 'global-torque/vue-ui';
const releaseWorkflow = process.env.UI_KIT_RELEASE_WORKFLOW ?? 'global-torque/vue-ui/.github/workflows/release.yml';

if (!directory || !fs.existsSync(directory)) throw new Error(`UI Kit transport directory is missing: ${directory}`);
if (!/^\d+$/u.test(runId)) throw new Error('UI Kit source workflow run id must be numeric');
if (!/^ui-kit-v\d+\.\d+\.\d+$/u.test(releaseTag)) throw new Error(`UI Kit source release tag is invalid: ${releaseTag}`);
if (sourceRepository !== 'global-torque/vue-ui') throw new Error(`Unexpected UI Kit source repository: ${sourceRepository}`);
if (releaseWorkflow !== 'global-torque/vue-ui/.github/workflows/release.yml') throw new Error(`Unexpected UI Kit release workflow: ${releaseWorkflow}`);
if (!fs.existsSync(attestationPath) || fs.statSync(attestationPath).size === 0) throw new Error('Original UI Kit attestation is missing or empty');

const version = releaseTag.slice('ui-kit-v'.length);
const packageName = '@global-torque/ui-kit';
const archiveName = `global-torque-ui-kit-${version}.tgz`;
const archivePath = path.join(directory, archiveName);
const sidecarPath = `${archivePath}.manifest.json`;
const sha512Path = `${archivePath}.sha512`;
const selectedPath = path.join(directory, 'selected-release.json');
for (const required of [archivePath, sidecarPath, sha512Path, selectedPath]) {
  if (!fs.existsSync(required)) throw new Error(`UI Kit transport file is missing: ${required}`);
}

const digestHex = (bytes) => crypto.createHash('sha512').update(bytes).digest('hex');
const integrityFor = (bytes) => `sha512-${crypto.createHash('sha512').update(bytes).digest('base64')}`;
const sha256Hex = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const archiveBytes = fs.readFileSync(archivePath);
const sha512 = digestHex(archiveBytes);
const integrity = integrityFor(archiveBytes);
const archiveSha256 = sha256Hex(archiveBytes);
const selected = JSON.parse(fs.readFileSync(selectedPath, 'utf8'));
const sidecar = JSON.parse(fs.readFileSync(sidecarPath, 'utf8'));
const expectedCommit = selected.sourceCommit;

if (
  selected.schemaVersion !== 1
  || selected.selection !== 'single-package'
  || selected.package !== packageName
  || selected.version !== version
  || selected.sourceDirty !== false
  || !/^[0-9a-f]{40}$/u.test(expectedCommit ?? '')
  || selected.artifact !== archiveName
  || selected.sha512 !== sha512
  || selected.integrity !== integrity
) {
  throw new Error('Selected UI Kit release receipt is not the exact clean 0.1.4 candidate');
}
if (
  sidecar.schemaVersion !== 1
  || sidecar.package !== packageName
  || sidecar.version !== version
  || sidecar.sourceDirty !== false
  || sidecar.sourceCommit !== expectedCommit
  || sidecar.artifact !== archiveName
  || sidecar.sha512 !== sha512
  || sidecar.integrity !== integrity
  || !sidecar.files
  || typeof sidecar.files !== 'object'
  || Array.isArray(sidecar.files)
) {
  throw new Error('UI Kit archive sidecar does not match the selected clean release');
}
const shaFile = fs.readFileSync(sha512Path, 'utf8');
if (shaFile !== `${sha512}  ${archiveName}\n`) throw new Error('UI Kit archive SHA-512 sidecar is not exact');

const archiveFiles = execFileSync('tar', ['-tzf', archivePath], { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean).sort();
const details = execFileSync('tar', ['-tvzf', archivePath], { encoding: 'utf8' });
if (details.split('\n').some(line => /^[dhlpbc]/u.test(line))) throw new Error('UI Kit transport contains a non-regular archive entry');
const relativeFiles = archiveFiles.map((file) => {
  if (!file.startsWith('package/') || file.endsWith('/') || file.includes('\0')) throw new Error(`Unsafe UI Kit archive path: ${file}`);
  const relative = file.slice('package/'.length);
  if (!relative || path.posix.isAbsolute(relative) || relative.split('/').includes('..') || path.posix.normalize(relative) !== relative) {
    throw new Error(`Unsafe UI Kit archive path: ${file}`);
  }
  return relative;
});
if (new Set(relativeFiles).size !== relativeFiles.length) throw new Error('UI Kit transport contains duplicate archive entries');
if (JSON.stringify(Object.keys(sidecar.files).sort()) !== JSON.stringify(relativeFiles)) throw new Error('UI Kit sidecar inventory differs from the archive');
for (const relative of relativeFiles) {
  const fileDigest = digestHex(execFileSync('tar', ['-xOzf', archivePath, `package/${relative}`], { maxBuffer: 64 * 1024 * 1024 }));
  if (sidecar.files[relative] !== fileDigest) throw new Error(`UI Kit sidecar file digest mismatch: ${relative}`);
}
const manifest = JSON.parse(execFileSync('tar', ['-xOzf', archivePath, 'package/package.json'], { encoding: 'utf8' }));
if (manifest.name !== packageName || manifest.version !== version || manifest.private === true) throw new Error('UI Kit packed manifest identity is not exact');

const attestationBytes = fs.readFileSync(attestationPath);
let attestation;
try {
  attestation = JSON.parse(attestationBytes);
} catch (error) {
  throw new Error(`Original UI Kit attestation is not valid JSON: ${error.message}`);
}
if (!attestation || Array.isArray(attestation) || attestation.mediaType !== 'application/vnd.dev.sigstore.bundle.v0.3+json') {
  throw new Error('Original UI Kit attestation is not a Sigstore bundle');
}
const envelope = attestation.dsseEnvelope;
if (!envelope || envelope.payloadType !== 'application/vnd.in-toto+json' || typeof envelope.payload !== 'string') {
  throw new Error('Original UI Kit attestation does not contain an in-toto DSSE payload');
}
let statement;
try {
  statement = JSON.parse(Buffer.from(envelope.payload, 'base64').toString('utf8'));
} catch (error) {
  throw new Error(`Original UI Kit attestation payload is not valid JSON: ${error.message}`);
}
const subject = statement?.subject;
const workflow = statement?.predicate?.buildDefinition?.externalParameters?.workflow;
const resolvedDependencies = statement?.predicate?.buildDefinition?.resolvedDependencies;
const invocationId = statement?.predicate?.runDetails?.metadata?.invocationId;
if (
  statement?.predicateType !== 'https://slsa.dev/provenance/v1'
  || !Array.isArray(subject)
  || subject.length !== 1
  || subject[0]?.name !== archiveName
  || subject[0]?.digest?.sha256 !== archiveSha256
  || workflow?.repository !== `https://github.com/${sourceRepository}`
  || workflow?.ref !== `refs/tags/${releaseTag}`
  || workflow?.path !== '.github/workflows/release.yml'
  || !Array.isArray(resolvedDependencies)
  || !resolvedDependencies.some(dependency => (
    dependency?.uri === `git+https://github.com/${sourceRepository}@refs/tags/${releaseTag}`
    && dependency?.digest?.gitCommit === expectedCommit
  ))
  || typeof invocationId !== 'string'
  || !invocationId.includes(`/actions/runs/${runId}/`)
) {
  throw new Error('Original UI Kit attestation does not identify the selected source tag, commit, archive, and workflow run');
}
const transportReceipt = {
  schemaVersion: 1,
  package: packageName,
  version,
  sourceRepository,
  sourceCommit: expectedCommit,
  sourceRunId: runId,
  sourceReleaseTag: releaseTag,
  releaseWorkflow,
  artifact: archiveName,
  sha512,
  integrity,
  sidecar: path.basename(sidecarPath),
  sha512Sidecar: path.basename(sha512Path),
  selectedRelease: path.basename(selectedPath),
  originalAttestation: {
    file: path.basename(attestationPath),
    sha256: crypto.createHash('sha256').update(attestationBytes).digest('hex'),
  },
  canonical: true,
};
fs.writeFileSync(outputPath, `${JSON.stringify(transportReceipt, null, 2)}\n`);
console.log(`ui-kit-transport-pass ${packageName}@${version} ${expectedCommit} run=${runId}`);
