# Agent guidance for Torque framework packages

This private pnpm workspace is the source repository for seven independently reviewed public MIT packages under `@global-torque`: `domain-types`, `invest-core`, `invest-data`, `invest-runtime`, `invest-widgets`, `invest-features`, and `invest-shell`. The root is not publishable; package READMEs, manifests, exports, tests, and workflows are the authoritative contracts.

## Ownership and dependency direction

The package graph is intentionally acyclic and dependency-first:

`domain-types -> invest-core -> invest-data -> invest-runtime -> invest-widgets -> invest-features -> invest-shell`

- `domain-types` owns pure DTOs, constants, and cross-runtime contracts.
- `invest-core` owns deterministic policy, calculations, formatters, normalization, and validation helpers.
- `invest-data` owns framework-free clients, endpoint factories, service contracts, error normalization, and repository-state helpers.
- `invest-runtime` owns browser/native lifecycle, session/PWA/analytics/error services, runtime installation, and injected adapters/configuration.
- `invest-widgets` owns provider-driven reusable Vue widgets; hosts provide stores, navigation, dialogs, data, runtime behavior, and icons.
- `invest-features` owns stable app-facing reusable domain features, ViewModels, stores, composables, and feature APIs; route-level pages remain in apps.
- `invest-shell` owns the shared app shell, navigation/config facades, PWA bridge, reusable shell components, and global investment styles; final route tables, pages, redirects, environment mapping, and app adapters remain in apps.

Preserve this direction and use existing repositories/adapters. Do not add reverse dependencies, app imports, direct `import.meta.env` reads, the retired `invest-common`/compatibility aliases, wildcard or private deep imports, undeclared public paths, backend proxies, or alternate service URLs. Generic UI, SDK, design-token, content, and error packages remain external owners. Runtime and feature state must retain explicit providers/adapters, appropriate lifetimes, async loading/error/reset behavior, cleanup, and SSR/browser safety.

## Public API and generated files

Packages are source-based: declared public entries point at `src` files. Import through manifest `exports`, not filesystem paths. A public API change must update the owning barrel/exports and relevant package `README.md` and `CHANGELOG.md`, and add the smallest meaningful behavior or invariant test when behavior changes. Do not add compatibility aliases unless explicitly requested.

The root `pnpm run build:node` generates the four Node-conditioned helpers used by plain Node/VitePress consumers: `invest-core/app/config`, `invest-core/markdown/tableWrap`, `invest-core/helpers/text`, and `invest-runtime/pwa/pwaPolicy`. Their browser and TypeScript conditions remain source entries. Treat all `dist/node` output as generated and never hand-edit it; run the build before Node-consumer or packing validation and inspect the resulting tracked diff. The three `invest-core` outputs are tracked; the `invest-runtime` output is ignored and exists for packing.

Generated evidence and build output includes `artifacts/`, general `dist/`, `coverage/`, `.vite/`, and `*.tsbuildinfo`; do not hand-edit or retain incidental generated changes. The package `files` fields and manifests define what can be packed.

Consumers may resolve npm artifacts or immutable Git-subpath revisions rather than this workspace. For package-boundary changes, validate the actual resolved artifact/revision (including packed tarballs where appropriate), not only a local workspace link. Keep source changes, releases, and consumer rollouts separate.

## Validation

Tests are colocated below `src` as `__tests__`, `*.test.*`, or `*.spec.*`. Start narrow for the affected package:

```sh
pnpm --filter <package-name> run typecheck
pnpm --filter <package-name> run test:run
```

When Node-conditioned entries or package boundaries are affected, run `pnpm run build:node`, inspect generated diffs, and then run `pnpm run check` for cross-package typechecks and tests. The root has no lint script; do not invent one. For shell CSS/browser changes, install Chromium with `pnpm exec playwright install --with-deps chromium`, then run `pnpm --filter @global-torque/invest-shell run test:css-browser` in addition to its built-in CSS checks in `test:run`. CSS budget/token/fallback changes require measured justification and consumer visual verification.

For docs-only instruction changes, use focused diff/path/link/command checks; a full app or package test run is unnecessary unless factual uncertainty requires it. Report checks as PASS, FAIL, BLOCKED, or NOT RUN with the command, target, evidence, and any gap.

## Release instructions

When updating a Torque package Git commit, tag, or registry version, update every declaration of that package in the app manifests and pnpm-workspace.yaml, including direct dependencies and parent>child overrides. Do not change all seven packages merely to make their hashes match; update other packages when their public APIs require a coordinated release. Regenerate pnpm-lock.yaml with pnpm—never edit it by hand—and check that each Torque package has one intended source resolution. Multiple lockfile snapshots caused by peer dependencies are acceptable. Run the relevant typechecks and build with the new lockfile.