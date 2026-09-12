import type {
  OfflineCacheScope,
  ResolvedOfflineDomainPolicy,
} from './pwaPolicy.ts';

export type PersistedPayloadType = 'json' | 'text' | 'blob' | 'arrayBuffer';

export type OfflineStoreRecord = {
  key: string;
  url: string;
  domainKey: string;
  scope: OfflineCacheScope;
  partition: string;
  status: number;
  updatedAt: string;
  expiresAt: string;
  headers: [string, string][];
  payloadType: PersistedPayloadType;
  payload: ArrayBuffer | Blob | string | unknown;
};

export class OfflineStoreCorruptionError extends Error {
  constructor() {
    super('The offline response cache entry is invalid.');
    this.name = 'OfflineStoreCorruptionError';
  }
}

export class OfflinePrivateCachePartitionError extends Error {
  constructor() {
    super('A private offline cache partition is required.');
    this.name = 'OfflinePrivateCachePartitionError';
  }
}

export const resolveOfflineCachePartition = (
  policy: ResolvedOfflineDomainPolicy,
  partition?: string | null,
): string => {
  if (policy.scope === 'public') return 'public';
  const normalized = partition?.trim();
  if (!normalized) throw new OfflinePrivateCachePartitionError();
  return normalized;
};

export const createOfflineStoreKey = (
  policy: ResolvedOfflineDomainPolicy,
  requestUrl: string,
  partition?: string | null,
): string => {
  const resolvedPartition = resolveOfflineCachePartition(policy, partition);
  return `${policy.key}:${encodeURIComponent(resolvedPartition)}:${requestUrl}`;
};

export const isOfflineStoreRecordExpired = (
  record: Pick<OfflineStoreRecord, 'expiresAt' | 'updatedAt'>,
  now = Date.now(),
  maxAgeSeconds?: number,
): boolean => {
  const storedExpiresAt = Date.parse(record.expiresAt);
  const policyExpiresAt = typeof maxAgeSeconds === 'number' && maxAgeSeconds > 0
    ? Date.parse(record.updatedAt) + maxAgeSeconds * 1_000
    : storedExpiresAt;
  const effectiveExpiresAt = Math.min(storedExpiresAt, policyExpiresAt);
  return !Number.isFinite(effectiveExpiresAt) || effectiveExpiresAt <= now;
};

const isStringTuple = (value: unknown): value is [string, string] => (
  Array.isArray(value)
  && value.length === 2
  && typeof value[0] === 'string'
  && typeof value[1] === 'string'
);

const hasValidPayload = (payloadType: PersistedPayloadType, payload: unknown): boolean => {
  switch (payloadType) {
    case 'text':
      return typeof payload === 'string';
    case 'blob':
      return typeof Blob !== 'undefined' && payload instanceof Blob;
    case 'arrayBuffer':
      return typeof ArrayBuffer !== 'undefined' && payload instanceof ArrayBuffer;
    case 'json':
      return true;
  }
};

export const validateOfflineStoreRecord = (
  value: unknown,
  policy: ResolvedOfflineDomainPolicy,
  requestUrl: string,
  expectedKey: string,
  expectedPartition: string,
): OfflineStoreRecord => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new OfflineStoreCorruptionError();
  }

  const record = value as Partial<OfflineStoreRecord> & Record<string, unknown>;
  const payloadTypes: readonly PersistedPayloadType[] = ['json', 'text', 'blob', 'arrayBuffer'];
  const payloadType = record.payloadType;
  const validHeaders = Array.isArray(record.headers) && record.headers.every(isStringTuple);
  const validUpdatedAt = typeof record.updatedAt === 'string'
    && Number.isFinite(Date.parse(record.updatedAt));
  const validExpiresAt = typeof record.expiresAt === 'string'
    && Number.isFinite(Date.parse(record.expiresAt))
    && validUpdatedAt
    && Date.parse(record.expiresAt) > Date.parse(record.updatedAt as string);
  const validPayloadType = typeof payloadType === 'string'
    && payloadTypes.includes(payloadType as PersistedPayloadType);

  if (
    record.key !== expectedKey
    || record.url !== requestUrl
    || record.domainKey !== policy.key
    || record.scope !== policy.scope
    || record.partition !== expectedPartition
    || !Number.isInteger(record.status)
    || Number(record.status) < 200
    || Number(record.status) > 299
    || !validUpdatedAt
    || !validExpiresAt
    || !validHeaders
    || !validPayloadType
    || !Object.hasOwn(record, 'payload')
    || !hasValidPayload(payloadType as PersistedPayloadType, record.payload)
  ) {
    throw new OfflineStoreCorruptionError();
  }

  try {
    new Headers(record.headers as [string, string][]);
  }
  catch {
    throw new OfflineStoreCorruptionError();
  }

  return record as OfflineStoreRecord;
};
