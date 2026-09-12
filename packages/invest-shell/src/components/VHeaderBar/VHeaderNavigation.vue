<script setup lang="ts">
import {
  defineAsyncComponent,
  hydrateOnVisible,
  PropType,
  shallowRef,
} from 'vue';
import type { Component } from 'vue';
import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger } from '@global-torque/ui-primitives/navigation-menu';
import VHeaderNavigationListItem from './VHeaderNavigationListItem.vue';
import { Button } from '@global-torque/ui-primitives/button';
import type { IHeaderNavigation } from './VHeaderNavigationListItem.vue';

const LazyVHeaderNavigationCardDark = defineAsyncComponent({
  loader: () => import('./VHeaderNavigationCardDark.vue'),
  hydrate: hydrateOnVisible(),
});

export type MenuItem = {
  to?: string;
  href?: string;
  active?: boolean;
  text: string;
  children?: IHeaderNavigation[][];
  icon?: Component;
  class?: string;
  card?: unknown;
  button?: {
    text: string;
    href?: string;
  };
};

const currentTrigger = shallowRef('');

defineProps({
  menu: {
    type: Array as PropType<MenuItem[]>,
  },
});

const emit = defineEmits(['click']);
</script>

<template>
  <NavigationMenu
    v-if="menu"
    v-model="currentTrigger"
    class="VHeaderNavigation v-header-navigation"
  >
    <NavigationMenuList class="v-header-navigation__list gap-7">
      <NavigationMenuItem
        v-for="(menuItem, index) in menu"
        :id="index"
        :key="JSON.stringify(menuItem)"
      >
        <NavigationMenuLink
          v-if="!menuItem.children"
          :href="menuItem.href"
          :class="[
            'v-header-navigation__link h-auto rounded-none px-0 py-0 hover:bg-transparent focus:bg-transparent data-active:bg-transparent',
            { 'is--active': menuItem.active },
          ]"
          @click.stop="emit('click')"
        >
          <component
            :is="menuItem.icon"
            v-if="menuItem.icon"
            class="v-header-navigation__icon"
            aria-hidden="true"
          />
          <span class="v-header-navigation__label">
            {{ menuItem.text }}
          </span>
        </NavigationMenuLink>
        <div v-else>
          <NavigationMenuTrigger class="v-header-navigation__trigger">
            <component
              :is="menuItem.icon"
              v-if="menuItem.icon"
              class="v-header-navigation__icon"
              aria-hidden="true"
            />
            <span class="v-header-navigation__label">
              {{ menuItem.text }}
            </span>
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <div class="v-header-navigation__wrap">
              <div class="v-header-navigation__dropdown-left">
                <div class="v-header-navigation__dropdown-list">
                  <ul
                    v-for="(childGroup, childGroupIndex) in menuItem.children"
                    :key="childGroupIndex"
                  >
                    <VHeaderNavigationListItem
                      v-for="(childItem, childIndex) in childGroup"
                      :key="childIndex"
                      :data="childItem"
                      @click="currentTrigger = ''; emit('click');"
                    />
                  </ul>
                </div>
                <Button
                  v-if="menuItem?.button"
                  as="a"
                  :href="menuItem?.button.href"
                  class="v-header-navigation__cta"
                  variant="link"
                  size="sm"
                >
                  {{ menuItem?.button.text }}
                </Button>
              </div>
              <LazyVHeaderNavigationCardDark
                v-if="menuItem?.card"
                :data="menuItem?.card"
              />
            </div>
          </NavigationMenuContent>
        </div>
      </NavigationMenuItem>
    </NavigationMenuList>
  </NavigationMenu>
</template>

<style lang="scss">
.v-header-navigation {
  $root: &;

  position: var(--ui-header-navigation-root-position, revert-layer);
  z-index: var(--ui-header-navigation-layer, revert-layer);
  width: var(--ui-header-navigation-width, revert-layer);
  max-width: var(--ui-header-navigation-max-width, revert-layer);
  flex: var(--ui-header-navigation-flex, revert-layer);
  justify-content: var(--ui-header-navigation-justify, revert-layer);

  &__list {
    flex: var(--ui-header-navigation-flex, revert-layer);
    justify-content: var(--ui-header-navigation-justify, revert-layer);
  }

  [data-slot='navigation-menu-item'] {
    position: var(--ui-header-navigation-item-position, revert-layer);
  }

  // a row: the primitive link stacks its children (flex-col), which put the
  // label at the top of the 64 px link
  &__link,
  &__trigger {
    display: inline-flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    color: inherit;
    line-height: var(--ui-header-nav-line-height, 20px);
  }

  &__trigger {
    cursor: pointer;
  }

  &__link.is--active,
  &__trigger.is--active {
    color: var(--primary);
  }

  &__icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    display: none;
    color: #adb5bd;

    path{
      fill: currentcolor;
    }

    path[stroke] {
      stroke: currentcolor;
    }
  }

  &__label {
    display: inline-flex;
    align-items: center;
  }

  &__wrap {
    display: flex;
    justify-content: space-between;
  }

  &__dropdown-list {
    display: flex;
    align-items: flex-start;
    gap: 24px;

    @media screen and (width <= 1199px) {
      display: flex;
      flex-wrap: wrap;
      gap: 20px 24px;
      max-height: calc(100vh - 64px - 100px);
      overflow-y: auto;
    }

    @media screen and (width <= 1024px){
      display: grid;
      grid-template-columns: repeat(1, minmax(0, 1fr));
      padding: 19px;
      gap: 9px;
    }
  }

  &__dropdown-left {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 20px 16px 28px;
    gap: 16px;
  }

  &__cta {
    align-self: center;
  }

  ul {
    list-style: none;
    padding: 0;
  }
}
</style>
