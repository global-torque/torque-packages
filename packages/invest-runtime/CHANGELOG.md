# Changelog

## 0.4.5 candidate

- Reissued the seven-package cohort with the inverse-footer compatibility fix;
  runtime contracts and the final `price_update` removal are unchanged.

## 0.4.4 abandoned candidate

- Immutable candidate was superseded before publication; no registry package
  exists.

## 0.4.4 candidate

- Reissued the seven-package cohort after the accepted Invest Shell CSS
  contract recovery; runtime contracts are unchanged.

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
  runtime context and telemetry exports remain unchanged.

## 0.3.1 candidate

- Preserve useful URL, fragment, user, and diagnostic context in analytics and
  reported-error telemetry while redacting known credential fields.
- Keep the internal error envelope bounded for deduplication and transport,
  while sharing core body normalization with runtime analytics events.

## 0.3.0 candidate

- Require Node `^24.21.0`; Node 22 is no longer supported.
- Upgrade VueUse to 15 and adapt the WebSocket heartbeat scheduler while preserving its 60-second cadence. Support both Pinia 3 and 4.

## 0.2.4 candidate

- Reissued the framework cohort for the dropdown SFC correction; runtime
  contracts remain unchanged.

## 0.2.3 candidate

- Reissued the framework cohort after the accepted cross-repository source
  reconciliation; runtime contracts remain unchanged.

## 0.2.2 candidate

- Reissued the framework candidate for fresh public-release validation; package APIs and runtime source remain unchanged.

## 0.2.0 candidate

- Added the exact Node conditional output for the pure PWA policy helper.

- Created the standalone seven-package framework workspace.
- Moved investment validation policy and schema helpers into `invest-core`.
- Kept generic UI validation and URL synchronization at public UI Kit barrels.
- Removed company social destinations from framework-owned social metadata.
