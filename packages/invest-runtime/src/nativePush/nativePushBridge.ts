import type { PluginListenerHandle } from "@capacitor/core";
import type {
  FirebaseMessagingPlugin,
  Notification as FirebaseNotification,
  NotificationActionPerformedEvent,
} from "@capacitor-firebase/messaging";
import type {
  ActionPerformed as LocalNotificationActionPerformed,
  LocalNotificationsPlugin,
} from "@capacitor/local-notifications";
import { watch, type WatchStopHandle } from "vue";
import { storeToRefs } from "pinia";
import { getInvestRuntimeAdapters } from "../adapters.ts";
import { getInvestRuntimeConfig } from "../config.ts";
import { useSessionStore } from "../session/store/useSession.ts";
import { reportError } from "../error/errorReporting.ts";
import { useGlobalAlert } from '../globalAlert/useGlobalAlert';
import {
  clearNativePushTokenSyncState,
  createNativePushTokenSyncKey,
  getForegroundPushHandling,
  getNativePushPlatform,
  markNativePushTokenSynced,
  NATIVE_PUSH_DEFAULT_CHANNEL_ID,
  NATIVE_PUSH_NOTIFICATIONS_FALLBACK_PATH,
  parseNativePushNotificationPayload,
  persistCurrentNativePushToken,
  persistExplainerDecision,
  persistNativePushTokenRefresh,
  persistPermissionDecision,
  readExplainerDecision,
  readPermissionDecision,
  resolveNativePushDestination,
  shouldSubscribeNativePushToken,
  type NativePushPlatform,
  type NativePushPayloadParseResult,
} from "./nativePushCore.ts";

type NativePushModules = {
  FirebaseMessaging: FirebaseMessagingPlugin;
  LocalNotifications?: LocalNotificationsPlugin;
  platform: NativePushPlatform;
};

type NativePushRegistrationMode = "silent" | "user-consent";

type NativePushRegistrationResult =
  | "registered"
  | "already-in-flight"
  | "not-eligible"
  | "not-authenticated"
  | "no-storage"
  | "explainer-not-accepted"
  | "permission-not-granted";

type NativePushWindow = Window & {
  InvestNativePush?: {
    requestPermission: () => Promise<NativePushRegistrationResult>;
    shouldShowPermissionButton: () => Promise<boolean>;
  };
};

export type NativePushBridgeOptions = {
  subscribeDevice?: (token: string) => Promise<void>;
};

export type AndroidNativePushBridgeOptions = NativePushBridgeOptions;

const REQUEST_NATIVE_PUSH_PERMISSION_EVENT =
  "invest:native-push:request-permission";
export const NATIVE_PUSH_AUTH_SUCCESS_EVENT = "invest:native-push:auth-success";
const ANDROID_NOTIFICATION_IMPORTANCE_HIGH = 4 as const;
const ANDROID_NOTIFICATION_VISIBILITY_PUBLIC = 1 as const;

let nativePushBridgeOptions: NativePushBridgeOptions = {};
let isBridgeInstalled = false;
let isRegistrationInFlight = false;
let stopSessionWatch: WatchStopHandle | null = null;
let listenerHandles: PluginListenerHandle[] = [];
let appStateListenerHandle: PluginListenerHandle | null = null;
let registeredUserId = "";
let registeredPlatform: NativePushPlatform | null = null;
let isWindowEntrypointInstalled = false;
let pendingPushTapHref = "";
const tokenSyncRequests = new Map<string, Promise<void>>();

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function getNotificationsFallbackHref() {
  const notifications = getInvestRuntimeAdapters().notifications;

  return resolveNativePushDestination(
    notifications?.fallbackHref() ?? "",
    NATIVE_PUSH_NOTIFICATIONS_FALLBACK_PATH,
  );
}

function parseRecordCandidate(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      const parsedValue = JSON.parse(value);
      return parseRecordCandidate(parsedValue);
    } catch {
      return null;
    }
  }

  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function loadNativePushModules(): Promise<NativePushModules | null> {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const [{ Capacitor }, { FirebaseMessaging }] = await Promise.all([
      import("@capacitor/core"),
      import("@capacitor-firebase/messaging"),
    ]);

    const platform = getNativePushPlatform({
      isNativePlatform: Capacitor.isNativePlatform(),
      platform: Capacitor.getPlatform(),
      isMessagingPluginAvailable:
        Capacitor.isPluginAvailable("FirebaseMessaging"),
    });

    if (!platform) {
      return null;
    }

    let LocalNotifications: LocalNotificationsPlugin | undefined;

    if (
      platform === "android" &&
      Capacitor.isPluginAvailable("LocalNotifications")
    ) {
      try {
        ({ LocalNotifications } =
          await import("@capacitor/local-notifications"));
      } catch {
        LocalNotifications = undefined;
      }
    }

    return {
      FirebaseMessaging,
      LocalNotifications,
      platform,
    };
  } catch {
    return null;
  }
}

