export const VaultProtocolStates = {
  unconfirmed: 'unconfirmed',
  pending: 'pending',
  claimable: 'claimable',
  claimed: 'claimed',
} as const;

export type VaultProtocolState =
  typeof VaultProtocolStates[keyof typeof VaultProtocolStates];

export const VaultOperationStatuses = {
  created: 'created',
  submitted: 'submitted',
  confirmed: 'confirmed',
  failed: 'failed',
} as const;

export type VaultOperationStatus =
  typeof VaultOperationStatuses[keyof typeof VaultOperationStatuses];

export type VaultOperationStage =
  | 'awaiting_signature'
  | 'signing_or_submitting'
  | 'detected_provisional'
  | 'expired'
  | 'rejected'
  | 'abandoned'
  | VaultOperationStatus;

export interface VaultOperationFinality {
  block_number: number | string;
  block_hash: string;
  confirmation_count: number;
  confirmation_target: number;
  finalized: boolean;
}

export interface VaultLifecycleOperation {
  id: number;
  status: VaultOperationStatus;
  stage?: VaultOperationStage;
  failure_reason?: string;
  amount_raw?: string;
  tx_hash?: string;
  transaction_to_address?: string;
  call_target_address?: string;
  selector?: string;
  can_abandon?: boolean;
  finality?: VaultOperationFinality;
}

export interface VaultSigningPayload {
  reused: boolean;
  operation_id: number;
  stage: VaultOperationStage;
  chain: string;
  from_address: string;
  transaction_to_address: string;
  transaction_call_data: string;
  call_target_address: string;
  contract_function_selector: string;
  call_data: string;
  logical_call_data: string;
  amount_raw: string;
  confirmation_target: number;
}

export interface VaultAssetIdentity {
  symbol: string;
  address: string;
  decimals: number;
}

export interface VaultDeployment {
  contract_id: number;
  status: string;
  chain: string;
  address: string;
  asset: VaultAssetIdentity;
  share: VaultAssetIdentity;
}

export interface VaultRedemptionEstimate {
  nav_record_id: number;
  nav_version: number;
  nav_usdc_raw: string;
  valuation_block_number: string;
  valuation_as_of: string;
  asset_amount_raw: string;
}

export interface VaultRedemptionFinal {
  asset_amount_raw: string;
  pricing_source?: string | null;
  dealing_price_usdc_raw?: string | null;
  priced_by_user_id?: number | null;
  priced_request_effect_id?: number | null;
  priced_at?: string | null;
  nav_record_id?: number | null;
  nav_version?: number | null;
  nav_usdc_raw?: string | null;
  valuation_block_number?: string | null;
  valuation_as_of?: string | null;
  delta_from_estimate_raw: string | null;
}

export type VaultClaimDirection = 'deposit' | 'redemption';
export interface VaultRedemption {
  id: number;
  offer_id?: number;
  profile_id?: number;
  investment_id?: number | null;
  vault_contract_id?: number;
  request_origin: 'application' | 'chain';
  request_effect_id: number | null;
  request_effect_state?: 'assigned' | 'unassigned';
  status?: string;
  pricing_status: 'awaiting_dealing_nav' | 'priced';
  protocol_state: VaultProtocolState;
  share_amount_raw: string;
  pending_shares_raw: string;
  claimable_shares_raw: string;
  claimable_assets_raw: string;
  claimed_shares_raw: string;
  claimed_assets_raw: string;
  liquidity_shortfall_raw?: string;
  request_locked_at?: string | null;
  estimate: VaultRedemptionEstimate | null;
  dealing_cutoff: {
    block_number: string;
    at: string;
  } | null;
  final: VaultRedemptionFinal | null;
  operations: {
    request: VaultLifecycleOperation | null;
    fulfillment: VaultLifecycleOperation | null;
    claim: VaultLifecycleOperation | null;
  };
}

export interface VaultPosition {
  offer_id: number;
  profile_id: number;
  vault: {
    deployment: VaultDeployment;
    deposit: {
      investment_id: number;
      protocol_state: VaultProtocolState;
      request_origin: 'application' | 'chain';
      request_effect_id: number | null;
      request_effect_state?: 'assigned' | 'unassigned';
      request_controller: {
        chain_account_id: number;
        address: string;
      };
      price_source: string | null;
      price_usdc_raw: string;
      nav_record_id: number | null;
      nav_version: number | null;
      priced_at: string | null;
      custody: {
        state: 'unfunded' | 'funding' | 'funded' | 'held' | 'refunding' | 'refund_locked' | 'released' | 'refunded';
        wallet_address: string | null;
        funded_at: string | null;
        refund_locked_at: string | null;
        released_at: string | null;
        refunded_at: string | null;
      };
      request_locked_at: string | null;
      asset_amount_raw: string;
      share_amount_raw: string;
      pending_assets_raw: string;
      claimable_assets_raw: string;
      claimable_shares_raw: string;
      claimed_assets_raw: string;
      claimed_shares_raw: string;
      controller_aggregate?: {
        pending_assets_raw: string;
        claimable_assets_raw: string;
        unassigned_pending_assets_raw: string;
        unassigned_claimable_assets_raw: string;
      };
      operations: Record<string, VaultLifecycleOperation | null>;
    } | null;
    position: {
      share_balance_raw: string;
      historical_claimed_shares_raw: string;
      available_to_redeem_shares_raw: string;
    };
    redemptions: VaultRedemption[];
  };
}

export interface CreateVaultRedemptionRequest {
  offer_id: number;
  shares_raw: string;
}

export interface ArmVaultOperationRequest {
  operation_id: number;
}

export interface VaultLifecycleStatus {
  business_id?: number;
  action: string;
  vault_contract_id?: number;
  profile_id?: number;
  direction?: 'deposit' | 'redemption';
  vault_request_origin?: string;
  can_fund?: boolean;
  can_request?: boolean;
  funding_blocking_reason?: string | null;
  protocol_state?: VaultProtocolState;
  asset_amount_raw?: string;
  share_amount_raw?: string;
  pending_assets_raw?: string;
  pending_shares_raw?: string;
  claimable_assets_raw?: string;
  claimable_shares_raw?: string;
  custody_address?: string;
  custody_funded_at?: string | null;
  custody_refund_locked_at?: string | null;
  custody_released_at?: string | null;
  custody_refunded_at?: string | null;
  request_locked_at?: string | null;
  requested_at?: string | null;
  request_effect_id?: number | null;
  operation: VaultLifecycleOperation | null;
  reconciliation?: {
    vault_contract_id: number;
    chain: string;
    vault_address: string;
    request_controller_address: string;
    direction: 'deposit' | 'redemption';
    observed_block: number;
    observed_block_hash: string;
    share_balance_raw: string;
    pending_raw: string;
    claimable_raw: string;
    assigned_pending_raw: string;
    assigned_claimable_raw: string;
    unassigned_pending_raw: string;
    unassigned_claimable_raw: string;
    unassigned_effect_ids: number[];
  };
}

export interface VaultCustodyFundingRequest {
  idempotency_key: string;
}
