export const EvmWalletStatusTypes = {
  created: 'created',
  verified: 'verified',
  error: 'error',
  error_retry: 'error_retry',
  error_document: 'error_document',
  error_pending: 'error_pending',
  error_suspended: 'error_suspended',
} as const;

export type EvmWalletStatusTypes = typeof EvmWalletStatusTypes[keyof typeof EvmWalletStatusTypes];

export const EvmTransactionStatusTypes = {
  created: 'created',
  submitted: 'submitted',
  confirmed: 'confirmed',
  processed: 'processed',
  pending: 'pending',
  failed: 'failed',
  cancelled: 'cancelled',
  wait: 'wait',
} as const;

export type EvmTransactionStatusTypes =
  typeof EvmTransactionStatusTypes[keyof typeof EvmTransactionStatusTypes];

export const EvmTransactionTypes = {
  withdrawal: 'withdrawal',
  deposit: 'deposit',
  investment: 'investment',
  contract_call: 'contract_call',
  exchange: 'exchange',
} as const;

export type EvmTransactionTypes = typeof EvmTransactionTypes[keyof typeof EvmTransactionTypes];

export const EvmWalletTransactionRowKinds = {
  effect: 'effect',
  pending_parent: 'pending_parent',
  finalized_parent: 'finalized_parent',
} as const;

export type EvmWalletTransactionRowKind =
  typeof EvmWalletTransactionRowKinds[keyof typeof EvmWalletTransactionRowKinds];

export const EvmWalletEffectKinds = {
  native: 'native',
  erc20_transfer: 'erc20_transfer',
  contract_event: 'contract_event',
} as const;

export type EvmWalletEffectKind =
  typeof EvmWalletEffectKinds[keyof typeof EvmWalletEffectKinds];

export type EvmViewedWalletDirection = 'deposit' | 'withdrawal';

export type EvmWalletLogicalAction =
  | 'approve'
  | 'transfer'
  | 'request_deposit'
  | 'request_redeem'
  | 'fulfill_deposit'
  | 'fulfill_redeem'
  | 'claim_deposit'
  | 'claim_redeem'
  | 'drawdown_strategy_assets'
  | 'return_strategy_assets'
  | 'report_strategy_assets';

export type IEvmWalletBalancesMap = Record<string, {
  id?: number | string;
  offer_id?: number;
  address: string;
  amount: number | string;
  balance?: number | string;
  symbol: string;
  asset?: string;
  name?: string;
  icon?: string;
  price_per_usd?: number | string;
  price_per_usd_raw?: string;
  amount_usd?: number | string;
  chain?: string;
  token_decimals?: number;
  token_standard?: string;
  is_native?: boolean;
  balance_type?: 'rwa_asset' | 'tradable_crypto';
  exchange_eligible?: boolean;
  exchange_ineligible_reason?: string;
}>;

export type IEvmWalletBalancesInput = IEvmWalletBalancesMap | IEvmWalletBalances[];

export type IEvmWalletDataForFormatter = Omit<IEvmWalletDataResponse, 'balances'> & {
  balances?: IEvmWalletBalancesInput;
};

export interface IEvmWalletBalances {
  id?: number;
  asset?: string;
  address: string;
  amount: number;
  symbol: string;
  name?: string;
  icon?: string;
  price_per_usd?: number | string;
  price_per_usd_raw?: string;
  amount_usd?: number;
  chain?: string;
  token_decimals?: number;
  token_standard?: string;
  is_native?: boolean;
  balance_type?: 'rwa_asset' | 'tradable_crypto';
  exchange_eligible?: boolean;
  exchange_ineligible_reason?: string;
  offer_id?: number;
  vault_contract_id?: number;
  tokenValue?: string;
}

export interface IEvmWalletChainAccount {
  chain: string;
  wallet_address: string;
  chain_account_status?: string;
  exchange_payout_token_address?: string;
  exchange_payout_token_symbol?: string;
}

export interface IEvmWalletDepositInstructions {
  chain?: string;
  address?: string;
}

