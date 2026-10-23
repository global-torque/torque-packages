/* @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick, ref } from 'vue';
import { configureInvestRuntimeAdapters, resetInvestRuntimeAdaptersForTests } from '../../adapters.ts';

const toastMock = vi.fn();
const useWebSocketMock = vi.fn();
const closeMock = vi.fn();
const socketData = ref<string | null>(null);
const socketStatus = ref('CLOSED');
const userLoggedIn = ref(false);
const userSession = ref<any>(undefined);
const appContext = {
  appConfig: {
    isDev: false,
    urls: { api: { notification: 'https://notification.example.com' } },
  },
};
const useInvestApplicationContextMock = vi.fn(() => appContext);

const evmOperationFields = (overrides: Record<string, unknown> = {}) => ({
  type: 'evm_operation',
  object_id: 52,
  investment_id: 17,
  profile_id: 4,
  status: 'confirmed',
  submission_status: 'confirmed',
  chain: 'ethereum',
  transaction_tx: '0xabc',
  block_number: 101,
  block_timestamp: '2026-10-22T10:00:00.000Z',
  receipt_block_hash: '0xblock',
  confirmation_count: 3,
  confirmation_target: 6,
  reorg_count: 0,
  last_seen_block: 103,
  removed_at: null,
  failure_code: null,
  amount: '10',
  amount_raw: '10000000',
  token_address: '0xtoken',
  token_ticker: 'USDC',
  token_name: 'USD Coin',
  token_decimals: 6,
  destination_address: '0xdestination',
  receipt_execution_status: 'unknown',
  expected_action_status: 'not_checked',
  expected_action_failure_code: null,
  created_at: '2026-10-22T09:00:00.000Z',
  updated_at: '2026-10-22T10:00:00.000Z',
  ...overrides,
});

const evmOperationNotification = (
  fields = evmOperationFields(),
  objectName = 'evm_operation',
  outerObjectId: unknown = fields.object_id,
) => JSON.stringify({
  id: 901,
  type: 'internal',
  data: {
    obj: objectName,
    object_id: outerObjectId,
    fields,
  },
});

let latestSocketOptions: Record<string, any> | null = null;
const loadedStores: Array<{ $dispose: () => void }> = [];

const setNavigatorOnline = (online: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => online,
  });
};

vi.mock('pinia', async () => {
  const actual = await vi.importActual<typeof import('pinia')>('pinia');
  return {
    ...actual,
    storeToRefs: (store: Record<string, unknown>) => store,
  };
});

vi.mock('@vueuse/core', async importOriginal => ({
  ...await importOriginal<typeof import('@vueuse/core')>(),
  useWebSocket: (...args: unknown[]) => useWebSocketMock(...args),
}));

vi.mock('@global-torque/invest-runtime/application-context', () => ({
  useInvestApplicationContext: () => useInvestApplicationContextMock(),
}));

vi.mock('@global-torque/invest-runtime/session', () => ({
  useSessionStore: () => ({
    userLoggedIn,
    userSession,
  }),
}));

vi.mock('vue-sonner', () => ({
  // sonner's toast is a function with variant methods; all record on one mock
  get toast() { return Object.assign(toastMock, { error: toastMock, success: toastMock, info: toastMock, dismiss: vi.fn() }); },
}));

const loadStore = async () => {
  const { useDomainWebSocketStore } = await import('../useDomainWebSocketStore.ts');
  const store = useDomainWebSocketStore();
  loadedStores.push(store);
  return store;
};

describe('useDomainWebSocketStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useInvestApplicationContextMock.mockImplementation(() => appContext);
    setActivePinia(createPinia());
    setNavigatorOnline(true);
    userLoggedIn.value = true;
    userSession.value = {
      active: true,
      id: 'session-a',
      identity: { id: 'identity-a' },
    };
    socketData.value = null;
    socketStatus.value = 'CLOSED';
    latestSocketOptions = null;
    configureInvestRuntimeAdapters({
      notifications: {
        updateNotificationsData: vi.fn(),
        refreshNotifications: vi.fn(),
        formatNotificationHref: vi.fn(() => ''),
        fallbackHref: vi.fn(() => ''),
      },
      realtime: { handleInternalNotification: vi.fn() },
    });
    closeMock.mockImplementation(() => {
      socketStatus.value = 'CLOSED';
    });
    useWebSocketMock.mockImplementation((_uri: string, options: Record<string, any>) => {
      latestSocketOptions = options;
      socketStatus.value = 'OPEN';
      return {
        data: socketData,
        close: closeMock,
        status: socketStatus,
      };
    });
  });

  afterEach(async () => {
    userLoggedIn.value = false;
    await nextTick();
    loadedStores.splice(0).forEach(store => store.$dispose());
    userSession.value = undefined;
    await nextTick();
    resetInvestRuntimeAdaptersForTests();
    vi.useRealTimers();
  });

  it('opens the websocket after setup using the captured notification URL', async () => {
    const store = await loadStore();
    useInvestApplicationContextMock.mockImplementation(() => {
      throw new Error('Vue application context is no longer active');
    });

    await store.webSocketHandler();

    expect(useInvestApplicationContextMock).toHaveBeenCalledTimes(1);
    expect(useWebSocketMock).toHaveBeenCalledWith(
      'wss://notification.example.com/ws',
      expect.any(Object),
    );
  });

  it('schedules heartbeats once per minute only while the socket is active', async () => {
    vi.useFakeTimers();
    const store = await loadStore();
    await store.webSocketHandler();
    const heartbeat = vi.fn();
    const controls = latestSocketOptions!.heartbeat.scheduler(heartbeat);
    try {
      await vi.advanceTimersByTimeAsync(60000);
      expect(heartbeat).not.toHaveBeenCalled();
      controls.resume();
      await vi.advanceTimersByTimeAsync(59999);
      expect(heartbeat).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(heartbeat).toHaveBeenCalledOnce();
      controls.pause();
      await vi.advanceTimersByTimeAsync(120000);
      expect(heartbeat).toHaveBeenCalledOnce();
    } finally {
      controls.pause();
      store.$dispose();
    }
  });

  it('suppresses the retry toast when reconnect attempts fail offline', async () => {
    const store = await loadStore();

    await store.webSocketHandler();
    setNavigatorOnline(false);
    latestSocketOptions?.autoReconnect?.onFailed?.();

    expect(toastMock).not.toHaveBeenCalled();
  });

  it('keeps reconnect recovery silent while the user remains online', async () => {
    const store = await loadStore();

    await store.webSocketHandler();
    latestSocketOptions?.autoReconnect?.onFailed?.();

    expect(toastMock).not.toHaveBeenCalled();
  });

  it('removes connectivity listeners after logout closes the socket', async () => {
    const store = await loadStore();

    await store.webSocketHandler();
    userLoggedIn.value = false;
    await nextTick();
    setNavigatorOnline(true);
    window.dispatchEvent(new Event('online'));

    expect(closeMock).toHaveBeenCalledTimes(1);
    expect(useWebSocketMock).toHaveBeenCalledTimes(1);
  });

  it('skips opening the websocket while the browser is offline', async () => {
    setNavigatorOnline(false);
    const store = await loadStore();

    await store.webSocketHandler();

    expect(useWebSocketMock).not.toHaveBeenCalled();
    expect(toastMock).not.toHaveBeenCalled();
  });

  it('publishes wallet, redemption, and operation-effect invalidations', async () => {
    const store = await loadStore();
    await store.webSocketHandler();

    socketData.value = JSON.stringify({
      type: 'internal',
      data: {
        obj: 'evm-wallet',
        object_id: 31,
        fields: { type: 'status' },
      },
    });
    await nextTick();
    expect(store.evmWalletInvalidation).toEqual({ walletId: 31, sequence: 1 });

    socketData.value = JSON.stringify({
      type: 'internal',
      data: {
        obj: 'investment-redemption',
        object_id: 44,
        fields: { type: 'status', investment_id: 17, offer_id: 9 },
      },
    });
    await nextTick();
    expect(store.investmentRedemptionInvalidation).toEqual({
      redemptionId: 44,
      investmentId: 17,
      offerId: 9,
      sequence: 1,
    });

    socketData.value = JSON.stringify({
      type: 'internal',
      data: {
        obj: 'evm-wallet-operation',
        object_id: 52,
        fields: {
          type: 'operation_effects',
          operation_effects: { effect_id: 63 },
        },
      },
    });
    await nextTick();
    expect(store.evmOperationInvalidation).toEqual({ operationId: 52, sequence: 1 });
    expect(store.evmEffectInvalidation).toEqual({
      operationId: 52,
      effectId: 63,
      sequence: 1,
    });
    expect(store.latestEvmOperationSnapshot).toBeNull();
  });

  it('publishes provider-shaped overlays with extra fields and retains them across reconnects', async () => {
    const store = await loadStore();
    await store.webSocketHandler();

    socketData.value = evmOperationNotification(evmOperationFields({
      receipt_execution_status: 'success',
      unrelated_provider_field: 'ignored',
    }));
    await nextTick();

    expect(store.latestEvmOperationSnapshot).toMatchObject({
      sequence: 1,
      overlay: {
        notification_id: 901,
        operation_id: 52,
        profile_id: 4,
        investment_id: 17,
        block_hash: '0xblock',
        token_symbol: 'USDC',
        amount_raw: '10000000',
        removed_at: null,
        failure_code: null,
        receipt_execution_status: 'success',
      },
    });

    await store.retryNow();

    expect(useWebSocketMock).toHaveBeenCalledTimes(2);
    expect(store.latestEvmOperationSnapshot?.sequence).toBe(1);
  });

  it('forwards mismatched operation IDs and invalidates the outer ID without publishing an overlay', async () => {
    const updateNotificationsData = vi.fn();
    const handleInternalNotification = vi.fn();
    configureInvestRuntimeAdapters({
      notifications: {
        updateNotificationsData,
        refreshNotifications: vi.fn(),
        formatNotificationHref: vi.fn(() => ''),
        fallbackHref: vi.fn(() => ''),
      },
      realtime: { handleInternalNotification },
    });
    const store = await loadStore();
    await store.webSocketHandler();

    socketData.value = evmOperationNotification(evmOperationFields(), 'evm_operation', 999);
    await nextTick();

    expect(updateNotificationsData).toHaveBeenCalledOnce();
    expect(handleInternalNotification).toHaveBeenCalledOnce();
    expect(store.evmOperationInvalidation).toEqual({ operationId: 999, sequence: 1 });
    expect(store.latestEvmOperationSnapshot).toBeNull();
  });

  it('keeps invalidation and notification forwarding when canonical overlay validation rejects a payload', async () => {
    const updateNotificationsData = vi.fn();
    const handleInternalNotification = vi.fn();
    configureInvestRuntimeAdapters({
      notifications: {
        updateNotificationsData,
        refreshNotifications: vi.fn(),
        formatNotificationHref: vi.fn(() => ''),
        fallbackHref: vi.fn(() => ''),
      },
      realtime: { handleInternalNotification },
    });
    const store = await loadStore();
    await store.webSocketHandler();

    socketData.value = evmOperationNotification(evmOperationFields({
      receipt_execution_status: 'successful',
    }));
    await nextTick();

    expect(updateNotificationsData).toHaveBeenCalledOnce();
    expect(handleInternalNotification).toHaveBeenCalledOnce();
    expect(store.evmOperationInvalidation).toEqual({ operationId: 52, sequence: 1 });
    expect(store.latestEvmOperationSnapshot).toBeNull();
  });

  it('rejects an unknown expected action status independently', async () => {
    const store = await loadStore();
    await store.webSocketHandler();

    socketData.value = evmOperationNotification(evmOperationFields({
      expected_action_status: 'invalid',
    }));
    await nextTick();

    expect(store.evmOperationInvalidation).toEqual({ operationId: 52, sequence: 1 });
    expect(store.latestEvmOperationSnapshot).toBeNull();
  });

  it('rejects malformed provider fields, normalizes null evidence, and does not publish aliases', async () => {
    const store = await loadStore();
    await store.webSocketHandler();

    socketData.value = evmOperationNotification(evmOperationFields({ updated_at: 'not-a-date' }));
    await nextTick();
    socketData.value = evmOperationNotification(evmOperationFields({ object_id: undefined }));
    await nextTick();
    socketData.value = evmOperationNotification(evmOperationFields({ profile_id: 0 }));
    await nextTick();
    socketData.value = evmOperationNotification(evmOperationFields({ block_number: Number.MAX_SAFE_INTEGER + 1 }));
    await nextTick();
    expect(store.latestEvmOperationSnapshot).toBeNull();

    socketData.value = evmOperationNotification(evmOperationFields({
      investment_id: null,
      transaction_tx: null,
      block_number: null,
      block_timestamp: null,
      receipt_block_hash: null,
      confirmation_count: null,
      confirmation_target: null,
      reorg_count: null,
      last_seen_block: null,
      amount: null,
      amount_raw: null,
      token_address: null,
      token_ticker: null,
      token_name: null,
      token_decimals: null,
      destination_address: null,
      receipt_execution_status: null,
      expected_action_status: null,
    }));
    await nextTick();
    expect(store.latestEvmOperationSnapshot?.overlay).toMatchObject({
      investment_id: null,
      block_number: null,
      reorg_count: null,
      token_decimals: null,
      amount_raw: null,
      token_symbol: null,
      receipt_execution_status: 'unknown',
      expected_action_status: 'not_checked',
    });

    socketData.value = evmOperationNotification(evmOperationFields(), 'evm_wallet_operation');
    await nextTick();
    expect(store.evmOperationInvalidation).toEqual({ operationId: 52, sequence: 5 });
    expect(store.latestEvmOperationSnapshot?.sequence).toBe(1);
  });

  it('clears the retained overlay when the session identity ends', async () => {
    const store = await loadStore();
    await store.webSocketHandler();
    socketData.value = evmOperationNotification();
    await nextTick();

    userLoggedIn.value = false;
    await nextTick();

    expect(store.latestEvmOperationSnapshot).toBeNull();
  });

  it('clears the snapshot and reconnects once when the active identity changes', async () => {
    const store = await loadStore();
    await store.webSocketHandler();
    socketData.value = evmOperationNotification();
    await nextTick();

    userSession.value = {
      active: true,
      id: 'session-b',
      identity: { id: 'identity-b' },
    };
    await nextTick();

    expect(store.latestEvmOperationSnapshot).toBeNull();
    expect(closeMock).toHaveBeenCalledTimes(1);
    expect(useWebSocketMock).toHaveBeenCalledTimes(2);
  });
});
