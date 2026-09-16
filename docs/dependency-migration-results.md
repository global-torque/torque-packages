# Dependency migration implementation evidence

Implementation in progress, 2026-09-16. Local probes are non-promotable development evidence; no publication, hosted Linux run, or consuming application rollout is implied.

## Baseline

Source commit: `c49ae7355e1edc4654ff2e2126bcead56e7fadc5`.
An isolated detached checkout installed the frozen graph with Node 24.14.0 and pnpm 10.34.5, ignoring lifecycle scripts. UI Kit 0.1.4 was available from npm with the canonical integrity. The audit returned zero advisories.

All 144 Vitest files and 1,114 tests passed (core 138, data 136, widgets 30, runtime 255, features 350, shell 205). The five shell CSS tests also passed. The baseline link/recovery tests exposed a pre-existing macOS symlink-path issue: link creation canonicalized the checkout but recovery compared a lexical path to that canonical journal. The original 32 link tests pass with a physical temporary path. Recovery now canonicalizes its public entry points, fixture paths are physical, and an explicit symlink recovery regression test exercises the fix without relying on the host's temporary directory layout.

Raw logs, manifest/lockfile SHA-256 hashes, registry metadata, retained archives and compiler reproduction are under `/tmp/torque-dependency-migration-evidence` on the implementation machine. These temporary local files must be copied to durable release storage before use as release evidence.

## TypeScript decision

TypeScript remains 6.0.3. A real two-project reproduction on Node 24.14.0 installed Vue/compiler-sfc 3.5.42 and vue-tsc 3.3.11 with TypeScript 6.0.3 and 7.0.2 respectively. TS6 accepts a valid numeric SFC prop and rejects a string prop with TS2322. TS7 crashes for both fixtures before checking them: `ERR_PACKAGE_PATH_NOT_EXPORTED` for `typescript/lib/tsc`. This establishes a vue-tsc CLI compatibility blocker, not a Vue runtime incompatibility. The installed vue-tsc entry point still calls `require.resolve('typescript/lib/tsc')`.

