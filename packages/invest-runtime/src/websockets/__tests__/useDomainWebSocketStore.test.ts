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
const appContext = {
  appConfig: {
    isDev: false,
    urls: { api: { notification: 'https://notification.example.com' } },
  },
};
const useInvestApplicationContextMock = vi.fn(() => appContext);

let latestSocketOptions: Record<string, any> | null = null;

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

vi.mock('@vueuse/core', () => ({
  useWebSocket: (...args: unknown[]) => useWebSocketMock(...args),
}));

vi.mock('@webdevelop-pro/invest-runtime/application-context', () => ({
  useInvestApplicationContext: () => useInvestApplicationContextMock(),
}));

vi.mock('@webdevelop-pro/invest-runtime/session', () => ({
  useSessionStore: () => ({
    userLoggedIn,
  }),
}));

vi.mock('vue-sonner', () => ({
  // sonner's toast is a function with variant methods; all record on one mock
  get toast() { return Object.assign(toastMock, { error: toastMock, success: toastMock, info: toastMock, dismiss: vi.fn() }); },
}));

const loadStore = async () => {
  const { useDomainWebSocketStore } = await import('../useDomainWebSocketStore.ts');
  return useDomainWebSocketStore();
};

describe('useDomainWebSocketStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useInvestApplicationContextMock.mockImplementation(() => appContext);
    setActivePinia(createPinia());
    setNavigatorOnline(true);
    userLoggedIn.value = true;
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
  });
});
