import type { AnalyticsBody } from '@global-torque/domain-types/analyticsTypes';
import { normalizeAnalyticsBodyForMethod } from '@global-torque/invest-core/analytics/analyticsBody';

export type ApiClientOfflinePolicy = {
  persistToIndexedDb?: boolean;
  [key: string]: unknown;
};

export type ApiClientOfflineStoredResponse<T> = {
  data: T;
  status: number;
  headers: Headers;
  lastSyncedAt?: string;
};

export type ApiClientOfflineResponseMetadata = {
  lastSyncedAt?: string | null;
  [key: string]: unknown;
};

export type ApiClientPersistedPayloadType = 'json' | 'text' | 'blob' | 'arrayBuffer';

export type ApiClientPersistOfflineResponseInput = {
  data: unknown;
  status: number;
  headers: Headers;
  payloadType: ApiClientPersistedPayloadType;
  updatedAt: string;
};

export type ApiClientOfflinePolicyErrorInput = {
  phase: 'read' | 'read-metadata' | 'persist';
  error: unknown;
  policy: ApiClientOfflinePolicy;
  requestUrl: string;
};

export interface ApiClientHooks {
  createRequestId: () => string;
  isOnline: () => boolean;
  matchOfflinePolicy: (requestUrl: string, method: string) => ApiClientOfflinePolicy | null;
  readOfflineResponse: <T>(
    policy: ApiClientOfflinePolicy,
    requestUrl: string,
  ) => Promise<ApiClientOfflineStoredResponse<T> | null>;
  readOfflineResponseMetadata: (
    policy: ApiClientOfflinePolicy,
    requestUrl: string,
  ) => Promise<ApiClientOfflineResponseMetadata | null>;
  persistOfflineResponse: (
    policy: ApiClientOfflinePolicy,
    requestUrl: string,
    response: ApiClientPersistOfflineResponseInput,
  ) => Promise<void>;
  reportOfflinePolicyError?: (input: ApiClientOfflinePolicyErrorInput) => void | Promise<void>;
  normalizeAnalyticsBodyForMethod: (method: string, body: BodyInit | null | undefined) => AnalyticsBody;
  offlineResponseSourceHeader: string;
  offlineLastSyncHeader: string;
}

export const DEFAULT_OFFLINE_RESPONSE_SOURCE_HEADER = 'x-invest-offline-source';
export const DEFAULT_OFFLINE_LAST_SYNC_HEADER = 'x-invest-offline-last-synced-at';

const isBrowserOnline = () => (
  typeof navigator === 'undefined' ? true : navigator.onLine
);

const createDefaultRequestId = () => {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }

  return `request-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export function createApiClientHooks(hooks: Partial<ApiClientHooks> = {}): ApiClientHooks {
  return {
    createRequestId: createDefaultRequestId,
    isOnline: isBrowserOnline,
    matchOfflinePolicy: () => null,
    readOfflineResponse: async () => null,
    readOfflineResponseMetadata: async () => null,
    persistOfflineResponse: async () => {},
    normalizeAnalyticsBodyForMethod,
    offlineResponseSourceHeader: DEFAULT_OFFLINE_RESPONSE_SOURCE_HEADER,
    offlineLastSyncHeader: DEFAULT_OFFLINE_LAST_SYNC_HEADER,
    ...hooks,
  };
}

let apiClientHooks: ApiClientHooks = createApiClientHooks();

export function resetApiClientHooks(): void {
  apiClientHooks = createApiClientHooks();
}

export function configureApiClientHooks(hooks: Partial<ApiClientHooks>): void {
  apiClientHooks = {
    ...apiClientHooks,
    ...hooks,
  };
}

export function getApiClientHooks(): ApiClientHooks {
  return apiClientHooks;
}
