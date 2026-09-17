# Torque framework packages

This repository is the independent source workspace for the seven investment
framework packages under the `@global-torque` namespace. The workspace root
is private; each package is an independently reviewed MIT package candidate.

The current candidate is `0.3.0` for all seven packages. It is source based:
published files contain the explicit `src` exports and the host application
provides the Vue/Vite toolchain and singleton peers. The candidate is local and
non-promotable until the primary maintainer completes the accepted release
gates. Dispatch the candidate workflow from the matching
`framework-v0.3.0` tag when producing attestations. The previously reviewed
`framework-v0.2.2` source tag, commit, and immutable artifacts remain
retained as history; no canonical `0.2.0` package artifacts were produced.

Development and package consumption require Node `^24.21.0`; `.node-version`
and CI pin 24.21.0. Bootstrap pnpm with `corepack enable` and
`corepack prepare pnpm@12.4.2 --activate`, then run
`pnpm install --frozen-lockfile --ignore-scripts`. TypeScript remains 6.0.3;
TypeScript 7 is deferred until vue-tsc supports its compiler entry point.

CI runs on pull requests and pushes to `master` using Node 24.21.0. It runs
`pnpm run build:node`, `pnpm run check` (package and consumer-link tests), and
`pnpm run test:release`. Typechecks, audits, boundary/runtime dependency/packlist
checks, and detached browser/consumer verification remain available locally
but are not CI gates. The manual release workflow builds and tests before
packing and retaining the candidate artifacts.

This release combines the dependency migration from the retained 0.2.3 baseline,
the 0.2.4 dropdown navigation fix, and the merged role-colour updates.
See [migration results](docs/dependency-migration-results.md) for the supported
Pinia 3/4 consumer matrix, verification evidence and release handoff items.

The package graph is dependency first:

`domain-types -> invest-core -> invest-data -> invest-runtime -> invest-widgets -> invest-features -> invest-shell`

`invest-widgets` is a provider driven Vue package consumed by features and the
shell. Generic UI, SDK, design token, content and error packages remain owned
by their existing public repositories and are installed as exact external
artifacts. No source from those repositories is copied here.

## Local consumer framework links

Run the consumer-owned launcher from the root of the consumer checkout. It
loads the transactional link tool from this repository and keeps local links
out of the consumer's committed manifests and lockfile:

```sh
cd /absolute/path/to/consumer
pnpm framework:link --framework-root /absolute/path/to/torque-packages
pnpm framework:status
pnpm framework:recover
pnpm framework:unlink
```

For direct tool use from the consumer root, invoke the canonical script with
both roots explicit:

```sh
node /absolute/path/to/torque-packages/scripts/consumer-links.mjs link \
  --consumer-root "$PWD" \
  --framework-root /absolute/path/to/torque-packages
```

Local links are development evidence only. Remove them and run the consumer's
normal frozen install before CI, release, or deployment checks. The complete
transaction, recovery, and Vite integration contract is documented in
[`docs/consumer-framework-links.md`](docs/consumer-framework-links.md).

The four pure configuration helpers used by static Node/VitePress setup also
have an exact Node condition: `invest-core/app/config`,
`invest-core/markdown/tableWrap`, `invest-core/helpers/text`, and
`invest-runtime/pwa/pwaPolicy` resolve to generated `dist/node` JavaScript in
plain Node while browser bundlers and TypeScript continue to use the source
entries. The Node build compiles only those four entries once during candidate
packing; generated output is ignored and is never a source of browser SFCs.
`pnpm run pack:candidate` rejects an ineligible candidate or existing output
directory before cleanup, removes only the two owned `dist/node` directories,
runs this build once, runs package and consumer-link tests, revalidates the
four-file inventory, and then packs all seven packages.

After `@global-torque/ui-kit@0.1.4` is available from its owning release, run
`pnpm install --frozen-lockfile`, then `pnpm run build:node` followed by
`pnpm run check`. Before that release,
the framework candidate workflow accepts the framework repository's draft
`ui-kit-transport-v0.1.4` release, downloads its six exact transport assets with
the repository token, and verifies the UI archive against its source tag,
commit, hosted run, and raw Sigstore bundle (including `gh attestation verify
--bundle`). It temporarily installs that verified tarball, checks the derived lockfile against the committed canonical
lockfile, restores the canonical files, and keeps the framework manifest and
lockfile pinned to public `0.1.4`.

Optional local detached npm and pnpm verification requires Chromium and its
checked system dependencies:

```sh
pnpm exec playwright install --with-deps chromium
CONSUMER_PACKAGE_MANAGERS=npm,pnpm node scripts/verify-archive-consumers.mjs artifacts
```

When the authenticated UI Kit transport is selected, pass its archive as the
second argument:

```sh
CONSUMER_PACKAGE_MANAGERS=npm,pnpm node scripts/verify-archive-consumers.mjs \
  artifacts "$UI_KIT_TRANSPORT_DIR/global-torque-ui-kit-0.1.4.tgz"
```

The script saves each manager's report, screenshots, and failure diagnostics
under `$RUNNER_TEMP/torque-framework-consumer-evidence/npm/` and
`$RUNNER_TEMP/torque-framework-consumer-evidence/pnpm/`. These optional checks
and their evidence uploads are not part of CI.

`pnpm run pack:candidate` creates
one local immutable receipt and one tarball per package under `artifacts/` for
review. It does not publish, upload, tag, or deploy anything.

`pnpm run test:release` exercises the workflow contract with disposable
archives and a local `gh` stub, including rejected broken exports, missing and
unexpected files, unresolved workspace protocols, bad release metadata, and
tampered or empty UI transport inputs.
