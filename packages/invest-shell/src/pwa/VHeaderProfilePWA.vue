<script setup lang="ts">
import {
  computed, onMounted, onUnmounted, toRef,
} from 'vue';
import { storeToRefs } from 'pinia';
import { useProfilesStore } from '@webdevelop-pro/invest-runtime/profiles';
import { useDialogs } from '@webdevelop-pro/invest-runtime/dialogs';
import {
  urlContactUs,
  urlFaq,
  urlHowItWorks,
  urlSettingsAccountDetails,
  urlSettingsMfa,
  urlSettingsSecurity,
} from '../navigation/links.ts';
import VHeaderProfileOverlayPWA from './VHeaderProfileOverlayPWA.vue';
import VHeaderProfileSwitchSidebarPWA from './VHeaderProfileSwitchSidebarPWA.vue';
import { useProfileSwitchMenu } from '@webdevelop-pro/invest-widgets/profiles';
import { useHeaderUser } from '../components/VHeader/useHeaderUser.ts';
import { getProfileAvatarInitial } from '@webdevelop-pro/invest-core/profiles/avatarInitial';
import VAvatarIdentity from '../components/VAvatarIdentity.vue';
import { usePwaProfilePanels } from './usePwaProfilePanels.ts';

const props = withDefaults(defineProps<{
  interactive?: boolean;
}>(), {
  interactive: true,
});

const profilesStore = useProfilesStore();
const { selectedUserProfileId } = storeToRefs(profilesStore);
const dialogsStore = useDialogs();
const isDialogLogoutOpen = toRef(dialogsStore, 'isDialogLogoutOpen');

const { userEmail, userDisplayName, avatarSrc } = useHeaderUser();
const { selectedProfileLabel } = useProfileSwitchMenu();
const profileAvatarInitial = computed(() => getProfileAvatarInitial(selectedProfileLabel.value));
const accountAvatarInitial = computed(() => getProfileAvatarInitial(
  userDisplayName.value || userEmail.value,
));
const getProfileId = computed(() => Number(selectedUserProfileId.value));
const USER_MENU_QUERY_KEY = 'fromUserMenu';
const USER_MENU_QUERY_VALUE = '1';
const USER_MENU_FROM_QUERY_KEY = 'menuFrom';
const USER_MENU_OPEN_QUERY_KEY = 'openUserMenu';
const OPEN_PWA_PROFILE_OVERLAY_EVENT = 'invest:pwa-profile-overlay:open';

const toPathname = (url: string) => {
  try {
    return new URL(url, window.location.origin).pathname;
  } catch {
    return url;
  }
};

const getAppBasePath = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    const baseHref = document.querySelector('base')?.getAttribute('href') || '/';
    const basePath = new URL(baseHref, window.location.origin).pathname.replace(/\/$/, '');
    return basePath === '/' ? '' : basePath;
  } catch {
    return '';
  }
};

const normalizePathWithBase = (path: string) => {
  if (!path.startsWith('/')) {
    return path;
  }

  const basePath = getAppBasePath();
  if (!basePath) {
    return path;
  }
  if (path === basePath || path.startsWith(`${basePath}/`)) {
    return path;
  }
  return `${basePath}${path}`;
};

const withUserMenuSource = (url: string) => {
  if (!url) {
    return '';
  }

  const getCurrentMenuSource = () => {
    if (typeof window === 'undefined') {
      return '/';
    }
    const current = new URL(window.location.href);
    current.searchParams.delete(USER_MENU_QUERY_KEY);
    current.searchParams.delete(USER_MENU_FROM_QUERY_KEY);
    current.searchParams.delete(USER_MENU_OPEN_QUERY_KEY);
    return `${current.pathname}${current.search}${current.hash}`;
  };

  if (typeof window === 'undefined') {
    const hasQuery = url.includes('?');
    const suffix = `${USER_MENU_QUERY_KEY}=${USER_MENU_QUERY_VALUE}`;
    return `${url}${hasQuery ? '&' : '?'}${suffix}`;
  }

  try {
    const parsed = new URL(url, window.location.origin);
    parsed.searchParams.set(USER_MENU_QUERY_KEY, USER_MENU_QUERY_VALUE);
    parsed.searchParams.set(USER_MENU_FROM_QUERY_KEY, getCurrentMenuSource());
    const normalizedPath = normalizePathWithBase(parsed.pathname);
    return `${normalizedPath}${parsed.search}${parsed.hash}`;
  } catch {
    const hasQuery = url.includes('?');
    const suffix = `${USER_MENU_QUERY_KEY}=${USER_MENU_QUERY_VALUE}`;
    return `${url}${hasQuery ? '&' : '?'}${suffix}`;
  }
};

