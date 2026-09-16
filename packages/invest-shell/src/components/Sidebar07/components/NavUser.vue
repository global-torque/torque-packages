<script setup lang="ts">
import {
  BadgeCheck,
  Camera,
  ChevronsUpDown,
  KeyRound,
  LogOut,
} from '@lucide/vue';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@global-torque/ui-primitives/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@global-torque/ui-primitives/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@global-torque/ui-primitives/avatar';
import { computed } from 'vue';
import type { SidebarUser, SidebarUserAction } from '../types';
import { UserIcon } from '@lucide/vue';

const props = defineProps<{
  user?: SidebarUser | null;
}>();

const emit = defineEmits<{
  action: [action: SidebarUserAction];
}>();

const sidebar = useSidebar();
const isCollapsed = computed(() => !sidebar.isMobile.value && sidebar.state.value === 'collapsed');
const dropdownSide = computed<'bottom' | 'right' | 'top'>(() => {
  if (sidebar.isMobile.value) {
    return 'bottom';
  }

  return isCollapsed.value ? 'right' : 'top';
});
const dropdownAlign = computed<'start'>(() => (
  'start'
));
const dropdownSideOffset = computed(() => {
  if (sidebar.isMobile.value) {
    return 8;
  }

  return isCollapsed.value ? 16 : 6;
});
const dropdownAlignOffset = computed(() => (
  isCollapsed.value ? -8 : 0
));

function handleAction(action: SidebarUserAction) {
  if (sidebar.isMobile.value) {
    sidebar.setOpenMobile(false);
  }

  emit('action', action);
}

const initials = computed(() => {
  const avatarText = props.user?.avatarText?.trim();

  if (avatarText) {
    return avatarText.slice(0, 2).toUpperCase();
  }

  return props.user?.name
    .split(' ')
    .map(part => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? 'U';
});
</script>

<template>
  <SidebarMenu
    v-if="user"
    class="nav-user"
  >
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger
          as-child
          :with-chevron="false"
        >
          <SidebarMenuButton
            as="button"
            class="nav-user__trigger group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:py-0! group-data-[collapsible=icon]:px-[var(--ui-sidebar-user-collapsed-padding,0px)]!"
            type="button"
          >
            <Avatar
              class="nav-user__avatar size-8"
            >
              <AvatarImage
                v-if="user.avatarSrc"
                :src="user.avatarSrc"
                alt="avatar image"
              />
              <AvatarFallback v-else>
                {{ initials }}
              </AvatarFallback>
            </Avatar>

            <template v-if="!isCollapsed">
              <span class="nav-user__copy">
                <span class="nav-user__name">{{ user.name }}</span>
                <span
                  v-if="user.email"
                  class="nav-user__email"
                >
                  {{ user.email }}
                </span>
              </span>

              <ChevronsUpDown class="nav-user__chevron" />
            </template>
          </SidebarMenuButton>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          :align="dropdownAlign"
          :align-offset="dropdownAlignOffset"
          class="nav-user__content"
          :side="dropdownSide"
          :side-offset="dropdownSideOffset"
        >
          <div class="nav-user__head">
            <Avatar
              class="nav-user__avatar size-8"
            >
              <AvatarImage
                v-if="user.avatarSrc"
                :src="user.avatarSrc"
                alt="avatar image"
              />
              <AvatarFallback v-else>
                {{ initials }}
              </AvatarFallback>
            </Avatar>

            <span class="nav-user__copy">
              <span class="nav-user__name">{{ user.name }}</span>
              <span
                v-if="user.email"
                class="nav-user__email"
              >
                {{ user.email }}
              </span>
            </span>
          </div>

          <div class="nav-user__separator" />

          <DropdownMenuItem
            v-if="user.showPhotoAction"
            class="nav-user__item v-dropdown__item"
            @select="handleAction('photo')"
          >
            <Camera class="h-4 w-4" />
            <span>Change account photo</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            class="nav-user__item v-dropdown__item"
            @select="handleAction('settings')"
          >
            <BadgeCheck class="h-4 w-4" />
            <span>User settings</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            class="nav-user__item v-dropdown__item"
            @select="handleAction('password')"
          >
            <KeyRound class="h-4 w-4" />
            <span>Password</span>
          </DropdownMenuItem>

          <div class="nav-user__separator" />

          <DropdownMenuItem
            class="nav-user__item v-dropdown__item is--logout"
            @select="handleAction('logout')"
          >
            <LogOut class="h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  </SidebarMenu>
</template>

<style lang="scss">

.nav-user {
  // The profile image and initials share the compact navigation avatar.
  &__avatar {
    position: var(--ui-chrome-avatar-position, relative);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: var(--ui-sidebar-avatar-border, none);
    border-radius: 100%;
    background: var(--ui-color-border-subtle, var(--border));
    color: var(--ui-color-text-muted, var(--color-text-meta)) !important;
    font-size: 14px;
    line-height: 18px;
    font-weight: 500;
    box-shadow: none;

    [data-slot='avatar-image'] {
      border-radius: var(--ui-investor-avatar-image-radius, 0);
      object-fit: var(--ui-sidebar-avatar-image-fit, fill);
    }

    [data-slot='avatar-fallback'] { border-radius: var(--ui-investor-avatar-fallback-radius, calc(infinity * 1px)); }
  }

  &__trigger {
    position: var(--ui-sidebar-user-trigger-position, revert-layer);
    width: 100%;
    min-height: var(--ui-sidebar-user-min-height, 44px);
    padding: 0 16px;
    border-radius: 2px;

    &[data-state='open'] {
      background: var(--muted);
      color: var(--foreground);
    }
  }

  // the rail: a 40 px square, the avatar centred (the legacy icon-only button)
  [data-state='collapsed'] &__trigger,
  .sidebar-07-shell.is--desktop-collapsed &__trigger {
    width: 40px;
    min-height: 44px;
    padding: 0;
    justify-content: center;
    border-radius: 2px;
  }

  // the attributes keep the panel and the rows ahead of the surface's menu
  // rules (components.css)
  &__content[data-slot='dropdown-menu-content'] {
    min-width: 264px;
    padding: 8px 0;
    z-index: 1120;
  }

  &__head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px 12px;
  }

  &__copy {
    min-width: 0;
    flex: 1;
    text-align: left;
  }

  &__name {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--foreground);
    font-size: 14px;
    font-weight: 700;
    line-height: 1.35;
  }

  &__email {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--muted-foreground);
    font-size: 12px;
    line-height: 1.35;
  }

  &__chevron {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    color: var(--muted-foreground);
  }

  &__separator {
    height: 1px;
    margin: 4px 0;
    background: var(--border);
  }

  &__item[data-slot='dropdown-menu-item'] {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    color: var(--foreground);
    transition: background-color 0.2s ease, color 0.2s ease;

    svg {
      color: inherit;
    }

    &:hover {
      background: var(--muted);
    }

    &.is--logout {
      color: var(--destructive);

      &:hover {
        background: color-mix(in srgb, var(--destructive) 10%, transparent);
      }
    }
  }
}
</style>
