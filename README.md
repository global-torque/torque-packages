# Torque framework packages

This repository is the independent source workspace for the seven investment
framework packages under the `@global-torque` namespace. The workspace root
is private; each package is an independently reviewed MIT package candidate.

The current candidate is `0.4.8` for all seven packages. It is source based:
published files contain the explicit `src` exports and the host application
provides the Vue/Vite toolchain and singleton peers. The candidate is local and
non-promotable until the primary maintainer completes the accepted release
gates. Dispatch the candidate workflow from the matching
`framework-v0.4.8` tag when producing attestations. The previously reviewed
`framework-v0.2.2` source tag, commit, and immutable artifacts remain
retained as history; no canonical `0.2.0` package artifacts were produced.
The immutable `framework-v0.4.2` candidate was superseded before publication by
the accepted CSS-contract recovery. Its tag and successful candidate evidence
remain retained for audit; it has no GitHub release or npm publication and the
tag is never moved, deleted, or reused.
The immutable `framework-v0.4.3` candidate was also superseded before
publication by the accepted footer-role recovery. Its tag and successful
candidate evidence remain retained for audit; it has no GitHub release or npm
publication and the tag is never moved, deleted, or reused.
The immutable `framework-v0.4.4` candidate was superseded before publication
after its public Invest visual comparison exposed a token-cohort footer
difference. Its tag and successful candidate evidence remain retained for
audit; it has no GitHub release or npm publication and the tag is never moved,
deleted, or reused.
The immutable `framework-v0.4.5` candidate was also superseded before
publication after its required 0.4.0 plus design-tokens 0.2.1 visual parity
gate exposed framework geometry fallback differences. Its tag and successful
candidate evidence remain retained for audit; it has no GitHub release or npm
publication and the tag is never moved, deleted, or reused.
The immutable `framework-v0.4.6` candidate was also superseded before
publication after its required PWA login visual parity gate exposed a fixed
accent fallback in the Investor mobile header. Its tag and successful
candidate evidence remain retained for audit; it has no GitHub release or npm
publication and the tag is never moved, deleted, or reused.
The immutable `framework-v0.4.7` candidate was also superseded before
publication after its authenticated Platform desktop visual parity gate
exposed invisible footer disclosure and copyright text. Its tag and successful
candidate evidence remain retained for audit; it has no GitHub release or npm
publication and the tag is never moved, deleted, or reused.

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
packing and retaining the candidate artifacts. Publication is a separate
trusted-OIDC workflow that uses only those retained tarballs; it never
rebuilds or repacks source.

This release reissues the breaking stablecoin redemption contract and completes
the `invest-shell` token-absent geometry, token fallback, shadow, and PWA login
compatibility contract. The final
`price_update` removal remains part of the retained redemption contract. It
also restores the foreground-derived generic shadow contract, the fixed
component-local neutral fallback, and footer/login public-hook defaults. It
also reissues
the 0.3.0 cohort with selectively sanitized analytics and request diagnostics,
stable demo-account configuration capture, and local Vite exclusions for the
public UI Kit peer graph. The dependency migration, dropdown navigation fix, and
role-colour updates remain part of the retained cohort.
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

The framework candidate using the public `@global-torque/ui-kit@0.1.4`
dependency produces 22 release assets. After `@global-torque/ui-kit@0.1.4` is
available from its owning release, run
`pnpm install --frozen-lockfile`, then `pnpm run build:node` followed by
`pnpm run check`. Before that release,
the framework candidate workflow accepts the framework repository's draft
`ui-kit-transport-v0.1.4` release, downloads its six exact transport assets with
the repository token, and verifies the UI archive against its source tag,
commit, hosted run, and raw Sigstore bundle (including `gh attestation verify
--bundle`). It temporarily installs that verified tarball, checks the derived lockfile against the committed canonical
lockfile, restores the canonical files, and keeps the framework manifest and
lockfile pinned to public `0.1.4`. The authenticated path conditionally retains
four canonical and derived lock/workspace overlay files; the ordinary public path
does not add those overlays.

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
  artifacts "$UI_KIT_TRANSPORT_DIR/global-torque-ui-kit-0.1.4.tgz" \
  "$EXTERNAL_DEPENDENCIES_DIR/design-tokens-0.3.0.tgz"
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
