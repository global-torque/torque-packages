<script setup lang="ts">
import {
  nextTick, ref,
} from 'vue';
import message from '../icons/images/message.svg';
import { useNotificationsSidebarWidget } from './useNotificationsSidebarWidget.ts';

withDefaults(defineProps<{
  isStaticSite?: string;
  showIcon?: boolean;
}>(), {
  isStaticSite: undefined,
  showIcon: false,
});

const {
  BadgeComponent,
  SidebarComponent,
  loadData,
  onSidebarToggle,
} = useNotificationsSidebarWidget();
const shouldRenderSidebar = ref(false);

const onSidebarOpen = async () => {
  shouldRenderSidebar.value = true;
  await nextTick();
  await loadData();
  onSidebarToggle(true);
};

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    onSidebarOpen();
  }
};
</script>

<template>
  <div
    class="NotificationsSidebarButton notifications-sidebar-button"
    role="button"
    tabindex="0"
    aria-label="Open notifications"
    @click="onSidebarOpen"
    @keydown="handleKeyDown"
  >
    <message
      v-if="showIcon"
      alt="notification icon"
      class="notifications-sidebar-button__notification-icon"
    />
    <span class="notifications-sidebar-button__label is--h6__title">
      Notifications
    </span>
    <component
      :is="BadgeComponent"
      v-if="BadgeComponent"
      :position="showIcon ? 'absolute' : 'inline'"
      custom-class="notifications-sidebar-button__badge"
    />
    <component
      :is="SidebarComponent"
      v-if="shouldRenderSidebar && SidebarComponent"
      :is-static-site="isStaticSite"
    />
  </div>
</template>

<style lang="scss">
.notifications-sidebar-button {
    display: flex;
    align-items: center;
    position: relative;
    cursor: pointer;
    padding: 12px 0;

  &__notification-icon {
    width: 20px;
    height: 20px;
    color: var(--ui-color-text-disabled, #ADB5BD);
    flex-shrink: 0;
    position: relative;
    // margin: 5px 0;

    @media screen and (width < 1024px) {
      margin-right: 12px;
    }

    path {
      fill: currentcolor;
    }

    path[stroke] {
      stroke: currentcolor;
    }
  }

  &__label {
    display: none;

    @media screen and (width < 1024px) {
      display: inline-flex;
      align-items: center;
    }
  }

  &__notification-dot {
    width: 8px;
    height: 8px;
    position: absolute;
    right: -2px;
    top: -2px;
    background-color: var(--background);
    border-radius: 100%;
    z-index: 0;

    &::after {
      content: '';
      position: absolute;
      width: 6px;
      height: 6px;
      right: 1px;
      top: 12px;
      background-color: var(--primary);
      border-radius: 100%;
      z-index: 0;
    }

    @media screen and (width <= 1024px) {
      right: auto;
      left: 16px;
    }
  }

  // Position the notification badge
  &__badge {
    @media screen and (width > 1024px) {
      top: 8px;
      left: 14px; // Position at top-right of icon (icon is 20px wide)
    }

    @media screen and (width < 1024px) {
      margin-left: 4px;
      align-self: baseline;
    }
  }
}
</style>
