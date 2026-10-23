import type { AccreditationTypes } from './accreditationTypes.ts';
import type { InvestKycTypes } from './kycTypes.ts';
import type { IProfileIndividual } from './profilesTypes.ts';
import type {
  EvmExpectedActionStatus,
  EvmReceiptExecutionStatus,
} from './evmTypes.ts';

export interface INotificationToken {
  address: string;
  id: number;
  name: string;
  offer_id: number;
  symbol?: string;
  decimals?: number;
  standard?: string;
  chain?: string;
  balance_type?: 'rwa_asset' | 'tradable_crypto';
}

export interface INotificationDataFields {
  kyc_status?: InvestKycTypes;
  accreditation_status?: AccreditationTypes;
  funding_status?: string;
  status?: string;
  object_id?: number | string;
  source_file_id?: number | string;
  address?: string;
  amount?: string | null;
  balance?: number;
  inc_balance?: number;
  out_balance?: number;
  profile?: IProfileIndividual;
  confirmed_shares?: string;
  subscribed_shares?: string;
  type: string;
  transaction_tx?: string | null;
  submission_status?: string | null;
  created_at?: string;
  updated_at?: string;
  investment_id?: number | null;
  offer_id?: number | null;
  network?: string;
  chain?: string;
  balance_type?: 'rwa_asset' | 'tradable_crypto';
  token?: INotificationToken;
  operation_effects?: {
    effect_id?: number | string;
    chain_account_id?: number | string;
    effect_kind?: string;
    effect_index?: number | string;
  } | null;
  profile_id?: number | null;
  block_number?: number | null;
  block_timestamp?: string | null;
  block_hash?: string | null;
  receipt_block_hash?: string | null;
  confirmation_count?: number | null;
  confirmation_target?: number | null;
  reorg_count?: number | null;
  last_seen_block?: number | null;
  removed_at?: string | null;
  failure_code?: string | null;
  token_address?: string | null;
  token_symbol?: string | null;
  token_ticker?: string | null;
  token_name?: string | null;
  token_decimals?: number | null;
  amount_raw?: string | null;
  destination_address?: string | null;
  receipt_execution_status?: EvmReceiptExecutionStatus | null;
  expected_action_status?: EvmExpectedActionStatus | null;
  expected_action_failure_code?: string | null;
  signature_data?: {
    signature_id?: number | string;
    entity_id?: string;
    provider?: string;
    created_at?: string;
    updated_at?: string;
    [key: string]: unknown;
  };
}

interface INotificationData {
  obj: string;
  object_id: number;
  fields: INotificationDataFields;
}

export interface INotification {
  id: number;
  user_id: number;
  content: string;
  data: INotificationData;
  status: string;
  type: string;
  created_at: string;
  updated_at: string;
}

export interface IFormattedNotification extends INotification {
  isNotificationInvestment: boolean;
  isNotificationDocument: boolean;
  isNotificationSystem: boolean;
  isNotificationWallet: boolean;
  isNotificationProfile: boolean;
  isNotificationUser: boolean;
  objectId: number;
  profileId: number;
  kycDeclined: boolean;
  accreditationDeclined: boolean;
  accreditationExpired: boolean;
  isStart: boolean;
  isFundsFailed: boolean;
  tagBackground: string;
  buttonText: string;
  tagText: string;
  isUnread: boolean;
  buttonTo: string;
  buttonHref: string;
}