async function subscribeFcmTokenWithPwaSession(token: string) {
  if (!nativePushBridgeOptions.subscribeDevice) {
    throw new Error("Native push device subscription is not configured.");
  }
  await nativePushBridgeOptions.subscribeDevice(token);
}

async function syncNativePushToken(
  token: string,
  userId = registeredUserId,
  platform = registeredPlatform,
) {
  const storage = getBrowserStorage();

  if (!storage || !userId || !platform || !token) {
    return;
  }

  if (!shouldSubscribeNativePushToken(storage, userId, platform, token)) {
    return;
  }

  const syncKey = createNativePushTokenSyncKey(userId, platform, token);
  const existingRequest = tokenSyncRequests.get(syncKey);

  if (existingRequest) {
    await existingRequest;
    return;
  }

  const syncRequest = subscribeFcmTokenWithPwaSession(token)
    .then(() => {
      markNativePushTokenSynced(storage, userId, platform, token);
    })
    .finally(() => {
      tokenSyncRequests.delete(syncKey);
    });

  tokenSyncRequests.set(syncKey, syncRequest);
  await syncRequest;
}

function showNativePushSetupError(message: string) {
  try {
    const globalAlert = useGlobalAlert();
    globalAlert.show({
      variant: "error",
      title: "Push notifications unavailable",
      message,
    });
  } catch {
    // Error reporting already records the failure; the alert store may be unavailable in tests.
  }
}

function reportNativePushSetupError(error: unknown, fallbackMessage: string) {
  reportError(error, fallbackMessage, { source: "nativePush", silent: true });
  showNativePushSetupError(
    `${fallbackMessage}. Please check the Firebase configuration and try enabling notifications again.`,
  );
}

async function createDefaultChannel(nativeModules: NativePushModules) {
  if (nativeModules.platform !== "android") {
    return;
  }

  const channel = {
    id: NATIVE_PUSH_DEFAULT_CHANNEL_ID,
    name: getInvestRuntimeConfig().brand.title,
    description: "Account, offering, wallet, and platform updates",
    importance: ANDROID_NOTIFICATION_IMPORTANCE_HIGH,
    visibility: ANDROID_NOTIFICATION_VISIBILITY_PUBLIC,
  };

  try {
    await nativeModules.FirebaseMessaging.createChannel(channel);
  } catch {
    // Channel creation is Android-only and recoverable.
  }

  try {
    await nativeModules.LocalNotifications?.createChannel(channel);
  } catch {
    // Local notification foreground display can still attempt scheduling on the default channel.
  }
}

function getAuthenticatedUserId(): string {
  const sessionStore = useSessionStore();
  const session = sessionStore.userSession;

  if (!sessionStore.isSessionHydrated || !sessionStore.userLoggedIn) {
    return "";
  }

  return session?.identity?.id || session?.id || "";
}

function hashNotificationId(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash || Date.now()) % 2147483647;
}

function createLocalNotificationId(notification: FirebaseNotification): number {
  return hashNotificationId(
    notification.id ??
      notification.tag ??
      notification.link ??
      JSON.stringify(notification.data ?? {}) ??
      String(Date.now()),
  );
}

function getSafeForegroundText(
  notification: FirebaseNotification,
  parseResult: NativePushPayloadParseResult,
) {
  return {
    title: notification.title?.trim() || `${getInvestRuntimeConfig().brand.title} update`,
    body:
      notification.body?.trim() ||
      (parseResult.ok ? parseResult.notification.content : "") ||
      `Open ${getInvestRuntimeConfig().brand.title} to view the latest update.`,
  };
}

