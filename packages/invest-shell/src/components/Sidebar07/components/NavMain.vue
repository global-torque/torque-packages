<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { ChevronRight } from '@lucide/vue';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@global-torque/ui-primitives/collapsible';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@global-torque/ui-primitives/sidebar';
import { cn } from '@global-torque/ui-primitives/lib/utils';
import type { SidebarNavItem } from '../types';

defineProps<{
  items?: SidebarNavItem[];
  label?: string;
}>();

const emit = defineEmits<{
  select: [item: SidebarNavItem];
}>();

const sidebar = useSidebar();
const isCollapsed = computed(() => !sidebar.isMobile.value && sidebar.state.value === 'collapsed');

interface SelectOptions {
  closeSidebarOnMobile?: boolean;
}

function resolveLinkTag(item: SidebarNavItem) {
  if (item.queryOnly) return 'button';
  if (item.to) return RouterLink;
  if (item.href) return 'a';
  return 'button';
}

function resolveLinkProps(item: SidebarNavItem) {
  if (item.queryOnly) return { type: 'button' };
  if (item.to) return { to: item.to };
  if (item.href) return { href: item.href };
  return { type: 'button' };
}

function handleSelect(item: SidebarNavItem, options: SelectOptions = {}) {
  const { closeSidebarOnMobile = true } = options;

  if (closeSidebarOnMobile && sidebar.isMobile.value && (item.to || item.href)) {
    sidebar.setOpenMobile(false);
  }

  emit('select', item);
}
</script>

<template>
  <SidebarGroup
    v-if="items?.length"
    class="NavMain nav-main"
  >
    <SidebarGroupLabel
      v-if="!isCollapsed"
      as="p"
    >
      {{ label ?? 'Main Navigation' }}
    </SidebarGroupLabel>

    <SidebarGroupContent>
      <SidebarMenu>
        <SidebarMenuItem
          v-for="item in items"
          :key="item.id ?? item.title"
        >
          <Collapsible
            v-if="item.items?.length && !isCollapsed"
            class="group/collapsible"
            :default-open="item.active"
          >
            <CollapsibleTrigger
              as-child
              class="nav-main__trigger w-full"
            >
              <SidebarMenuButton
                :is-active="Boolean(item.active)"
                as="button"
                :class="[
                  'nav-main__button justify-start',
                  'group-data-[collapsible=icon]:h-[var(--ui-sidebar-collapsed-control-size,40px)]! group-data-[collapsible=icon]:w-[var(--ui-sidebar-nav-collapsed-width,40px)]!',
                  'group-data-[collapsible=icon]:p-[var(--ui-sidebar-nav-padding,12px)]!',
                ]"
                type="button"
                @click="handleSelect(item, { closeSidebarOnMobile: false })"
              >
                <span class="flex min-w-0 items-center gap-3">
                  <component
                    :is="item.icon"
                    v-if="item.icon"
                    class="size-4 shrink-0"
                  />
                  <span class="truncate">{{ item.title }}</span>
                </span>
                <ChevronRight
                  :class="[
                    'nav-main__chevron -ml-1.5 size-[18px] shrink-0 text-slate-400 transition duration-200',
                    'group-data-[state=open]/collapsible:rotate-90',
                  ]"
                />
              </SidebarMenuButton>
            </CollapsibleTrigger>

            <CollapsibleContent class="overflow-hidden">
              <ul class="nav-main__submenu">
                <li
                  v-for="child in item.items"
                  :key="child.id ?? `${item.title}-${child.title}`"
                  class="nav-main__submenu-item"
                >
                  <component
                    :is="resolveLinkTag(child)"
                    v-bind="resolveLinkProps(child)"
                    :class="cn(
                      'nav-main__subitem is--h6__title',
                      child.active ? 'is--active' : '',
                      child.disabled ? 'is--disabled' : '',
                    )"
                    @click="handleSelect(child)"
                  >
                    <span class="truncate">{{ child.title }}</span>
                    <span
                      v-if="child.badge !== undefined"
                      class="nav-main__subitem-badge"
                    >
                      {{ child.badge }}
                    </span>
                  </component>
                </li>
              </ul>
            </CollapsibleContent>
          </Collapsible>

          <SidebarMenuButton
            v-else
            :as="resolveLinkTag(item)"
            :class="cn(
              'nav-main__button justify-start group-data-[collapsible=icon]:h-[var(--ui-sidebar-collapsed-control-size,40px)]! group-data-[collapsible=icon]:w-[var(--ui-sidebar-nav-collapsed-width,40px)]! group-data-[collapsible=icon]:p-[var(--ui-sidebar-nav-padding,12px)]!',
              item.disabled ? 'pointer-events-none opacity-50' : '',
            )"
            :is-active="Boolean(item.active)"
            :title="isCollapsed ? item.title : undefined"
            v-bind="resolveLinkProps(item)"
            @click="handleSelect(item)"
          >
            <component
              :is="item.icon"
              v-if="item.icon"
              class="h-4 w-4 shrink-0"
            />

            <template v-if="!isCollapsed">
              <span class="min-w-0 flex-1 truncate text-left">{{ item.title }}</span>
              <span
                v-if="item.badge !== undefined"
                class="rounded-sm bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700"
              >
                {{ item.badge }}
              </span>
            </template>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
</template>

<style scoped lang="scss">
.nav-main {
  &__trigger {
    width: 100%;
  }

  &__button {
    display: var(--ui-sidebar-nav-display, revert-layer);
    position: var(--ui-sidebar-nav-position, revert-layer);
    text-decoration: none !important;
  }

  &__chevron {
    width: 18px;
    height: 18px;
  }

  &__submenu {
    margin: 4px 0 0 28px;
    padding-left: 12px;
    border-left: 1px solid var(--ui-color-border-subtle, var(--border));
    display: flex;
    flex-direction: column;
    gap: 4px;
    list-style: none;
  }

  &__submenu-item {
    list-style: none;
  }

  &__subitem {
    display: flex;
    align-items: center;
    min-height: 40px;
    gap: 8px;
    width: 100%;
    border: 1px solid transparent;
    border-radius: 2px;
    background: transparent;
    padding: 0 16px;
    box-shadow: none;
    color: var(--muted-foreground);
    text-decoration: none !important;
    cursor: pointer;
    transition:
      background-color 0.2s ease,
      border-color 0.2s ease,
      box-shadow 0.2s ease,
      color 0.2s ease;

    &:hover {
      background: var(--muted);
      color: var(--foreground);
    }

    &.is--active {
      color: var(--primary);
    }

    &.is--disabled {
      pointer-events: none;
      opacity: 0.5;
    }
  }

  // Preserve the authored h6 metrics over the host's native button default.
  &__subitem:not([data-slot]) {
    line-height: 21px;
  }

  &__subitem-badge {
    margin-left: auto;
    border-radius: 2px;
    background: var(--border);
    padding: 2px 8px;
    color: var(--muted-foreground);
    font-size: 10px;
    font-weight: 700;
    line-height: 1.2;
  }

  &__subitem.is--active &__subitem-badge {
    background: rgb(from var(--primary) r g b / 12%);
    color: var(--primary);
  }

  &__subitem.is--active:hover &__subitem-badge {
    background: rgb(from var(--background) r g b / 18%);
    color: var(--ui-color-text-inverse, #fff);
  }

  :deep(.v-button__content) {
    justify-content: flex-start;
  }
}
</style>
