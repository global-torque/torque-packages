# Changelog

## 0.4.13 candidate

- Improved the global error alert layout and added an accessible close button while preserving click-to-dismiss behavior.
- Restored branded logo proportions and sidebar border/active-chevron contrast
  for the shared shell navigation.
- Switched the shell's four internal runtime edges to exact versions so full-SHA Git subdirectory installs resolve without the workspace protocol; local development continues to link matching workspace packages.
- Switched the success roles to the fixed mint primitives of design-tokens 0.3.1: `--color-status-success`, `--color-positive-strong` and `--color-positive-tint` read `--gt-primitive-color-mint-500`, `-600` and `-100`, and older dictionaries resolve them to `unset`. The skeleton shimmer now follows the host `--primary` and `--background`, and `.text-secondary` outline and ghost buttons read `--ui-color-positive-accent`, then `--secondary`, where they used the success role.

## 0.4.12 candidate

- Reissued the verified installed shell/features CSS contract roots through a
  side-effect-free shared resolver; release contract tests do not launch a
  browser.

## 0.4.11 abandoned candidate

- CI run `35574140527` and candidate run `35574298182` launched the browser
  contract before Playwright/dependency installation; no hosted candidate
  artifact, GitHub release, or npm package exists. The immutable tagged source
  ledger paired dashboard.webdevelop.biz with torque-packages sourceRevision
  `82fe93868d28682211ea21867badcdeb85879970`; no artifact or receipt escaped.

## 0.4.10 abandoned candidate

- Immutable candidate passed the absent-token npm path, but the corresponding
  pnpm strict-layout path failed with `ENOENT` for an undeclared sibling
  package; the 0.2.1 and 0.3.0 paths did not run; no registry package exists.

## 0.4.9 abandoned candidate

- Immutable candidate was superseded because the immutable release ledger
  misstated public evidence as authenticated and conflated the observed
  offer-card difference with the inferred `VHeaderBar` sibling; no registry
  package exists.

## 0.4.8 abandoned candidate

- Immutable candidate was superseded before publication after the required
  public Investor mobile offer parity gate on
  `/tahoe-e2e-fund-766pk7` found 2 differing pixels / 4 channel-level deltas
  in the offer-card shadow; source review found the same fallback defect in
  `VHeaderBar`; no registry package exists.

## 0.4.8 candidate

- Restored the PWA login accent override with the host `--primary` fallback
  for both login text and the login arrow asset.
- Restored footer disclosure and copyright colors through the host
  `--color-text-disabled` token while preserving public UI-role precedence.

## 0.4.7 abandoned candidate

- Superseded before publication after authenticated Platform desktop parity
  exposed invisible footer disclosure and copyright text; no registry package
  exists.

## 0.4.6 candidate

- Restored framework 0.4.0 plus design-tokens 0.2.1 geometry with reviewed
  CSS-wide `unset` primitive terminals and transparent page-overlay fallback.
- Extended static and Chromium coverage for geometry consumers and all three
  token compatibility modes.

## 0.4.5 abandoned candidate

- Superseded before publication by the 0.4.6 geometry recovery.

## 0.4.5 candidate

- Kept the public footer UI-role overrides while restoring the inverse-footer
  fallback that produces the framework 0.4.0/design-tokens 0.2.1 pixels.
- Added explicit absent, 0.2.1, and 0.3.0 token compatibility checks to the
  static and Chromium CSS contracts.

## 0.4.4 abandoned candidate

- Immutable candidate was superseded before publication; no registry package
  exists.

## 0.4.4 candidate

- Corrected generic shadows to derive from the host foreground while keeping
  fixed neutral component-local fallbacks for header and offer details.
- Restored footer and login public-hook defaults and kept the browser contract
  separate from the Node-only package test.

## 0.4.3 abandoned candidate

- Immutable candidate tag was retained after a successful candidate run but
  was superseded before publication by the accepted footer-role recovery.

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
