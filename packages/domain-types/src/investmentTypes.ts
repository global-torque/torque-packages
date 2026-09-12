import type {
  IOffer,
  IOfferFormatted,
} from './offerTypes.ts';
import type { VaultPosition } from './vaultTypes.ts';

export const FundingTypes = {
  ach: 'ach',
  wire: 'wire',
  wallet: 'wallet',
  cryptoWallet: 'crypto_wallet',
} as const;

export type FundingTypes = typeof FundingTypes[keyof typeof FundingTypes];

export const InvestStepTypes = {
  amount: 'amount',
  ownership: 'ownership',
  signature: 'signature',
  funding: 'funding',
  review: 'review',
} as const;

export type InvestStepTypes = typeof InvestStepTypes[keyof typeof InvestStepTypes];

export const InvestmentStatuses = {
  confirmed: 'confirmed',
  legally_confirmed: 'legally_confirmed',
  closed_successfully: 'closed_successfully',
  cancelled_after_investment: 'cancelled_after_investment',
} as const;

export type InvestmentStatuses = typeof InvestmentStatuses[keyof typeof InvestmentStatuses];

export interface IInvestPaymentData {
  account_type: string;
  account_number: string;
  routing_number: string;
  account_holder_name: string;
  created_at?: Date;
  updated_at?: Date;
  transaction_id: string;
}

export interface ISignatureData {
  created_at: string;
  signature_id: string;
  entity_id: string;
  provider: string;
  ip_address: string;
  user_browser: string;
  signed_by_investor: boolean;
}

export const InvestFundingStatuses = {
  none: 'none',
  creation_error: 'creation_error',
  new: 'new',
  initialize: 'initialize',
  in_progress: 'in_progress',
  received: 'received',
  settled: 'settled',
  sent_back_pending: 'sent_back_pending',
  sent_back_settled: 'sent_back_settled',
  failed: 'failed',
  canceled: 'canceled',
  cancelled: 'cancelled',
  error: 'error',
} as const;

export type InvestFundingStatuses = typeof InvestFundingStatuses[keyof typeof InvestFundingStatuses];

export interface IEscrowData {
  pr_name: string;
  transaction_id: string;
  pr_approval_date: string;
  pr_approval_status: string;
}

export interface IInvestment {
  closed_at: Date;
  id: number;
  offer: IOffer;
  profile_id: number;
  user_id: number;
  price_per_share: string;
  number_of_shares: string | null;
  amount: number;
  step: InvestStepTypes;
  status: InvestmentStatuses;
  created_at: Date;
  submited_at: Date;
  funding_type: FundingTypes;
  funding_status: InvestFundingStatuses;
  signature_data: ISignatureData;
  escrow_data: IEscrowData;
  payment_data: IInvestPaymentData;
  payment_type: string;
  escrow_type: string;
  entity_id: string;
  transaction_ref: string;
  notes?: string;
  deposit_price_source?: 'offer_deck' | 'finalized_nav' | 'chain_forward_nav' | null;
  deposit_price_usdc_raw?: string | null;
  deposit_nav_record_id?: number | null;
  deposit_nav_version?: number | null;
  deposit_priced_at?: string | null;
  asset_amount_raw?: string | null;
  share_amount_raw?: string | null;
  vault?: VaultPosition['vault'] | null;
}

export interface IInvestmentFormatted extends IInvestment {
  offer: IOfferFormatted;
  amountFormatted: string;
  amountFormattedZero: string;
  amountWithSign: string;
  numberOfSharesFormatted: string;
  pricePerShareFormatted: string;
  createdAtFormatted: string;
  createdAtTime: string;
  submitedAtFormatted: string;
  submitedAtTime: string;
  paymentDataCreatedAtFormatted: string;
  paymentDataCreatedAtTime: string;
  paymentDataUpdatedAtFormatted: string;
  paymentDataUpdatedAtTime: string;
  fundingStatusFormatted: string;
  fundingTypeFormatted: string;
  isFundingTypeWire: boolean;
  statusFormatted: {
    text: string;
    tooltip?: string;
    color: string;
  };
  isActive: boolean;
  isCompleted: boolean;
  isCancelled: boolean;
  isPending: boolean;
  isFundingClickable: boolean;
}

export interface IInvestmentsData {
  meta: {
    avarange_annual: number;
    total_distributions: number;
    total_investments_12_months: number;
    total_investments: number;
  };
  count: number;
  data: IInvestmentFormatted[];
}

/** Raw API response for confirmed investments list before formatting. */
export interface IInvestmentsDataRaw {
  meta: IInvestmentsData['meta'];
  count: number;
  data: IInvestment[];
}

export interface IInvestUnconfirmed {
  count: number;
  data: (IInvestment | IInvestmentFormatted)[];
}

export interface IInvestConfirm {
  investment: IInvestmentFormatted;
  replayed?: boolean;
}

export interface IInvestFunding {
  funding_type: FundingTypes;
  payment_data?: {
    account_number: string;
    routing_number: string;
    account_holder_name: string;
    account_type: string;
  };
}

export const InvestmentDocumentsTypes = {
  agreement: 'agreement',
  tax_document: 'tax document',
  offer_document: 'offer document',
} as const;

export type InvestmentDocumentsTypes = typeof InvestmentDocumentsTypes[keyof typeof InvestmentDocumentsTypes];

export interface IInvestmentDocuments {
  id: number;
  url: string;
  name: string;
  filename: string;
  mime: string;
  bucket_path: string;
  updated_at: string;
  meta_data: {
    big: string;
    small: string;
    medium: string;
    size: number;
  };
  type: InvestmentDocumentsTypes;
}