async function showAndroidForegroundNotification(
  notification: FirebaseNotification,
  parseResult: NativePushPayloadParseResult,
  LocalNotifications?: LocalNotificationsPlugin,
) {
  if (!LocalNotifications) {
    return;
  }

  const { title, body } = getSafeForegroundText(notification, parseResult);

  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: createLocalNotificationId(notification),
          title,
          body,
          largeBody: body,
          channelId: NATIVE_PUSH_DEFAULT_CHANNEL_ID,
          smallIcon: "push_notification_icon",
          iconColor: "#b99b62",
          autoCancel: true,
          extra: {
            firebaseMessagingNotification: notification,
          },
        },
      ],
    });
  } catch (error) {
    reportError(error, "Failed to display foreground push notification", {
      source: "nativePush",
    });
  }
}

async function handleForegroundPush(
  notification: FirebaseNotification,
  nativeModules: NativePushModules,
) {
  const parseResult = parseNativePushNotificationPayload(notification);
  const notifications = getInvestRuntimeAdapters().notifications;

  if (
    getForegroundPushHandling(parseResult) === "hydrate" &&
    parseResult.ok &&
    notifications
  ) {
    try {
      notifications.updateNotificationsData(
        JSON.stringify(parseResult.notification),
      );
    } catch (error) {
      reportError(error, "Failed to update notifications from push", {
        source: "nativePush",
      });
    }
  } else {
    try {
      await notifications?.refreshNotifications();
    } catch (error) {
      reportError(error, "Failed to refresh notifications from push", {
        source: "nativePush",
      });
    }
  }

  if (nativeModules.platform === "android") {
    await showAndroidForegroundNotification(
      notification,
      parseResult,
      nativeModules.LocalNotifications,
    );
  }
}

function resolveTapDestination(notification: FirebaseNotification): string {
  const parseResult = parseNativePushNotificationPayload(notification);
  const fallback = getNotificationsFallbackHref();

  if (!parseResult.ok) {
    return fallback;
  }

  try {
    return resolveNativePushDestination(
      getInvestRuntimeAdapters().notifications?.formatNotificationHref(
        parseResult.notification,
      ) ?? "",
      fallback,
    );
  } catch {
    return fallback;
  }
}

function routePushTapDestination(destination: string) {
  if (typeof window === "undefined") {
    return;
  }

  if (!getAuthenticatedUserId()) {
    pendingPushTapHref = destination;
    return;
  }

  window.location.assign(destination);
}

function handleFirebasePushTap(notification: FirebaseNotification) {
  routePushTapDestination(resolveTapDestination(notification));
}

function handlePushTap(action: NotificationActionPerformedEvent) {
  handleFirebasePushTap(action.notification);
}

function getFirebaseNotificationFromLocalAction(
  action: LocalNotificationActionPerformed,
): FirebaseNotification | null {
  const extra = parseRecordCandidate(action.notification.extra);
  const firebaseNotification = extra
    ? parseRecordCandidate(extra.firebaseMessagingNotification)
    : null;

  return firebaseNotification as FirebaseNotification | null;
}

function handleLocalNotificationTap(action: LocalNotificationActionPerformed) {
  const notification = getFirebaseNotificationFromLocalAction(action);

  if (!notification) {
    routePushTapDestination(getNotificationsFallbackHref());
    return;
  }

  handleFirebasePushTap(notification);
}

function flushPendingPushTapDestination() {
  if (
    !pendingPushTapHref ||
    typeof window === "undefined" ||
    !getAuthenticatedUserId()
  ) {
    return;
  }

  const destination = pendingPushTapHref;
  pendingPushTapHref = "";
  window.location.assign(destination);
}

async function ensureNativePushListeners(nativeModules: NativePushModules) {
  if (listenerHandles.length > 0) {
    return;
  }

  const listenerPromises = [
    nativeModules.FirebaseMessaging.addListener("tokenReceived", (event) => {
      const storage = getBrowserStorage();
      const userId = registeredUserId;
      const platform = registeredPlatform;

      if (storage && userId && platform && event.token) {
        persistNativePushTokenRefresh(storage, userId, platform, event.token);
      }

      void syncNativePushToken(event.token, userId, platform).catch((error) => {
        reportError(error, "Failed to subscribe refreshed push token", {
          source: "nativePush",
        });
      });
    }),
    nativeModules.FirebaseMessaging.addListener(
      "notificationReceived",
      (event) => {
        void handleForegroundPush(event.notification, nativeModules);
      },
    ),
    nativeModules.FirebaseMessaging.addListener(
      "notificationActionPerformed",
      (action) => {
        handlePushTap(action);
      },
    ),
  ];

  if (nativeModules.LocalNotifications) {
    listenerPromises.push(
      nativeModules.LocalNotifications.addListener(
        "localNotificationActionPerformed",
        (action) => {
          handleLocalNotificationTap(action);
        },
      ),
    );
  }

  listenerHandles = await Promise.all(listenerPromises);
}

