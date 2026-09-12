import { useInvestApplicationContext } from '@webdevelop-pro/invest-runtime/application-context';
import { ref, watch, type WatchStopHandle } from 'vue';
import { INotification } from '@webdevelop-pro/domain-types/notificationsTypes';
import { acceptHMRUpdate, defineStore, storeToRefs } from 'pinia';
import { useWebSocket } from '@vueuse/core';
import { assertNotificationShareFields } from '@webdevelop-pro/invest-core/notifications/shareFields';
import { getInvestRuntimeAdapters } from '../adapters.ts';
import { useSessionStore } from '@webdevelop-pro/invest-runtime/session';

const isBrowserOffline = () => (
  typeof navigator !== 'undefined' && navigator.onLine === false
);

export const useDomainWebSocketStore = defineStore('domainWebsockets', () => {
  const appConfig = useInvestApplicationContext().appConfig;
  const debugLog = (message: string) => {
    if (appConfig.isDev) console.debug(message);
  };
  const userSessionStore = useSessionStore();
  const { userLoggedIn } = storeToRefs(userSessionStore);

  const isConnectingOrOpen = ref(false);
  const connectionStatus = ref<'CONNECTING' | 'OPEN' | 'CLOSED'>('CLOSED');
  const connectionGeneration = ref(0);
  const lastMessageAt = ref<string | null>(null);
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
  let stopDataWatch: WatchStopHandle | null = null;
  let stopStatusWatch: WatchStopHandle | null = null;
  let closeConnection: (() => void) | null = null;
  let hasConnectivityListeners = false;

  const cleanupConnectivityListeners = () => {
    if (typeof window === 'undefined' || !hasConnectivityListeners) {
      return;
    }

    window.removeEventListener('online', handleBrowserOnline);
    window.removeEventListener('offline', handleBrowserOffline);
    hasConnectivityListeners = false;
  };

  const cleanupConnection = () => {
    isConnectingOrOpen.value = false;
    connectionStatus.value = 'CLOSED';
    closeConnection = null;

    if (stopUserLoggedInWatch) {
      stopUserLoggedInWatch();
      stopUserLoggedInWatch = null;
    }
    if (stopDataWatch) {
      stopDataWatch();
      stopDataWatch = null;
    }
    if (stopStatusWatch) {
      stopStatusWatch();
      stopStatusWatch = null;
    }
  };

  function handleBrowserOnline() {
    if (!userLoggedIn.value) {
      return;
    }

    debugLog('browser online: retrying websocket connection');
    window.setTimeout(() => {
      void webSocketHandler();
    }, 0);
  }

  function handleBrowserOffline() {
    debugLog('browser offline: closing websocket connection');
    closeConnection?.();
    cleanupConnection();
  }

  const ensureConnectivityListeners = () => {
    if (typeof window === 'undefined' || hasConnectivityListeners) {
      return;
    }

    window.addEventListener('online', handleBrowserOnline);
    window.addEventListener('offline', handleBrowserOffline);
    hasConnectivityListeners = true;
  };

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

  const handleMessage = (data: string) => {
    if (!data) return;
    lastMessageAt.value = new Date().toISOString();
    debugLog(`ws message: ${data}`);
    if (data === 'pong') return;
    try {
      const notification = JSON.parse(data) as INotification;
      assertNotificationShareFields(notification);
      getInvestRuntimeAdapters().notifications?.updateNotificationsData(data);
      if (notification.type === 'internal') handleInternalMessage(notification);
    } catch (e) {
      console.error('Failed to parse WebSocket message:', e);
    }
  };

  const webSocketHandler = async (): Promise<void> => {
    debugLog('webSocketHandler called');
    if (!userLoggedIn.value) {
      cleanupConnectivityListeners();
      return;
    }

    if (isConnectingOrOpen.value) {
      debugLog('webSocketHandler skipped: connection already active');
      return;
    }

    ensureConnectivityListeners();

    if (isBrowserOffline()) {
      debugLog('webSocketHandler skipped: browser offline');
      return;
    }

    const notificationUrl = appConfig.urls.api.notification;
    const url = `${notificationUrl}/ws`;
    // Support both http and https
    const uri = url.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');

    debugLog(`connection to ${uri}`);

    isConnectingOrOpen.value = true;

    const { data, close, status } = useWebSocket(uri, {
      autoClose: true,
      autoReconnect: {
        retries: () => userLoggedIn.value && !isBrowserOffline(),
        delay: (retries) => (
          Math.min(30_000, 1000 * (2 ** Math.min(retries, 5)))
          + Math.floor(Math.random() * 500)
        ),
        onFailed() {
          if (isBrowserOffline()) {
            debugLog('websocket reconnect retries exhausted while offline');
          }
        },
      },
      heartbeat: {
        message: '{"Command": "ping"}',
        interval: 60000,
        pongTimeout: 1000,
      },
    });
    closeConnection = close;

    stopUserLoggedInWatch = watch(userLoggedIn, () => {
      if (!userLoggedIn.value) {
        close();
        debugLog(`connection to ${uri} is closed`);
        cleanupConnection();
        cleanupConnectivityListeners();
      }
    });

    stopDataWatch = watch(
      () => data.value,
      (val) => {
        if (val) handleMessage(val);
      },
      { deep: true },
    );
    stopStatusWatch = watch(
      () => status.value,
      (nextStatus, previousStatus) => {
        debugLog(`websocket status: ${status.value}`);
        connectionStatus.value = nextStatus;
        if (nextStatus === 'OPEN' && previousStatus !== 'OPEN') {
          connectionGeneration.value += 1;
        }
      },
    );
  };

  const retryNow = async () => {
    if (!userLoggedIn.value || isBrowserOffline()) return;
    closeConnection?.();
    cleanupConnection();
    await webSocketHandler();
  };

  return {
    webSocketHandler,
    connectionStatus,
    connectionGeneration,
    lastMessageAt,
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
