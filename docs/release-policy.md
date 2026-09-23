# Framework package release policy

Each package has explicit source exports, package files, MIT metadata, runtime
dependencies, singleton peers, and public repository metadata. The workspace
root remains private. The CI workflows pack once and retain the exact
candidate/receipt before any publication decision.
The receipt records the target repository identity and commit used by hosted
attestation as `sourceRepository`/`sourceRevision`, and the pinned producer
package identity as `sourcePackageRepository`/`sourcePackageRevision`.
The 0.4.5 compatibility matrix separately retains the verified 0.2.1 source
tag/commit, archive SRI, inventory and attestation digest used for consumer
pixel parity, together with the absent-token case.
Local extracted workspaces can emit a receipt with `sourceDirty: true` and a
null target revision; those bytes are test overlays only. The candidate
workflow requires a clean target checkout and records its full commit before
packing.

The selected `@global-torque/ui-kit@0.1.4` and
`@global-torque/design-tokens@0.3.0` dependencies are published registry
packages. Candidate creation installs them through the committed frozen
lockfile; no draft transport or derived lockfile overlay is supported.

Candidate 0.4.12 reissues the seven-package cohort with the final
`price_update` removal retained and the Invest Shell inverse-footer fallback
and shadow compatibility contract. It restores the 0.4.0 plus design-tokens
0.2.1 geometry by using reviewed CSS-wide `unset` terminals for direct
primitive aliases, with transparent overlay fallback and existing component
inherit/currentColor/transparent/none behavior. Generic shadows remain
foreground-derived for generic, header, and offer-details surfaces through the
semantic control-shadow hook, and footer/login public-hook defaults remain
intact. The retained 0.4.0 plus design-tokens 0.2.1 pair remains the source
and rollback reference. Absent-token, authenticated 0.2.1 and authenticated
0.3.0 checks are required before promotion. It also restores the PWA login
accent hook and host `--primary` fallback for both login text and its arrow
asset, preserving the 0.4.0 mobile-header pixels while retaining the 0.4.6
geometry recovery.
The reproducible detached command is
`CONSUMER_TOKEN_MODE=<absent|0.2.1|0.3.0> CONSUMER_PACKAGE_MANAGERS=npm,pnpm node scripts/verify-archive-consumers.mjs <candidate-artifacts>`;
the `absent` mode omits `DESIGN_TOKENS_ARCHIVE`, while `0.2.1` requires the
retained archive named by the compatibility matrix. The candidate receipt
copies and cryptographically binds that complete matrix, including both token
archive identities and the absent-token contract.

Local verification does not authorize publication; the external Alchemy
TypeScript peer declaration remains a documented owner handoff item in
[the migration results](dependency-migration-results.md).

