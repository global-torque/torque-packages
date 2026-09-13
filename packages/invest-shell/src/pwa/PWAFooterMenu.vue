<script setup lang="ts">
// @ts-nocheck
import { useInvestApplicationContext } from '@global-torque/invest-runtime/application-context';
import { computed } from 'vue';
import type { Component } from 'vue';
import { storeToRefs } from 'pinia';
import { RouterLink } from 'vue-router';

import { useProfilesStore } from '@global-torque/invest-runtime/profiles';
import { useSessionStore } from '@global-torque/invest-runtime/session';
import {
  urlFaq,
  urlHome,
  urlHowItWorks,
  urlOffers,
  urlProfilePortfolio,
  urlProfileSummary,
  urlProfileWallet,
  urlProfileEarn,
  urlProfileTabSummary,
  urlProfileTabPortfolio,
  urlProfileTabWallet,
  urlProfileTabEarn,
} from '../navigation/links.ts';
import { useNotificationsSidebarWidget } from '@global-torque/invest-widgets/notifications';

import {
  EarnMenuIcon as EarnIcon,
  FaqMenuIcon as FaqIcon,
  HelpMenuIcon as HelpIcon,
  HomeMenuIcon as HomeIcon,
  InvestmentMenuIcon as InvestmentIcon,
  PortfolioMenuIcon as PortfolioIcon,
  WalletMenuIcon as WalletIcon,
} from '@global-torque/invest-widgets/icons/navigation';

defineOptions({ name: 'PWAFooterMenu' });

type MenuContext = {
  profileId: string | number | null | undefined;
};

type MenuItemDefinition = {
  key: string;
  icon: Component;
  text: string;
  resolveTo: (context: MenuContext) => string;
  resolveActivePaths?: (context: MenuContext) => readonly string[];
};

type LayoutName = string;

type MenuItem = MenuItemDefinition & {
  isActive: boolean;
  routerTo: string | null;
  to: string;
};

const props = defineProps<{
  currentPath?: string;
  currentLayout?: LayoutName;
  useRouterLinks?: boolean;
  withBase?: (to: string) => string;
}>();

const GUEST_MENU_ITEMS: readonly MenuItemDefinition[] = [
  { key: 'home', icon: HomeIcon, text: 'Home', resolveTo: () => urlHome },
  { key: 'invest', icon: InvestmentIcon, text: 'Invest', resolveTo: () => urlOffers },
  { key: 'help', icon: HelpIcon, text: 'Help', resolveTo: () => urlHowItWorks },
  { key: 'faq', icon: FaqIcon, text: 'FAQ', resolveTo: () => urlFaq },
];

const AUTH_MENU_ITEMS: readonly MenuItemDefinition[] = [
  {
    key: 'home',
    icon: HomeIcon,
    text: 'Home',
    resolveTo: ({ profileId }) => urlProfileTabSummary(profileId),
    resolveActivePaths: ({ profileId }) => [
      urlProfileSummary(profileId),
      urlProfileTabSummary(profileId),
    ],
  },
  {
    key: 'portfolio',
    icon: PortfolioIcon,
    text: 'Portfolio',
    resolveTo: ({ profileId }) => urlProfileTabPortfolio(profileId),
    resolveActivePaths: ({ profileId }) => [
      urlProfilePortfolio(profileId),
      urlProfileTabPortfolio(profileId),
    ],
  },
  {
    key: 'invest',
    icon: InvestmentIcon,
    text: 'Invest',
    resolveTo: () => urlOffers,
  },
  {
    key: 'wallet',
    icon: WalletIcon,
    text: 'Wallet',
    resolveTo: ({ profileId }) => urlProfileTabWallet(profileId),
    resolveActivePaths: ({ profileId }) => [
      urlProfileWallet(profileId),
      urlProfileTabWallet(profileId),
    ],
  },
  {
    key: 'earn',
    icon: EarnIcon,
    text: 'Earn',
    resolveTo: ({ profileId }) => urlProfileTabEarn(profileId),
    resolveActivePaths: ({ profileId }) => [
      urlProfileEarn(profileId),
      urlProfileTabEarn(profileId),
    ],
  },
];

