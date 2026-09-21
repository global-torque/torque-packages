# Source and release reconciliation

The `0.4.5` candidate reissues the seven-package cohort with the completed
`invest-shell` inverse-footer token fallback and shadow contract. The breaking stablecoin
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

The framework candidate using the public `@global-torque/ui-kit@0.1.4`
dependency produces 23 release assets including the retained browser contract
report. Its authenticated transport consumes
six conditional UI Kit assets, and the corresponding lock overlay retains four
canonical/derived YAML files only when that transport path is selected; the
ordinary public dependency path has no overlay.

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

Candidate packing is dependency first. `pnpm run pack:candidate` packs each
package once, computes SHA-512 and file inventories, and writes the combined
receipt. A candidate directory is immutable for its version: a failed or
changed candidate receives a new version. The local receipt and tarballs are
test overlays only and are not a publication authorization. The prior
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
Candidate `0.4.5` is the new immutable release identity.
