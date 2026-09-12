import {
  computed,
  onBeforeUnmount,
  onMounted,
  shallowRef,
} from 'vue';

export function useOfflineStatus() {
  const isOnline = shallowRef(true);
  const hasServiceWorkerController = shallowRef(false);
  const isReconnected = shallowRef(false);
  let reconnectTimeoutId = 0;

  const resetReconnectState = () => {
    window.clearTimeout(reconnectTimeoutId);
    reconnectTimeoutId = 0;
    isReconnected.value = false;
  };

  const syncStatus = () => {
    if (typeof navigator === 'undefined') {
      isOnline.value = true;
      hasServiceWorkerController.value = false;
      return;
    }

    isOnline.value = navigator.onLine;
    hasServiceWorkerController.value = Boolean(navigator.serviceWorker?.controller);
  };

  const handleOnline = () => {
    const wasOffline = !isOnline.value;
    syncStatus();

    if (!wasOffline) {
      return;
    }

    isReconnected.value = true;
    reconnectTimeoutId = window.setTimeout(() => {
      isReconnected.value = false;
    }, 4000);
  };

  const handleOffline = () => {
    resetReconnectState();
    syncStatus();
  };

  onMounted(() => {
    syncStatus();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    navigator.serviceWorker?.addEventListener('controllerchange', syncStatus);
  });

  onBeforeUnmount(() => {
    if (typeof window === 'undefined') {
      return;
    }

    resetReconnectState();
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    navigator.serviceWorker?.removeEventListener('controllerchange', syncStatus);
  });

  const isOffline = computed(() => !isOnline.value);
  const isShowingCachedContent = computed(() => isOffline.value && hasServiceWorkerController.value);

  return {
    isOffline,
    isReconnected,
    isShowingCachedContent,
  };
}
