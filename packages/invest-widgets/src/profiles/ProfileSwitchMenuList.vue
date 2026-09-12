<script setup lang="ts">
import { Badge } from '@global-torque/ui-primitives/badge';
import { computed } from 'vue';
import { useProfileSwitchMenu, type ProfileSwitchMenuItem } from './useProfileSwitchMenu.ts';
import { badgeToneClass } from '@global-torque/ui-kit/badge-tone';

const props = withDefaults(defineProps<{
  items?: ProfileSwitchMenuItem[];
  variant?: 'dropdown' | 'overlay';
}>(), {
  items: undefined,
  variant: 'dropdown',
});

const emit = defineEmits<{
  (e: 'select', value: string): void;
}>();

const { profileItems, onSelectProfile } = useProfileSwitchMenu();
const resolvedItems = computed(() => props.items ?? profileItems.value);

const handleSelect = async (id: string) => {
  if (!props.items) {
    await onSelectProfile(id);
  }
  emit('select', id);
};
</script>

<template>
  <div
    class="ProfileSwitchMenuList profile-switch-menu-list"
    :class="`is--${variant}`"
  >
    <button
      v-for="item in resolvedItems"
      :key="item.id"
      type="button"
      class="profile-switch-menu-list__item"
      :class="{
        'is--active': item.isActive,
        'is--create': item.isCreateAction,
      }"
      @click="handleSelect(item.id)"
    >
      <span class="profile-switch-menu-list__label is--h6__title">
        {{ item.label }}
      </span>
      <Badge
        v-if="item.statusLabel"
        class="profile-switch-menu-list__badge"
        variant="outline"
        :class="badgeToneClass(item.statusVariant === 'success' ? 'secondary-light' : 'red-light')"
      >
        {{ item.statusLabel }}
      </Badge>
    </button>
  </div>
</template>

<style lang="scss">
.profile-switch-menu-list {
  width: 100%;
  display: flex;
  flex-direction: column;

  &__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    text-align: left;
    color: var(--foreground);
    padding: 12px;
    cursor: pointer;
    transition: border-color 0.2s ease, background-color 0.2s ease, transform 0.2s ease;

    &:hover {
      background: var(--ui-color-canvas, var(--muted));
    }

    &.is--active {
      background: var(--ui-color-canvas, var(--muted));
      color: var(--primary);
    }

    &.is--create {
      border-top: 1px solid var(--ui-color-border-subtle, var(--border));
    }
  }

  &__label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    overflow-wrap: anywhere;
  }

  &__badge {
    flex-shrink: 0;
    text-align: right;
  }

  &.is--overlay {
    gap: 10px;
  }
}
</style>
