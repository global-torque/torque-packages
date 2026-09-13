<script setup lang="ts">
import { useInvestApplicationContext } from '@global-torque/invest-runtime/application-context';
import {
  computed, defineAsyncComponent, hydrateOnVisible, onMounted, PropType, ref, type Component,
} from 'vue';
import { storeToRefs } from 'pinia';
import { Skeleton } from '@global-torque/ui-primitives/skeleton';
import { navigateWithQueryParams } from '@global-torque/invest-runtime/navigation';
import {
  urlFaq,
  urlHome,
  urlHowItWorks,
  urlNotifications,
  urlProfileAccount,
  urlProfileEarn,
  urlOffers,
  urlProfileCryptoWallet,
  urlProfilePortfolio,
  urlProfileSummary,
  urlProfileWallet,
  urlSignin,
  urlSignup,
} from '../navigation/links.ts';
import VHeaderAuthorized from '../components/VHeaderBar/VHeaderAuthorized.vue';
import VHeaderGuest from '../components/VHeaderBar/VHeaderGuest.vue';
import { ArrowLeftIcon as ArrowLeft } from '@global-torque/invest-widgets/icons/navigation';
import PwaLoginArrow from './assets/pwa-login-arrow.svg';
import NotificationsSidebarButton from '@global-torque/invest-widgets/notifications/VNotificationsSidebarButton.vue';
import { useProfilesStore } from '@global-torque/invest-runtime/profiles';
import VLogo from '../components/VLogo.vue';
import { Button } from '@global-torque/ui-primitives/button';
import VSidebarTrigger from '../components/Sidebar07/components/VSidebarTrigger.vue';
import { useHeaderUserState } from './useHeaderUserState.ts';

type MenuItem = {
  name?: string;
  href?: string;
  to?: string;
  text: string;
  children?: MenuItem[];
  link?: string;
  active?: boolean;
  class?: string;
  icon?: Component;
};

const VHeaderProfilePWA = defineAsyncComponent({
  loader: () => import('./VHeaderProfilePWA.vue'),
  hydrate: hydrateOnVisible(),
});
const VHeaderProfileMobile = defineAsyncComponent({
  loader: () => import('../components/VHeader/VHeaderProfileMobile.vue'),
  hydrate: hydrateOnVisible(),
});
const props = defineProps({
  profileMenu: Array as PropType<MenuItem[]>,
  path: {
    type: String,
    default: '',
  },
  showProfileLink: {
    type: Boolean,
    default: false,
  },
  urlProfile: {
    type: [String, Function] as PropType<string | (() => string)>,
    default: '',
  },
  layout: {
    type: String,
    default: '',
  },
  showSidebarTrigger: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  signInHref: {
    type: String,
    default: '',
  },
  signUpHref: {
    type: String,
    default: '',
  },
  suppressAuthenticatedAccountControls: {
    type: Boolean,
    default: false,
  },
});

const isMobileAppShell = true;
const USER_MENU_QUERY_KEY = 'fromUserMenu';
const USER_MENU_QUERY_VALUE = '1';
const USER_MENU_FROM_QUERY_KEY = 'menuFrom';
const USER_MENU_OPEN_QUERY_KEY = 'openUserMenu';
const OPEN_PWA_PROFILE_OVERLAY_EVENT = 'invest:pwa-profile-overlay:open';
const runtimePath = ref('');
onMounted(() => {
  runtimePath.value = window.location.pathname;
});

const { userLoggedIn, isUserLoading: isLoading } = useHeaderUserState();
const profilesStore = useProfilesStore();
const { selectedUserProfileId } = storeToRefs(profilesStore);
const applicationConfig = useInvestApplicationContext().appConfig;
const IS_STATIC_SITE = String(applicationConfig.isStaticSite ?? '') ?? '';

const isMobileSidebarOpen = defineModel<boolean>();

const resolvedPath = computed(() => props.path || runtimePath.value);
const isSignUpPage = computed(() => props.layout === 'auth-signup' || resolvedPath.value?.includes('signup'));
const isSignInPage = computed(() => props.layout === 'auth-login' || resolvedPath.value?.includes('signin'));
const isRecoveryPage = computed(() => props.layout === 'auth-forgot' || resolvedPath.value?.includes('forgot'));
const isCheckEmailPage = computed(() => props.layout === 'auth-check-email' || resolvedPath.value?.includes('check-email'));
const isAuthenticatorPage = computed(() => props.layout === 'auth-authenticator' || resolvedPath.value?.includes('authenticator'));
const isKYCBoPage = computed(() => props.layout?.includes('kyc-bo') || resolvedPath.value?.includes('kyc-bo'));
const isOfferDetailsPage = computed(() => props.layout === 'offer-single');
const isAuthFlowPage = computed(() => (isRecoveryPage.value || isCheckEmailPage.value));

