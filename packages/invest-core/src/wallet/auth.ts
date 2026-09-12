const BACKEND_READY_STATUSES = new Set<string>([
  'created',
  'verified',
]);

const BACKEND_ERROR_STATUSES = new Set<string>([
  'error',
  'error_retry',
  'error_document',
  'error_pending',
  'error_suspended',
]);

export type WalletAuthStep =
  | 'intro'
  | 'sending_otp'
  | 'awaiting_otp'
  | 'binding'
  | 'success'
  | 'error';

export type WalletAuthOpenPayload = {
  profileId: number;
  profileType?: string | null;
  profileName?: string | null;
  fullAccountName?: string | null;
  userEmail?: string | null;
  walletStatus?: string | null;
  isKycApproved?: boolean | null;
  turnkeyLoginTarget?: WalletAuthTurnkeyLoginTarget | null;
};

export type WalletAuthOperationIntentBase = {
  profileId: number;
  chain: string;
  nonce: string;
  amount: string;
  assetAddress: string;
  assetSymbol: string;
};

export type WalletAuthWithdrawalOperationIntent = WalletAuthOperationIntentBase & {
  source: 'withdrawal';
  destinationAddress: string;
};

export type WalletAuthExchangeOperationIntent = WalletAuthOperationIntentBase & {
  source: 'exchange';
  toAssetAddress: string;
  toAssetSymbol: string;
  destinationAddress: string;
  estimatedReceiveText?: string;
  estimatedRateText?: string;
};

export type WalletAuthOperationIntent =
  | WalletAuthWithdrawalOperationIntent
  | WalletAuthExchangeOperationIntent;

export type CompletedPostAuthAction =
  | 'zero_transaction_warmup';

export type PendingPostAuthAction = {
  profileId: number;
  run: () => Promise<void>;
  successMarker?: CompletedPostAuthAction;
  operationIntent?: WalletAuthOperationIntent;
};

export type TriggerZeroTransactionWarmupResult =
  | 'completed'
  | 'deferred_to_wallet_auth';

export type WalletSignerErrorInfo = {
  message: string;
};

export type WalletAuthTurnkeyChainAccountReference = {
  chain: string;
  account_id: string;
  address?: string;
};

export type WalletAuthTurnkeyDetails = {
  orgId: string;
  subOrgId: string;
  userId: string;
  walletId: string;
  accountId: string;
  otpAttemptId?: string;
  accounts?: WalletAuthTurnkeyChainAccountReference[];
};

export type WalletAuthTurnkeyLoginTarget = {
  orgId?: string | null;
  subOrgId: string;
  userId?: string | null;
  walletId: string;
  accountId?: string | null;
  address?: string | null;
};

export type WalletAuthDetails = {
  providerName?: 'turnkey';
  address?: string;
  walletAddress?: string;
  turnkey?: WalletAuthTurnkeyDetails;
  [key: string]: unknown;
};

export type WalletDirectTransactionChain =
  | 'ethereum'
  | 'ethereum-sepolia'
  | 'polygon'
  | 'base';

export type WalletDirectTransactionRequest = {
  chain: WalletDirectTransactionChain;
  fromAddress: string;
  toAddress: string;
  data: `0x${string}`;
  /** Vault operation this transaction belongs to, for durable submission evidence. */
  operationId: number;
  /** Stable per-operation key a wallet adapter uses to resume its own pending call. */
  operationKey: string;
};

export type WalletDirectTransactionOptions = {
  beforeSubmit?: () => Promise<void>;
};

export type WalletDirectTransactionResult = {
  chain: WalletDirectTransactionChain;
  fromAddress: string;
  toAddress: string;
  transactionHash: `0x${string}`;
  submittedAt: string;
};

export type WalletAuthorizationSignatureRequest = {
  type?: string;
  data?: unknown;
};

export type WalletAuthorizationSigningOptions = {
  expectedWalletAddress?: string | null;
  expectedTurnkeyAccountId?: string | null;
};

export type WalletAuthOtpSubmissionResult = 'connected';

export type WalletAuthStartEmailOtpResult = 'awaiting_otp' | 'connected';

export type WalletAuthStartEmailOtpOptions = {
  profileId?: number;
  turnkeyLoginTarget?: WalletAuthTurnkeyLoginTarget | null;
};

export type WalletAuthorizationTurnkeySmartContractInterface = {
  address: string;
  interface: string;
  type: string;
  label: string;
  notes?: string;
};

