import {
  OFFLINE_DOMAINS,
  PWA_PRIVATE_CACHE_NAMES,
  type OfflineCacheScope,
  type ResolvedOfflineDomainPolicy,
} from './pwaPolicy.ts';
import {
  createOfflineStoreKey,
  isOfflineStoreRecordExpired,
  resolveOfflineCachePartition,
  validateOfflineStoreRecord,
  type OfflineStoreRecord,
  type PersistedPayloadType,
} from './pwaOfflineRecord.ts';

export const PWA_OFFLINE_DB_NAME = 'invest-pwa-offline';
const DB_VERSION = 2;
export const PWA_OFFLINE_STORE_NAME = 'responses';

export const PWA_OFFLINE_DATA_UPDATED_EVENT = 'invest:pwa-offline-data-updated';
export const PWA_OFFLINE_RESPONSE_SOURCE_HEADER = 'x-invest-offline-source';
export const PWA_OFFLINE_LAST_SYNC_HEADER = 'x-invest-offline-last-synced-at';

export type OfflineStoredResponse<T> = {
  data: T;
  status: number;
  headers: Headers;
  lastSyncedAt: string;
};

const isIndexedDbAvailable = () => (
  typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined'
);

const emitOfflineStoreUpdated = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(PWA_OFFLINE_DATA_UPDATED_EVENT));
};

const requestToPromise = <T>(request: IDBRequest<T>) => (
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  })
);

const transactionDoneToPromise = (transaction: IDBTransaction) => (
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
  })
);

const openDatabase = async () => {
  if (!isIndexedDbAvailable()) {
    return null;
  }

  const request = window.indexedDB.open(PWA_OFFLINE_DB_NAME, DB_VERSION);

  request.onupgradeneeded = (event) => {
    const database = request.result;
    if (!database.objectStoreNames.contains(PWA_OFFLINE_STORE_NAME)) {
      const store = database.createObjectStore(PWA_OFFLINE_STORE_NAME, { keyPath: 'key' });
      store.createIndex('scope', 'scope', { unique: false });
      store.createIndex('updatedAt', 'updatedAt', { unique: false });
    }
    else if ((event as IDBVersionChangeEvent).oldVersion < 2) {
      // v1 records were not partitioned by session/profile. They must not
      // survive the schema upgrade as inaccessible private data at rest.
      request.transaction?.objectStore(PWA_OFFLINE_STORE_NAME).clear();
    }
  };

  return await requestToPromise(request);
};

const withStore = async <T>(
  mode: IDBTransactionMode,
  handler: (store: IDBObjectStore, transaction: IDBTransaction) => Promise<T>,
) => {
  const database = await openDatabase();
  if (!database) {
    return null;
  }

  try {
    const transaction = database.transaction(PWA_OFFLINE_STORE_NAME, mode);
    const transactionDone = transactionDoneToPromise(transaction);
    const store = transaction.objectStore(PWA_OFFLINE_STORE_NAME);
    const result = await handler(store, transaction);
    await transactionDone;
    return result;
  } finally {
    database.close();
  }
};

const createOfflineHeaders = (headers: [string, string][], lastSyncedAt: string) => {
  const nextHeaders = new Headers(headers);
  nextHeaders.set(PWA_OFFLINE_RESPONSE_SOURCE_HEADER, 'offline-cache');
  nextHeaders.set(PWA_OFFLINE_LAST_SYNC_HEADER, lastSyncedAt);
  return nextHeaders;
};

export const isOfflineRecordExpired = (
  updatedAt: string,
  maxAgeSeconds: number | undefined,
  now = Date.now(),
) => {
  if (maxAgeSeconds === undefined) return false;
  const updatedAtMs = Date.parse(updatedAt);
  return !Number.isFinite(updatedAtMs) || now - updatedAtMs > maxAgeSeconds * 1000;
};

export const readOfflineResponseMetadata = async (
  policy: ResolvedOfflineDomainPolicy,
  requestUrl: string,
  partition?: string | null,
) => {
  const resolvedPartition = resolveOfflineCachePartition(policy, partition);
  const key = createOfflineStoreKey(policy, requestUrl, resolvedPartition);
  return withStore('readwrite', async (store) => {
    const storedValue = await requestToPromise(store.get(key) as IDBRequest<unknown>);
    if (!storedValue) {
      return null;
    }
    const record = validateOfflineStoreRecord(
      storedValue,
      policy,
      requestUrl,
      key,
      resolvedPartition,
    );
    if (isOfflineStoreRecordExpired(record, Date.now(), policy.maxAgeSeconds)) {
      store.delete(key);
      return null;
    }

    return {
      lastSyncedAt: record.updatedAt,
      scope: record.scope,
      domainKey: record.domainKey,
    };
  });
};

