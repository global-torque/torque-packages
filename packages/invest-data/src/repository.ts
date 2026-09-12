import {
  DEFAULT_OFFLINE_LAST_SYNC_HEADER,
  DEFAULT_OFFLINE_RESPONSE_SOURCE_HEADER,
} from './service/apiClientHooks.ts';

export type OfflineHydrationSource = 'network' | 'offline-cache';

export type ActionState<T> = {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  lastSyncedAt?: string | null;
  dataSource?: OfflineHydrationSource | null;
};

export type OfflineHydrationMeta = {
  lastSyncedAt: string | null;
  dataSource: OfflineHydrationSource | null;
};

/**
 * Use for OPTIONS or other unknown response shapes in repository state types.
 * Narrow at use site when reading.
 */
export type OptionsStateData = unknown;

export const createInitialActionState = <T>(data?: T): ActionState<T> => ({
  data,
  loading: false,
  error: null,
});

export const createLoadingActionState = <T>(): ActionState<T> => ({
  data: undefined,
  loading: true,
  error: null,
});

export const createSuccessActionState = <T>(data: T): ActionState<T> => ({
  data,
  loading: false,
  error: null,
});

export const createErrorActionState = <T>(error: Error): ActionState<T> => ({
  data: undefined,
  loading: false,
  error,
});

export const getOfflineHydrationMeta = (headers: Headers): OfflineHydrationMeta | null => {
  const lastSyncedAt = headers.get(DEFAULT_OFFLINE_LAST_SYNC_HEADER);
  const dataSource = headers.get(DEFAULT_OFFLINE_RESPONSE_SOURCE_HEADER);

  if (!lastSyncedAt && !dataSource) {
    return null;
  }

  return {
    lastSyncedAt: lastSyncedAt ?? null,
    dataSource: dataSource === 'network' || dataSource === 'offline-cache'
      ? dataSource
      : null,
  };
};

export const withOfflineHydrationMeta = <T>(
  state: ActionState<T>,
  headers: Headers,
): ActionState<T> => {
  const meta = getOfflineHydrationMeta(headers);

  return meta ? { ...state, ...meta } : state;
};
