<script setup lang="ts">
import { PropType } from "vue";
import { NavigationMenuLink } from '@global-torque/ui-primitives/navigation-menu';
import VMenuBurger from './VMenuBurger.vue';
import VHeaderNavigationListItem from "./VHeaderNavigationListItem.vue";
import { VisuallyHidden } from "reka-ui";
import { MenuItem } from './VHeaderNavigation.vue';
import { Button } from '@global-torque/ui-primitives/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@global-torque/ui-primitives/sheet';

defineProps({
  menu: {
    type: Array as PropType<MenuItem[]>,
  },
});
const open = defineModel<boolean>();
</script>

<template>
  <Sheet
    v-model:open="open"
    class="VHeaderMobile v-header-mobile"
  >
    <SheetTrigger
      v-bind="{ ...$attrs }"
      :aria-label="open ? 'Close mobile menu' : 'Open mobile menu'"
    >
      <VMenuBurger :model-value="open" />
    </SheetTrigger>
    <SheetContent class="v-header-mobile__content">
      <VisuallyHidden>
        <SheetHeader>
          <SheetTitle>Mobile Menu</SheetTitle>
          <SheetDescription>Mobile Menu</SheetDescription>
        </SheetHeader>
      </VisuallyHidden>
      <nav class="v-header-mobile__navigation">
        <ul
          v-for="(menuItem, index) in menu"
          :id="String(index)"
          :key="JSON.stringify(menuItem)"
          class="v-header-mobile__list"
        >
          <li class="v-header-mobile__item">
            <NavigationMenuLink
              v-if="!menuItem.children"
              :href="menuItem.href"
              :class="[
                'v-header-mobile__link',
                { 'is--active': menuItem.active }
              ]"
              @click="open = false"
            >
              <component
                :is="menuItem.icon"
                v-if="menuItem.icon"
                class="v-header-mobile__icon"
                aria-hidden="true"
              />
              <span class="v-header-mobile__label">
                {{ menuItem.text }}
              </span>
            </NavigationMenuLink>
            <span
              v-else
              class="is--h5__title v-header-mobile__title"
            >
              {{ menuItem.text }}
            </span>
            <ul
              v-for="(childGroup, childGroupIndex) in menuItem.children"
              :key="childGroupIndex"
              class="v-header-mobile__list"
            >
              <VHeaderNavigationListItem
                v-for="(childItem, childIndex) in childGroup"
                :key="childIndex"
                :data="childItem"
                @click="open = false"
              />
            </ul>
            <Button
              v-if="menuItem?.button"
              as="a"
              :href="menuItem?.button.href"
              class="v-header-mobile__cta"
              @click="open = false"
              variant="link"
              size="sm"
            >
              {{ menuItem?.button.text }}
            </Button>
          </li>
        </ul>
      </nav>

      <div
        class="v-header-mobile__data"
        :class="{ 'is--border': (menu?.length || 0) > 0 }"
      >
        <slot />
      </div>
    </SheetContent>
  </Sheet>
</template>

<style lang="scss">

.v-header-mobile {
  &__item {
    height: auto;
    width: 100%;
    padding: 20px 0 0 20px;
    gap: 9px;
    display: flex;
    flex-direction: column;
  }

  &__link {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 15px;

    &.is--active {
      color: var(--primary);

      .v-header-mobile__icon {
        color: currentcolor;
      }
    }
  }

  &__icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    color: var(--color-text-disabled);
  }

  &__label {
    flex: 1;
  }

  &__list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  &__navigation > &__list + &__list {
    border-top: 1px solid var(--color-border-strong);
    margin-top: 20px;
  }

  &__title + &__list {
    margin: 10px 0 0;
  }

  &__data {
    padding: 20px;
    width: 100%;

    &.is--border {
      border-top: 1px solid var(--color-border-strong);
      margin-top: 20px;
    }
  }

  &__cta {
    align-self: baseline;
  }

  // the legacy sheet sits under the fixed header; the burger stays the close control
  &__content {
    top: 64px;
    height: calc(100% - 64px);

    [data-slot='sheet-close'] {
      display: none;
    }
  }
}
</style>
