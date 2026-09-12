import {
  computed,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  watch,
} from 'vue';
import {
  isLocalPwaTestEnabled,
  isLocalPwaTestHost,
  logPwaDebug,
  toPwaDebugError,
} from './pwaDebug.ts';
import {
  type PwaRegistrationBridge,
  usePwaRegistrationBridge,
} from './pwaRegistrationBridge.ts';

const PWA_TEST_UPDATE_READY_EVENT = 'invest:pwa-test:update-ready';
const SERVICE_WORKER_RELOAD_TIMEOUT_MS = 2500;
const UPDATE_PROMPT_DISMISS_KEY = 'invest:pwa-update-prompt:dismissed-key';

export type PwaUpdateLifecycleState =
  | 'idle'
  | 'offlineReady'
  | 'updateReady'
  | 'reloading'
  | 'registrationError';

type PwaUpdateDismissalKey =
  | 'offlineReady'
  | 'updateReady';

export type PwaTestOptions = {
  testHostname?: string;
};

const readDismissedPromptKey = (): PwaUpdateDismissalKey | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const storedValue = window.localStorage.getItem(UPDATE_PROMPT_DISMISS_KEY);
    return storedValue === 'offlineReady' || storedValue === 'updateReady'
      ? storedValue
      : null;
  } catch {
    return null;
  }
};

const writeDismissedPromptKey = (value: PwaUpdateDismissalKey | null) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (value == null) {
      window.localStorage.removeItem(UPDATE_PROMPT_DISMISS_KEY);
      return;
    }

    window.localStorage.setItem(UPDATE_PROMPT_DISMISS_KEY, value);
  } catch {
    // Ignore storage failures and keep dismissal state in memory only.
  }
};

const shouldSyncDismissedPromptFromStorage = (key: string | null) => (
  key == null || key === UPDATE_PROMPT_DISMISS_KEY
);

const createControllerChangeWatcher = (
  serviceWorker?: ServiceWorkerContainer | null,
) => {
  if (typeof window === 'undefined' || !serviceWorker) {
    return null;
  }

  let settled = false;
  let timeoutId = 0;
  let resolvePromise: (value: boolean) => void = () => {};

  const finish = (value: boolean) => {
    if (settled) {
      return;
    }

    settled = true;
    window.clearTimeout(timeoutId);
    serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    resolvePromise(value);
  };

  const handleControllerChange = () => {
    logPwaDebug('update', 'service worker controller changed');
    finish(true);
  };

  const promise = new Promise<boolean>((resolve) => {
    resolvePromise = resolve;
    serviceWorker.addEventListener('controllerchange', handleControllerChange);
    timeoutId = window.setTimeout(() => {
      finish(false);
    }, SERVICE_WORKER_RELOAD_TIMEOUT_MS);
  });

  return {
    promise,
    cancel: () => {
      finish(false);
    },
  };
};

