# Changelog

## 0.3.0 candidate

- Retain the 0.2.4 dropdown navigation fix for full-row pointer and keyboard activation.

- Require Node `^24.21.0` and pnpm 12.4.2; remove Node 22 support.
- Upgrade Vitest 5, jsdom 30, Markdown 15, VueUse 15, Pinia 4 and Unovis 1.7;
  retain tested Pinia 3 consumer support and TypeScript 6.0.3.
- Preserve Markdown 14 host plugin compatibility and WebSocket heartbeat timing;
  fix donut tooltip values and symlink-path link recovery.
- Remove unused ESLint and obsolete Unovis patches; expand real browser, SSR,
  hydration, HMR, chart and session-cookie consumer verification.
- See `docs/dependency-migration-results.md` for staged evidence and limitations.

## 0.2.4 candidate

- Corrected `VDropdown` menu item composition so link and router-link entries
  receive the primitive menu-item behavior and dismiss the menu after activation.
- Prepared a uniform seven-package framework cohort at `0.2.4`; the prior
  `0.2.3` candidate remains retained for recovery.

## 0.2.3 candidate

- Reconciled the five shared PWA and alert SFC fixes from the accepted
  cross-repository source update, preserving typed props/events and existing
  loading, disabled, sanitisation, and PWA lifecycle behavior.
- Prepared a uniform seven-package framework cohort at `0.2.3`; the prior
  `0.2.2` candidate remains retained for recovery.

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
