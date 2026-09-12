# PWA to Native Mobile App Audit

Repo-based audit completed on 2026-03-25.

Scope note: this audit is based on the current source tree, config, and tests in this repository. Deployment-only guarantees such as production HTTPS coverage cannot be fully proven from source alone, so those items are marked accordingly.

Legend:
- `[x]` Fully implemented in the repo
- `[ ]` Missing or only partially implemented

## Summary

- Fully implemented: 7
- Partially implemented: 7
- Missing / not found: 6

## 1. User Interface & Interaction

- [x] Disable Double-Tap Zoom
  Status: Implemented
  Comment: PWA mode now installs JS guards that prevent pinch zoom, double-tap zoom, and Ctrl/Cmd zoom shortcuts, and it injects `user-scalable=no` plus `maximum-scale=1` into the viewport meta. This achieves the native-like no-zoom behavior, but it is an intentional accessibility anti-pattern because it blocks user zoom.
  Evidence: `packages/invest-shell/src/navigation/useMobileLayout.ts`, `packages/invest-runtime/src/pwa/disableZoom.ts`

- [x] Prevent Text Selection
  Status: Implemented
  Comment: PWA-specific styles disable selection for buttons, links, nav-like surfaces, menus, toolbars, and labels, while explicitly allowing article/text content to remain selectable.
  Evidence: `ui-kit/src/styles/_pwa.scss:62-76`, `ui-kit/src/styles/_pwa.scss:89-103`

- [x] Remove Tap Highlights (iOS)
  Status: Implemented
  Comment: Interactive elements in PWA mode remove the iOS tap highlight, and the global reset also clears tap highlight on focus.
  Evidence: `ui-kit/src/styles/_pwa.scss:84-87`, `ui-kit/src/styles/_pwa.scss:107-113`, `ui-kit/src/styles/_reset.scss:99-101`

- [ ] Optimize Touch Target Sizes
  Status: Partial
  Comment: Several form controls use `48px` heights, which is good, but the shared button component still ships `40px` medium and `32px` small variants, so the minimum target guidance is not consistently met across the system.
  Evidence: `ui-kit/src/components/Base/VButton/VButton.vue:123-139`, `ui-kit/src/components/Base/VForm/VFormInput.vue`, `ui-kit/src/components/Base/VForm/VFormSelect.vue`, `ui-kit/src/components/Base/VCommand/VCommandInput.vue`

- [x] Implement Smooth Scrolling
  Status: Implemented
  Comment: Smooth scrolling is enabled for standalone/PWA mode and correctly disabled when `prefers-reduced-motion: reduce` is set.
  Evidence: `ui-kit/src/styles/_pwa.scss:29-52`

- [x] Address 300ms Click Delay
  Status: Implemented
  Comment: PWA styles apply `touch-action: manipulation` to primary interactive elements. No FastClick dependency is used, which is fine because the CSS approach is already present.
  Evidence: `ui-kit/src/styles/_pwa.scss:62-69`, `ui-kit/src/styles/_pwa.scss:107-110`

- [x] Hide Browser UI
  Status: Implemented
  Comment: The manifest uses `display: "standalone"` and the head includes mobile-web-app capability meta tags for installed app behavior.
  Evidence: `.vitepress/config.ts:197-237`, `.vitepress/config.ts:732-742`

- [ ] Splash Screen & App Icon
  Status: Partial
  Comment: App icons, background color, theme color, Apple touch icon, and screenshots are configured. That should cover Android-style generated splash behavior, but I did not find dedicated Apple startup images or other explicit splash assets for iOS.
  Evidence: `.vitepress/config.ts:190-245`, `.vitepress/config.ts:748-793`

## 2. Performance & Responsiveness

- [x] Aggressive Caching with Service Workers
  Status: Implemented
  Comment: The app uses Vite PWA with `generateSW`, precaches common static asset types, caches images with `CacheFirst`, caches JS/CSS with `StaleWhileRevalidate`, and applies audited runtime caching rules for API surfaces.
  Evidence: `apps/invest/.vitepress/config.ts`, `packages/invest-runtime/src/pwa/pwaPolicy.ts`

- [ ] Optimize Images & Media
  Status: Partial
  Comment: There is meaningful lazy loading, `fetchpriority`, and some `.webp` usage. However, responsive image support is not systematic: the shared `VImage` component has no built-in `srcset`, and `srcsetProp` is defined in at least one component but not used in rendering.
  Evidence: `ui-kit/src/components/Base/VImage/VImage.vue:7-19`, `ui-kit/src/components/Base/VImage/VImage.vue:70-80`, `ui-kit/src/components/VSectionTop/VSectionTopProducts2.vue:11-23`, `ui-kit/src/components/VSectionTop/VSectionTopProducts2.vue:58-73`

