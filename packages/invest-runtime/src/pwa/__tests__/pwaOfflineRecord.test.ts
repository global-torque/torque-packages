import { describe, expect, it } from 'vitest';
import type { ResolvedOfflineDomainPolicy } from '../pwaPolicy.ts';
import {
  createOfflineStoreKey,
  isOfflineStoreRecordExpired,
  OfflineStoreCorruptionError,
  validateOfflineStoreRecord,
} from '../pwaOfflineRecord.ts';

const policy = {
  key: 'wallet',
  scope: 'private',
  persistToIndexedDb: true,
} as ResolvedOfflineDomainPolicy;
const requestUrl = 'https://api.example.test/auth/wallet';
const key = `wallet:${encodeURIComponent('session-one:profile-7')}:${requestUrl}`;
const validRecord = {
  key,
  url: requestUrl,
  domainKey: 'wallet',
  scope: 'private',
  partition: 'session-one:profile-7',
  status: 200,
  updatedAt: '2026-07-19T00:00:00.000Z',
  expiresAt: '2026-07-19T12:00:00.000Z',
  headers: [['content-type', 'application/json']],
  payloadType: 'json',
  payload: { balance: 10 },
};

describe('offline response record validation', () => {
  it('accepts a record bound to the expected policy, URL, and payload shape', () => {
    expect(validateOfflineStoreRecord(
      validRecord,
      policy,
      requestUrl,
      key,
      'session-one:profile-7',
    )).toEqual(validRecord);
  });

  it.each([
    ['missing headers', { ...validRecord, headers: undefined }],
    ['invalid status', { ...validRecord, status: 500 }],
    ['invalid update time', { ...validRecord, updatedAt: 'not-a-date' }],
    ['wrong private scope', { ...validRecord, scope: 'public' }],
    ['wrong session partition', { ...validRecord, partition: 'session-two:profile-7' }],
    ['missing expiry', { ...validRecord, expiresAt: undefined }],
    ['wrong request URL', { ...validRecord, url: 'https://api.example.test/auth/other' }],
    ['invalid payload type', { ...validRecord, payloadType: 'stream' }],
    ['invalid typed payload', { ...validRecord, payloadType: 'text', payload: { balance: 10 } }],
  ])('rejects %s as a corrupted cache entry', (_label, record) => {
    expect(() => validateOfflineStoreRecord(
      record,
      policy,
      requestUrl,
      key,
      'session-one:profile-7',
    ))
      .toThrow(OfflineStoreCorruptionError);
  });

  it('isolates identical private URLs by session/profile partition', () => {
    const first = createOfflineStoreKey(policy, requestUrl, 'session-one:profile-7');
    const second = createOfflineStoreKey(policy, requestUrl, 'session-two:profile-7');
    expect(first).not.toBe(second);
  });

  it('expires records at the policy retention boundary', () => {
    expect(isOfflineStoreRecordExpired(validRecord, Date.parse('2026-07-19T11:59:59.999Z')))
      .toBe(false);
    expect(isOfflineStoreRecordExpired(validRecord, Date.parse(validRecord.expiresAt))).toBe(true);
  });

  it('caps a forged or old-policy expiry at the current policy max age', () => {
    const forgedRecord = {
      ...validRecord,
      expiresAt: '2036-07-19T12:00:00.000Z',
    };
    expect(isOfflineStoreRecordExpired(
      forgedRecord,
      Date.parse('2026-07-19T01:00:00.000Z'),
      30 * 60,
    )).toBe(true);
  });
});
