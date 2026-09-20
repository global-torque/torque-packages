import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const archivePath = path.resolve(process.argv[2] ?? '');
const attestationPath = path.resolve(process.argv[3] ?? '');
const receiptPath = path.resolve(process.argv[4] ?? 'external-dependencies.json');
const reconciliation = JSON.parse(fs.readFileSync(path.join(root, 'docs/source-reconciliation.json'), 'utf8'));
const expected = reconciliation.externalDependencies?.['@global-torque/design-tokens'];
if (!expected) throw new Error('Design-token external dependency is absent from source reconciliation');
if (!fs.existsSync(archivePath) || path.basename(archivePath) !== expected.archive) {
  throw new Error(`Expected exact external archive ${expected.archive}`);
}
if (!fs.existsSync(attestationPath)) throw new Error('External dependency attestation is missing');

const archiveBytes = fs.readFileSync(archivePath);
const archiveSha256 = crypto.createHash('sha256').update(archiveBytes).digest('hex');
const integrity = `sha512-${crypto.createHash('sha512').update(archiveBytes).digest('base64')}`;
if (archiveSha256 !== expected.archiveSha256) throw new Error('External dependency archive SHA-256 mismatch');
if (integrity !== expected.integrity) throw new Error('External dependency archive SRI mismatch');
const inventory = execFileSync('tar', ['-tzf', archivePath], { encoding: 'utf8' })
  .split('\n').filter(Boolean).sort().join('\n') + '\n';
const inventorySha256 = crypto.createHash('sha256').update(inventory).digest('hex');
if (inventorySha256 !== expected.inventorySha256) throw new Error('External dependency archive inventory mismatch');
const manifest = JSON.parse(execFileSync('tar', ['-xOzf', archivePath, 'package/package.json'], { encoding: 'utf8' }));
if (manifest.name !== '@global-torque/design-tokens' || manifest.version !== expected.version) throw new Error('External dependency manifest identity mismatch');

const attestationBytes = fs.readFileSync(attestationPath);
const attestationSha256 = crypto.createHash('sha256').update(attestationBytes).digest('hex');
if (attestationSha256 !== expected.attestation.sha256) throw new Error('External dependency attestation digest mismatch');
const attestation = JSON.parse(attestationBytes);
const predicateTypes = [...new Set((attestation.attestations ?? []).map(item => item.predicateType).filter(Boolean))].sort();
assert.equal((attestation.attestations ?? []).length, expected.attestation.count, 'External attestation count mismatch');
assert.deepEqual(predicateTypes, [...expected.attestation.predicateTypes].sort(), 'External attestation predicates mismatch');

const receipt = {
  schemaVersion: 1,
  dependencies: reconciliation.externalDependencies,
  verified: {
    '@global-torque/design-tokens': {
      archiveSha256,
      integrity,
      inventorySha256,
      attestationSha256,
      manifest: { name: manifest.name, version: manifest.version },
    },
  },
};
fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
console.log(`external-dependency-pass ${manifest.name}@${manifest.version}`);
