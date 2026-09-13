# Framework asset inventory

This is the source and rights inventory for framework candidate `0.2.2`.
Counts cover regular asset files (`svg`, `webp`, raster images, and font
files) under the seven framework packages.

The pinned producer is
`global-torque/dashboard.webdevelop.biz@9f35aa0882b765e202538ce7c7d5e82eb1b452d3`.
That revision contains 111 framework asset paths. The initial candidate
retained 105 paths after excluding the six private brand paths listed below.
The FW07 cleanup removes 11 unused paths and moves 13 unresolved third-party
marks to host-owned application source, leaving 81 package-owned paths. Every
retained path has the same relative producer path and was byte-comparison
checked against that revision.

## Disposition

| Disposition | Count | Rule |
| --- | ---: | --- |
| Framework source under this repository's MIT grant | 81 | Generic UI illustrations, controls, and package-owned assets retained at their producer paths. |
| Third-party marks moved to host-owned source | 13 | Social login and social-network marks are removed from the package; exact source provenance and host transfer are recorded below. |
| Retained regular assets | 81 | The exact package candidate inventory below. |
| Initial producer paths excluded as private brand material | 6 | Excluded before candidate packaging; host applications own their brand bytes and logo URLs. |
| Unused/unresolved paths removed by FW07 | 11 | No source, CSS, barrel, wildcard consumer, or current application reference; no public rights basis justified retention. |

The MIT disposition applies to the framework source files and generic retained
assets through each package's `LICENSE` and `NOTICE.md`. It does not grant
rights to social-network marks, host brand assets, fonts, service destinations,
or product trademarks. The host applications keep their static brand and
social image paths.

## Retained framework-owned asset paths (81)

These paths are copied from the pinned producer under the source package MIT
grant:

