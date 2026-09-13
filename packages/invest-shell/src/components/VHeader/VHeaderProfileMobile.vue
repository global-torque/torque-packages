<script setup lang="ts">
import { useInvestApplicationContext } from '@global-torque/invest-runtime/application-context';
import { computed, PropType } from 'vue';
import { useDialogs } from '@global-torque/invest-runtime/dialogs';
import { storeToRefs } from 'pinia';
import {
  NavigationMenu, NavigationMenuItem, NavigationMenuLink, NavigationMenuList,
} from '@global-torque/ui-primitives/navigation-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@global-torque/ui-primitives/avatar';
import NotificationsSidebarButton from '@global-torque/invest-widgets/notifications/VNotificationsSidebarButton.vue';
import { LogoutMenuIcon as LogOutIcon } from '@global-torque/invest-widgets/icons/navigation';
import type { MenuItem } from '../../navigation/types.ts';
import { useHeaderUser } from './useHeaderUser.ts';
import { UserIcon } from '@lucide/vue';

const isStaticSite = String(useInvestApplicationContext().appConfig.isStaticSite ?? '') ?? '';

const props = defineProps({
  menu: Array as PropType<MenuItem[]>,
  isMobilePwa: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['click']);

const useDialogsStore = useDialogs();
const { isDialogLogoutOpen } = storeToRefs(useDialogsStore as any) as any;

const { userEmail, avatarSrc } = useHeaderUser();

const onClick = () => {
  emit('click');
};

const onLogout = () => {
  isDialogLogoutOpen.value = true;
  onClick();
};

const getComponentName = (item: MenuItem) => {
  if (item.to) return 'router-link';
  if (item.href) return 'a';
  return 'div';
};

const primaryProfileMenu = computed(() => props.menu || []);
</script>

<template>
  <NavigationMenu
    orientation="vertical"
    :viewport="false"
    class="VHeaderProfileMobile v-header-profile-mobile max-w-none items-stretch"
  >
    <NavigationMenuList class="flex-col items-stretch justify-start gap-0">
      <NavigationMenuItem>
        <div class="is--h6__title is--color-gray-60">
          <Avatar
            class="v-header-profile-mobile__avatar size-8">
            <AvatarImage
              v-if="avatarSrc"
              :src="avatarSrc"
              alt="avatar image"
            />
            <AvatarFallback><UserIcon /></AvatarFallback>
          </Avatar>
          {{ userEmail }}
        </div>
      </NavigationMenuItem>
      <NavigationMenuItem>
        <NotificationsSidebarButton
          :is-static-site="isStaticSite"
          show-icon
          @click="onClick"
        />
      </NavigationMenuItem>
      <NavigationMenuItem
        v-for="(menuItem, index) in primaryProfileMenu"
        :id="`primary-${index}`"
        :key="`primary-${menuItem.text}-${index}`"
        @click="onClick"
      >
        <NavigationMenuLink as-child>
          <component
            :is="getComponentName(menuItem)"
            :to="menuItem.to"
            :href="menuItem.href"
            :class="[
              'v-header-profile-mobile__menu-link',
              menuItem.class,
              { 'is--active': menuItem.active },
            ]"
          >
            <component
              :is="menuItem.icon"
              v-if="menuItem.icon"
              class="v-header-profile-mobile__icon"
              aria-hidden="true"
            />
            <span class="v-header-profile-mobile__label">
              {{ menuItem.text }}
            </span>
          </component>
        </NavigationMenuLink>
      </NavigationMenuItem>
      <NavigationMenuItem
        data-testid="header-profile-logout"
        @click="onLogout"
      >
        <NavigationMenuLink class="v-header-profile-mobile__menu-link">
          <LogOutIcon
            class="v-header-profile-mobile__icon"
            aria-hidden="true"
          />
          <span class="v-header-profile-mobile__label">
            Log Out
          </span>
        </NavigationMenuLink>
      </NavigationMenuItem>
    </NavigationMenuList>
  </NavigationMenu>
</template>

<style lang="scss">
.v-header-profile-mobile {
  $root: &;

  width: 100%;
  display: flex;
  align-items: center;
  gap: 28px;
  z-index: 0;
  flex-direction: column;

  [data-slot='navigation-menu-list'] {
    gap: 18px;
  }

  [data-slot='navigation-menu-item'] {
    width: 100%;
  }

  & > div {
    width: 100%;
  }

  &__menu-link {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 0;
    text-decoration: none;
    color: inherit;

    &.is--active {
      color: var(--primary);
      // font-weight: 600;
    }

    &.is--border-top {
      border-top: 1px solid var(--input);
      padding-top: 20px;
    }
  }

  &__icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    color: #ADB5BD;
  }

  &__label {
    flex: 1;
  }

  &__avatar {
    margin-right: 5px;
    margin-left: -5px;
  }

  &__notification {
    position: relative;
    cursor: pointer;
  }

  &__notification-dot {
    width: 8px;
    height: 8px;
    position: absolute;
    right: -8px;
    top: -2px;
    background-color: var(--ui-color-surface, var(--background));
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
