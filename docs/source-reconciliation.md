# Source and release reconciliation

The `0.4.14` candidate reissues the seven-package cohort with the cumulative
0.4.13 analytics, feature, shell, and runtime changes, then reduces the
read-only redemption lifecycle contract to its returned status, amount, and
timestamp fields. Display and operation payload types and parsers are removed
without compatibility aliases. The completed `invest-shell` token-absent
geometry recovery, inverse-footer token fallback, shadow, PWA login fallback,
and semantic header/offer control-shadow contract remain retained.
The breaking stablecoin
redemption contract, including the final `price_update` removal, remains
unchanged from the retained `0.4.0` source. It also retains the
the dependency-migrated framework cohort with selective analytics/request
sanitization, stable demo-account configuration capture, and local Vite UI peer
exclusions. The accepted `0.2.3` framework SFC
baseline, 0.2.4 dropdown fix, and role-colour changes merged in 381ad2f remain
retained. Node 24 is required; external package pins and source exports are
preserved. See [migration results](dependency-migration-results.md). Its
transferred baseline is from
`global-torque/dashboard.webdevelop.biz@9f35aa0882b765e202538ce7c7d5e82eb1b452d3`.
The SFC fixes are reconciled from
`global-torque/webdevelop-platform@20d96220b2a0f3d7cb5d4fa6f5088d9dd45aff1e`,
and the prior `0.2.2` candidate and its immutable artifacts remain retained.
The seven framework packages are the only source owned by this repository.
The exact package matrix, external pins, patch hashes, dependency order,
intermediate compatibility, abort signals, and recovery rule are recorded in
[`source-reconciliation.json`](./source-reconciliation.json).

The candidate consumes the authenticated external
`@global-torque/design-tokens@0.3.0` archive for producer development. Its
exact SRI, archive digest, archive inventory digest, source commit/tag and npm
publish/SLSA attestations are bound in
[`source-reconciliation.json`](./source-reconciliation.json) and must be
retained with candidate evidence. The compatibility matrix also binds the
verified `0.2.1` archive, source tag/commit, SRI, inventory and attestation
digest used by the consumer parity gate, plus the absent-token fallback case.
These archives are external inputs; the framework repository never republishes
them.

The compatibility checks retain all three named modes and are recorded in the
candidate's native release evidence; no custom receipt is generated. Run the
detached verifier with
`CONSUMER_TOKEN_MODE=absent` and no token archive, with
`CONSUMER_TOKEN_MODE=0.2.1 DESIGN_TOKENS_ARCHIVE=<the reviewed 0.2.1 archive>`,
and with `CONSUMER_TOKEN_MODE=0.3.0` plus the reviewed 0.3.0 archive (or its
public registry version). Each mode runs the same static, Chromium, packed
consumer, and SSR checks; an absent mode must not install or import the token
package.

The framework candidate using the public `@global-torque/ui-kit@0.1.4`
dependency produces exactly eight native GitHub Release assets: seven
dependency-ordered package `.tgz` archives and `browser-contract-report.json`.
Only the seven package archives are GitHub-attested; the browser contract report
is retained as release evidence and is not attested. The published registry
dependency is installed from the frozen lockfile.

The package owner is responsible for pure domain contracts and investment
framework behavior. Generic UI, SDK, token, content, Markdown, and error
packages remain external public dependencies owned by their existing
repositories. `@global-torque/ui-kit@0.1.4` is a selected candidate from
`global-torque/vue-ui`; the framework workspace never copies its source.

Asset audit remains a release gate. The pinned producer's
`packages/brand-assets/README.md` describes the logo files as shared imagery
for the private invest surface and marketing site and provides no MIT or
trademark grant. Those logo files are excluded from the framework packages.
`VLogo.vue` resolves host CSS variables (`--ui-brand-logo`,
`--ui-brand-logo-reversed`, and `--ui-brand-mark`) for the header, PWA header,
and loader; `VHeader` also exposes a host `logo` slot. The dormant comment
reply logo was removed. Host configuration therefore supplies the brand bytes
and the package does not claim redistribution rights for private brand assets.
The complete 105-path initial audit, retained 81-path candidate inventory,
producer path mapping, host-owned third-party mark transfer, and FW07 removals
are recorded in [`asset-inventory.md`](./asset-inventory.md).

Release packing is dependency first. A pushed `framework-vX.Y.Z` tag runs the
frozen install, package checks, and Node build; installs Chromium; runs the
browser contract and writes `browser-contract-report.json`; packs each package
once with `pnpm pack`; runs `test:release-archives` and the packed-archive
validator; attests only the seven package tarballs; and creates a native
GitHub Release containing those seven archives plus the browser report. A
failed or changed release receives a new version and tag. The prior
`framework-v0.2.0` source tag, commit, and failed-run diagnostic history remain
retained as history; that run failed before installation, build, or packing,
so no canonical `0.2.0` package artifacts or rollback proof exist.