export interface IEvmWalletBalanceSummaryResponse {
  amount_usd?: number | string;
  token_count?: number | string;
}

export interface IEvmWalletDataResponse {
  id: number;
  status: EvmWalletStatusTypes;
  provider_name?: string;
  turnkey_org_id?: string;
  turnkey_sub_org_id?: string;
  turnkey_user_id?: string;
  turnkey_wallet_id?: string;
  turnkey_account_id?: string;
  balance: string;
  inc_balance: number;
  out_balance: number;
  address: string;
  chain?: string;
  exchange_payout_token_address?: string;
  exchange_payout_token_symbol?: string;
  deposit_instructions?: IEvmWalletDepositInstructions;
  chains?: IEvmWalletChainAccount[];
  balances: IEvmWalletBalancesMap;
  tradable_crypto_balance?: IEvmWalletBalanceSummaryResponse;
  rwa_asset_balance?: IEvmWalletBalanceSummaryResponse;
  transactions: IEvmTransactionDataResponse[];
  created_at: string;
  updated_at: string;
}

export interface IEvmWalletDataFormatted extends Omit<IEvmWalletDataResponse, 'balances'> {
  balances: IEvmWalletBalances[];
  isStatusCreated: boolean;
  isStatusVerified: boolean;
  isStatusError: boolean;
  isStatusErrorRetry: boolean;
  isStatusErrorDocument: boolean;
  isStatusErrorPending: boolean;
  isStatusErrorSuspended: boolean;
  isStatusAnyError: boolean;
  currentBalance: number;
  totalBalance: number;
  fundingBalance: number;
  rwaValue: number;
  pendingIncomingBalance: number;
  pendingOutcomingBalance: number;
  cryptoChangeFormatted?: string;
  rwaChangeFormatted?: string;
  formattedTransactions: IEvmTransactionDataFormatted[];
}

export interface IEvmWalletAmount {
  value: string;
  currency: string;
}

export interface IEvmTransactionDataResponse {
  id: number;
  effect_id?: string;
  effect_kind?: EvmWalletEffectKind;
  effect_index?: number;
  row_kind?: EvmWalletTransactionRowKind;
  user_id: number;
  dest_wallet_id: number | null;
  source_wallet_id: number | null;
  investment_id: number | null;
  investment_redemption_id?: number | null;
  type: EvmTransactionTypes;
  amount_raw?: string;
  amount: string;
  ticker?: string;
  symbol?: string;
  name?: string;
  icon?: string;
  image_link_id?: number | string;
  network: string;
  status: EvmTransactionStatusTypes;
  submission_status?: string;
  source?: string;
  transaction_tx: string;
  scan_tx_url?: string;
  created_at: string;
  updated_at: string;
  address?: string;
  destination_address?: string;
  direction?: EvmViewedWalletDirection | null;
  contract_function_selector?: string;
  logical_action?: EvmWalletLogicalAction;
  token_address?: string;
  token_decimals?: number;
  block_number?: number;
  block_timestamp?: string;
  confirmation_count?: number;
  confirmation_target?: number;
  failure_code?: string;
  type_display?: string;
  description?: string;
}

export interface IEvmWalletTransactionsApiItem {
  id?: number | string;
  operation_id?: number | string | null;
  effect_id?: number | string | null;
  effect_kind?: string | null;
  effect_index?: number | string | null;
  row_kind?: string | null;
  user_id?: number | string | null;
  dest_wallet_id?: number | string | null;
  source_wallet_id?: number | string | null;
  investment_id?: number | string | null;
  investment_redemption_id?: number | string | null;
  type?: string | null;
  operation_type?: string | null;
  amount_raw?: string | null;
  amount?: number | string | null;
  ticker?: string | null;
  symbol?: string | null;
  token_ticker?: string | null;
  token_symbol?: string | null;
  token_name?: string | null;
  token_logo?: string | null;
  token_address?: string | null;
  name?: string | null;
  icon?: string | null;
  image_link_id?: number | string | null;
  network?: string | null;
  chain?: string | null;
  status?: string | null;
  operation_status?: string | null;
  submission_status?: string | null;
  source?: string | null;
  transaction_tx?: string | null;
  tx_hash?: string | null;
  hash?: string | null;
  scan_tx_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  address?: string | null;
  wallet_address?: string | null;
  counterparty_address?: string | null;
  direction?: string | null;
  contract_function_selector?: string | null;
  logical_action?: string | null;
  token_decimals?: number | string | null;
  block_number?: number | string | null;
  block_timestamp?: string | null;
  confirmation_count?: number | string | null;
  confirmation_target?: number | string | null;
  failure_code?: string | null;
  type_display?: string | null;
  description?: string | null;
}