Sources: [Vue language-tools releases](https://github.com/vuejs/language-tools/releases), [vue-tsc metadata](https://registry.npmjs.org/vue-tsc/3.3.11), [TypeScript metadata](https://registry.npmjs.org/typescript/7.0.2).

## Consumer profiles

`CONSUMER_PROFILE=baseline` selects the previously supported toolchain; `CONSUMER_PROFILE=target` selects migration targets. Both default to testing npm and pnpm; `CONSUMER_PACKAGE_MANAGERS=npm,pnpm` can make that selection explicit. Example:

```sh
CONSUMER_PROFILE=baseline node scripts/verify-archive-consumers.mjs "$MIGRATION_ARTIFACTS"
CONSUMER_PROFILE=target node scripts/verify-archive-consumers.mjs "$MIGRATION_ARTIFACTS"
```

A verified UI Kit archive can still be supplied as the second positional argument. Unknown profiles fail. Each browser report includes the profile, Node and Chromium versions, actual resolved direct dependencies and candidate digest. Evidence directories are separated by candidate, profile and package manager. `KEEP_CONSUMER_ARTIFACTS=true` retains the detached installations and their lockfiles.

## Patch/minor stage

Updated plugin-vue 6.0.9, Vue Test Utils 2.5.1, Lucide Vue 1.46.0, Prettier 3.9.7 and ESLint 9.39.5. A separate graph change patched Node declarations to 24.13.5 in widgets and 25.9.7 at the root/runtime. Both graphs passed the Node builds, complete checks, release contract tests and zero-advisory audits on Node 24.14.0 / pnpm 10.34.5. The existing mixed-major declaration policy was preserved.

Playwright was separately updated to 1.63.0 with matching Chromium 153.0.8010.12 (revision 1243). No unrelated formatting was applied. Vue 3.5.42, Vite 8.3.0 and router 5.3.1 were already resolved in the baseline and are not claimed as upgrades.

## Development and published runtimes (policy revised by user)

The final policy is `^24.21.0` for the root and all seven published packages, with `.node-version` and all CI workflows fixed to 24.21.0. Direct Node declarations are aligned at 24.13.5. The Node binary was downloaded from the [official release index](https://nodejs.org/dist/index.json) and checked against its published SHA-256 sum.

Earlier staged checks also passed on Node 22.12.0 with candidate 0.2.5. The user subsequently selected Node 24 only, replacing the plan's original Node 22 floor. Those earlier checks are historical evidence, not a continuing support commitment.

## Vitest 5

Vitest 5.0.1 passed all existing 144 suites / 1,114 tests with jsdom still at 27.4.0. Reviewed package configs, setup files, hoisted mocks and timer suites; no new exclusions or compatibility switches were needed. The default mock-history clearing change did not remove or skip any assertions. Source: [Vitest 5 migration guide](https://vitest.dev/guide/migration/).

Re-resolution reports an existing external peer metadata conflict: SDK 0.2.0 → `@alchemy/wallet-apis@5.2.0` → `@alchemy/wallet-api-types@0.2.0-alpha.3` declares TypeScript `^5.8.2`, while this repository already used 6.0.3. The same peer constraint and TS6 resolution exist in the original committed lockfile. No peer rule was relaxed and no external package version was changed to conceal it. This owner-controlled compatibility issue remains a release handoff item even when local behavioral tests pass.

## jsdom 30 and Markdown 15

jsdom 30.0.1 passed all 144 original files / 1,114 tests, release contracts and detached npm/pnpm production browser/SSR checks on Node 24.21.0 (candidate 0.2.6). The resolved Undici 8 branch returned zero audit advisories; the existing scoped Undici 7 override remains.

Markdown 15.0.2 supplies its declarations, so both direct `@types/markdown-it` dependencies were removed. Real offer-rendering regressions cover tables, code escaping, entities, links, image query handling and reactive content. VitePress remains 1.6.4 on its own Markdown 14 branch.

The initial 0.2.7 detached typecheck correctly rejected a plugin parameter typed as the entire Markdown 15 instance. Narrowing only to its renderer still exposed incompatible v14/v15 token attribute types. The plugin now infers and forwards its host's renderer argument types, requiring only the `renderToken` method and renderer rules that it uses. No `any`, casts, internal imports or suppressed checks were introduced. Candidate 0.2.7 is failed development evidence and must not be promoted; the corrected bytes have a new identity, 0.2.8.

## Consuming application baseline

Identified local consumer: `dashboard.webdevelop.biz/apps/invest`, source `ac5af9bc76ff2518351e77db818cc806ad5f6e18`. An isolated checkout at `/tmp/torque-dependency-migration-host` installed the frozen existing graph on Node 24.21.0 / pnpm 10.34.5. Its source typecheck passed. All 22 files / 105 tests passed with `TMPDIR=/private/tmp`; the default macOS temporary symlink exposes an existing host fixture path assertion mismatch (104 pass / 1 fail), unrelated to upgraded packages. The original host checkout is untouched.

The corrected Markdown candidate 0.2.8 passed both npm and pnpm target consumers, including positive/negative SFC checks, typed Markdown 14/15 plugin registration, native plugin rendering, SSR, hydration, assets, charts and browser checks. All 146 workspace files / 1,118 tests passed (the additional files include the pre-upgrade VueUse lifecycle baseline).

## VueUse 15

The upstream v15 timer migration affects the application's WebSocket heartbeat: its removed `interval` option is replaced by a `useIntervalFn` scheduler with the original 60-second cadence and initially paused behavior. A fake-timer regression verifies no premature ping, resume at 60 seconds and cancellation after pause. Real VueUse tests cover reactive cookies/logout/listener disposal and WebSocket reconnect/scope disposal. The integration import alias was removed in favor of public exports. External UI packages retain their independently owned VueUse dependencies.

Sources: [VueUse v15 release](https://github.com/vueuse/vueuse/releases/tag/v15.0.0). No removed `templateRef`, throttle-default-sensitive call, EventSource or IndexedDB API use was found in framework source.

VueUse candidate 0.2.9 passed the full workspace checks (146 files / 1,119 tests), release contracts, zero-advisory audit and both detached package managers. The real browser session store reads an injected cookie, reports login, resets state and removes that cookie on logout. The npm consumer retains VueUse core 12.8.2 (VitePress dependencies), 14.4.0 (external UI dependencies) and 15.0.0 (framework), with one Pinia singleton. This is intentionally not a VueUse-singleton promise.

The host baseline production build, SSR page rendering and five-page browser smoke passed without JavaScript exceptions. Browser console reports existing localhost CORS refusals from the development identity/offer APIs and a missing resource; the smoke does not establish authenticated live-backend functionality. Retained baseline HTML/assets and the complete host lockfile provide rollback/comparison inputs.

## Pinia 4

Workspace Pinia is 4.0.3 with its required `@vue/devtools-api` 8.1.5 peer supplied. Removed the obsolete hardcoded `pinia/dist/pinia.mjs` test alias. Candidate 0.2.11 passed all workspace checks, release contracts, zero-advisory audit and all four detached combinations: Pinia 3.0.4 and 4.0.3 under npm and pnpm. The published peer contract remains `^3.0.4 || ^4.0.3` on runtime/features/shell.

Consumer checks register one shared Pinia, verify per-request SSR isolation and hydration, exercise state increment/reset and the real session cookie store, and apply an actual Vite HMR update while preserving live state. HMR uses a focused page containing the framework session store and consumer store; the full production fixture remains separate. An earlier full-app dev fixture failed on pre-existing CommonJS prebundling requirements (AJV/lodash), not on a Pinia operation; 0.2.10 remains non-promotable development evidence. No framework test assertions were removed.

The real host with 0.2.11 also passed its typecheck, 22 files / 105 tests, production/SSR build and five-page browser smoke. Re-resolving the original host baseline independently reproduced its TypeScript, cookie, WebSocket optional-native-peer and missing Embla peer warnings; these are pre-existing host/external-owner metadata issues, not waived compatibility gates.

Source: [Pinia 4 changelog](https://github.com/vuejs/pinia/blob/v4.0.3/packages/pinia/CHANGELOG.md).

## Unovis 1.7 and chart verification

Both Unovis packages are upgraded atomically to 1.7.0. Removed the two 1.6.7 barrel patches, their workspace patch configuration, the scoped MapLibre omission and their reconciliation hashes. The natural graph includes MapLibre GL 6.7.0. Workspace typechecks/tests and SSR imports pass without patching upstream packages; audit remains at zero advisories.

Added real browser interactions for legend filtering/reset, area tooltip/crosshair markers, donut tooltips and segment selection/reset. These exposed an existing tooltip bug: donut arcs contain an outer `value` as well as `data.value`, and the flat-datum check incorrectly formatted arc internals, producing `NaN`. The nested original datum now takes precedence when it contains the requested category. A regression reproduced the failure before the fix and passes afterward. Unovis 1.6.7's published donut source uses the same nested arc shape, so this is a pre-existing framework defect found by expanded verification. Candidate 0.2.12 is failed development evidence.

The HMR fixture now scans only its own entry and waits for initial network activity to settle before mutating the store; an earlier cold-start probe timed out although its warm rerun passed. HMR reports retain server output and errors alongside browser evidence. No state-preservation assertion was removed.

Corrected candidate 0.2.14 passes both npm and pnpm target consumers, including all chart interactions, production/SSR builds and HMR. All 146 suites / 1,120 tests pass. The target fixture's browser JavaScript grows from 409.32 kB (138.02 kB gzip) before this stage to 419.36 kB (141.45 kB gzip), with CSS unchanged at 81.43 kB; this comparison includes the expanded two-series fixture and tooltip fix as well as Unovis. MapLibre is present in the natural dependency graph without producing a map-sized browser bundle.

## ESLint decision

No ESLint configuration, script invocation or editor configuration exists in this repository. The direct ESLint dependency is removed; `pnpm run lint` continues to enforce the existing framework boundary policy. ESLint directive comments retained in source do not constitute an executable lint integration. No new lint rules or formatting policy were introduced.

## pnpm 12

Adopted pnpm 12.4.2 directly from 10.34.5 after an isolated pilot: all eight `packageManager` fields, root engine, workflows, link-tool version contract, documentation and target consumer profile agree. The baseline consumer intentionally retains pnpm 10.34.5. Corepack supplies the executable in CI and local verification. All dependency installs retain `--ignore-scripts`; `verifyDepsBeforeRun: false` keeps installs explicit, including link transactions. Seven exact reviewed migration versions are exempted from the default 24-hour release age; the default remains in force for other versions.

pnpm 12 adds a leading package-manager YAML document to the lockfile. Re-resolution removes the stale Node 25 typing branch and updates peer contexts. Repeated resolution exposed an optional esbuild peer alternating between absent and an incompatible ambient 0.25.12. Supplying Vite 8's compatible esbuild 0.28.2 explicitly as a root development dependency stabilizes both canonical and overlay graphs. VitePress retains its separately owned older esbuild branch.

The authenticated UI transport was downloaded and verified against its original GitHub attestation, source tag/commit and archive digest. Its SHA-512 matches the public registry package. The real overlay derivation and frozen install pass; the verifier still rejects unrelated graph drift. It now accepts only pnpm 12's exact `version: 0.1.4` field inside the authenticated UI Kit package block. Release regressions reject an incorrect version and an extra field; pnpm 10's representation remains accepted.

A real pnpm 12 transaction linked all seven packages into a detached registry consumer. The retained standalone recovery helper restored all three protected manifest/lock/workspace files byte-for-byte and restored all seven registry 0.2.3 packages. Unit contracts additionally cover unlink, conflicts and mixed cohorts. A raw npm-installed pnpm 12 placeholder produced macOS `ENOEXEC` when lifecycle scripts were ignored; the documented Corepack bootstrap resolves that without enabling dependency lifecycle scripts.

Sources: [pnpm 12.4.2 release](https://github.com/pnpm/pnpm/releases/tag/v12.4.2), [pnpm settings](https://pnpm.io/settings).
