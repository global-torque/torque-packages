<script setup lang="ts">
import { useInvestApplicationContext } from '@global-torque/invest-runtime/application-context';
import { computed, PropType, ref } from 'vue';
import { storeToRefs } from 'pinia';

import VDropdown from '../VDropdown.vue';
import {
  DropdownMenuItem, DropdownMenuPortal, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
} from '@global-torque/ui-primitives/dropdown-menu';
import { useDialogs } from '@global-torque/invest-runtime/dialogs';
import NotificationsSidebarButton from '@global-torque/invest-widgets/notifications/VNotificationsSidebarButton.vue';
import { LogoutMenuIcon as LogOutIcon } from '@global-torque/invest-widgets/icons/navigation';
import VAvatarIdentity from '../VAvatarIdentity.vue';
import type { MenuItem } from '../../navigation/types.ts';
import ProfileSwitchMenuList from '@global-torque/invest-widgets/profiles/ProfileSwitchMenuList.vue';
import { useProfileSwitchMenu } from '@global-torque/invest-widgets/profiles';
import { useHeaderUser } from './useHeaderUser.ts';
import { getProfileAvatarInitial } from '@global-torque/invest-core/profiles/avatarInitial';

const isStaticSite = String(useInvestApplicationContext().appConfig.isStaticSite ?? '') ?? '';

defineProps({
  menu: Array as PropType<MenuItem[]>,
  showLogoutIcon: {
    type: Boolean,
    default: false,
  },
  isMobilePwa: {
    type: Boolean,
    default: false,
  },
  isDesktop: {
    type: Boolean,
    default: false,
  },
});

const { userEmail, userDisplayName } = useHeaderUser();
const { selectedProfileLabel, profileItems, onSelectProfile } = useProfileSwitchMenu();

const useDialogsStore = useDialogs();
const { isDialogLogoutOpen } = storeToRefs(useDialogsStore as any) as any;

const profileAvatarInitial = computed(() => getProfileAvatarInitial(selectedProfileLabel.value));
const isMenuOpen = ref(false);

const closeMenu = () => {
  isMenuOpen.value = false;
};

const handleProfileSelect = async (id: string) => {
  await onSelectProfile(id);
  closeMenu();
};

const onLogout = () => {
  closeMenu();
  isDialogLogoutOpen.value = true;
};
</script>

<template>
  <div class="VHeaderProfile v-header-profile">
    <div class="v-header-profile__divider is--gt-tablet-show" />
    <NotificationsSidebarButton
      :is-static-site="isStaticSite"
      :show-icon="isMobilePwa || isDesktop"
    />
    <VDropdown
      v-model:open="isMenuOpen"
      with-chevron
      :menu="menu"
      :content-props="{ sideOffset: 14, align: 'end' }"
    >
      <VAvatarIdentity
        class="v-header-profile__avatar"
        size="small"
        :src="undefined"
        alt="avatar image"
        :avatar-text="profileAvatarInitial"
        :label="selectedProfileLabel"
      />

      <template #content-start>
        <div class="v-header-profile__menu-head">
          <div class="v-header-profile__menu-title is--h6__title">
            {{ userDisplayName }}
          </div>
          <div class="v-header-profile__menu-email is--small">
            {{ userEmail }}
          </div>
        </div>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger class="v-header-profile__switch-trigger">
            <span class="v-header-profile__switch-text is--h6__title">
              Switch profile
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent
              side="left"
              :side-offset="2"
            >
              <ProfileSwitchMenuList
                :items="profileItems"
                @select="handleProfileSelect"
              />
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
      </template>
      <template #content>
        <DropdownMenuItem
          as-child
          data-testid="header-profile-logout"
          @click="onLogout"
        >
          <button
            type="button"
            class="v-dropdown__item"
          >
            <LogOutIcon
              v-if="showLogoutIcon"
              class="v-dropdown__icon"
              aria-hidden="true"
            />
            <span class="v-dropdown__label">
              Log Out
            </span>
          </button>
        </DropdownMenuItem>
      </template>
    </VDropdown>
  </div>
</template>

<style lang="scss">
.v-header-profile {
  width: fit-content;
  display: flex;
  align-items: center;
  gap: 28px;
  z-index: 0;

  @media screen and (width < 768px){
    flex-direction: column;
  }

  &__dropdown {
    width: fit-content;
  }

  &__menu-head {
    padding: 4px 14px 12px;
  }

  &__menu-email {
    color: var(--muted-foreground);
    margin-top: 2px;
    overflow-wrap: anywhere;
  }

  &__switch-trigger[data-slot='dropdown-menu-sub-trigger'] {
    border: 1px solid var(--border);
    border-radius: 2px;
    background: var(--muted);
    padding: 12px 14px;
  }

  .is--active {
    color: var(--primary);
  }

  &__divider {
    width: 1px;
    height: 30px;
    border-left: 1px solid var(--input);
  }

  &__notification {
    display: flex;
    align-items: center;
    position: relative;
    cursor: pointer;
  }

  &__notification-icon {
    width: 24px;
    height: 24px;
    color: var(--muted-foreground);
  }

  &__notification-dot {
    width: 8px;
    height: 8px;
    position: absolute;
    right: -2px;
    top: -2px;
    background-color: var(--background);
    border-radius: 100%;
    z-index: 0;

    &::after {
      content: '';
      position: absolute;
      width: 6px;
      height: 6px;
      right: 1px;
      top: 1px;
      background-color: var(--primary);
      border-radius: 100%;
      z-index: 0;
    }
  }
}

</style>
