# Changelog

## Unreleased

- Colour and shadow values now resolve through shared role variables instead of
  ending in a fixed value. 138 declarations across 52 files in this package,
  `@global-torque/invest-features` and `@global-torque/invest-widgets` are
  affected. `styles/geometry.css` defines those roles and reads its primitives
  from `@global-torque/design-tokens`.
- Hosts must load `@global-torque/design-tokens/css` before
  `styles/geometry.css`, and both before their own styles. A host that sets the
  matching `--ui-*` override hook keeps its value for that declaration. Where
  neither the hook nor both stylesheets are present, the declaration resolves to
  no value: colours inherit and shadows are not painted.
- Re-measured the CSS budget against the new aggregate: 98,507 raw bytes and
  18,177 gzip bytes.

## 0.2.3 candidate

- Reconciled the offline, install, and update PWA prompts so actions stay
  inline with alert content while retaining typed events and lifecycle state.

## 0.2.2 candidate

- Reissued the framework candidate for fresh public-release validation; package APIs and runtime source remain unchanged.

## 0.2.0 candidate

- Created the standalone seven-package framework workspace.
- Moved investment validation policy and schema helpers into `invest-core`.
- Kept generic UI validation and URL synchronization at public UI Kit barrels.
- Removed company social destinations from framework-owned social metadata.