- `packages/invest-features/src/auth/assets/logout-modal.svg`
- `packages/invest-features/src/offers/assets/default.svg`
- `packages/invest-shell/src/assets/images/check.svg`
- `packages/invest-shell/src/assets/images/copy.svg`
- `packages/invest-shell/src/assets/images/icons/add-funds.svg`
- `packages/invest-shell/src/assets/images/icons/buy.svg`
- `packages/invest-shell/src/assets/images/icons/pen.svg`
- `packages/invest-shell/src/assets/images/icons/user.svg`
- `packages/invest-shell/src/assets/images/sign-left.svg`
- `packages/invest-shell/src/components/VErrorPage/404.svg`
- `packages/invest-shell/src/components/VErrorPage/500.svg`
- `packages/invest-shell/src/components/VErrorPage/illustration-404.svg`
- `packages/invest-shell/src/pwa/assets/pwa-login-arrow.svg`
- `packages/invest-widgets/src/icons/images/arrow-down.svg`
- `packages/invest-widgets/src/icons/images/arrow-left-primary.svg`
- `packages/invest-widgets/src/icons/images/arrow-left.svg`
- `packages/invest-widgets/src/icons/images/arrow-right-primary.svg`
- `packages/invest-widgets/src/icons/images/arrow-right.svg`
- `packages/invest-widgets/src/icons/images/arrow-up.svg`
- `packages/invest-widgets/src/icons/images/backgrounds/cell-bottom-left.svg`
- `packages/invest-widgets/src/icons/images/backgrounds/cell-bottom-left.webp`
- `packages/invest-widgets/src/icons/images/backgrounds/cell-top-right.svg`
- `packages/invest-widgets/src/icons/images/backgrounds/cell-top-right.webp`
- `packages/invest-widgets/src/icons/images/backgrounds/dots.svg`
- `packages/invest-widgets/src/icons/images/bank.svg`
- `packages/invest-widgets/src/icons/images/calendar.svg`
- `packages/invest-widgets/src/icons/images/check.svg`
- `packages/invest-widgets/src/icons/images/chevron-down.svg`
- `packages/invest-widgets/src/icons/images/chevron-right.svg`
- `packages/invest-widgets/src/icons/images/chevron-up.svg`
- `packages/invest-widgets/src/icons/images/circle-check.svg`
- `packages/invest-widgets/src/icons/images/circle-exclamation.svg`
- `packages/invest-widgets/src/icons/images/circle-info.svg`
- `packages/invest-widgets/src/icons/images/circle-question.svg`
- `packages/invest-widgets/src/icons/images/close.svg`
- `packages/invest-widgets/src/icons/images/default.svg`
- `packages/invest-widgets/src/icons/images/download.svg`
- `packages/invest-widgets/src/icons/images/expand.svg`
- `packages/invest-widgets/src/icons/images/external-link.svg`
- `packages/invest-widgets/src/icons/images/eye-off.svg`
- `packages/invest-widgets/src/icons/images/eye.svg`
- `packages/invest-widgets/src/icons/images/file.svg`
- `packages/invest-widgets/src/icons/images/filter.svg`
- `packages/invest-widgets/src/icons/images/howWeCanAssist/gear.svg`
- `packages/invest-widgets/src/icons/images/howWeCanAssist/puzzle.svg`
- `packages/invest-widgets/src/icons/images/menu-mob.svg`
- `packages/invest-widgets/src/icons/images/menu_common/crypto1.svg`
- `packages/invest-widgets/src/icons/images/menu_common/crypto2.svg`
- `packages/invest-widgets/src/icons/images/menu_common/faq.svg`
- `packages/invest-widgets/src/icons/images/menu_common/gear.svg`
- `packages/invest-widgets/src/icons/images/menu_common/grid.svg`
- `packages/invest-widgets/src/icons/images/menu_common/help.svg`
- `packages/invest-widgets/src/icons/images/menu_common/home.svg`
- `packages/invest-widgets/src/icons/images/menu_common/investments.svg`
- `packages/invest-widgets/src/icons/images/menu_common/logout.svg`
- `packages/invest-widgets/src/icons/images/menu_common/notifications.svg`
- `packages/invest-widgets/src/icons/images/menu_common/percent.svg`
- `packages/invest-widgets/src/icons/images/menu_common/portfolio.svg`
- `packages/invest-widgets/src/icons/images/menu_common/user.svg`
- `packages/invest-widgets/src/icons/images/menu_common/wallet.svg`
- `packages/invest-widgets/src/icons/images/message.svg`
- `packages/invest-widgets/src/icons/images/pen.svg`
- `packages/invest-widgets/src/icons/images/plus.svg`
- `packages/invest-widgets/src/icons/images/pwa_specific/crypto-wallet.svg`
- `packages/invest-widgets/src/icons/images/pwa_specific/dashboard.svg`
- `packages/invest-widgets/src/icons/images/pwa_specific/dashboard__.svg`
- `packages/invest-widgets/src/icons/images/pwa_specific/faq.svg`
- `packages/invest-widgets/src/icons/images/pwa_specific/faq_.svg`
- `packages/invest-widgets/src/icons/images/pwa_specific/help.svg`
- `packages/invest-widgets/src/icons/images/pwa_specific/home.svg`
- `packages/invest-widgets/src/icons/images/pwa_specific/info_.svg`
- `packages/invest-widgets/src/icons/images/pwa_specific/investment.svg`
- `packages/invest-widgets/src/icons/images/pwa_specific/notification.svg`
- `packages/invest-widgets/src/icons/images/pwa_specific/wallet.svg`
- `packages/invest-widgets/src/icons/images/search.svg`
- `packages/invest-widgets/src/icons/images/share.svg`
- `packages/invest-widgets/src/icons/images/sign-right.svg`
- `packages/invest-widgets/src/icons/images/three-dots.svg`
- `packages/invest-widgets/src/icons/images/timeline.svg`
- `packages/invest-widgets/src/icons/images/upload.svg`
- `packages/invest-widgets/src/icons/images/user.svg`

## Host-owned third-party mark paths (13)

These files were needed by the exported social-login/socials surfaces in the
producer, and are now removed from the public framework. The
exact source is the private `spec.webdevelop.biz/ui-kit` tree, projected into
the pinned producer by the following source commits:

- social-login icons: `global-torque/webdevelop-platform@37eab6bdc04b4f2f67f93c31e49c503b1ac9e750`
- social-link icons: `global-torque/spec.webdevelop.biz/ui-kit@3d21b007f027425c62545d5e315e2fb1edf42a39`
- projection into the producer candidate: `global-torque/webdevelop-platform@1751a12ee91c3e9e18508d8856224a298a4123ce`

Neither source tree carries a per-file license, trademark grant, or host
destination authorization for these bytes. The package MIT notice covers the
framework source transfer only. This is a provenance record, not a rights
finding. The applications must own the bytes and their use before promotion.

