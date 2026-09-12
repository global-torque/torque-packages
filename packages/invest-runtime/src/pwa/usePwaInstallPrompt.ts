import {
  computed,
  onBeforeUnmount,
  onMounted,
  shallowRef,
} from 'vue';
import {
  isInstallPromptSupportedDevice,
  isIosSafariBrowser,
  isPwaStandalone,
} from './pwaDetector.ts';
import {
  isLocalPwaTestEnabled,
  isLocalPwaTestHost,
  logPwaDebug,
} from './pwaDebug.ts';

const INSTALL_PROMPT_DISMISS_KEY = 'invest:pwa-install-prompt:dismissed-at';
const INSTALL_PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const PWA_TEST_BEFORE_INSTALL_PROMPT_EVENT = 'invest:pwa-test:before-install-prompt';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
};

export type InstallPromptOutcome = 'accepted' | 'dismissed';
export type InstallPromptState = 'hidden' | 'native' | 'manual-ios';

const readDismissedAt = () => {
  if (typeof window === 'undefined') {
    return 0;
  }

  try {
    return Number(window.localStorage.getItem(INSTALL_PROMPT_DISMISS_KEY) || '0');
  } catch {
    return 0;
  }
};

const isInstallPromptDismissedRecently = (dismissedAt: number) => (
  dismissedAt > 0 && (Date.now() - dismissedAt) < INSTALL_PROMPT_COOLDOWN_MS
);

const writeDismissedAt = (dismissedAt: number) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(INSTALL_PROMPT_DISMISS_KEY, String(dismissedAt));
  } catch {
    // Ignore storage failures and simply keep the prompt in-memory only.
  }
};

const markInstallPromptDismissed = () => {
  const dismissedAt = Date.now();
  writeDismissedAt(dismissedAt);
  return dismissedAt;
};

const shouldSyncDismissedAtFromStorage = (key: string | null) => (
  key == null || key === INSTALL_PROMPT_DISMISS_KEY
);

const installPromptRuntime = {
  deferredPrompt: shallowRef<BeforeInstallPromptEvent | null>(null),
  isInstalled: shallowRef(false),
  dismissedAt: shallowRef(0),
  isIosSafari: shallowRef(false),
  isInstallPromptSupportedDevice: shallowRef(false),
  consumerCount: 0,
  listenersBound: false,
};

const isDismissed = computed(() => (
  isInstallPromptDismissedRecently(installPromptRuntime.dismissedAt.value)
));

const sharedInstallState = computed<InstallPromptState>(() => {
  if (installPromptRuntime.isInstalled.value || isDismissed.value) {
    return 'hidden';
  }

  if (
    installPromptRuntime.deferredPrompt.value
    && installPromptRuntime.isInstallPromptSupportedDevice.value
  ) {
    return 'native';
  }

  return (
    installPromptRuntime.isIosSafari.value
    && installPromptRuntime.isInstallPromptSupportedDevice.value
  ) ? 'manual-ios' : 'hidden';
});

const syncDismissedState = () => {
  installPromptRuntime.dismissedAt.value = readDismissedAt();
  return isDismissed.value;
};

const syncRuntimeState = () => {
  installPromptRuntime.isInstalled.value = isPwaStandalone();
  installPromptRuntime.isInstallPromptSupportedDevice.value = isInstallPromptSupportedDevice();
  return {
    isInstalled: installPromptRuntime.isInstalled.value,
    isInstallPromptSupportedDevice: installPromptRuntime.isInstallPromptSupportedDevice.value,
    dismissedRecently: syncDismissedState(),
  };
};

const dismissInstallPrompt = (reason = 'dismissed-manually') => {
  installPromptRuntime.dismissedAt.value = markInstallPromptDismissed();
  logPwaDebug('install', 'hiding install prompt', {
    reason,
    hasDeferredPrompt: Boolean(installPromptRuntime.deferredPrompt.value),
    dismissedRecently: isDismissed.value,
    installState: sharedInstallState.value,
  });
};

