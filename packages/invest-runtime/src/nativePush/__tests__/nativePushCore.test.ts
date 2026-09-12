import { describe, expect, it } from 'vitest';
import {
  clearNativePushTokenSyncState,
  getNativePushPlatform,
  getForegroundPushHandling,
  hasSyncedNativePushToken,
  isAndroidCapacitorRuntime,
  isNativePushCapacitorRuntime,
  markNativePushTokenSynced,
  NATIVE_PUSH_NOTIFICATIONS_FALLBACK_PATH,
  parseNativePushNotificationPayload,
  persistExplainerDecision,
  persistPermissionDecision,
  readExplainerDecision,
  readPermissionDecision,
  resolveNativePushDestination,
  resolveNativePushFlowAction,
  shouldSubscribeNativePushToken,
} from '../nativePushCore.ts';

function createStorage() {
  const items = new Map<string, string>();

  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
    removeItem: (key: string) => {
      items.delete(key);
    },
  };
}

const validNotification = {
  id: 101,
  user_id: 55,
  content: 'Wallet balance changed',
  status: 'unread',
  type: 'wallet',
  created_at: '2026-03-31T14:03:32.739576+00:00',
  updated_at: '2026-03-31T14:03:32.739576+00:00',
  data: {
    obj: 'wallet',
    object_id: 55,
    fields: {
      object_id: 55,
      profile: {
        id: 55,
      },
    },
  },
};

