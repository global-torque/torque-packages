<script setup lang="ts">
import { useInvestApplicationContext } from '@global-torque/invest-runtime/application-context';
import { computed } from 'vue';
import { useOfflineStatus } from '@global-torque/invest-runtime/pwa/useOfflineStatus';
import { usePwaBannerDismissals } from '@global-torque/invest-runtime/pwa/usePwaBannerDismissals';
import { usePwaOfflineDataStatus } from '@global-torque/invest-runtime/pwa/usePwaOfflineDataStatus';
import { usePwaStandalone } from '@global-torque/invest-runtime/pwa/usePwaStandalone';
import { usePwaTelemetry } from '@global-torque/invest-runtime/pwa/usePwaTelemetry';
import { usePwaUpdatePrompt } from '@global-torque/invest-runtime/pwa/usePwaUpdatePrompt';
import VOfflineStatusBanner from './VOfflineStatusBanner.vue';
import VPwaUpdatePrompt from './VPwaUpdatePrompt.vue';

const props = withDefaults(defineProps<{
  usesMobileShell: boolean;
  hasFooterMenu?: boolean;
}>(), {
  hasFooterMenu: false,
});

const applicationContext = useInvestApplicationContext();
const testHostname = applicationContext.appConfig.pwaTestHostname;
const { isStandalone } = usePwaStandalone();
const { isOffline, isReconnected, isShowingCachedContent } = useOfflineStatus();
const { lastSyncedAt } = usePwaOfflineDataStatus();
const {
  isUpdateReady,
  isOfflineReady,
  lifecycleState,
  registrationError,
  reloadApp,
  dismissOfflineReady,
  dismissUpdateReady,
} = usePwaUpdatePrompt({ testHostname });
const {
  handleReloadApp,
  handleDismissUpdate,
  handleDismissOfflineReady,
} = usePwaTelemetry({
  isUpdateReady,
  isOfflineReady,
  isOffline,
  isReconnected,
  registrationError,
  reloadApp,
  dismissUpdateReady,
  dismissOfflineReady,
});
const hasRegistrationError = computed(() => Boolean(registrationError.value));
const canShowInteractiveUpdatePrompt = computed(() => !isOffline.value);
const shouldShowOfflineReadyPrompt = computed(() => (
  isStandalone.value
  && isOfflineReady.value
));
const activeOfflineBannerKey = computed(() => {
  if (isOffline.value) {
    return 'offline' as const;
  }

  if (isReconnected.value) {
    return 'reconnected' as const;
  }

  return null;
});
const {
  isBannerVisible: shouldShowOfflineBanner,
  dismissActiveBanner: dismissOfflineBanner,
} = usePwaBannerDismissals(activeOfflineBannerKey);
const shouldShowUpdatePrompt = computed(() => (
  canShowInteractiveUpdatePrompt.value
  && (
    lifecycleState.value === 'reloading'
    || isUpdateReady.value
    || shouldShowOfflineReadyPrompt.value
    || hasRegistrationError.value
  )
));
const shouldRenderStack = computed(() => (
  shouldShowUpdatePrompt.value
  || shouldShowOfflineBanner.value
));
const shouldOffsetForFooterMenu = computed(() => (
  props.usesMobileShell && props.hasFooterMenu
));
const appVersion = applicationContext.appConfig.build?.version ?? '';
const appBuildTimestamp = applicationContext.appConfig.build?.timestamp ?? '';
</script>

<template>
  <div
    v-if="shouldRenderStack"
    class="VPwaStatusStack v-pwa-status-stack"
    :class="{ 'is--footer-offset': shouldOffsetForFooterMenu }"
  >
    <VPwaUpdatePrompt
      v-if="shouldShowUpdatePrompt"
      :is-update-ready="isUpdateReady"
      :is-offline-ready="shouldShowOfflineReadyPrompt"
      :lifecycle-state="lifecycleState"
      :has-registration-error="hasRegistrationError"
      :app-version="appVersion"
      :app-build-timestamp="appBuildTimestamp"
      @reload="handleReloadApp"
      @dismiss-update="handleDismissUpdate"
      @dismiss-offline-ready="handleDismissOfflineReady"
    />
    <VOfflineStatusBanner
      v-if="shouldShowOfflineBanner"
      :is-offline="isOffline"
      :is-reconnected="isReconnected"
      :is-showing-cached-content="isShowingCachedContent"
      :last-synced-at="lastSyncedAt"
      @dismiss="dismissOfflineBanner"
    />
  </div>
</template>

<style scoped lang="scss">
.v-pwa-status-stack {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 43;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  margin: 0 auto;
  pointer-events: none;

  > * {
    pointer-events: auto;
  }

  &.is--footer-offset {
    bottom: var(--pwa-footer-safe-offset);
  }
}
</style>