const sessionStore = useSessionStore();
const { userLoggedIn } = storeToRefs(sessionStore);

const profilesStore = useProfilesStore();
const { selectedUserProfileId } = storeToRefs(profilesStore);

const { isSidebarOpen } = useNotificationsSidebarWidget();

type NormalizedLocation = {
  pathname: string;
  searchParams: URLSearchParams;
};

function resolveBasePath(url: string | undefined): string | null {
  if (!url) {
    return null;
  }

  const pathname = new URL(url, 'https://pwa-footer.local').pathname;
  const normalizedPathname = pathname === '/' ? pathname : pathname.replace(/\/+$/, '') || '/';
  return normalizedPathname === '/' ? null : normalizedPathname;
}

const dashboardBasePath = resolveBasePath(useInvestApplicationContext().appConfig.urls.frontend);

function normalizePath(path: string | undefined): string {
  if (!path) {
    return '/';
  }

  const pathname = new URL(path, 'https://pwa-footer.local').pathname;
  const normalizedPathname = pathname === '/' ? pathname : pathname.replace(/\/+$/, '') || '/';

  if (!dashboardBasePath) {
    return normalizedPathname;
  }

  if (normalizedPathname === dashboardBasePath) {
    return '/';
  }

  if (normalizedPathname.startsWith(`${dashboardBasePath}/`)) {
    return normalizedPathname.slice(dashboardBasePath.length) || '/';
  }

  return normalizedPathname;
}

function normalizeLocation(path: string | undefined): NormalizedLocation {
  const source = path || '/';
  const url = new URL(source, 'https://pwa-footer.local');

  return {
    pathname: normalizePath(url.pathname),
    searchParams: url.searchParams,
  };
}

function resolveTargetLocation(to: string): NormalizedLocation {
  return normalizeLocation(props.withBase ? props.withBase(to) : to);
}

function resolveRouterTo(to: string): string | null {
  const url = new URL(to, 'https://pwa-footer.local');
  const pathname = normalizePath(url.pathname);

  if (!pathname.startsWith('/profile/')) {
    return null;
  }

  return `${pathname}${url.search}${url.hash}`;
}

function hasMatchingSearchParams(
  currentSearchParams: URLSearchParams,
  targetSearchParams: URLSearchParams,
): boolean {
  const targetEntries = Array.from(targetSearchParams.entries());

  if (!targetEntries.length) {
    return true;
  }

  return targetEntries.every(([key, value]) => currentSearchParams.get(key) === value);
}

function isPathActive(currentLocation: NormalizedLocation, paths: readonly string[]): boolean {
  return paths.some((path) => {
    const targetLocation = resolveTargetLocation(path);

    if (!hasMatchingSearchParams(currentLocation.searchParams, targetLocation.searchParams)) {
      return false;
    }

    return currentLocation.pathname === targetLocation.pathname
      || currentLocation.pathname.startsWith(`${targetLocation.pathname}/`);
  });
}

const currentLocation = computed(() => {
  const fallbackPath = typeof window !== 'undefined'
    ? `${window.location.pathname}${window.location.search}${window.location.hash}`
    : '/';
  return normalizeLocation(props.currentPath ?? fallbackPath);
});

const menuDefinitions = computed(() => (
  userLoggedIn.value ? AUTH_MENU_ITEMS : GUEST_MENU_ITEMS
));

const menuItems = computed<MenuItem[]>(() => {
  const context: MenuContext = { profileId: selectedUserProfileId.value };

  return menuDefinitions.value.map((item) => {
    const to = item.resolveTo(context);
    const activePaths = item.resolveActivePaths?.(context) ?? [to];
    const isActive = isPathActive(currentLocation.value, activePaths);
    const routerTo = resolveRouterTo(to);

    return {
      ...item,
      to,
      routerTo,
      isActive,
    };
  });
});

const menuColumnClass = computed(() => (
  menuItems.value.length === AUTH_MENU_ITEMS.length
    ? 'pwa-footer-menu__list--cols-5'
    : 'pwa-footer-menu__list--cols-4'
));

const shouldHideMenu = computed(() => (
  isSidebarOpen.value
));
</script>