export function usePwaUpdatePrompt(options: PwaTestOptions = {}) {
  const bridge = shallowRef<PwaRegistrationBridge | null>(null);
  const serviceWorker = typeof navigator === 'undefined' ? null : navigator.serviceWorker;
  const localTestHost = isLocalPwaTestHost(options.testHostname);
  if (localTestHost) {
    isLocalPwaTestEnabled(options.testHostname);
  }
  const testUpdateReadyState = shallowRef(false);
  const registrationError = shallowRef<unknown>(null);
  const isReloading = shallowRef(false);
  const dismissedPromptKey = shallowRef<PwaUpdateDismissalKey | null>(null);

  const updateBridgeFlags = (flags: {
    needRefresh?: boolean;
    offlineReady?: boolean;
  }) => {
    if (!bridge.value) {
      return;
    }

    if (typeof flags.needRefresh === 'boolean') {
      bridge.value.needRefresh.value = flags.needRefresh;
    }

    if (typeof flags.offlineReady === 'boolean') {
      bridge.value.offlineReady.value = flags.offlineReady;
    }
  };

  const clearDismissedPrompt = () => {
    dismissedPromptKey.value = null;
    writeDismissedPromptKey(null);
  };

  const handleTestUpdateReady = () => {
    if (!isLocalPwaTestEnabled(options.testHostname)) {
      return;
    }

    clearDismissedPrompt();
    testUpdateReadyState.value = true;
    logPwaDebug('update', 'received local test update-ready event');
  };

  const dismissPrompt = (key: PwaUpdateDismissalKey) => {
    dismissedPromptKey.value = key;
    writeDismissedPromptKey(key);
  };

  const handleDismissedPromptStorageChange = (event: StorageEvent) => {
    if (!shouldSyncDismissedPromptFromStorage(event.key)) {
      return;
    }

    dismissedPromptKey.value = readDismissedPromptKey();
  };

  const handleServiceWorkerControllerChange = () => {
    testUpdateReadyState.value = false;
    updateBridgeFlags({ needRefresh: false, offlineReady: false });
    isReloading.value = false;
    clearDismissedPrompt();
    logPwaDebug('update', 'reset local test update-ready state after controllerchange');
  };

  const initializeBridge = () => {
    try {
      bridge.value = usePwaRegistrationBridge();
      registrationError.value = null;
      logPwaDebug('update', 'initialized pwa registration bridge', {
        needRefresh: bridge.value.needRefresh.value,
        offlineReady: bridge.value.offlineReady.value,
        hasUpdateServiceWorker: bridge.value.updateServiceWorker != null,
        hasCleanup: bridge.value.cleanup != null,
      });
    } catch (error) {
      bridge.value = null;
      registrationError.value = error;
      logPwaDebug('update', 'failed to initialize pwa registration bridge', {
        error: toPwaDebugError(error),
      });
    }
  };

  onMounted(() => {
    if (typeof window === 'undefined') {
      return;
    }

    dismissedPromptKey.value = readDismissedPromptKey();
    initializeBridge();

    serviceWorker?.addEventListener('controllerchange', handleServiceWorkerControllerChange);
    window.addEventListener('storage', handleDismissedPromptStorageChange);

    if (localTestHost) {
      window.addEventListener(PWA_TEST_UPDATE_READY_EVENT, handleTestUpdateReady);
    }
  });

  onBeforeUnmount(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (localTestHost) {
      window.removeEventListener(PWA_TEST_UPDATE_READY_EVENT, handleTestUpdateReady);
    }

    bridge.value?.cleanup?.();
    serviceWorker?.removeEventListener('controllerchange', handleServiceWorkerControllerChange);
    window.removeEventListener('storage', handleDismissedPromptStorageChange);
  });

  const rawIsUpdateReady = computed(() => (
    (bridge.value?.needRefresh.value ?? false) || testUpdateReadyState.value
  ));
  const rawIsOfflineReady = computed(() => (
    (bridge.value?.offlineReady.value ?? false) && !rawIsUpdateReady.value
  ));
  const activePromptKey = computed<PwaUpdateDismissalKey | null>(() => {
    if (rawIsUpdateReady.value) {
      return 'updateReady';
    }

    if (rawIsOfflineReady.value) {
      return 'offlineReady';
    }

    return null;
  });

  watch(activePromptKey, (nextPromptKey, previousPromptKey) => {
    if (dismissedPromptKey.value == null || nextPromptKey === previousPromptKey) {
      return;
    }

    if (nextPromptKey === dismissedPromptKey.value) {
      return;
    }

    clearDismissedPrompt();
  });

  const isUpdateReady = computed(() => (
    rawIsUpdateReady.value && dismissedPromptKey.value !== 'updateReady'
  ));
  const isOfflineReady = computed(() => (
    rawIsOfflineReady.value && dismissedPromptKey.value !== 'offlineReady'
  ));
  const lifecycleState = computed<PwaUpdateLifecycleState>(() => {
    if (registrationError.value) {
      return 'registrationError';
    }
    if (isReloading.value) {
      return 'reloading';
    }
    if (isUpdateReady.value) {
      return 'updateReady';
    }
    if (isOfflineReady.value) {
      return 'offlineReady';
    }
    return 'idle';
  });

  const reloadApp = async () => {
    logPwaDebug('update', 'refresh app clicked', {
      lifecycleState: lifecycleState.value,
      isUpdateReady: isUpdateReady.value,
      isOfflineReady: isOfflineReady.value,
      needRefresh: bridge.value?.needRefresh.value ?? null,
      offlineReady: bridge.value?.offlineReady.value ?? null,
    });
    isReloading.value = true;
    const controllerChangeWatcher = createControllerChangeWatcher(serviceWorker);

    try {
      await bridge.value?.updateServiceWorker(true);
      logPwaDebug('update', 'updateServiceWorker resolved', {
        hasControllerChangeWatcher: Boolean(controllerChangeWatcher),
      });

      if (!controllerChangeWatcher) {
        logPwaDebug('update', 'controller change watcher unavailable; leaving reloading state');
        isReloading.value = false;
        return;
      }

      const didControllerChange = await controllerChangeWatcher.promise;
      logPwaDebug('update', 'controller change wait finished', {
        didControllerChange,
      });

      isReloading.value = false;

      // Workbox reloads once the updated worker controls the page. If takeover
      // never happens, keep the prompt available so the user can retry.
      if (!didControllerChange) {
        logPwaDebug('update', 'controller change timed out; keeping update prompt visible');
      }
    } catch (error) {
      controllerChangeWatcher?.cancel();
      logPwaDebug('update', 'refresh app failed', {
        error: toPwaDebugError(error),
      });
      isReloading.value = false;
      throw error;
    }
  };

  const dismissOfflineReady = () => {
    dismissPrompt('offlineReady');
    logPwaDebug('update', 'dismissed offline-ready state');
  };

  const dismissUpdateReady = () => {
    dismissPrompt('updateReady');
    logPwaDebug('update', 'dismissed update-ready state');
  };

  return {
    isUpdateReady,
    isOfflineReady,
    lifecycleState,
    registrationError,
    reloadApp,
    dismissOfflineReady,
    dismissUpdateReady,
  };
}
