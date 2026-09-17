# Changelog

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
