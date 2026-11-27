/* @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, defineStore, setActivePinia } from 'pinia';
import { nextTick, ref } from 'vue';
import type { INotification } from '@global-torque/domain-types/notificationsTypes';
import type {
  WebSocketClient,
  WebSocketClientOptions,
  WebSocketStatus,
} from '@global-torque/sdk/websocket';
import { configureInvestRuntimeAdapters, resetInvestRuntimeAdaptersForTests } from '../../adapters.ts';

const sdk = vi.hoisted(() => ({
  createWebSocketClient: vi.fn(),
}));

const appContext = {
  appConfig: {
    isDev: false,
    urls: { api: { notification: 'https://notification.example.com' } },
  },
};
const useInvestApplicationContextMock = vi.fn(() => appContext);

const useTestSessionStore = defineStore('test-websocket-session', () => {
  const userLoggedIn = ref(false);
  const userSession = ref<{
    active: boolean;
    identity: { id: string };
  }>();

  return { userLoggedIn, userSession };
});

const notification = (
  id: number,
  options: {
    fields?: Record<string, unknown>;
    objectId?: number;
    objectName?: string;
    type?: string;
  } = {},
): INotification => ({
  id,
  user_id: 1,
  content: `Notification ${id}`,
  status: 'unread',
  type: options.type ?? 'internal',
  created_at: '2026-10-22T09:00:00.000Z',
  updated_at: '2026-10-22T10:00:00.000Z',
  data: {
    obj: options.objectName ?? 'system',
    object_id: options.objectId ?? id,
    fields: options.fields ?? {},
  },
} as INotification);

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

const setNavigatorOnline = (online: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => online,
  });
};

vi.mock('@global-torque/sdk/websocket', () => ({
  createWebSocketClient: sdk.createWebSocketClient,
}));

vi.mock('@global-torque/invest-runtime/application-context', () => ({
  useInvestApplicationContext: () => useInvestApplicationContextMock(),
}));

vi.mock('@global-torque/invest-runtime/session', () => ({
  useSessionStore: () => useTestSessionStore(),
}));

const loadStore = async () => {
  const { useDomainWebSocketStore } = await import('../useDomainWebSocketStore.ts');
  return useDomainWebSocketStore();
};

describe('useDomainWebSocketStore', () => {
  let clientOptions: WebSocketClientOptions | null = null;
  let client: WebSocketClient;
  let stores: Array<{ $dispose: () => void }>;

  const emitStatus = (status: WebSocketStatus) => {
    clientOptions?.onStatusChange(status);
  };

  const emitMessage = (message: unknown) => {
    clientOptions?.onMessage(message);
  };

  const startStore = async () => {
    const store = await loadStore();
    stores.push(store);
    await store.webSocketHandler();
    emitStatus('OPEN');
    return store;
  };

  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    useInvestApplicationContextMock.mockImplementation(() => appContext);
    resetInvestRuntimeAdaptersForTests();
    setActivePinia(createPinia());
    setNavigatorOnline(true);
    const sessionStore = useTestSessionStore();
    sessionStore.userLoggedIn = true;
    sessionStore.userSession = {
      active: true,
      identity: { id: 'identity-a' },
    };
    clientOptions = null;
    stores = [];
    client = {
      connect: vi.fn(() => emitStatus('CONNECTING')),
      disconnect: vi.fn(() => emitStatus('CLOSED')),
      dispose: vi.fn(),
    };
    sdk.createWebSocketClient.mockImplementation((options: WebSocketClientOptions) => {
      clientOptions = options;
      return client;
    });
    configureInvestRuntimeAdapters({
      notifications: {
        updateNotificationsData: vi.fn(),
        refreshNotifications: vi.fn(),
        formatNotificationHref: vi.fn(() => ''),
        fallbackHref: vi.fn(() => ''),
      },
      realtime: { handleInternalNotification: vi.fn() },
    });
  });

  afterEach(async () => {
    stores.splice(0).forEach(store => store.$dispose());
    resetInvestRuntimeAdaptersForTests();
    vi.restoreAllMocks();
    vi.useRealTimers();
    await nextTick();
  });

  it('creates one SDK client lazily and delegates lifecycle settings', async () => {
    const store = await loadStore();
    stores.push(store);
    useInvestApplicationContextMock.mockImplementation(() => {
      throw new Error('Vue application context is no longer active');
    });

    await store.webSocketHandler();
    await store.webSocketHandler();

    expect(sdk.createWebSocketClient).toHaveBeenCalledOnce();
    expect(client.connect).toHaveBeenCalledOnce();
    expect(clientOptions).toMatchObject({
      url: 'wss://notification.example.com/ws',
      reconnect: {
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
    });
    expect(clientOptions?.reconnect.shouldRetry()).toBe(true);
    setNavigatorOnline(false);
    expect(clientOptions?.reconnect.shouldRetry()).toBe(false);
    setNavigatorOnline(true);
    expect(useInvestApplicationContextMock).toHaveBeenCalledOnce();

    emitStatus('OPEN');
    expect(store.connectionGeneration).toBe(1);
    await store.retryNow();
    emitStatus('OPEN');

    expect(client.disconnect).toHaveBeenCalledOnce();
    expect(client.connect).toHaveBeenCalledTimes(2);
    expect(store.connectionGeneration).toBe(2);
  });

  it('forwards every valid parsed frame in arrival order without accepting invalid shares', async () => {
    const updateNotificationsData = vi.fn();
    configureInvestRuntimeAdapters({
      notifications: {
        updateNotificationsData,
        refreshNotifications: vi.fn(),
        formatNotificationHref: vi.fn(() => ''),
        fallbackHref: vi.fn(() => ''),
      },
    });
    const store = await startStore();
    const repeated = notification(5);
    const second = notification(6);
    const invalidShares = notification(4, { fields: { confirmed_shares: 2 } });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    emitMessage(invalidShares);
    emitMessage(repeated);
    emitMessage(repeated);
    emitMessage(second);

    expect(updateNotificationsData.mock.calls.map(([item]) => item)).toEqual([
      repeated,
      repeated,
      second,
    ]);
    expect(store.lastMessageAt).toEqual(expect.any(String));
    error.mockRestore();
  });

  it('preserves internal invalidations and canonical EVM operation snapshots', async () => {
    const handleInternalNotification = vi.fn();
    configureInvestRuntimeAdapters({
      realtime: { handleInternalNotification },
    });
    const store = await startStore();

    emitMessage(notification(31, {
      objectId: 31,
      objectName: 'evm-wallet',
      fields: { type: 'status' },
    }));
    emitMessage(notification(44, {
      objectId: 44,
      objectName: 'investment-redemption',
      fields: { type: 'status', investment_id: 17, offer_id: 9 },
    }));
    emitMessage(notification(901, {
      objectId: 52,
      objectName: 'evm-operation',
      fields: evmOperationFields({
        receipt_execution_status: 'success',
        unrelated_provider_field: 'ignored',
      }),
    }));
    emitMessage(notification(902, {
      objectId: 52,
      objectName: 'evm-wallet-operation',
      fields: {
        type: 'operation_effects',
        operation_effects: { effect_id: 63 },
      },
    }));

    expect(handleInternalNotification).toHaveBeenCalledTimes(4);
    expect(store.evmWalletInvalidation).toEqual({ walletId: 31, sequence: 1 });
    expect(store.investmentRedemptionInvalidation).toEqual({
      redemptionId: 44,
      investmentId: 17,
      offerId: 9,
      sequence: 1,
    });
    expect(store.evmEffectInvalidation).toEqual({
      operationId: 52,
      effectId: 63,
      sequence: 1,
    });
    expect(store.evmOperationInvalidation).toEqual({ operationId: 52, sequence: 2 });
    expect(store.latestEvmOperationSnapshot).toMatchObject({
      sequence: 1,
      overlay: {
        notification_id: 901,
        operation_id: 52,
        receipt_execution_status: 'success',
        amount_raw: '10000000',
      },
    });
  });

  it('keeps notification routing and the outer invalidation when EVM snapshot validation rejects data', async () => {
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
    const store = await startStore();

    emitMessage(notification(901, {
      objectId: 999,
      objectName: 'evm-operation',
      fields: evmOperationFields(),
    }));

    expect(updateNotificationsData).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ object_id: 999 }),
    }));
    expect(handleInternalNotification).toHaveBeenCalledOnce();
    expect(store.evmOperationInvalidation).toEqual({ operationId: 999, sequence: 1 });
    expect(store.latestEvmOperationSnapshot).toBeNull();

    const matchingNotification = notification(902, {
      objectId: 52,
      objectName: 'evm-operation',
      fields: evmOperationFields({ receipt_execution_status: 'successful' }),
    });
    emitMessage(matchingNotification);

    expect(updateNotificationsData).toHaveBeenCalledTimes(2);
    expect(updateNotificationsData).toHaveBeenNthCalledWith(2, matchingNotification);
    expect(handleInternalNotification).toHaveBeenCalledTimes(2);
    expect(handleInternalNotification).toHaveBeenNthCalledWith(2, matchingNotification);
    expect(store.evmOperationInvalidation).toEqual({ operationId: 52, sequence: 2 });
    expect(store.latestEvmOperationSnapshot).toBeNull();
  });

  it('normalizes nullable EVM evidence without publishing legacy aliases as snapshots', async () => {
    const store = await startStore();

    emitMessage(notification(901, {
      objectId: 52,
      objectName: 'evm-operation',
      fields: evmOperationFields({
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
      }),
    }));
    emitMessage(notification(902, {
      objectId: 52,
      objectName: 'evm-wallet-operation',
      fields: evmOperationFields(),
    }));

    expect(store.latestEvmOperationSnapshot).toMatchObject({
      sequence: 1,
      overlay: {
        investment_id: null,
        block_number: null,
        amount_raw: null,
        token_symbol: null,
        receipt_execution_status: 'unknown',
        expected_action_status: 'not_checked',
      },
    });
    expect(store.evmOperationInvalidation).toEqual({ operationId: 52, sequence: 2 });
  });

  it('resets the operation snapshot before reconnecting for a new identity', async () => {
    const store = await startStore();
    emitMessage(notification(901, {
      objectId: 52,
      objectName: 'evm-operation',
      fields: evmOperationFields(),
    }));
    const snapshot = store.latestEvmOperationSnapshot;
    expect(snapshot).not.toBeNull();
    const snapshotValues = {
      sequence: snapshot!.sequence,
      overlay: { ...snapshot!.overlay },
    };
    await store.retryNow();
    emitStatus('OPEN');

    expect(store.latestEvmOperationSnapshot).toEqual(snapshotValues);
    const sessionStore = useTestSessionStore();

    sessionStore.userSession = {
      active: true,
      identity: { id: 'identity-b' },
    };
    await nextTick();

    expect(store.latestEvmOperationSnapshot).toBeNull();
    expect(client.disconnect).toHaveBeenCalledTimes(2);
    expect(sdk.createWebSocketClient).toHaveBeenCalledOnce();
    expect(client.connect).toHaveBeenCalledTimes(3);
  });

  it('disconnects offline and starts one deferred connection after the browser returns online', async () => {
    vi.useFakeTimers();
    const store = await startStore();

    setNavigatorOnline(false);
    window.dispatchEvent(new Event('offline'));
    expect(client.disconnect).toHaveBeenCalledOnce();
    expect(store.connectionStatus).toBe('CLOSED');

    setNavigatorOnline(true);
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);

    expect(client.connect).toHaveBeenCalledTimes(2);
  });

  it('cancels queued startup on logout and ignores later SDK callbacks', async () => {
    vi.useFakeTimers();
    const updateNotificationsData = vi.fn();
    configureInvestRuntimeAdapters({
      notifications: {
        updateNotificationsData,
        refreshNotifications: vi.fn(),
        formatNotificationHref: vi.fn(() => ''),
        fallbackHref: vi.fn(() => ''),
      },
    });
    const store = await startStore();

    emitMessage(notification(901, {
      objectId: 52,
      objectName: 'evm-operation',
      fields: evmOperationFields(),
    }));
    expect(store.latestEvmOperationSnapshot).not.toBeNull();
    updateNotificationsData.mockClear();

    setNavigatorOnline(false);
    window.dispatchEvent(new Event('offline'));
    setNavigatorOnline(true);
    window.dispatchEvent(new Event('online'));
    const sessionStore = useTestSessionStore();
    sessionStore.userLoggedIn = false;
    await nextTick();
    await vi.advanceTimersByTimeAsync(0);

    emitMessage(notification(7));
    emitStatus('OPEN');

    expect(client.connect).toHaveBeenCalledOnce();
    expect(updateNotificationsData).not.toHaveBeenCalled();
    expect(store.connectionStatus).toBe('CLOSED');
    expect(store.latestEvmOperationSnapshot).toBeNull();
  });

  it('disposes the SDK client and exact browser listeners with the Pinia scope', async () => {
    vi.useFakeTimers();
    const updateNotificationsData = vi.fn();
    configureInvestRuntimeAdapters({
      notifications: {
        updateNotificationsData,
        refreshNotifications: vi.fn(),
        formatNotificationHref: vi.fn(() => ''),
        fallbackHref: vi.fn(() => ''),
      },
    });
    const store = await startStore();

    window.dispatchEvent(new Event('beforeunload'));
    expect(client.disconnect).toHaveBeenCalledOnce();

    store.$dispose();
    emitMessage(notification(8));
    await store.webSocketHandler();
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);

    expect(client.dispose).toHaveBeenCalledOnce();
    expect(updateNotificationsData).not.toHaveBeenCalled();
    expect(client.connect).toHaveBeenCalledOnce();
  });
});
