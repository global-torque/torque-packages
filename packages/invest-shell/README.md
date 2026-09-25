# Invest Shell

Stable app integration facade for investment apps.

`@global-torque/invest-shell` exposes the app-facing shell APIs for runtime
bootstrap, config, navigation, PWA integration, global investment styles, and
shared shell components. The former compatibility implementation package has
been retired; shell code is owned and tested here.

## Dependency contract

The shell declares its four internal framework dependencies at the exact matching `0.4.13` version. Full-SHA GitHub subdirectory consumers resolve those dependencies from the registry, while this repository enables `linkWorkspacePackages` so local development continues to link matching workspace packages. The shell source manifest therefore does not rely on the `workspace:*` protocol.

## Ownership

- Runtime bootstrap wrappers that compose `@global-torque/invest-runtime` with
  host-supplied adapters.
- App config installation and build-display helpers.
- Navigation constants, menu metadata, links, and SEO helpers for app route
  composition.
- Shell components and shared global investment styles.
- Shared contact form validation, query/session prefill and submission lifecycle;
  Dashboard and Invest supply app-owned Forms API commands and compose account
  and session contact details through `useContactUsSessionPrefill`.
- PWA policy/test constants and registration bridge exports.

## Boundary Rules

- Do not own app route tables, route-level page components, redirects, or final
  page composition.
- Do not import apps, app aliases, VitePress config, or app-owned assets.
- Do not read `import.meta.env` directly; hosts parse and install immutable app
  configuration.
- Do not restore compatibility aliases, fallback barrels, or dependencies on
  the retired common package.
- Runtime behavior belongs in `@global-torque/invest-runtime`; shell wrappers
  should stay thin.

## Public Exports

- `.`: root shell barrel.
- `./components`: `Sidebar07` and its retained `VSidebarTrigger`, plus shell component exports and component-local composables, including
  `VFormContactUs`, `useContactUsSessionPrefill`, `ContactUsModel`, `ContactUsSubmit`, and
  `ContactUsSessionPrefill`. `VDialogs` forwards the host command and identity
  prefill to the shared contact dialog. The active form consumes legacy contact
  query parameters once, keeps subsequent typing local, and invalidates pending
  UI effects on close, unmount or identity replacement. Hosts own transport and
  brand/page attribution; an accepted request is intake, not email delivery.
  `useContactUsSessionPrefill` reads the existing account repository's `fullName`,
  then falls back to flat session `first_name`/`last_name` or nested `name` traits,
  and retains the session email. It starts no account request and never uses an
  email address or selected-profile label as a name. Delayed account names update
  automatic public prefills while preserving query values and user edits.
  Authenticated dialogs hide name/email and submit these current contact details,
  overriding query prefill or guest identity drafts. An unavailable name is
  allowed; invalid email or oversized serialized names show an accessible
  support message. Late sign-in preserves subject/message while invalidating
  pending guest UI effects. Anonymous dialogs and the public page keep editable
  identity fields and their existing prefill/validation behavior.
- `./config`: app config and build display helpers.
- `./runtime`: runtime bootstrap/install wrappers.
- `./navigation`: route/menu/link/SEO helpers for app composition.
- `./pwa`: PWA registration bridge and cache policy/test constants.
- `./styles`: shared investment SCSS entry point.
- `./styles/geometry.css` and `./styles/components.css`: shared investor geometry
  and component presentation consumed before the SCSS entry by app styles.

Hosts should retain this order for the public shell styles. The shell also
keeps each authenticated design-token primitive as an explicit alias. When the
host has not loaded the token stylesheet, the alias ends in a CSS-wide `unset`
value; the consuming property then retains its established
inherit/currentColor/transparent/none behavior instead of inventing a palette:

```css
@import '@global-torque/design-tokens/css';
@import '@global-torque/ui-primitives/styles/theme';
@import '@global-torque/invest-shell/styles/geometry.css';
@import '@global-torque/invest-shell/styles/components.css';
@import '@global-torque/invest-shell/styles';
```

