# Invest Features

Public feature API for app-owned investment routes.

`@global-torque/invest-features` exposes reusable feature components,
widgets, stores, composables, and contracts that route pages compose from
`apps/dashboard` and `apps/invest`.

The package is the stable app-facing feature API. Its reusable implementations
are owned here or re-exported from a lower package; the former compatibility
package has been retired.

Open-ended offer details render `latest_finalized_nav.nav_usdc_raw` as a dedicated USDC NAV block using the fixed six-decimal NAV contract, independent of the asset token metadata. The presentation includes a normalized ISO timestamp when `valuation_as_of` is valid and is regenerated with each package cohort that changes this contract.

Session refresh displays the active session email as read-only text and confirms it with the existing password. Authentication errors leave the compact dialog available for retry.

## Ownership

- Dashboard and public invest route-level `View*.vue` pages live in apps.
- Reusable domain-aware feature UI, stores, composables, and ViewModels may be
  exported here when apps need stable public entry points.
- Extracted domain-aware widgets are re-exported from
  `@global-torque/invest-widgets`; feature barrels should not reintroduce
  widget implementations.
- App-specific route tables, layouts, redirects, and final page composition stay
  in the owning app.
- Static/public route pages such as contact, terms, resource-center, KYC,
  authentication, and offer-detail views are app-owned; there is no
  `@global-torque/invest-features/static` route-page facade.

## Public Subpaths

- `.`
- `./accreditation`
- `./auth`
- `./dashboard`
- `./kyc`
- `./lifecycle`
- `./notifications`
- `./notifications/model`
- `./offers`
- `./profiles`
- `./wallet`

Widget exports in `./accreditation`, `./kyc`, `./notifications`, `./profiles`,
and `./wallet` come from `@global-torque/invest-widgets`.

## Notification table composition

`VNotificationTable` accepts optional `row-actions` and `after-row` slots.
Both receive `{ item: IFormattedNotification }`. `row-actions` renders in the
item action area. `after-row` renders immediately after that item row. Its
consumer must provide one complete `TableRow` with one `TableCell` using
`colspan="2"`. Small notification tables do not render either slot.

## Offer regulatory arrays

The `./offers` repository and its `invest-core` formatter consume the canonical
`IOffer` regulatory arrays and preserve their values and order through cache
signatures, repository state, and formatted offers. Investor eligibility stays
an independent field and is not derived from the selected routes. SDK/Tahoe
activation and consumer rollout remain separate from this package source.

Offer comments use `GET /public/comment` with the generic `offer.offer` target
and post the same target to `/auth/comment`. The repository validates the
returned author-bearing DTO before publishing comment state. Successful posts
clear the form but do not reload the public list while moderation is pending.

## Boundary Rules

- Do not export route-level page components from this package.
- Do not import apps, app aliases, app route tables, VitePress config, or
  app-owned assets.
- Do not read `import.meta.env` directly.
- Keep package dependency direction acyclic; use runtime ports rather than
  application imports for reusable coordination.
- Do not restore compatibility aliases, private deep exports, or dependencies
  on the retired common package.

## Example

```ts
import {
  DashboardSummary,
  DashboardTabTypes,
} from '@global-torque/invest-features/dashboard';
```
