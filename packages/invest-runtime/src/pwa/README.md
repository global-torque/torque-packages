# PWA Overview

This directory is the source of truth for the shared PWA implementation used by the host shell.

## What is done

- install prompt support for Chromium-class browsers via `beforeinstallprompt`
- manual install guidance for iOS Safari when no native prompt exists
- prompt-based service worker update flow with explicit user action
- offline-ready, update-ready, registration-error, and reconnect status messaging
- offline read-only support for audited GET surfaces only
- shared status-stack UI that coordinates install, update, and offline banners
- browser-fallback service worker registration bridge plus host-specific Vite PWA bridge wiring
- local deterministic PWA test hooks for install and update flows on localhost

## Why this exists

- give users a real install path instead of a broken or misleading CTA
- keep service worker updates explicit so a new worker does not interrupt active sessions
- allow audited read-only offline access without pretending writes are safe offline
- centralize the runtime rules so both the host shell and shared UI stay in sync
- keep browser-specific PWA behavior isolated behind small composables and bridge helpers

## How it works

### Install flow

- `usePwaInstallPrompt.ts` listens for `beforeinstallprompt`, `appinstalled`, `storage`, and `visibilitychange`
- dismissal is persisted in local storage with a cooldown to avoid re-showing the prompt too aggressively
- standalone sessions suppress the install prompt
- iOS Safari falls back to manual “Add to Home Screen” guidance
- localhost test mode can dispatch `invest:pwa-test:before-install-prompt` for deterministic UI verification

### Update flow

- `usePwaUpdatePrompt.ts` reads service worker update state from `pwaRegistrationBridge.ts`
- the bridge can come from the host app via `installVitePwaRegistrationBridge.ts` or fall back to browser APIs
- update state is exposed as `idle`, `offlineReady`, `updateReady`, `reloading`, or `registrationError`
- update and offline-ready dismissals persist in local storage until the underlying prompt lifecycle changes
- refresh waits for `controllerchange` before clearing the prompt; if takeover never happens, the prompt stays available so the user can retry
- localhost test mode can dispatch `invest:pwa-test:update-ready`

### Why `pwaRegistrationBridge` exists

- the shared `invest-common` layer needs one stable API for PWA registration state, but the real registration source depends on the host app
- the host shell uses `virtual:pwa-register/vue`, which is a host-level Vite integration and should not be hard-wired into shared domain logic
- without the bridge, `usePwaUpdatePrompt.ts` would be tightly coupled to one registration implementation and would be harder to reuse, test, or run in environments where the host bootstrap has not installed the Vite bridge yet
- the bridge lets the host inject the preferred registration source while keeping a browser-native fallback for tests, non-host contexts, and defensive recovery paths
- in practice, it separates “where service worker state comes from” from “how the shared PWA UI reacts to that state”

### Offline flow

- `pwaPolicy.ts` defines which domains and path families are allowed to persist for offline use
- only reviewed GET requests are eligible
- public and private cache namespaces stay separated
- navigation fallback prefers the cached dashboard shell for dashboard routes and falls back directly to `/offline.html` everywhere else
- offline UI is read-only and communicates whether cached content is available
- offline and reconnected banner dismissals persist while offline and are cleared once the app is back online

### UI composition

- `VPwaStatusStack.vue` is the composition surface for install, update, and offline banners
- `VPwaInstallPrompt.vue`, `VPwaUpdatePrompt.vue`, and `VOfflineStatusBanner.vue` are presentational components
- the host shell mounts the stack and controls footer-offset behavior based on whether the mobile footer menu is actually visible

## Important files

- `pwaPolicy.ts`
- `pwaRegistrationBridge.ts`
- `pwaDebug.ts`
- `pwaDetector.ts`
- `usePwaInstallPrompt.ts`
- `usePwaUpdatePrompt.ts`
- `useOfflineStatus.ts`
- `usePwaOfflineDataStatus.ts`
- `usePwaTelemetry.ts`
- `../shared/components/pwa/VPwaStatusStack.vue`
- `../shared/components/pwa/VPwaInstallPrompt.vue`
- `../shared/components/pwa/VPwaUpdatePrompt.vue`
- `../shared/components/pwa/VOfflineStatusBanner.vue`

## What still needs to be done

- keep auditing offline-eligible routes and APIs before expanding cache coverage
- manually validate iOS Safari install guidance and real-device Android install behavior
- run authenticated end-to-end checks in environments that provide real auth credentials
- keep the sibling host apps aligned when shared PWA contracts change
- revisit any new write flows separately if true offline mutation support is ever required

## Testing

The main safety net lives in:

- runtime unit tests in `packages/invest-runtime/src/pwa/__tests__`
- shell component tests in `packages/invest-shell/src/pwa/__tests__`
- Dashboard offline-tab coverage in `apps/dashboard/src/features/dashboard/__tests__`
- browser verification in `apps/tests/e2e/pwa.spec.ts`

When changing this folder, update the colocated tests in the same pass.