The immutable `framework-v0.4.1` tag remains retained as an abandoned
candidate. It points to annotated tag object
`afb71838354e0208681fe5c8a38970564bf262d4`, peeled commit
`044a019d4ada61a1dba7245d0fedb288973c0b88`, and failed candidate runs
`35539361132` and `35539386904` because Chromium was not installed before the
Invest Shell browser contract. No GitHub release or npm `0.4.1` package exists;
the tag is never moved, deleted, or reused. Candidate `0.4.2` was superseded
before publication by the accepted CSS-contract recovery. It points to tag
object `78eabe922bfe704eb60848722f27496917d94b64`, peeled commit
`775532c37599f34f6ef3c929d7d033605dafb309`, and successful candidate run
`35540413330`; no GitHub release or npm package exists. The tag is never moved,
deleted, or reused. Candidate `0.4.3` is also abandoned after its successful
candidate run; it
points to tag object `d2def7e456f4e9fe7506e568b4c2d4eb1527a280`, peeled commit
`1bf1fe05171ba370df506cb3e475775ce765e220`, and run `35544840055`. No GitHub
release or npm package exists. The tag is never moved, deleted, or reused.
Candidate `0.4.4` was superseded before publication after its visual gate
exposed a token-cohort footer difference. Its immutable tag and successful
candidate evidence remain retained; no GitHub release or npm package exists.
Candidate `0.4.5` is also abandoned after its required 0.4.0 plus
design-tokens 0.2.1 visual parity gate exposed framework geometry fallback
differences. Its immutable tag points to tag object
`ccb001fca49fe95b08899417137775fb9fdbf005`, peeled commit
`cf8002b4ec4316914c952821bd4003fd5ce8ec5e`, and successful candidate run
`35552606823`; no GitHub release or npm package exists. The tag is never moved,
deleted, or reused. Candidate `0.4.6` is also abandoned after its required PWA login visual parity
gate exposed a fixed accent fallback in the Investor mobile header. Its
immutable tag points to tag object
`e40f300b714cc016c9537aa01d49d75171452b6e`, peeled commit
`fbef60352484263e3723c6609e4d979c8627d128`, and candidate run
`35555965922`; no GitHub release or npm package exists. The tag is never
moved, deleted, or reused.
Candidate `0.4.7` is also abandoned after authenticated Platform desktop
visual parity exposed invisible footer disclosure and copyright text. Its
immutable tag points to tag object
`5741d64dc590a631ab7f54da1a4b19e7c91f0123`, peeled commit
`b60c4ec7ef46ee29d83d201fc381977c30279e1c`, and successful candidate run
`35562211887`; no GitHub release or npm package exists and the tag is never
moved, deleted, or reused. Candidate `0.4.8` is abandoned after the required
public Investor mobile offer parity gate on `/tahoe-e2e-fund-766pk7` found 2
differing pixels / 4 channel-level deltas in the offer-card shadow; source
review found the same fallback defect in `VHeaderBar`. Its immutable tag
points to tag object
`a0822cde56b6f266687e5c2bfe820b5668963851`, peeled commit
`e18d59ced772fe868703e452df30b07c6887e4c9`, and candidate run
`35565129065`; no GitHub release or npm package exists and the tag is never
moved, deleted, or reused. Candidate `0.4.9` is abandoned because its
immutable release ledger misstated public evidence as authenticated and
conflated the observed offer-card difference with the inferred `VHeaderBar`
sibling. Its tag object is
`f27b758babff4d270c46bbd7d22cf7f9a4626792`, peeled commit
`46d035c8d8eb604fd14007e121e192aee60c8e9a`, candidate run `35570182365`, and
candidate artifact `10625980830`; no GitHub release or npm package exists and
the tag is never moved, deleted, or reused. Candidate `0.4.10` is abandoned
because the absent-token npm path passed, but the corresponding pnpm
strict-layout path failed with `ENOENT` for an undeclared sibling package. The
0.2.1 and 0.3.0 paths did not run. Its tag object is
`ffe335f89e9be5101a2ee5bdf428218126890193`, peeled commit
`7650c04a5173e4fd644146771829ff252bb2eae7`, candidate run `35571502342`, and
candidate artifact `10626585626`; no GitHub release or npm package exists and
the tag is never moved, deleted, or reused. Candidate `0.4.11` is abandoned
because CI run `35574140527` and candidate run `35574298182` launched the
browser contract before Playwright/dependency installation. The dedicated
CSS-browser job passed, but no hosted candidate artifact was produced. Its tag
object is `3394c545ea6ff3d5cd677fb66b9d369ad952f6c6`, peeled commit
`8841e200282ed93d9f4a90ee5231a2ff716cb392`; no GitHub release or npm package
exists and the tag is never moved, deleted, or reused. Its immutable tagged
source ledger also paired `global-torque/dashboard.webdevelop.biz` with the
`torque-packages` source revision
`82fe93868d28682211ea21867badcdeb85879970`; no artifact or receipt escaped
because the candidate failed. The immutable `framework-v0.4.13` release at
source commit `7d86d208e32967f177f881ae7ad78d382ca3534f` completed its GitHub
Release but was superseded before npm rollout when the redemption list contract
changed; `npmPublished` is false and its tag, release bytes, and attestations
are never moved, reused, or repacked. Candidate `0.4.14` is the new immutable
release identity; its active candidate and package matrix are finalized when
the candidate commit is tagged. The `sourceRevision` fields retain upstream
provenance for the transferred source and are not rewritten as release tags
are created.
