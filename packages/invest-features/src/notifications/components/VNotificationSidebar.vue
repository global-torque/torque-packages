<script setup lang="ts">
import { useNotifications } from '../useNotifications.ts';
import { Button } from '@global-torque/ui-primitives/button';
import { storeToRefs } from 'pinia';
import { ArrowRightIcon } from '@global-torque/invest-widgets/icons';
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@global-torque/ui-primitives/sheet';
import { X } from '@lucide/vue';
import VNotificationTable from './VNotificationTable.vue';

defineProps({
  isStaticSite: String,
});

const notificationsStore = useNotifications();
const { notificationUnreadLength, isSidebarOpen, notificationsHref } = storeToRefs(notificationsStore);

const onClose = () => {
  notificationsStore.onSidebarToggle(false);
};
</script>
<template>
  <Sheet
    v-model:open="isSidebarOpen"
    class="VNotificationSidebar v-notification-sidebar"
  >
    <SheetContent
      :aria-describedby="undefined"
      :show-close-button="false"
      class="v-notification-sidebar__content"
    >
      <SheetHeader class="v-notification-sidebar__header">
        <SheetTitle>
          Notifications
          <span v-if="notificationUnreadLength">
            (+{{ notificationUnreadLength }})
          </span>
        </SheetTitle>
      </SheetHeader>
      <div class="v-notification-sidebar__text">
        <VNotificationTable
          v-if="isSidebarOpen"
          small
          class="v-notification-sidebar__table"
          :is-static-site="isStaticSite"
        />
      </div>
      <SheetFooter class="v-notification-sidebar__bottom">
        <Button
          as="a"
          class="v-notification-sidebar__action"
          :href="notificationsHref"
          variant="link"
          size="lg"
          @click="onClose"
        >
          View All
          <ArrowRightIcon
            class="v-notification-sidebar__icon"
            alt="modal layout close icon"
          />
        </Button>
      </SheetFooter>
      <SheetClose
        aria-label="Close"
        class="v-notification-sidebar__close ring-offset-background focus:ring-ring
          data-[state=open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70
          transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2
          focus:outline-hidden disabled:pointer-events-none"
      >
        <X
          class="v-notification-sidebar__close-outline size-4"
          aria-hidden="true"
        />
      </SheetClose>
    </SheetContent>
  </Sheet>
</template>

<style lang="scss">
[data-slot='sheet-overlay']:has(+ .v-notification-sidebar__content) {
  z-index: 50;
  background: color-mix(in srgb, var(--foreground) 40%, transparent);
}

.v-notification-sidebar {

  &__header {
    box-shadow: var(--shadow-sm);
    color: var(--foreground);
  }

  &__content {
    background: var(--background);
    max-width: 700px !important;
    z-index: 101;

    .wd-notification-table__toolbar-left {
      flex-wrap: initial;

      @media screen and (width <= 768px){
        flex-wrap: wrap;
      }
    }
  }

  &__text {
    padding: 28px 20px 20px;
    max-height: calc(100vh - 65px - 80px);
    height: 100%;
    overflow-y: auto;
  }

  &__table {
    height: 100%;
  }

  &__bottom[data-slot='sheet-footer'] {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    display: flex;
    height: 80px;
    padding: 16px 40px;
    justify-content: center;
    align-items: flex-start;
    gap: 4px;
    align-self: stretch;
    border-top: 1px solid var(--border);
    background-color: var(--background);
  }

  &__close {
    padding: 0;
    border: 0 solid transparent;
  }

  &__close[data-slot='sheet-close']:hover {
    background: color-mix(in srgb, var(--primary) 12%, var(--background));
    color: color-mix(in srgb, var(--primary) 78%, black);
  }

  &__close-outline { display: block; }

  &__action {
    gap: 8px;
  }

  &__icon {
    width: 20px;
  }
}
</style>
