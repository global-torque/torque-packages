<script setup lang="ts">
import {
  type DropdownMenuContentProps,
} from 'reka-ui';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@global-torque/ui-primitives/dropdown-menu';
import { ChevronDown } from '@lucide/vue';
import ChevronDownFilled from '@global-torque/invest-widgets/icons/images/chevron-down.svg?component';
import type { Component } from 'vue';
import { PropType } from 'vue';

export interface IDropdown {
  to?: string | object;
  href?: string;
  text: string;
  active?: boolean;
  class?: string;
  icon?: Component;
}

defineProps({
  menu: Array as PropType<IDropdown[]>,
  withChevron: Boolean,
  contentProps: Object as PropType<DropdownMenuContentProps>,
});

const open = defineModel<boolean>('open', { default: false });

const getComponentName = (item: IDropdown) => {
  if (item.to) return 'router-link';
  if (item.href) return 'a';
  return 'div';
};

const getComponentProps = (item: IDropdown) => {
  if (item.to) return { to: item.to };
  if (item.href) return { href: encodeURI(item.href) };
  return {};
};
</script>

<template>
  <DropdownMenu
    v-model:open="open"
    class="VDropdown v-dropdown"
  >
    <DropdownMenuTrigger class="v-dropdown__trigger">
      <slot />
      <ChevronDown
        v-if="withChevron"
        class="v-dropdown__chevron v-dropdown__chevron-outline"
        aria-hidden="true"
      />
      <ChevronDownFilled
        v-if="withChevron"
        class="v-dropdown__chevron v-dropdown__chevron-filled"
        aria-hidden="true"
      />
    </DropdownMenuTrigger>

    <DropdownMenuContent
      v-bind="contentProps"
    >
      <slot name="content-start" />
      <DropdownMenuItem
        v-for="menuItem in menu"
        :key="menuItem.text"
        as-child
        :class="menuItem.class"
      >
        <component
          :is="getComponentName(menuItem)"
          v-bind="getComponentProps(menuItem)"
          class="v-dropdown__item"
          :class="{ 'is--active': menuItem.active }"
        >
          <component
            :is="menuItem.icon"
            v-if="menuItem.icon"
            class="v-dropdown__icon"
            aria-hidden="true"
          />
          <span class="v-dropdown__label">
            {{ menuItem.text }}
          </span>
        </component>
      </DropdownMenuItem>
      <slot name="content" />
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<style lang="scss">
// the legacy group rule: a hairline above the item, extra room around it
// (top level: the menu is portaled out of .v-dropdown)
[data-slot='dropdown-menu-item'].is--border-top {
  border-top: 1px solid var(--input);
  margin-top: 8px;
  padding-top: 16px;
  padding-bottom: 12px;
}

.v-dropdown {
  &__trigger {
    position: var(--ui-dropdown-trigger-position, revert-layer);
    display: flex;
    align-items: center;
    width: fit-content;
    cursor: pointer;
  }

  &__chevron {
    width: 14px;
    margin-left: 9px;
    color: var(--ui-color-text-muted, var(--color-text-meta));
    transition: transform 0.3s;
  }

  &__chevron-outline { display: var(--ui-dropdown-outline-icon-display, block); }

  &__chevron-filled { display: var(--ui-dropdown-filled-icon-display, none); }

  &__trigger[data-state="open"] &__chevron {
    transform: rotate(180deg);
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 10px;
    color: inherit;
    text-decoration: none;
  }


  &__icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    color: var(--ui-color-text-disabled, var(--color-text-disabled));

    path{
      fill: currentcolor;
    }

    path[stroke] {
      stroke: currentcolor;
    }
  }

  &__label {
    flex: 1;
  }
}
</style>
