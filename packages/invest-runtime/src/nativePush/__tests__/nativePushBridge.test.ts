/* @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ListenerCallback = (payload: any) => void;

const validNotification = {
  id: 101,
  user_id: 55,
  content: "Wallet balance changed",
  status: "unread",
  type: "wallet",
  created_at: "2026-03-31T14:03:32.739576+00:00",
  updated_at: "2026-03-31T14:03:32.739576+00:00",
  data: {
    obj: "wallet",
    object_id: 55,
    fields: {
      object_id: 55,
      profile: {
        id: 55,
      },
    },
  },
};

const hoisted = vi.hoisted(() => {
  const listeners: Record<string, ListenerCallback[]> = {};
  const listenerRemoveMocks: Array<ReturnType<typeof vi.fn>> = [];

  const addListenerMock = vi.fn(
    (eventName: string, callback: ListenerCallback) => {
      const eventListeners = listeners[eventName] ?? [];
      eventListeners.push(callback);
      listeners[eventName] = eventListeners;

      const remove = vi.fn(async () => {
        const listenerIndex = eventListeners.indexOf(callback);

        if (listenerIndex >= 0) {
          eventListeners.splice(listenerIndex, 1);
        }
      });
      listenerRemoveMocks.push(remove);

      return Promise.resolve({ remove });
    },
  );

  return {
    addListenerMock,
    appAddListenerMock: vi.fn(
      (eventName: string, callback: ListenerCallback) => {
        const eventListeners = listeners[eventName] ?? [];
        eventListeners.push(callback);
        listeners[eventName] = eventListeners;
        const remove = vi.fn(async () => undefined);
        listenerRemoveMocks.push(remove);
        return Promise.resolve({ remove });
      },
    ),
    checkPermissionsMock: vi.fn(() => Promise.resolve({ receive: "granted" })),
    createChannelMock: vi.fn(() => Promise.resolve()),
    deleteTokenMock: vi.fn(() => Promise.resolve()),
    getPlatformMock: vi.fn(() => "android"),
    getTokenMock: vi.fn(() => Promise.resolve({ token: "native-token-1" })),
    globalAlertShowMock: vi.fn(),
    isNativePlatformMock: vi.fn(() => true),
    isPluginAvailableMock: vi.fn(
      (pluginName: string) =>
        pluginName === "FirebaseMessaging" ||
        pluginName === "LocalNotifications",
    ),
    listenerRemoveMocks,
    listeners,
    localAddListenerMock: vi.fn(
      (eventName: string, callback: ListenerCallback) => {
        const eventListeners = listeners[eventName] ?? [];
        eventListeners.push(callback);
        listeners[eventName] = eventListeners;
        const remove = vi.fn(async () => undefined);
        listenerRemoveMocks.push(remove);
        return Promise.resolve({ remove });
      },
    ),
    localCreateChannelMock: vi.fn(() => Promise.resolve()),
    localScheduleMock: vi.fn(() => Promise.resolve({ notifications: [] })),
    reportErrorMock: vi.fn(),
    requestPermissionsMock: vi.fn(() =>
      Promise.resolve({ receive: "granted" }),
    ),
    subscribeDeviceMock: vi.fn(() => Promise.resolve()),
  };
});

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    getPlatform: hoisted.getPlatformMock,
    isNativePlatform: hoisted.isNativePlatformMock,
    isPluginAvailable: hoisted.isPluginAvailableMock,
  },
}));

vi.mock("@capacitor-firebase/messaging", () => ({
  FirebaseMessaging: {
    addListener: hoisted.addListenerMock,
    checkPermissions: hoisted.checkPermissionsMock,
    createChannel: hoisted.createChannelMock,
    deleteToken: hoisted.deleteTokenMock,
    getToken: hoisted.getTokenMock,
    requestPermissions: hoisted.requestPermissionsMock,
  },
  Importance: {
    High: 4,
  },
  Visibility: {
    Public: 1,
  },
}));

vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    addListener: hoisted.localAddListenerMock,
    createChannel: hoisted.localCreateChannelMock,
    schedule: hoisted.localScheduleMock,
  },
}));

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: hoisted.appAddListenerMock,
  },
}));

vi.mock("@global-torque/invest-runtime/error/errorReporting", () => ({
  reportError: hoisted.reportErrorMock,
}));

vi.mock('../../globalAlert/useGlobalAlert', () => ({
  useGlobalAlert: () => ({
    show: hoisted.globalAlertShowMock,
  }),
}));

// The real useCookies registers a universal-cookie change listener that polls
// document.cookie on an interval nothing in this test ever disposes; the
// leaked timer then fires after environment teardown and fails the run with
// an uncaught "document is not defined".
vi.mock("@vueuse/integrations/useCookies", () => ({
  useCookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
  }),
}));

function createStorage(): Storage {
  const items = new Map<string, string>();

  return {
    get length() {
      return items.size;
    },
    clear: () => {
      items.clear();
    },
    getItem: (key: string) => items.get(key) ?? null,
    key: (index: number) => Array.from(items.keys())[index] ?? null,
    removeItem: (key: string) => {
      items.delete(key);
    },
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
  };
}

let resetCurrentInvestmentConfig: (() => void) | null = null;
let cleanupCurrentBridge: (() => Promise<void>) | null = null;
let originalLocation: Location;

function resetMockState() {
  hoisted.reportErrorMock.mockClear();
  hoisted.globalAlertShowMock.mockClear();

  for (const eventName of Object.keys(hoisted.listeners)) {
    hoisted.listeners[eventName] = [];
  }

  hoisted.listenerRemoveMocks.length = 0;
  hoisted.addListenerMock.mockClear();
  hoisted.appAddListenerMock.mockClear();
  hoisted.checkPermissionsMock.mockClear();
  hoisted.createChannelMock.mockClear();
  hoisted.deleteTokenMock.mockClear();
  hoisted.getPlatformMock.mockClear();
  hoisted.getTokenMock.mockClear();
  hoisted.isNativePlatformMock.mockClear();
  hoisted.isPluginAvailableMock.mockClear();
  hoisted.localAddListenerMock.mockClear();
  hoisted.localCreateChannelMock.mockClear();
  hoisted.localScheduleMock.mockClear();
  hoisted.requestPermissionsMock.mockClear();
  hoisted.subscribeDeviceMock.mockReset();

  hoisted.checkPermissionsMock.mockResolvedValue({ receive: "granted" });
  hoisted.getPlatformMock.mockReturnValue("android");
  hoisted.getTokenMock.mockResolvedValue({ token: "native-token-1" });
  hoisted.isNativePlatformMock.mockReturnValue(true);
  hoisted.isPluginAvailableMock.mockImplementation(
    (pluginName: string) =>
      pluginName === "FirebaseMessaging" || pluginName === "LocalNotifications",
  );
  hoisted.requestPermissionsMock.mockResolvedValue({ receive: "granted" });
  hoisted.subscribeDeviceMock.mockResolvedValue();
}

async function importBridgeWithFreshConfig() {
  vi.resetModules();

  const pinia = await import("pinia");
  const runtimeAdapters =
    await import("@global-torque/invest-runtime/adapters");
  const runtimeConfig = await import("@global-torque/invest-runtime/config");
  const session = await import("@global-torque/invest-runtime/session");

  pinia.setActivePinia(pinia.createPinia());
  runtimeAdapters.resetInvestRuntimeAdaptersForTests();
  runtimeConfig.resetInvestRuntimeConfigForTests();
  setUserApiUrl(runtimeConfig);
  resetCurrentInvestmentConfig = () => {
    runtimeAdapters.resetInvestRuntimeAdaptersForTests();
    runtimeConfig.resetInvestRuntimeConfigForTests();
  };

  const bridge = await import("@global-torque/invest-runtime/native-push");
  bridge.installNativePushBridge({
    subscribeDevice: hoisted.subscribeDeviceMock,
  });
  cleanupCurrentBridge = async () => {
    await bridge.cleanupNativePushBridgeOnLogout();
    bridge.uninstallNativePushBridge();
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  session.useSessionStore().updateSession({
    active: true,
    expires_at: "2026-12-31T00:00:00.000Z",
    identity: {
      id: "user-1",
      traits: {},
    },
  } as never);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return {
    bridge,
    runtimeAdapters,
    runtimeConfig,
    session,
  };
}

function setUserApiUrl(
  runtimeConfig: typeof import("@global-torque/invest-runtime/config"),
) {
  runtimeConfig.setInvestRuntimeConfig({
    env: "test",
    isDev: true,
    isStaticSite: false,
    enableAnalytics: false,
    cookieDomain: "",
    urls: {
      frontend: "",
      dashboard: "",
      static: "",
      cryptoWalletScan: "",
      api: {
        user: "https://user.example.test",
      },
    },
    brand: {
      title: "Test",
      description: "Test",
    },
    thirdParty: {},
  });
}

describe("nativePushBridge", () => {
  beforeEach(() => {
    resetMockState();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: createStorage(),
    });
    originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        href: "https://www.torque.investments/dashboard",
        assign: vi.fn(),
      },
    });
  });

  afterEach(async () => {
    await cleanupCurrentBridge?.();
    cleanupCurrentBridge = null;
    resetCurrentInvestmentConfig?.();
    resetCurrentInvestmentConfig = null;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("uses the configured SDK subscription callback for the Firebase Messaging token", async () => {
    const { bridge, runtimeConfig } = await importBridgeWithFreshConfig();
    setUserApiUrl(runtimeConfig);

    const result = await bridge.requestNativePushPermissionConsent();

    expect(result).toBe("registered");
    expect(hoisted.getTokenMock).toHaveBeenCalledTimes(1);
    expect(hoisted.subscribeDeviceMock).toHaveBeenCalledOnce();
    expect(hoisted.subscribeDeviceMock).toHaveBeenCalledWith("native-token-1");
    expect(hoisted.createChannelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "invest-pro-default",
      }),
    );
    expect(hoisted.localCreateChannelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "invest-pro-default",
      }),
    );
    expect(hoisted.reportErrorMock).not.toHaveBeenCalled();
  });

  it("stops before token retrieval when requested OS permission is denied", async () => {
    const { bridge, runtimeConfig } = await importBridgeWithFreshConfig();
    setUserApiUrl(runtimeConfig);
    hoisted.checkPermissionsMock.mockResolvedValue({ receive: "prompt" });
    hoisted.requestPermissionsMock.mockResolvedValue({ receive: "denied" });

    const result = await bridge.requestNativePushPermissionConsent();

    expect(result).toBe("permission-not-granted");
    expect(hoisted.requestPermissionsMock).toHaveBeenCalledTimes(1);
    expect(hoisted.getTokenMock).not.toHaveBeenCalled();
    expect(hoisted.subscribeDeviceMock).not.toHaveBeenCalled();
  });

  it("no-ops in unsupported browser sessions", async () => {
    const { bridge, runtimeConfig } = await importBridgeWithFreshConfig();
    setUserApiUrl(runtimeConfig);
    hoisted.isNativePlatformMock.mockReturnValue(false);
    hoisted.getPlatformMock.mockReturnValue("web");

    const result = await bridge.requestNativePushPermissionConsent();

    expect(result).toBe("not-eligible");
    expect(hoisted.requestPermissionsMock).not.toHaveBeenCalled();
    expect(hoisted.getTokenMock).not.toHaveBeenCalled();
    expect(hoisted.subscribeDeviceMock).not.toHaveBeenCalled();
  });

  it("no-ops before an authenticated session is hydrated", async () => {
    const { bridge, runtimeConfig, session } =
      await importBridgeWithFreshConfig();
    setUserApiUrl(runtimeConfig);
    session.useSessionStore().resetAll();

    const result = await bridge.requestNativePushPermissionConsent();

    expect(result).toBe("not-authenticated");
    expect(hoisted.requestPermissionsMock).not.toHaveBeenCalled();
    expect(hoisted.getTokenMock).not.toHaveBeenCalled();
    expect(hoisted.subscribeDeviceMock).not.toHaveBeenCalled();
  });

  it("reports token retrieval failures and allows a later retry", async () => {
    const { bridge, runtimeConfig } = await importBridgeWithFreshConfig();
    setUserApiUrl(runtimeConfig);
    hoisted.getTokenMock
      .mockRejectedValueOnce(new Error("FCM token unavailable"))
      .mockResolvedValueOnce({ token: "native-token-1" });

    await expect(bridge.requestNativePushPermissionConsent()).resolves.toBe(
      "permission-not-granted",
    );

    expect(hoisted.reportErrorMock).toHaveBeenCalledWith(
      expect.any(Error),
      "Failed to enable push notifications",
      expect.objectContaining({ source: "nativePush" }),
    );
    expect(hoisted.subscribeDeviceMock).not.toHaveBeenCalled();

    await expect(bridge.requestNativePushPermissionConsent()).resolves.toBe(
      "registered",
    );
    expect(hoisted.subscribeDeviceMock).toHaveBeenCalledTimes(1);
  });

  it("reports backend subscription failures and retries unsynced tokens later", async () => {
    const { bridge, runtimeConfig } = await importBridgeWithFreshConfig();
    setUserApiUrl(runtimeConfig);
    hoisted.subscribeDeviceMock
      .mockRejectedValueOnce(new Error("subscription failed"))
      .mockResolvedValueOnce();

    await expect(bridge.requestNativePushPermissionConsent()).resolves.toBe(
      "registered",
    );

    expect(hoisted.reportErrorMock).toHaveBeenCalledWith(
      expect.any(Error),
      "Failed to subscribe this device for push notifications",
      expect.objectContaining({ source: "nativePush" }),
    );

    await expect(bridge.requestNativePushPermissionConsent()).resolves.toBe(
      "registered",
    );
    expect(hoisted.subscribeDeviceMock).toHaveBeenCalledTimes(2);
  });

  it("rechecks permission and token state on active app resume", async () => {
    const { bridge, runtimeConfig } = await importBridgeWithFreshConfig();
    setUserApiUrl(runtimeConfig);

    await bridge.requestNativePushPermissionConsent();
    expect(hoisted.subscribeDeviceMock).toHaveBeenCalledTimes(1);

    hoisted.getTokenMock.mockResolvedValue({ token: "native-token-2" });
    hoisted.listeners.appStateChange?.[0]?.({ isActive: true });

    await vi.waitFor(() => {
      expect(hoisted.subscribeDeviceMock).toHaveBeenCalledTimes(2);
    });
    expect(hoisted.subscribeDeviceMock).toHaveBeenLastCalledWith(
      "native-token-2",
    );
  });

  it("shows the explainer again after a deferred dismissal", async () => {
    const { bridge, runtimeConfig } = await importBridgeWithFreshConfig();
    setUserApiUrl(runtimeConfig);
    hoisted.checkPermissionsMock.mockResolvedValue({ receive: "prompt" });

    bridge.deferNativePushExplainer();

    await expect(bridge.shouldShowNativePushExplainer()).resolves.toBe(true);
  });

  it("resubscribes changed tokens from tokenReceived without duplicating synced tuples", async () => {
    const { bridge, runtimeConfig } = await importBridgeWithFreshConfig();
    setUserApiUrl(runtimeConfig);

    await bridge.requestNativePushPermissionConsent();

    expect(hoisted.subscribeDeviceMock).toHaveBeenCalledTimes(1);

    hoisted.listeners.tokenReceived?.[0]?.({ token: "native-token-2" });

    await vi.waitFor(() => {
      expect(hoisted.subscribeDeviceMock).toHaveBeenCalledTimes(2);
    });

    hoisted.listeners.tokenReceived?.[0]?.({ token: "native-token-2" });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(hoisted.subscribeDeviceMock).toHaveBeenCalledTimes(2);
    expect(hoisted.subscribeDeviceMock).toHaveBeenLastCalledWith(
      "native-token-2",
    );
  });

  it("hydrates full foreground payloads and schedules Android foreground display", async () => {
    const { bridge, runtimeAdapters, runtimeConfig } =
      await importBridgeWithFreshConfig();
    setUserApiUrl(runtimeConfig);
    const updateNotificationsData = vi.fn();
    const refreshNotifications = vi.fn();
    runtimeAdapters.configureInvestRuntimeAdapters({
      notifications: {
        updateNotificationsData,
        refreshNotifications,
        formatNotificationHref: () => "/dashboard/profile/55/wallet",
        fallbackHref: () => "/dashboard/notifications",
      },
    });
    await bridge.requestNativePushPermissionConsent();

    hoisted.listeners.notificationReceived?.[0]?.({
      notification: {
        id: "foreground-1",
        title: "Wallet update",
        body: "Wallet balance changed",
        data: {
          notification: JSON.stringify(validNotification),
        },
      },
    });

    await vi.waitFor(() => {
      expect(updateNotificationsData).toHaveBeenCalledTimes(1);
      expect(hoisted.localScheduleMock).toHaveBeenCalledTimes(1);
    });
    expect(refreshNotifications).not.toHaveBeenCalled();
    expect(hoisted.localScheduleMock.mock.calls[0]?.[0]).toMatchObject({
      notifications: [
        {
          title: "Wallet update",
          body: "Wallet balance changed",
          channelId: "invest-pro-default",
          smallIcon: "push_notification_icon",
        },
      ],
    });
  });

  it("refreshes notifications and schedules safe fallback text for partial foreground payloads", async () => {
    const { bridge, runtimeAdapters, runtimeConfig } =
      await importBridgeWithFreshConfig();
    setUserApiUrl(runtimeConfig);
    const updateNotificationsData = vi.fn();
    const refreshNotifications = vi.fn();
    runtimeAdapters.configureInvestRuntimeAdapters({
      notifications: {
        updateNotificationsData,
        refreshNotifications,
        formatNotificationHref: () => "/dashboard/profile/55/wallet",
        fallbackHref: () => "/dashboard/notifications",
      },
    });
    await bridge.requestNativePushPermissionConsent();

    hoisted.listeners.notificationReceived?.[0]?.({
      notification: {
        id: "foreground-partial",
        data: {
          id: "partial-only",
        },
      },
    });

    await vi.waitFor(() => {
      expect(refreshNotifications).toHaveBeenCalledTimes(1);
      expect(hoisted.localScheduleMock).toHaveBeenCalledTimes(1);
    });
    expect(updateNotificationsData).not.toHaveBeenCalled();
    expect(hoisted.localScheduleMock.mock.calls[0]?.[0]).toMatchObject({
      notifications: [
        {
          title: "Test update",
          body: "Open Test to view the latest update.",
          channelId: "invest-pro-default",
        },
      ],
    });
  });

  it("updates iOS foreground in-app state without Android local display", async () => {
    const { bridge, runtimeAdapters, runtimeConfig } =
      await importBridgeWithFreshConfig();
    setUserApiUrl(runtimeConfig);
    hoisted.getPlatformMock.mockReturnValue("ios");
    const updateNotificationsData = vi.fn();
    const refreshNotifications = vi.fn();
    runtimeAdapters.configureInvestRuntimeAdapters({
      notifications: {
        updateNotificationsData,
        refreshNotifications,
        formatNotificationHref: () => "/dashboard/profile/55/wallet",
        fallbackHref: () => "/dashboard/notifications",
      },
    });
    await bridge.requestNativePushPermissionConsent();

    hoisted.listeners.notificationReceived?.[0]?.({
      notification: {
        id: "ios-foreground-1",
        title: "Wallet update",
        body: "Wallet balance changed",
        data: {
          notification: JSON.stringify(validNotification),
        },
      },
    });

    await vi.waitFor(() => {
      expect(updateNotificationsData).toHaveBeenCalledTimes(1);
    });
    expect(refreshNotifications).not.toHaveBeenCalled();
    expect(hoisted.localScheduleMock).not.toHaveBeenCalled();
  });

  it("routes notification taps through the configured dashboard destination", async () => {
    const { bridge, runtimeAdapters, runtimeConfig } =
      await importBridgeWithFreshConfig();
    setUserApiUrl(runtimeConfig);
    runtimeAdapters.configureInvestRuntimeAdapters({
      notifications: {
        updateNotificationsData: vi.fn(),
        refreshNotifications: vi.fn(),
        formatNotificationHref: () => "/dashboard/profile/55/wallet",
        fallbackHref: () => "/dashboard/notifications",
      },
    });
    await bridge.requestNativePushPermissionConsent();

    hoisted.listeners.notificationActionPerformed?.[0]?.({
      notification: {
        id: "tap-1",
        data: {
          notification: JSON.stringify(validNotification),
        },
      },
    });

    expect(window.location.assign).toHaveBeenCalledWith(
      "/dashboard/profile/55/wallet",
    );
  });

  it("routes Android foreground local-notification taps through the embedded Firebase payload", async () => {
    const { bridge, runtimeAdapters, runtimeConfig } =
      await importBridgeWithFreshConfig();
    setUserApiUrl(runtimeConfig);
    runtimeAdapters.configureInvestRuntimeAdapters({
      notifications: {
        updateNotificationsData: vi.fn(),
        refreshNotifications: vi.fn(),
        formatNotificationHref: () => "/dashboard/profile/55/wallet",
        fallbackHref: () => "/dashboard/notifications",
      },
    });
    await bridge.requestNativePushPermissionConsent();

    hoisted.listeners.notificationReceived?.[0]?.({
      notification: {
        id: "foreground-local-tap",
        title: "Wallet update",
        body: "Wallet balance changed",
        data: {
          notification: JSON.stringify(validNotification),
        },
      },
    });

    await vi.waitFor(() => {
      expect(hoisted.localScheduleMock).toHaveBeenCalledTimes(1);
    });

    hoisted.listeners.localNotificationActionPerformed?.[0]?.({
      actionId: "tap",
      notification:
        hoisted.localScheduleMock.mock.calls[0]?.[0].notifications[0],
    });

    expect(window.location.assign).toHaveBeenCalledWith(
      "/dashboard/profile/55/wallet",
    );
  });

  it("routes Android foreground local-notification taps to notifications fallback when embedded payload is missing", async () => {
    const { bridge, runtimeAdapters, runtimeConfig } =
      await importBridgeWithFreshConfig();
    setUserApiUrl(runtimeConfig);
    runtimeAdapters.configureInvestRuntimeAdapters({
      notifications: {
        updateNotificationsData: vi.fn(),
        refreshNotifications: vi.fn(),
        formatNotificationHref: () => "/dashboard/profile/55/wallet",
        fallbackHref: () => "/dashboard/notifications",
      },
    });
    await bridge.requestNativePushPermissionConsent();

    hoisted.listeners.localNotificationActionPerformed?.[0]?.({
      actionId: "tap",
      notification: {
        id: 1,
        title: "Global Torque update",
        body: "Open Global Torque.",
      },
    });

    expect(window.location.assign).toHaveBeenCalledWith(
      "/dashboard/notifications",
    );
  });

  it("preserves cold-start notification taps until authenticated route readiness", async () => {
    const { bridge, runtimeAdapters, runtimeConfig, session } =
      await importBridgeWithFreshConfig();
    setUserApiUrl(runtimeConfig);
    runtimeAdapters.configureInvestRuntimeAdapters({
      notifications: {
        updateNotificationsData: vi.fn(),
        refreshNotifications: vi.fn(),
        formatNotificationHref: () => "/dashboard/profile/55/wallet",
        fallbackHref: () => "/dashboard/notifications",
      },
    });
    await bridge.requestNativePushPermissionConsent();
    session.useSessionStore().resetAll();

    hoisted.listeners.notificationActionPerformed?.[0]?.({
      notification: {
        id: "cold-start-tap-1",
        data: {
          notification: JSON.stringify(validNotification),
        },
      },
    });

    expect(window.location.assign).not.toHaveBeenCalled();

    session.useSessionStore().updateSession({
      active: true,
      expires_at: "2026-12-31T00:00:00.000Z",
      identity: {
        id: "user-1",
        traits: {},
      },
    } as never);
    bridge.uninstallNativePushBridge();
    await new Promise((resolve) => setTimeout(resolve, 0));
    bridge.installNativePushBridge({
      subscribeDevice: hoisted.subscribeDeviceMock,
    });

    await vi.waitFor(() => {
      expect(window.location.assign).toHaveBeenCalledWith(
        "/dashboard/profile/55/wallet",
      );
    });
  });

  it("deletes the Firebase Messaging token and removes listeners on logout cleanup", async () => {
    const { bridge, runtimeConfig } = await importBridgeWithFreshConfig();
    setUserApiUrl(runtimeConfig);
    await bridge.requestNativePushPermissionConsent();

    await bridge.cleanupNativePushBridgeOnLogout();

    expect(hoisted.deleteTokenMock).toHaveBeenCalledTimes(1);
    expect(hoisted.listenerRemoveMocks.length).toBeGreaterThanOrEqual(4);
    expect(
      hoisted.listenerRemoveMocks.map((remove) => remove.mock.calls.length),
    ).toEqual(hoisted.listenerRemoveMocks.map(() => 1));
  });
});
