import type {
  VaultLifecycleOperation,
  VaultLifecycleStatus,
  VaultSigningPayload,
} from '@webdevelop-pro/domain-types/vaultTypes';
import type {
  WalletDirectTransactionChain,
  WalletDirectTransactionRequest,
  WalletDirectTransactionResult,
} from '@webdevelop-pro/invest-core/wallet/auth';

const STORAGE_PREFIX = 'invest:vault-direct-operation:';
const ADDRESS_PATTERN = /^0x[0-9a-f]{40}$/i;
const CALLDATA_PATTERN = /^0x(?:[0-9a-f]{2})+$/i;
const DIRECT_VAULT_CHAINS = new Set<WalletDirectTransactionChain>([
  'ethereum',
  'ethereum-sepolia',
  'polygon',
  'base',
]);

export type VaultDirectSubmissionStage =
  | 'submitted'
  | 'detected_provisional'
  | 'confirmed'
  | 'failed';

export type VaultDirectSubmission = WalletDirectTransactionResult & {
  operationId: number;
  callData: `0x${string}`;
  stage: VaultDirectSubmissionStage;
  failureReason: string | null;
};

export type VaultDirectSubmissionOptions = {
  beforeSubmit?: () => Promise<VaultSigningPayload>;
  sendDirectTransaction: (
    request: WalletDirectTransactionRequest,
    options?: { beforeSubmit?: () => Promise<void> },
  ) => Promise<WalletDirectTransactionResult>;
};

export type VaultOperationPollingOptions = {
  delayMs?: number;
  maxAttempts?: number;
  wait?: (delayMs: number) => Promise<void>;
};

const normalizeAddress = (value: string) => value.trim().toLowerCase();

/**
 * Stable browser identity for one Vault operation's direct transaction. A
 * wallet adapter keys its pending provider call on this, so a reload resumes
 * the accepted call instead of submitting a replacement.
 */
export const vaultDirectOperationKey = (operationId: number) => {
  if (!Number.isSafeInteger(operationId) || operationId <= 0) {
    throw new Error('The Vault operation identifier is invalid.');
  }
  return `vault-operation-${operationId}`;
};

const storageForOperation = (operationId: number) => `${STORAGE_PREFIX}${operationId}`;

const getStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  }
  catch {
    return null;
  }
};

export function assertDirectVaultSigningPayload(
  payload: VaultSigningPayload,
  expectedVaultAddress: string,
): void {
  const expectedVault = normalizeAddress(expectedVaultAddress);
  const transactionTarget = normalizeAddress(payload.transaction_to_address);
  const logicalTarget = normalizeAddress(payload.call_target_address);

  if (!ADDRESS_PATTERN.test(expectedVault)) {
    throw new Error('The expected Vault address is unavailable or invalid.');
  }
  if (
    transactionTarget !== expectedVault
    || logicalTarget !== expectedVault
    || transactionTarget !== logicalTarget
  ) {
    throw new Error(
      'The prepared claim is not a direct transaction to the expected Vault.',
    );
  }
  if (!ADDRESS_PATTERN.test(payload.from_address)) {
    throw new Error('The prepared Vault transaction does not include a valid signer address.');
  }
  if (
    !CALLDATA_PATTERN.test(payload.transaction_call_data)
    || payload.transaction_call_data.toLowerCase() !== payload.call_data.toLowerCase()
    || payload.transaction_call_data.toLowerCase() !== payload.logical_call_data.toLowerCase()
    || !/^0x[0-9a-f]{8}$/i.test(payload.contract_function_selector)
    || !payload.transaction_call_data.toLowerCase().startsWith(
      payload.contract_function_selector.toLowerCase(),
    )
  ) {
    throw new Error('The prepared direct Vault calldata does not match its logical call.');
  }
  if (!DIRECT_VAULT_CHAINS.has(payload.chain as WalletDirectTransactionChain)) {
    throw new Error(`Direct Vault transactions do not support chain "${payload.chain}".`);
  }
}

export function readVaultDirectSubmission(
  operationId: number,
): VaultDirectSubmission | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(storageForOperation(operationId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<VaultDirectSubmission>;
    if (
      value.operationId !== operationId
      || !value.transactionHash
      || !value.submittedAt
      || !value.callData
    ) {
      return null;
    }
    return value as VaultDirectSubmission;
  }
  catch {
    return null;
  }
}