The immutable `framework-v0.4.1` tag is an abandoned, retained candidate. It
points to tag object `afb71838354e0208681fe5c8a38970564bf262d4`, peeled commit
`044a019d4ada61a1dba7245d0fedb288973c0b88`, and failed runs `35539361132` and
`35539386904` because Chromium was not installed before the browser contract.
No GitHub release or npm `0.4.1` package exists; never move, delete, or reuse
that tag. The immutable `framework-v0.4.2` candidate is also abandoned. It
points to tag object `78eabe922bfe704eb60848722f27496917d94b64`, peeled commit
`775532c37599f34f6ef3c929d7d033605dafb309`, and successful candidate run
`35540413330`, but was superseded before publication by the accepted CSS
recovery. No GitHub release or npm `0.4.2` package exists; never move, delete,
or reuse that tag.
The immutable `framework-v0.4.3` candidate is also abandoned. It points to tag
object `d2def7e456f4e9fe7506e568b4c2d4eb1527a280`, peeled commit
`1bf1fe05171ba370df506cb3e475775ce765e220`, and successful candidate run
`35544840055`, but was superseded before publication by the accepted footer
role recovery. No GitHub release or npm `0.4.3` package exists; never move,
delete, or reuse that tag. The immutable `framework-v0.4.4` candidate is also
abandoned after its required visual comparison exposed a token-cohort footer
difference; no GitHub release or npm `0.4.4` package exists and its tag is
never moved, deleted, or reused. The immutable `framework-v0.4.5` candidate is
also abandoned after its required visual parity gate exposed framework geometry
fallback differences; no GitHub release or npm package exists and its tag is
never moved, deleted, or reused. The immutable
`framework-v0.4.6` candidate is also abandoned after its required PWA login
visual parity gate exposed a fixed accent fallback in the Investor mobile
header. It points to tag object
`e40f300b714cc016c9537aa01d49d75171452b6e`, peeled commit
`fbef60352484263e3723c6609e4d979c8627d128`, and candidate run
`35555965922`; no GitHub release or npm package exists and its tag is never
moved, deleted, or reused. The immutable `framework-v0.4.7` candidate is also
abandoned after its authenticated Platform desktop visual parity gate exposed
invisible footer disclosure and copyright text. It points to tag object
`5741d64dc590a631ab7f54da1a4b19e7c91f0123`, peeled commit
`b60c4ec7ef46ee29d83d201fc381977c30279e1c`, and successful candidate run
`35562211887`. No GitHub release or npm package exists and the tag is never
moved, deleted, or reused. The immutable `framework-v0.4.8` candidate is also
abandoned after the required public Investor mobile offer parity gate on
`/tahoe-e2e-fund-766pk7` found 2 differing pixels / 4 channel-level deltas in
the offer-card shadow; source review found the same fallback defect in
`VHeaderBar`. It points to
tag object `a0822cde56b6f266687e5c2bfe820b5668963851`, peeled commit
`e18d59ced772fe868703e452df30b07c6887e4c9`, and candidate run `35565129065`;
no GitHub release or npm package exists and the tag is never moved, deleted, or
reused. The immutable `framework-v0.4.9` candidate is also abandoned because
its immutable release ledger misstated public evidence as authenticated and
conflated the observed offer-card difference with the inferred `VHeaderBar`
sibling. It points to tag object
`f27b758babff4d270c46bbd7d22cf7f9a4626792`, peeled commit
`46d035c8d8eb604fd14007e121e192aee60c8e9a`, candidate run `35570182365`, and
candidate artifact `10625980830`; no GitHub release or npm package exists and
the tag is never moved, deleted, or reused. The immutable `framework-v0.4.10`
candidate is also abandoned because the absent-token npm path passed, but the
corresponding pnpm strict-layout path failed with `ENOENT` for an undeclared
sibling package. The 0.2.1 and 0.3.0 paths did not run. It points to tag object
`ffe335f89e9be5101a2ee5bdf428218126890193`, peeled commit
`7650c04a5173e4fd644146771829ff252bb2eae7`, candidate run `35571502342`, and
candidate artifact `10626585626`; no GitHub release or npm package exists and
the tag is never moved, deleted, or reused.
The immutable `framework-v0.4.11` candidate is also abandoned because CI run
`35574140527` and candidate run `35574298182` launched the browser contract
before Playwright/dependency installation. The dedicated CSS-browser job passed,
but no hosted candidate artifact was produced. Its tag object is
`3394c545ea6ff3d5cd677fb66b9d369ad952f6c6`, peeled commit
`8841e200282ed93d9f4a90ee5231a2ff716cb392`; no GitHub release or npm package
exists and the tag is never moved, deleted, or reused. Its immutable tagged
source ledger also paired `global-torque/dashboard.webdevelop.biz` with the
`torque-packages` source revision
`82fe93868d28682211ea21867badcdeb85879970`; no artifact or receipt escaped
because the candidate failed. The new ordinary immutable
release tag is `framework-v0.4.12` for the `0.4.12` candidate. Dispatch the candidate workflow
from that tag so its attestations carry `refs/tags/framework-v0.4.12`. The prior
`framework-v0.2.2`
source tag, commit, and immutable artifact history remain retained for audit;
its package bytes and provenance are not replaced. The earlier
`framework-v0.2.0` run failed before installation, build, or packing; no
canonical `0.2.0` package artifacts or rollback proof exist. The provenance
workflow requires that stable tag to resolve to the exact clean candidate
commit, the candidate workflow run to be completed successfully, and the release
to contain exactly the seven archives, their
sidecars, and the combined receipt. When the authenticated transport path is
selected, its six canonical UI Kit transport files and four retained
lock/workspace overlay files are included as conditional release evidence.
The ordinary candidate using the public UI Kit dependency therefore produces
23 release assets including the browser contract report; the authenticated transport path conditionally supplies six
UI Kit assets and retains the four lock/workspace overlay files.
Before attestation, the candidate workflow builds the Node helpers and runs
package, consumer-link, and release contract tests on Node 24. Detached npm
and pnpm consumer verification is an optional local check; audits, typechecks,
and standalone source policy checks are not CI gates.

The release workflow does not publish npm packages, create tags, deploy apps,
or promote ordinary releases. The provenance workflow accepts a retained CI
candidate run, verifies every receipt digest, and creates signed npm package
identity attestations using GitHub hosted OIDC. The separate manual
`.github/workflows/publish.yml` workflow is the only publication path. It
downloads and verifies the immutable release assets, verifies the full
candidate receipt, then publishes the exact retained tarballs sequentially in
dependency order with npm trusted publishing (`npm publish <tgz> --provenance`).
It never builds or packs source. After each publication it downloads the
registry tarball and byte-compares it with the retained archive; a final
publication receipt is retained as a workflow artifact. A failed package stops
the sequence and no later package is published.

Never repack or replace bytes under a previously reviewed version. Missing
provenance, a digest mismatch, private or workspace dependencies in a packed
manifest, unresolved rights, or a duplicate runtime singleton aborts promotion.
