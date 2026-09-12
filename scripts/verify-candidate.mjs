import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const candidate = process.argv[2] ?? '0.2.1';
const reconciliation = JSON.parse(fs.readFileSync(path.join(root, 'docs/source-reconciliation.json'), 'utf8'));
if (candidate !== reconciliation.candidate) throw new Error(`Candidate ${candidate} is not the reviewed ${reconciliation.candidate}`);
for (const entry of reconciliation.packages) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, entry.directory, 'package.json'), 'utf8'));
  if (manifest.name !== entry.name || manifest.version !== candidate || manifest.private) {
    throw new Error(`Candidate manifest mismatch: ${entry.directory}`);
  }
}
for (const patch of reconciliation.patches ?? []) {
  const file = path.join(root, patch.file);
  const digest = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if (digest !== patch.sha256) throw new Error(`Patch digest mismatch: ${patch.file}`);
}
const assetPattern = /\.(?:svg|png|jpe?g|webp|gif|woff2?|ttf|otf)$/u;
const assetPaths = [];
const walk = directory => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (assetPattern.test(entry.name)) assetPaths.push(path.relative(root, file).split(path.sep).join('/'));
  }
};
walk(path.join(root, 'packages'));
if (assetPaths.length !== reconciliation.assetInventory?.frameworkOwnedPaths) throw new Error(`Framework asset inventory mismatch: ${assetPaths.length}`);
if (assetPaths.some(file => file.includes('/social-login/') || file.includes('/socials/assets/'))) {
  throw new Error('Host-owned social marks remain in the public framework asset inventory');
}
console.log(`candidate-contract-pass ${candidate} ${reconciliation.sourceRevision}`);
