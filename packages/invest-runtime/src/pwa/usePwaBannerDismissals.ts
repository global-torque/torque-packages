import {
  computed,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  watch,
  type Ref,
} from 'vue';

export type PwaBannerDismissalKey =
  | 'offline'
  | 'reconnected';

const PWA_BANNER_DISMISS_KEY = 'invest:pwa-banner:dismissed-key';

const readDismissedBannerKey = (): PwaBannerDismissalKey | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const storedValue = window.localStorage.getItem(PWA_BANNER_DISMISS_KEY);
    return storedValue === 'offline' || storedValue === 'reconnected'
      ? storedValue
      : null;
  } catch {
    return null;
  }
};

const writeDismissedBannerKey = (value: PwaBannerDismissalKey | null) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (value == null) {
      window.localStorage.removeItem(PWA_BANNER_DISMISS_KEY);
      return;
    }

    window.localStorage.setItem(PWA_BANNER_DISMISS_KEY, value);
  } catch {
    // Ignore storage failures and keep dismissal state in memory only.
  }
};

export function usePwaBannerDismissals(activeBannerKey: Ref<PwaBannerDismissalKey | null>) {
  const dismissedBannerKey = shallowRef<PwaBannerDismissalKey | null>(readDismissedBannerKey());

  const resetDismissedBanner = () => {
    dismissedBannerKey.value = null;
    writeDismissedBannerKey(null);
  };

  const syncDismissedBannerFromStorage = (event?: StorageEvent) => {
    if (event && event.key != null && event.key !== PWA_BANNER_DISMISS_KEY) {
      return;
    }

    dismissedBannerKey.value = readDismissedBannerKey();
  };

  watch(activeBannerKey, (nextBannerKey, previousBannerKey) => {
    if (nextBannerKey === previousBannerKey || dismissedBannerKey.value == null) {
      return;
    }

    if (nextBannerKey == null || nextBannerKey === dismissedBannerKey.value) {
      return;
    }

    resetDismissedBanner();
  });

  onMounted(() => {
    syncDismissedBannerFromStorage();
    window.addEventListener('storage', syncDismissedBannerFromStorage);
  });

  onBeforeUnmount(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.removeEventListener('storage', syncDismissedBannerFromStorage);
  });

  const isBannerVisible = computed(() => (
    activeBannerKey.value != null
    && activeBannerKey.value !== dismissedBannerKey.value
  ));

  const dismissActiveBanner = () => {
    dismissedBannerKey.value = activeBannerKey.value;
    writeDismissedBannerKey(dismissedBannerKey.value);
  };

  return {
    isBannerVisible,
    dismissActiveBanner,
  };
}
