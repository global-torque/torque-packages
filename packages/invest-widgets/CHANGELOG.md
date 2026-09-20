# Changelog

## 0.4.3 candidate

- Reissued the seven-package cohort after the accepted Invest Shell CSS
  contract recovery; widget contracts are unchanged.

## 0.4.2 abandoned candidate

- Reissued the cohort with the final `price_update` removal retained.

## 0.4.1 abandoned candidate

- Immutable candidate tag was retained but not published after its browser CI
  gate lacked a Chromium installation step.

## 0.4.0 candidate

- Reissued the framework cohort for the breaking redemption domain contract;
  widget providers and assets remain unchanged.

## 0.3.1 candidate

- Reissued the uniform framework cohort for the shared telemetry and request
  context updates; widget APIs, assets, and source behavior remain unchanged.

## 0.3.0 candidate

- Require Node `^24.21.0`; Node 22 is no longer supported.
- Upgrade Unovis to 1.7 without workspace patches; fix nested donut tooltip values that could display NaN.
- Colour and shadow values now resolve through shared role variables instead of
  ending in a fixed value. 138 declarations across 52 files in this package,
  `@global-torque/invest-shell` and `@global-torque/invest-features` are affected.
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

## 0.2.4 candidate

- Reissued the framework cohort for the dropdown SFC correction; widget
  contracts remain unchanged.

## 0.2.3 candidate

- Reconciled the accreditation and KYC alert action presentation so actions
  stay inline with sanitised descriptions while retaining disabled and loading
  behavior.

## 0.2.2 candidate

- Established `@global-torque/invest-widgets@0.2.2` as the full framework
  widgets API and sole owner published from `torque-packages`. It replaces
  curated `@global-torque/invest-widgets@0.1.3` from `vue-ui`; the two APIs are
  not drop-in compatible.
- The framework implementation and runtime behavior remain unchanged from the
  retained `@webdevelop-pro/invest-widgets@0.2.1` source.

## 0.2.0 candidate

- Created the standalone seven-package framework workspace.
- Moved investment validation policy and schema helpers into `invest-core`.
- Kept generic UI validation and URL synchronization at public UI Kit barrels.
- Removed company social destinations from framework-owned social metadata.