export type WalletAuthorizationTurnkeyPolicyRequest = {
  profileId: number;
  organizationId: string;
  policyName: string;
  effect: string;
  condition: string;
  consensus: string;
  notes?: string;
  smartContractInterfaces?: WalletAuthorizationTurnkeySmartContractInterface[];
};

export type WalletAuthorizationTurnkeyPolicyResult = {
  policyId: string;
  policyName: string;
  activityId?: string;
  smartContractInterfaceIds?: string[];
};

export const normalizeWalletProfileSlug = (value?: string | null) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_./+]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

export const deriveWalletAuthEmail = (
  userEmail?: string | null,
  profileName?: string | null,
  isIndividual: boolean = false,
) => {
  const email = String(userEmail ?? '').trim().toLowerCase();

  if (!email) {
    return '';
  }

  if (isIndividual) {
    return email;
  }

  const [localPart, domain] = email.split('@');
  const profileSlug = normalizeWalletProfileSlug(profileName);

  if (!localPart || !domain || !profileSlug) {
    return email;
  }

  return `${localPart}+${profileSlug}@${domain}`;
};

export const isWalletBackendReady = (status?: string | null) =>
  Boolean(status && BACKEND_READY_STATUSES.has(status));

export const isWalletBackendError = (status?: string | null) =>
  Boolean(status && BACKEND_ERROR_STATUSES.has(status));

export const shouldPromptWalletAuth = ({
  isKycApproved,
  walletStatus,
}: Pick<WalletAuthOpenPayload, 'isKycApproved' | 'walletStatus'>) => (
  Boolean(isKycApproved)
  && !isWalletBackendReady(walletStatus)
  && !isWalletBackendError(walletStatus)
);

export const getWalletAuthAddressFromDetails = (authDetails: unknown) => {
  const details = authDetails as WalletAuthDetails | null | undefined;
  const address = details?.address ?? details?.walletAddress;
  return typeof address === 'string' && address.trim() ? address.trim() : '';
};

export const assertTurnkeyWalletAuthDetails = (authDetails: unknown): WalletAuthDetails => {
  const details = authDetails as WalletAuthDetails | null | undefined;
  if (details?.providerName !== 'turnkey') {
    throw new Error('This wallet is not registered with the supported Turnkey provider.');
  }
  return details;
};

export const getWalletAuthTurnkeyDetails = (authDetails: unknown) => {
  const turnkey = (authDetails as WalletAuthDetails | null | undefined)?.turnkey;

  if (
    turnkey?.orgId
    && turnkey.subOrgId
    && turnkey.userId
    && turnkey.walletId
    && turnkey.accountId
  ) {
    return turnkey;
  }

  return null;
};

const firstNonEmpty = (...values: unknown[]) =>
  values.map((value) => String(value ?? '').trim()).find(Boolean) ?? '';

export const getWalletAuthTurnkeyLoginTarget = (
  source: unknown,
): WalletAuthTurnkeyLoginTarget | null => {
  const data = source as Record<string, unknown> | null | undefined;
  const turnkey = data?.turnkey as Record<string, unknown> | null | undefined;
  const directChainStatus = firstNonEmpty(
    data?.chain_account_status,
    data?.chainAccountStatus,
  ).toLowerCase();
  if (directChainStatus && directChainStatus !== 'verified') {
    return null;
  }
  const chains = Array.isArray(data?.chains)
    ? data.chains as Array<Record<string, unknown>>
    : [];
  if (chains.length > 0 && chains.some((chain) => {
    const status = firstNonEmpty(chain.chain_account_status, chain.chainAccountStatus).toLowerCase();
    return status !== 'verified';
  })) {
    return null;
  }
  const subOrgId = firstNonEmpty(
    data?.turnkey_sub_org_id,
    data?.turnkeySubOrgId,
    turnkey?.subOrgId,
    turnkey?.sub_org_id,
  );
  const userId = firstNonEmpty(
    data?.turnkey_user_id,
    data?.turnkeyUserId,
    turnkey?.userId,
    turnkey?.user_id,
  );
  const walletId = firstNonEmpty(
    data?.turnkey_wallet_id,
    data?.turnkeyWalletId,
    turnkey?.walletId,
    turnkey?.wallet_id,
  );
  const accountId = firstNonEmpty(
    data?.turnkey_account_id,
    data?.turnkeyAccountId,
    turnkey?.accountId,
    turnkey?.account_id,
  );

  if (!subOrgId || !walletId || !accountId) {
    return null;
  }

  const orgId = firstNonEmpty(
    data?.turnkey_org_id,
    data?.turnkeyOrgId,
    turnkey?.orgId,
    turnkey?.org_id,
  );
  const address = firstNonEmpty(
    data?.wallet_address,
    data?.walletAddress,
    data?.address,
    turnkey?.address,
  );

  return {
    ...(orgId ? { orgId } : {}),
    subOrgId,
    ...(userId ? { userId } : {}),
    walletId,
    accountId,
    ...(address ? { address } : {}),
  };
};

