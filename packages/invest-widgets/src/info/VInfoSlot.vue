<script setup lang="ts">
import { computed } from 'vue';
import { Skeleton } from '@global-torque/ui-primitives/skeleton';

export interface IInfoSlot {
  title: string;
  text: string;
}
const props = withDefaults(defineProps<{
  title?: string;
  text?: string;
  size?: 'regular' | 'small';
  loading?: boolean;
}>(), {
  size: 'regular',
});
const isSizeSmall = computed(() => props.size === 'small');
</script>

<template>
  <div
    class="InfoSlot info-slot"
    :class="{ 'is--size-small': isSizeSmall }"
  >
    <slot>
      <span
        v-if="title"
        class="info-slot__title"
        :class="{ 'is--small-2': isSizeSmall, 'is--h6__title': !isSizeSmall }"
      >
        {{ title }}
      </span>
      <Skeleton
        v-if="loading"
        :style="{ width: '50%', height: '26px' }"
      />
      <span
        v-if="!loading && text"
        class="info-slot__text"
        :class="{ 'is--small': isSizeSmall, 'is--body': !isSizeSmall }"
      >
        {{ text }}
      </span>
    </slot>
  </div>
</template>

<style lang="scss">
.info-slot {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: 8px;
  flex: 1 0 0;
  padding: 16px;
  border-bottom: 1px solid var(--ui-color-border-subtle, var(--border));
  width: 100%;

  &.is--size-small {
    padding: 12px;
    gap: 2px;
  }

  &:first-of-type {
    border-top: 1px solid var(--ui-color-border-subtle, var(--border));
  }

  &__title {
    color: var(--ui-color-text-muted, var(--muted-foreground));
  }

  &__text {
    color: var(--ui-color-text-secondary, var(--foreground));
  }
}
</style>
