# Invest Runtime

Browser runtime package for investment apps.

This is the public `@global-torque/invest-runtime` package. It owns the
shared browser/native lifecycle mechanisms described below; app-specific
policy and feature models remain in their owning apps or feature packages. It
is distinct from the public framework-free `@global-torque/sdk`, and there is
no approved `@global-torque/sdk-runtime` destination.

## Ownership

- Session lifecycle and session-cookie persistence.
- Selected-profile cookie, route synchronization, reset, and offline-aware
  session coordination through an injected profile-repository port.
- Auth redirects, route preload guards, and logout redirect helpers.
- Browser navigation with typed query parameters through `./navigation`.
- PWA/offline policy, IndexedDB persistence, and runtime API-client hooks.
- Analytics event/error reporting adapters.
- Native Android/iOS Firebase Messaging push bridge and logout cleanup.
- Lifecycle reset registries, full/profile reset helpers, global error handling,
  chunk handling, and runtime install functions.
- Investment-app global loading state and route/feature loading orchestration.
- Frontend client error reporting to the current analytics-api/Loki backend via
  runtime analytics adapters.
- Context-owned restricted application credentials, cached exact-origin direct
  SDK service clients, contract-backed EVM/Offers/Vault/Invitations resource factories, and keyed
  compatibility-client factories. Apps validate and supply the public browser
  credential; the runtime does not read environment variables or expose the
  key to keyless/Ory/third-party clients.

Host-specific Workbox registration remains app-owned. This package exposes the
runtime PWA policy and registration bridge that a host can connect to
`virtual:pwa-register/vue` or another service-worker registration source.

## Allowed Dependencies

- `@global-torque/domain-types` for DTO contracts.
- `@global-torque/invest-core` for pure config and analytics helpers.
- `@global-torque/invest-data` for API-client hook/config installation.
- `@global-torque/sdk` for context-owned direct service clients,
  explicit user-auth strategies, typed results/errors, and transport disposal.
- Vue, Pinia, Vue Router types, VueUse browser utilities, Capacitor Firebase
  Messaging/local-notification modules, and generic `ui-kit` toast/global-alert
  helpers.

## Forbidden Dependencies

- Apps, app routes, route-level page components, `invest-shell`, or
  `invest-features`.
- `invest-common` production imports. Compatibility wiring must live in
  `invest-common` shims/adapters instead.
- Direct `import.meta.env` reads for final app/service config. Apps pass
  `InvestAppConfig` explicitly during installation.

## Public Exports

`./pwa/pwaPolicy` retains its source TypeScript browser and type targets and
provides exact generated `dist/node/pwa/pwaPolicy.js` for plain Node/VitePress
configuration consumers. The sibling `./pwa` barrel and `./pwa/*` exports keep
their source behavior.

- `.` and `./install`: runtime install APIs.
- `./adapters`: compatibility adapter registration for repositories, profile
  stores, analytics, notifications, and SEO hooks.
- `./api-client-hooks`: API-client offline/analytics hook installer.
- `./pwa`, `./pwa/*`: PWA policy, offline persistence, detector, registration
  bridge, and composables.
- `./session`: `useSessionStore`.
- `./profiles`: `useProfilesStore` selected-profile coordination.
- `./loader`: `useGlobalLoader` for Dashboard, Invest, and shared investment
  feature orchestration. Generic UI and Global Torque do not own or consume
  this investment runtime store.
- Auth, profile, investment, and preload guards are exported through the
  runtime root and their owning public subpaths; there is no `./redirects`
  entrypoint.
- `./analytics`: analytics event/error helpers.
- `./error-handling` and `./error/*`: global error setup, idempotent
  framework/global handlers, `reportError`, and UI-only reporter hooks.
- `./native-push` and `./native-push/core`: native push bridge/core helpers.
- `./navigation`: browser navigation with typed query parameters.
- `./lifecycle` and `./chunk-error-handling`: reset registries and chunk
  recovery.

## Example

```ts
import { createApp } from 'vue';
import { installInvestRuntime } from '@global-torque/invest-runtime';
import type { InvestAppConfig } from '@global-torque/invest-core/app/config';

const app = createApp(App);
const appConfig: InvestAppConfig = /* app-owned env mapping */;

installInvestRuntime({
  app,
  appConfig,
  applicationKey: appOwnedRuntimeConfig.applicationKey,
  errorHandling: {
    serviceName: 'dashboard',
  },
  installApiClientHooks: true,
});
```

`applicationKey` remains separate from `InvestAppConfig` so it is not copied
through general configuration consumers. Keyed callers must explicitly request
`context.createKeyedApiClient(...)`; existing `createApiClient(...)` and raw
clients stay keyless. The keyed compatibility client rejects caller key
overrides and absolute request URLs on any origin other than its configured
service origin.

Migrated resources use `context.createSdkServiceClient(...)` and must choose
`applicationAuth` and user auth explicitly. The context caches equivalent
service clients, forwards runtime request IDs, and disposes every owned SDK
transport with the application context. HTTPS is mandatory by default. A host
that actually runs a local HTTP service must pass that exact origin through
`allowInsecureSdkOrigins`; the context never derives an insecure exception from
an arbitrary configured service URL. Offline persistence and presentation
policy remain runtime/app responsibilities and must be wired per migrated
resource; the initial Tahoe investor-list pilot deliberately has no offline
policy.

The shared keyless read cohort uses
`context.createEvmSdkResource()` and
`context.createOffersSdkResource()`, while authenticated Vault workflows use
`context.createVaultSdkResource()`. Signup invitation preview and acceptance use
`context.createInvitationsSdkResource()` with operation-owned no-store, retry,
and abort options. These factories preserve the compatibility client's
cookie credentials, standard request headers, and one 250 ms network retry.
Their EVM wallet-info/history, Offers list/detail, and Vault position/redemption responses are validated
synchronously at the SDK boundary; the existing repositories continue to own
formatting and state. The runtime resource Fetch adapter applies the same
IndexedDB persist/fallback policy and hydration headers as the compatibility
client before the SDK validates the selected network or cached response.

`errorHandling.serviceName` is required for runtime error handling and should be
the app-owned client service name
(`dashboard`, `invest`, or `tahoe`). It is forwarded to analytics as
`data.serviceContext.service_name` and stored for feature analytics events.
Apps that need app-local presentation can pass `errorHandling.uiReporter`; this
only replaces toasts/alerts, not normalization, analytics logging, global
handler setup, or status-code branching. `setErrorReporter` remains available
for tests that need to replace the whole pipeline.

Client error telemetry preserves useful query, fragment, user, and diagnostic
context while redacting only known credential fields. Bodies use the shared
analytics normalization policy, and the internal error envelope remains bounded
for fingerprinting, deduplication, queueing, and rate limiting.
