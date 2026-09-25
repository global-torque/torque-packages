import type {
  RedemptionBusinessStatus,
  RedemptionLifecycleItem,
  RedemptionLifecycleResponse,
  RedemptionVaultStatus,
} from '@global-torque/domain-types/redemptionLifecycleTypes';
import { createInvestDataApiClient } from './service/dataClientConfig.ts';

export type RedemptionLifecycleSource = 'network' | 'offline-cache';

export interface RedemptionLifecycleResult {
  profileId: number;
  items: RedemptionLifecycleItem[];
  source: RedemptionLifecycleSource;
  lastSyncedAt: string | null;
}

const object = (value: unknown, label: string): Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
};

const stringValue = (value: unknown, label: string): string => {
  if (typeof value !== 'string') throw new TypeError(`${label} must be a string.`);
  return value;
};

const nonnegativeRaw = (value: unknown, label: string): string => {
  const raw = stringValue(value, label);
  if (!/^(?:0|[1-9][0-9]*)$/.test(raw)) throw new TypeError(`${label} must be a non-negative raw integer.`);
  return raw;
};

const positiveInteger = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(`${label} must be a positive integer.`);
  }
  return value;
};

const nonnegativeInteger = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative integer.`);
  }
  return value;
};

const oneOf = <T extends string>(value: unknown, values: readonly T[], label: string): T => {
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new TypeError(`${label} has an invalid value.`);
  }
  return value as T;
};

const nullableString = (value: unknown, label: string): string | null => (
  value === null ? null : stringValue(value, label)
);

const parseItem = (value: unknown, index: number): RedemptionLifecycleItem => {
  const label = `items[${index}]`;
  const row = object(value, label);
  const requiredRaw = [
    'requested_assets_raw', 'requested_shares_raw', 'pending_assets_raw',
    'pending_shares_raw', 'claimable_assets_raw', 'claimable_shares_raw',
    'claimed_assets_raw', 'claimed_shares_raw',
  ] as const;
  const raw = Object.fromEntries(requiredRaw.map((key) => [key, nonnegativeRaw(row[key], `${label}.${key}`)]));
  return {
    redemption_id: positiveInteger(row.redemption_id, `${label}.redemption_id`),
    offer_id: positiveInteger(row.offer_id, `${label}.offer_id`),
    vault_contract_id: nonnegativeInteger(row.vault_contract_id, `${label}.vault_contract_id`),
    business_status: oneOf(row.business_status, ['pending', 'approved', 'denied', 'cancelled', 'completed'] as const, `${label}.business_status`) as RedemptionBusinessStatus,
    protocol_state: oneOf(row.protocol_state, ['unconfirmed', 'pending', 'claimable', 'claimed'] as const, `${label}.protocol_state`),
    vault_status: row.vault_status === null ? null : oneOf(row.vault_status, ['request_available', 'request_blocked', 'request_in_progress', 'need_funds', 'fulfillment_available', 'fulfillment_in_progress', 'claim_available', 'claim_in_progress', 'completed', 'failed', 'unavailable'] as const, `${label}.vault_status`) as RedemptionVaultStatus,
    vault_status_reason: row.vault_status_reason === null
      ? null
      : oneOf(row.vault_status_reason, [
        'request_preflight_passed',
        'request_awaiting_signature',
        'request_submitted',
        'request_projection_pending',
        'offer_not_eligible',
        'fund_structure_not_supported',
        'pricing_incomplete',
        'pricing_actor_missing',
        'requested_amount_invalid',
        'request_origin_not_application',
        'request_already_locked',
        'request_already_projected',
        'vault_not_ready',
        'controller_not_ready',
        'request_operation_fenced',
        'insufficient_vault_liquidity',
        'vault_liquidity_available',
        'fulfillment_awaiting_signature',
        'fulfillment_submitted',
        'fulfillment_projection_pending',
        'claimable_balance_available',
        'claim_awaiting_signature',
        'claim_submitted',
        'claim_projection_pending',
        'canonical_claim_completed',
        'request_operation_failed',
        'fulfillment_operation_failed',
        'claim_operation_failed',
        'inconsistent_lifecycle_projection',
        'fulfillment_not_available',
        'claim_operation_fenced',
        'finalized_block_unavailable',
        'vault_liquidity_unavailable',
      ] as const, `${label}.vault_status_reason`) as RedemptionLifecycleItem['vault_status_reason'],
    ...raw as Pick<RedemptionLifecycleItem, typeof requiredRaw[number]>,
    requested_at: nullableString(row.requested_at, `${label}.requested_at`),
    claimable_at: nullableString(row.claimable_at, `${label}.claimable_at`),
    claimed_at: nullableString(row.claimed_at, `${label}.claimed_at`),
    created_at: stringValue(row.created_at, `${label}.created_at`),
    updated_at: stringValue(row.updated_at, `${label}.updated_at`),
  };
};

export const validateRedemptionLifecycleResponse = (value: unknown): RedemptionLifecycleResponse => {
  const row = object(value, 'redemption lifecycle response');
  if (!Array.isArray(row.items)) throw new TypeError('redemption lifecycle response.items must be an array.');
  return { profile_id: positiveInteger(row.profile_id, 'profile_id'), items: row.items.map(parseItem) };
};

export interface RedemptionLifecycleClient {
  listRedemptionLifecycles: (profileId: number, options?: { signal?: AbortSignal; allowOfflineFallback?: boolean }) => Promise<RedemptionLifecycleResult>;
}

export const createRedemptionLifecycleClient = (evm = createInvestDataApiClient('evm')): RedemptionLifecycleClient => ({
  async listRedemptionLifecycles(profileId, options = {}) {
    if (!Number.isSafeInteger(profileId) || profileId < 1) throw new TypeError('profileId must be a positive integer.');
    const response = await evm.get('/auth/redemptions', {
      params: { profile_id: profileId },
      signal: options.signal,
      offlineFallback: options.allowOfflineFallback ?? true,
    });
    const data = validateRedemptionLifecycleResponse(response.data);
    if (data.profile_id !== profileId) throw new TypeError('redemption lifecycle response profile does not match request.');
    const sourceHeader = response.headers.get('x-invest-offline-source');
    if (sourceHeader !== 'network' && sourceHeader !== 'offline-cache') {
      throw new TypeError('redemption lifecycle response source is invalid.');
    }
    const source = sourceHeader as RedemptionLifecycleSource;
    const lastSyncedAt = response.headers.get('x-invest-offline-last-synced-at');
    if (lastSyncedAt !== null && !lastSyncedAt.trim()) {
      if (source === 'offline-cache') throw new TypeError('offline redemption lifecycle response is missing cache metadata.');
      throw new TypeError('redemption lifecycle last sync is invalid.');
    }
    if (source === 'offline-cache' && (lastSyncedAt === null || !lastSyncedAt.trim())) {
      throw new TypeError('offline redemption lifecycle response is missing cache metadata.');
    }
    return { profileId, items: data.items, source, lastSyncedAt };
  },
});