const showNavigation = computed(() => (
  !isSignInPage.value && !isSignUpPage.value && !isRecoveryPage.value
  && !isCheckEmailPage.value && !isAuthenticatorPage.value && !isKYCBoPage.value));

const showPwaLoginLink = computed(() => (
  !userLoggedIn.value
  && !isSignInPage.value
  && !isSignUpPage.value
  && !isAuthFlowPage.value
  && !isAuthenticatorPage.value
  && !isKYCBoPage.value
  && !isOfferDetailsPage.value
));
const showPwaNotifications = computed(() => (
  userLoggedIn.value
  && !props.suppressAuthenticatedAccountControls
  && !isAuthenticatorPage.value
  && !isKYCBoPage.value
  && !isOfferDetailsPage.value
));
const showSidebarLeadingTrigger = computed(() => (
  props.showSidebarTrigger
  && userLoggedIn.value
  && !props.suppressAuthenticatedAccountControls
  && !showPwaBackButton.value
));
const showPwaAuthCta = computed(() => (
  !userLoggedIn.value
  && (isSignInPage.value || isSignUpPage.value)
  && !isOfferDetailsPage.value
));

const normalizePath = (path: string) => {
  const trimmed = path.split('#')[0].split('?')[0];
  let normalized = trimmed.replace(/\/+$/, '');
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`;
  }
  if (normalized === '/index') {
    return '/';
  }
  return normalized || '/';
};

const getPathname = (url: string) => {
  if (typeof window === 'undefined') {
    return normalizePath(url);
  }
  try {
    return normalizePath(new URL(url, window.location.origin).pathname);
  }
  catch {
    return normalizePath(url);
  }
};

const getProfileSectionKey = (pathname: string) => {
  const match = pathname.match(/\/profile\/[^/]+\/([^/]+)/);
  return match ? `profile/${match[1]}` : null;
};

const isEarnDetailsPath = (pathname: string) => (
  /\/profile\/[^/]+\/earn\/[^/]+\/[^/]+$/.test(pathname)
);

const pwaRootPaths = computed(() => {
  if (!userLoggedIn.value) {
    return [
      urlHome,
      urlOffers,
      urlHowItWorks,
      urlFaq,
    ].map(getPathname);
  }

  const profileId = Number(selectedUserProfileId.value);
  const profilePaths = Number.isFinite(profileId)
    ? [
        urlProfileSummary(profileId),
        urlProfilePortfolio(profileId),
        urlProfileAccount(profileId),
        urlProfileWallet(profileId),
        urlProfileCryptoWallet(profileId),
        urlProfileEarn(profileId),
      ]
    : [];

  return [
    ...profilePaths,
    urlOffers,
    urlNotifications,
  ].map(getPathname);
});

const currentPath = computed(() => {
  const rawPath = resolvedPath.value
    || (typeof window !== 'undefined' ? window.location.pathname : '/');
  return normalizePath(rawPath);
});
const isFromUserMenu = computed(() => {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.location.search.includes(`${USER_MENU_QUERY_KEY}=${USER_MENU_QUERY_VALUE}`);
});

const showPwaBackButton = computed(() => {
  if (props.layout === 'auth-login' || props.layout === 'auth-signup') {
    return false;
  }
  if (userLoggedIn.value && props.layout === 'home') {
    return false;
  }

  const current = currentPath.value;
  if (current === '/') {
    return false;
  }
  if (pwaRootPaths.value.includes(current)) {
    return false;
  }
  if (isEarnDetailsPath(current)) {
    return true;
  }

  const currentProfileSection = getProfileSectionKey(current);
  if (!currentProfileSection) {
    return true;
  }

  const rootProfileSections = pwaRootPaths.value
    .map(getProfileSectionKey)
    .filter(Boolean) as string[];

  return !rootProfileSections.includes(currentProfileSection);
});

const queryParams = computed(() => new URLSearchParams(
  typeof window !== 'undefined' ? window.location.search : '',
));
const showMobileSidebar = computed(() => (
  showNavigation.value
  && userLoggedIn.value
  && !props.suppressAuthenticatedAccountControls
  && !props.showSidebarTrigger
));

const signInHandler = () => {
  if (props.disabled) return;
  if (props.signInHref) {
    navigateWithQueryParams(props.signInHref);
    return;
  }
  const paramsObj: Record<string, string> = {};
  queryParams.value.forEach((value, key) => {
    paramsObj[key] = value;
  });
  navigateWithQueryParams(urlSignin, paramsObj);
};

const signUpHandler = () => {
  if (props.disabled) return;
  if (props.signUpHref) {
    navigateWithQueryParams(props.signUpHref);
    return;
  }
  const paramsObj: Record<string, string> = {};
  queryParams.value.forEach((value, key) => {
    paramsObj[key] = value;
  });
  navigateWithQueryParams(urlSignup, paramsObj);
};

const backHandler = () => {
  if (typeof window === 'undefined') {
    return;
  }
  if (userLoggedIn.value && isFromUserMenu.value) {
    const params = new URLSearchParams(window.location.search);
    const sourcePath = params.get(USER_MENU_FROM_QUERY_KEY);
    if (sourcePath) {
      try {
        const sourceUrl = new URL(sourcePath, window.location.origin);
        sourceUrl.searchParams.set(USER_MENU_OPEN_QUERY_KEY, USER_MENU_QUERY_VALUE);
        window.location.assign(`${sourceUrl.pathname}${sourceUrl.search}${sourceUrl.hash}`);
        return;
      }
      catch {
        // fallback to local overlay open
      }
    }
    window.dispatchEvent(new Event(OPEN_PWA_PROFILE_OVERLAY_EVENT));
    return;
  }
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  navigateWithQueryParams(urlHome);
};
const headerComponent = computed(() => (
  userLoggedIn.value ? VHeaderAuthorized : VHeaderGuest
));
</script>

<template>
  <component
    :is="headerComponent"
    v-model="isMobileSidebarOpen"
    :show-navigation="showNavigation"
    :show-mobile-sidebar="showMobileSidebar"
    :is-mobile-p-w-a="isMobileAppShell"
    :show-profile-link="false"
    :url-profile="urlProfile"
    :user-logged-in="userLoggedIn"
    class="VHeaderInvest v-header-invest"
  >
    <template #leading>
      <button
        v-if="showPwaBackButton"
        type="button"
        class="v-header-invest__pwa-back"
        aria-label="Go back"
        @click="backHandler"
      >
        <component
          :is="ArrowLeft"
          class="v-header-invest__pwa-back-icon"
          aria-hidden="true"
        />
      </button>
    </template>
    <template #logo>
      <VSidebarTrigger
        v-if="showSidebarLeadingTrigger"
        class="v-header-invest__pwa-sidebar-trigger"
      >
        <span
          v-if="showPwaBackButton || isOfferDetailsPage"
          class="v-header-invest__pwa-logo-empty"
          aria-hidden="true"
        />
        <VHeaderProfilePWA
          v-else-if="userLoggedIn && !suppressAuthenticatedAccountControls"
          :interactive="false"
        />
      </VSidebarTrigger>
      <span
        v-else-if="showPwaBackButton || isOfferDetailsPage"
        class="v-header-invest__pwa-logo-empty"
        aria-hidden="true"
      />
      <VHeaderProfilePWA
        v-else-if="userLoggedIn && !suppressAuthenticatedAccountControls"
      />
      <VLogo
        v-else
        :href="urlHome"
        :brand-name="applicationConfig.brand.title"
        :show-desktop="false"
        class="v-header__logo v-header-invest__pwa-logo"
      />
    </template>
    <VHeaderProfilePWA
      v-if="userLoggedIn && !suppressAuthenticatedAccountControls && showPwaBackButton && isFromUserMenu && !isOfferDetailsPage"
      class="v-header-invest__pwa-profile-listener"
      aria-hidden="true"
    />
    <div class="v-header-invest__wrap">
      <Skeleton
        v-if="isLoading"
        class="v-header-invest-btns__skeleton"
        :style="{ width: '250px', height: '25px' }"
      />
    </div>

    <template
      v-if="!isOfferDetailsPage"
      #pwa
    >
      <button
        v-if="showPwaLoginLink"
        type="button"
        :disabled="disabled"
        class="v-header-invest__pwa-login"
        @click="signInHandler"
      >
        <span>Log in</span>
        <component
          :is="PwaLoginArrow"
          class="v-header-invest__pwa-login-icon"
          aria-hidden="true"
        />
      </button>
      <div
        v-else-if="showPwaNotifications"
        class="v-header-invest__pwa-notifications"
      >
        <NotificationsSidebarButton
          :is-static-site="IS_STATIC_SITE"
          :show-icon="true"
        />
      </div>
      <div
        v-else-if="showPwaAuthCta"
        class="v-header-invest__pwa-auth"
      >
        <span class="v-header-invest__pwa-auth-text">
          {{ isSignInPage ? "Don't have an account?" : 'Already have an account?' }}
        </span>
        <Button
          type="button"
          :disabled="disabled"
          class="v-header-invest__pwa-auth-btn"
          :class="{ 'is--secondary': isSignInPage }"
          @click="isSignInPage ? signUpHandler() : signInHandler()"
        >
          {{ isSignInPage ? 'Sign Up' : 'Log In' }}
        </Button>
      </div>
    </template>

    <template
      v-if="!isOfferDetailsPage"
      #mobile
    >
      <VHeaderProfileMobile
        v-if="userLoggedIn && !suppressAuthenticatedAccountControls"
        :menu="profileMenu"
        :is-mobile-pwa="true"
        @click="isMobileSidebarOpen = false"
      />
    </template>
  </component>
</template>

<style lang="scss">
@use '@global-torque/ui-kit/styles/mixins' as *;

.v-header-invest {

  .is--container {
    max-width: 1280px;
  }

  &__wrap {
    display: flex;
    align-items: center;
    gap: 13px;
  }

  [data-slot='navigation-menu-link'] {
    height: 64px;
    align-content: center;
    display: flex;
    align-items: center;
  }

  &__button {
    flex-shrink: 0;

    @include media-lte(desktop-md) {
      display: none !important;
    }
  }

  &-btns {
    display: flex;
    gap: 8px;
    flex-shrink: 0;

    &__sign-in,
    &__sign-up {
      flex-shrink: 0;
    }

    @media screen and (width < 1024px){
      flex-direction: column;
    }

    &.wd-header-sign-in,
    &.wd-header-sign-up {
      @include media-lte(desktop-md) {
        display: block;
      }
    }
  }

  &__auth-text {
    color: var(--ui-color-text-secondary, #343A40);
    font-size: 14px;
    line-height: 20px;
  }

  &__pwa-login:not([data-slot]) {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: none;
    background: transparent;
    padding: 4px 8px;
    color: var(--primary);
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
    cursor: pointer;
  }

  &__pwa-login-icon {
    width: 16px;
    height: 16px;
  }

  &__pwa-logout {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    padding: 0;
    color: var(--ui-color-text-secondary, #343A40);
    cursor: pointer;
  }

  &__pwa-logout-icon {
    width: 20px;
    height: 20px;
  }

  &__pwa-notifications {
    display: inline-flex;
    align-items: center;
    justify-content: center;

    .notifications-sidebar-button {
      padding: 0;
    }

    .notifications-sidebar-button__label {
      display: none;
    }

    .notifications-sidebar-button__notification-icon {
      margin-right: 0;
      color: var(--ui-color-text-secondary, #343A40);
      width: 24px;
      height: 24px;
    }

    .notifications-sidebar-button__badge {
      top: -6px;
      left: auto;
      right: -8px;
    }
  }

  &__pwa-sidebar-trigger {
    min-width: 0;
  }

  &__pwa-back {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    padding: 0;
    color: var(--ui-color-text-secondary, #343A40);
    cursor: pointer;
  }

  &__pwa-back-icon {
    width: 20px;
    height: 20px;
  }

  &__pwa-auth {
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--ui-color-text-secondary, #343A40);
  }

  &__pwa-auth-text {
    font-size: 14px;
    line-height: 20px;
  }

  &__pwa-auth-btn {
    flex-shrink: 0;
  }

  &__pwa-profile-listener {
    display: none;
  }
}

  .v-header-mobile__list {
    border-top: none !important;
  }

.v-header-invest.is--pwa {
  @media screen and (width <= 768px) {
    .v-header__logo.v-header-invest__pwa-logo {
      position: static;
      transform: none;
      margin-right: 0;
    }
  }
}
</style>
