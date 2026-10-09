<script setup lang="ts">
import type { PropType } from 'vue';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@global-torque/ui-primitives/breadcrumb';
import type { IBreadcrumb } from './types';

const props = defineProps({
  data: {
    type: Array as PropType<IBreadcrumb[]>,
    required: true,
  },
});

const isLast = (index: number) => index === props.data.length - 1;
</script>

<template>
  <Breadcrumb class="VBreadcrumbs v-breadcrumb">
    <BreadcrumbList class="m-0 list-none p-0">
      <template
        v-for="(item, index) in data"
        :key="item.text"
      >
        <BreadcrumbItem>
          <BreadcrumbPage v-if="isLast(index) || (!item.to && !item.href)">
            {{ item.text }}
          </BreadcrumbPage>
          <router-link
            v-else-if="item.to"
            :to="item.to"
            class="v-breadcrumb__link no-underline"
          >
            {{ item.text }}
          </router-link>
          <BreadcrumbLink
            v-else
            :href="item.href ? encodeURI(item.href) : undefined"
            class="v-breadcrumb__link no-underline"
          >
            {{ item.text }}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator v-if="!isLast(index)">
          <slot>
            <span class="v-breadcrumb__default-separator" />
          </slot>
        </BreadcrumbSeparator>
      </template>
    </BreadcrumbList>
  </Breadcrumb>
</template>

<style lang="scss">
/* page spacing the legacy ui-kit breadcrumb root carried; consumers rely on it.
   The legacy typography `ol { list-style: decimal; padding-left: 23px; color }` is
   unlayered and beats the primitive's utilities, so the list is reset here. */
.v-breadcrumb {
  ol {
    display: flex;
    list-style: none;
    padding-left: 0;
    gap: 8px;
    color: var(--foreground);
    font-size: inherit;
    line-height: inherit;

    @media screen and (width < 768px) {
      display: flex;
    }
  }

  [data-slot='breadcrumb-item'] {
    display: inline-flex;
  }

  [data-slot='breadcrumb-separator'] {
    display: list-item;

    @media screen and (width < 768px) {
      margin: 0;
    }
  }

  &__link,
  [data-slot='breadcrumb-page'] {
    font-size: inherit;
    line-height: inherit;
  }

  [data-slot='breadcrumb-page'] { font-weight: 400; }

  &__default-separator::before { content: '>'; }

  // Inactive labels use the muted foreground.
  [data-slot='breadcrumb-page'],
  [data-slot='breadcrumb-separator'] {
    color: var(--muted-foreground);
  }

  & + * {
    margin-top: 40px;

    @media screen and (width <= 768px) {
      margin-top: 60px;
    }
  }

  .is--container + .is--container:last-child & {
    margin-top: 90px;

    @media screen and (width <= 768px) {
      margin-top: 60px;
    }
  }
}
</style>
