<script setup lang="ts">
import { computed } from 'vue';
import { Alert, AlertDescription, AlertTitle } from '@global-torque/ui-primitives/alert';
import { Button } from '@global-torque/ui-primitives/button';
import {  } from '@lucide/vue';
import { CircleAlertIcon, CircleCheckIcon, InfoIcon, TriangleAlertIcon } from '@lucide/vue';

/** Icon of an alert variant. */
const alertIcon = (variant?: string) => ({ error: CircleAlertIcon, success: CircleCheckIcon, warning: TriangleAlertIcon } as Record<string, unknown>)[variant ?? ''] ?? InfoIcon;

const props = defineProps<{
  isOffline: boolean;
  isReconnected?: boolean;
  isShowingCachedContent: boolean;
  lastSyncedAt?: string | null;
}>();

const emit = defineEmits<{
  dismiss: [];
}>();

const bannerTitle = 'Offline mode';
const lastSyncedLabel = computed(() => {
  if (!props.lastSyncedAt) {
    return '';
  }

  const date = new Date(props.lastSyncedAt);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
});
const bannerText = computed(() => (
  props.isReconnected
    ? 'Connection restored. The app can refresh live content again.'
    : props.isShowingCachedContent
      ? 'You are offline and seeing saved content in read-only mode.'
      : 'You are offline. Sections that were not saved on this device may be unavailable until the connection returns.'
));
</script>

<template>
  <div
    v-if="isOffline || isReconnected"
    class="VOfflineStatusBanner v-offline-status-banner"
    role="status"
    aria-live="polite"
    data-testid="offline-status-banner"
  >
    <Alert
      :variant="isReconnected ? 'success' : 'default'"
      class="v-offline-status-banner__alert"
    >
      <component :is="alertIcon(isReconnected ? 'success' : 'info')" />
      <AlertTitle>{{ isReconnected ? 'Back online' : bannerTitle }}</AlertTitle>
      <AlertDescription>
        {{ bannerText }}
        <span v-if="lastSyncedLabel">
          Last synced: {{ lastSyncedLabel }}.
        </span>
        {{ ' ' }}
        <Button
          type="button"
          variant="link"
          class="v-offline-status-banner__action"
          @click="emit('dismiss')"
        >
          OK
        </Button>
      </AlertDescription>
    </Alert>
  </div>
</template>

<style scoped lang="scss">
.v-offline-status-banner {
  width: 100%;

  &__alert {
    width: 100%;
    margin: 0;
  }

  &__action[data-slot='button'][data-variant='link'] {
    display: inline;
    min-height: 0;
    height: auto;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    gap: 0;
    font: inherit;
    line-height: inherit;
    white-space: normal;
    text-decoration: underline;
    text-underline-offset: 0.2em;
    vertical-align: baseline;

    &:hover {
      background: transparent;
    }
  }
}
</style>