const setDeferredPrompt = (
  promptEvent: BeforeInstallPromptEvent,
  message: string,
  payload: Record<string, unknown> = {},
) => {
  installPromptRuntime.deferredPrompt.value = promptEvent;
  const dismissedRecently = syncDismissedState();

  logPwaDebug('install', message, {
    ...payload,
    dismissedRecently,
    installState: sharedInstallState.value,
  });
};

const handleDismissedAtStorageChange = (event: StorageEvent) => {
  if (!shouldSyncDismissedAtFromStorage(event.key)) {
    return;
  }

  const previousDismissedAt = installPromptRuntime.dismissedAt.value;
  syncDismissedState();

  if (installPromptRuntime.dismissedAt.value === previousDismissedAt) {
    return;
  }

  logPwaDebug('install', 'synced install prompt dismissal from storage', {
    dismissedRecently: isDismissed.value,
    installState: sharedInstallState.value,
  });
};

const handleVisibilityChange = () => {
  if (document.visibilityState !== 'visible') {
    return;
  }

  const previousInstallState = sharedInstallState.value;
  const previousIsInstalled = installPromptRuntime.isInstalled.value;
  const previousDismissedAt = installPromptRuntime.dismissedAt.value;
  const runtimeState = syncRuntimeState();

  if (
    previousInstallState === sharedInstallState.value
    && previousIsInstalled === installPromptRuntime.isInstalled.value
    && previousDismissedAt === installPromptRuntime.dismissedAt.value
  ) {
    return;
  }

  logPwaDebug('install', 'refreshed install prompt state after tab became visible', {
    ...runtimeState,
    installState: sharedInstallState.value,
  });
};

const handleBeforeInstallPrompt = (event: Event) => {
  event.preventDefault();

  if (!installPromptRuntime.isInstallPromptSupportedDevice.value) {
    logPwaDebug('install', 'ignored beforeinstallprompt on unsupported device', {
      isInstallPromptSupportedDevice: installPromptRuntime.isInstallPromptSupportedDevice.value,
      installState: sharedInstallState.value,
    });
    return;
  }

  setDeferredPrompt(
    event as BeforeInstallPromptEvent,
    'received beforeinstallprompt event',
  );
};

const handleAppInstalled = () => {
  installPromptRuntime.isInstalled.value = true;
  installPromptRuntime.deferredPrompt.value = null;
  logPwaDebug('install', 'received appinstalled event', {
    installState: sharedInstallState.value,
  });
};

const bindWindowListeners = () => {
  if (typeof window === 'undefined' || installPromptRuntime.listenersBound) {
    return;
  }

  installPromptRuntime.isIosSafari.value = isIosSafariBrowser();

  const runtimeState = syncRuntimeState();
  logPwaDebug('install', 'initialized install prompt composable', {
    ...runtimeState,
    installState: sharedInstallState.value,
    isIosSafari: installPromptRuntime.isIosSafari.value,
  });

  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('appinstalled', handleAppInstalled);
  window.addEventListener('storage', handleDismissedAtStorageChange);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  installPromptRuntime.listenersBound = true;
};

const unbindWindowListeners = () => {
  if (typeof window === 'undefined' || !installPromptRuntime.listenersBound) {
    return;
  }

  window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.removeEventListener('appinstalled', handleAppInstalled);
  window.removeEventListener('storage', handleDismissedAtStorageChange);
  document.removeEventListener('visibilitychange', handleVisibilityChange);

  installPromptRuntime.listenersBound = false;
};

const retainWindowListeners = () => {
  if (typeof window === 'undefined') {
    return;
  }

  installPromptRuntime.consumerCount += 1;
  bindWindowListeners();
};

const releaseWindowListeners = () => {
  if (typeof window === 'undefined') {
    return;
  }

  installPromptRuntime.consumerCount = Math.max(0, installPromptRuntime.consumerCount - 1);
  if (installPromptRuntime.consumerCount === 0) {
    unbindWindowListeners();
  }
};

const resetInstallPromptRuntime = () => {
  installPromptRuntime.deferredPrompt.value = null;
  installPromptRuntime.isInstalled.value = false;
  installPromptRuntime.dismissedAt.value = 0;
  installPromptRuntime.isIosSafari.value = false;
  installPromptRuntime.isInstallPromptSupportedDevice.value = false;
  installPromptRuntime.consumerCount = 0;
};

