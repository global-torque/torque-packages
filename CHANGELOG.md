# Changelog

## 0.4.13 candidate

- Added typed redemption lifecycle contracts for business/protocol status,
  operation finality, vault reasons, and exact raw-amount presentation.
- Added a validated, offline-aware redemption lifecycle client and extended
  the Vault facade with access, lifecycle, and signing-payload operations.
- Switched core formatter imports to ESM Lodash and tracked the generated Node
  entrypoints used by native ESM and VitePress consumers.
- Refreshed finalized USDC NAV cache and offer presentation with the fixed
  six-decimal display contract.
- Improved shell alert dismissal, sidebar active-state contrast, branded logo
  proportions, and success-role/skeleton fallbacks across token cohorts.
- Added the public SDK-backed runtime analytics adapter so Invest and Dashboard
  hosts share one context-owned transport boundary.
- Extended shared analytics body normalization to redact regulated identity and
  payment fields while preserving business telemetry values.
- Synchronized the seven-package cohort and exact internal dependency pins for
  the `framework-v0.4.13` release candidate.

## 0.4.12 candidate

- Reissued the seven-package cohort with a side-effect-free shared resolver for
  independent installed shell/features CSS contract roots. Release contract
  tests validate the resolver without launching a browser; dedicated browser
  gates retain the full Chromium checks.

## 0.4.11 abandoned candidate

- Immutable tag `framework-v0.4.11` points to tag object
  `3394c545ea6ff3d5cd677fb66b9d369ad952f6c6` and peeled commit
  `8841e200282ed93d9f4a90ee5231a2ff716cb392`; CI run `35574140527` and
  candidate run `35574298182` failed because `test:release` launched the
  browser contract before Playwright/dependency installation. The dedicated
  CSS-browser job itself passed, no hosted candidate artifact was produced,
  and no GitHub release or npm package exists. The tag is never moved, deleted,
  or reused. The immutable tagged source ledger also paired
  `global-torque/dashboard.webdevelop.biz` with the `torque-packages` source
  revision `82fe93868d28682211ea21867badcdeb85879970`; no artifact or receipt
  escaped because the candidate failed.

## 0.4.10 abandoned candidate

- Immutable tag `framework-v0.4.10` points to tag object
  `ffe335f89e9be5101a2ee5bdf428218126890193` and peeled commit
  `7650c04a5173e4fd644146771829ff252bb2eae7`; candidate run `35571502342`
  and artifact `10626585626` passed the absent-token npm path, but the
  corresponding pnpm strict-layout path failed with `ENOENT` for an undeclared
  sibling package. The 0.2.1 and 0.3.0 paths did not run. No GitHub release or
  npm package exists and the tag is never moved,
  deleted, or reused.

## 0.4.9 abandoned candidate

- Immutable tag `framework-v0.4.9` points to tag object
  `f27b758babff4d270c46bbd7d22cf7f9a4626792` and peeled commit
  `46d035c8d8eb604fd14007e121e192aee60c8e9a`; candidate run `35570182365`
  and artifact `10625980830` succeeded, but the immutable release ledger
  misstated public evidence as authenticated and conflated the observed
  offer-card difference with the inferred `VHeaderBar` sibling. No GitHub
  release or npm package exists and the tag is never moved, deleted, or reused.

## 0.4.8 abandoned candidate

- Immutable tag `framework-v0.4.8` points to tag object
  `a0822cde56b6f266687e5c2bfe820b5668963851` and peeled commit
  `e18d59ced772fe868703e452df30b07c6887e4c9`; candidate run `35565129065`
  succeeded, but the required public Investor mobile offer parity gate on
  `/tahoe-e2e-fund-766pk7` found 2 differing pixels / 4 channel-level deltas
  in the offer-card shadow; source review found the same fallback defect in
  `VHeaderBar`. No GitHub release or npm package exists; the tag is never
  moved, deleted, or reused.

## 0.4.8 candidate

- Restored the PWA login accent override with the host `--primary` fallback,
  preserving the 0.4.0 visual contract while retaining the 0.4.6 geometry
  recovery and final `price_update` removal.
- Restored the 0.4.0 footer disclosure and copyright colors through the host
  `--color-text-disabled` token while preserving public UI-role precedence.

## 0.4.7 abandoned candidate

- Immutable tag `framework-v0.4.7` points to tag object
  `5741d64dc590a631ab7f54da1a4b19e7c91f0123` and peeled commit
  `b60c4ec7ef46ee29d83d201fc381977c30279e1c`; candidate run `35562211887`
  succeeded, but authenticated Platform desktop parity exposed invisible footer
  disclosure and copyright text. No GitHub release or npm package exists and
  the tag is never moved, deleted, or reused.

