import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const archive = path.resolve(process.argv[2] ?? '');
if (!archive || !fs.existsSync(archive)) throw new Error(`UI Kit overlay archive is missing: ${archive}`);
const sidecarPath = `${archive}.manifest.json`;
if (!fs.existsSync(sidecarPath)) throw new Error(`UI Kit overlay sidecar is missing: ${sidecarPath}`);
const sidecar = JSON.parse(fs.readFileSync(sidecarPath, 'utf8'));
if (sidecar.schemaVersion !== 1 || sidecar.package !== '@global-torque/ui-kit' || sidecar.version !== '0.1.4') throw new Error('UI Kit overlay identity is not the reviewed 0.1.4 candidate');
if (typeof sidecar.sha512 !== 'string' || typeof sidecar.integrity !== 'string' || !sidecar.files || typeof sidecar.files !== 'object' || Array.isArray(sidecar.files)) throw new Error('UI Kit overlay sidecar is missing its file hash map');
const bytes = fs.readFileSync(archive);
const sha512 = crypto.createHash('sha512').update(bytes).digest('hex');
const integrity = `sha512-${crypto.createHash('sha512').update(bytes).digest('base64')}`;
if (sidecar.sha512 !== sha512 || sidecar.integrity !== integrity) throw new Error('UI Kit overlay archive digest mismatch');
const archiveName = path.basename(archive);
if (sidecar.artifact !== archiveName) throw new Error('UI Kit overlay artifact name mismatch');
const archiveFiles = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split('\n').filter(Boolean).sort();
const details = execFileSync('tar', ['-tvzf', archive], { encoding: 'utf8' });
if (details.split('\n').some(line => /^[dhlpbc]/u.test(line))) throw new Error('UI Kit overlay contains a non-regular archive entry');
const relativeFiles = archiveFiles.map((file) => {
  if (!file.startsWith('package/') || file.endsWith('/') || file.includes('\0')) throw new Error(`Unsafe UI Kit overlay path: ${file}`);
  const relative = file.slice('package/'.length);
  if (!relative || path.posix.isAbsolute(relative) || relative.split('/').includes('..') || path.posix.normalize(relative) !== relative) throw new Error(`Unsafe UI Kit overlay path: ${file}`);
  return relative;
});
if (new Set(relativeFiles).size !== relativeFiles.length || JSON.stringify(Object.keys(sidecar.files).sort()) !== JSON.stringify(relativeFiles)) throw new Error('UI Kit overlay sidecar file inventory differs from the archive');
const manifest = JSON.parse(execFileSync('tar', ['-xOzf', archive, 'package/package.json'], { encoding: 'utf8' }));
if (manifest.name !== sidecar.package || manifest.version !== sidecar.version || manifest.private === true) throw new Error('UI Kit overlay packed manifest identity mismatch');
for (const relative of relativeFiles) {
  const digest = crypto.createHash('sha512').update(execFileSync('tar', ['-xOzf', archive, `package/${relative}`], { maxBuffer: 64 * 1024 * 1024 })).digest('hex');
  if (sidecar.files[relative] !== digest) throw new Error(`UI Kit overlay per-file digest mismatch: ${relative}`);
}
console.log(`ui-kit-overlay-pass ${sidecar.package}@${sidecar.version} ${sha512}`);
