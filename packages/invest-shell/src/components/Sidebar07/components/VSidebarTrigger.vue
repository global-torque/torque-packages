<script setup lang="ts">
import { PanelLeftClose, PanelLeftOpen } from '@lucide/vue';
import { computed, nextTick, ref, type ComponentPublicInstance, type HTMLAttributes, useSlots, watch } from 'vue';
import { Button } from '@global-torque/ui-primitives/button';
import { cn } from '@global-torque/ui-primitives/lib/utils';
import { useSidebar } from '@global-torque/ui-primitives/sidebar';

const props = withDefaults(defineProps<{
  class?: HTMLAttributes['class'];
}>(), {
  class: undefined,
});

const sidebar = useSidebar();
const slots = useSlots();
const trigger = ref<ComponentPublicInstance>();
const retainOpenFocus = ref(false);
let openedMobile = false;
function toggle(event: Event) {
  openedMobile = sidebar.isMobile.value && !sidebar.openMobile.value;
  // Keep the keyboard expansion indicator beneath the translucent drawer
  // while Sheet moves actual focus into its content.
  retainOpenFocus.value = openedMobile
    && event.currentTarget instanceof HTMLElement
    && event.currentTarget.matches(':focus-visible');
  sidebar.toggleSidebar();
}
watch(sidebar.openMobile, async (open) => {
  if (!open) retainOpenFocus.value = false;
  if (!open && openedMobile) {
    openedMobile = false;
    await nextTick();
    const element = trigger.value?.$el;
    if (element instanceof HTMLElement && element.isConnected) element.focus();
  }
});

const isSidebarClosed = computed(() => (
  sidebar.isMobile.value ? !sidebar.openMobile.value : sidebar.state.value === 'collapsed'
));
const hasCustomContent = computed(() => Boolean(slots.default));
const TriggerIcon = computed(() => (isSidebarClosed.value ? PanelLeftOpen : PanelLeftClose));
const triggerAriaLabel = computed(() => (isSidebarClosed.value ? 'Open sidebar' : 'Close sidebar'));
</script>

<template>
  <Button
    v-if="hasCustomContent"
    ref="trigger"
    variant="link"
    :aria-label="triggerAriaLabel"
    :class="cn('VSidebarTrigger v-sidebar-trigger v-sidebar-trigger--custom', { 'is--open-focus': retainOpenFocus }, props.class)"
    data-sidebar-trigger
    type="button"
    @click="toggle"
  >
    <slot :is-mobile="sidebar.isMobile.value" />
  </Button>

  <Button
    v-else
    ref="trigger"
    as="button"
    :aria-label="triggerAriaLabel"
    :class="['VSidebarTrigger v-sidebar-trigger', props.class]"
    data-sidebar-trigger
    type="button"
    variant="link"
    size="icon-sm"
    @click="toggle"
  >
    <component
      :is="TriggerIcon"
      class="size-[var(--ui-sidebar-trigger-icon-size,16px)] is--color-gray-70"
    />
  </Button>
</template>

<style scoped lang="scss">
.v-sidebar-trigger:not(.v-sidebar-trigger--custom)[data-slot='button'] {
  position: var(--ui-sidebar-trigger-position, revert-layer);

  &:focus-visible {
    box-shadow: var(--ui-sidebar-trigger-focus-shadow, revert-layer);
  }
}

.v-sidebar-trigger--custom[data-slot='button'] {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  color: inherit;
  font: inherit;
  line-height: normal;
  height: auto;
  border-radius: 0;

  &:focus-visible,
  &.is--open-focus {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
    box-shadow: none;
  }
}
</style>
