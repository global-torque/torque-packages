<script setup lang="ts">
import type { UiNavigationContentRecord } from '@global-torque/domain-types/contentTypes';
import { PropType } from 'vue';

export interface IHeaderNavigation {
  href?: string;
  frontmatter?: UiNavigationContentRecord;
  text?: string;
  target?: string;
  active?: boolean;
}

defineProps({
  data: Object as PropType<IHeaderNavigation>,
});

const emit = defineEmits(['click']);
</script>

<template>
  <li class="VHeaderNavigationListItem v-header-navigation-list-item">
    <a
      v-if="data?.href && data.text"
      :href="data.href"
      :target="data.target ? data.target : '_self'"
      class="v-header-navigation-list-item__item is--h6__title is--link"
      :class="{ 'is--active': data.active }"
      @click="emit('click')"
    >
      {{ data.text }}
    </a>
    <span
      v-else-if="data?.text"
      class="v-header-navigation-list-item__item is--small-2 is--color-gray-60 is--uppercase"
    >
      {{ data?.text }}
    </span>
  </li>
</template>

<style lang="scss">
.v-header-navigation-list-item {
  margin-top: 0;

  &__item {
    white-space: nowrap;
    text-decoration: none;
    height: 100%;
    display: flex;
    padding: 8px 12px;
    align-items: center;
    gap: 8px;

    @media screen and (width <= 1024px) {
      padding: 7px 12px;
    }

    &.is--link {
      cursor: pointer;
    }

    &.is--link:hover {
      color: var(--primary);
    }

    &.is--active {
      color: var(--primary);
    }
  }

}
</style>
