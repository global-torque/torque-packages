import { useInvestApplicationContext } from '@global-torque/invest-runtime/application-context';
import {
  getCurrentScope,
  onScopeDispose,
  ref,
  watch,
  type WatchStopHandle,
} from 'vue';
import { INotification } from '@global-torque/domain-types/notificationsTypes';
import { acceptHMRUpdate, defineStore, storeToRefs } from 'pinia';
import {
  createWebSocketClient,
  type WebSocketClient,
  type WebSocketStatus,
} from '@global-torque/sdk/websocket';
import { assertNotificationShareFields } from '@global-torque/invest-core/notifications/shareFields';
import { getInvestRuntimeAdapters } from '../adapters.ts';
import { useSessionStore } from '@global-torque/invest-runtime/session';
import {
  EvmExpectedActionStatuses,
  EvmReceiptExecutionStatuses,
  EvmTransactionStatusTypes,
  type IEvmOperationProgressOverlay,
} from '@global-torque/domain-types/evmTypes';

const isBrowserOffline = () => (
  typeof navigator !== 'undefined' && navigator.onLine === false
);

type UnknownRecord = Record<string, unknown>;

const hasOwn = (value: UnknownRecord, key: string) => Object.hasOwn(value, key);
const isRecord = (value: unknown): value is UnknownRecord => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);
const isSafeNonnegativeInteger = (value: unknown): value is number => (
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
);
const isPositiveInteger = (value: unknown): value is number => (
  isSafeNonnegativeInteger(value) && value > 0
);
const isNullableString = (value: unknown): value is string | null => (
  value === null || typeof value === 'string'
);
const isNullableTimestamp = (value: unknown): value is string | null => (
  value === null || (typeof value === 'string' && Number.isFinite(Date.parse(value)))
);
const isNullableNonnegativeInteger = (value: unknown): value is number | null => (
  value === null || isSafeNonnegativeInteger(value)
);
const isNullablePositiveInteger = (value: unknown): value is number | null => (
  value === null || isPositiveInteger(value)
);

const hasProgressFields = (fields: UnknownRecord) => [
  'object_id',
  'investment_id',
  'profile_id',
  'status',
  'submission_status',
  'chain',
  'transaction_tx',
  'block_number',
  'block_timestamp',
  'receipt_block_hash',
  'confirmation_count',
  'confirmation_target',
  'reorg_count',
  'last_seen_block',
  'removed_at',
  'failure_code',
  'amount',
  'amount_raw',
  'token_address',
  'token_ticker',
  'token_name',
  'token_decimals',
  'destination_address',
  'receipt_execution_status',
  'expected_action_status',
  'expected_action_failure_code',
  'created_at',
  'updated_at',
].every(key => hasOwn(fields, key));

