import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PACKAGE_SPECS,
  validateReleaseArchives,
} from './validate-release-archives.mjs';

const VERSION = '0.4.13';

const archiveNameFor = (spec) =>
  `${spec.name.replace(/^@/, '').replace('/', '-')}-${VERSION}.tgz`;

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
    files: new Set(['package/package.json', 'package/src/index.ts', 'package/src/types.ts']),
  }));
  return {
    archives,
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
    version: '0.4.12',
  };
  assertContains(versionInput, 'archive version 0.4.12 does not match tag');
});

test('rejects ledger, source manifest, and active compatibility version drift', () => {
  const ledgerInput = validInput();
  ledgerInput.ledger.candidate = '0.4.12';
  assertContains(ledgerInput, 'ledger candidate 0.4.12 does not match tag');

  const sourceInput = validInput();
  sourceInput.packageManifests[0].manifest.version = '0.4.12';
  assertContains(sourceInput, 'source manifest version 0.4.12 does not match tag');

  const compatibilityInput = validInput();
  compatibilityInput.ledger.compatibility.uiKit = 'framework widgets are owned here at 0.4.12';
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
    dependencies: { '@global-torque/domain-types': '0.4.12' },
  };
  assertContains(wrongInput, 'must be exactly 0.4.13');

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