export const readOfflineResponse = async <T>(
  policy: ResolvedOfflineDomainPolicy,
  requestUrl: string,
  partition?: string | null,
) => {
  const resolvedPartition = resolveOfflineCachePartition(policy, partition);
  const key = createOfflineStoreKey(policy, requestUrl, resolvedPartition);
  return withStore('readwrite', async (store) => {
    const storedValue = await requestToPromise(store.get(key) as IDBRequest<unknown>);
    if (!storedValue) {
      return null;
    }
    const record = validateOfflineStoreRecord(
      storedValue,
      policy,
      requestUrl,
      key,
      resolvedPartition,
    );
    if (isOfflineStoreRecordExpired(record, Date.now(), policy.maxAgeSeconds)) {
      store.delete(key);
      return null;
    }

    return {
      data: record.payload as T,
      status: record.status,
      headers: createOfflineHeaders(record.headers, record.updatedAt),
      lastSyncedAt: record.updatedAt,
    } satisfies OfflineStoredResponse<T>;
  });
};

export const persistOfflineResponse = async (
  policy: ResolvedOfflineDomainPolicy,
  requestUrl: string,
  response: {
    data: unknown;
    status: number;
    headers: Headers;
    payloadType: PersistedPayloadType;
    updatedAt: string;
  },
  partition?: string | null,
) => {
  const resolvedPartition = resolveOfflineCachePartition(policy, partition);
  const key = createOfflineStoreKey(policy, requestUrl, resolvedPartition);
  const maxAgeSeconds = policy.maxAgeSeconds ?? 0;
  const record: OfflineStoreRecord = {
    key,
    url: requestUrl,
    domainKey: policy.key,
    scope: policy.scope,
    partition: resolvedPartition,
    status: response.status,
    updatedAt: response.updatedAt,
    expiresAt: new Date(
      Date.parse(response.updatedAt) + maxAgeSeconds * 1_000,
    ).toISOString(),
    headers: Array.from(response.headers.entries()),
    payloadType: response.payloadType,
    payload: response.data,
  };

  await withStore('readwrite', async (store) => {
    store.put(record);
  });
  emitOfflineStoreUpdated();
};

export const readLatestOfflineSyncAt = async (scope: OfflineCacheScope | 'any' = 'any') => {
  const result = await withStore('readwrite', async (store) => {
    const request = scope === 'any'
      ? store.getAll()
      : store.index('scope').getAll(scope);
    const records = await requestToPromise(request as IDBRequest<OfflineStoreRecord[]>);
    const activeRecords = records.filter((record) => {
      const policyMaxAgeSeconds = OFFLINE_DOMAINS.find(
        policy => policy.key === record.domainKey,
      )?.maxAgeSeconds;
      if (!record.expiresAt || isOfflineStoreRecordExpired(
        record,
        Date.now(),
        policyMaxAgeSeconds,
      )) {
        if (record.key) store.delete(record.key);
        return false;
      }
      return true;
    });
    if (!activeRecords.length) {
      return null;
    }

    return activeRecords.reduce<string | null>((latest, record) => {
      if (!latest || new Date(record.updatedAt).getTime() > new Date(latest).getTime()) {
        return record.updatedAt;
      }
      return latest;
    }, null);
  });

  return result ?? null;
};

export const clearOfflineResponsesByScope = async (scope: OfflineCacheScope) => {
  await withStore('readwrite', async (store) => {
    const records = await requestToPromise(
      store.index('scope').getAll(scope) as IDBRequest<OfflineStoreRecord[]>,
    );

    for (const record of records) {
      store.delete(record.key);
    }
  });
  emitOfflineStoreUpdated();
};

const retiredPrivateCacheNames = [1, 2].flatMap(version => (
  PWA_PRIVATE_CACHE_NAMES.map(cacheName => cacheName.replace(/-v\d+$/u, `-v${version}`))
));

export const clearPrivateRuntimeCaches = async () => {
  if (typeof caches === 'undefined') {
    return;
  }

  const existing = await caches.keys();
  await Promise.all(
    existing
      .filter((cacheName) => (
        PWA_PRIVATE_CACHE_NAMES.includes(cacheName as typeof PWA_PRIVATE_CACHE_NAMES[number])
        || retiredPrivateCacheNames.includes(cacheName)
      ))
      .map((cacheName) => caches.delete(cacheName)),
  );
};

export const clearPrivatePwaData = async () => {
  await Promise.all([
    clearPrivateRuntimeCaches(),
    clearOfflineResponsesByScope('private'),
  ]);
  emitOfflineStoreUpdated();
};
