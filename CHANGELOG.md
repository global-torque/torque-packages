# Changelog

## 0.2.2 candidate

- Reissued the seven-package framework candidate under the `@global-torque/*`
  namespace at `0.2.2`; framework implementation and runtime behavior remain
  unchanged from the retained `0.2.1` source.
- `@global-torque/invest-widgets@0.2.2` is the full framework widgets API and
  sole owner published from `torque-packages`. It replaces curated
  `@global-torque/invest-widgets@0.1.3` from `vue-ui`; the two APIs are not
  drop-in compatible.

## 0.2.0 candidate

- Created the standalone seven-package framework workspace.
- Moved investment validation policy and schema helpers into `invest-core`.
- Kept generic UI validation and URL synchronization at public UI Kit barrels.
- Removed company social destinations from framework-owned social metadata.
