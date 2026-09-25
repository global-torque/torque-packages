export type RedemptionBusinessStatus =
  | 'pending'
  | 'approved'
  | 'denied'
  | 'cancelled'
  | 'completed';

export type RedemptionVaultStatus =
  | 'request_available'
  | 'request_blocked'
  | 'request_in_progress'
  | 'need_funds'
  | 'fulfillment_available'
  | 'fulfillment_in_progress'
  | 'claim_available'
  | 'claim_in_progress'
  | 'completed'
  | 'failed'
  | 'unavailable';

export type RedemptionVaultStatusReason =
  | 'request_preflight_passed'
  | 'request_awaiting_signature'
  | 'request_submitted'
  | 'request_projection_pending'
  | 'offer_not_eligible'
  | 'fund_structure_not_supported'
  | 'pricing_incomplete'
  | 'pricing_actor_missing'
  | 'requested_amount_invalid'
  | 'request_origin_not_application'
  | 'request_already_locked'
  | 'request_already_projected'
  | 'vault_not_ready'
  | 'controller_not_ready'
  | 'request_operation_fenced'
  | 'insufficient_vault_liquidity'
  | 'vault_liquidity_available'
  | 'fulfillment_awaiting_signature'
  | 'fulfillment_submitted'
  | 'fulfillment_projection_pending'
  | 'claimable_balance_available'
  | 'claim_awaiting_signature'
  | 'claim_submitted'
  | 'claim_projection_pending'
  | 'canonical_claim_completed'
  | 'request_operation_failed'
  | 'fulfillment_operation_failed'
  | 'claim_operation_failed'
  | 'inconsistent_lifecycle_projection'
  | 'fulfillment_not_available'
  | 'claim_operation_fenced'
  | 'finalized_block_unavailable'
  | 'vault_liquidity_unavailable';
export type RedemptionOperationStatus = 'created' | 'submitted' | 'confirmed' | 'failed';
export type RedemptionOperationScope = 'direct' | 'controller_cohort';

export interface RedemptionLifecycleFinality {
  block_number: number;
  block_hash: string;
  confirmation_count: number;
  confirmation_target: number;
  finalized: boolean;
}

export interface RedemptionLifecycleOperation {
  id: number;
  status: RedemptionOperationStatus;
  failure_reason: string;
  transaction_hash: string;
  scope: RedemptionOperationScope;
  finality: RedemptionLifecycleFinality;
}

export interface RedemptionLifecycleTokenDisplay {
  address: string;
  symbol: string;
  decimals: number;
}

export interface RedemptionLifecycleDisplay {
  offer: { name: string };
  asset: RedemptionLifecycleTokenDisplay | null;
  share: RedemptionLifecycleTokenDisplay | null;
}

export interface RedemptionLifecycleItem {
  redemption_id: number;
  offer_id: number;
  vault_contract_id: number;
  business_status: RedemptionBusinessStatus;
  protocol_state: 'unconfirmed' | 'pending' | 'claimable' | 'claimed';
  vault_status: RedemptionVaultStatus | null;
  vault_status_reason: RedemptionVaultStatusReason | null;
  requested_assets_raw: string;
  requested_shares_raw: string;
  pending_assets_raw: string;
  pending_shares_raw: string;
  claimable_assets_raw: string;
  claimable_shares_raw: string;
  claimed_assets_raw: string;
  claimed_shares_raw: string;
  requested_at: string | null;
  claimable_at: string | null;
  claimed_at: string | null;
  created_at: string;
  updated_at: string;
  display: RedemptionLifecycleDisplay;
  request_operation: RedemptionLifecycleOperation | null;
  fulfillment_operation: RedemptionLifecycleOperation | null;
  claim_operation: RedemptionLifecycleOperation | null;
}

export interface RedemptionLifecycleResponse {
  profile_id: number;
  items: RedemptionLifecycleItem[];
}