const accountDetailsPath = computed(() => (
  Number.isFinite(getProfileId.value) ? withUserMenuSource(urlSettingsAccountDetails(getProfileId.value)) : ''
));
const mfaPath = computed(() => (
  Number.isFinite(getProfileId.value) ? withUserMenuSource(urlSettingsMfa(getProfileId.value)) : ''
));
const securityPath = computed(() => (
  Number.isFinite(getProfileId.value) ? withUserMenuSource(urlSettingsSecurity(getProfileId.value)) : ''
));
const howItWorksPath = computed(() => withUserMenuSource(toPathname(urlHowItWorks)));
const contactUsPath = computed(() => withUserMenuSource(toPathname(urlContactUs)));
const faqPath = computed(() => withUserMenuSource(toPathname(urlFaq)));

const {
  isProfileOverlayOpen,
  isProfileSwitchSidebarOpen,
  openProfileOverlay,
  closeProfileOverlay,
  openProfileSwitchSidebar,
  closeProfileSwitchSidebar,
} = usePwaProfilePanels();
const profileMenuButtonLabel = computed(() => (
  selectedProfileLabel.value
    ? `Open profile menu for ${selectedProfileLabel.value}`
    : 'Open profile menu'
));

const onProfileSwitchOpen = () => {
  openProfileSwitchSidebar();
};

const onProfileSelect = () => {
  closeProfileSwitchSidebar();
};

const onLogout = () => {
  closeProfileOverlay();
  closeProfileSwitchSidebar();
  isDialogLogoutOpen.value = true;
};

onMounted(() => {
  if (typeof window !== 'undefined') {
    const current = new URL(window.location.href);
    const shouldOpenMenu = current.searchParams.get(USER_MENU_OPEN_QUERY_KEY) === USER_MENU_QUERY_VALUE;
    if (shouldOpenMenu) {
      openProfileOverlay();
      current.searchParams.delete(USER_MENU_OPEN_QUERY_KEY);
      window.history.replaceState({}, '', `${current.pathname}${current.search}${current.hash}`);
    }
    window.addEventListener(OPEN_PWA_PROFILE_OVERLAY_EVENT, openProfileOverlay);
  }
});

onUnmounted(() => {
  closeProfileOverlay();
  closeProfileSwitchSidebar();
  if (typeof window !== 'undefined') {
    window.removeEventListener(OPEN_PWA_PROFILE_OVERLAY_EVENT, openProfileOverlay);
  }
});
</script>

<template>
  <div class="VHeaderProfilePWA v-header-profile-pwa">
    <button
      v-if="props.interactive"
      type="button"
      class="v-header-profile-pwa__avatar-btn"
      :aria-label="profileMenuButtonLabel"
      aria-haspopup="dialog"
      :aria-expanded="isProfileOverlayOpen"
      @click="openProfileOverlay"
    >
      <VAvatarIdentity
        class="v-header-profile-pwa__avatar"
        size="small"
        :src="undefined"
        alt="avatar image"
        :avatar-text="profileAvatarInitial"
        :label="selectedProfileLabel"
      />
    </button>

    <VAvatarIdentity
      v-else
      class="v-header-profile-pwa__avatar"
      size="small"
      :src="undefined"
      alt="avatar image"
      :avatar-text="profileAvatarInitial"
      :label="selectedProfileLabel"
    />

    <template>
      <VHeaderProfileOverlayPWA
        v-if="isProfileOverlayOpen"
        :email="userEmail"
        :avatar-src="avatarSrc"
        :avatar-initial="accountAvatarInitial"
        :avatar-loading="false"
        :account-details-href="accountDetailsPath"
        :mfa-href="mfaPath"
        :security-href="securityPath"
        :how-it-works-href="howItWorksPath"
        :faq-href="faqPath"
        :contact-href="contactUsPath"
        @close="closeProfileOverlay"
        @logout="onLogout"
        @switch-profile-open="onProfileSwitchOpen"
      />

      <VHeaderProfileSwitchSidebarPWA
        v-model:open="isProfileSwitchSidebarOpen"
        @select="onProfileSelect"
      />
    </template>
  </div>
</template>

<style lang="scss">
.v-header-profile-pwa {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: fit-content;
  z-index: 0;

  &__avatar {
    margin-right: 0;
  }

  &__avatar-btn,
  &__identity {
    border: none;
    background: transparent;
    padding: 0;
    cursor: pointer;
  }

  &__avatar-btn {
    border-radius: 999px;
  }

  &__identity {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    min-width: 0;
  }

  &__file-input {
    display: none;
  }

}

body.pwa-profile-overlay-open .pwamenu,
body.pwa-profile-switch-sidebar-open .pwamenu {
  display: none;
}
</style>
