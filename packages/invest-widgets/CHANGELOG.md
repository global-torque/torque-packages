# Changelog

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
