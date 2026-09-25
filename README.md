# Torque framework packages

This repository is the independent source workspace for the seven investment
framework packages under the `@global-torque` namespace. The workspace root
is private; each package is an independently reviewed MIT package candidate.

The current candidate is `0.4.13` for all seven packages. It is source based:
published files contain the explicit `src` exports and the host application
provides the Vue/Vite toolchain and singleton peers. The candidate is local and
non-promotable until the primary maintainer completes the accepted release
gates. Push the matching `framework-v0.4.13` tag to run the release workflow
and produce the GitHub Release and attestations. The previously reviewed
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
The immutable `framework-v0.4.8` candidate was also superseded before
publication after the required public Investor mobile offer parity gate on
`/tahoe-e2e-fund-766pk7` found 2 differing pixels / 4 channel-level deltas in
the offer-card shadow; source review found the same fallback defect in
`VHeaderBar`. Its tag object is
`a0822cde56b6f266687e5c2bfe820b5668963851`, peeled commit
`e18d59ced772fe868703e452df30b07c6887e4c9`, and candidate run
`35565129065`; it has no GitHub release or npm publication and the tag is
never moved, deleted, or reused.
The immutable `framework-v0.4.9` candidate was also superseded before
publication because its immutable release ledger misstated public evidence as
authenticated and conflated the observed offer-card difference with the
inferred `VHeaderBar` sibling. Its tag object is
`f27b758babff4d270c46bbd7d22cf7f9a4626792`, peeled commit
`46d035c8d8eb604fd14007e121e192aee60c8e9a`, candidate run `35570182365`,
and candidate artifact `10625980830`; it has no GitHub release or npm
publication and the tag is never moved, deleted, or reused.
The immutable `framework-v0.4.10` candidate was also superseded before
publication because the absent-token npm path passed, but the corresponding
pnpm strict-layout path failed with `ENOENT` for an undeclared sibling package.
Its tag
object is `ffe335f89e9be5101a2ee5bdf428218126890193`, peeled commit
`7650c04a5173e4fd644146771829ff252bb2eae7`, candidate run `35571502342`, and
candidate artifact `10626585626`; it has no GitHub release or npm publication
and the tag is never moved, deleted, or reused.
The immutable `framework-v0.4.11` candidate was also superseded before
publication because its hosted CI run `35574140527` and candidate run
`35574298182` incorrectly launched the browser contract before the Playwright
browser/dependency installation gate. The dedicated CSS-browser job itself
passed its browser gate, but no hosted candidate artifact was produced. Its tag
object is `3394c545ea6ff3d5cd677fb66b9d369ad952f6c6`, peeled commit
`8841e200282ed93d9f4a90ee5231a2ff716cb392`; it has no GitHub release or npm
publication and the tag is never moved, deleted, or reused. The immutable
tagged source ledger also paired `global-torque/dashboard.webdevelop.biz` with
the `torque-packages` source revision
`82fe93868d28682211ea21867badcdeb85879970`; no artifact or receipt escaped
because the candidate failed.

Development and package consumption require Node `^24.21.0`; `.node-version`
and CI pin 24.21.0. Bootstrap pnpm with `corepack enable` and
`corepack prepare pnpm@12.4.2 --activate`, then run
`pnpm install --frozen-lockfile --ignore-scripts`. TypeScript remains 6.0.3;
TypeScript 7 is deferred until vue-tsc supports its compiler entry point.

CI runs on pull requests and pushes to `master` using Node 24.21.0. It runs
`pnpm run build:node` and `pnpm run check` (typechecks and package tests).
Pushing a stable `framework-vX.Y.Z` tag runs the release workflow. It requires
the root and all seven package versions to match the tag, runs the package
checks and Node builds, runs the Chromium CSS contract, packs each package with
`pnpm pack`, attests the tarballs, and creates the GitHub Release. Publication
is a separate trusted-OIDC workflow that downloads and verifies those exact
release tarballs before passing them to `npm publish --provenance`; it never
rebuilds or repacks source.

This release reissues the breaking stablecoin redemption contract and completes
the `invest-shell` token-absent geometry, token fallback, shadow, and PWA login
compatibility contract. The final
`price_update` removal remains part of the retained redemption contract. It
also restores the foreground-derived generic shadow contract, applies the
semantic control-shadow fallback to header and offer surfaces, and preserves
footer/login public-hook defaults. It
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

The four pure configuration helpers used by static Node/VitePress setup also
have an exact Node condition: `invest-core/app/config`,
`invest-core/markdown/tableWrap`, `invest-core/helpers/text`, and
`invest-runtime/pwa/pwaPolicy` resolve to generated `dist/node` JavaScript in
plain Node while browser bundlers and TypeScript continue to use the source
entries. The Node build compiles only those four entries once during candidate
packing; generated output is ignored and is never a source of browser SFCs.

The framework release uses the public `@global-torque/ui-kit@0.1.4`
dependency. Run
`pnpm install --frozen-lockfile`, then `pnpm run build:node` followed by
`pnpm run check`. The frozen lockfile supplies the published UI Kit dependency.

Create a release by pushing a matching version tag:

```sh
git tag framework-v0.4.13
git push origin framework-v0.4.13
```

Use the `Verify framework release provenance` workflow for an explicit
attestation check. Use `Publish tagged framework release to npm` only when the
tagged tarballs should also be published to npm.
