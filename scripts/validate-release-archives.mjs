import { gunzipSync } from 'node:zlib';
import { basename, join, posix, resolve } from 'node:path';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const PACKAGE_SPECS = Object.freeze([
  {
    name: '@global-torque/domain-types',
    directory: 'domain-types',
    internalDependencies: [],
  },
  {
    name: '@global-torque/invest-core',
    directory: 'invest-core',
    internalDependencies: ['@global-torque/domain-types'],
  },
  {
    name: '@global-torque/invest-data',
    directory: 'invest-data',
    internalDependencies: ['@global-torque/domain-types', '@global-torque/invest-core'],
  },
  {
    name: '@global-torque/invest-runtime',
    directory: 'invest-runtime',
    internalDependencies: [
      '@global-torque/domain-types',
      '@global-torque/invest-core',
      '@global-torque/invest-data',
    ],
  },
  {
    name: '@global-torque/invest-widgets',
    directory: 'invest-widgets',
    internalDependencies: ['@global-torque/domain-types', '@global-torque/invest-core'],
  },
  {
    name: '@global-torque/invest-features',
    directory: 'invest-features',
    internalDependencies: [
      '@global-torque/domain-types',
      '@global-torque/invest-core',
      '@global-torque/invest-data',
      '@global-torque/invest-runtime',
      '@global-torque/invest-widgets',
    ],
  },
  {
    name: '@global-torque/invest-shell',
    directory: 'invest-shell',
    internalDependencies: [
      '@global-torque/domain-types',
      '@global-torque/invest-core',
      '@global-torque/invest-runtime',
      '@global-torque/invest-widgets',
    ],
  },
]);

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
];
const INTERNAL_PACKAGE_NAMES = new Set(PACKAGE_SPECS.map((spec) => spec.name));
const FORBIDDEN_SPECIFIER = /^(?:workspace:|file:|link:|local:)/i;

const archiveNameFor = (spec, version) =>
  `${spec.name.replace(/^@/, '').replace('/', '-')}-${version}.tgz`;

const packageSpecFor = (name) => PACKAGE_SPECS.find((spec) => spec.name === name);

const normalizeTarPath = (value) => {
  const normalized = posix.normalize(value.replace(/^\.\/+/, ''));
  return normalized === '.' ? '' : normalized;
};

const readTarNumber = (field) => {
  const bytes = field instanceof Uint8Array ? field : Buffer.from(field);
  if (bytes[0] & 0x80) {
    let value = 0n;
    for (const byte of bytes) value = (value << 8n) | BigInt(byte);
    return Number(value & ((1n << BigInt(bytes.length * 8 - 1)) - 1n));
  }
  const text = Buffer.from(bytes).toString('utf8').replace(/\0/g, '').trim();
  return text ? Number.parseInt(text, 8) : 0;
};

const parsePaxAttributes = (payload) => {
  const attributes = {};
  let offset = 0;
  while (offset < payload.length) {
    const lineEnd = payload.indexOf(0x0a, offset);
    if (lineEnd === -1) throw new Error('invalid PAX header without a newline');
    const line = Buffer.from(payload.subarray(offset, lineEnd)).toString('utf8');
    const lengthEnd = line.indexOf(' ');
    const declaredLength = Number.parseInt(line.slice(0, lengthEnd), 10);
    if (!Number.isInteger(declaredLength) || declaredLength < 3) {
      throw new Error(`invalid PAX attribute length: ${line}`);
    }
    const completeLine = Buffer.from(payload.subarray(offset, offset + declaredLength))
      .toString('utf8');
    const equals = completeLine.indexOf('=');
    if (lengthEnd < 1 || equals <= lengthEnd) throw new Error(`invalid PAX attribute: ${line}`);
    const attributeName = completeLine.slice(lengthEnd + 1, equals);
    attributes[attributeName] = completeLine.slice(equals + 1).replace(/\n$/, '');
    offset += declaredLength;
  }
  return attributes;
};

/** Parse the file inventory and contents from a gzip-compressed tar archive. */
export const parseTarGzip = (archive) => {
  const tar = gunzipSync(archive);
  const entries = [];
  let offset = 0;
  let globalAttributes = {};
  let pendingAttributes = {};
  let pendingLongPath;

  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const size = readTarNumber(header.subarray(124, 136));
    const payloadStart = offset + 512;
    const payloadEnd = payloadStart + size;
    if (payloadEnd > tar.length) throw new Error('tar entry exceeds archive length');
    const payload = tar.subarray(payloadStart, payloadEnd);
    const type = String.fromCharCode(header[156] || 48);
    const headerPath = Buffer.from(header.subarray(0, 100)).toString('utf8').replace(/\0.*$/, '');

    if (type === 'g') {
      globalAttributes = { ...globalAttributes, ...parsePaxAttributes(payload) };
    } else if (type === 'x') {
      pendingAttributes = { ...pendingAttributes, ...parsePaxAttributes(payload) };
    } else if (type === 'L') {
      pendingLongPath = Buffer.from(payload).toString('utf8').replace(/\0.*$/, '').replace(/\n$/, '');
    } else {
      const attributes = { ...globalAttributes, ...pendingAttributes };
      const entryPath = normalizeTarPath(pendingLongPath ?? attributes.path ?? headerPath);
      entries.push({ path: entryPath, type, content: payload });
      pendingAttributes = {};
      pendingLongPath = undefined;
    }
    offset = payloadStart + Math.ceil(size / 512) * 512;
  }
  return entries;
};

