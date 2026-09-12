import {
  shallowRef,
  type Ref,
} from 'vue';
import {
  logPwaDebug,
  toPwaDebugError,
} from './pwaDebug.ts';

export interface PwaRegistrationBridge {
  needRefresh: Ref<boolean>;
  offlineReady: Ref<boolean>;
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  cleanup?: () => void;
}

type PwaRegistrationBridgeFactory = () => PwaRegistrationBridge;

let pwaRegistrationBridgeFactory: PwaRegistrationBridgeFactory | null = null;

const createNoopBridge = (): PwaRegistrationBridge => ({
  needRefresh: shallowRef(false),
  offlineReady: shallowRef(false),
  updateServiceWorker: async () => {},
});

const isServiceWorkerSupported = () => (
  typeof window !== 'undefined'
  && typeof navigator !== 'undefined'
  && 'serviceWorker' in navigator
);

const createBrowserPwaRegistrationBridge = (): PwaRegistrationBridge => {
  if (!isServiceWorkerSupported()) {
    logPwaDebug('registration', 'service worker unsupported; using noop browser bridge');
    return createNoopBridge();
  }

  const needRefresh = shallowRef(false);
  const offlineReady = shallowRef(false);
  let registration: ServiceWorkerRegistration | null = null;
  let cleanupInstallingWorker = () => {};
  let cleanupRegistration = () => {};
  let isDisposed = false;

  logPwaDebug('registration', 'creating browser pwa registration bridge');

  const syncState = () => {
    if (isDisposed) {
      return;
    }

    const nextNeedRefresh = !!registration?.waiting && !!navigator.serviceWorker.controller;
    needRefresh.value = nextNeedRefresh;

    if (nextNeedRefresh) {
      offlineReady.value = false;
    }

    if (!registration) {
      offlineReady.value = false;
    }
  };

  const watchInstallingWorker = (worker?: ServiceWorker | null) => {
    cleanupInstallingWorker();

    if (isDisposed || !worker) {
      return;
    }

    const activeWorker = worker;

    const handleStateChange = () => {
      logPwaDebug('registration', 'installing worker state changed', {
        state: activeWorker.state,
        hasController: !!navigator.serviceWorker.controller,
      });

      if (activeWorker.state !== 'installed') {
        return;
      }

      if (registration?.waiting || navigator.serviceWorker.controller) {
        needRefresh.value = true;
        offlineReady.value = false;
        logPwaDebug('registration', 'worker installed with an active controller; update is ready');
        return;
      }

      offlineReady.value = true;
      logPwaDebug('registration', 'worker installed without an active controller; offline cache is ready');
    };

    activeWorker.addEventListener('statechange', handleStateChange);
    cleanupInstallingWorker = () => {
      activeWorker.removeEventListener('statechange', handleStateChange);
    };
  };

  const watchRegistration = (nextRegistration: ServiceWorkerRegistration | null) => {
    if (isDisposed) {
      return;
    }

    cleanupRegistration();
    cleanupInstallingWorker();
    registration = nextRegistration;

    if (!registration) {
      logPwaDebug('registration', 'cleared active service worker registration');
      syncState();
      return;
    }

    const activeRegistration = registration;

    const handleUpdateFound = () => {
      if (isDisposed) {
        return;
      }

      logPwaDebug('registration', 'service worker updatefound fired');
      watchInstallingWorker(activeRegistration.installing);
      syncState();
    };

    logPwaDebug('registration', 'watching browser service worker registration', {
      scope: activeRegistration.scope,
      hasWaitingWorker: !!activeRegistration.waiting,
      hasInstallingWorker: !!activeRegistration.installing,
    });

    activeRegistration.addEventListener('updatefound', handleUpdateFound);
    cleanupRegistration = () => {
      activeRegistration.removeEventListener('updatefound', handleUpdateFound);
    };

    watchInstallingWorker(activeRegistration.installing);
    syncState();
  };

  const syncRegistration = async () => {
    try {
      const nextRegistration = await navigator.serviceWorker.getRegistration();
      if (isDisposed) {
        return;
      }

      watchRegistration(nextRegistration ?? null);
      logPwaDebug('registration', 'synced browser service worker registration', {
        hasRegistration: !!nextRegistration,
        scope: nextRegistration?.scope ?? null,
      });
    } catch (error) {
      if (isDisposed) {
        return;
      }

      watchRegistration(null);
      logPwaDebug('registration', 'failed to sync browser service worker registration', {
        error: toPwaDebugError(error),
      });
    }
  };

  const handleControllerChange = () => {
    if (isDisposed) {
      return;
    }

    needRefresh.value = false;
    offlineReady.value = false;
    logPwaDebug('registration', 'service worker controller changed; resyncing registration');
    void syncRegistration();
  };

  navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

  void syncRegistration();
  void navigator.serviceWorker.ready
    .then((nextRegistration) => {
      if (isDisposed) {
        return;
      }

      logPwaDebug('registration', 'navigator.serviceWorker.ready resolved', {
        scope: nextRegistration.scope,
      });
      watchRegistration(nextRegistration);
    })
    .catch((error) => {
      if (isDisposed) {
        return;
      }

      logPwaDebug('registration', 'navigator.serviceWorker.ready rejected', {
        error: toPwaDebugError(error),
      });
    });

  return {
    needRefresh,
    offlineReady,
    updateServiceWorker: async () => {
      if (isDisposed) {
        return;
      }

      logPwaDebug('registration', 'updateServiceWorker requested', {
        hasWaitingWorker: !!registration?.waiting,
      });

      if (!registration?.waiting) {
        await syncRegistration();
      }

      registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
    },
    cleanup: () => {
      if (isDisposed) {
        return;
      }

      isDisposed = true;
      logPwaDebug('registration', 'cleaning up browser pwa registration bridge listeners');
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      cleanupRegistration();
      cleanupInstallingWorker();
    },
  };
};

export const setPwaRegistrationBridgeFactory = (
  nextFactory: PwaRegistrationBridgeFactory | null,
) => {
  pwaRegistrationBridgeFactory = nextFactory;
  logPwaDebug('registration', 'updated pwa registration bridge factory', {
    hasFactory: Boolean(nextFactory),
  });
};

export const usePwaRegistrationBridge = () => {
  if (pwaRegistrationBridgeFactory) {
    logPwaDebug('registration', 'using injected pwa registration bridge factory');
    return pwaRegistrationBridgeFactory();
  }

  logPwaDebug('registration', 'using browser fallback pwa registration bridge');
  return createBrowserPwaRegistrationBridge();
};
