import { gzipSync } from 'node:zlib';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUTHORITATIVE_SOURCE_CONTRACTS,
  PACKAGE_SPECS,
  readReleaseArchive,
  validateReleaseArchives,
} from './validate-release-archives.mjs';

const VERSION = '0.4.14';

const archiveNameFor = (spec) =>
  `${spec.name.replace(/^@/, '').replace('/', '-')}-${VERSION}.tgz`;

const sourceBytesFor = (packageName) => Buffer.from(`authoritative source for ${packageName}\n`);

const authoritativeSourceContents = () => new Map(
  Object.keys(AUTHORITATIVE_SOURCE_CONTRACTS).map((packageName) => [
    packageName,
    sourceBytesFor(packageName),
  ]),
);

const tarEntry = (path, content) => {
  const header = Buffer.alloc(512);
  const bytes = Buffer.from(content);
  header.write(path, 0, 'utf8');
  header.write('0000644\0', 100, 'ascii');
  header.write('0000000\0', 108, 'ascii');
  header.write('0000000\0', 116, 'ascii');
  header.write(`${bytes.length.toString(8).padStart(11, '0')}\0`, 124, 'ascii');
  header.write('00000000000\0', 136, 'ascii');
  header[156] = '0'.charCodeAt(0);
  header.write('ustar\0', 257, 'ascii');
  header.write('00', 263, 'ascii');
  header.fill(0x20, 148, 156);
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 'ascii');
  const padding = Buffer.alloc((512 - (bytes.length % 512)) % 512);
  return Buffer.concat([header, bytes, padding]);
};

const validInput = () => {
  const archives = PACKAGE_SPECS.map((spec) => ({
    archiveName: archiveNameFor(spec),
    packageJson: {
      name: spec.name,
      version: VERSION,
      exports: {
        '.': './src/index.ts',
        './conditional': {
          types: './src/types.ts',
          default: './src/index.ts',
        },
        './wild/*': './src/wild/*',
      },
      dependencies: Object.fromEntries(spec.internalDependencies.map((name) => [name, VERSION])),
    },
    files: new Set([
      'package/package.json',
      'package/src/index.ts',
      'package/src/types.ts',
      ...(AUTHORITATIVE_SOURCE_CONTRACTS[spec.name]
        ? [AUTHORITATIVE_SOURCE_CONTRACTS[spec.name].archivePath]
        : []),
    ]),
    contents: new Map([
      ['package/src/index.ts', Buffer.from('export {};')],
      ['package/src/types.ts', Buffer.from('export type Fixture = true;')],
      ...(AUTHORITATIVE_SOURCE_CONTRACTS[spec.name]
        ? [[AUTHORITATIVE_SOURCE_CONTRACTS[spec.name].archivePath, sourceBytesFor(spec.name)]]
        : []),
    ]),
  }));
  return {
    archives,
    sourceContents: authoritativeSourceContents(),
    packageManifests: PACKAGE_SPECS.map((spec) => ({
      name: spec.name,
      directory: spec.directory,
      manifest: { name: spec.name, version: VERSION },
    })),
    rootManifest: { version: VERSION },
    ledger: {
      candidate: VERSION,
      packages: PACKAGE_SPECS.map((spec, index) => ({
        name: spec.name,
        directory: `packages/${spec.directory}`,
        version: VERSION,
        sourceRevision: `source-${index}`,
      })),
      compatibilityMatrix: {
        designTokens: [
          { cohort: '0.2.1', expected: `framework ${VERSION} matches the rendered contract` },
        ],
      },
      compatibility: {
        internalWorkspaceLinks: `pnpm pack must rewrite them to ${VERSION}`,
        uiKit: `framework widgets are owned here at ${VERSION}`,
      },
    },
    tagVersion: VERSION,
  };
};

const assertContains = (input, fragment) => {
  const errors = validateReleaseArchives(input);
  assert.ok(errors.some((error) => error.includes(fragment)), errors.join('\n'));
};

test('accepts the exact seven-package cohort and ignores wildcard export targets', () => {
  assert.deepEqual(validateReleaseArchives(validInput()), []);
});

test('rejects a missing or extra archive from the exact archive set', () => {
  const input = validInput();
  input.archives = input.archives.slice(0, -1);
  assertContains(input, 'archive set must be exactly');
});

test('rejects an archive manifest name or version mismatch', () => {
  const nameInput = validInput();
  nameInput.archives[0].packageJson = {
    ...nameInput.archives[0].packageJson,
    name: '@global-torque/not-a-framework-package',
  };
  assertContains(nameInput, 'contains unexpected package');

  const versionInput = validInput();
  versionInput.archives[0].packageJson = {
    ...versionInput.archives[0].packageJson,
    version: '0.4.13',
  };
  assertContains(versionInput, 'archive version 0.4.13 does not match tag');
});

