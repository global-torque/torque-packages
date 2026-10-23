# Invest Shell

Stable app integration facade for investment apps.

`@global-torque/invest-shell` exposes the app-facing shell APIs for runtime
bootstrap, config, navigation, PWA integration, global investment styles, and
shared shell components. The former compatibility implementation package has
been retired; shell code is owned and tested here.

## Dependency contract

The shell declares its four internal framework dependencies at the exact matching `0.4.17` version. Full-SHA GitHub subdirectory consumers resolve those dependencies from the registry, while this repository enables `linkWorkspacePackages` so local development continues to link matching workspace packages. The shell source manifest therefore does not rely on the `workspace:*` protocol.

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

`VHeaderPWA` accepts an optional `brandName` for the accessible logo label. The
value is trimmed and falls back to the installed application brand title when
omitted or blank. The resolved name is passed to both the responsive header and
the PWA logo.

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
  `toasterProps` holds the shared props for the ui-primitives `Toaster`.
- `./config`: app config and build display helpers.
- `./runtime`: runtime bootstrap/install wrappers.
- `./navigation`: route/menu/link/SEO helpers for app composition.
- `./pwa`: PWA registration bridge and cache policy/test constants.
- `./styles`: shared investment SCSS entry point.

Hosts should retain this order for the public shell styles:

```css
@import '@global-torque/design-tokens/css';
@import '@global-torque/ui-primitives/styles/theme';
@import '@global-torque/invest-shell/styles';
```

The shared styles sit in Tailwind's `base` layer. Load them after Tailwind, so
that they win over its preflight. Utilities, component classes and unlayered
app styles override their normal declarations. A shell `!important`
declaration wins over `!important` utilities and unlayered app rules. The
paragraph, link and list element rules skip shadcn primitive parts, which
carry a `data-slot` attribute. Two rules stay outside the layer. One keeps the
`h2` weight and line height on `DialogTitle` and `SheetTitle` over their
utilities. The other keeps the 1px top line, the full `--muted` hover tint and
the 0.3s transition on `TableRow` body rows. Unlayered app rules with higher
specificity still override them.

Shell components and the shared styles read the shadcn variables directly, such
as `--foreground`, `--muted-foreground`, `--border` and `--shadow-sm`. The
shadows are Tailwind theme variables. Tailwind emits one only when its name
appears in a scanned file, so the host Tailwind build must scan the `.vue` files
of `invest-shell`, `invest-features` and `invest-widgets`.

The shared styles set `--header-height` and `--footer-height` to `4rem` on
`:root`. The header bar and the Sidebar07 header read `--header-height`. The
Sidebar07 footer reads `--footer-height`. A host page footer uses
`min-height: var(--footer-height)`, so that its top line meets the sidebar
footer line.

## Validation

```sh
pnpm exec vue-tsc --noEmit -p packages/invest-shell/tsconfig.json
pnpm --dir packages/invest-shell run test:run
pnpm lint:boundaries
```

## Page Tabs

`VPageTopInfoAndTabs` accepts optional `centerActiveTab` (default `false`).
When enabled by its host, it centers the selected tab within the available
horizontal scroll range on mount, selection changes and resize. It retains
native smooth scrolling, public tab controls and the existing route command.

`VPageTopInfoAndTabs` also accepts `retainUnderlineExtent` (default `false`).
Opted-in hosts render the primary underline across the measured scroll width,
retaining that extent when the viewport shrinks until the list unmounts. Public
tab defaults remain unchanged.

## Investor Sidebar

Sidebar07 composes the public `@global-torque/ui-primitives/sidebar` provider,
Sidebar and navigation components. The former `./sidebar` facade is removed.
Its existing props, navigation events and named slots remain supported; side
and collapsible types derive from the primitive `SidebarProps` contract.
The investor provider uses the primitive `sidebar_state` cookie and Ctrl/Cmd+B
shortcut, starts collapsed, and preserves 18rem expanded/mobile and 4.3rem
collapsed widths. Mobile means a width of 768px or less. The custom primitive
Button trigger keeps the approved avatar/icons and restores focus after mobile
close. The rail is inside Sidebar and takes
part in the Tab sequence. Investor-only geometry is in the Sidebar07 component
styles.

The mobile Sheet focuses its first focusable element and keeps keyboard
focus inside. A custom trigger opened while focus-visible retains its expansion
outline beneath the translucent panel until close; pointer opening adds no
outline. This decoration does not retain actual focus outside the dialog.

Right-side navigation reserves its content gap on the right. Shell
`collapsible="none"` keeps a fixed, expanded desktop panel and the normal
dismissible mobile drawer; the host maps this to the primitive offcanvas
layout while holding desktop state open. Router destinations use the actual
Vue Router component through the primitive menu button.