const normalizeEvmOperationProgressOverlay = (
  notification: INotification,
): IEvmOperationProgressOverlay | null => {
  const fields = notification?.data?.fields;
  if (!isRecord(fields) || !hasProgressFields(fields)) return null;

  const status = fields.status;
  const receiptExecutionStatus = fields.receipt_execution_status;
  const expectedActionStatus = fields.expected_action_status;
  const normalizedReceiptExecutionStatus = receiptExecutionStatus === null
    ? EvmReceiptExecutionStatuses.unknown
    : receiptExecutionStatus;
  const normalizedExpectedActionStatus = expectedActionStatus === null
    ? EvmExpectedActionStatuses.not_checked
    : expectedActionStatus;
  if (
    !isPositiveInteger(notification.id)
    || !isPositiveInteger(notification.data.object_id)
    || notification.data.object_id !== fields.object_id
    || !isPositiveInteger(fields.object_id)
    || !isPositiveInteger(fields.profile_id)
    || !isNullablePositiveInteger(fields.investment_id)
    || typeof status !== 'string'
    || !Object.values(EvmTransactionStatusTypes).includes(status as never)
    || !isNullableString(fields.submission_status)
    || typeof fields.chain !== 'string'
    || !fields.chain.trim()
    || !isNullableString(fields.transaction_tx)
    || !isNullableNonnegativeInteger(fields.block_number)
    || !isNullableTimestamp(fields.block_timestamp)
    || !isNullableString(fields.receipt_block_hash)
    || !isNullableNonnegativeInteger(fields.confirmation_count)
    || !isNullableNonnegativeInteger(fields.confirmation_target)
    || !isNullableNonnegativeInteger(fields.reorg_count)
    || !isNullableNonnegativeInteger(fields.last_seen_block)
    || !isNullableTimestamp(fields.removed_at)
    || !isNullableString(fields.failure_code)
    || !isNullableString(fields.amount)
    || !isNullableString(fields.amount_raw)
    || !isNullableString(fields.token_address)
    || !isNullableString(fields.token_ticker)
    || !isNullableString(fields.token_name)
    || !isNullableNonnegativeInteger(fields.token_decimals)
    || !isNullableString(fields.destination_address)
    || (
      receiptExecutionStatus !== null
      && (
        typeof receiptExecutionStatus !== 'string'
        || !Object.values(EvmReceiptExecutionStatuses).includes(receiptExecutionStatus as never)
      )
    )
    || (
      expectedActionStatus !== null
      && (
        typeof expectedActionStatus !== 'string'
        || !Object.values(EvmExpectedActionStatuses).includes(expectedActionStatus as never)
      )
    )
    || !isNullableString(fields.expected_action_failure_code)
    || typeof fields.created_at !== 'string'
    || !Number.isFinite(Date.parse(fields.created_at))
    || typeof fields.updated_at !== 'string'
    || !Number.isFinite(Date.parse(fields.updated_at))
  ) {
    return null;
  }

  return {
    notification_id: notification.id,
    operation_id: fields.object_id,
    profile_id: fields.profile_id,
    investment_id: fields.investment_id,
    status: status as IEvmOperationProgressOverlay['status'],
    submission_status: fields.submission_status,
    chain: fields.chain,
    transaction_tx: fields.transaction_tx,
    block_number: fields.block_number,
    block_timestamp: fields.block_timestamp,
    block_hash: fields.receipt_block_hash,
    confirmation_count: fields.confirmation_count,
    confirmation_target: fields.confirmation_target,
    reorg_count: fields.reorg_count,
    last_seen_block: fields.last_seen_block,
    removed_at: fields.removed_at,
    failure_code: fields.failure_code,
    amount: fields.amount,
    amount_raw: fields.amount_raw,
    token_address: fields.token_address,
    token_symbol: fields.token_ticker,
    token_name: fields.token_name,
    token_decimals: fields.token_decimals,
    destination_address: fields.destination_address,
    receipt_execution_status: normalizedReceiptExecutionStatus as IEvmOperationProgressOverlay['receipt_execution_status'],
    expected_action_status: normalizedExpectedActionStatus as IEvmOperationProgressOverlay['expected_action_status'],
    expected_action_failure_code: fields.expected_action_failure_code,
    created_at: fields.created_at,
    updated_at: fields.updated_at,
  };
};

