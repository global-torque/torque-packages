# Framework package release policy

Each package has explicit source exports, package files, MIT metadata, runtime
dependencies, singleton peers, and public repository metadata. The workspace
root remains private. The CI workflows pack once and retain the exact
candidate/receipt before any publication decision.
The receipt records the target repository identity and commit used by hosted
attestation as `sourceRepository`/`sourceRevision`, and the pinned producer
package identity as `sourcePackageRepository`/`sourcePackageRevision`.
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

Candidate 0.3.1 reissues the dependency-migrated 0.3.0 cohort with selective
analytics/request sanitization, stable demo-account configuration capture, and
local Vite UI peer exclusions. The retained 0.2.3 baseline remains the source
reconciliation reference.
Local verification does not authorize publication; the external Alchemy
TypeScript peer declaration remains a documented owner handoff item in
[the migration results](dependency-migration-results.md).

The candidate's ordinary immutable release tag is `framework-v0.3.1` for the
`0.3.1` candidate. Dispatch the candidate workflow from that tag so its
attestations carry `refs/tags/framework-v0.3.1`. The prior `framework-v0.2.2`
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
22 release assets; the authenticated transport path conditionally supplies six
UI Kit assets and retains the four lock/workspace overlay files.
Before attestation, the candidate workflow builds the Node helpers and runs
package, consumer-link, and release contract tests on Node 24. Detached npm
and pnpm consumer verification is an optional local check; audits, typechecks,
and standalone source policy checks are not CI gates.

The release workflow does not publish npm packages, create tags, deploy apps,
or promote ordinary releases. The provenance workflow accepts a retained CI
candidate run, verifies every receipt digest, and creates a signed npm package
identity attestation using GitHub hosted OIDC. The primary maintainer owns any
later `npm publish` operation and must use the exact retained tarball and
provenance bundle.

Never repack or replace bytes under a previously reviewed version. Missing
provenance, a digest mismatch, private or workspace dependencies in a packed
manifest, unresolved rights, or a duplicate runtime singleton aborts promotion.