describe('nativePushCore', () => {
  it('detects Android and iOS Capacitor runtime as native push eligible', () => {
    expect(isAndroidCapacitorRuntime({
      isNativePlatform: true,
      platform: 'android',
      isMessagingPluginAvailable: true,
    })).toBe(true);

    expect(isNativePushCapacitorRuntime({
      isNativePlatform: true,
      platform: 'android',
      isMessagingPluginAvailable: true,
    })).toBe(true);
    expect(getNativePushPlatform({
      isNativePlatform: true,
      platform: 'android',
      isMessagingPluginAvailable: true,
    })).toBe('android');

    expect(isNativePushCapacitorRuntime({
      isNativePlatform: true,
      platform: 'ios',
      isMessagingPluginAvailable: true,
    })).toBe(true);
    expect(getNativePushPlatform({
      isNativePlatform: true,
      platform: 'ios',
      isMessagingPluginAvailable: true,
    })).toBe('ios');

    expect(isAndroidCapacitorRuntime({
      isNativePlatform: false,
      platform: 'web',
      isMessagingPluginAvailable: true,
    })).toBe(false);

    expect(isNativePushCapacitorRuntime({
      isNativePlatform: false,
      platform: 'web',
      isMessagingPluginAvailable: true,
    })).toBe(false);

    expect(isNativePushCapacitorRuntime({
      isNativePlatform: true,
      platform: 'android',
      isMessagingPluginAvailable: false,
    })).toBe(false);
  });

  it('resolves consent and permission flow transitions', () => {
    expect(resolveNativePushFlowAction({
      isEligible: false,
      isAuthenticated: true,
    })).toBe('noop');

    expect(resolveNativePushFlowAction({
      isEligible: true,
      isAuthenticated: false,
    })).toBe('noop');

    expect(resolveNativePushFlowAction({
      isEligible: true,
      isAuthenticated: true,
    })).toBe('show-explainer');

    expect(resolveNativePushFlowAction({
      isEligible: true,
      isAuthenticated: true,
      explainerDecision: 'deferred',
    })).toBe('show-explainer');

    expect(resolveNativePushFlowAction({
      isEligible: true,
      isAuthenticated: true,
      explainerDecision: 'rejected',
    })).toBe('noop');

    expect(resolveNativePushFlowAction({
      isEligible: true,
      isAuthenticated: true,
      explainerDecision: 'accepted',
    })).toBe('request-permission');

    expect(resolveNativePushFlowAction({
      isEligible: true,
      isAuthenticated: true,
      explainerDecision: 'accepted',
      permissionDecision: 'denied',
    })).toBe('noop');

    expect(resolveNativePushFlowAction({
      isEligible: true,
      isAuthenticated: true,
      explainerDecision: 'accepted',
      permissionDecision: 'granted',
    })).toBe('register');
  });

  it('persists explainer and permission decisions separately', () => {
    const storage = createStorage();

    expect(readExplainerDecision(storage)).toBeNull();
    expect(readPermissionDecision(storage)).toBeNull();

    persistExplainerDecision(storage, 'deferred');
    persistPermissionDecision(storage, 'denied');

    expect(readExplainerDecision(storage)).toBe('deferred');
    expect(readPermissionDecision(storage)).toBe('denied');
  });

  it('deduplicates token subscription by authenticated user, platform, and token', () => {
    const storage = createStorage();

    expect(shouldSubscribeNativePushToken(storage, 'user-1', 'android', 'token-1')).toBe(true);
    expect(hasSyncedNativePushToken(storage, 'user-1', 'android', 'token-1')).toBe(false);

    markNativePushTokenSynced(storage, 'user-1', 'android', 'token-1', '2026-04-15T00:00:00.000Z');

    expect(hasSyncedNativePushToken(storage, 'user-1', 'android', 'token-1')).toBe(true);
    expect(shouldSubscribeNativePushToken(storage, 'user-1', 'android', 'token-1')).toBe(false);
    expect(shouldSubscribeNativePushToken(storage, 'user-1', 'ios', 'token-1')).toBe(true);
    expect(shouldSubscribeNativePushToken(storage, 'user-1', 'android', 'token-2')).toBe(true);
    expect(shouldSubscribeNativePushToken(storage, 'user-2', 'android', 'token-1')).toBe(true);

    clearNativePushTokenSyncState(storage);

    expect(shouldSubscribeNativePushToken(storage, 'user-1', 'android', 'token-1')).toBe(true);
  });

  it('keeps retry open until a token is marked as synced', () => {
    const storage = createStorage();

    expect(shouldSubscribeNativePushToken(storage, 'user-1', 'android', 'token-1')).toBe(true);
    expect(shouldSubscribeNativePushToken(storage, 'user-1', 'android', 'token-1')).toBe(true);
  });

  it('parses a valid full notification payload', () => {
    const result = parseNativePushNotificationPayload(validNotification);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.notification).toMatchObject({
        id: 101,
        user_id: 55,
        type: 'wallet',
        data: {
          obj: 'wallet',
          object_id: 55,
          fields: {
            type: 'wallet',
          },
        },
      });
    }
  });

  it('parses a stringified notification nested in Capacitor data', () => {
    const result = parseNativePushNotificationPayload({
      id: 'native-id',
      data: {
        notification: JSON.stringify(validNotification),
      },
    });

    expect(result.ok).toBe(true);
  });

  it('parses a notification with stringified nested data from FCM data values', () => {
    const result = parseNativePushNotificationPayload({
      data: {
        notificationPayload: JSON.stringify({
          ...validNotification,
          data: JSON.stringify(validNotification.data),
        }),
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.notification.data.fields).toMatchObject({
        object_id: 55,
        type: 'wallet',
      });
    }
  });

  it('parses a flattened full notification object from FCM data values', () => {
    const result = parseNativePushNotificationPayload({
      data: {
        id: '101',
        user_id: '55',
        content: 'Wallet balance changed',
        status: 'unread',
        type: 'wallet',
        created_at: '2026-03-31T14:03:32.739576+00:00',
        updated_at: '2026-03-31T14:03:32.739576+00:00',
        obj: 'wallet',
        object_id: '55',
        fields: JSON.stringify({
          object_id: 55,
          profile: {
            id: 55,
          },
        }),
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.notification).toMatchObject({
        id: 101,
        user_id: 55,
        data: {
          obj: 'wallet',
          object_id: 55,
        },
      });
    }
  });

  it('rejects partial payloads and selects foreground refresh behavior', () => {
    const result = parseNativePushNotificationPayload({
      data: {
        id: 101,
        type: 'wallet',
      },
    });

    expect(result.ok).toBe(false);
    expect(getForegroundPushHandling(result)).toBe('refresh');
  });

  it('selects direct hydration for valid foreground payloads', () => {
    const result = parseNativePushNotificationPayload(validNotification);

    expect(getForegroundPushHandling(result)).toBe('hydrate');
  });

  it('uses the notifications fallback when tap route resolution has no destination', () => {
    expect(resolveNativePushDestination('', NATIVE_PUSH_NOTIFICATIONS_FALLBACK_PATH))
      .toBe('/dashboard/notifications');

    expect(resolveNativePushDestination('https://www.webdevelop.biz/dashboard/profile/55/wallet'))
      .toBe('https://www.webdevelop.biz/dashboard/profile/55/wallet');
  });
});
