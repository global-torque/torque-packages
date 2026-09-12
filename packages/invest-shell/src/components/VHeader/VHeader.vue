<script setup lang="ts">
// @ts-nocheck
import {
  computed, defineAsyncComponent, PropType,
} from 'vue';
import { Skeleton } from '@global-torque/ui-primitives/skeleton';
import { navigateWithQueryParams } from '@webdevelop-pro/invest-runtime/navigation';
import {
  urlSignin,
  urlSignup,
} from '../../navigation/links.ts';
import VHeaderProfile from './VHeaderProfile.vue';
import VHeaderAuthorized from '../VHeaderBar/VHeaderAuthorized.vue';
import VHeaderGuest from '../VHeaderBar/VHeaderGuest.vue';
import { Button } from '@global-torque/ui-primitives/button';
import type { MenuItem } from '../../navigation/types.ts';
import { useBreakpoints } from '@global-torque/ui-kit/breakpoints';
import { useHeaderUserState } from './useHeaderUserState.ts';

const VHeaderProfileMobile = defineAsyncComponent({
  loader: () => import('./VHeaderProfileMobile.vue'),
});
const props = defineProps({
  profileMenu: Array as PropType<MenuItem[]>,
  // Header navigation menu (e.g. Explore, How It Works, etc.)
  menu: Array as PropType<MenuItem[]>,
  mobileMenu: Array as PropType<MenuItem[]>,
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

const { isDesktopMD } = useBreakpoints();
const { userLoggedIn, isUserLoading: isLoading } = useHeaderUserState();

const isMobileSidebarOpen = defineModel<boolean>({ default: false });

const resolvedPath = computed(() => {
  if (props.path) {
    return props.path;
  }

  if (typeof window !== 'undefined') {
    return window.location.pathname;
  }

  return '';
});

const isSignUpPage = computed(
  () => props.layout === 'auth-signup' || resolvedPath.value?.includes('signup'),
);
const isSignInPage = computed(
  () => props.layout === 'auth-login' || resolvedPath.value?.includes('signin'),
);
const isRecoveryPage = computed(
  () => props.layout === 'auth-forgot' || resolvedPath.value?.includes('forgot'),
);
const isCheckEmailPage = computed(
  () => props.layout === 'auth-check-email' || resolvedPath.value?.includes('check-email'),
);
const isAuthenticatorPage = computed(
  () => props.layout === 'auth-authenticator' || resolvedPath.value?.includes('authenticator'),
);
const isKYCBoPage = computed(
  () => props.layout?.includes('kyc-bo') || resolvedPath.value?.includes('kyc-bo'),
);

const isAuthFlowPage = computed(
  () => isRecoveryPage.value || isCheckEmailPage.value,
);

const showNavigation = computed(
  () => !isSignInPage.value
    && !isSignUpPage.value
    && !isRecoveryPage.value
    && !isCheckEmailPage.value
    && !isAuthenticatorPage.value
    && !isKYCBoPage.value,
);

const desktopMenu = computed(() => (
  isDesktopMD.value || !userLoggedIn.value ? props.menu : []
));

const showAccountText = computed(
  () => !userLoggedIn.value
    && !showNavigation.value
    && !isAuthenticatorPage.value
    && !isKYCBoPage.value,
);

const showHaveAccount = computed(
  () => !isSignInPage.value && !isAuthFlowPage.value,
);

const showDontHaveAccount = computed(
  () => !isSignUpPage.value,
);

const showAuthButtons = computed(
  () => !userLoggedIn.value && !isAuthenticatorPage.value && !isKYCBoPage.value,
);
const headerComponent = computed(() => (
  userLoggedIn.value ? VHeaderAuthorized : VHeaderGuest
));

const buildQueryParamsObject = (): Record<string, string> => {
  if (typeof window === 'undefined') {
    return {};
  }

  const search = window.location.search ?? '';
  const params = new URLSearchParams(search);
  const paramsObj: Record<string, string> = {};

  params.forEach((value, key) => {
    paramsObj[key] = value;
  });

  return paramsObj;
};

const signInHandler = () => {
  if (props.disabled) return;
  if (props.signInHref) {
    navigateWithQueryParams(props.signInHref);
    return;
  }
  navigateWithQueryParams(urlSignin, buildQueryParamsObject());
};

const signUpHandler = () => {
  if (props.disabled) return;
  if (props.signUpHref) {
    navigateWithQueryParams(props.signUpHref);
    return;
  }
  navigateWithQueryParams(urlSignup, buildQueryParamsObject());
};

</script>

<template>
  <component
    :is="headerComponent"
    v-model="isMobileSidebarOpen"
    :show-navigation="showNavigation"
    :show-mobile-sidebar="showNavigation"
    :menu="desktopMenu"
    :is-mobile-p-w-a="false"
    :show-profile-link="showProfileLink"
    :url-profile="urlProfile"
    :user-logged-in="userLoggedIn"
    class="VHeaderInvest v-header-invest"
  >
    <template
      v-if="$slots.leading"
      #leading
    >
      <slot name="leading" />
    </template>

    <div class="v-header-invest__wrap">
      <template v-if="showAccountText">
        <span class="v-header-invest__auth-text is--body">
          <span
            v-if="showHaveAccount"
          >
            Already have an account?
          </span>
          <span
            v-if="showDontHaveAccount"
          >
            Don't have an account?
          </span>
        </span>
      </template>

      <Skeleton
        v-if="isLoading"
        class="v-header-invest-btns__skeleton"
        :style="{ width: '250px', height: '25px' }"
      />
      <div
        v-else-if="showAuthButtons"
        class="v-header-invest-btns"
        :class="{
          'v-header-invest-sign-in': isSignInPage,
          'v-header-invest-sign-up': isSignUpPage,
        }"
      >
        <Button
          v-if="showHaveAccount"
          type="button"
          :disabled="disabled"
          class="v-header-invest-btns__sign-in"
          :variant="!isSignUpPage ? 'link' : undefined"
          @click="signInHandler"
        >
          Log In
        </Button>

        <Button
          v-if="showDontHaveAccount"
          type="button"
          :disabled="disabled"
          class="v-header-invest-btns__sign-up"
          @click="signUpHandler"
        >
          Sign Up
        </Button>
      </div>
      <VHeaderProfile
        v-else-if="userLoggedIn && !suppressAuthenticatedAccountControls"
        :menu="profileMenu"
        :is-mobile-pwa="false"
        :is-desktop="isDesktopMD"
        show-logout-icon
      />
    </div>

    <template #mobile>
      <div
        v-if="showAuthButtons"
        class="v-header-invest-btns"
        :class="{
          'v-header-invest-sign-in': isSignInPage,
          'v-header-invest-sign-up': isSignUpPage,
        }"
      >
        <Button
          v-if="showHaveAccount"
          type="button"
          :disabled="disabled"
          class="v-header-invest-btns__sign-in"
          :variant="!isSignUpPage ? 'link' : undefined"
          @click="signInHandler"
        >
          Log In
        </Button>

        <Button
          v-if="showDontHaveAccount"
          type="button"
          :disabled="disabled"
          class="v-header-invest-btns__sign-up"
          @click="signUpHandler"
        >
          Sign Up
        </Button>
      </div>
      <VHeaderProfileMobile
        v-else-if="userLoggedIn && !suppressAuthenticatedAccountControls"
        :menu="mobileMenu"
        :is-mobile-pwa="false"
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
    position: var(--ui-header-nav-position, revert-layer);
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

}

  .v-header-mobile__list {
    border-top: none !important;
  }
</style>