The control, dialog and raised semantic shadows derive from the host
`--foreground`, with the public `--ui-shadow-*` hooks taking precedence over
`--shadow-*`. Outline and non-icon ghost buttons default to no shadow, while
filled controls retain the foreground-derived control shadow. The header bar
and offer-details side card use the same foreground-derived control-shadow
fallback through the public control-shadow hook. Sheet and badge elevations
remain independent primitive-backed roles.

## Validation

```sh
pnpm exec vue-tsc --noEmit -p packages/invest-shell/tsconfig.json
pnpm --dir packages/invest-shell run test:run
pnpm lint:boundaries
```

## CSS Budget

`pnpm --filter @global-torque/invest-shell run css:budget` measures the public
`geometry.css`, `components.css`, and `index.scss` entries in that order. A
production Vite build resolves their Sass and CSS imports with minification and
disk output disabled. The aggregate includes imported styles, but excludes app
styles, Vue SFC styles, and app Tailwind/design-token generation; it is not an
application bundle budget.

The reviewed aggregate is 98,072 raw bytes, 18,357 gzip bytes, and zero generated
dimension selectors. Caps retain 250 raw bytes and 50 gzip bytes of headroom:
98,322 raw and 18,407 gzip. Tests pin the raw bytes and SHA-256, require resolved
imports and zero generated selectors, and enforce gzip only against its cap
because supported Node/zlib versions can compress identical CSS differently.
`css-budget.json` records the reference toolchain and keeps the prior
legacy-entry measurements separate from the comparable target public aggregate
(70,708 raw / 13,798 gzip). Budget changes require measured justification and
visual verification; passing this package budget does not establish UI parity.

## Page Tabs

`VPageTopInfoAndTabs` accepts optional `centerActiveTab` (default `false`).
When enabled by its host, it centers the selected tab within the available
horizontal scroll range on mount, selection changes and resize. It retains
native smooth scrolling, public tab controls and the existing route command.

`VPageTopInfoAndTabs` also accepts `retainUnderlineExtent` (default `false`).
Opted-in hosts render the primary underline across the measured scroll width,
retaining that extent when the viewport shrinks until the list unmounts. Existing
overflow edges follow the resulting scroll bounds; public tab defaults remain unchanged.

## Investor Sidebar

Sidebar07 composes the public `@global-torque/ui-primitives/sidebar` provider,
Sidebar and navigation components. The former `./sidebar` facade is removed.
Its existing props, navigation events and named slots remain supported; side
and collapsible types derive from the primitive `SidebarProps` contract.
The investor provider disables persistence and the new keyboard shortcut,
starts collapsed, and preserves 18rem expanded/mobile and 4.3rem collapsed
widths. Mobile means strictly below 768px; returning to desktop closes the
sheet. The custom primitive Button trigger keeps the approved avatar/icons
and restores focus after mobile close. The rail is inside Sidebar and takes
part in the Tab sequence. Investor-only geometry is in `styles/components.css`.

The mobile Sheet initially focuses its dialog container and keeps keyboard
focus inside. A custom trigger opened while focus-visible retains its expansion
outline beneath the translucent panel until close; pointer opening adds no
outline. This decoration does not retain actual focus outside the dialog.

Right-side navigation reserves its content gap on the right. Shell
`collapsible="none"` keeps a fixed, expanded desktop panel and the normal
dismissible mobile drawer; the host maps this to the primitive offcanvas
layout while holding desktop state open. Router destinations use the actual
Vue Router component through the primitive menu button.

The shared component stylesheet consumes optional release roles for native
button line-height, form-label spacing, and Sidebar icon/avatar geometry.
Status Button roles fall back to the default preset's original states;
explicit document badge color classes take precedence over neutral tone hooks.
Dashboard's CardDonutUnified, VCardGoal and VCardOfferFunded own their nested
section padding and inter-section gap through `--ui-summary-card-*` roles.
VTableDefault owns compact-table metrics through `--ui-table-small-*` roles.
Tahoe Investor supplies these measured values in its wrapper theme; neutral
primitive defaults and the default brand's existing metrics remain fallbacks.
