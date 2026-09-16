<script setup lang="ts">
import { useNotifications } from '../useNotifications.ts';
import { Button } from '@global-torque/ui-primitives/button';
import { storeToRefs } from 'pinia';
import { ArrowRightIcon } from '@global-torque/invest-widgets/icons';
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@global-torque/ui-primitives/sheet';
import { X } from '@lucide/vue';
import CloseIcon from '@global-torque/invest-widgets/icons/images/close.svg?component';
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
        <CloseIcon
          class="v-notification-sidebar__close-approved size-[18px]"
          aria-hidden="true"
        />
      </SheetClose>
    </SheetContent>
  </Sheet>
</template>

<style lang="scss">
[data-slot='sheet-overlay']:has(+ .v-notification-sidebar__content) {
  z-index: var(--ui-notification-overlay-layer, 50);
  background: var(--ui-dialog-overlay, color-mix(in srgb, var(--foreground) 40%, transparent));
}

.v-notification-sidebar {

  &__header {
    box-shadow: var(--ui-shadow-control, var(--shadow-control));
    color: var(--foreground);
  }

  &__content {
    display: var(--ui-notification-panel-display, revert-layer);
    overflow: var(--ui-notification-panel-overflow, revert-layer);
    background: var(--ui-dialog-background, var(--background));
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
    flex-direction: var(--ui-notification-footer-direction, revert-layer);
    border-top: 1px solid var(--ui-color-border-subtle, var(--border));
    background-color: var(--ui-color-surface, var(--background));
  }

  &__close {
    padding: var(--ui-notification-close-padding, 0);
    border: var(--ui-notification-close-border-width, 0) solid transparent;
    font-weight: var(--ui-notification-close-weight, revert-layer);
    line-height: var(--ui-notification-close-line-height, revert-layer);
    flex-shrink: var(--ui-notification-close-shrink, revert-layer);
  }

  &__close[data-slot='sheet-close']:hover {
    background: var(--ui-color-accent-subtle-hover, color-mix(in srgb, var(--primary) 12%, var(--background)));
    color: var(--ui-color-accent-hover, color-mix(in srgb, var(--primary) 78%, black));
  }

  &__close-outline { display: var(--ui-notification-close-outline-display, block); }

  &__close-approved {
    display: var(--ui-notification-close-approved-display, none);
    color: var(--primary);
  }

  &__action {
    gap: var(--ui-notification-action-gap, 8px);
    position: var(--ui-notification-action-position, revert-layer);
  }

  &__icon {
    width: var(--ui-notification-action-icon-size, 20px);
    height: var(--ui-notification-action-icon-size, revert-layer);
  }
}
</style>
