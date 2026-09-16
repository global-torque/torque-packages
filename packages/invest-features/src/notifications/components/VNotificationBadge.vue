<script setup lang="ts">
import { Skeleton } from '@global-torque/ui-primitives/skeleton';
import { useNotificationBadge } from '../useNotificationBadge.ts';

defineOptions({ name: 'VNotificationBadge' });

const props = withDefaults(defineProps<{
  /**
   * Custom count to display (overrides store value)
   */
  count?: number;
  /**
   * Position variant: 'absolute' for overlaying on icons, 'inline' for inline display
   */
  position?: 'absolute' | 'inline';
  /**
   * Custom class for additional styling
   */
  customClass?: string;
}>(), {
  position: 'inline',
});

const {
  displayCount,
  shouldShowLoading,
  shouldShow,
  badgeClasses,
} = useNotificationBadge(props);
</script>

<template>
  <Skeleton
    v-if="shouldShowLoading"
    class="notification-number notification-number--loading"
    :class="badgeClasses"
    aria-hidden="true"
    style="width: 18px; height: 18px; border-radius: 9px"
  />
  <span
    v-else-if="shouldShow"
    :class="badgeClasses"
    aria-label="Unread notifications"
  >
    {{ displayCount > 99 ? '99+' : displayCount }}
  </span>
</template>

<style lang="scss">
.notification-number {
  --notification-badge-shadow: var(--shadow-badge);

  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  background: var(--ui-color-negative-accent, var(--destructive));
  color: var(--ui-color-text-inverse, var(--background));
  border-radius: 9px;
  font-weight: 700;
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;
  box-shadow: var(--notification-badge-shadow);
  border: 2px solid var(--ui-color-surface, var(--card));
  z-index: 10;
  box-sizing: border-box;
  flex-shrink: 0;
  user-select: none;
  pointer-events: none;

  // Ensure proper display for single and double digit numbers
  &::before {
    content: '';
    display: inline-block;
    width: 0;
    height: 11px;
    vertical-align: middle;
  }

  // Position variants
  &--absolute {
    position: absolute;
  }

  &--inline {
    display: inline-flex;
  }

  &--loading {
    border: 2px solid var(--ui-color-surface, var(--card));
    box-shadow: var(--notification-badge-shadow);
    pointer-events: none;
  }
}
</style>
