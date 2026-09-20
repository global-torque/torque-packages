# Changelog

## 0.4.3 candidate

- Corrected generic shadows to derive from the host foreground while keeping
  fixed neutral component-local fallbacks for header and offer details.
- Restored footer and login public-hook defaults and kept the browser contract
  separate from the Node-only package test.

## 0.4.2 abandoned candidate

- Reissued the cohort with the final `price_update` removal retained.
- Added authenticated primitive fallbacks and neutral-950 control/dialog/
  raised shadow contracts with host override precedence.
- Separated the Node-only static contract from the Chromium browser contract.

## 0.4.1 abandoned candidate

- Immutable candidate tag was retained but not published after its browser CI
  gate lacked a Chromium installation step.

## 0.4.0 candidate

- Reissued the framework cohort for the breaking redemption domain contract;
  shell and navigation exports remain unchanged.

## 0.3.1 candidate

- Reissued the uniform framework cohort while retaining the 0.3.0 dropdown
  full-row activation behavior and role-colour fallback compatibility.
- The local consumer Vite integration now excludes the public UI Kit and
  primitives from dependency optimization alongside framework packages.

## 0.3.0 candidate

- Retain the 0.2.4 dropdown navigation fix for full-row pointer and keyboard activation.

- Require Node `^24.21.0`; Node 22 is no longer supported.
- Support the upgraded framework cohort and both Pinia 3 and 4 with the existing source and asset contracts.
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

## 0.2.4 candidate

- Corrected `VDropdown` menu item composition so link and router-link entries
  receive primitive menu-item behavior and dismiss the menu after activation.

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
