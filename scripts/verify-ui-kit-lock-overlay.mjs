import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const canonicalPath = path.resolve(process.argv[2] ?? 'pnpm-lock.yaml');
const derivedPath = path.resolve(process.argv[3] ?? '');
const transportPath = path.resolve(process.argv[4] ?? '');
const outputPath = path.resolve(process.argv[5] ?? 'ui-kit-lock-overlay.json');
const canonicalWorkspacePath = process.argv[6] ? path.resolve(process.argv[6]) : null;
const derivedWorkspacePath = process.argv[7] ? path.resolve(process.argv[7]) : null;
if (!fs.existsSync(canonicalPath) || !fs.existsSync(derivedPath)) throw new Error('Both canonical and derived pnpm lockfiles are required');
if (!fs.existsSync(transportPath)) throw new Error(`Authenticated UI Kit transport receipt is missing: ${transportPath}`);
if (Boolean(canonicalWorkspacePath) !== Boolean(derivedWorkspacePath)) throw new Error('Both canonical and derived pnpm workspace files are required');
if (canonicalWorkspacePath && (!fs.existsSync(canonicalWorkspacePath) || !fs.existsSync(derivedWorkspacePath))) throw new Error('Both canonical and derived pnpm workspace files are required');

const canonicalText = fs.readFileSync(canonicalPath, 'utf8');
const derivedText = fs.readFileSync(derivedPath, 'utf8');
const transport = JSON.parse(fs.readFileSync(transportPath, 'utf8'));
if (
  transport.schemaVersion !== 1
  || transport.package !== '@global-torque/ui-kit'
  || transport.version !== '0.1.4'
  || transport.sourceRepository !== 'global-torque/vue-ui'
  || transport.canonical !== true
  || !/^[0-9a-f]{128}$/u.test(transport.sha512 ?? '')
  || !/^sha512-[A-Za-z0-9+/]+=*$/u.test(transport.integrity ?? '')
) throw new Error('UI Kit transport receipt is not authenticated canonical metadata');

const archiveName = transport.artifact;
if (archiveName !== 'global-torque-ui-kit-0.1.4.tgz') throw new Error('Unexpected UI Kit transport archive identity');
const archiveToken = `global-torque-ui-kit-0.1.4.tgz`;
const hash = (text) => crypto.createHash('sha256').update(text).digest('hex');
const uiFileLocator = /file:[^\s,)]+global-torque-ui-kit-0\.1\.4\.tgz/gu;
const allFileLocators = text => text.match(/\bfile:[^\s,)]+/gu) ?? [];
const canonicalFileLocators = allFileLocators(canonicalText);
if (canonicalFileLocators.length > 0) throw new Error('Canonical pnpm lockfile already contains a file locator');
const derivedFileLocators = allFileLocators(derivedText);
if (derivedFileLocators.length === 0) throw new Error('Derived lockfile does not record a UI Kit archive locator');
if (derivedFileLocators.some(locator => !locator.includes(archiveName))) throw new Error('Derived lockfile contains an unrelated file locator');
const locatorToken = `file:<${archiveToken}>`;