const normalizeIntentText = (value: string) => value.trim();

const normalizeOptionalIntentText = (value?: string) => {
  const normalized = normalizeIntentText(value ?? '');
  return normalized || undefined;
};

export const normalizeWalletAuthOperationIntent = (
  intent: WalletAuthOperationIntent,
): WalletAuthOperationIntent => {
  const baseIntent = {
    profileId: intent.profileId,
    chain: normalizeIntentText(intent.chain),
    nonce: normalizeIntentText(intent.nonce),
    amount: normalizeIntentText(intent.amount),
    assetAddress: normalizeIntentText(intent.assetAddress),
    assetSymbol: normalizeIntentText(intent.assetSymbol),
  };

  if (intent.source === 'withdrawal') {
    return {
      ...baseIntent,
      source: 'withdrawal',
      destinationAddress: normalizeIntentText(intent.destinationAddress),
    };
  }

  return {
    ...baseIntent,
    source: 'exchange',
    toAssetAddress: normalizeIntentText(intent.toAssetAddress),
    toAssetSymbol: normalizeIntentText(intent.toAssetSymbol),
    destinationAddress: normalizeIntentText(intent.destinationAddress),
    ...(normalizeOptionalIntentText(intent.estimatedReceiveText)
      ? { estimatedReceiveText: normalizeOptionalIntentText(intent.estimatedReceiveText) }
      : {}),
    ...(normalizeOptionalIntentText(intent.estimatedRateText)
      ? { estimatedRateText: normalizeOptionalIntentText(intent.estimatedRateText) }
      : {}),
  };
};

const tryParseJson = (value: string) => {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
};

const extractWalletAuthErrorMessage = (error: unknown): string => {
  if (!error) {
    return '';
  }

  if (typeof error === 'string') {
    const parsed = tryParseJson(error);
    if (parsed) {
      return extractWalletAuthErrorMessage(parsed);
    }

    return error.trim();
  }

  if (error instanceof Error) {
    return extractWalletAuthErrorMessage({
      message: error.message,
      name: error.name,
      cause: error.cause,
    });
  }

  if (typeof error !== 'object') {
    return '';
  }

  const errorRecord = error as Record<string, unknown>;
  const nestedCandidates = [
    errorRecord.message,
    errorRecord.error,
    errorRecord.details,
    errorRecord.cause,
  ];

  for (const candidate of nestedCandidates) {
    const message = extractWalletAuthErrorMessage(candidate);
    if (message) {
      return message;
    }
  }

  return '';
};

export const resolveWalletAuthErrorMessage = (
  error: unknown,
  fallbackMessage: string,
) => extractWalletAuthErrorMessage(error) || fallbackMessage;

const normalizeErrorMessage = (error?: unknown) => {
  const errorLike = error as Error | undefined;

  return `${String(errorLike?.name ?? '').trim()} ${String(errorLike?.message ?? error ?? '').trim()}`
    .trim()
    .toLowerCase();
};

export const isUserRejectedWalletSignatureError = (error?: unknown) => {
  const message = normalizeErrorMessage(error);

  return [
    'user rejected',
    'user denied',
    'rejected the request',
    'signature rejected',
    'cancelled',
    'canceled',
  ].some((pattern) => message.includes(pattern));
};

export const isRecoverableWalletAuthError = (error?: unknown) => {
  const message = normalizeErrorMessage(error);

  if (!message) {
    return false;
  }

  if (isUserRejectedWalletSignatureError(error)) {
    return false;
  }

  return [
    'notauthenticatederror',
    'not authenticated',
    'signer not authenticated',
    'please authenticate',
    'authentication failed',
    'wallet auth',
    'wallet signer',
    'not connected',
    'disconnected',
    'session expired',
    'expired session',
    'iframe container cannot be found',
    'key not initialized',
    'call init() first',
    'wallet session does not match requested wallet',
    'turnkey account does not match requested authorization',
    'missing signer',
    'no signer',
  ].some((pattern) => message.includes(pattern));
};