export type IEvmWalletTransactionsApiResponse =
  | IEvmWalletTransactionsApiItem[]
  | {
      items?: IEvmWalletTransactionsApiItem[] | null;
      transactions?: IEvmWalletTransactionsApiItem[] | null;
      data?: IEvmWalletTransactionsApiItem[] | null;
    };

export interface IEvmTransactionDataFormatted extends IEvmTransactionDataResponse {
  isStatusCreated: boolean;
  isStatusSubmitted: boolean;
  isStatusConfirmed: boolean;
  isStatusPending: boolean;
  isStatusProcessed: boolean;
  isStatusFailed: boolean;
  isStatusCancelled: boolean;
  isStatusWait: boolean;
  submitted_at_date: string;
  submitted_at_time: string;
  updated_at_date: string;
  updated_at_time: string;
  statusColor?: string;
  statusText?: string;
  isTypeWithdrawal: boolean;
  isTypeDeposit: boolean;
  isTypeInvestment: boolean;
  isTypeContractCall: boolean;
  isTypeExchange: boolean;
  typeFormatted: string;
  amountFormatted: string;
  networkFormatted: string;
  tagColor?: string;
  txShort: string;
  typeDisplay: string;
  description: string;
  scanTxUrl: string;
}

export interface IEvmWithdrawRequestBody {
  investment_id?: number;
  chain: string;
  asset_address: string;
  amount: string;
  destination_address: string;
  idempotency_key: string;
  authorization_session_id?: string;
}

export type IEvmWalletAuthorizationOperationType = 'withdrawal' | 'exchange' | 'delegation';

export type IEvmWalletAuthorizationOptionId =
  | 'withdrawal_transfer'
  | 'exchange_transfer'
  | 'delegation_contract_functions'
  | 'delegation_root';

export interface IEvmWalletAuthorizeWithdrawalStartRequestBody {
  authorization_option_id: 'withdrawal_transfer';
  operation_type: 'withdrawal';
  chain: string;
  asset_address: string;
  destination_address: string;
  max_amount: string;
  nonce: string;
}

export interface IEvmWalletAuthorizeExchangeStartRequestBody {
  authorization_option_id: 'exchange_transfer';
  operation_type: 'exchange';
  chain: string;
  asset_address: string;
  to_asset_address: string;
  max_amount: string;
  quote_price_usd: string;
  minimum_payout_amount: string;
  nonce: string;
}

export interface IEvmWalletAuthorizeDelegationStartRequestBody {
  authorization_option_id: 'delegation_contract_functions' | 'delegation_root';
  operation_type: 'delegation';
  chain: string;
  delegation_type: 'contract_functions' | 'root';
  delegation_params: Record<string, unknown>;
  nonce: string;
}

export type IEvmWalletAuthorizeStartRequestBody =
  | IEvmWalletAuthorizeWithdrawalStartRequestBody
  | IEvmWalletAuthorizeExchangeStartRequestBody
  | IEvmWalletAuthorizeDelegationStartRequestBody;

export interface IEvmWalletAuthorizeSignatureRequest {
  type: string;
  data: unknown;
}

export interface IEvmWalletAuthorizeTurnkeySmartContractInterface {
  address: string;
  interface: string;
  type: string;
  label: string;
  notes?: string;
}