const normalize = (text, { derived }) => {
  const normalized = text.split('\n').filter((line) => {
    if (!derived) return true;
    return !/^\s{2}['"]?@global-torque\/ui-kit['"]?:\s*file:[^\n]*global-torque-ui-kit-0\.1\.4\.tgz\s*$/u.test(line);
  }).map((line) => line
    .replace(uiFileLocator, locatorToken)
    .replaceAll(`@global-torque/ui-kit@${locatorToken}`, '@global-torque/ui-kit@0.1.4')
    .replaceAll(`specifier: ${locatorToken}`, 'specifier: 0.1.4')
    .replaceAll(`version: ${locatorToken}`, 'version: 0.1.4')
    .replaceAll(`, tarball: ${locatorToken}`, '')
  ).join('\n');
  // pnpm 12 records the package version explicitly for file tarballs. Permit
  // only the authenticated UI Kit version in its own package resolution block.
  return derived ? normalized.replace(
    /(^  ['"]@global-torque\/ui-kit@0\.1\.4['"]:\n    resolution: \{[^\n]+\}\n)    version: 0\.1\.4\n/mu,
    '$1',
  ) : normalized;
};

const expectedImporters = ['packages/invest-features', 'packages/invest-shell', 'packages/invest-widgets'];
const importerBlock = (text, importer) => {
  const header = `  ${importer}:\n`;
  const start = text.indexOf(header);
  if (start < 0) throw new Error(`Lockfile is missing importer ${importer}`);
  const rest = text.slice(start + header.length);
  const next = rest.search(/\n  [^\s]/u);
  return next < 0 ? rest : rest.slice(0, next);
};
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
const escapedArchiveName = escapeRegExp(archiveName);
const derivedSpecifierPattern = new RegExp(`^\\s+specifier: file:[^\\s]+${escapedArchiveName}$`, 'mu');
for (const importer of expectedImporters) {
  if (!/^\s+specifier: 0\.1\.4$/mu.test(importerBlock(canonicalText, importer))) {
    throw new Error(`Canonical lockfile does not pin UI Kit 0.1.4 for ${importer}`);
  }
  if (!derivedSpecifierPattern.test(importerBlock(derivedText, importer))) {
    throw new Error(`Derived lockfile does not map UI Kit to the retained archive for ${importer}`);
  }
}
if ((derivedText.match(new RegExp(`^\\s+specifier: file:[^\\s]+${escapedArchiveName}$`, 'gmu')) ?? []).length !== expectedImporters.length) {
  throw new Error('Derived lockfile contains an unexpected number of UI Kit archive importer locators');
}
const canonicalUiResolution = canonicalText.match(/['"]@global-torque\/ui-kit@0\.1\.4['"]:\n\s+resolution: \{integrity: ([^,}]+)/u)?.[1];
const derivedUiResolution = derivedText.match(/['"]@global-torque\/ui-kit@file:[^\s,)]+global-torque-ui-kit-0\.1\.4\.tgz['"]:\n\s+resolution: \{integrity: ([^,}]+)/u)?.[1];
if (canonicalUiResolution !== transport.integrity || derivedUiResolution !== transport.integrity) {
  throw new Error('Canonical and derived lockfiles must retain the authenticated UI Kit integrity');
}
const canonicalNormalized = normalize(canonicalText, { derived: false });
const derivedNormalized = normalize(derivedText, { derived: true });
if (canonicalNormalized !== derivedNormalized) throw new Error('Derived lockfile differs beyond the authenticated UI Kit locator mapping');

const retainedFiles = [
  { role: 'canonical-lockfile', name: 'pnpm-lock.canonical.yaml', sha256: hash(canonicalText) },
  { role: 'derived-lockfile', name: 'pnpm-lock.derived.yaml', sha256: hash(derivedText) },
];
if (canonicalWorkspacePath) {
  const canonicalWorkspaceText = fs.readFileSync(canonicalWorkspacePath, 'utf8');
  const derivedWorkspaceText = fs.readFileSync(derivedWorkspacePath, 'utf8');
  const workspaceOverridePattern = /^\s{2}['"]?@global-torque\/ui-kit['"]?:\s*['"]?(file:[^'"\n]+)['"]?\s*(?:\r?\n|$)/gmu;
  if (/^\s*['"]?@global-torque\/ui-kit['"]?:/mu.test(canonicalWorkspaceText)) throw new Error('Canonical pnpm workspace already contains a UI Kit overlay');
  const workspaceOverrides = [...derivedWorkspaceText.matchAll(workspaceOverridePattern)];
  if (workspaceOverrides.length !== 1 || !workspaceOverrides[0][1].endsWith(archiveName)) throw new Error('Derived pnpm workspace does not contain the exact UI Kit locator overlay');
  const workspaceWithoutOverlay = derivedWorkspaceText.replace(workspaceOverridePattern, '');
  if (workspaceWithoutOverlay !== canonicalWorkspaceText) throw new Error('Derived workspace differs beyond the authenticated UI Kit locator mapping');
  if ((derivedWorkspaceText.match(/\bfile:[^\s,)]+/gu) ?? []).length !== 1) throw new Error('Derived workspace contains an unexpected file locator');
  retainedFiles.push(
    { role: 'canonical-workspace', name: 'pnpm-workspace.canonical.yaml', sha256: hash(canonicalWorkspaceText) },
    { role: 'derived-workspace', name: 'pnpm-workspace.derived.yaml', sha256: hash(derivedWorkspaceText) },
  );
}

const importers = ['packages/invest-features', 'packages/invest-shell', 'packages/invest-widgets'];
const mapping = importers.map((importer) => ({
  importer,
  canonical: '0.1.4',
  derived: `file:${archiveName}`,
}));
const receipt = {
  schemaVersion: 1,
  mode: 'authenticated-ui-kit-overlay',
  canonicalLockSha256: hash(canonicalText),
  derivedLockSha256: hash(derivedText),
  locatorMapping: mapping,
  retainedFiles,
  uiKit: transport,
};
fs.writeFileSync(outputPath, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(`ui-kit-lock-overlay-pass canonical=${receipt.canonicalLockSha256} derived=${receipt.derivedLockSha256}`);
