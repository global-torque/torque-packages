# Changelog

## 0.4.14 candidate

- Reduced `RedemptionLifecycleItem` to the read-only list fields and removed
  display, operation, finality, token-display, and operation-scope contracts.
- Preserved the business/protocol status and vault status-reason string values
  while carrying forward the cumulative 0.4.13 domain contracts.

## 0.4.13 candidate

- Added typed redemption lifecycle contracts for business and protocol status,
  vault reasons, operation finality, and exact raw-amount presentation.
- Reissued the framework cohort with the shared SDK-backed analytics adapter
  and truthful mutation telemetry contracts.

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
  domain contracts and the final `price_update` removal are unchanged.

## 0.4.4 abandoned candidate

- Immutable candidate was superseded before publication; no registry package
  exists.

## 0.4.4 candidate

- Reissued the seven-package cohort after the accepted Invest Shell CSS
  contract recovery; domain contracts are unchanged.

## 0.4.3 abandoned candidate

- Immutable candidate tag was retained after a successful candidate run but
  was superseded before publication by the footer-role recovery.

## 0.4.2 abandoned candidate

- Reissued the cohort with the final `price_update` removal retained.

## 0.4.1 abandoned candidate

- Immutable candidate tag was retained but not published after its browser CI
  gate lacked a Chromium installation step.

## 0.4.0 candidate

- Make redemption status required with the canonical five-value status union.
- Remove `pricing_status` and `priced_request_effect_id` from redemption
  contracts.
- Export the canonical redemption digest helper and fixtures.

## 0.3.1 candidate

- Reissued the uniform framework cohort for the telemetry and request-context
  updates; domain contracts and source exports remain unchanged.

## 0.3.0 candidate

- Require Node `^24.21.0`; Node 22 is no longer supported.
- Preserve source exports and domain contracts with the upgraded framework cohort.

## 0.2.4 candidate

- Reissued the framework cohort for the dropdown SFC correction; domain
  contracts remain unchanged.

## 0.2.3 candidate

- Reissued the framework cohort after the accepted cross-repository source
  reconciliation; domain contracts remain unchanged.

## 0.2.2 candidate

- Reissued the framework candidate for fresh public-release validation; package APIs and runtime source remain unchanged.

## 0.2.0 candidate

- Created the standalone seven-package framework workspace.
- Moved investment validation policy and schema helpers into `invest-core`.
- Kept generic UI validation and URL synchronization at public UI Kit barrels.
- Removed company social destinations from framework-owned social metadata.