async function ensureAppResumeListener() {
  if (appStateListenerHandle) {
    return;
  }

  try {
    const { App } = await import("@capacitor/app");
    appStateListenerHandle = await App.addListener(
      "appStateChange",
      ({ isActive }) => {
        if (!isActive) {
          return;
        }

        const userId = getAuthenticatedUserId();

        if (userId) {
          void ensureNativePushRegistration(userId, "silent");
        }
      },
    );
  } catch {
    // Resume rechecks are best effort; startup and auth-success checks still run.
  }
}

async function getCurrentFcmToken(
  FirebaseMessaging: FirebaseMessagingPlugin,
): Promise<string> {
  const { token } = await FirebaseMessaging.getToken();

  if (!token) {
    throw new Error("Firebase Messaging returned an empty FCM token.");
  }

  return token;
}

async function ensureNativePushRegistration(
  userId: string,
  mode: NativePushRegistrationMode,
): Promise<NativePushRegistrationResult> {
  const storage = getBrowserStorage();

  if (!userId) {
    return "not-authenticated";
  }

  if (!storage) {
    return "no-storage";
  }

  if (isRegistrationInFlight) {
    return "already-in-flight";
  }

  isRegistrationInFlight = true;

  try {
    const nativeModules = await loadNativePushModules();

    if (!nativeModules) {
      return "not-eligible";
    }

    await ensureAppResumeListener();

    let explainerDecision = readExplainerDecision(storage);

    if (
      (!explainerDecision || explainerDecision === "deferred") &&
      mode === "user-consent"
    ) {
      explainerDecision = "accepted";
      persistExplainerDecision(storage, explainerDecision);
    }

    if (explainerDecision !== "accepted") {
      return "explainer-not-accepted";
    }

    const storedPermissionDecision = readPermissionDecision(storage);
    let permissionStatus =
      await nativeModules.FirebaseMessaging.checkPermissions();

    if (
      storedPermissionDecision === "denied" &&
      permissionStatus.receive !== "granted" &&
      mode === "silent"
    ) {
      return "permission-not-granted";
    }

    if (permissionStatus.receive !== "granted") {
      if (mode === "silent") {
        return "permission-not-granted";
      }

      permissionStatus =
        await nativeModules.FirebaseMessaging.requestPermissions();
    }

    if (permissionStatus.receive !== "granted") {
      persistPermissionDecision(storage, "denied");
      return "permission-not-granted";
    }

    persistPermissionDecision(storage, "granted");
    registeredUserId = userId;
    registeredPlatform = nativeModules.platform;
    await createDefaultChannel(nativeModules);
    await ensureNativePushListeners(nativeModules);
    const token = await getCurrentFcmToken(nativeModules.FirebaseMessaging);
    persistCurrentNativePushToken(
      storage,
      userId,
      nativeModules.platform,
      token,
    );

    try {
      await syncNativePushToken(token, userId, nativeModules.platform);
    } catch (error) {
      reportError(
        error,
        "Failed to subscribe this device for push notifications",
        { source: "nativePush" },
      );
    }

    return "registered";
  } catch (error) {
    reportNativePushSetupError(error, "Failed to enable push notifications");
    return "permission-not-granted";
  } finally {
    isRegistrationInFlight = false;
  }
}

export async function requestNativePushPermissionConsent(): Promise<NativePushRegistrationResult> {
  return ensureNativePushRegistration(getAuthenticatedUserId(), "user-consent");
}

export const requestAndroidNativePushPermissionConsent =
  requestNativePushPermissionConsent;

export async function shouldShowNativePushExplainer(): Promise<boolean> {
  if (!getAuthenticatedUserId()) {
    return false;
  }

  const storage = getBrowserStorage();
  const explainerDecision = storage ? readExplainerDecision(storage) : null;

  if (
    !storage ||
    explainerDecision === "accepted" ||
    explainerDecision === "rejected"
  ) {
    return false;
  }

  const nativeModules = await loadNativePushModules();

  if (!nativeModules) {
    return false;
  }

  const permissionStatus =
    await nativeModules.FirebaseMessaging.checkPermissions();
  return permissionStatus.receive !== "granted";
}

export const shouldShowAndroidNativePushExplainer =
  shouldShowNativePushExplainer;

