# Source and release reconciliation

The `0.2.0` candidate is transferred from
`global-torque/dashboard.webdevelop.biz@9f35aa0882b765e202538ce7c7d5e82eb1b452d3`.
The seven framework packages are the only source owned by this repository.
The exact package matrix, external pins, patch hashes, dependency order,
intermediate compatibility, abort signals, and recovery rule are recorded in
[`source-reconciliation.json`](./source-reconciliation.json).

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
test overlays only and are not a publication authorization.
