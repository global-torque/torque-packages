<script setup lang="ts">
import { ChevronsUpDown, Plus } from '@lucide/vue';
import type { Component } from 'vue';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@global-torque/ui-primitives/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@global-torque/ui-primitives/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@global-torque/ui-primitives/avatar';
import { computed, ref } from 'vue';
import type { SidebarTeam } from '../types';
import { UserIcon } from '@lucide/vue';

const DROPDOWN_ALIGN = 'start';
const DROPDOWN_LABEL = 'Profiles';

const props = withDefaults(defineProps<{
  dropdownComponent?: Component;
  dropdownProps?: Record<string, unknown>;
  teams?: SidebarTeam[];
  title?: string;
  subtitle?: string;
}>(), {
  dropdownComponent: undefined,
  dropdownProps: undefined,
  teams: () => [],
  title: 'Workspace',
  subtitle: 'Sidebar block',
});

const emit = defineEmits<{
  select: [team: SidebarTeam];
  create: [];
}>();

const sidebar = useSidebar();
const isCollapsed = computed(() => !sidebar.isMobile.value && sidebar.state.value === 'collapsed');
const isDropdownOpen = ref(false);
const activeTeam = computed(() => (
  props.teams.find(team => team.active) ?? props.teams[0]
));
const activeTeamTitle = computed(() => (
  activeTeam.value?.title ?? props.title
));
const activeTeamSubtitle = computed(() => (
  activeTeam.value ? activeTeam.value.subtitle : props.subtitle
));
const dropdownSide = computed(() => {
  if (sidebar.isMobile.value) {
    return 'bottom';
  }

  return isCollapsed.value ? 'right' : 'bottom';
});
const dropdownSideOffset = computed(() => {
  if (sidebar.isMobile.value) {
    return 8;
  }

  return isCollapsed.value ? 16 : 6;
});
const dropdownAlignOffset = computed(() => (
  isCollapsed.value ? 8 : 0
));
const triggerSize = computed(() => (
  isCollapsed.value ? 'default' : 'sm'
));

