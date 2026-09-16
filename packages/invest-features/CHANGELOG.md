# Changelog

## 0.3.0 candidate

- Require Node `^24.21.0`; Node 22 is no longer supported.
- Upgrade Markdown and VueUse integrations; support Pinia 3 and 4 through public package exports.
- Colour and shadow values now resolve through shared role variables instead of
  ending in a fixed value. 138 declarations across 52 files in this package,
  `@global-torque/invest-shell` and `@global-torque/invest-widgets` are affected.
- Those roles are defined by `@global-torque/invest-shell` in
  `styles/geometry.css`, which reads its primitives from
  `@global-torque/design-tokens`. This package does not depend on
  `@global-torque/invest-shell`, so a host that installs it alone must load
  `@global-torque/design-tokens/css` and then
  `@global-torque/invest-shell/styles/geometry.css` itself, before its own
  styles. A host that sets the matching `--ui-*` override hook keeps its value
  for that declaration. Where neither the hook nor both stylesheets are present,
  the declaration resolves to no value: colours inherit and shadows are not
  painted.

## 0.2.3 candidate

- Reissued the framework cohort after the accepted cross-repository source
  reconciliation; feature contracts remain unchanged.

## 0.2.2 candidate

- Reissued the framework candidate for fresh public-release validation; package APIs and runtime source remain unchanged.

## 0.2.0 candidate

- Created the standalone seven-package framework workspace.
- Moved investment validation policy and schema helpers into `invest-core`.
- Kept generic UI validation and URL synchronization at public UI Kit barrels.
- Removed company social destinations from framework-owned social metadata.
