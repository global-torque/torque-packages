# Changelog

## 0.4.12 candidate

- Reissued the cohort with a side-effect-free shared CSS contract root resolver;
  release contract tests do not launch a browser.

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

- Reissued the seven-package cohort with the PWA login and footer compatibility
  corrections.

## 0.4.7 abandoned candidate

- Superseded before publication after authenticated Platform desktop parity
  exposed invisible footer disclosure and copyright text; no registry package
  exists.

## 0.4.6 candidate

- Reissued the seven-package cohort with the Invest Shell geometry recovery and
  complete token compatibility characterization.

## 0.4.5 abandoned candidate

- Superseded before publication by the 0.4.6 geometry recovery.

## 0.4.5 candidate

- Reissued the seven-package cohort with the inverse-footer compatibility fix;
  feature contracts and the final `price_update` removal are unchanged.

## 0.4.4 abandoned candidate

- Immutable candidate was superseded before publication; no registry package
  exists.

## 0.4.4 candidate

- Reissued the seven-package cohort after the accepted Invest Shell CSS
  contract recovery; feature contracts are unchanged.

## 0.4.3 abandoned candidate

- Immutable candidate tag was retained after a successful candidate run but
  was superseded before publication by the footer-role recovery.

## 0.4.2 abandoned candidate

- Reissued the cohort with the final `price_update` removal retained.

## 0.4.1 abandoned candidate

- Immutable candidate tag was retained but not published after its browser CI
  gate lacked a Chromium installation step.

## 0.4.0 candidate

- Reissued the framework cohort for the breaking redemption domain contract;
  feature ViewModels consume the new status axis through public exports.

## 0.3.1 candidate

- Capture demo-account credentials and the default redirect at provider setup so
  availability and authentication use one stable configuration snapshot.
- Preserve explicit redirect query parameters and the existing auth/session,
  loading, and error handling behavior.

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

## 0.2.4 candidate

- Reissued the framework cohort for the dropdown SFC correction; feature
  contracts remain unchanged.

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
