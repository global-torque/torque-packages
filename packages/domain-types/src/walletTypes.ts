export const WalletTransactionStatusTypes = {
  processed: 'processed',
  pending: 'pending',
  failed: 'failed',
  cancelled: 'cancelled',
  wait: 'wait',
} as const;

export type WalletTransactionStatusTypes =
  typeof WalletTransactionStatusTypes[keyof typeof WalletTransactionStatusTypes];

export const WalletAddTransactionTypes = {
  withdrawal: 'withdrawal',
  deposit: 'deposit',
  investment: 'investment',
  distribution: 'distribution',
  fee: 'fee',
  market: 'market',
  sale: 'sale',
  return: 'return',
} as const;

export type WalletAddTransactionTypes =
  typeof WalletAddTransactionTypes[keyof typeof WalletAddTransactionTypes];

export const WalletTypes = {
  created: 'created',
  error: 'error',
  verified: 'verified',
  error_retry: 'error_retry',
  error_document: 'error_document',
  error_pending: 'error_pending',
  error_suspended: 'error_suspended',
} as const;

export type WalletTypes = typeof WalletTypes[keyof typeof WalletTypes];

export interface IFundingSourceDataResponse {
  id: number;
  name: string;
  type: string;
  status: string;
  bank_name: string;
}

export interface IFundingSourceDataFormatted {
  id: number;
  name: string;
  type: string;
  status: string;
  bank_name: string;
  last4?: string;
  isAttachmentMethodManual: boolean;
  isAttachmentMethodAutomatic: boolean;
  isStatusPending: boolean;
}

export interface IWalletDataResponse {
  id: number;
  status: string;
  balance: number;
  pending_incoming_balance: number;
  pending_outcoming_balance: number;
  funding_source: IFundingSourceDataResponse[];
}

export interface IWalletDataFormatted {
  id: number;
  status: string;
  balance: number;
  pending_incoming_balance: number;
  pending_outcoming_balance: number;
  funding_source: IFundingSourceDataFormatted[];
  isSomeLinkedBankAccount: boolean;
  isWalletStatusCreated: boolean;
  isWalletStatusVerified: boolean;
  isWalletStatusError: boolean;
  isWalletStatusErrorRetry: boolean;
  isWalletStatusErrorDocument: boolean;
  isWalletStatusErrorPending: boolean;
  isWalletStatusErrorSuspended: boolean;
  isWalletStatusAnyError: boolean;
  currentBalance: number;
  currentBalanceFormatted?: string;
  pendingIncomingBalance: number;
  pendingIncomingBalanceFormatted?: string;
  pendingOutcomingBalance: number;
  pendingOutcomingBalanceFormatted?: string;
  totalBalance: number;
  totalBalanceFormatted?: string;
  isCurrentBalanceZero: boolean;
  isTotalBalanceZero: boolean;
}

export interface ITransactionDataResponse {
  id: number;
  source_wallet_id: number;
  dest_wallet_id: number;
  entity_id: number;
  status: WalletTransactionStatusTypes;
  type: WalletAddTransactionTypes;
  amount: number;
  updated_at: string;
  created_at: string;
}

export interface ITransactionDataFormatted extends ITransactionDataResponse {
  amountFormatted?: string;
  tagColor?: string | null;
  updated_at_date?: string;
  updated_at_time?: string;
  submited_at_date?: string;
  submited_at_time?: string;
  isTypeDeposit?: boolean;
  isTypeInvestment?: boolean;
  typeFormatted?: string;
  statusFormated?: {
    text: string;
    tooltip?: string;
  };
  txShort: string;
  typeDisplay: string;
  description: string;
  scanTxUrl: string;
  submitted_at_date?: string;
  submitted_at_time?: string;
  statusText?: string;
  statusColor?: string;
  transaction_tx?: string;
  networkFormatted?: string;
}

export interface IPlaidLinkTokenResponse {
  expiration: string;
  link_token: string;
  request_id: string;
}

export interface IPlaidLinkExchange {
  accounts: [];
  access_token: string;
}

export interface IPlaidLinkProcess {
  additional: unknown;
  token: string;
}