export function rejectNativePushExplainer() {
  const storage = getBrowserStorage();

  if (!storage) {
    return;
  }

  persistExplainerDecision(storage, "rejected");
}

export const rejectAndroidNativePushExplainer = rejectNativePushExplainer;

export function deferNativePushExplainer() {
  const storage = getBrowserStorage();

  if (!storage) {
    return;
  }

  persistExplainerDecision(storage, "deferred");
}

export async function shouldShowNativePushPermissionButton(): Promise<boolean> {
  if (!getAuthenticatedUserId()) {
    return false;
  }

  const nativeModules = await loadNativePushModules();

  if (!nativeModules) {
    return false;
  }

  const storage = getBrowserStorage();

  if (storage && readExplainerDecision(storage) === "rejected") {
    return false;
  }

  const permissionStatus =
    await nativeModules.FirebaseMessaging.checkPermissions();
  return permissionStatus.receive !== "granted";
}

export const shouldShowAndroidNativePushPermissionButton =
  shouldShowNativePushPermissionButton;

export function notifyNativePushAuthSuccess() {
  if (typeof window === "undefined") {
    return;
  }

  window.setTimeout(() => {
    window.dispatchEvent(new CustomEvent(NATIVE_PUSH_AUTH_SUCCESS_EVENT));
  }, 0);
}

export const notifyAndroidNativePushAuthSuccess = notifyNativePushAuthSuccess;

function handleNativePushPermissionEvent() {
  void requestNativePushPermissionConsent();
}

function installNativePushWindowEntrypoint() {
  if (isWindowEntrypointInstalled || typeof window === "undefined") {
    return;
  }

  isWindowEntrypointInstalled = true;

  (window as NativePushWindow).InvestNativePush = {
    requestPermission: requestNativePushPermissionConsent,
    shouldShowPermissionButton: shouldShowNativePushPermissionButton,
  };
  window.addEventListener(
    REQUEST_NATIVE_PUSH_PERMISSION_EVENT,
    handleNativePushPermissionEvent,
  );
}

export function installNativePushBridge(options: NativePushBridgeOptions = {}) {
  nativePushBridgeOptions = { ...nativePushBridgeOptions, ...options };

  if (isBridgeInstalled || typeof window === "undefined") {
    return;
  }

  isBridgeInstalled = true;
  installNativePushWindowEntrypoint();

  const sessionStore = useSessionStore();
  const { isSessionHydrated, userLoggedIn, userSession } =
    storeToRefs(sessionStore);

  stopSessionWatch = watch(
    [
      isSessionHydrated,
      userLoggedIn,
      () => userSession.value?.identity?.id || userSession.value?.id || "",
    ],
    ([isHydrated, isLoggedIn, userId]) => {
      if (isHydrated && isLoggedIn && userId) {
        void ensureNativePushRegistration(userId, "silent");
        flushPendingPushTapDestination();
      }
    },
    { immediate: true },
  );
}

export const installAndroidNativePushBridge = installNativePushBridge;

async function removeNativePushListeners() {
  const handles = listenerHandles;
  listenerHandles = [];

  const appHandle = appStateListenerHandle;
  appStateListenerHandle = null;

  await Promise.all([
    ...handles.map((handle) => handle.remove()),
    appHandle?.remove(),
  ]);
}

export async function cleanupNativePushBridgeOnLogout() {
  const storage = getBrowserStorage();

  registeredUserId = "";
  registeredPlatform = null;
  pendingPushTapHref = "";

  if (storage) {
    clearNativePushTokenSyncState(storage);
  }

  try {
    await removeNativePushListeners();
    const nativeModules = await loadNativePushModules();
    await nativeModules?.FirebaseMessaging.deleteToken();
  } catch (error) {
    reportError(error, "Failed to clear local push registration", {
      source: "nativePush",
    });
  }
}

export const cleanupAndroidNativePushBridgeOnLogout =
  cleanupNativePushBridgeOnLogout;

export function uninstallNativePushBridge() {
  stopSessionWatch?.();
  stopSessionWatch = null;
  nativePushBridgeOptions = {};
  void removeNativePushListeners();
  if (typeof window !== "undefined" && isWindowEntrypointInstalled) {
    window.removeEventListener(
      REQUEST_NATIVE_PUSH_PERMISSION_EVENT,
      handleNativePushPermissionEvent,
    );
  }
  isWindowEntrypointInstalled = false;
  isBridgeInstalled = false;
}

export const uninstallAndroidNativePushBridge = uninstallNativePushBridge;
