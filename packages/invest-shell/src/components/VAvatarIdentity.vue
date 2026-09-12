<script setup lang="ts">
import { Avatar, AvatarFallback } from '@global-torque/ui-primitives/avatar';

defineOptions({
  inheritAttrs: false,
});

defineProps<{
  label: string;
  avatarText?: string;
}>();
</script>

<template>
  <div class="VAvatarIdentity v-avatar-identity flex items-center gap-2">
    <Avatar
      v-bind="$attrs"
      class="v-avatar-identity__avatar size-[30px]"
    >
      <AvatarFallback>{{ avatarText }}</AvatarFallback>
    </Avatar>
    <span class="v-avatar-identity__label is--h6__title">
      <slot>
        {{ label }}
      </slot>
    </span>
  </div>
</template>

<style scoped lang="scss">
.v-avatar-identity {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--ui-color-text, inherit);

  &__avatar {
    position: var(--ui-chrome-avatar-position, relative);
    align-items: var(--ui-avatar-identity-align-items, revert-layer);
    justify-content: var(--ui-avatar-identity-justify-content, revert-layer);
    line-height: var(--ui-chrome-avatar-line-height, revert-layer);
    font-size: var(--ui-avatar-identity-font-size, inherit);
    border: var(--ui-avatar-identity-border, none);
    border-radius: var(--ui-avatar-identity-radius, calc(infinity * 1px));
    background: var(--ui-color-border-subtle, transparent);

    :deep([data-slot='avatar-fallback']) {
      font-weight: var(--ui-header-avatar-weight, 500);
      border-radius: var(--ui-investor-avatar-fallback-radius, calc(infinity * 1px));
    }
  }

  &__label {
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