- `packages/invest-widgets/src/icons/images/social-login/facebook-hover.svg`
- `packages/invest-widgets/src/icons/images/social-login/facebook1.svg`
- `packages/invest-widgets/src/icons/images/social-login/github1-hover.svg`
- `packages/invest-widgets/src/icons/images/social-login/github1.svg`
- `packages/invest-widgets/src/icons/images/social-login/google1-hover.svg`
- `packages/invest-widgets/src/icons/images/social-login/google1.svg`
- `packages/invest-widgets/src/icons/images/social-login/linkedin-hover.svg`
- `packages/invest-widgets/src/icons/images/social-login/linkedin1.svg`
- `packages/invest-widgets/src/socials/assets/facebook.svg`
- `packages/invest-widgets/src/socials/assets/github.svg`
- `packages/invest-widgets/src/socials/assets/instagram.svg`
- `packages/invest-widgets/src/socials/assets/linkedin.svg`
- `packages/invest-widgets/src/socials/assets/x-twitter.svg`

## Excluded producer brand paths (6)

These producer paths were never copied into the candidate:

- `packages/invest-shell/src/assets/images/logo-black.svg`
- `packages/invest-shell/src/assets/images/logo-mark-black.svg`
- `packages/invest-shell/src/assets/images/logo-mark-white.svg`
- `packages/invest-shell/src/assets/images/logo-white.svg`
- `packages/invest-widgets/src/comments/assets/logo-mob.svg`
- `packages/invest-widgets/src/icons/images/logo.svg`

## FW07 unused cleanup paths (11)

These paths were removed after checking source imports, CSS URLs, package
barrels, wildcard exports, and current application consumers:

- `packages/invest-widgets/src/icons/images/wordmark.svg`
- `packages/invest-widgets/src/icons/images/vue.svg`
- `packages/invest-shell/src/assets/images/social/facebook1.svg`
- `packages/invest-shell/src/assets/images/social/github1.svg`
- `packages/invest-shell/src/assets/images/social/instagram1.svg`
- `packages/invest-shell/src/assets/images/social/linkedin1.svg`
- `packages/invest-shell/src/assets/images/social/x-twitter.svg`
- `packages/invest-widgets/src/socials/assets/email.svg`
- `packages/invest-widgets/src/socials/assets/phone.svg`
- `packages/invest-widgets/src/socials/assets/telegram.svg`
- `packages/invest-widgets/src/socials/assets/twitter.svg`

## Recheck commands

Run from the package repository root:

```sh
find packages -type f \( -iname '*.svg' -o -iname '*.png' -o -iname '*.jpg' \
  -o -iname '*.jpeg' -o -iname '*.webp' -o -iname '*.gif' -o -iname '*.woff' \
  -o -iname '*.woff2' -o -iname '*.ttf' -o -iname '*.otf' \) -print | sort
rg -n -i --hidden --glob '!**/.git/**' --glob '!**/node_modules/**' \
  'logo-mob\.svg|icons/images/logo\.svg|wordmark\.svg|comments/index\.scss' \
  packages scripts
```

The first command must return exactly 81 paths. The second command must return
no framework source reference (the inventory document itself intentionally
lists the removed paths). A source-side byte comparison must compare each
retained path with the same path in the pinned producer revision before G1.

## Host-ownership contract for the 13 marks

The accepted host-ownership contract removes these bytes from the package and
requires the applications to supply them:

1. Copy the exact social-login variants used by `VFormAuthSocial` and the
   exact social-link variants used by `VSocialLinks` into each application's
   public `images/social-login/` and `images/social/` directories. Preserve
   the existing visual bytes and the application-configured destination URLs.
2. Pass a required typed `socialIcons` map to `VFormAuthSocial` and
   `VDialogRefreshSession`; pass a required five-network `socialIcons` map to
   `OffersDetails`. These components preserve provider order, normal/hover
   nodes, visible labels, and existing events.
3. Keep `SocialLink.icon` host supplied. `resolveSocialList` preserves the
   supplied icon, destination, and custom network metadata; the package keeps
   only neutral network names and share URL templates.
4. Record the application paths, SHA-256 transfer digests, and rights owner
   outside this package repository, then re-run the 81-path inventory and
   packed consumer checks.

The application owners implement the exact SVG copy and maps. Promotion waits
for their transfer record and the corresponding browser checks.
