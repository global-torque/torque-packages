import {
  computed,
  onBeforeUnmount,
  onMounted,
  shallowRef,
} from 'vue';
import {
  PWA_OFFLINE_DATA_UPDATED_EVENT,
  readLatestOfflineSyncAt,
} from './pwaOfflineStore.ts';

export function usePwaOfflineDataStatus() {
  const lastSyncedAt = shallowRef<string | null>(null);

  const syncLastSyncedAt = async () => {
    lastSyncedAt.value = await readLatestOfflineSyncAt('any');
  };

  onMounted(() => {
    void syncLastSyncedAt();
    window.addEventListener(PWA_OFFLINE_DATA_UPDATED_EVENT, syncLastSyncedAt);
  });

  onBeforeUnmount(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.removeEventListener(PWA_OFFLINE_DATA_UPDATED_EVENT, syncLastSyncedAt);
  });

  return {
    lastSyncedAt,
    hasOfflineData: computed(() => Boolean(lastSyncedAt.value)),
    refreshOfflineDataStatus: syncLastSyncedAt,
  };
}
