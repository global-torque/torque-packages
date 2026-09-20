# Changelog

## 0.4.2 candidate

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
