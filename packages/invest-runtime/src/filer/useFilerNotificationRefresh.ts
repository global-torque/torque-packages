import { getCurrentScope, onScopeDispose, watch, type Ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useFilerModel } from './useFilerModel.ts';
import type { FilerNotificationFields } from '@global-torque/domain-types/filerTypes';
import { reportError } from '../error/errorReporting.ts';

type BooleanRef = Readonly<Ref<boolean>>;

export interface UseFilerNotificationRefreshOptions {
  refresh: () => Promise<void>;
  refreshErrorMessage: string;
  enabled?: BooleanRef;
  match?: (fields: FilerNotificationFields) => boolean;
  delayMs?: number;
  fallbackMs?: number;
  fallbackErrorMessage?: string;
  onSettled?: () => void;
}

export function useFilerNotificationRefresh(options: UseFilerNotificationRefreshOptions) {
  const filerRepository = useFilerModel();
  const { notificationFieldsState } = storeToRefs(filerRepository);

  let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
  let fallbackTimeout: ReturnType<typeof setTimeout> | null = null;

  const clearRefreshTimeout = () => {
    if (refreshTimeout) {
      clearTimeout(refreshTimeout);
      refreshTimeout = null;
    }
  };

  const clearFallbackTimeout = () => {
    if (fallbackTimeout) {
      clearTimeout(fallbackTimeout);
      fallbackTimeout = null;
    }
  };

  const clearPendingRefresh = () => {
    clearRefreshTimeout();
    clearFallbackTimeout();
  };

  const finishRefresh = () => {
    clearPendingRefresh();
    options.onSettled?.();
  };

  const runRefresh = async (errorMessage: string) => {
    try {
      await options.refresh();
    } catch (error) {
      reportError(error, errorMessage);
    } finally {
      finishRefresh();
    }
  };

  const triggerRefresh = (errorMessage = options.refreshErrorMessage) => {
    const delayMs = options.delayMs ?? 0;
    clearPendingRefresh();

    if (delayMs <= 0) {
      void runRefresh(errorMessage);
      return;
    }

    refreshTimeout = setTimeout(() => {
      void runRefresh(errorMessage);
    }, delayMs);
  };

  const scheduleFallbackRefresh = () => {
    const fallbackMs = options.fallbackMs ?? 0;
    if (fallbackMs <= 0) {
      return;
    }

    clearFallbackTimeout();
    fallbackTimeout = setTimeout(() => {
      void runRefresh(options.fallbackErrorMessage ?? options.refreshErrorMessage);
    }, fallbackMs);
  };

  watch(
    () => notificationFieldsState.value.data,
    (fields) => {
      if (!fields) {
        return;
      }

      if (options.enabled && !options.enabled.value) {
        return;
      }

      if (options.match && !options.match(fields)) {
        return;
      }

      triggerRefresh();
    },
  );

  if (getCurrentScope()) {
    onScopeDispose(() => {
      clearPendingRefresh();
    });
  }

  return {
    clearPendingRefresh,
    scheduleFallbackRefresh,
    triggerRefresh,
  };
}
