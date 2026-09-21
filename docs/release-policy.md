# Framework package release policy

Each package has explicit source exports, package files, MIT metadata, runtime
dependencies, singleton peers, and public repository metadata. The workspace
root remains private. The CI workflows pack once and retain the exact
candidate/receipt before any publication decision.
The receipt records the target repository identity and commit used by hosted
attestation as `sourceRepository`/`sourceRevision`, and the pinned producer
package identity as `sourcePackageRepository`/`sourcePackageRevision`.
It also records the exact authenticated external dependency receipt for
`@global-torque/design-tokens@0.3.0`, including archive SRI, archive and
inventory digests, source tag/commit and npm publish/SLSA attestation digests.
The 0.4.5 compatibility matrix separately retains the verified 0.2.1 source
tag/commit, archive SRI, inventory and attestation digest used for consumer
pixel parity, together with the absent-token case.
Local extracted workspaces can emit a receipt with `sourceDirty: true` and a
null target revision; those bytes are test overlays only. The candidate
workflow requires a clean target checkout and records its full commit before
packing.

When the selected `@global-torque/ui-kit@0.1.4` candidate is not yet in npm,
the primary maintainer places the already verified UI Kit inputs in the
framework repository's draft release `ui-kit-transport-v0.1.4`. That draft
contains exactly `global-torque-ui-kit-0.1.4.tgz`, its `.manifest.json` and
`.sha512` sidecars, `selected-release.json`, the raw Sigstore bundle as
`original-provenance.json`, and `transport-receipt.json`. The framework
workflow downloads those assets with the repository `GITHUB_TOKEN`, verifies
the source tag, commit, workflow run, archive, sidecars, and raw attestation
(including offline cryptographic verification with `gh attestation verify
--bundle`), then uses the archive only as a temporary install overlay. It compares the derived
overlay lockfile with the committed canonical lockfile, retaining the
authenticated UI Kit integrity and allowing only the expected UI Kit locator
mapping. The combined receipt binds the SHA-256 digests of the canonical and
derived lockfiles and workspace files, retained as
`pnpm-lock.canonical.yaml`, `pnpm-lock.derived.yaml`,
`pnpm-workspace.canonical.yaml`, and `pnpm-workspace.derived.yaml`. Those four
files are included in the exact release asset set and are byte-checked before
any matrix identity attestation. The canonical lockfile and workspace file are
restored before the candidate is packed, so packed manifests and receipts
retain the public registry dependency. Omitting the transport release uses the
frozen public lockfile and requires the UI Kit release to be available.

Candidate 0.4.5 reissues the seven-package cohort with the final
`price_update` removal retained and the Invest Shell inverse-footer fallback
and shadow compatibility contract. It corrects generic shadows to remain
foreground-derived while preserving the fixed neutral fallback only for the
header and offer-details surfaces, and restores footer/login public-hook
defaults. The retained 0.4.0 plus design-tokens 0.2.1 pair remains the source
and rollback reference. Absent-token, authenticated 0.2.1 and authenticated
0.3.0 checks are required before promotion.
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
never moved, deleted, or reused. The new ordinary immutable release tag is
`framework-v0.4.5` for the `0.4.5` candidate. Dispatch the candidate workflow
from that tag so its attestations carry `refs/tags/framework-v0.4.5`. The prior `framework-v0.2.2`
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