export const useDomainWebSocketStore = defineStore('domainWebsockets', () => {
  const appConfig = useInvestApplicationContext().appConfig;
  const debugLog = (message: string) => {
    if (appConfig.isDev) console.debug(message);
  };
  const userSessionStore = useSessionStore();
  const { userLoggedIn, userSession } = storeToRefs(userSessionStore);

  const isConnectingOrOpen = ref(false);
  const connectionStatus = ref<'CONNECTING' | 'OPEN' | 'CLOSED'>('CLOSED');
  const connectionGeneration = ref(0);
  const lastMessageAt = ref<string | null>(null);
  const latestEvmOperationSnapshot = ref<{
    sequence: number;
    overlay: IEvmOperationProgressOverlay;
  } | null>(null);
  const evmOperationInvalidation = ref({ operationId: 0, sequence: 0 });
  const evmWalletInvalidation = ref({ walletId: 0, sequence: 0 });
  const investmentRedemptionInvalidation = ref({
    redemptionId: 0,
    investmentId: 0,
    offerId: 0,
    sequence: 0,
  });
  const evmEffectInvalidation = ref({ operationId: 0, effectId: 0, sequence: 0 });
  let stopUserLoggedInWatch: WatchStopHandle | null = null;
  let stopIdentityWatch: WatchStopHandle | null = null;
  let webSocketClient: WebSocketClient | null = null;
  let hasBrowserListeners = false;
  let startupTimeout: number | null = null;
  let disposed = false;

  function updateConnectionStatus(status: WebSocketStatus) {
    const previousStatus = connectionStatus.value;
    connectionStatus.value = status;
    isConnectingOrOpen.value = status === 'CONNECTING' || status === 'OPEN';
    if (status === 'OPEN' && previousStatus !== 'OPEN') {
      connectionGeneration.value += 1;
    }
  }

  function cancelQueuedStartup() {
    if (startupTimeout !== null) {
      clearTimeout(startupTimeout);
      startupTimeout = null;
    }
  }

  function disconnectClient() {
    cancelQueuedStartup();
    webSocketClient?.disconnect();
    updateConnectionStatus('CLOSED');
  }

  function handleBeforeUnload() {
    disconnectClient();
  }

  function handleBrowserOnline() {
    if (disposed || !userLoggedIn.value || startupTimeout !== null) {
      return;
    }

    debugLog('browser online: retrying websocket connection');
    startupTimeout = window.setTimeout(() => {
      startupTimeout = null;
      if (disposed || !userLoggedIn.value || isBrowserOffline()) return;
      void webSocketHandler();
    }, 0);
  }

  function handleBrowserOffline() {
    debugLog('browser offline: closing websocket connection');
    disconnectClient();
  }

  function ensureBrowserListeners() {
    if (typeof window === 'undefined' || hasBrowserListeners) {
      return;
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('online', handleBrowserOnline);
    window.addEventListener('offline', handleBrowserOffline);
    hasBrowserListeners = true;
  }

  function cleanupBrowserListeners() {
    if (typeof window === 'undefined' || !hasBrowserListeners) {
      return;
    }

    window.removeEventListener('beforeunload', handleBeforeUnload);
    window.removeEventListener('online', handleBrowserOnline);
    window.removeEventListener('offline', handleBrowserOffline);
    hasBrowserListeners = false;
  }

  const handleInternalMessage = (notification: INotification) => {
    getInvestRuntimeAdapters().realtime?.handleInternalNotification(notification);
    const objectName = notification.data.obj.replaceAll('-', '_');
    const objectId = Number(
      notification.data.object_id
      ?? notification.data.fields?.object_id
      ?? 0,
    );
    const validObjectId = Number.isInteger(objectId) && objectId > 0
      ? objectId
      : 0;

    switch (objectName) {
      case 'investment_redemption':
        if (validObjectId) {
          const investmentId = Number(notification.data.fields?.investment_id ?? 0);
          const offerId = Number(notification.data.fields?.offer_id ?? 0);
          investmentRedemptionInvalidation.value = {
            redemptionId: validObjectId,
            investmentId: Number.isInteger(investmentId) && investmentId > 0 ? investmentId : 0,
            offerId: Number.isInteger(offerId) && offerId > 0 ? offerId : 0,
            sequence: investmentRedemptionInvalidation.value.sequence + 1,
          };
        }
        break;
      case 'evm_wallet':
        if (validObjectId) {
          evmWalletInvalidation.value = {
            walletId: validObjectId,
            sequence: evmWalletInvalidation.value.sequence + 1,
          };
        }
        break;
      case 'evm_operation':
      case 'evm_wallet_operation':
      case 'evm_transfer': {
        if (validObjectId) {
          evmOperationInvalidation.value = {
            operationId: validObjectId,
            sequence: evmOperationInvalidation.value.sequence + 1,
          };
        }
        const effectId = Number(notification.data.fields?.operation_effects?.effect_id ?? 0);
        if (validObjectId && Number.isInteger(effectId) && effectId > 0) {
          evmEffectInvalidation.value = {
            operationId: validObjectId,
            effectId,
            sequence: evmEffectInvalidation.value.sequence + 1,
          };
        }
        if (objectName === 'evm_operation') {
          const overlay = normalizeEvmOperationProgressOverlay(notification);
          if (overlay) {
            latestEvmOperationSnapshot.value = {
              sequence: (latestEvmOperationSnapshot.value?.sequence ?? 0) + 1,
              overlay,
            };
          }
        }
        break;
      }
      case 'evm_wallet_operation_effect':
      case 'evm_vault_request_effect': {
        const operationId = Number(notification.data.fields?.object_id ?? 0);
        if (validObjectId) {
          evmEffectInvalidation.value = {
            operationId: Number.isInteger(operationId) && operationId > 0 ? operationId : 0,
            effectId: validObjectId,
            sequence: evmEffectInvalidation.value.sequence + 1,
          };
        }
        break;
      }
      default:
        // Optionally handle unknown types
        break;
    }
  };

  const handleMessage = (message: unknown) => {
    if (disposed || !userLoggedIn.value) return;
    try {
      const notification = message as INotification;
      assertNotificationShareFields(notification);
      lastMessageAt.value = new Date().toISOString();
      getInvestRuntimeAdapters().notifications?.updateNotificationsData(notification);
      if (notification.type === 'internal') handleInternalMessage(notification);
    } catch (e) {
      console.error('Failed to process WebSocket message:', e);
    }
  };

  function getWebSocketClient(): WebSocketClient {
    if (webSocketClient) return webSocketClient;

    const notificationUrl = appConfig.urls.api.notification;
    const url = `${notificationUrl}/ws`;
    const websocketUrl = url.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
    debugLog(`connection to ${websocketUrl}`);
    webSocketClient = createWebSocketClient({
      url: websocketUrl,
      reconnect: {
        shouldRetry: () => !disposed && userLoggedIn.value && !isBrowserOffline(),
        baseDelayMs: 1000,
        maxDelayMs: 30000,
        jitterMs: 500,
      },
      heartbeat: {
        message: '{"Command": "ping"}',
        responseMessage: 'pong',
        intervalMs: 60000,
        timeoutMs: 1000,
      },
      onStatusChange: (status) => {
        if (disposed || !userLoggedIn.value) return;
        updateConnectionStatus(status);
      },
      onMessage: handleMessage,
    });
    return webSocketClient;
  }

  async function webSocketHandler(): Promise<void> {
    debugLog('webSocketHandler called');
    if (disposed || !userLoggedIn.value) return;

    ensureBrowserListeners();

    if (isBrowserOffline()) {
      debugLog('webSocketHandler skipped: browser offline');
      return;
    }

    if (isConnectingOrOpen.value) {
      debugLog('webSocketHandler skipped: connection already active');
      return;
    }

    updateConnectionStatus('CONNECTING');
    getWebSocketClient().connect();
  }

  async function retryNow() {
    if (disposed || !userLoggedIn.value || isBrowserOffline()) return;
    disconnectClient();
    await webSocketHandler();
  }

  function disposeStore() {
    if (disposed) return;
    disposed = true;
    cancelQueuedStartup();
    webSocketClient?.dispose();
    webSocketClient = null;
    updateConnectionStatus('CLOSED');
    cleanupBrowserListeners();
    stopUserLoggedInWatch?.();
    stopUserLoggedInWatch = null;
    stopIdentityWatch?.();
    stopIdentityWatch = null;
    latestEvmOperationSnapshot.value = null;
  }

  stopUserLoggedInWatch = watch(userLoggedIn, (loggedIn) => {
    if (loggedIn) return;
    latestEvmOperationSnapshot.value = null;
    disconnectClient();
  });

  stopIdentityWatch = watch(
    () => userSession.value?.active ? userSession.value.identity.id : null,
    (identity, previousIdentity) => {
      if (!identity || !previousIdentity || identity === previousIdentity) return;

      latestEvmOperationSnapshot.value = null;
      disconnectClient();
      if (!disposed && userLoggedIn.value && !isBrowserOffline()) {
        void webSocketHandler();
      }
    },
  );

  if (getCurrentScope()) {
    onScopeDispose(disposeStore);
  }

  return {
    webSocketHandler,
    connectionStatus,
    connectionGeneration,
    lastMessageAt,
    latestEvmOperationSnapshot,
    evmOperationInvalidation,
    evmWalletInvalidation,
    investmentRedemptionInvalidation,
    evmEffectInvalidation,
    retryNow,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useDomainWebSocketStore, import.meta.hot));
}