export interface IEvmWalletAuthorizeStartResponse {
  profile_id: number;
  authorization_option_id?: string;
  operation_type?: IEvmWalletAuthorizationOperationType;
  provider_name?: string;
  wallet_address: string;
  turnkey_org_id?: string;
  turnkey_sub_org_id?: string;
  turnkey_user_id?: string;
  turnkey_wallet_id?: string;
  turnkey_account_id?: string;
  turnkey_delegated_user_id?: string;
  turnkey_policy_name?: string;
  turnkey_policy_id?: string;
  turnkey_policy_effect?: string;
  turnkey_policy_condition?: string;
  turnkey_policy_consensus?: string;
  turnkey_policy_notes?: string;
  turnkey_smart_contract_interfaces?: IEvmWalletAuthorizeTurnkeySmartContractInterface[];
  session_id: string;
  chain: string;
  token_symbol?: string;
  token_address?: string;
  asset?: string;
  asset_address?: string;
  to_asset?: string;
  to_asset_address?: string;
  destination_address?: string;
  delegation_type?: string;
  delegation_params?: Record<string, unknown>;
  max_amount?: string;
  remaining_amount?: string;
  quote_id?: string;
  quote_price_usd?: string;
  minimum_payout_amount?: string;
  issued_at: string;
  expires_at: string;
  signature_request: IEvmWalletAuthorizeSignatureRequest;
  authorization_status: string;
}

export interface IEvmWalletAuthorizeSession {
  profile_id: number;
  authorization_option_id?: string;
  operation_type?: IEvmWalletAuthorizationOperationType;
  provider_name?: string;
  turnkey_policy_id?: string;
  wallet_address: string;
  turnkey_org_id?: string;
  turnkey_sub_org_id?: string;
  turnkey_user_id?: string;
  turnkey_wallet_id?: string;
  turnkey_account_id?: string;
  session_id: string;
  chain: string;
  token_symbol?: string;
  token_address?: string;
  asset?: string;
  asset_address?: string;
  to_asset?: string;
  to_asset_address?: string;
  destination_address?: string;
  delegation_type?: string;
  delegation_params?: Record<string, unknown>;
  max_amount?: string;
  remaining_amount?: string;
  quote_id?: string;
  quote_price_usd?: string;
  minimum_payout_amount?: string;
  issued_at: string;
  expires_at: string;
  signature_request?: IEvmWalletAuthorizeSignatureRequest;
  authorization_status: string;
}

export type IEvmWalletAuthorizeSessionsResponse =
  | IEvmWalletAuthorizeSession[]
  | {
      items?: IEvmWalletAuthorizeSession[] | null;
      sessions?: IEvmWalletAuthorizeSession[] | null;
      data?: IEvmWalletAuthorizeSession[] | null;
    };

export interface IEvmWalletAuthorizeConfirmRequestBody {
  session_id: string;
  owner_signature: string;
  turnkey_policy_id?: string;
  turnkey_policy_name?: string;
  turnkey_policy_activity_id?: string;
}

export interface IEvmWalletAuthorizeConfirmResponse {
  profile_id: number;
  session_id: string;
  authorization_status: string;
  turnkey_sub_org_id?: string;
  turnkey_policy_id?: string;
  quote_id?: string;
  quote_price_usd?: string;
  minimum_payout_amount?: string;
}

export interface IEvmWithdrawResponse {
  id: number;
  status: string;
  tx_hash?: string;
  external_id?: string;
}

export interface IEvmExchangeRequestBody {
  wallet_id: number;
  amount: string;
  from: string;
  to: string;
  idempotency_key: string;
  authorization_session_id: string;
  quote_id: string;
  quote_price_usd: string;
  minimum_payout_amount: string;
}

export interface IEvmExchangeResponse {
  id: number;
  transaction_id: string;
}

export interface IEvmEarnPositionOverlay {
  profileId: string | number;
  symbol?: string;
  name?: string;
  stakedAmountUsd?: number;
  transactions?: Array<{ id: number; type: string; amountUsd: number; status: string; txId: string }>;
}