## 0.4.6 candidate

- Restored the framework 0.4.0 plus design-tokens 0.2.1 computed geometry by
  replacing direct primitive palette literals with reviewed CSS-wide `unset`
  terminals and a transparent page-overlay terminal.
- Expanded static and Chromium characterization for legal/resource text,
  borders, overlays, header/offer shadows, desktop/PWA footer roles, and the
  absent, authenticated 0.2.1, and authenticated 0.3.0 token modes.

## 0.4.5 abandoned candidate

- Immutable tag `framework-v0.4.5` points to tag object
  `ccb001fca49fe95b08899417137775fb9fdbf005` and peeled commit
  `cf8002b4ec4316914c952821bd4003fd5ce8ec5e`; candidate run `35552606823`
  succeeded, but the candidate was superseded before publication after visual
  parity exposed framework geometry fallback differences. No GitHub release or
  npm package exists and the tag is never moved, deleted, or reused.

## 0.4.5 candidate

- Restored the inverse-footer disabled-text fallback used by the 0.4.0
  framework with design-tokens 0.2.1 while retaining public UI-role
  overrides, price-update contract changes, and the 0.4.4 shadow fixes.
- Added absent, authenticated 0.2.1, and authenticated 0.3.0 token-matrix
  coverage to the static and Chromium CSS contracts.

## 0.4.4 abandoned candidate

- Immutable candidate tag `framework-v0.4.4` points to tag object
  `ea01e06fb017c45b4a0fa68e2e52f4b066a7bbba` and peeled commit
  `a4096405224dba6cd440129a70c90f8da373d4df`; candidate run `35547808990`
  succeeded. No GitHub release or npm package exists; the tag is never moved,
  deleted, or reused.

## 0.4.4 candidate

- Corrected generic control, dialog, and raised shadows to derive from the
  foreground while preserving the fixed neutral fallback for header and offer
  details surfaces.
- Restored footer and login accent/text defaults through public UI hooks.

## 0.4.3 abandoned candidate

- Corrected generic shadows and restored footer/login public-hook defaults, but
  the immutable candidate was superseded before publication by the accepted
  footer-role recovery.
- Immutable tag `framework-v0.4.3` points to tag object
  `d2def7e456f4e9fe7506e568b4c2d4eb1527a280` and peeled commit
  `1bf1fe05171ba370df506cb3e475775ce765e220`; candidate run `35544840055`
  succeeded. No GitHub release or npm package exists and the tag is never
  moved, deleted, or reused.

## 0.4.2 abandoned candidate

- Reissued the seven-package cohort with the final `price_update` removal
  retained and no transitional pricing-field compatibility.
- Restored authenticated design-token literal fallbacks in Invest Shell and
  made control, dialog and raised shadows use neutral-950 with UI/semantic
  override precedence.
- Isolated the Chromium CSS contract from the Node-only package test and bound
  its retained report to the candidate receipt.
- Immutable tag `framework-v0.4.2` points to tag object
  `78eabe922bfe704eb60848722f27496917d94b64` and peeled commit
  `775532c37599f34f6ef3c929d7d033605dafb309`; candidate run `35540413330`
  succeeded, but the candidate was superseded before publication. No GitHub
  release or npm package exists and the tag is never moved, deleted, or reused.

## 0.4.1 abandoned candidate

- Immutable tag `framework-v0.4.1` was retained for audit but not published;
  candidate runs `35539361132` and `35539386904` failed because Chromium was
  not installed before the Invest Shell browser contract.

## 0.4.0 candidate

- Breaking redemption contract: business status is now required and limited to
  `pending`, `approved`, `denied`, `cancelled`, or `completed`.
- Removed redemption-only pricing fields and the transitional response
  compatibility shim; protocol state and decision metadata remain independent.
- Added shared canonical redemption digest fixtures and strict domain exports.

## 0.3.1 candidate

- Reissued the uniform seven-package cohort with the reviewed telemetry,
  request-context, demo-account, and local Vite integration updates.
- Analytics now retains useful user, business, URL, and diagnostic context while
  redacting known credential fields; data and runtime error paths share that
  policy.
- Preserved the 0.3.0 dependency graph, Node 24.21.0/pnpm 12.4.2 toolchain,
  dropdown behavior, role-colour fallback, and release ownership contracts.

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
