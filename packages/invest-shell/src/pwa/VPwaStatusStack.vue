<script setup lang="ts">
import { useInvestApplicationContext } from '@webdevelop-pro/invest-runtime/application-context';
import { computed } from 'vue';
import { useOfflineStatus } from '@webdevelop-pro/invest-runtime/pwa/useOfflineStatus';
import { usePwaBannerDismissals } from '@webdevelop-pro/invest-runtime/pwa/usePwaBannerDismissals';
import { usePwaOfflineDataStatus } from '@webdevelop-pro/invest-runtime/pwa/usePwaOfflineDataStatus';
import { usePwaInstallPrompt } from '@webdevelop-pro/invest-runtime/pwa/usePwaInstallPrompt';
import { usePwaStandalone } from '@webdevelop-pro/invest-runtime/pwa/usePwaStandalone';
import { usePwaTelemetry } from '@webdevelop-pro/invest-runtime/pwa/usePwaTelemetry';
import { usePwaUpdatePrompt } from '@webdevelop-pro/invest-runtime/pwa/usePwaUpdatePrompt';
import VOfflineStatusBanner from './VOfflineStatusBanner.vue';
import VPwaInstallPrompt from './VPwaInstallPrompt.vue';
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
  canInstall,
  installState,
  promptInstall,
  dismissInstallPrompt,
} = usePwaInstallPrompt({ testHostname });
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
  handleInstall,
  handleDismissInstall,
  handleReloadApp,
  handleDismissUpdate,
  handleDismissOfflineReady,
} = usePwaTelemetry({
  canInstall,
  installState,
  isUpdateReady,
  isOfflineReady,
  isOffline,
  isReconnected,
  registrationError,
  promptInstall,
  dismissInstallPrompt,
  reloadApp,
  dismissUpdateReady,
  dismissOfflineReady,
});
const hasRegistrationError = computed(() => Boolean(registrationError.value));
const canShowInteractiveUpdatePrompt = computed(() => !isOffline.value);
const shouldShowInstallPrompt = computed(() => installState.value !== 'hidden');
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
  shouldShowInstallPrompt.value
  || shouldShowUpdatePrompt.value
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
    <VPwaInstallPrompt
      v-if="shouldShowInstallPrompt"
      :can-install="canInstall"
      :install-state="installState"
      @install="handleInstall"
      @dismiss="handleDismissInstall"
    />
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
  z-index: 140;
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