export function reconcileVaultDirectSubmission(
  operationId: number,
  operation: VaultLifecycleOperation | null | undefined,
): VaultDirectSubmission | null {
  const current = readVaultDirectSubmission(operationId);
  if (!current || !operation) return current;

  const next: VaultDirectSubmission = {
    ...current,
    transactionHash: (operation.tx_hash || current.transactionHash) as `0x${string}`,
    stage: operation.status === 'failed'
      ? 'failed'
      : operation.status === 'confirmed'
        ? 'confirmed'
        : operation.stage === 'detected_provisional'
          ? 'detected_provisional'
          : 'submitted',
    failureReason: operation.failure_reason ?? null,
  };
  try {
    getStorage()?.setItem(storageForOperation(operationId), JSON.stringify(next));
  }
  catch {
    // The backend lifecycle remains authoritative when browser persistence is unavailable.
  }
  return next;
}

export async function waitForVaultOperationStatus(
  operationId: number,
  loadStatus: () => Promise<VaultLifecycleStatus>,
  options: VaultOperationPollingOptions = {},
): Promise<VaultLifecycleStatus> {
  const delayMs = options.delayMs ?? 2_000;
  const maxAttempts = options.maxAttempts ?? 150;
  const wait = options.wait ?? ((milliseconds: number) => new Promise<void>(
    resolve => setTimeout(resolve, milliseconds),
  ));
  let status = await loadStatus();

  for (let attempt = 1; attempt < maxAttempts; attempt += 1) {
    if (
      status.operation?.id === operationId
      && (status.operation.status === 'confirmed' || status.operation.status === 'failed')
    ) {
      return status;
    }
    await wait(delayMs);
    status = await loadStatus();
  }

  return status;
}

export async function submitDirectVaultTransaction(
  payload: VaultSigningPayload,
  expectedVaultAddress: string,
  options: VaultDirectSubmissionOptions,
): Promise<VaultDirectSubmission> {
  assertDirectVaultSigningPayload(payload, expectedVaultAddress);
  const existing = readVaultDirectSubmission(payload.operation_id);
  if (existing) {
    if (
      normalizeAddress(existing.fromAddress) !== normalizeAddress(payload.from_address)
      || normalizeAddress(existing.toAddress) !== normalizeAddress(payload.transaction_to_address)
      || existing.chain !== payload.chain
      || existing.callData.toLowerCase() !== payload.transaction_call_data.toLowerCase()
    ) {
      throw new Error('The persisted Vault transaction conflicts with the prepared operation.');
    }
    return existing;
  }

  const request = {
    chain: payload.chain as WalletDirectTransactionChain,
    fromAddress: payload.from_address,
    toAddress: payload.transaction_to_address,
    data: payload.transaction_call_data as `0x${string}`,
    operationId: payload.operation_id,
    operationKey: vaultDirectOperationKey(payload.operation_id),
  };
  const beforeSubmit = options.beforeSubmit
    ? async () => {
        const armed = await options.beforeSubmit!();
        assertDirectVaultSigningPayload(armed, expectedVaultAddress);
        const immutableFields: Array<keyof VaultSigningPayload> = [
          'operation_id',
          'chain',
          'from_address',
          'transaction_to_address',
          'transaction_call_data',
          'call_target_address',
          'contract_function_selector',
          'call_data',
          'logical_call_data',
          'amount_raw',
          'confirmation_target',
        ];
        if (immutableFields.some((field) => String(armed[field]) !== String(payload[field]))) {
          throw new Error('The armed wallet transaction differs from the prepared operation.');
        }
      }
    : undefined;
  const result = beforeSubmit
    ? await options.sendDirectTransaction(request, { beforeSubmit })
    : await options.sendDirectTransaction(request);
  const submission: VaultDirectSubmission = {
    ...result,
    operationId: payload.operation_id,
    callData: payload.transaction_call_data as `0x${string}`,
    stage: 'submitted',
    failureReason: null,
  };
  try {
    getStorage()?.setItem(
      storageForOperation(payload.operation_id),
      JSON.stringify(submission),
    );
  }
  catch {
    // Submission succeeded even if the browser cannot persist its local projection.
  }
  return submission;
}
