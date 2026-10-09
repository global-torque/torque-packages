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
  color: inherit;

  &__avatar {
    position: relative;
    font-size: inherit;
    border: none;
    border-radius: calc(infinity * 1px);
    background: transparent;

    :deep([data-slot='avatar-fallback']) {
      font-weight: 500;
      border-radius: calc(infinity * 1px);
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