function getTeamInitials(team?: Pick<SidebarTeam, 'title' | 'avatarText'> | null) {
  if (!team) {
    return 'WS';
  }

  const avatarText = team.avatarText?.trim();

  if (avatarText) {
    return avatarText.slice(0, 2).toUpperCase();
  }

  return team.title
    .split(' ')
    .map(part => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function getTriggerAvatarText(team?: Pick<SidebarTeam, 'title' | 'avatarText'> | null) {
  const avatarText = team?.avatarText?.trim();

  if (avatarText) {
    return avatarText.charAt(0).toUpperCase();
  }

  return team?.title?.trim().charAt(0).toUpperCase() || 'W';
}

function handleTeamSelect(team: SidebarTeam) {
  isDropdownOpen.value = false;
  emit('select', team);
}

function handleCreate() {
  isDropdownOpen.value = false;
  emit('create');
}

function handleCustomSelect(value: string | number) {
  const nextTeam = props.teams.find(team => String(team.id) === String(value));

  if (nextTeam) {
    handleTeamSelect(nextTeam);
    return;
  }

  if (String(value) === 'new') {
    handleCreate();
  }
}
</script>

<template>
  <SidebarMenu class="team-switcher">
    <SidebarMenuItem>
      <DropdownMenu v-model:open="isDropdownOpen">
        <DropdownMenuTrigger
          as-child
          :with-chevron="false"
        >
          <SidebarMenuButton
            as="button"
            :class="[
              'team-switcher__trigger',
              'group-data-[collapsible=icon]:w-[var(--ui-sidebar-collapsed-control-size,100%)]!',
              'group-data-[collapsible=icon]:h-[var(--ui-sidebar-collapsed-control-size,40px)]!',
              'group-data-[collapsible=icon]:p-[var(--ui-sidebar-profile-padding,0px)]!',
            ]"
            :size="triggerSize"
            type="button"
          >
            <Avatar
              class="team-switcher__avatar size-8"
            >
              <AvatarImage
                v-if="activeTeam?.avatarSrc"
                :src="activeTeam.avatarSrc"
                :alt="`${activeTeamTitle} avatar`"
              />
              <AvatarFallback v-else>
                {{ getTriggerAvatarText(activeTeam ?? { title: props.title }) }}
              </AvatarFallback>
            </Avatar>

            <template v-if="!isCollapsed">
              <div
                class="team-switcher__copy"
                :class="{ 'is--single-line': !activeTeamSubtitle }"
              >
                <p class="team-switcher__title">
                  {{ activeTeamTitle }}
                </p>
                <p
                  v-if="activeTeamSubtitle"
                  class="team-switcher__subtitle"
                >
                  {{ activeTeamSubtitle }}
                </p>
              </div>

              <ChevronsUpDown class="team-switcher__chevron" />
            </template>
          </SidebarMenuButton>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          :align="DROPDOWN_ALIGN"
          :align-offset="dropdownAlignOffset"
          class="team-switcher__content"
          :side="dropdownSide"
          :side-offset="dropdownSideOffset"
        >
          <div class="team-switcher__content-label">
            {{ DROPDOWN_LABEL }}
          </div>

          <template v-if="props.dropdownComponent">
            <component
              :is="props.dropdownComponent"
              v-bind="props.dropdownProps"
              @select="handleCustomSelect"
            />
          </template>

          <template v-else>
            <DropdownMenuItem
              v-for="team in props.teams"
              :key="team.id"
              class="team-switcher__item v-dropdown__item"
              :class="{ 'is--active': team.active }"
              @select="handleTeamSelect(team)"
            >
              <Avatar
                class="team-switcher__item-avatar size-8"
              >
                <span>{{ getTeamInitials(team) }}</span>
              </Avatar>

              <div class="team-switcher__item-copy">
                <p class="team-switcher__item-title">
                  {{ team.title }}
                </p>
                <p
                  v-if="team.subtitle"
                  class="team-switcher__item-subtitle"
                >
                  {{ team.subtitle }}
                </p>
              </div>
            </DropdownMenuItem>

            <div class="team-switcher__separator" />

            <DropdownMenuItem
              class="team-switcher__item v-dropdown__item is--create"
              @select="handleCreate"
            >
              <div class="team-switcher__item-avatar team-switcher__item-avatar--create">
                <Plus class="h-4 w-4" />
              </div>
              <span class="team-switcher__item-title">Add profile</span>
            </DropdownMenuItem>
          </template>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  </SidebarMenu>
</template>

<style lang="scss">

.team-switcher {
  &__trigger {
    width: 100%;
    min-height: 40px;
    padding: 0 12px;
    border-radius: 2px;

    &[data-state='open'] {
      background: var(--ui-color-canvas, var(--muted));
    }
  }

  &__avatar,
  &__item-avatar {
    width: 30px;
    height: 30px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 100%;
    background: var(--border);
    color: var(--muted-foreground);
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    box-shadow: none;
  }

  &__avatar {
    position: var(--ui-chrome-avatar-position, relative);
    line-height: var(--ui-chrome-avatar-line-height, revert-layer);
    background: var(--ui-color-canvas, var(--muted));
    color: var(--color-text-soft, var(--foreground));
    font-size: 14px;
    font-weight: 500;

    [data-slot='avatar-fallback'] {
      font-weight: var(--ui-header-avatar-weight, 500);
      color: var(--ui-color-text-secondary, inherit);
      border-radius: var(--ui-investor-avatar-fallback-radius, calc(infinity * 1px));
    }
  }

  [data-state='collapsed'] &__trigger {
    justify-content: center;
    min-height: 40px;
    padding: 0;
  }

  &__item-avatar--create {
    background: var(--border);
    color: var(--muted-foreground);
    box-shadow: none;
  }

  &__copy,
  &__item-copy {
    min-width: 0;
    flex: 1;
    text-align: left;
  }

  &__copy {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;

    &.is--single-line {
      gap: 0;
    }
  }

  &__title,
  &__item-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--foreground);
    font-size: 15px;
    font-weight: 700;
    line-height: 1.35;
  }

  &__copy.is--single-line &__title {
    font-size: 16px;
    line-height: 1.25;
  }

  &__subtitle,
  &__item-subtitle {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--muted-foreground);
    font-size: 12px;
    line-height: 1.35;
  }

  &__chevron {
    width: 15px;
    height: 15px;
    flex-shrink: 0;
    color: var(--muted-foreground);
    transition: color 0.2s ease, transform 0.2s ease;
  }

  // the attributes keep the panel and the rows ahead of the surface's menu
  // rules (components.css)
  &__content[data-slot='dropdown-menu-content'] {
    position: var(--ui-profile-menu-position, revert-layer);
    will-change: var(--ui-profile-menu-will-change, revert-layer);
    overflow: var(--ui-profile-menu-overflow, revert-layer);
    border-color: var(--ui-color-canvas, var(--muted));
    min-width: 296px;
    padding: 8px 0;
    z-index: 1120;
  }

  &__content-label {
    padding: 4px 12px 8px;
    color: var(--ui-color-text-disabled, var(--muted-foreground));
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  &__item[data-slot='dropdown-menu-item'] {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    color: var(--foreground);
    transition:
      background-color 0.2s ease,
      color 0.2s ease;

    &:hover {
      background: var(--muted);
    }

    &.is--active {
      background: var(--muted);

      .team-switcher__item-title {
        color: var(--primary);
      }

      .team-switcher__item-subtitle {
        color: var(--muted-foreground);
      }
    }

    &.is--create {
      margin-top: 8px;
      padding-top: 16px;

      &:hover {
        background: var(--muted);
      }

      .team-switcher__item-title {
        color: var(--muted-foreground);
      }
    }
  }

  &__separator {
    height: 1px;
    margin: 4px 0;
    background: var(--border);
  }
}
</style>
