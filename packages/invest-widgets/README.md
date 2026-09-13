# Invest Widgets

Domain-aware reusable Vue widgets for investment apps.

## Ownership

`@global-torque/invest-widgets` owns reusable investment widgets that are not
route-level pages: accreditation and KYC alerts/buttons, notification sidebar
entry points, profile switch menus, and wallet-auth presentation components.
Widgets consume explicit providers for store, data, runtime, dialog, and
navigation behavior.

Host composition installs the current store-backed providers. New widget code
stays in this package and receives behavior only through explicit contracts.

## Allowed Dependencies

- Vue 3 Composition API and TypeScript.
- `@global-torque/ui-kit` components, styles, and assets.
- Explicit supported `@global-torque/ui-primitives` subpaths when a low-level
  generic contract is sufficient.
- `@global-torque/invest-core` for pure domain presentation helpers.
- Stable `domain-types`, `invest-data`, or `invest-runtime` contracts only when
  a widget needs them through explicit props or provider types.

## Forbidden Dependencies

- Apps, app aliases, app route tables, or route-level page components.
- The retired common compatibility layer, `@global-torque/invest-features`, or
  `@global-torque/invest-shell` production imports.
- Direct `import.meta.env` reads.
- Direct Pinia stores, Vue Router route constants, or router-owned navigation.
  Navigation is supplied by providers.

## Public Exports

- `.`: root barrel for all widgets and provider APIs.
- `./providers`: provider installation, test reset, and provider contracts.
- `./accreditation`: `VAccreditationAlert`, `VAccreditationButton`,
  `useAccreditationAlert`, and `useAccreditationButton`.
- `./kyc`: `VKycAlert`, `VKycActionButton`, and `useKycAlertViewModel`.
- `./notifications`: `VNotificationsSidebarButton` and
  `useNotificationsSidebarWidget`.
- `./profiles`: `ProfileSwitchMenuList`, `useProfileSwitchMenu`, and
  `ProfileSwitchMenuItem`.
- `./wallet`: `VDialogWalletAuth`, `VFormWalletAuthOtp`,
  `VWalletAuthOperationSummary`, and `useVDialogWalletAuth`.

## Props And Events

`VBreadcrumbs` retains host-supplied route targets and its default separator slot.
Its default separator is decorative and controlled by the optional
`--ui-breadcrumb-separator-content` CSS role (default `>`); custom slot content
and current-page accessibility attributes are preserved.

| Widget | Props and models | Events |
| --- | --- | --- |
| `VAccreditationAlert` | `variant`, `title`, `description`, `buttonText`, `isLoading`, `isDisabled` | `action`, `descriptionAction(event)` |
| `VAccreditationButton` | `isLoading` | none; action comes from `accreditation.useButton()` |
| `VKycAlert` | `variant`, `title`, `description`, `buttonText`, `isLoading`, `isDisabled` | `action`, `descriptionAction(event)` |
| `VKycActionButton` | `size` | none; action comes from `kyc.useAlert()` |
| `VNotificationsSidebarButton` | `isStaticSite`, `showIcon` | none; sidebar behavior comes from `notifications.useSidebar()` |
| `ProfileSwitchMenuList` | `items`, `variant` | `select(id)` |
| `VDialogWalletAuth` | `v-model:open` | none; dialog commands come from `walletAuth.useDialog()` |
| `VFormWalletAuthOtp` | `v-model:codeValue`, `description`, input labels/helpers, `isBusy`, `isOtpStep`, `mode`, `submitButtonText` | `submit` |
| `VWalletAuthOperationSummary` | `intent`, `scanBaseUrl`, `networkLabel` | none |

## Composables And Provider Dependencies

All store/runtime behavior enters through `InvestWidgetProviders`:

- `accreditation.useAlert()` supplies the alert model, loading state, primary
  action, and rich-text description action.
- `accreditation.useButton()` supplies the compact status button/tag model and
  click action.
- `kyc.useAlert()` supplies the KYC alert/action model.
- `notifications.useSidebar()` supplies optional badge/sidebar components plus
  `loadData()` and `onSidebarToggle(open)`.
- `profiles.useProfileSwitchMenu()` supplies profile menu items, selected label,
  and selection behavior.
- `walletAuth.useDialog({ open })` supplies dialog state, OTP/MFA fields,
  operation intent, scanner base URL, and submit/close commands.

The package exposes `setInvestWidgetProviders()` and
`provideInvestWidgetProviders()` for tests or host integration. App and feature
composition wire these providers to their final models and runtime config.

## Unovis patches

The package consumes `@unovis/ts` and `@unovis/vue` at exactly `1.6.7`. The
application workspace applies these two application-owned patches:

- `patches/@unovis__ts@1.6.7.patch` — SHA-256
  `3417f483ba9a7b124580467efc2defb0e23492a58ae3a6970f6a10beaa151630`.
- `patches/@unovis__vue@1.6.7.patch` — SHA-256
  `5a989c693186e25ac38869492a688cc6c640c87682a0ea059771c32471e1a4c4`.

They remove the Unovis Leaflet and MapLibre component exports and their related
types from the application dependency graph. The workspace also keeps its
scoped `@unovis/ts@1.6.7 > maplibre-gl` omission. These patches and the scoped
omission remain application-owned; this package does not silently add or
rebundle MapLibre.

The `socials` export contains neutral network metadata and standard share URL
prefixes. Social icons and destinations are host-owned: hosts pass a typed
`SocialLink[]` with the actual `icon` and `href` values to social link
surfaces. The retired `./icons/social-login` export and its bundled marks are
not part of public `0.2.2`; authentication and offer views receive required
typed icon maps from their application owners. An empty host list renders no
social anchors.

## Migration from curated widgets

`@global-torque/invest-widgets@0.2.2` is the full framework widgets package
owned and published from `global-torque/torque-packages`. It replaces the
curated `@global-torque/invest-widgets@0.1.3` package previously published by
`global-torque/vue-ui`; the two packages have different public APIs and are
not drop-in compatible. Migrate to the framework subpaths documented above
and provide the required widget providers and host-owned social links. The
curated 0.1.3 release and its pinned consumers remain immutable historical
compatibility evidence.

## Example

```ts
import { computed, ref } from 'vue';
import {
  ProfileSwitchMenuList,
  setInvestWidgetProviders,
} from '@global-torque/invest-widgets';

setInvestWidgetProviders({
  profiles: {
    useProfileSwitchMenu: () => ({
      selectedProfileLabel: computed(() => 'EN42: Growth SPV'),
      profileItems: computed(() => [
        { id: '42', label: 'EN42: Growth SPV', isActive: true },
      ]),
      onSelectProfile: async (id) => {
        console.info('selected profile', id);
      },
    }),
  },
});
```

## Validation

```sh
pnpm --filter @global-torque/invest-widgets exec vue-tsc --noEmit
pnpm --filter @global-torque/invest-widgets exec vitest run
```