- [ ] Minimize JavaScript Bundles
  Status: Partial
  Comment: The repo uses a lot of async components and dynamic imports, so code splitting is clearly in place. I did not find bundle budgets, analyzer output, or explicit chunk strategy tuning, so this is not yet a complete bundle-optimization story.
  Evidence: `apps/dashboard/src/layouts/AppLayoutDefault.vue`, `apps/dashboard/src/features/dashboard/ViewDashboard.vue`, `packages/invest-shell/src/components/VDialogs.vue`

- [ ] Prioritize Critical CSS
  Status: Partial
  Comment: Font preload is implemented, but I did not find explicit critical-CSS extraction, inlining, or deferred non-critical stylesheet loading.
  Evidence: `.vitepress/config.ts:129-149`

- [ ] Accessibility (A11y)
  Status: Partial
  Comment: The codebase includes ARIA work, reduced-motion handling, and the Vue accessibility ESLint plugin. I did not find repo-wide automated accessibility tests or evidence of a systematic keyboard/contrast audit, and the PWA mode now intentionally disables zoom via `user-scalable=no` / `maximum-scale=1`, which is an accessibility anti-pattern, so this should stay marked partial.
  Evidence: `package.json`, `packages/ui-kit/src/composables/useHeaderAnchors.ts`, `packages/ui-kit/src/styles/_pwa.scss`, `packages/invest-runtime/src/pwa/disableZoom.ts`

## 3. Native-Like Features & Integration

- [ ] Push Notifications
  Status: Missing
  Comment: I did not find Web Push / Push API integration such as `PushManager`, notification permission requests, or service-worker notification handlers. The app has in-app notifications, but not browser push.
  Evidence: source search across app, runtime, shell, UI Kit, and test sources returned no Web Push API usage

- [ ] Offline Support
  Status: Partial
  Comment: IndexedDB-backed offline storage for audited GET requests is implemented, and offline mutations are intentionally blocked. I did not find an offline write queue or automatic replay/sync when the connection comes back, so this is read-only offline support rather than full sync.
  Evidence: `packages/invest-runtime/src/pwa/pwaOfflineStore.ts`, `packages/invest-data/src/apiClient.ts`, `packages/invest-runtime/src/pwa/useOfflineStatus.ts`

- [ ] Access Device Capabilities
  Status: Missing
  Comment: I did not find Geolocation, Camera / `mediaDevices`, Vibration, Device Orientation, or Device Motion APIs in the application source.
  Evidence: source search across app, runtime, shell, UI Kit, and test sources returned no matching device capability API usage

- [ ] Share Integration
  Status: Missing
  Comment: I did not find `navigator.share()` or VueUse share helpers wired into the app source.
  Evidence: source search across app, runtime, shell, UI Kit, and test sources returned no Web Share API usage

- [ ] Payment Request API
  Status: Missing
  Comment: I did not find any `PaymentRequest` usage in the current payment or checkout flows.
  Evidence: source search across app, runtime, shell, UI Kit, and test sources returned no Payment Request API usage

## 4. Security & Privacy

- [x] HTTPS Everywhere
  Status: Implemented (manual confirm)
  Comment: HSTS is configured and the preview config supports HTTPS with a local certificate, but “entire production app is served over HTTPS” is ultimately a deployment/runtime guarantee and cannot be fully proven from source alone.
  Evidence: `docs/public/_headers:3-8`, `vite.config.js`

- [ ] Content Security Policy (CSP)
  Status: Missing / needs hardening
  Comment: A CSP header exists, but it is not strict. It currently allows wildcard sources plus `'unsafe-inline'` and `'unsafe-eval'`, which is the opposite of the recommended hardened setup.
  Evidence: `docs/public/_headers:7`

## Suggested Next Priorities

- [ ] Document the intentional no-zoom PWA behavior as an accessibility exception and revisit it if WCAG-aligned zoom support becomes a requirement.
- [ ] Normalize all primary touch targets to at least `44px` or `48px`, especially shared buttons.
- [ ] Implement responsive images end-to-end with `srcset` and sizes support in `VImage`.
- [ ] Decide whether offline should remain intentionally read-only or grow into queued mutation sync.
- [ ] Replace the current permissive CSP with a strict allowlist-based policy.
- [ ] Decide whether push notifications, share integration, device APIs, and Payment Request are real product requirements or should stay out of scope.
