<script setup lang="ts">
import { computed } from 'vue';
import { Alert, AlertDescription, AlertTitle } from '@global-torque/ui-primitives/alert';
import { Button } from '@global-torque/ui-primitives/button';
import { formatBuildDisplay } from '@webdevelop-pro/invest-core/formatting/buildInfo';
import { Spinner } from '@global-torque/ui-primitives/spinner';
import { CircleAlertIcon, CircleCheckIcon, InfoIcon } from '@lucide/vue';

const props = defineProps<{
  isUpdateReady: boolean;
  isOfflineReady: boolean;
  lifecycleState: 'idle' | 'offlineReady' | 'updateReady' | 'reloading' | 'registrationError';
  hasRegistrationError: boolean;
  appVersion?: string;
  appBuildTimestamp?: string;
}>();

const emit = defineEmits<{
  reload: [];
  dismissUpdate: [];
  dismissOfflineReady: [];
}>();

const currentBuildLabel = computed(() => (
  formatBuildDisplay('Current build: ', props.appVersion, props.appBuildTimestamp)
));
</script>

<template>
  <div
    v-if="lifecycleState !== 'idle'"
    class="VPwaUpdatePrompt v-pwa-update-prompt"
    data-testid="pwa-update-prompt"
  >
    <Alert
      v-if="isUpdateReady || lifecycleState === 'reloading'"
      class="v-pwa-update-prompt__alert">
      <InfoIcon />
      <div class="v-pwa-update-prompt__content">
              <AlertTitle>
              App update available
              </AlertTitle>
              <AlertDescription>
                A newer version of the app is ready. Refresh to load the latest code and cached content.
                <span v-if="currentBuildLabel">
                  {{ currentBuildLabel }}
                </span>
              </AlertDescription>
            </div>
            <div class="v-pwa-update-prompt__actions">
              <Button
                @click="emit('reload')"
                size="sm"
                :disabled="lifecycleState === 'reloading'"
              >
                  <Spinner v-if="lifecycleState === 'reloading'" />
                Refresh app
              </Button>
              <Button
                :disabled="lifecycleState === 'reloading'"
                @click="emit('dismissUpdate')"
                variant="outline"
                size="sm"
              >
                  <Spinner v-if="lifecycleState === 'reloading'" />
                Later
              </Button>
            </div>
    </Alert>

    <Alert
      v-else-if="isOfflineReady"
      class="v-pwa-update-prompt__alert">
      <CircleCheckIcon />
      <div class="v-pwa-update-prompt__content">
              <AlertTitle>
                Offline mode ready
              </AlertTitle>
              <AlertDescription>
                Core app files are cached and the app can reopen previously visited pages with cached content.
              </AlertDescription>
            </div>
            <div class="v-pwa-update-prompt__actions">
              <Button
                @click="emit('dismissOfflineReady')"
                variant="secondary"
                size="sm"
              >
                Dismiss
              </Button>
            </div>
    </Alert>

    <Alert variant="destructive"
      v-else-if="hasRegistrationError"
      class="v-pwa-update-prompt__alert">
      <CircleAlertIcon />
      <div class="v-pwa-update-prompt__content">
              <AlertTitle>
                Offline features unavailable
              </AlertTitle>
              <AlertDescription>
                The app could not finish service worker setup, so install, offline reopen,
                and in-app update prompts are temporarily unavailable.
              </AlertDescription>
            </div>
    </Alert>
  </div>
</template>

<style scoped lang="scss">
.v-pwa-update-prompt {
  width: 100%;

  &__alert {
    width: 100%;
    margin: 0;
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-left: auto;
  }

  &__content {
    min-width: 0;
  }
}
</style>
