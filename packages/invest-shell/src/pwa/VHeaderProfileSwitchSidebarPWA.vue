<script setup lang="ts">
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@global-torque/ui-primitives/sheet';
import ProfileSwitchMenuList from '@global-torque/invest-widgets/profiles/ProfileSwitchMenuList.vue';

const open = defineModel<boolean>('open', { default: false });

const emit = defineEmits<{
  (e: 'select', value: string): void;
}>();
</script>

<template>
  <Sheet
    v-model:open="open"
    class="VHeaderProfileSwitchSidebarPWA v-header-profile-switch-sidebar-pwa"
  >
    <SheetContent
      :aria-describedby="undefined"
      class="v-header-profile-switch-sidebar-pwa__content"
    >
      <SheetHeader class="v-header-profile-switch-sidebar-pwa__header">
        <SheetTitle>
          Switch profile
        </SheetTitle>
      </SheetHeader>
      <div class="v-header-profile-switch-sidebar-pwa__body">
        <ProfileSwitchMenuList
          variant="overlay"
          @select="emit('select', $event)"
        />
      </div>
    </SheetContent>
  </Sheet>
</template>

<style lang="scss">
.v-header-profile-switch-sidebar-pwa {
  &__header {
    box-shadow: var(--shadow-control);
    color: var(--foreground);
  }

  &__content {
    max-width: 420px !important;
    z-index: 101;
  }

  &__body {
    padding: 20px 12px;
    max-height: calc(100vh - 65px);
    overflow-y: auto;
  }
}
</style>