export const resetPwaInstallPromptRuntimeForTests = () => {
  unbindWindowListeners();
  resetInstallPromptRuntime();
};

export type PwaInstallPromptOptions = {
  testHostname?: string;
};

export function usePwaInstallPrompt(options: PwaInstallPromptOptions = {}) {
  const localTestPrompt = shallowRef<BeforeInstallPromptEvent | null>(null);
  const localTestHost = isLocalPwaTestHost(options.testHostname);

  if (localTestHost) {
    isLocalPwaTestEnabled(options.testHostname);
  }

  const clearLocalTestPrompt = () => {
    localTestPrompt.value = null;
  };

  const handleTestBeforeInstallPrompt = (event: Event) => {
    if (!isLocalPwaTestEnabled(options.testHostname)) {
      return;
    }

    const customEvent = event as CustomEvent<{ outcome?: InstallPromptOutcome }>;
    const outcome = customEvent.detail?.outcome ?? 'accepted';

    localTestPrompt.value = {
      prompt: async () => {},
      userChoice: Promise.resolve({
        outcome,
        platform: 'web',
      }),
    } as BeforeInstallPromptEvent;
    logPwaDebug('install', 'received local test install prompt event', { outcome });
  };

  const handleLocalAppInstalled = () => {
    clearLocalTestPrompt();
  };

  onMounted(() => {
    retainWindowListeners();
    if (typeof window !== 'undefined' && localTestHost) {
      window.addEventListener(PWA_TEST_BEFORE_INSTALL_PROMPT_EVENT, handleTestBeforeInstallPrompt);
      window.addEventListener('appinstalled', handleLocalAppInstalled);
    }
  });

  onBeforeUnmount(() => {
    if (typeof window !== 'undefined' && localTestHost) {
      window.removeEventListener(PWA_TEST_BEFORE_INSTALL_PROMPT_EVENT, handleTestBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleLocalAppInstalled);
    }
    clearLocalTestPrompt();
    releaseWindowListeners();
  });

  const deferredPrompt = computed(() => (
    localTestPrompt.value ?? installPromptRuntime.deferredPrompt.value
  ));
  const installState = computed<InstallPromptState>(() => {
    if (installPromptRuntime.isInstalled.value || isDismissed.value) {
      return 'hidden';
    }

    if (
      deferredPrompt.value
      && installPromptRuntime.isInstallPromptSupportedDevice.value
    ) {
      return 'native';
    }

    return (
      installPromptRuntime.isIosSafari.value
      && installPromptRuntime.isInstallPromptSupportedDevice.value
    ) ? 'manual-ios' : 'hidden';
  });

  const canInstall = computed(() => installState.value === 'native');
  const showManualInstall = computed(() => installState.value === 'manual-ios');

  const promptInstall = async (): Promise<InstallPromptOutcome | null> => {
    if (!deferredPrompt.value) {
      logPwaDebug('install', 'promptInstall called without a deferred prompt', {
        installState: installState.value,
      });
      return null;
    }

    const promptEvent = deferredPrompt.value;
    const isLocalPrompt = localTestPrompt.value === promptEvent;
    logPwaDebug('install', 'triggering native install prompt', {
      installState: installState.value,
    });
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    logPwaDebug('install', 'native install prompt resolved', {
      outcome: choice.outcome,
      platform: choice.platform,
    });

    if (choice.outcome === 'accepted') {
      if (isLocalPrompt) {
        clearLocalTestPrompt();
      } else {
        installPromptRuntime.deferredPrompt.value = null;
      }
      return 'accepted';
    }

    if (isLocalPrompt) {
      clearLocalTestPrompt();
      return 'dismissed';
    }

    installPromptRuntime.deferredPrompt.value = null;
    dismissInstallPrompt('dismissed-by-browser');
    return 'dismissed';
  };

  const dismissInstallPromptForConsumer = (reason?: string): void => {
    if (localTestPrompt.value) {
      clearLocalTestPrompt();
      return;
    }

    dismissInstallPrompt(reason);
  };

  return {
    canInstall,
    installState,
    showManualInstall,
    promptInstall,
    dismissInstallPrompt: dismissInstallPromptForConsumer,
  };
}