/** Read one packed archive; no package code is executed. */
export const readReleaseArchive = async (archivePath) => {
  const entries = parseTarGzip(await readFile(archivePath));
  const manifestEntry = entries.find((entry) => entry.path === 'package/package.json');
  if (!manifestEntry) throw new Error(`${basename(archivePath)} does not contain package/package.json`);
  return {
    archiveName: basename(archivePath),
    packageJson: JSON.parse(Buffer.from(manifestEntry.content).toString('utf8')),
    files: new Set(entries.map((entry) => entry.path)),
  };
};

export const readReleaseInputs = async ({
  archiveDirectory,
  packageRoot,
  ledgerPath,
  rootManifestPath,
}) => {
  const archiveNames = (await readdir(archiveDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.tgz'))
    .map((entry) => entry.name)
    .sort();
  const archives = await Promise.all(
    archiveNames.map((archiveName) => readReleaseArchive(join(archiveDirectory, archiveName))),
  );
  const packageManifests = await Promise.all(
    PACKAGE_SPECS.map(async (spec) => ({
      name: spec.name,
      directory: spec.directory,
      manifest: JSON.parse(await readFile(join(packageRoot, spec.directory, 'package.json'), 'utf8')),
    })),
  );
  return {
    archives,
    packageManifests,
    rootManifest: JSON.parse(await readFile(rootManifestPath, 'utf8')),
    ledger: JSON.parse(await readFile(ledgerPath, 'utf8')),
  };
};

const dependencyEntries = (manifest) => DEPENDENCY_FIELDS.flatMap((field) =>
  Object.entries(manifest?.[field] ?? {}).map(([name, version]) => ({ field, name, version })),
);

const addError = (errors, message) => errors.push(message);

const validateLedger = (errors, { ledger, packageManifests, rootManifest, tagVersion }) => {
  if (rootManifest?.version !== tagVersion) {
    addError(errors, `root package.json version ${rootManifest?.version ?? '<missing>'} does not match tag ${tagVersion}`);
  }
  for (const spec of PACKAGE_SPECS) {
    const source = packageManifests.find((item) => item.name === spec.name || item.manifest?.name === spec.name);
    if (!source) {
      addError(errors, `source manifest missing for ${spec.name}`);
    } else if (source.manifest?.version !== tagVersion) {
      addError(errors, `${spec.name} source manifest version ${source.manifest?.version ?? '<missing>'} does not match tag ${tagVersion}`);
    }
  }
  if (ledger?.candidate !== tagVersion) {
    addError(errors, `ledger candidate ${ledger?.candidate ?? '<missing>'} does not match tag ${tagVersion}`);
  }
  const ledgerPackages = Array.isArray(ledger?.packages) ? ledger.packages : [];
  if (ledgerPackages.length !== PACKAGE_SPECS.length) {
    addError(errors, `ledger package matrix has ${ledgerPackages.length} entries; expected ${PACKAGE_SPECS.length}`);
  }
  for (const spec of PACKAGE_SPECS) {
    const entry = ledgerPackages.find((item) => item?.name === spec.name);
    if (!entry) {
      addError(errors, `ledger package matrix missing ${spec.name}`);
      continue;
    }
    if (entry.directory !== `packages/${spec.directory}`) {
      addError(errors, `ledger directory for ${spec.name} is ${entry.directory ?? '<missing>'}`);
    }
    if (entry.version !== tagVersion) {
      addError(errors, `ledger version for ${spec.name} is ${entry.version ?? '<missing>'}, expected ${tagVersion}`);
    }
  }

  const expectedMatrix = ledger?.compatibilityMatrix?.designTokens?.find(
    (entry) => entry?.cohort === '0.2.1',
  )?.expected;
  if (typeof expectedMatrix !== 'string' || !expectedMatrix.includes(`framework ${tagVersion}`)) {
    addError(errors, `ledger compatibility matrix does not identify framework ${tagVersion}`);
  }
  const internalLinks = ledger?.compatibility?.internalWorkspaceLinks;
  if (typeof internalLinks !== 'string' || !internalLinks.includes(`rewrite them to ${tagVersion}`)) {
    addError(errors, `ledger internal workspace link policy does not identify ${tagVersion}`);
  }
  const widgetsCohort = ledger?.compatibility?.uiKit;
  if (typeof widgetsCohort !== 'string' || !widgetsCohort.includes(`owned here at ${tagVersion}`)) {
    addError(errors, `ledger widgets cohort does not identify ${tagVersion}`);
  }
};

const validateDependencies = (errors, manifest, tagVersion) => {
  const entries = dependencyEntries(manifest);
  for (const entry of entries) {
    if (typeof entry.version === 'string' && FORBIDDEN_SPECIFIER.test(entry.version)) {
      addError(errors, `${manifest?.name} packed ${entry.field}.${entry.name} uses forbidden ${entry.version} specifier`);
    }
  }
  const spec = packageSpecFor(manifest?.name);
  if (!spec) return;
  for (const internalName of INTERNAL_PACKAGE_NAMES) {
    const occurrences = entries.filter((entry) => entry.name === internalName);
    const expected = spec.internalDependencies.includes(internalName);
    if (!expected && occurrences.length > 0) {
      addError(errors, `${manifest.name} has unexpected internal dependency ${internalName}`);
    } else if (expected && (occurrences.length !== 1 || occurrences[0].version !== tagVersion)) {
      const actual = occurrences.map((entry) => `${entry.field}=${entry.version}`).join(', ') || '<missing>';
      addError(errors, `${manifest.name} internal dependency ${internalName} must be exactly ${tagVersion}; found ${actual}`);
    }
  }
};

const validateExports = (errors, archive) => {
  const targets = [];
  const visit = (value) => {
    if (typeof value === 'string') {
      if (value.startsWith('./') && !value.includes('*')) targets.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  visit(archive.packageJson?.exports);
  for (const target of new Set(targets)) {
    const normalizedTarget = normalizeTarPath(`package/${target.slice(2)}`);
    if (!archive.files.has(normalizedTarget)) {
      addError(errors, `${archive.packageJson?.name} export target ${target} is absent from ${archive.archiveName}`);
    }
  }
};

/** Pure validation of packed archive data and release reconciliation metadata. */
export const validateReleaseArchives = ({
  archives,
  packageManifests,
  rootManifest,
  ledger,
  tagVersion,
}) => {
  const errors = [];
  if (!tagVersion) {
    addError(errors, 'tag version is required');
    return errors;
  }
  const expectedArchiveNames = PACKAGE_SPECS.map((spec) => archiveNameFor(spec, tagVersion)).sort();
  const actualArchiveNames = archives.map((archive) => archive.archiveName).sort();
  if (actualArchiveNames.length !== expectedArchiveNames.length ||
      actualArchiveNames.some((name, index) => name !== expectedArchiveNames[index])) {
    addError(errors, `archive set must be exactly ${expectedArchiveNames.join(', ')}; found ${actualArchiveNames.join(', ') || '<none>'}`);
  }

  const seenPackages = new Set();
  for (const archive of archives) {
    const manifest = archive.packageJson;
    const spec = packageSpecFor(manifest?.name);
    if (!spec) {
      addError(errors, `${archive.archiveName} contains unexpected package ${manifest?.name ?? '<missing>'}`);
      continue;
    }
    if (seenPackages.has(spec.name)) addError(errors, `duplicate archive package ${spec.name}`);
    seenPackages.add(spec.name);
    if (manifest.version !== tagVersion) {
      addError(errors, `${spec.name} archive version ${manifest.version ?? '<missing>'} does not match tag ${tagVersion}`);
    }
    const expectedArchiveName = archiveNameFor(spec, tagVersion);
    if (archive.archiveName !== expectedArchiveName) {
      addError(errors, `${spec.name} archive must be named ${expectedArchiveName}; found ${archive.archiveName}`);
    }
    validateDependencies(errors, manifest, tagVersion);
    validateExports(errors, archive);
  }
  validateLedger(errors, { ledger, packageManifests, rootManifest, tagVersion });
  return errors;
};

export const main = async (args = process.argv.slice(2)) => {
  const [archiveDirectory, tagVersion, packageRoot = 'packages', ledgerPath = 'docs/source-reconciliation.json', rootManifestPath = 'package.json'] = args;
  if (!archiveDirectory || !tagVersion) {
    throw new Error('usage: node scripts/validate-release-archives.mjs <archive-directory> <tag-version> [package-root] [ledger-path] [root-manifest-path]');
  }
  const input = await readReleaseInputs({
    archiveDirectory: resolve(archiveDirectory),
    packageRoot: resolve(packageRoot),
    ledgerPath: resolve(ledgerPath),
    rootManifestPath: resolve(rootManifestPath),
  });
  const errors = validateReleaseArchives({ ...input, tagVersion });
  if (errors.length > 0) {
    throw new Error(`release archive validation failed:\n${errors.map((error) => `- ${error}`).join('\n')}`);
  }
  console.log(`Validated ${input.archives.length} release archives for ${tagVersion}.`);
};

const scriptPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (scriptPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