test('rejects ledger, source manifest, and active compatibility version drift', () => {
  const ledgerInput = validInput();
  ledgerInput.ledger.candidate = '0.4.13';
  assertContains(ledgerInput, 'ledger candidate 0.4.13 does not match tag');

  const sourceInput = validInput();
  sourceInput.packageManifests[0].manifest.version = '0.4.13';
  assertContains(sourceInput, 'source manifest version 0.4.13 does not match tag');

  const compatibilityInput = validInput();
  compatibilityInput.ledger.compatibility.uiKit = 'framework widgets are owned here at 0.4.13';
  assertContains(compatibilityInput, 'ledger widgets cohort does not identify');
});

test('rejects workspace, file, link, and local dependency specifiers', () => {
  for (const forbidden of ['workspace:*', 'file:../package', 'link:../package', 'local:package']) {
    const input = validInput();
    input.archives[0].packageJson = {
      ...input.archives[0].packageJson,
      dependencies: { [`external-${forbidden}`]: forbidden },
    };
    assertContains(input, `uses forbidden ${forbidden} specifier`);
  }
});

test('rejects missing or wrong internal cohort dependencies', () => {
  const missingInput = validInput();
  missingInput.archives[1].packageJson = {
    ...missingInput.archives[1].packageJson,
    dependencies: {},
  };
  assertContains(missingInput, 'internal dependency @global-torque/domain-types must be exactly');

  const wrongInput = validInput();
  wrongInput.archives[1].packageJson = {
    ...wrongInput.archives[1].packageJson,
    dependencies: { '@global-torque/domain-types': '0.4.13' },
  };
  assertContains(wrongInput, 'must be exactly 0.4.14');

  const unexpectedInput = validInput();
  unexpectedInput.archives[0].packageJson = {
    ...unexpectedInput.archives[0].packageJson,
    dependencies: { '@global-torque/invest-core': VERSION },
  };
  assertContains(unexpectedInput, 'has unexpected internal dependency');
});

test('rejects a literal export target absent from the archive inventory', () => {
  const input = validInput();
  input.archives[0].packageJson = {
    ...input.archives[0].packageJson,
    exports: { '.': './src/missing.ts' },
  };
  assertContains(input, 'export target ./src/missing.ts is absent');
});

test('validates exact packed source bytes for the authoritative contracts', () => {
  const input = validInput();
  assert.deepEqual(validateReleaseArchives(input), []);

  const missingLocalInput = validInput();
  missingLocalInput.sourceContents.delete('@global-torque/domain-types');
  assertContains(missingLocalInput, 'is missing local authoritative source bytes');

  const missingPackedInput = validInput();
  missingPackedInput.archives
    .find((archive) => archive.packageJson.name === '@global-torque/invest-data')
    .contents.delete(AUTHORITATIVE_SOURCE_CONTRACTS['@global-torque/invest-data'].archivePath);
  assertContains(missingPackedInput, 'is missing packed source bytes');

  const mismatchInput = validInput();
  mismatchInput.archives
    .find((archive) => archive.packageJson.name === '@global-torque/invest-runtime')
    .contents.set(
      AUTHORITATIVE_SOURCE_CONTRACTS['@global-torque/invest-runtime'].archivePath,
      Buffer.from('stale packed source'),
    );
  assertContains(mismatchInput, 'packed source bytes do not match local authoritative source bytes');
});

test('compares bytes read from a minimal packed tar.gz fixture', async () => {
  const input = validInput();
  const packageName = '@global-torque/domain-types';
  const contract = AUTHORITATIVE_SOURCE_CONTRACTS[packageName];
  const packageJson = input.archives.find((archive) => archive.packageJson.name === packageName).packageJson;
  const archive = gzipSync(Buffer.concat([
    tarEntry('package/package.json', JSON.stringify(packageJson)),
    tarEntry('package/src/index.ts', 'export {};'),
    tarEntry('package/src/types.ts', 'export type Fixture = true;'),
    tarEntry(contract.archivePath, sourceBytesFor(packageName)),
    Buffer.alloc(1024),
  ]));
  const directory = await mkdtemp(join(tmpdir(), 'release-archive-fixture-'));
  try {
    const archivePath = join(directory, archiveNameFor(PACKAGE_SPECS[0]));
    await writeFile(archivePath, archive);
    input.archives[0] = await readReleaseArchive(archivePath);
    assert.deepEqual(validateReleaseArchives(input), []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
