# Dependency migration plan

Status: implementation completed in candidate 0.3.0, with TypeScript 7 deferred as approved. See [implementation evidence](dependency-migration-results.md) for checks and remaining release handoff items.

User policy amendment: Node 24 only; the root and all seven packages require `^24.21.0`. Node 22 support is intentionally removed.
Evidence date: 2026-09-16. Versions below are explicit targets verified against npm, not moving `latest` specifications.

## Outcome and boundaries

Upgrade the workspace in independently reviewable changes, preserving source-based package exports, Node helper builds, runtime singleton identity, and reproducible npm/pnpm consumer installation. Complete each stage's checks before starting the next. A stage can be deferred with a recorded compatibility blocker without blocking unrelated stages.

This plan covers the patch/minor baseline and the TypeScript, Vitest, jsdom, Markdown, VueUse, Pinia, Unovis, ESLint, and pnpm migrations identified in the dependency assessment. Implementation, publication, tags, and deployment are separate work. External `@global-torque/*` packages remain at their reviewed exact versions unless their owners release a required compatibility update.

The committed lockfile is the baseline. Vue 3.5.42, Vite 8.3.0, Vue Router 5.3.1, Firebase 12.19.0, and VueUse 14.4.0 are already resolved despite lower manifest range minima. Do not count changing those minima as dependency upgrades. The initial `pnpm audit --json` reported zero advisories; this is a dated baseline, not a guarantee about future graphs.

## Sequence and deliverables

| Stage | Change | Depends on | Exit evidence |
| --- | --- | --- | --- |
| 0 | Capture reproducible baseline and prepare consumer matrix | None | Existing checks pass, or pre-existing failures are recorded and resolved before affected migrations |
| 1 | Patch/minor updates and Playwright 1.63.0 | 0 | Workspace checks and detached browser checks |
| 2a | Set development Node policy and refresh CI runtime | 1 | Existing dependency graph passes on selected Node releases |
| 2b | Vitest 4.1.11 → 5.0.1 | 2a | All existing suites discovered and passing; mock/timer changes reviewed |
| 2c | jsdom 27.4.0 → 30.0.1 | 2b | DOM suites and browser behavior checks pass |
| 3 | TypeScript 7 feasibility; defer the bump while vue-tsc is incompatible | 2c; compatible SFC tooling needed | Confirmed blocker resolved before any compiler migration |
| 4 | markdown-it 14.3.2 → 15.0.2 | 2c; use TS6 if stage 3 remains blocked | Renderer and plugin compatibility, built-in types, VitePress integration |
| 5 | VueUse core/integrations 14.4.0 → 15.0.0 | 4 | Lifecycle, cookies, WebSocket, UI integration checks |
| 6 | Pinia 3.0.4 → 4.0.3 | 5 | Old/new supported consumer matrix and singleton checks |
| 7 | Unovis ts/vue 1.6.7 → 1.7.0 | 6 | Patched workspace and unpatched detached chart consumers |
| 8 | Decide ESLint 10.10.0 adoption or removal | 1 | Explicit usage decision; actual ESLint validation if retained |
| 9 | pnpm 10.34.5 → 12.4.2 | All adopted dependency stages | Frozen installation, packing, and detached consumer verification |
| 10 | Final candidate verification and consumer rollout handoff | All adopted stages | New immutable candidate, retained evidence and rollback inputs |

The numbered chain is the default order for attribution of regressions, not a claim that the runtime libraries require TypeScript 7 or each other. If a stage is blocked, continue unrelated work on the last passing baseline. Keep Vitest and jsdom in separate changes; keep pnpm last to avoid mixing resolver changes with library behavior changes.

## 0. Baseline and compatibility matrix

