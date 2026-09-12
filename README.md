# Torque framework packages

This repository is the independent source workspace for the seven investment
framework packages under the `@webdevelop-pro` namespace. The workspace root
is private; each package is an independently reviewed MIT package candidate.

The current candidate is `0.2.0` for all seven packages. It is source based:
published files contain the explicit `src` exports and the host application
provides the Vue/Vite toolchain and singleton peers. The candidate is local and
non-promotable until the primary maintainer completes the accepted release
gates. Dispatch the candidate workflow from the matching
`framework-v0.2.0` tag when producing attestations.

The package graph is dependency first:

`domain-types -> invest-core -> invest-data -> invest-runtime -> invest-widgets -> invest-features -> invest-shell`

`invest-widgets` is a provider driven Vue package consumed by features and the
shell. Generic UI, SDK, design token, content and error packages remain owned
by their existing public repositories and are installed as exact external
artifacts. No source from those repositories is copied here.

The four pure configuration helpers used by static Node/VitePress setup also
have an exact Node condition: `invest-core/app/config`,
`invest-core/markdown/tableWrap`, `invest-core/helpers/text`, and
`invest-runtime/pwa/pwaPolicy` resolve to generated `dist/node` JavaScript in
plain Node while browser bundlers and TypeScript continue to use the source
entries. The Node build compiles only those four entries once during candidate
packing; generated output is ignored and is never a source of browser SFCs.
`pnpm run pack:candidate` rejects an ineligible candidate or existing output
directory before cleanup, removes only the two owned `dist/node` directories,
runs this build once, runs the full check, revalidates the four-file inventory,
and then packs all seven packages.

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

Detached npm and pnpm verification requires the checked Chromium installation:

```sh
pnpm exec playwright install --with-deps chromium
CONSUMER_PACKAGE_MANAGERS=npm,pnpm node scripts/verify-archive-consumers.mjs artifacts
```

When the authenticated UI Kit transport is selected, pass its archive as the
second argument, as the candidate workflow does:

```sh
CONSUMER_PACKAGE_MANAGERS=npm,pnpm node scripts/verify-archive-consumers.mjs \
  artifacts "$UI_KIT_TRANSPORT_DIR/global-torque-ui-kit-0.1.4.tgz"
```

The script saves each manager's report, screenshots, and failure diagnostics
under `$RUNNER_TEMP/torque-framework-consumer-evidence/npm/` and
`$RUNNER_TEMP/torque-framework-consumer-evidence/pnpm/`. The workflow retains
that evidence as a separate artifact from the candidate archives.

`pnpm run pack:candidate` creates
one local immutable receipt and one tarball per package under `artifacts/` for
review. It does not publish, upload, tag, or deploy anything.

`pnpm run test:release` exercises the workflow contract with disposable
archives and a local `gh` stub, including rejected broken exports, missing and
unexpected files, unresolved workspace protocols, bad release metadata, and
tampered or empty UI transport inputs.