<template>
  <nav
    v-if="!shouldHideMenu"
    class="PWAFooterMenu pwa-footer-menu"
    role="navigation"
    aria-label="PWA Bottom Menu"
  >
    <ul :class="['pwa-footer-menu__list', menuColumnClass]">
      <li
        v-for="item in menuItems"
        :key="item.key"
        class="pwa-footer-menu__item"
      >
        <RouterLink
          v-if="props.useRouterLinks && item.routerTo"
          :to="item.routerTo"
          :class="['pwa-footer-menu__link', { 'pwa-footer-menu__link--active': item.isActive }]"
          :aria-current="item.isActive ? 'page' : undefined"
        >
            <component
              :is="item.icon"
              class="pwa-footer-menu__icon"
              aria-hidden="true"
            />
            <span class="pwa-footer-menu__label is--small">
              {{ item.text }}
            </span>
        </RouterLink>
        <a
          v-else
          :href="item.to"
          :class="['pwa-footer-menu__link', { 'pwa-footer-menu__link--active': item.isActive }]"
          :aria-current="item.isActive ? 'page' : undefined"
        >
          <component
            :is="item.icon"
            class="pwa-footer-menu__icon"
            aria-hidden="true"
          />
          <span class="pwa-footer-menu__label is--small">
            {{ item.text }}
          </span>
        </a>
      </li>
    </ul>
  </nav>
</template>

<style scoped lang="scss">
:global(:root) {
  --pwa-footer-safe-offset: 67px;
}

:host,
.pwa-footer-menu {
  --pwa-footer-menu-background: var(--ui-color-surface, var(--background));
  --pwa-footer-menu-border-color: color-mix(in srgb, var(--ui-color-surface, var(--background)) 5%, transparent);
  --pwa-footer-menu-border-radius: 2px;
  --pwa-footer-menu-shadow: var(--ui-shadow-raised, 0 6px 7px -4px rgb(18 22 31 / 5%), 0 10px 32px 4px rgb(18 22 31 / 10%));
  --pwa-footer-menu-color: #{var(--muted-foreground)};
  --pwa-footer-menu-link-active-background: #{var(--accent)};
  --pwa-footer-menu-label-active-color: var(--ui-color-surface-inverse-muted, #1A202D);
}

@media (width <= 768px) {
  body.pwa-standalone .pwa-footer-menu {
    display: block;
  }
}

.pwa-footer-menu {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: block;
  padding-inline: 0;
  padding-bottom: 0; //calc(12px + env(safe-area-inset-bottom))
  z-index: 110;
  pointer-events: none;
}

.pwa-footer-menu--hidden {
  display: none;
}

.pwa-footer-menu__list {
  pointer-events: auto;
  display: grid;
  gap: 11px;
  margin: 0;
  padding: 4px 6px;
  list-style: none;
  color: var(--pwa-footer-menu-color);
  background: var(--pwa-footer-menu-background);
  border: 1px solid var(--pwa-footer-menu-border-color);
  border-radius: var(--pwa-footer-menu-border-radius);
  box-shadow: var(--pwa-footer-menu-shadow);
  backdrop-filter: blur(6px);
}

.pwa-footer-menu__list--cols-5 {
  grid-template-columns: repeat(5, 1fr);
}

.pwa-footer-menu__list--cols-4 {
  grid-template-columns: repeat(4, 1fr);
}

.pwa-footer-menu__item {
  display: flex;
}

.pwa-footer-menu__link {
  display: flex;
  width: 100%;
  padding: 8px 0;
  border-radius: 12px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: inherit;
  text-decoration: none;
  transition: background 0.2s ease, color 0.2s ease;
}

.pwa-footer-menu__link--active {
  background: var(--pwa-footer-menu-link-active-background);
  color: var(--foreground);
}

.pwa-footer-menu__icon {
  display: block;
  width: 20px;
  height: 20px;
  margin-bottom: 3px;
  color: inherit;
}

.pwa-footer-menu__link--active .pwa-footer-menu__label {
  font-weight: 600;
  color: var(--pwa-footer-menu-label-active-color);
}

.pwa-footer-menu__notification-badge {
  top: 4px;
  right: 50%;
  transform: translateX(calc(50% + 8px));
}
</style>