Record the source commit, Node/pnpm versions, manifest and lockfile hashes, exact resolved versions, audit output, and test counts. Use a clean isolated checkout with pnpm 10.34.5 and the currently pinned CI Node 24.14.0; the local machine's Node 26 is not evidence for the CI or minimum supported Node environment. Install the frozen graph and establish:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm run build:node
pnpm run check
pnpm audit --audit-level=high
```

`check` includes typechecks and all package suites. Candidate packing and detached consumer verification provide the artifact-level checks. Do not add duplicate test runs without a changed graph or an unresolved failure.

Verify availability and integrity of the exact external releases. If UI Kit 0.1.4 is unavailable, use only the existing authenticated transport workflow described in [release-policy.md](release-policy.md), retaining/restoring the canonical lockfile and workspace files. Do not substitute arbitrary tarballs or relax integrity checks.

Extend `scripts/verify-archive-consumers.mjs` to select explicit named dependency profiles. Today it pins TypeScript 6.0.3, Pinia 3.0.4, pnpm 10.34.5 and several older Vite/plugin versions, so changing workspace manifests does not exercise upgraded consumers. Retain the current profile where support is claimed and add a migration-target profile as each stage lands. Record the actual resolved versions with each profile's results, and run each supported profile under both npm and pnpm. Keep Vue/compiler/server-renderer versions aligned.

The matrix must exercise source SFC typechecking with its existing negative public-prop witness, browser production builds, SSR, four Node helper imports, CSS/assets, and Vue/Pinia/router singleton resolution. Add chart and stateful Pinia/SSR fixtures where the existing generic fixture lacks that behavior. Add focused behavioral coverage for specific migration risks, not tests that merely assert version strings.

## 1. Small updates

Apply `@vitejs/plugin-vue` 6.0.8 → 6.0.9, `@vue/test-utils` 2.5.0 → 2.5.1, `@lucide/vue` 1.45.0 → 1.46.0, Prettier 3.9.5 → 3.9.7, and ESLint 9.39.4 → 9.39.5. Patch the existing Node type lines separately: 24.13.4 → 24.13.5 and 25.9.6 → 25.9.7. Do not select `@types/node` by the mutable `latest` tag or silently change its major; record the existing mixed-major policy for later alignment with supported runtimes.

Use a separate change for Playwright 1.61.1 → 1.63.0. Install its matching Chromium (`pnpm exec playwright install --with-deps chromium` in Linux CI), then rerun detached browser evidence. Avoid unrelated format rewrites while upgrading Prettier.

Update affected manifests/catalog entries and the lockfile together. Some catalog entries are unused because packages declare explicit ranges; inspect every affected package rather than assuming a catalog edit propagates. Preserve security overrides unless a fresh resolved-graph audit and upstream fixes justify removing one.

## 2. Node, Vitest and DOM tooling

### Development runtime

The user selected Node 24 only. Require `^24.21.0` in the private root and all seven published packages, pin `.node-version` and CI to 24.21.0, and align direct Node declarations to 24.13.5. Verify the workspace, packed Node helpers and detached consumers on that runtime. This explicitly replaces the original Node 22 compatibility requirement and is a documented consumer requirement change.

### Vitest 5

Update the root exact pin and catalog to 5.0.1. Keep Vite explicit and inspect all package Vitest configs, `invest-features/vite.config.ts`, setup files and environment annotations. The [v5 migration guide](https://vitest.dev/guide/migration/) changes mock-history clearing defaults and rejects nested hoisted mock calls. Inspect module/beforeAll mocks, `vi.mock`/`vi.hoisted` placement, test filtering and config inheritance if used. Preserve intended assertions rather than adding blanket exclusions. Compare discovered test counts with baseline; investigate every disappeared or skipped suite. Exercise timers, WebSocket teardown and native-push teardown under the existing Node flags.

### jsdom 30

Upgrade after Vitest is green with jsdom 27. Keep happy-dom unchanged. Exercise shell/features suites and jsdom-annotated runtime/widgets tests, including authentication navigation, cookies/storage, focus behavior, tooltips, events and SSR/hydration. Review DOM/snapshot differences individually and compare browser behavior where mocks cannot establish correctness. Audit the newly resolved Undici graph; the existing override only covers affected Undici 7 versions and does not pin Undici 8.

## 3. TypeScript 7 — deferred on verified tooling incompatibility

Keep TypeScript 6.0.3 for the executable migration sequence. Independent inspection of the published vue-tsc 3.3.11 tarball found that `index.js` defaults to `require.resolve('typescript/lib/tsc')`. TypeScript 7.0.2's package export map does not expose that subpath, even though a `lib/tsc.js` file exists in the archive. A direct version bump therefore breaks the current SFC compiler entry point. Broad peer ranges and [Vue language-tools release notes](https://github.com/vuejs/language-tools/releases) do not override the shipped artifact contract. Sources: [vue-tsc 3.3.11 metadata and tarball locator](https://registry.npmjs.org/vue-tsc/3.3.11), [TypeScript 7.0.2 export map](https://registry.npmjs.org/typescript/7.0.2).

The author also reproduced `ERR_PACKAGE_PATH_NOT_EXPORTED` using Node's resolver with the published TypeScript 7.0.2 manifest and compiler entry file in a temporary directory. No package code was executed for this resolution check.

Reopen only when a released SFC compiler supports the native TypeScript 7 interface and passes a minimal positive/negative SFC typecheck on Linux and macOS, or after a separately reviewed dual-compiler design explicitly keeps TS6 for Vue. Do not bypass exports with internal absolute paths or remove SFC checking. A dual-compiler setup must identify which compiler validates each package and consumer; it is not a completed repository-wide TS7 migration.

Once that entry gate passes, update root, package-specific ranges, consumer profiles and the catalog coherently, and apply the following checks.

Review `tsconfig.base.json` and every extending config for removed/deprecated options, especially `baseUrl` and `ignoreDeprecations: "6.0"`. Replace path-resolution assumptions explicitly. Verify native compiler installation/execution in Linux CI and on macOS with the existing install-script policy. Do not change generated browser/source export structure or commit generated output.

Run all `tsc` and `vue-tsc` checks, then both `tsconfig.node.json` builds. `scripts/node-build-contract.mjs` must still observe exactly the four allowed JavaScript outputs with the same condition order. Typecheck packed source with both TypeScript 6.0.3 and 7.0.2 while claiming support for both; use the target consumer profile to avoid a false pass on the old compiler only. If a public source/type requirement excludes TS6, document the new consumer requirement and remove the old support claim only with evidence.

## 4. Markdown

Upgrade both invest-core and invest-features. Version 15 ships its own declarations: remove their direct `@types/markdown-it` dependencies after verifying public `tableWrap` types, rather than mixing declarations. The [upstream changelog](https://github.com/markdown-it/markdown-it/blob/master/CHANGELOG.md) also removes internal subpath exports and changes linkification behavior. Search workspace and relevant host/plugin integrations for `markdown-it/lib/*` imports and renderer assumptions.

Verify `invest-core/markdown/tableWrap` from both TypeScript and its packed Node export. Exercise offer description/highlights/risk text, tables, code, entities, links, image URLs and the existing signed-image query cleanup. `useOffersDetailsContent.ts` has `@ts-nocheck`, so passing typechecks alone is insufficient. Add missing rendering regression cases against real Markdown output.

Keep VitePress 1.6.4 and its scoped Vite 6.4.3 override until a separate VitePress migration is justified. Validate passing the exported table plugin to the VitePress-owned Markdown instance, including type compatibility between v14 and v15 where present. Do not force all transitive Markdown copies onto v15. Coordinate external Markdown/toolkit owners if their plugin interface blocks compatibility.

## 5. VueUse

Upgrade core and integrations together to 15.0.0, including explicit package ranges and catalog entries. Review the v15 upstream migration/release notes before implementation; registry metadata is verified, but a complete v15 behavior review remains an entry condition. Current metadata requires Node >=22 and Vue ^3.5.0, which fit the intended environment.

Verify cookies and reset/logout behavior (`useCookies`), WebSocket connection/reconnect/disposal, lifecycle cleanup, breakpoints, clipboard, mounted state, and SSR. External UI Kit 0.1.4 and UI Primitives 0.1.3 still depend on VueUse 14, so the graph may legitimately contain both majors. Record both resolved branches and test their shared UI behavior. Do not override those owners' dependencies to v15 or label VueUse a required singleton; coordinate a later owner release if interoperability fails.

Review the integration alias in `packages/invest-features/vitest.config.ts`, which appends `.js` to integration subpaths. Validate target package exports in both the tests and an unaliased detached consumer; remove or adapt the alias only when the public import works in each environment.

## 6. Pinia

Upgrade dev dependencies and published peer contracts for invest-runtime, invest-features and invest-shell together. Prefer retaining `^3.0.4 || ^4.0.3` only if both consumer profiles pass; otherwise use `^4.0.3`, explicitly document the break and coordinate host upgrades before adoption. Pinia is a required runtime singleton: validate one shared instance across the full seven-package consumer graph, not merely a deduplicated workspace install.

The [Pinia changelog](https://github.com/vuejs/pinia/blob/v4.0.3/packages/pinia/CHANGELOG.md) includes removal of CJS support, devtools becoming a peer and hydration changes. Check devtools peer requirements, ESM/SSR loading, per-request store isolation, state hydration, logout/reset, subscriptions and HMR. Exercise session/profile stores, notification state, wallet state and repository lifecycle. The current detached fixture installs the dependency but does not register Pinia on its Vue app; extend it with a real Pinia-backed component and SSR round trip before claiming this gate passes.

Review the same features Vitest config's hardcoded `node_modules/pinia/dist/pinia.mjs` alias. Verify the target distribution path and prefer a supported public resolution when possible. A passing aliased workspace test does not prove that consumers resolve the new public exports correctly.

## 7. Unovis

Treat both packages as one atomic change to 1.7.0. Inventory why each patch exists, compare new upstream exports, and either remove the patches with evidence or rebase the required edits. Update `patchedDependencies`, patch paths, version-scoped MapLibre exclusion, lockfile patch metadata, and raw SHA-256 entries in `docs/source-reconciliation.json`. Verify any retained raw file digests directly before candidate packing; they are not interchangeable with pnpm's patch identifiers.

Workspace patch success is insufficient: pnpm patches and overrides do not automatically travel inside published framework manifests. Detached npm and pnpm consumers must import and render actual area/donut charts, legends, tooltips and crosshairs against the naturally installed upstream graph, without copied workspace patches or exclusion overrides. Check browser bundling, SSR import/render, declarations, console errors and the resulting MapLibre branch. Compare bundle/graph changes against baseline.

If published consumers fail without the workspace patches, block this migration until an upstream release or supported public import strategy fixes it. Do not certify it by adding hidden consumer patch requirements. Retain the 1.6.7 baseline and record any pre-existing consumer defect separately if the baseline also fails.

## 8. ESLint

First establish whether ESLint is used outside the declared scripts (developer tooling or consumer release contracts). No ESLint config or ESLint invocation was found in this repository; `pnpm run lint` is not evidence of ESLint compatibility. If unused, remove the direct dependency in a separate cleanup change. If retained, specify its actual config and command, migrate them using the [ESLint 10 guide](https://eslint.org/docs/latest/use/migrate-to-10.0.0), and run that command. Do not introduce a new lint policy or large unrelated fixes as an incidental version bump. Staying on the patched v9 baseline is an acceptable documented deferral.

## 9. pnpm

Recheck the official v11/v12 release and migration notes before implementation. Test 10 → 12 directly in an isolated checkout; if a lockfile transition requires v11, use a pinned intermediate version and retain both diffs. Do not assume compatibility based on package `engines` metadata.

Update all eight `packageManager` fields, the root pnpm engine policy, both relevant workflow setup paths, generated detached consumer manifests, and documentation as one coordinated change. Search for all remaining 10.34.5 references, preserving intentional historical records.

Inspect changes to lockfile schema, peer resolution, catalog publication rewriting, patches, overrides, install-script approval behavior, Corepack bootstrapping and pack output. Preserve the existing `--ignore-scripts` policy in release and detached-consumer installs; invoke required tools such as Playwright's browser installer explicitly. Run a fresh frozen installation, archive checks, and both detached package-manager profiles against the published dependency graph.

## Per-stage acceptance and final release handoff

For each stage retain a reviewable manifest/catalog/lockfile diff, migration source links, exact toolchain versions and successful relevant checks. After changing the graph, run the baseline command group once; stage-specific focused checks supplement it. A failed gate is fixed or explicitly blocks that stage. Do not waive failed tests, peer conflicts, lost suites, changed integrity, duplicate runtime singletons or missing public exports.

Changes to published package bytes require a new candidate identity under [release-policy.md](release-policy.md). Before packing changed candidates, choose an unused version and update all seven versions, the root version, reconciliation, script/workflow defaults, active release docs and version-coupled tests coherently. Candidate packing must reject a manifest or reconciliation version mismatch. Search active references to 0.2.3; retain historical provenance and source revisions unchanged. Do not overwrite a retained 0.2.3 archive or assume a fresh output directory permits reuse of reviewed version bytes. Failed or changed packed candidates receive another new version.

When a stage needs detached consumer evidence, create a fresh local candidate under that policy and retain it as non-promotable development evidence; local probes may omit the clean-source requirement and must be labelled accordingly. Final release verification uses the accepted clean commit and enforces `REQUIRE_CLEAN_SOURCE=true`. `pack:candidate` owns cleanup, its one Node build and its internal full check; do not prebuild solely for that packing run. Preserve its exact four-file output contract and seven-package order.

After assigning `MIGRATION_CANDIDATE` to the reviewed new version and `MIGRATION_ARTIFACTS` to an unused output path, the public-registry verification path is:

```sh
pnpm audit --audit-level=high
REQUIRE_CLEAN_SOURCE=true CANDIDATE_OUTPUT_DIR="$MIGRATION_ARTIFACTS" pnpm run pack:candidate -- "$MIGRATION_CANDIDATE"
pnpm exec playwright install --with-deps chromium
CONSUMER_PACKAGE_MANAGERS=npm,pnpm node scripts/verify-archive-consumers.mjs "$MIGRATION_ARTIFACTS"
```

Run the detached command for every supported profile once profile selection is implemented; its exact CLI must be documented in that change. It already invokes the release-bundle verifier.

Keep receipts, tarballs, lockfiles, toolchain metadata, browser reports/screenshots and the last known-good application artifacts. Runtime migration acceptance also requires an identified consuming application's install/build/typecheck/SSR and relevant auth/profile/offer/chart smoke results; the host repository and credentials are implementation inputs, not available evidence from this planning task. No host verification is claimed until supplied and run.

Roll out the complete seven-package set in dependency order: domain-types, invest-core, invest-data, invest-runtime, invest-widgets, invest-features, invest-shell. If adoption fails, restore the previous complete consumer lockfile and retained application artifact; do not mix package generations or rebuild old release bytes. Before publication, the existing maintainer release process still applies.

## Independent review record

An independent read-only reviewer inspected repository contracts, checked target registry metadata, inspected the published compiler tarballs, and reviewed the draft. The author separately inspected those compiler tarballs and corrected the plan. Findings were addressed as follows:

| Finding | Resolution |
| --- | --- |
| TS7 cannot satisfy vue-tsc's shipped compiler entry point | Stage 3 explicitly deferred; TS6 remains the executable baseline; compatible tooling is a reopening gate |
| Detached fixtures would keep testing old versions | Stage 0 requires explicit supported-old/target profiles with resolved-version evidence under npm and pnpm |
| Unovis workspace patches do not reach published consumers | Stage 7 requires actual unpatched detached chart behavior and blocks on failure |
| Patch file hashes are independently enforced | Stage 7 updates reconciliation SHA-256 records along with pnpm patch metadata |
| Pinia/VueUse test aliases can hide broken public exports | Stages 5–6 inspect aliases and test unaliased consumer resolution |
| External UI packages still depend on VueUse 14 | Stage 5 records both branches, tests integration, and forbids forcing upstream dependencies to v15 |
| jsdom's engine range is stricter than both root and CI | Stage 2 separates development engines from tested published runtime support |
| ESLint is not run by the lint script | Stage 8 requires a use/remove decision and real validation if retained |
| pnpm migration risks install policy and authenticated overlay contracts | Stage 9 retains ignored lifecycle scripts and tests overlay, linking, recovery and packing contracts |
| Changed/failed candidates cannot reuse reviewed versions | Acceptance rules require new identities, preserve old bytes, and candidate packing enforces the reviewed version |
| Final pack command allowed dirty source by default | Final command now enforces `REQUIRE_CLEAN_SOURCE=true`; local probes are separately labelled |

Final independent re-review completed with no remaining material plan issues. Plan review verifies instructions and coverage; it does not establish that any proposed upgrade passes its implementation gates. No target-version application suites were run during planning.
